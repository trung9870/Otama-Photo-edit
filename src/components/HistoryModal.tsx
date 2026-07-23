// User-facing "Lịch sử của tôi" panel: last 15 days of the current user's gens.
// - Query: history where uid==me AND ts>=(now-15d), ordered newest first, capped at 200.
// - Lazy cleanup on open: deletes THIS user's Firestore docs + Storage files older than 15d.
//   No server cron needed; the sweep runs whenever a user opens the panel.
// - Grouped by day header (Hôm nay / Hôm qua / DD-MM-YYYY).
// - Feature filter chip row so users can find "just Ecom" or "just OFA".
// - Per-item: click to zoom, download, delete (with confirm).

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock, Download, Trash2, X, Filter, ZoomIn, Loader2 } from 'lucide-react';
import {
  db, storage,
  collection, query, where, orderBy, limit, getDocs, doc, deleteDoc, Timestamp,
  storageRef, deleteObject,
} from '../firebase';

const RETENTION_DAYS = 15;
const PAGE_LIMIT = 200;

interface HistoryDoc {
  id: string;
  url: string;
  path?: string;
  feature: string;
  model?: string;
  size?: string;
  ts: any; // Firestore Timestamp
}

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  onZoom: (url: string) => void;
}

// Vietnamese labels mirror the Admin panel's FEATURE_LABELS map so the two
// views agree on wording — copied inline to avoid a cross-component import.
const FEATURE_LABELS: Record<string, string> = {
  'clothing-gen': 'Quần áo · Gen',
  'ecom-gen-new': 'Ecom · Gen new',
  'ecom-clone': 'Ecom · Clone',
  'ecom-pattern': 'Ecom · Pattern',
  'ecom-enhance': 'Ecom · Tách/Enhance',
  'ecom-thay': 'Ecom · Thay',
  'ecom-compose': 'Ecom · Ghép ảnh',
  'ofa-nen': 'OFA · Nền',
  'ofa-mau': 'OFA · Mẫu',
  'ofa-anhchinh': 'OFA · Ảnh chính',
  'picset': 'Picset',
};

function featureLabel(f: string): string {
  if (FEATURE_LABELS[f]) return FEATURE_LABELS[f];
  if (f.startsWith('ofa-')) return `OFA · ${f.slice(4)}`;
  return f;
}

