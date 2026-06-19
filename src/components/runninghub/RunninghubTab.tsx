import { useEffect, useRef, useState } from 'react';
import { Boxes, Upload, Loader2, AlertCircle, Download, ZoomIn, X, ImageIcon, Sparkles, ChevronsLeftRight, Video, Maximize2, Minimize2, Copy, Check, Settings } from 'lucide-react';
import { Button, Segmented } from '../ui';
import { RunninghubSettings, loadRunninghubKey } from './RunninghubSettings';

// ============== Workflow catalog ==============
// Mỗi entry mô tả 1 RunningHub workflow đã wire UI.
// `mode` quyết định sub-tab. `type` quyết định cách render input/result.
type RhMode = 'upimg' | 'upvid';
interface RhWorkflowParam {
  nodeId: string;
  fieldName: string;
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
}
interface RhWorkflow {
  id: string;
  mode: RhMode;
  type: 'image' | 'video';
  name: string;
  description: string;
  category: string;
  inputNodeId: string;
  inputFieldName: string;
  params?: RhWorkflowParam[];
}

const WORKFLOWS: RhWorkflow[] = [
  {
    id: '2005198388528377858',
    mode: 'upimg',
    type: 'image',
    name: 'SeedVR2.5 — Upscale 4K HD',
    description: 'Phóng to ảnh lên 4K HD chất lượng cao bằng SeedVR2.5. Dùng để nâng cấp ảnh sản phẩm trước khi đăng.',
    category: 'Upscale ảnh',
    // Node 13 (LoadImage) → 12 ImageScaleRestore → 4 JoinImageWithAlpha → 8 SeedVR2VideoUpscaler → 10 SaveImage
    inputNodeId: '13',
    inputFieldName: 'image',
    params: [
      { nodeId: '8', fieldName: 'seed', label: 'Seed', defaultValue: 1205180236, min: 0, max: 999999999, help: 'Đổi seed → ra biến thể khác' },
      { nodeId: '3', fieldName: 'value', label: 'Max resolution (px)', defaultValue: 4096, min: 1024, max: 8192, step: 256, help: 'Cap cạnh dài sau upscale' },
      { nodeId: '12', fieldName: 'scale_to_length', label: 'Pre-downscale (px)', defaultValue: 768, min: 256, max: 1536, step: 64, help: 'Cạnh dài trước upscale' },
    ],
  },
  {
    id: '1980834224272003074',
    mode: 'upvid',
    type: 'video',
    name: 'SeedVR2 — Upscale Video',
    description: 'Phóng to video lên 1080×1920 (vertical) bằng SeedVR2. Tăng độ nét + khử nhiễu, giữ nguyên âm thanh.',
    category: 'Upscale video',
    // Node 139 (VHS_LoadVideo) → 143 SeedVR2 → 144 ImageScale (1080x1920) → 145 VideoCombine
    inputNodeId: '139',
    inputFieldName: 'video',
    params: [
      { nodeId: '139', fieldName: 'frame_load_cap', label: 'Max frames (0 = full)', defaultValue: 0, min: 0, max: 2000, step: 10, help: 'Đặt vd 30 để test nhanh, 0 = full video' },
      { nodeId: '139', fieldName: 'skip_first_frames', label: 'Skip first frames', defaultValue: 10, min: 0, max: 100 },
      { nodeId: '143', fieldName: 'new_resolution', label: 'Upscale target (px)', defaultValue: 1072, min: 480, max: 2160, step: 16, help: 'Cạnh dài sau bước SeedVR2' },
      { nodeId: '143', fieldName: 'batch_size', label: 'Batch size', defaultValue: 33, min: 8, max: 64, help: 'Số frame/batch — giảm nếu OOM' },
      { nodeId: '144', fieldName: 'width', label: 'Output width (px)', defaultValue: 1080, min: 480, max: 2160, step: 8 },
      { nodeId: '144', fieldName: 'height', label: 'Output height (px)', defaultValue: 1920, min: 480, max: 3840, step: 8 },
    ],
  },
];

type TaskStatus = 'idle' | 'uploading' | 'queued' | 'running' | 'success' | 'failed';

interface TaskState {
  workflowId: string;
  workflowName: string;
  workflowType: 'image' | 'video';
  status: TaskStatus;
  taskId: string | null;
  inputImageDataUrl: string;     // for image type only
  inputVideoUrl: string;         // object URL for video preview (video type only)
  outputUrls: string[];
  error: string | null;
  startedAt: number;
  elapsedMs: number;
}

