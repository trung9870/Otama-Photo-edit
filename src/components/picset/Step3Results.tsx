import { useEffect, useState, useRef, type Key } from 'react';
import { Loader2, Download, AlertCircle, ArrowLeft, RefreshCcw, RotateCcw, X, Check } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Button } from '../ui';

// Per-slot task state used by Step3
export interface PicsetSlotState {
  slot: number;
  taskId: string | null;
  status: 'pending' | 'success' | 'failed';
  url: string | null;
  error: string | null;
  title?: string;
}

interface Step3Props {
  slots: PicsetSlotState[];
  productName: string;
  // Called when Step3 finishes polling all slots (success or fail)
  onAllDone: (final: PicsetSlotState[]) => void;
  onBackToBlueprint: () => void;
  onRestart: () => void;
  // Re-gen only the failed ones (PicsetTab handles the actual /api/picset/generate call)
  onRegenerateFailed: () => void;
  isRegenerating: boolean;
}

// Poll a single Kie task — calls /api/generate-check until success/failed/timeout.
// Server uses env var KIE_API_KEY as fallback when no clientKieApiKey is sent.
async function pollOneTask(
  taskId: string,
  signal: AbortSignal
): Promise<{ url: string | null; error: string | null }> {
  const MAX_ATTEMPTS = 120; // ~6 minutes at 3s
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 3000);
      signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
    });
    if (signal.aborted) return { url: null, error: 'Aborted' };

    const params = new URLSearchParams({ taskId });
    const kie = localStorage.getItem('kieApiKey');
    if (kie) params.set('clientKieApiKey', kie);
    let res: Response;
    try {
      res = await fetch(`/api/generate-check?${params.toString()}`, { signal });
    } catch (e: any) {
      if (e?.name === 'AbortError') return { url: null, error: 'Aborted' };
      continue;
    }
    if (!res.ok) continue;
    const data = await res.json().catch(() => null);
    if (!data) continue;
    if (data.status === 'success') {
      if (!data.url) return { url: null, error: 'Kie xong nhưng không có URL ảnh' };
      return { url: data.url as string, error: null };
    }
    if (data.status === 'failed') {
      return { url: null, error: data.error || 'Kie task failed' };
    }
    // pending → keep polling
  }
  return { url: null, error: 'Timeout: task chạy quá 6 phút' };
}