function tsMillis(t: any): number {
  if (!t) return 0;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  return 0;
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function humanDay(ms: number): string {
  const now = new Date();
  const today = dayKey(now.getTime());
  const yest = dayKey(now.getTime() - 24 * 3600 * 1000);
  const k = dayKey(ms);
  if (k === today) return 'Hôm nay';
  if (k === yest) return 'Hôm qua';
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

export default function HistoryModal({ open, onClose, userId, onZoom }: HistoryModalProps) {
  const [items, setItems] = useState<HistoryDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureFilter, setFeatureFilter] = useState<string>('all');
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  // ============== Load + lazy cleanup ==============
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 3600 * 1000;
        const cutoffTs = Timestamp.fromMillis(cutoffMs);

        // Fresh window — what the user actually sees.
        const freshQ = query(
          collection(db, 'history'),
          where('uid', '==', userId),
          where('ts', '>=', cutoffTs),
          orderBy('ts', 'desc'),
          limit(PAGE_LIMIT),
        );
        const freshSnap = await getDocs(freshQ);
        if (cancelled) return;
        const list: HistoryDoc[] = freshSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setItems(list);

        // Sweep expired entries for this user in the background — no await,
        // no blocking. Firestore rules limit deletes to the user's own docs.
        (async () => {
          try {
            const staleQ = query(
              collection(db, 'history'),
              where('uid', '==', userId),
              where('ts', '<', cutoffTs),
              limit(50), // small batch — repeat next open if there's more
            );
            const staleSnap = await getDocs(staleQ);
            for (const d of staleSnap.docs) {
              const data = d.data() as any;
              try {
                if (data.path) {
                  await deleteObject(storageRef(storage, data.path)).catch(() => {});
                }
                await deleteDoc(doc(db, 'history', d.id));
              } catch {
                // Swallow — retry on next open.
              }
            }
          } catch {
            // Non-fatal: sweep is best-effort.
          }
        })();
      } catch (e: any) {
        console.warn('history load failed', e);
        if (!cancelled) setError(e?.message || 'Không tải được lịch sử.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // ============== Derive filter chips + grouped items ==============
  const featureCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((it) => {
      counts[it.feature] = (counts[it.feature] || 0) + 1;
    });
    return counts;
  }, [items]);

  const visibleItems = useMemo(() => {
    if (featureFilter === 'all') return items;
    return items.filter((it) => it.feature === featureFilter);
  }, [items, featureFilter]);

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: HistoryDoc[] }[] = [];
    let cur: { key: string; label: string; items: HistoryDoc[] } | null = null;
    for (const it of visibleItems) {
      const ms = tsMillis(it.ts);
      const k = dayKey(ms);
      if (!cur || cur.key !== k) {
        cur = { key: k, label: humanDay(ms), items: [] };
        groups.push(cur);
      }
      cur.items.push(it);
    }
    return groups;
  }, [visibleItems]);

  // ============== Actions ==============
  const handleDelete = async (item: HistoryDoc) => {
    if (!window.confirm('Xóa ảnh này khỏi lịch sử?')) return;
    setDeleting((s) => new Set(s).add(item.id));
    try {
      if (item.path) {
        await deleteObject(storageRef(storage, item.path)).catch(() => {});
      }
      await deleteDoc(doc(db, 'history', item.id));
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e) {
      console.warn('history delete failed', e);
      alert('Không xóa được. Vui lòng thử lại.');
    } finally {
      setDeleting((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    }
  };

  const handleDownload = (url: string, idx: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `otama-history-${Date.now()}-${idx}.jpg`;
    link.click();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative w-full max-w-4xl flex flex-col"
            style={{
              maxHeight: '86vh',
              background: 'var(--color-card)',
              borderRadius: 22,
              border: '0.5px solid var(--color-border-soft)',
              boxShadow: 'var(--shadow-sheet)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between shrink-0"
              style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--color-border-soft)' }}
            >
              <div className="flex items-center gap-2">
                <Clock size={18} style={{ color: 'var(--color-accent)' }} />
                <h3 className="font-bold" style={{ fontSize: 17, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                  Lịch sử của tôi
                </h3>
                <span
                  className="rounded-full"
                  style={{
                    padding: '2px 8px', fontSize: 11, fontWeight: 600,
                    background: 'var(--color-fill)', color: 'var(--color-text-secondary)',
                    marginLeft: 4,
                  }}
                >
                  {items.length} · giữ {RETENTION_DAYS} ngày
                </span>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-fill)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                title="Đóng"
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            {/* Filter chips */}
            {items.length > 0 && (
              <div
                className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar"
                style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--color-border-soft)' }}
              >
                <Filter size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, marginRight: 2 }} />
                <FilterChip
                  active={featureFilter === 'all'}
                  onClick={() => setFeatureFilter('all')}
                  label={`Tất cả (${items.length})`}
                />
                {(Object.entries(featureCounts) as [string, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([f, c]) => (
                    <span key={f}>
                      <FilterChip
                        active={featureFilter === f}
                        onClick={() => setFeatureFilter(f)}
                        label={`${featureLabel(f)} (${c})`}
                      />
                    </span>
                  ))}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '12px 16px 20px' }}>
              {loading ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <Loader2 size={22} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                  <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Đang tải lịch sử…</p>
                </div>
              ) : error ? (
                <div className="py-16 text-center">
                  <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>
                </div>
              ) : items.length === 0 ? (
                <div className="py-20 flex flex-col items-center gap-3 text-center">
                  <Clock size={32} style={{ color: 'var(--color-text-tertiary)' }} />
                  <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                    Chưa có ảnh nào trong {RETENTION_DAYS} ngày qua.
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                    Mỗi lần gen thành công sẽ tự lưu tại đây.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {grouped.map((g) => (
                    <div key={g.key}>
                      <p
                        className="uppercase font-semibold mb-2"
                        style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                      >
                        {g.label} · {g.items.length} ảnh
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {g.items.map((it, idx) => {
                          const isDeleting = deleting.has(it.id);
                          const ms = tsMillis(it.ts);
                          const timeStr = new Date(ms).toLocaleTimeString('vi-VN', {
                            hour: '2-digit', minute: '2-digit',
                          });
                          return (
                            <div
                              key={it.id}
                              className="relative aspect-square rounded-xl overflow-hidden group"
                              style={{
                                background: 'var(--color-fill)',
                                border: '0.5px solid var(--color-border-soft)',
                              }}
                            >
                              <img
                                src={it.url}
                                alt={it.feature}
                                loading="lazy"
                                className="w-full h-full object-cover"
                                style={{ opacity: isDeleting ? 0.4 : 1, transition: 'opacity 200ms' }}
                              />
                              {/* Hover overlay */}
                              <div
                                className="absolute inset-0 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 30%, transparent 60%, rgba(0,0,0,0.65))' }}
                              >
                                <div className="flex items-start justify-between p-2">
                                  <span
                                    className="rounded truncate max-w-[70%]"
                                    style={{
                                      padding: '3px 7px', fontSize: 10, fontWeight: 600,
                                      background: 'rgba(0,0,0,0.55)', color: '#fff',
                                      backdropFilter: 'blur(4px)',
                                    }}
                                  >
                                    {featureLabel(it.feature)}
                                  </span>
                                  <span
                                    className="rounded"
                                    style={{
                                      padding: '3px 6px', fontSize: 10,
                                      background: 'rgba(0,0,0,0.55)', color: '#fff',
                                      backdropFilter: 'blur(4px)',
                                    }}
                                  >
                                    {timeStr}
                                  </span>
                                </div>
                                <div className="flex items-center justify-end gap-1.5 p-2">
                                  <IconBtn
                                    title="Phóng to"
                                    onClick={() => onZoom(it.url)}
                                    disabled={isDeleting}
                                  >
                                    <ZoomIn size={13} />
                                  </IconBtn>
                                  <IconBtn
                                    title="Tải về"
                                    onClick={() => handleDownload(it.url, idx)}
                                    disabled={isDeleting}
                                  >
                                    <Download size={13} />
                                  </IconBtn>
                                  <IconBtn
                                    title="Xóa"
                                    onClick={() => handleDelete(it)}
                                    disabled={isDeleting}
                                    tone="danger"
                                  >
                                    {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                  </IconBtn>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============== Small helpers ==============
function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full whitespace-nowrap transition-colors"
      style={{
        padding: '5px 10px', fontSize: 11, fontWeight: 600,
        background: active ? 'var(--color-accent-soft)' : 'var(--color-fill)',
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        border: '0.5px solid transparent',
      }}
    >
      {label}
    </button>
  );
}

function IconBtn({
  children, onClick, title, disabled, tone,
}: {
  children: any; onClick: () => void; title: string; disabled?: boolean; tone?: 'danger';
}) {
  const color = tone === 'danger' ? '#ff3b30' : '#fff';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded-md transition-transform hover:scale-110 disabled:opacity-40"
      style={{
        padding: 6,
        background: 'rgba(0,0,0,0.55)',
        color,
        backdropFilter: 'blur(4px)',
        border: '0.5px solid rgba(255,255,255,0.15)',
      }}
    >
      {children}
    </button>
  );
}