export default function RunninghubTab() {
  const [apiKey, setApiKey] = useState<string>(() => loadRunninghubKey());
  const [mode, setMode] = useState<RhMode>('upimg');

  // Image-mode inputs
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string>('');

  // Video-mode inputs
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');

  const [task, setTask] = useState<TaskState | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [inputDims, setInputDims] = useState<{ w: number; h: number } | null>(null);
  const [outputDims, setOutputDims] = useState<Record<number, { w: number; h: number }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pollAbortRef = useRef<AbortController | null>(null);

  // Active workflow (matches current mode)
  const workflow = WORKFLOWS.find((w) => w.mode === mode) || WORKFLOWS[0];

  // Recent history (last 10 across types, filter by current mode)
  interface HistoryEntry {
    id: string;
    workflowId: string;
    workflowName: string;
    type: 'image' | 'video';
    outputUrl: string;
    finishedAt: number;
  }
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('runninghub-history') || '[]');
    } catch {
      return [];
    }
  });
  const visibleHistory = history
    .filter((h) => h.type === (mode === 'upimg' ? 'image' : 'video'))
    .slice(0, 5);

  // Custom workflow params (per workflow, persisted to localStorage)
  const [paramValues, setParamValues] = useState<Record<string, Record<string, number>>>(() => {
    try {
      return JSON.parse(localStorage.getItem('runninghub-params') || '{}');
    } catch {
      return {};
    }
  });
  const currentParams: Record<string, number> = paramValues[workflow.id] || {};
  const getParamValue = (p: RhWorkflowParam): number => {
    const key = `${p.nodeId}.${p.fieldName}`;
    return currentParams[key] !== undefined ? currentParams[key] : p.defaultValue;
  };
  const updateParam = (p: RhWorkflowParam, value: number) => {
    const key = `${p.nodeId}.${p.fieldName}`;
    setParamValues((prev) => {
      const next = { ...prev, [workflow.id]: { ...(prev[workflow.id] || {}), [key]: value } };
      try { localStorage.setItem('runninghub-params', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const resetParams = () => {
    setParamValues((prev) => {
      const next = { ...prev };
      delete next[workflow.id];
      try { localStorage.setItem('runninghub-params', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const hasCustomParams = Object.keys(currentParams).length > 0;

  // Revoke video object URL on unmount or replacement
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);

  // Resume polling on mount if there's a saved in-flight task
  useEffect(() => {
    const saved = localStorage.getItem('runninghub-active-task');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (!parsed.taskId || !parsed.workflowId) {
        localStorage.removeItem('runninghub-active-task');
        return;
      }
      const restoreWorkflow = WORKFLOWS.find((w) => w.id === parsed.workflowId);
      if (restoreWorkflow) setMode(restoreWorkflow.mode);

      // Restore minimal task state and resume polling
      const controller = new AbortController();
      pollAbortRef.current = controller;
      setTask({
        workflowId: parsed.workflowId,
        workflowName: parsed.workflowName,
        workflowType: parsed.workflowType,
        status: 'running',
        taskId: parsed.taskId,
        inputImageDataUrl: '',
        inputVideoUrl: '',
        outputUrls: [],
        error: null,
        startedAt: parsed.startedAt || Date.now(),
        elapsedMs: parsed.startedAt ? Date.now() - parsed.startedAt : 0,
      });
      (async () => {
        const key = localStorage.getItem('runninghub-api-key') || '';
        if (!key) return;
        try {
          const MAX_ATTEMPTS = 200;
          for (let i = 0; i < MAX_ATTEMPTS; i++) {
            if (controller.signal.aborted) return;
            await new Promise((r) => setTimeout(r, 3000));
            if (controller.signal.aborted) return;
            const sRes = await fetch('/api/runninghub/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({ taskId: parsed.taskId, clientRunninghubApiKey: key }),
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
              setTask((t) => (t ? { ...t, status: 'failed', error: sData?.error || 'Workflow thất bại' } : t));
              return;
            }
          }
          setTask((t) => (t ? { ...t, status: 'failed', error: 'Timeout' } : t));
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
          setTask((t) => (t ? { ...t, status: 'failed', error: e?.message || 'Lỗi resume' } : t));
        }
      })();
    } catch {
      localStorage.removeItem('runninghub-active-task');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push successful task to history
  useEffect(() => {
    if (task?.status === 'success' && task.outputUrls.length > 0 && task.taskId) {
      const entry: HistoryEntry = {
        id: task.taskId,
        workflowId: task.workflowId,
        workflowName: task.workflowName,
        type: task.workflowType,
        outputUrl: task.outputUrls[0],
        finishedAt: Date.now(),
      };
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.id !== entry.id);
        const next = [entry, ...filtered].slice(0, 10);
        try { localStorage.setItem('runninghub-history', JSON.stringify(next)); } catch {}
        return next;
      });
    }
  }, [task?.status, task?.taskId]);

  // Persist active task to localStorage so reload can resume polling
  useEffect(() => {
    if (!task) {
      localStorage.removeItem('runninghub-active-task');
      return;
    }
    if (task.status === 'queued' || task.status === 'running' || task.status === 'uploading') {
      // Save minimal — exclude input dataURLs (can be MB)
      localStorage.setItem(
        'runninghub-active-task',
        JSON.stringify({
          taskId: task.taskId,
          workflowId: task.workflowId,
          workflowName: task.workflowName,
          workflowType: task.workflowType,
          startedAt: task.startedAt,
        }),
      );
    } else {
      localStorage.removeItem('runninghub-active-task');
    }
  }, [task?.status, task?.taskId, task?.workflowId, task?.startedAt, task?.workflowName, task?.workflowType]);

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
    setInputDims(null);
    const idx = dataUrl.indexOf(',');
    setImageBase64(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
  };

  const handleVideoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      alert('File không phải video.');
      return;
    }
    // 100MB hard cap — upload trực tiếp lên RH bypass Vercel body limit
    if (file.size > 100 * 1024 * 1024) {
      alert('Video quá lớn (max 100MB).');
      return;
    }
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    const previewUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoPreviewUrl(previewUrl);
  };

  // Video upload direct frontend → RH (bypass Vercel 4.5MB body limit).
  // Requires CORS to be permissive on RH side (it is — tested with all OpenAPI endpoints).
  const uploadVideoDirectToRH = async (file: File, key: string, signal: AbortSignal): Promise<string> => {
    const form = new FormData();
    form.append('apiKey', key);
    form.append('file', file);
    form.append('fileType', 'video');
    const res = await fetch('https://www.runninghub.ai/task/openapi/upload', {
      method: 'POST',
      body: form,
      signal,
    });
    if (!res.ok) {
      throw new Error(`Upload HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    }
    const data: any = await res.json();
    if (data?.code !== 0) throw new Error(`Upload code ${data?.code}: ${data?.msg || ''}`);
    const fileName = data?.data?.fileName || data?.data?.url;
    if (!fileName) throw new Error('RH không trả file URL');
    return fileName;
  };

  // ============== Run pipeline ==============
  const handleRun = async () => {
    if (!apiKey) {
      alert('Cần nhập RunningHub API key trong Settings ở trên.');
      return;
    }
    if (workflow.type === 'image' && !imageBase64) {
      alert('Cần upload ảnh trước.');
      return;
    }
    if (workflow.type === 'video' && !videoFile) {
      alert('Cần upload video trước.');
      return;
    }

    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;

    setTask({
      workflowId: workflow.id,
      workflowName: workflow.name,
      workflowType: workflow.type,
      status: 'uploading',
      taskId: null,
      inputImageDataUrl: workflow.type === 'image' ? imageDataUrl : '',
      inputVideoUrl: workflow.type === 'video' ? videoPreviewUrl : '',
      outputUrls: [],
      error: null,
      startedAt: Date.now(),
      elapsedMs: 0,
    });
    setOutputDims({});

    try {
      // 1. Upload input — image qua backend (base64), video qua direct frontend (bypass body limit)
      let fileUrl: string;
      if (workflow.type === 'video' && videoFile) {
        fileUrl = await uploadVideoDirectToRH(videoFile, apiKey, controller.signal);
      } else {
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
        fileUrl = upData.fileUrl;
      }

      // 2. Create task — input + tuned params
      const nodeInfoList: Array<{ nodeId: string; fieldName: string; fieldValue: any }> = [
        { nodeId: workflow.inputNodeId, fieldName: workflow.inputFieldName, fieldValue: fileUrl },
      ];
      if (workflow.params) {
        for (const p of workflow.params) {
          nodeInfoList.push({ nodeId: p.nodeId, fieldName: p.fieldName, fieldValue: getParamValue(p) });
        }
      }
      const runRes = await fetch('/api/runninghub/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          workflowId: workflow.id,
          nodeInfoList,
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

      {/* Mode sub-tab */}
      <div className="mb-3">
        <Segmented<RhMode>
          value={mode}
          onChange={(v) => setMode(v)}
          options={[
            { value: 'upimg', label: 'UpIMG', icon: ImageIcon },
            { value: 'upvid', label: 'UpVid', icon: Video },
          ]}
          size="md"
        />
      </div>

      {/* Workflow info card for current mode */}
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
            {workflow.category} · Workflow ID: <code>{workflow.id}</code>
          </p>
        </div>
      </div>

      {/* Recent history (5 last runs for current mode) */}
      {visibleHistory.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block uppercase font-semibold" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
              Gần đây ({visibleHistory.length})
            </label>
            <button
              type="button"
              onClick={() => {
                if (confirm('Xoá toàn bộ lịch sử Recent?')) {
                  setHistory([]);
                  localStorage.removeItem('runninghub-history');
                }
              }}
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Xoá tất cả
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {visibleHistory.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setZoomUrl(h.outputUrl)}
                className="relative aspect-square rounded-lg overflow-hidden group"
                style={{ background: 'var(--color-fill)', border: '0.5px solid var(--color-border-soft)' }}
                title={`${h.workflowName} · ${new Date(h.finishedAt).toLocaleString('vi-VN')}`}
              >
                {h.type === 'image' ? (
                  <img src={h.outputUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <video
                    src={h.outputUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
                  <ZoomIn size={18} color="#fff" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[10px] font-semibold pointer-events-none" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                  {new Date(h.finishedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            ))}
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
          {mode === 'upimg' && (
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
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        setInputDims({ w: img.naturalWidth, h: img.naturalHeight });
                      }}
                      onClick={() => setZoomUrl(imageDataUrl)}
                    />
                    {inputDims && (
                      <div
                        className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-xs font-semibold"
                        style={{
                          background: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        {inputDims.w} × {inputDims.h}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setImageDataUrl(''); setImageBase64(''); setInputDims(null); }}
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
          )}

          {mode === 'upvid' && (
            <div>
              <label className="block uppercase font-semibold mb-1.5" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                Video đầu vào *
              </label>
              <div
                tabIndex={0}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleVideoFile(f);
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (const it of items) {
                    if (it.type.startsWith('video/')) {
                      const f = it.getAsFile();
                      if (f) { handleVideoFile(f); break; }
                    }
                  }
                }}
                style={{ outline: 'none' }}
                className="rounded-lg"
              >
              {!videoPreviewUrl ? (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-lg transition-colors"
                  style={{
                    background: dragOver ? 'var(--color-accent-soft)' : 'var(--color-fill)',
                    border: `1px dashed ${dragOver ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    color: dragOver ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  }}
                >
                  <Video size={24} />
                  <span className="text-sm">Bấm, kéo thả, hoặc Ctrl+V video vào đây</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    .mp4, .mov, .webm (max 100MB) · upload trực tiếp lên RH
                  </span>
                </button>
              ) : (
                <div className="relative">
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="w-full rounded-lg"
                    style={{ maxHeight: 320, background: '#000', border: '0.5px solid var(--color-border-soft)' }}
                  />
                  {videoFile && (
                    <div
                      className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-xs font-semibold"
                      style={{
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      {videoFile.name} · {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
                      setVideoFile(null);
                      setVideoPreviewUrl('');
                    }}
                    className="absolute -top-2 -right-2 p-1 rounded-full"
                    style={{ background: 'var(--color-danger)', color: '#fff' }}
                    aria-label="Xóa video"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              </div>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  handleVideoFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          {/* Advanced settings (collapsible) */}
          {workflow.params && workflow.params.length > 0 && (
            <details
              style={{
                background: 'var(--color-fill)',
                border: '0.5px solid var(--color-border-soft)',
                borderRadius: 12,
                padding: '0',
              }}
            >
              <summary
                className="flex items-center justify-between cursor-pointer px-3 py-2"
                style={{ listStyle: 'none' }}
              >
                <div className="flex items-center gap-2">
                  <Settings size={14} style={{ color: 'var(--color-text-secondary)' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                    Advanced settings ({workflow.params.length})
                  </span>
                  {hasCustomParams && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
                      Đã chỉnh
                    </span>
                  )}
                </div>
                {hasCustomParams && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); resetParams(); }}
                    className="text-xs font-medium"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Reset
                  </button>
                )}
              </summary>
              <div className="px-3 pb-3 pt-1 flex flex-col gap-2">
                {workflow.params.map((p) => {
                  const key = `${p.nodeId}.${p.fieldName}`;
                  const value = getParamValue(p);
                  const isCustomized = currentParams[key] !== undefined && currentParams[key] !== p.defaultValue;
                  return (
                    <div key={key} className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1">
                          <label className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                            {p.label}
                          </label>
                          {isCustomized && <span className="text-xs" style={{ color: 'var(--color-accent)' }}>•</span>}
                        </div>
                        {p.help && (
                          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{p.help}</p>
                        )}
                      </div>
                      <input
                        type="number"
                        value={value}
                        min={p.min}
                        max={p.max}
                        step={p.step || 1}
                        onChange={(e) => updateParam(p, Number(e.target.value))}
                        className="w-24 px-2 py-1 rounded text-xs text-right"
                        style={{
                          background: 'var(--color-bg)',
                          border: `0.5px solid ${isCustomized ? 'var(--color-accent)' : 'var(--color-border-soft)'}`,
                          color: 'var(--color-text)',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </details>
          )}

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
              disabled={!apiKey || (mode === 'upimg' ? !imageBase64 : !videoFile)}
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
                  {task.status === 'uploading' && (task.workflowType === 'video' ? 'Đang upload video lên RunningHub...' : 'Đang upload ảnh lên RunningHub...')}
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
                      {task.workflowType === 'image' &&
                        task.outputUrls.map((url, i) => (
                          <div key={i} className="mb-3">
                            {task.inputImageDataUrl ? (
                              <BeforeAfterSlider
                                beforeUrl={task.inputImageDataUrl}
                                afterUrl={url}
                                outputDims={outputDims[i] || null}
                                onAfterLoad={(w, h) =>
                                  setOutputDims((prev) => ({ ...prev, [i]: { w, h } }))
                                }
                                onZoom={() => setZoomUrl(url)}
                                downloadHref={`/api/proxy-image?url=${encodeURIComponent(url)}`}
                                downloadName={`runninghub-${task.taskId || 'output'}-${i + 1}.png`}
                              />
                            ) : (
                              <div className="relative">
                                <img
                                  src={url}
                                  alt={`Output ${i + 1}`}
                                  className="w-full rounded-lg cursor-zoom-in"
                                  style={{ border: '0.5px solid var(--color-border-soft)' }}
                                  onClick={() => setZoomUrl(url)}
                                />
                                <a
                                  href={`/api/proxy-image?url=${encodeURIComponent(url)}`}
                                  download={`runninghub-${task.taskId || 'output'}-${i + 1}.png`}
                                  className="absolute bottom-2 right-2 p-2 rounded-full"
                                  style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}
                                >
                                  <Download size={14} />
                                </a>
                                <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                                  (Đã khôi phục task sau reload — không có ảnh gốc để so sánh)
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      {task.workflowType === 'video' &&
                        task.outputUrls.map((url, i) => (
                          <div key={i} className="mb-3">
                            {task.inputVideoUrl ? (
                              <VideoBeforeAfterSlider
                                beforeUrl={task.inputVideoUrl}
                                afterUrl={url}
                                downloadHref={url}
                                downloadName={`runninghub-${task.taskId || 'output'}-${i + 1}.mp4`}
                              />
                            ) : (
                              <div>
                                <video
                                  src={url}
                                  controls
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  className="w-full rounded-lg"
                                  style={{ background: '#000', border: '0.5px solid var(--color-accent)' }}
                                />
                                <div className="flex justify-end mt-2">
                                  <a
                                    href={url}
                                    download={`runninghub-${task.taskId || 'output'}-${i + 1}.mp4`}
                                    className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md"
                                    style={{ background: 'var(--color-accent)', color: '#fff' }}
                                  >
                                    <Download size={12} /> Tải video
                                  </a>
                                </div>
                                <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                                  (Đã khôi phục task sau reload — không có video gốc để so sánh)
                                </p>
                              </div>
                            )}
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
          {/(\.(mp4|webm|mov|m4v))(\?|$)/i.test(zoomUrl) ? (
            <video
              src={zoomUrl}
              controls
              autoPlay
              loop
              playsInline
              className="max-w-full max-h-full rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={zoomUrl}
              alt="Zoom"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </main>
  );
}

// ============== Before/After comparison slider ==============
// Vertical drag handle reveals more "before" image (left) when slid right,
// more "after" (result) when slid left. Default 50/50 split.
interface BeforeAfterProps {
  beforeUrl: string;        // input (data URL)
  afterUrl: string;         // result (CDN URL)
  outputDims: { w: number; h: number } | null;
  onAfterLoad: (w: number, h: number) => void;
  onZoom: () => void;
  downloadHref: string;
  downloadName: string;
}

function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  outputDims,
  onAfterLoad,
  onZoom,
  downloadHref,
  downloadName,
}: BeforeAfterProps) {
  const [pct, setPct] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [afterLoaded, setAfterLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(afterUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select+execCommand
      const tmp = document.createElement('textarea');
      tmp.value = afterUrl;
      document.body.appendChild(tmp);
      tmp.select();
      try { document.execCommand('copy'); } catch {}
      tmp.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Reset load state when result url changes (new run)
  useEffect(() => {
    setAfterLoaded(false);
  }, [afterUrl]);

  // ESC key exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [fullscreen]);

  const updateFromClientX = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPct((x / rect.width) * 100);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div className={fullscreen ? 'fixed inset-0 z-[60] flex flex-col items-center justify-center p-4' : 'relative'} style={fullscreen ? { background: 'rgba(0,0,0,0.95)' } : undefined}>
      <div
        ref={wrapRef}
        className={fullscreen
          ? 'relative max-w-full max-h-[calc(100vh-100px)] rounded-lg overflow-hidden select-none flex items-center justify-center'
          : 'relative w-full rounded-lg overflow-hidden select-none'}
        style={{
          border: fullscreen ? 'none' : '0.5px solid var(--color-border-soft)',
          touchAction: 'none',
        }}
      >
        {/* While after is loading, show BEFORE as the base layer at full size so user sees
            the image immediately. After it finishes loading, swap to AFTER as base. */}
        {!afterLoaded && (
          <img
            src={beforeUrl}
            alt=""
            aria-hidden
            className={fullscreen ? 'block max-h-[calc(100vh-100px)] w-auto h-auto' : 'block w-full h-auto'}
            draggable={false}
          />
        )}
        {/* After (result) — base layer once loaded */}
        <img
          src={afterUrl}
          alt="Sau"
          {...({ fetchpriority: 'high' } as any)}
          decoding="async"
          loading="eager"
          className={
            afterLoaded
              ? (fullscreen ? 'block max-h-[calc(100vh-100px)] w-auto h-auto cursor-zoom-in' : 'block w-full h-auto cursor-zoom-in')
              : 'absolute inset-0 w-full h-auto opacity-0 pointer-events-none'
          }
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            onAfterLoad(img.naturalWidth, img.naturalHeight);
            setAfterLoaded(true);
          }}
          onClick={afterLoaded ? onZoom : undefined}
        />
        {/* Before (original) — overlay, clipped from right based on slider */}
        {afterLoaded && (
          <img
            src={beforeUrl}
            alt="Trước"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
            style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
          />
        )}
        {/* Loading overlay (semi-transparent spinner over the placeholder before image) */}
        {!afterLoaded && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
          >
            <Loader2 size={32} className="animate-spin" color="#fff" />
            <p className="text-xs mt-2 font-semibold" style={{ color: '#fff' }}>
              Đang tải ảnh kết quả...
            </p>
          </div>
        )}
        {/* Divider line — only when result has loaded */}
        {afterLoaded && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${pct}%`,
              width: 2,
              transform: 'translateX(-1px)',
              background: '#fff',
              boxShadow: '0 0 8px rgba(0,0,0,0.5)',
            }}
          />
        )}
        {/* Drag handle — only when result has loaded */}
        {afterLoaded && (
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{
              left: `${pct}%`,
              transform: `translate(-50%, -50%)`,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 2px 12px rgba(0,0,0,0.45)',
              cursor: dragging ? 'grabbing' : 'ew-resize',
              border: '2px solid rgba(0,0,0,0.08)',
            }}
          >
            <ChevronsLeftRight size={18} color="#1d1d1f" />
          </div>
        )}
        {/* Labels — only when after has loaded. Left "Trước" simple, right "Sau · WxH" */}
        {afterLoaded && (
          <>
            <div
              className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-semibold pointer-events-none"
              style={{
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                backdropFilter: 'blur(8px)',
              }}
            >
              Trước
            </div>
            <div
              className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs font-semibold pointer-events-none"
              style={{
                background: 'rgba(0,122,255,0.85)',
                color: '#fff',
                backdropFilter: 'blur(8px)',
              }}
            >
              Sau{outputDims ? ` · ${outputDims.w}×${outputDims.h}` : ''}
            </div>
          </>
        )}
        {/* Action buttons — bottom-right */}
        <div className="absolute bottom-2 right-2 flex gap-1">
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            className="p-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}
            title={fullscreen ? 'Thoát fullscreen (Esc)' : 'Mở rộng toàn màn hình'}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            type="button"
            onClick={onZoom}
            className="p-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}
            title="Phóng to ảnh kết quả"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={handleCopyUrl}
            className="p-2 rounded-full"
            style={{ background: copied ? 'rgba(52,199,89,0.85)' : 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}
            title={copied ? 'Đã copy URL!' : 'Copy URL ảnh kết quả'}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <a
            href={downloadHref}
            download={downloadName}
            className="p-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}
            title="Tải về"
          >
            <Download size={14} />
          </a>
        </div>
      </div>
      {!fullscreen && (
        <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
          Kéo thanh dọc qua lại để so sánh · Bấm <Maximize2 size={11} className="inline -mt-0.5" /> để xem fullscreen
        </p>
      )}
    </div>
  );
}

// ============== Video Before/After comparison slider ==============
// Hai video stack — Before phủ lên After bằng clip-path. Cả hai autoplay muted loop
// để xem nhanh. Định kỳ sync currentTime để hai bên không lệch quá xa.
interface VideoBeforeAfterProps {
  beforeUrl: string;
  afterUrl: string;
  downloadHref: string;
  downloadName: string;
}

function VideoBeforeAfterSlider({
  beforeUrl,
  afterUrl,
  downloadHref,
  downloadName,
}: VideoBeforeAfterProps) {
  const [pct, setPct] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [afterReady, setAfterReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [afterMeta, setAfterMeta] = useState<{ w: number; h: number; duration: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLVideoElement>(null);
  const afterRef = useRef<HTMLVideoElement>(null);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(afterUrl);
    } catch {
      const tmp = document.createElement('textarea');
      tmp.value = afterUrl;
      document.body.appendChild(tmp);
      tmp.select();
      try { document.execCommand('copy'); } catch {}
      tmp.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Reset when URL changes (new run)
  useEffect(() => {
    setAfterReady(false);
    setIsPlaying(true);
    setAfterMeta(null);
  }, [afterUrl]);

  // ESC exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [fullscreen]);

  // Format duration: <60s → "12.3s", >=60s → "1:23"
  const formatDuration = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return '?';
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Sync timing: keep BEFORE in step with AFTER. Check every 400ms; only seek when drift > 0.25s.
  useEffect(() => {
    const before = beforeRef.current;
    const after = afterRef.current;
    if (!before || !after) return;
    const interval = setInterval(() => {
      if (Number.isNaN(after.currentTime) || Number.isNaN(before.currentTime)) return;
      const drift = Math.abs(before.currentTime - after.currentTime);
      if (drift > 0.25) before.currentTime = after.currentTime;
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Shared play/pause for both videos
  const togglePlay = () => {
    const before = beforeRef.current;
    const after = afterRef.current;
    if (!before || !after) return;
    if (after.paused) {
      after.play().catch(() => {});
      before.play().catch(() => {});
      setIsPlaying(true);
    } else {
      after.pause();
      before.pause();
      setIsPlaying(false);
    }
  };

  // Space toggles play; ← → frame-step when paused (1/30s = 1 frame at 30fps)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (!isPlaying && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const after = afterRef.current;
        const before = beforeRef.current;
        if (!after || !before) return;
        e.preventDefault();
        const step = 1 / 30;
        const delta = e.key === 'ArrowRight' ? step : -step;
        const max = after.duration || 999;
        const next = Math.max(0, Math.min(max, after.currentTime + delta));
        after.currentTime = next;
        before.currentTime = next;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isPlaying]);

  const updateFromClientX = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPct((x / rect.width) * 100);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div className={fullscreen ? 'fixed inset-0 z-[60] flex flex-col items-center justify-center p-4' : 'relative'} style={fullscreen ? { background: 'rgba(0,0,0,0.95)' } : undefined}>
      <div
        ref={wrapRef}
        onClick={(e) => {
          // Only toggle play when clicking the video itself, not interactive children
          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO') {
            togglePlay();
          }
        }}
        className={fullscreen
          ? 'relative max-w-full max-h-[calc(100vh-100px)] rounded-lg overflow-hidden select-none cursor-pointer flex items-center justify-center'
          : 'relative w-full rounded-lg overflow-hidden select-none cursor-pointer'}
        style={{
          border: fullscreen ? 'none' : '0.5px solid var(--color-border-soft)',
          background: '#000',
          touchAction: 'none',
        }}
      >
        {/* AFTER as base layer */}
        <video
          ref={afterRef}
          src={afterUrl}
          autoPlay
          loop
          muted
          playsInline
          className={fullscreen ? 'block max-h-[calc(100vh-100px)] w-auto h-auto' : 'block w-full h-auto'}
          onLoadedData={() => setAfterReady(true)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setAfterMeta({ w: v.videoWidth, h: v.videoHeight, duration: v.duration });
          }}
        />
        {/* BEFORE overlay, clipped from right by slider */}
        <video
          ref={beforeRef}
          src={beforeUrl}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
        />
        {/* Loading overlay until AFTER has data */}
        {!afterReady && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
          >
            <Loader2 size={32} className="animate-spin" color="#fff" />
            <p className="text-xs mt-2 font-semibold" style={{ color: '#fff' }}>
              Đang tải video kết quả...
            </p>
          </div>
        )}
        {/* Divider + handle — only when after has loaded */}
        {afterReady && (
          <>
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: `${pct}%`,
                width: 2,
                transform: 'translateX(-1px)',
                background: '#fff',
                boxShadow: '0 0 8px rgba(0,0,0,0.5)',
              }}
            />
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
              style={{
                left: `${pct}%`,
                transform: `translate(-50%, -50%)`,
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 2px 12px rgba(0,0,0,0.45)',
                cursor: dragging ? 'grabbing' : 'ew-resize',
                border: '2px solid rgba(0,0,0,0.08)',
              }}
            >
              <ChevronsLeftRight size={18} color="#1d1d1f" />
            </div>
            {/* Labels */}
            <div
              className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-semibold pointer-events-none"
              style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}
            >
              Trước
            </div>
            <div
              className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs font-semibold pointer-events-none"
              style={{ background: 'rgba(0,122,255,0.85)', color: '#fff', backdropFilter: 'blur(8px)' }}
            >
              Sau{afterMeta ? ` · ${afterMeta.w}×${afterMeta.h} · ${formatDuration(afterMeta.duration)}` : ''}
            </div>
            {/* Shared play/pause + download — bottom row */}
            <div
              className="absolute bottom-2 right-2 flex gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={togglePlay}
                className="px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}
                title={isPlaying ? 'Tạm dừng (Space)' : 'Phát (Space)'}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                type="button"
                onClick={() => setFullscreen((v) => !v)}
                className="p-2 rounded-full"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}
                title={fullscreen ? 'Thoát fullscreen (Esc)' : 'Fullscreen'}
              >
                {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="p-2 rounded-full"
                style={{ background: copied ? 'rgba(52,199,89,0.85)' : 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}
                title={copied ? 'Đã copy URL!' : 'Copy URL video kết quả'}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <a
                href={downloadHref}
                download={downloadName}
                className="p-2 rounded-full"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}
                title="Tải video kết quả"
              >
                <Download size={14} />
              </a>
            </div>
          </>
        )}
      </div>
      {!fullscreen && (
        <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
          Kéo thanh dọc · <kbd style={{ padding: '1px 5px', borderRadius: 4, border: '1px solid var(--color-border)', fontSize: 10 }}>Space</kbd> pause/play · <kbd style={{ padding: '1px 5px', borderRadius: 4, border: '1px solid var(--color-border)', fontSize: 10 }}>←</kbd> <kbd style={{ padding: '1px 5px', borderRadius: 4, border: '1px solid var(--color-border)', fontSize: 10 }}>→</kbd> step frame khi pause
        </p>
      )}
    </div>
  );
}
