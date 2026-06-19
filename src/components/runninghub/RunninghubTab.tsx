import { useEffect, useRef, useState } from 'react';
import { Boxes, Upload, Loader2, AlertCircle, Download, ZoomIn, X, ImageIcon, Sparkles } from 'lucide-react';
import { Button } from '../ui';
import { RunninghubSettings, loadRunninghubKey } from './RunninghubSettings';

// ============== Workflow catalog ==============
// Mỗi entry mô tả 1 RunningHub workflow đã wire UI.
// Khi thêm workflow mới: push thêm entry + xử lý ở handleRun.
interface RhWorkflow {
  id: string;            // workflowId trên RunningHub
  name: string;
  description: string;
  category: string;
  // nodeId của LoadImage trong workflow (input ảnh chính)
  imageNodeId: string;
  // fieldName của input image trong node — thường là 'image'
  imageFieldName: string;
}

const WORKFLOWS: RhWorkflow[] = [
  {
    id: '2005198388528377858',
    name: 'SeedVR2.5 — Upscale 4K HD',
    description: 'Phóng to ảnh lên 4K HD chất lượng cao bằng SeedVR2.5. Dùng để nâng cấp ảnh sản phẩm trước khi đăng.',
    category: 'Upscale',
    imageNodeId: '1',
    imageFieldName: 'image',
  },
];

type TaskStatus = 'idle' | 'uploading' | 'queued' | 'running' | 'success' | 'failed';

interface TaskState {
  workflowId: string;
  workflowName: string;
  status: TaskStatus;
  taskId: string | null;
  inputImageDataUrl: string;
  outputUrls: string[];
  error: string | null;
  startedAt: number;
  elapsedMs: number;
}