export default function Step3Results({
  slots,
  productName,
  onAllDone,
  onBackToBlueprint,
  onRestart,
  onRegenerateFailed,
  isRegenerating,
}: Step3Props) {
  const [liveSlots, setLiveSlots] = useState<PicsetSlotState[]>(slots);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initialSlotsKey = slots.map((s) => `${s.slot}:${s.taskId || 'x'}`).join('|');

  // Re-sync when incoming slots change (eg. after regenerate-failed)
  useEffect(() => {
    setLiveSlots(slots);
  }, [initialSlotsKey]);

  // Poll any pending slots
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    const pendings = liveSlots
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => s.status === 'pending' && s.taskId);

    if (pendings.length === 0) {
      // Nothing to poll — fire onAllDone if everything is terminal
      const allTerminal = liveSlots.every((s) => s.status !== 'pending' || !s.taskId);
      if (allTerminal) onAllDone(liveSlots);
      return;
    }

    let completedCount = 0;
    pendings.forEach(({ s, idx }) => {
      pollOneTask(s.taskId as string, controller.signal).then((result) => {
        if (controller.signal.aborted) return;
        setLiveSlots((prev) => {
          const next = prev.slice();
          const cur = next[idx];
          if (!cur) return prev;
          next[idx] = result.url
            ? { ...cur, status: 'success', url: result.url, error: null }
            : { ...cur, status: 'failed', url: null, error: result.error || 'Lỗi không rõ' };
          return next;
        });
        completedCount++;
        if (completedCount === pendings.length) {
          // All polls finished this batch — defer to next tick to grab freshest state
          setTimeout(() => {
            if (controller.signal.aborted) return;
            setLiveSlots((cur) => {
              onAllDone(cur);
              return cur;
            });
          }, 0);
        }
      });
    });

    return () => {
      controller.abort();
    };
    // initialSlotsKey changes when caller swaps in new slots (regenerate-failed flow)
  }, [initialSlotsKey]);

  const total = liveSlots.length;
  const doneCount = liveSlots.filter((s) => s.status === 'success').length;
  const failedCount = liveSlots.filter((s) => s.status === 'failed').length;
  const pendingCount = liveSlots.filter((s) => s.status === 'pending').length;
  const allDone = pendingCount === 0;

  const safeName = (productName || 'picset').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'picset';

  const handleDownload = (url: string, slot: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}-${slot}.png`;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Selection state for bulk ZIP download
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isZipping, setIsZipping] = useState(false);

  const toggleSelect = (slot: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  };

  const successfulSlots = liveSlots.filter((s) => s.status === 'success' && s.url);
  const selectAll = () => setSelected(new Set(successfulSlots.map((s) => s.slot)));
  const clearSelection = () => setSelected(new Set());

  // Download list of slots as a single ZIP (via /api/proxy-image to bypass CORS on the URLs)
  const downloadAsZip = async (slotsToZip: PicsetSlotState[]) => {
    if (slotsToZip.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(safeName) || zip;
      await Promise.all(
        slotsToZip.map(async (s) => {
          if (!s.url) return;
          // Proxy fetch to bypass cross-origin issues on Kie's CDN
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(s.url)}`;
          const res = await fetch(proxyUrl).catch(() => null);
          if (!res || !res.ok) return;
          const blob = await res.blob();
          folder.file(`${safeName}-${String(s.slot).padStart(2, '0')}.png`, blob);
        })
      );
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${safeName}-${slotsToZip.length}-anh.zip`);
    } catch (e: any) {
      console.error('ZIP download failed:', e);
      alert(`Không tải được ZIP: ${e?.message || 'lỗi không rõ'}`);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadAll = () => downloadAsZip(successfulSlots);
  const handleDownloadSelected = () => downloadAsZip(successfulSlots.filter((s) => selected.has(s.slot)));

  return (
    <div className="flex flex-col gap-4">
      {/* Status bar */}
      <div
        className="flex flex-wrap items-center gap-3 p-3 rounded-2xl"
        style={{
          background: 'var(--color-card)',
          border: '0.5px solid var(--color-border-soft)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {allDone
              ? failedCount === 0
                ? `Hoàn thành ${doneCount}/${total} ảnh`
                : `Xong ${doneCount}/${total} ảnh • ${failedCount} fail`
              : `Đang gen... ${doneCount}/${total} xong${failedCount ? ` • ${failedCount} fail` : ''}`}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Mỗi ảnh có thể mất 30s–2 phút. Có ảnh xong sẽ hiện ngay, các ảnh khác tiếp tục.
          </p>
        </div>
        {allDone && doneCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {selected.size > 0 ? (
              <>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs font-medium px-2 py-1 rounded-md"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Bỏ chọn ({selected.size})
                </button>
                <Button
                  variant="filled"
                  size="md"
                  icon={isZipping ? undefined : Download}
                  onClick={handleDownloadSelected}
                  disabled={isZipping}
                >
                  {isZipping ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Đang nén...
                    </span>
                  ) : (
                    `Tải ${selected.size} ảnh (ZIP)`
                  )}
                </Button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-medium px-2 py-1 rounded-md"
                  style={{ color: 'var(--color-accent)' }}
                >
                  Chọn tất cả
                </button>
                <Button
                  variant="secondary"
                  size="md"
                  icon={isZipping ? undefined : Download}
                  onClick={handleDownloadAll}
                  disabled={isZipping}
                >
                  {isZipping ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Đang nén...
                    </span>
                  ) : (
                    `Tải tất cả (${doneCount} ảnh, ZIP)`
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {liveSlots.map((s, idx) => (
          <SlotCard
            key={`${s.slot}-${idx}`}
            slot={s}
            isSelected={selected.has(s.slot)}
            onToggleSelect={() => toggleSelect(s.slot)}
            onZoom={setZoomUrl}
            onDownload={() => s.url && handleDownload(s.url, s.slot)}
          />
        ))}
      </div>

      {/* Action bar */}
      {allDone && (
        <div
          className="flex flex-wrap items-center gap-2 p-3 rounded-2xl"
          style={{
            background: 'var(--color-card)',
            border: '0.5px solid var(--color-border-soft)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <Button variant="secondary" size="md" icon={ArrowLeft} onClick={onBackToBlueprint}>
            Sửa Blueprint
          </Button>
          {failedCount > 0 && (
            <Button
              variant="tinted"
              size="md"
              icon={isRegenerating ? undefined : RefreshCcw}
              onClick={onRegenerateFailed}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Đang tạo lại...
                </span>
              ) : (
                `Gen lại ${failedCount} ảnh fail`
              )}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="filled" size="md" icon={RotateCcw} onClick={onRestart}>
            Bắt đầu sản phẩm mới
          </Button>
        </div>
      )}

      {/* Lightbox */}
      {zoomUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setZoomUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
            onClick={() => setZoomUrl(null)}
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
          <img
            src={zoomUrl}
            alt="Zoom"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ============== Slot card ==============
interface SlotCardProps {
  key?: Key;
  slot: PicsetSlotState;
  isSelected: boolean;
  onToggleSelect: () => void;
  onZoom: (url: string) => void;
  onDownload: () => void;
}

function SlotCard({ slot, isSelected, onToggleSelect, onZoom, onDownload }: SlotCardProps) {
  const isLoading = slot.status === 'pending';
  const isError = slot.status === 'failed';
  const isDone = slot.status === 'success' && slot.url;

  return (
    <div
      className="relative rounded-2xl overflow-hidden aspect-[4/5]"
      style={{
        background: 'var(--color-fill)',
        border: isSelected ? '2px solid var(--color-accent)' : '0.5px solid var(--color-border-soft)',
        boxShadow: isSelected ? '0 0 0 3px var(--color-accent-soft), var(--shadow-card)' : 'var(--shadow-card)',
        transition: 'border-color 120ms, box-shadow 120ms',
      }}
    >
      {/* Slot badge */}
      <div
        className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-xs font-bold"
        style={{
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          backdropFilter: 'blur(8px)',
        }}
      >
        #{slot.slot}
      </div>

      {/* Selection checkbox — only for completed slots */}
      {isDone && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          className="absolute top-2 right-2 z-10 flex items-center justify-center rounded-md"
          style={{
            width: 24,
            height: 24,
            background: isSelected ? 'var(--color-accent)' : 'rgba(0,0,0,0.5)',
            border: isSelected ? '0' : '1.5px solid rgba(255,255,255,0.7)',
            backdropFilter: 'blur(8px)',
            transition: 'all 120ms',
          }}
          aria-label={isSelected ? 'Bỏ chọn ảnh' : 'Chọn ảnh'}
        >
          {isSelected && <Check size={14} strokeWidth={3} color="#fff" />}
        </button>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Đang gen...
          </p>
        </div>
      )}

      {isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
          <AlertCircle size={24} style={{ color: 'var(--color-danger)' }} />
          <p className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
            Gen thất bại
          </p>
          <p className="text-[10px] line-clamp-3" style={{ color: 'var(--color-text-tertiary)' }}>
            {slot.error || 'Lỗi không rõ'}
          </p>
        </div>
      )}

      {isDone && slot.url && (
        <>
          <img
            src={slot.url}
            alt={`Ảnh ${slot.slot}`}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => onZoom(slot.url as string)}
          />
          <button
            type="button"
            onClick={onDownload}
            className="absolute bottom-2 right-2 z-10 p-2 rounded-full"
            style={{
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              backdropFilter: 'blur(8px)',
            }}
            aria-label="Tải ảnh"
          >
            <Download size={14} />
          </button>
        </>
      )}
    </div>
  );
}