export default function RunninghubTab() {
  const [apiKey, setApiKey] = useState<string>(() => loadRunninghubKey());
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(WORKFLOWS[0].id);
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [task, setTask] = useState<TaskState | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollAbortRef = useRef<AbortController | null>(null);

  const workflow = WORKFLOWS.find((w) => w.id === selectedWorkflowId) || WORKFLOWS[0];

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);

  // Update elapsed timer while running
  useEffect(() => {
    if (!task || (task.status !== 'queued' && task.status !== 'running' && task.status !== 'uploading')) return;
    const interval = setInterval(() => {
      setTask((t) => (t ? { ...t, elapsedMs: Date.now() - t.startedAt } : t));
    }, 1000);
    return () => clearInterval(interval);
  }, [task?.status, task?.startedAt]);

  // ============== File handling ==============
  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('File không phải ảnh.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('Ảnh quá lớn (max 20MB).');
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setImageDataUrl(dataUrl);
    const idx = dataUrl.indexOf(',');
    setImageBase64(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
  };

  // ============== Run pipeline ==============
  const handleRun = async () => {
    if (!apiKey) {
      alert('Cần nhập RunningHub API key trong Settings ở trên.');
      return;
    }
    if (!imageBase64) {
      alert('Cần upload ảnh trước.');
      return;
    }

    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;

    setTask({
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'uploading',
      taskId: null,
      inputImageDataUrl: imageDataUrl,
      outputUrls: [],
      error: null,
      startedAt: Date.now(),
      elapsedMs: 0,
    });

    try {
      // 1. Upload ảnh
      const upRes = await fetch('/api/runninghub/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ imageBase64, clientRunninghubApiKey: apiKey }),
      });
      const upData = await upRes.json().catch(() => ({}));
      if (!upRes.ok || !upData?.fileUrl) {
        throw new Error(upData?.error || `Upload fail HTTP ${upRes.status}`);
      }
      const fileUrl: string = upData.fileUrl;

      // 2. Create task
      const runRes = await fetch('/api/runninghub/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          workflowId: workflow.id,
          nodeInfoList: [
            { nodeId: workflow.imageNodeId, fieldName: workflow.imageFieldName, fieldValue: fileUrl },
          ],
          clientRunninghubApiKey: apiKey,
        }),
      });
      const runData = await runRes.json().catch(() => ({}));
      if (!runRes.ok || !runData?.taskId) {
        throw new Error(runData?.error || `Create task fail HTTP ${runRes.status}`);
      }
      const taskId: string = runData.taskId;

      setTask((t) => (t ? { ...t, status: 'queued', taskId } : t));

      // 3. Poll status
      const MAX_ATTEMPTS = 200; // ~10 phút @ 3s
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (controller.signal.aborted) return;
        await new Promise((r) => setTimeout(r, 3000));
        if (controller.signal.aborted) return;

        const sRes = await fetch('/api/runninghub/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ taskId, clientRunninghubApiKey: apiKey }),
        }).catch(() => null);
        if (!sRes) continue;
        const sData = await sRes.json().catch(() => ({}));
        const status: string = (sData?.status || '').toUpperCase();

        if (status === 'QUEUED') {
          setTask((t) => (t ? { ...t, status: 'queued' } : t));
          continue;
        }
        if (status === 'RUNNING') {
          setTask((t) => (t ? { ...t, status: 'running' } : t));
          continue;
        }
        if (status === 'SUCCESS') {
          const outputs: string[] = Array.isArray(sData?.outputs) ? sData.outputs : [];
          setTask((t) => (t ? { ...t, status: 'success', outputUrls: outputs } : t));
          return;
        }
        if (status === 'FAILED') {
          throw new Error(sData?.error || 'Workflow chạy thất bại trên RunningHub');
        }
      }
      throw new Error('Timeout sau 10 phút. Workflow có thể đang nghẽn.');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setTask((t) =>
        t
          ? {
              ...t,
              status: 'failed',
              error: e?.message || 'Lỗi không rõ',
            }
          : t,
      );
    }
  };

  const handleCancel = () => {
    pollAbortRef.current?.abort();
    setTask((t) => (t ? { ...t, status: 'failed', error: 'Đã huỷ' } : t));
  };

  // ============== Render ==============
  const isBusy = task?.status === 'uploading' || task?.status === 'queued' || task?.status === 'running';
  const elapsedSec = task ? Math.floor(task.elapsedMs / 1000) : 0;

  return (
    <main className="flex-1 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Boxes size={20} style={{ color: 'var(--color-accent)' }} />
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>RunningHub Studio</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-fill)', color: 'var(--color-text-tertiary)' }}>
          {WORKFLOWS.length} workflow
        </span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        Chạy ComfyUI workflows trên RunningHub.ai. Yêu cầu account RunningHub có membership trả phí.
      </p>

      {/* Settings */}
      <RunninghubSettings apiKey={apiKey} onChange={setApiKey} />

      {/* Workflow picker */}
      {WORKFLOWS.length > 1 && (
        <div className="mb-4">
          <label className="block uppercase font-semibold mb-2" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
            Chọn workflow
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {WORKFLOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWorkflowId(w.id)}
                className="text-left p-3 rounded-xl transition-colors"
                style={{
                  background: w.id === selectedWorkflowId ? 'var(--color-accent-soft)' : 'var(--color-card)',
                  border: `1px solid ${w.id === selectedWorkflowId ? 'var(--color-accent)' : 'var(--color-border-soft)'}`,
                }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{w.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>{w.category} · {w.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Workflow info card (1 workflow) */}
      {WORKFLOWS.length === 1 && (
        <div
          className="mb-4 p-4 flex items-start gap-3"
          style={{
            background: 'var(--color-card)',
            border: '0.5px solid var(--color-border-soft)',
            borderRadius: 14,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <Sparkles size={18} style={{ color: 'var(--color-accent)', marginTop: 2 }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{workflow.name}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{workflow.description}</p>
            <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
              Workflow ID: <code>{workflow.id}</code>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ============== Left: input ============== */}
        <div
          className="p-5 flex flex-col gap-4"
          style={{
            background: 'var(--color-card)',
            border: '0.5px solid var(--color-border-soft)',
            borderRadius: 18,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div>
            <label className="block uppercase font-semibold mb-1.5" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
              Ảnh đầu vào *
            </label>
            <div
              tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const it of items) {
                  if (it.type.startsWith('image/')) {
                    const f = it.getAsFile();
                    if (f) { handleFile(f); break; }
                  }
                }
              }}
              style={{ outline: 'none' }}
              className="rounded-lg"
            >
              {!imageDataUrl ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-lg transition-colors"
                  style={{
                    background: dragOver ? 'var(--color-accent-soft)' : 'var(--color-fill)',
                    border: `1px dashed ${dragOver ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    color: dragOver ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  }}
                >
                  <Upload size={24} />
                  <span className="text-sm">Bấm, kéo thả, hoặc Ctrl+V ảnh vào đây</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>(max 20MB)</span>
                </button>
              ) : (
                <div className="relative inline-block">
                  <img
                    src={imageDataUrl}
                    alt="Input"
                    className="rounded-lg object-cover cursor-zoom-in"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 300,
                      border: `${dragOver ? '2px' : '0.5px'} solid ${dragOver ? 'var(--color-accent)' : 'var(--color-border-soft)'}`,
                    }}
                    onClick={() => setZoomUrl(imageDataUrl)}
                  />
                  <button
                    type="button"
                    onClick={() => { setImageDataUrl(''); setImageBase64(''); }}
                    className="absolute -top-2 -right-2 p-1 rounded-full"
                    style={{ background: 'var(--color-danger)', color: '#fff' }}
                    aria-label="Xóa ảnh"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

          {/* CTA */}
          {isBusy ? (
            <Button variant="secondary" size="lg" fullWidth icon={X} onClick={handleCancel}>
              Huỷ
            </Button>
          ) : (
            <Button
              variant="filled"
              size="lg"
              fullWidth
              icon={Sparkles}
              disabled={!apiKey || !imageBase64}
              onClick={handleRun}
            >
              Chạy workflow
            </Button>
          )}
          {!apiKey && (
            <p className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              Cần nhập API key ở Settings trên
            </p>
          )}
        </div>

        {/* ============== Right: status + result ============== */}
        <div
          className="p-5 flex flex-col"
          style={{
            background: 'var(--color-card)',
            border: '0.5px solid var(--color-border-soft)',
            borderRadius: 18,
            boxShadow: 'var(--shadow-card)',
            minHeight: 400,
          }}
        >
          {!task ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <ImageIcon size={48} className="mb-3 opacity-30" style={{ color: 'var(--color-text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Kết quả sẽ hiện ở đây sau khi chạy workflow.
              </p>
            </div>
          ) : (
            <>
              {/* Status bar */}
              <div className="flex items-center gap-2 mb-3">
                {isBusy && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-accent)' }} />}
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  {task.status === 'uploading' && 'Đang upload ảnh lên RunningHub...'}
                  {task.status === 'queued' && `Đang chờ trong queue... (${elapsedSec}s)`}
                  {task.status === 'running' && `Đang chạy workflow... (${elapsedSec}s)`}
                  {task.status === 'success' && `Hoàn thành (${elapsedSec}s)`}
                  {task.status === 'failed' && `Thất bại`}
                </p>
              </div>
              {task.taskId && (
                <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
                  Task ID: <code>{task.taskId}</code>
                </p>
              )}

              {task.status === 'failed' && task.error && (
                <div
                  className="flex items-start gap-2 p-3 rounded-lg text-xs"
                  style={{
                    background: 'rgba(255,59,48,0.10)',
                    color: 'var(--color-danger)',
                  }}
                >
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{task.error}</span>
                </div>
              )}

              {(isBusy || task.status === 'success') && (
                <div className="flex-1 flex items-center justify-center">
                  {task.outputUrls.length > 0 ? (
                    <div className="w-full">
                      {task.outputUrls.map((url, i) => (
                        <div key={i} className="relative group mb-3">
                          <img
                            src={url}
                            alt={`Output ${i + 1}`}
                            className="w-full rounded-lg cursor-zoom-in"
                            style={{ border: '0.5px solid var(--color-border-soft)' }}
                            onClick={() => setZoomUrl(url)}
                          />
                          <div className="absolute top-2 right-2 flex gap-1">
                            <button
                              type="button"
                              onClick={() => setZoomUrl(url)}
                              className="p-2 rounded-full"
                              style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}
                              title="Phóng to"
                            >
                              <ZoomIn size={14} />
                            </button>
                            <a
                              href={`/api/proxy-image?url=${encodeURIComponent(url)}`}
                              download={`runninghub-${task.taskId || 'output'}-${i + 1}.png`}
                              className="p-2 rounded-full"
                              style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}
                              title="Tải về"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="w-full aspect-square rounded-lg flex items-center justify-center"
                      style={{
                        background: 'var(--color-fill)',
                        border: '0.5px dashed var(--color-border)',
                      }}
                    >
                      <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
    </main>
  );
}
