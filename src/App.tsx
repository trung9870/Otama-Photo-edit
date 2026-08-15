/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, Component } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from './utils/cropImage';
import { stitchImages } from './utils/imageStitcher';

// Guard old unreachable fallback branches against accidental Google-direct use.
class KieOnlyGuard {
  models: any;
  constructor(_options?: unknown) {
    throw new Error('Direct Google calls are disabled. Use Kie.ai.');
  }
}
import { 
  Upload,
  Palette,
  RotateCcw,
  Wallet,
  Loader2, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ScanSearch,
  Download,
  ImageIcon,
  Layers,
  X,
  Plus,
  Trash2,
  Save,
  ChevronRight,
  Edit2,
  Search,
  Scan,
  Copy,
  Shirt,
  User as UserIcon,
  ArrowLeft,
  LogIn,
  LogOut,
  Globe,
  Settings,
  Crop,
  RotateCw,
  Wand2,
  ZoomIn,
  MessageSquare,
  Languages,
  Bed,
  Pencil,
  Check,
  Clock,
  Sun,
  Moon,
  Monitor,
  Key,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  OperationType,
  handleFirestoreError,
  User as FirebaseUser
} from './firebase';
import AdminPanel from './components/AdminPanel';
import { useTheme } from './hooks/useTheme';
import { useNotify } from './hooks/useNotify';
import { Button } from './components/ui';
import { Header } from './components/Header';
import HistoryModal from './components/HistoryModal';
import { Login } from './components/Login';
import { CreditEstimate, GenerationSettingsPopover, ModelLogo, Segmented, SettingsDropdown } from './components/ui';
import type { SettingsDropdownOption } from './components/ui';
import { ARSelector, ModelCardPicker, PromptRow, PromptListModal } from './components/clothing';
import { OFA_PROMPT_LIBRARY, buildOfaPrompt, type OfaPromptCategory } from './utils/ofaPromptLibrary';
import { downloadFile } from './utils/downloadFile';
import PicsetTab from './components/picset/PicsetTab';
import RunninghubTab from './components/runninghub/RunninghubTab';
import { apiFetch } from './utils/apiFetch';
import { KIE_CREDIT_USD, creditsPerImage, creditsPerVideo, estimateGenerationCredits } from './utils/creditEstimate';

type OfaBatchStatus = 'queued' | 'running' | 'done' | 'cancelled' | 'error';
interface OfaBatch {
  id: string;
  startedAt: number;
  finishedAt?: number;
  productName: string;
  description: string;
  imageBase64s: string[];
  categoryIds: number[];
  aspectRatio: string;
  quality: string;
  model: 'gpt2' | 'banana-pro';
  results: { categoryId: number; urls: string[] }[];
  status: OfaBatchStatus;
  errorMessage?: string;
}
const OFA_MAX_CONCURRENT = 3;

// Concurrent Gen new batches in Ecom tab — submit + run in parallel without blocking input
type EcomBatchStatus = 'running' | 'done' | 'failed';
interface EcomBatch {
  id: string;
  startedAt: number;
  finishedAt?: number;
  promptText: string;              // full prompt used at submit time (incl. supplementary) — internal
  promptSource: 'manual' | 'saved';// 'saved' → hide promptText in UI (admin protection)
  promptLabel?: string;            // saved prompt name (only when source='saved')
  promptId?: string;
  basePromptText?: string;
  supplementaryPrompt?: string;
  inputImage?: string | null;
  inputImages?: string[];
  imageCount: number;
  model: ModelType;
  aspectRatio: string;
  imageSize: string;
  t2iMode?: boolean;               // true when batch was submitted as text-to-image (no product image)
  mediaType?: 'image' | 'video';
  duration?: number;
  generateAudio?: boolean;
  results: string[];               // URLs / data URIs
  status: EcomBatchStatus;
  errorMessage?: string;
}

interface EcomHistoryItem {
  id: string;
  url: string;
  feature: string;
  model?: string;
  size?: string;
  batchId?: string;
  prompt?: string;
  supplementaryPrompt?: string;
  promptId?: string;
  promptSource?: 'manual' | 'saved';
  inputImage?: string;
  inputImages?: string[];
  modelKey?: ModelType;
  aspectRatio?: string;
  imageCount?: number;
  t2iMode?: boolean;
  mediaType?: 'image' | 'video';
  duration?: number;
  generateAudio?: boolean;
  ts: any;
}

interface EcomGenerationSettings {
  prompt?: string;
  supplementaryPrompt?: string;
  promptId?: string;
  promptSource?: 'manual' | 'saved';
  inputImage?: string | null;
  inputImages?: string[];
  modelKey?: ModelType;
  aspectRatio?: string;
  imageSize?: string;
  imageCount?: number;
  t2iMode?: boolean;
  mediaType?: 'image' | 'video';
  duration?: number;
  generateAudio?: boolean;
}

// Error Boundary Component
class ErrorBoundary extends Component<React.PropsWithChildren, { hasError: boolean; error: any }> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const state = this.state;
    const props = this.props;

    if (state.hasError) {
      let errorMessage = "Đã có lỗi xảy ra.";
      const error = state.error;
      if (error && error.message) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errorMessage = `Lỗi hệ thống: ${parsed.error}`;
        } catch (e) {
          errorMessage = error.message;
        }
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops! Có lỗi rồi</h1>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return props.children;
  }
}

// Extend window for AI Studio API key selection
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface EditableImage {
  id: string;
  source: string;
  processed: string | null;
  isProcessing: boolean;
  error: string | null;
  aspectRatio: string;
}

const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1' },
  { label: '3:4', value: '3:4' },
  { label: '4:3', value: '4:3' },
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
];

interface SavedPrompt {
  id: string;
  name: string;
  prompt: string;
  isDefault?: boolean;
  isSecret?: boolean;
}

interface SavedModel {
  id: string;
  imageUrl: string;
  uid: string;
  createdAt: any;
  isShared?: boolean;
}

interface SavedRoom {
  id: string;
  imageUrl: string;
  uid: string;
  createdAt: any;
  isShared?: boolean;
}

const DEFAULT_GEN_PROMPTS: SavedPrompt[] = [
  { id: 'g1', name: '✨ Prompt chính', prompt: '', isDefault: true, isSecret: true },
  { id: 'g2', name: '📸 Chụp Flat Lay', prompt: '', isDefault: true, isSecret: true },
];

const DEFAULT_TRYON_PROMPTS: SavedPrompt[] = [
  { id: 't1', name: '👕 Nửa người', prompt: '', isDefault: true, isSecret: true },
  { id: 't2', name: '👖 Thay quần', prompt: '', isDefault: true, isSecret: true },
];

const DEFAULT_ECOM_PROMPTS: SavedPrompt[] = [
  { id: 'e1', name: 'Prompt 1', prompt: '', isDefault: true, isSecret: true },
  { id: 'e2', name: 'Prompt 2', prompt: '', isDefault: true, isSecret: true },
];

function hasAnyFeaturePermission(profile: Record<string, any> | null | undefined): boolean {
  return Boolean(
    profile?.canUseClothing ||
    profile?.canUseEcom ||
    profile?.canUseOfa ||
    profile?.canUsePicset ||
    profile?.canUseRunninghub
  );
}

const MODEL_CONFIG = {
  'gpt2': {
    id: 'gpt-image-2-image-to-image',
    name: 'GPT2',
    description: 'Sử dụng Kie.ai (Yêu cầu Kie API Key trong cài đặt)',
    requiredKey: 'kie',
    mediaType: 'image' as const,
  },
  'banana-pro': {
    id: 'nano-banana-pro',
    name: 'Banana Pro',
    description: 'Google Nano Banana Pro qua Kie.ai (rẻ hơn ~33-50% so với Google trực tiếp).',
    requiredKey: 'kie',
    mediaType: 'image' as const,
  },
  'banana-2': {
    id: 'nano-banana-2',
    name: 'Banana 2',
    description: 'Google Nano Banana 2 qua Kie.ai (rẻ hơn ~40% so với Google trực tiếp).',
    requiredKey: 'kie',
    mediaType: 'image' as const,
  },
  'seedream-4-5': {
    // Internal id (kebab-case) — backend swaps to "seedream/4.5-edit" or "seedream/4.5-text-to-image" alias
    id: 'seedream-4-5-edit',
    name: 'Seedream 4.5',
    description: 'ByteDance Seedream 4.5 qua Kie.ai (~$0.032/ảnh, hỗ trợ 4K). Tự chuyển sang T2I khi không có ảnh.',
    requiredKey: 'kie',
    mediaType: 'image' as const,
  },
  'google-omni': {
    id: 'gemini-omni-video',
    name: 'Google Omni',
    description: 'Google Gemini Omni tạo video qua Kie.ai, hỗ trợ prompt hoặc tối đa 7 ảnh tham chiếu.',
    requiredKey: 'kie',
    mediaType: 'video' as const,
  },
  'seedance-2-5': {
    id: 'bytedance/seedance-2-5',
    name: 'Seedance 2.5',
    description: 'ByteDance Seedance 2.5 tạo video qua Kie.ai, hỗ trợ ảnh tham chiếu và âm thanh.',
    requiredKey: 'kie',
    mediaType: 'video' as const,
  }
};

type ModelType = keyof typeof MODEL_CONFIG;
const IMAGE_MODEL_KEYS: ModelType[] = ['gpt2', 'banana-pro', 'banana-2', 'seedream-4-5'];
const VIDEO_MODEL_KEYS: ModelType[] = ['google-omni', 'seedance-2-5'];
const isVideoModelKey = (model: ModelType) => MODEL_CONFIG[model].mediaType === 'video';
type EcomSubTab = 'gen-new' | 'gen-video' | 'clone-template' | 'pattern-replace' | 'thay' | 'ghep-anh';
const isEcomGenerationTab = (tab: EcomSubTab) => tab === 'gen-new' || tab === 'gen-video';

const MODEL_ASPECT_RATIOS: Record<ModelType, string[]> = {
  gpt2: ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', '2:1', '1:2', '3:1', '1:3', '21:9', '9:21'],
  'banana-pro': ['auto', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
  'banana-2': ['auto', '1:1', '2:3', '3:2', '1:4', '4:1', '3:4', '4:3', '4:5', '5:4', '1:8', '8:1', '9:16', '16:9', '21:9'],
  'seedream-4-5': ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'],
  'google-omni': ['16:9', '9:16'],
  'seedance-2-5': ['auto', '1:1', '4:3', '3:4', '16:9', '9:16', '21:9'],
};

// Keep the ratio menu stable when switching models. Unsupported ratios remain
// visible for comparison, but SettingsDropdown renders them dimmed + disabled.
const ALL_ASPECT_RATIOS = [
  'auto', '1:1',
  '3:2', '2:3',
  '4:3', '3:4',
  '5:4', '4:5',
  '16:9', '9:16',
  '2:1', '1:2',
  '3:1', '1:3',
  '4:1', '1:4',
  '8:1', '1:8',
  '21:9', '9:21',
] as const;

// Resize + re-encode an image data URL so the request body fits Vercel's 4.5 MB limit.
// Keeps aspect ratio. Default 1600px long edge / JPEG 0.85 ≈ 200-400 KB per image.
async function compressImageDataUrl(dataUrl: string, maxDim = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context error'));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Image load error'));
    img.src = dataUrl;
  });
}

// Upload reference files straight from the browser to Kie's temporary storage.
// This bypasses Vercel's 4.5 MB request-body limit while preserving the original
// PNG/JPEG/WebP bytes, dimensions, MIME type, EXIF, and color profile.
async function uploadOriginalReferenceToKie(source: string, apiKey: string, index: number): Promise<string> {
  if (/^https?:\/\//i.test(source)) return source;
  if (!source.startsWith('data:')) throw new Error('Ảnh tham chiếu không có định dạng hợp lệ.');

  const mimeType = source.match(/^data:([^;,]+)/)?.[1] || 'application/octet-stream';
  const extension = mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/webp'
      ? 'webp'
      : mimeType === 'image/jpeg'
        ? 'jpg'
        : 'bin';
  const blob = await (await fetch(source)).blob();
  const formData = new FormData();
  formData.append('file', blob, `reference-${Date.now()}-${index + 1}.${extension}`);
  formData.append('uploadPath', 'images/otama-references');
  formData.append('fileName', `reference-${Date.now()}-${index + 1}.${extension}`);

  const response = await fetch('https://kieai.redpandaai.co/api/file-stream-upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  const downloadUrl = data?.data?.downloadUrl;
  if (!response.ok || !downloadUrl) {
    throw new Error(data?.msg || `Kie upload lỗi ${response.status}`);
  }
  return downloadUrl;
}

async function prepareKieReferences(sources: string[], apiKey: string): Promise<string[]> {
  const validSources = sources.filter((source) => typeof source === 'string' && source.length > 0);
  if (validSources.length === 0) return [];

  // A personal Kie key allows lossless direct upload. The key already lives in
  // this browser's local storage and is sent to /api/generate in the current app.
  if (apiKey) {
    try {
      return await Promise.all(validSources.map((source, index) =>
        uploadOriginalReferenceToKie(source, apiKey, index)
      ));
    } catch (error) {
      console.warn('Direct Kie reference upload failed; using adaptive request fallback.', error);
    }
  }

  // Server-key fallback: keep originals when they fit. Only if Vercel's hard
  // body limit would be exceeded do we adaptively reduce them, at a much higher
  // ceiling/quality than the previous fixed 1600px JPEG 0.85 conversion.
  const TARGET_JSON_CHARS = 3_300_000;
  if (validSources.reduce((sum, source) => sum + source.length, 0) <= TARGET_JSON_CHARS) {
    return validSources;
  }

  const profiles = [
    { maxDim: 3072, quality: 0.96 },
    { maxDim: 2560, quality: 0.95 },
    { maxDim: 2048, quality: 0.93 },
    { maxDim: 1600, quality: 0.90 },
    { maxDim: 1280, quality: 0.88 },
    { maxDim: 1024, quality: 0.85 },
  ];
  let prepared = validSources;
  for (const profile of profiles) {
    prepared = await Promise.all(validSources.map((source) =>
      /^https?:\/\//i.test(source) ? source : compressImageDataUrl(source, profile.maxDim, profile.quality)
    ));
    if (prepared.reduce((sum, source) => sum + source.length, 0) <= TARGET_JSON_CHARS) break;
  }
  return prepared;
}

function isEncryptedSharedPrompt(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('enc:v1:');
}

async function decryptSharedPromptForAdmin(encryptedPrompt: string): Promise<string> {
  const response = await apiFetch('/api/kie-credits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'decrypt', prompt: encryptedPrompt }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.prompt !== 'string') {
    throw new Error(data.error || 'Không thể mở prompt bảo mật.');
  }
  return data.prompt;
}

async function encryptSharedPromptForAdmin(plaintext: string): Promise<string> {
  const response = await apiFetch('/api/kie-credits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'encrypt', prompt: plaintext }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.prompt !== 'string') {
    throw new Error(data.error || 'Không thể mã hóa prompt.');
  }
  return data.prompt;
}

// Poll an array of Kie.ai task IDs until each completes (or fails / times out).
// Returns the resulting image URLs in the same order as taskIds.
// Each poll request hits /api/generate-check (~1s), so a Vercel function
// timeout never applies to the long-running KIE task itself.
async function pollKieTasks(
  taskIds: string[],
  signal?: AbortSignal,
  options?: { mediaType?: 'image' | 'video' },
): Promise<string[]> {
  const isVideo = options?.mediaType === 'video';
  const throwIfAborted = () => {
    if (signal?.aborted) {
      const err = new Error('Aborted');
      (err as any).name = 'AbortError';
      throw err;
    }
  };
  const pollSingle = async (taskId: string): Promise<string> => {
    const MAX_ATTEMPTS = isVideo ? 300 : 120; // video: ~15 minutes; image: ~6 minutes
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      // Sleep but wake immediately if aborted
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 3000);
        if (signal) {
          const onAbort = () => { clearTimeout(t); resolve(); };
          signal.addEventListener('abort', onAbort, { once: true });
        }
      });
      throwIfAborted();
      const params = new URLSearchParams({ taskId });
      let res: Response;
      try {
        res = await apiFetch(`/api/generate-check?${params.toString()}`, { signal });
      } catch (e: any) {
        if (e?.name === 'AbortError') throw e;
        continue; // transient network error → retry
      }
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      if (!data) continue;
      if (data.status === 'success') {
        if (!data.url) throw new Error(`Kie.ai task xong nhưng không có URL ${isVideo ? 'video' : 'ảnh'}.`);
        return data.url as string;
      }
      if (data.status === 'failed') {
        throw new Error(data.error || 'Kie.ai task failed');
      }
      // status === 'pending' → keep polling
    }
    throw new Error(`Timeout: Kie.ai task chạy quá lâu (>${isVideo ? 15 : 6} phút). Vui lòng thử lại.`);
  };
  return Promise.all(taskIds.map(pollSingle));
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

function App() {
  // Apple-style theme — Milestone 0 foundation
  const { theme, setTheme, resolvedTheme } = useTheme();
  const notify = useNotify();
  // One-time ask modal: after the first gen completes, if user hasn't been asked yet
  // and notifications are still off, offer to enable them.
  const [showNotifyAsk, setShowNotifyAsk] = useState(false);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [images, setImages] = useState<EditableImage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState<ModelType>('banana-pro');
  const [activeTab, setActiveTab] = useState<'generate' | 'analyze' | 'tryon'>('generate');
  
  // App Mode
  const [appMode, setAppMode] = useState<'clothing' | 'ecom' | 'ofa' | 'picset' | 'runninghub' | 'admin'>('ecom');

  // API Keys and Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // Provider credentials are server-only. Keep legacy variables empty so old,
  // unreachable compatibility branches cannot accidentally expose a key.
  const kieApiKey = '';
  const googleApiKey = '';

  useEffect(() => {
    localStorage.removeItem('kieApiKey');
    localStorage.removeItem('googleApiKey');
    localStorage.removeItem('runninghub-api-key');
  }, []);

  // Ecom State
  const [ecomSavedPrompts, setEcomSavedPrompts] = useState<SavedPrompt[]>(DEFAULT_ECOM_PROMPTS);
  const [selectedEcomPromptId, setSelectedEcomPromptId] = useState<string>('manual');
  const [ecomPromptText, setEcomPromptText] = useState<string>('');
  const selectedEcomSavedPrompt = ecomSavedPrompts.find(prompt => prompt.id === selectedEcomPromptId);
  const ecomUsesSecretPrompt = selectedEcomSavedPrompt?.isSecret === true;
  const [draggedEcomPromptIndex, setDraggedEcomPromptIndex] = useState<number | null>(null);
  const [ecomSupplementaryPrompt, setEcomSupplementaryPrompt] = useState<string>('');
  // Kho prompt riêng cho tab Thay (type 'ecom-thay'), tách khỏi Gen new
  const [ecomThaySavedPrompts, setEcomThaySavedPrompts] = useState<SavedPrompt[]>([]);
  const [showThayPromptAll, setShowThayPromptAll] = useState(false);
  const [isAddingThayPrompt, setIsAddingThayPrompt] = useState(false);
  const [newThayPromptName, setNewThayPromptName] = useState('');
  const [newThayPromptText, setNewThayPromptText] = useState('');
  const [editingThayPromptId, setEditingThayPromptId] = useState<string | null>(null);
  const [thayManualMode, setThayManualMode] = useState(false);
  const [selectedEcomThayPromptId, setSelectedEcomThayPromptId] = useState<string | null>(null);
  const selectedEcomThaySavedPrompt = ecomThaySavedPrompts.find(prompt => prompt.id === selectedEcomThayPromptId);

  useEffect(() => {
    if (selectedEcomPromptId !== 'manual') {
      const selected = ecomSavedPrompts.find(p => p.id === selectedEcomPromptId);
      if (selected?.prompt && selected.prompt !== ecomPromptText) {
        setEcomPromptText(selected.prompt);
      }
    }
  }, [ecomSavedPrompts, selectedEcomPromptId]);

  const [isAddingEcomPrompt, setIsAddingEcomPrompt] = useState(false);
  const [showEcomPromptModal, setShowEcomPromptModal] = useState(false);
  const [ecomComposerExpanded, setEcomComposerExpanded] = useState(false);
  const ecomPromptSectionRef = useRef<HTMLDivElement>(null);
  const ecomMainRef = useRef<HTMLElement>(null);
  const [ecomPromptPopupTop, setEcomPromptPopupTop] = useState(20);
  useEffect(() => {
    if (!showEcomPromptModal) return;
    const compute = () => {
      const main = ecomMainRef.current;
      const section = ecomPromptSectionRef.current;
      if (!main || !section) return;
      const mainRect = main.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      setEcomPromptPopupTop(Math.max(0, sectionRect.top - mainRect.top));
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [showEcomPromptModal]);
  const [showGenPromptModal, setShowGenPromptModal] = useState(false);
  const [showTryOnPromptModal, setShowTryOnPromptModal] = useState(false);
  const [newEcomPromptName, setNewEcomPromptName] = useState('');
  const [editingEcomPromptId, setEditingEcomPromptId] = useState<string | null>(null);

  const startEditEcomPrompt = (p: SavedPrompt, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEcomPromptId(p.id);
    setNewEcomPromptName(p.name);
    setEcomPromptText(p.prompt);
    setIsAddingEcomPrompt(true);
  };

  useEffect(() => {
    // Older builds cached shared prompt plaintext in the browser. Remove that
    // cache permanently; shared prompt bodies now stay encrypted in Firestore.
    localStorage.removeItem('ecomPrompts');
    localStorage.removeItem('banana_gen_prompts');
  }, []);

  const [ecomBoxes, setEcomBoxes] = useState<{id: string, cropUrl: string}[]>([]);
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [enhanceAspectRatio, setEnhanceAspectRatio] = useState<string>('9:16');
  const [enhanceModel, setEnhanceModel] = useState<'banana-pro' | 'banana-2'>('banana-2');
  const [isDetectingBoxes, setIsDetectingBoxes] = useState(false);
  const [ecomProductImage, setEcomProductImage] = useState<string | null>(null);
  const [ecomProductImages, setEcomProductImages] = useState<string[]>([]);
  // Text-to-image mode (Gen new only) — skip product image upload, just use prompt
  const [ecomT2IMode, setEcomT2IMode] = useState<boolean>(false);
  const [ecomModel, setEcomModel] = useState<ModelType>('gpt2');
  const [ecomAspectRatio, setEcomAspectRatio] = useState<string>('9:16');
  const [ecomImageSize, setEcomImageSize] = useState<string>('1k');
  const [ecomVideoDuration, setEcomVideoDuration] = useState<number>(4);
  const [ecomVideoGenerateAudio, setEcomVideoGenerateAudio] = useState<boolean>(true);
  const [ecomSubTab, setEcomSubTab] = useState<EcomSubTab>('gen-new');

  // Auto-correct ecomImageSize khi model/aspect-ratio thay đổi khiến size hiện tại không khả dụng
  useEffect(() => {
    const supportedRatios = MODEL_ASPECT_RATIOS[ecomModel];
    if (!supportedRatios.includes(ecomAspectRatio)) {
      setEcomAspectRatio(isVideoModelKey(ecomModel)
        ? (supportedRatios.includes('16:9') ? '16:9' : supportedRatios[0])
        : (supportedRatios.includes('auto') ? 'auto' : '1:1'));
      return;
    }
    const availableSizes: string[] = ecomModel === 'google-omni'
      ? ['720p', '1080p', '4k']
      : ecomModel === 'seedance-2-5'
        ? ['480p', '720p']
        : ecomModel === 'gpt2'
      ? (ecomAspectRatio === 'auto' ? ['1k']
        : ecomAspectRatio === '5:4' || ecomAspectRatio === '4:5' ? ['1k']
        : ecomAspectRatio === '1:1' ? ['1k', '2k']
        : ['1k', '2k', '4k'])
      : ['1k', '2k', '4k'];
    if (!availableSizes.includes(ecomImageSize)) {
      setEcomImageSize(isVideoModelKey(ecomModel) ? '720p' : availableSizes[availableSizes.length - 1]);
    }
  }, [ecomModel, ecomAspectRatio]);

  const [ecomImageCount, setEcomImageCount] = useState<number>(3);
  useEffect(() => {
    if (isVideoModelKey(ecomModel)) {
      setEcomImageCount(1);
      setEcomVideoDuration((current) => ecomModel === 'google-omni'
        ? ([4, 6, 8, 10].includes(current) ? current : 4)
        : Math.max(4, Math.min(30, current || 8)));
    }
  }, [ecomModel]);

  useEffect(() => {
    if (ecomSubTab === 'gen-video' && !isVideoModelKey(ecomModel)) {
      setEcomModel('google-omni');
      return;
    }
    if (ecomSubTab !== 'gen-video' && isVideoModelKey(ecomModel)) setEcomModel('gpt2');
  }, [ecomSubTab, ecomModel]);
  const [isEcomGenerating, setIsEcomGenerating] = useState(false);
  const [ecomResults, setEcomResults] = useState<string[]>([]);
  // Concurrent gen-new batches — user can fire many in parallel without waiting
  const [ecomBatches, setEcomBatches] = useState<EcomBatch[]>([]);
  const [ecomHistoryItems, setEcomHistoryItems] = useState<EcomHistoryItem[]>([]);
  const [pendingEcomHistoryDelete, setPendingEcomHistoryDelete] = useState<{
    key: string;
    items: EcomHistoryItem[];
  } | null>(null);
  const [isDeletingEcomHistory, setIsDeletingEcomHistory] = useState(false);
  const [copiedPromptKey, setCopiedPromptKey] = useState<string | null>(null);
  const [pendingEcomRegenerate, setPendingEcomRegenerate] = useState<EcomGenerationSettings | null>(null);
  const [selectedEcomGrid, setSelectedEcomGrid] = useState<string | null>(null);
  const [isEcomEnhancing, setIsEcomEnhancing] = useState(false);
  const [isTranslatingImages, setIsTranslatingImages] = useState(false);
  const [ecomFinalImages, setEcomFinalImages] = useState<{ id: string, url: string, loading: boolean }[]>([]);
  const [ecomLastFinalImages, setEcomLastFinalImages] = useState<{ id: string, url: string, loading: boolean }[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [ecomTemplateImage, setEcomTemplateImage] = useState<string | null>(null);

  const replaceEcomProductImages = useCallback((sources: string[]) => {
    const next = sources.filter(Boolean).slice(0, 5);
    setEcomProductImages(next);
    setEcomProductImage(next[0] || null);
    setEcomResults([]);
  }, []);

  const appendEcomProductImages = useCallback((sources: string[]) => {
    setEcomProductImages((current) => {
      const next = [...current, ...sources.filter(Boolean)]
        .filter((source, index, all) => all.indexOf(source) === index)
        .slice(0, 5);
      setEcomProductImage(next[0] || null);
      setEcomResults([]);
      return next;
    });
  }, []);

  const [clonePromptType, setClonePromptType] = useState<'amazon' | 'taobao'>('amazon');
  const [cloneManualMode, setCloneManualMode] = useState(false);

  const DEFAULT_CLONE_PROMPTS = {
    amazon: "请复刻图1的设计,为图二生成亚马逊视觉电商A+,越南语",
    taobao: "请复刻图1的设计,为图二生成淘寶视觉电商A+,英文",
  };
  const [clonePrompts, setClonePrompts] = useState<{ amazon: string; taobao: string }>(() => {
    try {
      const saved = localStorage.getItem('clonePrompts');
      if (saved) return { ...DEFAULT_CLONE_PROMPTS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_CLONE_PROMPTS;
  });
  // Track whether the current state was synced (matches server) vs local draft
  const [clonePromptsSynced, setClonePromptsSynced] = useState<{ amazon: boolean; taobao: boolean }>({ amazon: false, taobao: false });

  useEffect(() => {
    localStorage.setItem('clonePrompts', JSON.stringify(clonePrompts));
  }, [clonePrompts]);

  // Subscribe to shared clone-templates from Firestore (everyone reads this)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'clone-templates'), (snap) => {
      const updates: Partial<{ amazon: string; taobao: string }> = {};
      const syncedFlags: Partial<{ amazon: boolean; taobao: boolean }> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if ((d.id === 'amazon' || d.id === 'taobao') && typeof data.prompt === 'string') {
          updates[d.id as 'amazon' | 'taobao'] = data.prompt;
          syncedFlags[d.id as 'amazon' | 'taobao'] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        setClonePrompts(prev => ({ ...prev, ...updates }));
        setClonePromptsSynced(prev => ({ ...prev, ...syncedFlags }));
      }
    }, (err) => {
      console.warn('clone-templates subscribe failed:', err.message);
    });
    return () => unsub();
  }, []);

  const syncClonePrompt = async () => {
    if (!isAdmin) {
      alert("Chỉ Admin mới có quyền đồng bộ Prompt.");
      return;
    }
    try {
      await setDoc(doc(db, 'clone-templates', clonePromptType), {
        prompt: clonePrompts[clonePromptType],
        updatedAt: Timestamp.now(),
      });
      setClonePromptsSynced(prev => ({ ...prev, [clonePromptType]: true }));
      alert(`Đã đồng bộ prompt ${clonePromptType.toUpperCase()} cho mọi người.`);
    } catch (error: any) {
      console.error("Sync clone prompt error:", error);
      alert("Có lỗi xảy ra khi đồng bộ: " + error.message);
    }
  };
  
  // THAY State
  const [ecomThayModelImage, setEcomThayModelImage] = useState<string | null>(null);
  const [ecomThayProductImage, setEcomThayProductImage] = useState<string | null>(null);
  const [ecomThayResults, setEcomThayResults] = useState<string[]>([]);
  const [ecomThayActiveIdx, setEcomThayActiveIdx] = useState(0);
  const [isEcomThayGenerating, setIsEcomThayGenerating] = useState(false);
  const [ecomThayModel, setEcomThayModel] = useState<ModelType>('banana-pro');
  const [ecomThayAspectRatio, setEcomThayAspectRatio] = useState<string>('3:4');
  const [ecomThayQuality, setEcomThayQuality] = useState<'1k' | '2k' | '4k'>('1k');
  const [ecomThayCount, setEcomThayCount] = useState<number>(1);
  const [ecomThayPrompt, setEcomThayPrompt] = useState<string>("Thay thế toàn bộ chăn ga gối trên giường bằng họa tiết và chất liệu từ ảnh sản phẩm. Giữ nguyên ánh sáng, nếp gấp và góc nhìn của giường. Output ONLY the resulting image.");
  const ecomThayModelInputRef = useRef<HTMLInputElement>(null);
  const ecomThayProductInputRef = useRef<HTMLInputElement>(null);
  const [thayDragOver, setThayDragOver] = useState<'model' | 'product' | null>(null);
  const [thayPasteTarget, setThayPasteTarget] = useState<'model' | 'product'>('model');

  // Compose (Ghép ảnh) state
  const [composeImages, setComposeImages] = useState<(string | null)[]>([null, null, null, null, null]);
  const [composeModel, setComposeModel] = useState<'gpt2' | 'banana-pro'>('banana-pro');
  const [composeQuality, setComposeQuality] = useState<string>('1k');
  const [composeAspectRatio, setComposeAspectRatio] = useState<string>('1:1');
  const [composeCount, setComposeCount] = useState<number>(1);
  const [composePrompt, setComposePrompt] = useState<string>('Ghép tất cả nhân vật trong các ảnh vào cùng một khung hình, đứng cạnh nhau tự nhiên. Giữ nguyên khuôn mặt, trang phục và đặc điểm của từng người. Ánh sáng và bối cảnh hài hòa, chân thực.');
  const [composeResults, setComposeResults] = useState<string[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [composeDragOver, setComposeDragOver] = useState<number | null>(null);
  const composeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // OFA tab state — detail page generator for product listings
  const [ofaProductName, setOfaProductName] = useState<string>('');
  const [ofaDescription, setOfaDescription] = useState<string>('');
  const [ofaImages, setOfaImages] = useState<(string | null)[]>([null, null, null]);
  const [ofaSelectedCategoryIds, setOfaSelectedCategoryIds] = useState<number[]>([1]);
  const [ofaAspectRatio, setOfaAspectRatio] = useState<string>('3:4');
  const [ofaQuality, setOfaQuality] = useState<string>('2k');
  const [ofaModel, setOfaModel] = useState<'gpt2' | 'banana-pro'>('banana-pro');
  const [ofaBatches, setOfaBatches] = useState<OfaBatch[]>([]);
  const [ofaDragOver, setOfaDragOver] = useState<number | null>(null);
  const ofaInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const ofaCancelMapRef = useRef<Map<string, { current: boolean }>>(new Map());
  const ofaAbortMapRef = useRef<Map<string, AbortController>>(new Map());
  const [isEditingSavedRooms, setIsEditingSavedRooms] = useState(false);
  const [draftDeletedRoomIds, setDraftDeletedRoomIds] = useState<Set<string>>(new Set());
  const [isEditingSavedModels, setIsEditingSavedModels] = useState(false);
  const [draftDeletedModelIds, setDraftDeletedModelIds] = useState<Set<string>>(new Set());

  // Generic upload drop-zone state — used by all standalone upload boxes
  const [pasteTargetId, setPasteTargetId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Pattern Replace State
  const [patternSourceImage, setPatternSourceImage] = useState<string | null>(null);
  const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
  const [isGeneratingPattern, setIsGeneratingPattern] = useState(false);
  const [patternMockupImage, setPatternMockupImage] = useState<string | null>(null);
  
  // Pattern Crop State
  const [isPatternCropModalOpen, setIsPatternCropModalOpen] = useState(false);
  const [patternCrop, setPatternCrop] = useState({ x: 0, y: 0 });
  const [patternZoom, setPatternZoom] = useState(1);
  const [patternRotation, setPatternRotation] = useState(0);
  const [patternCroppedAreaPixels, setPatternCroppedAreaPixels] = useState(null);
  const [isStitchingImages, setIsStitchingImages] = useState(false);
  
  const ecomFileInputRef = useRef<HTMLInputElement>(null);
  const ecomTemplateFileInputRef = useRef<HTMLInputElement>(null);
  const patternSourceFileInputRef = useRef<HTMLInputElement>(null);
  const patternMockupFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ecomFinalImages.length > 0 && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [ecomFinalImages.length]);

  // Analyze State
  const [analyzeImage, setAnalyzeImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedPrompt, setAnalyzedPrompt] = useState<string>('');
  const [isSavingAnalyzed, setIsSavingAnalyzed] = useState(false);
  const [savePromptName, setSavePromptName] = useState('');
  const analyzeFileInputRef = useRef<HTMLInputElement>(null);
  const [analyzeMode, setAnalyzeMode] = useState<'fashion' | 'bedding'>('fashion');
  const [analyzeDragOver, setAnalyzeDragOver] = useState(false);
  const [analyzedCopied, setAnalyzedCopied] = useState(false);

  // Try-On State
  const [tryOnModelImage, setTryOnModelImage] = useState<string | null>(null);
  const [tryOnProductImage, setTryOnProductImage] = useState<string | null>(null);
  const [tryOnProductCategory, setTryOnProductCategory] = useState<'top' | 'bottom' | 'shoes' | 'all'>('all');
  const [isTryOnProcessing, setIsTryOnProcessing] = useState(false);
  const [tryOnStep, setTryOnStep] = useState<'idle' | 'preparing' | 'processing'>('idle');
  const [isGeneratingWhiteBg, setIsGeneratingWhiteBg] = useState(false);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [tryOnPrompt, setTryOnPrompt] = useState<string>('');
  const [tryOnManualMode, setTryOnManualMode] = useState<boolean>(false);
  const [selectedTryOnPromptId, setSelectedTryOnPromptId] = useState<string | null>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);

  // Prompt Management - Gen
  const [savedGenPrompts, setSavedGenPrompts] = useState<SavedPrompt[]>(DEFAULT_GEN_PROMPTS);

  // Prompt Management - Try-On
  const [savedTryOnPrompts, setSavedTryOnPrompts] = useState<SavedPrompt[]>(DEFAULT_TRYON_PROMPTS);
  const selectedTryOnSavedPrompt = savedTryOnPrompts.find(prompt => prompt.id === selectedTryOnPromptId);
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [isSavingModel, setIsSavingModel] = useState(false);
  const modelListFileInputRef = useRef<HTMLInputElement>(null);

  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>([]);
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const roomListFileInputRef = useRef<HTMLInputElement>(null);

  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const selectedGenSavedPrompt = savedGenPrompts.find(prompt => prompt.id === selectedPromptId);
  const hasClothingPrompt = Boolean(aiPrompt.trim() || selectedGenSavedPrompt?.isSecret);
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptText, setNewPromptText] = useState('');

  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleImageDownload = async (url: string, filename: string) => {
    try {
      await downloadFile(url, filename);
    } catch (error: any) {
      console.error('Image download failed:', error);
      setGlobalError(error?.message || 'Không tải được ảnh.');
      window.setTimeout(() => setGlobalError(null), 3000);
    }
  };
  const [isDragging, setIsDragging] = useState(false);
  const [hasPersonalKey, setHasPersonalKey] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const currentImage = images[selectedIndex];

  const processFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;

    if (appMode === 'ecom') {
      void Promise.all(files.slice(0, 5).map((file) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }))).then(appendEcomProductImages).catch(() => setGlobalError('Không đọc được ảnh đã chọn.'));
      return;
    }

    if (activeTab === 'analyze') {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (ev) => setAnalyzeImage(ev.target?.result as string);
      reader.readAsDataURL(file);
      return;
    }

    if (activeTab === 'tryon') {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (!tryOnModelImage) setTryOnModelImage(result);
        else if (!tryOnProductImage) setTryOnProductImage(result);
        else setTryOnModelImage(result);
      };
      reader.readAsDataURL(file);
      return;
    }

    if (isReplacing) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setImages(prev => prev.map((img, idx) => 
          idx === selectedIndex ? { 
            ...img, 
            source: result, 
            processed: result, 
            isProcessing: false, 
            error: null 
          } : img
        ));
        setIsReplacing(false);
      };
      reader.readAsDataURL(file);
      return;
    }

    // For batch upload
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const newImage: EditableImage = {
          id: Math.random().toString(36).substr(2, 9),
          source: result,
          processed: result,
          isProcessing: false,
          error: null,
          aspectRatio: '3:4'
        };

        setImages(prev => {
          if (prev.length >= 5) return prev;
          const updated = [...prev, newImage];
          if (prev.length === 0) setSelectedIndex(0);
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  }, [appMode, activeTab, isReplacing, selectedIndex, tryOnModelImage, tryOnProductImage, appendEcomProductImages]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      
      if (files.length > 0) {
        processFiles(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFiles]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasPersonalKey(hasKey);
      }
    };
    checkKey();
    // Check every 5 seconds in case it changes
    const interval = setInterval(checkKey, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const [isAdmin, setIsAdmin] = useState(false);
  const [userPermissions, setUserPermissions] = useState<any>(null);

  const [kieCredits, setKieCredits] = useState<number | null>(null);
  const [kieCreditsLoading, setKieCreditsLoading] = useState(false);
  const fetchKieCredits = async () => {
    setKieCreditsLoading(true);
    try {
      const r = await apiFetch('/api/kie-credits');
      const data = await r.json();
      setKieCredits(typeof data.credits === 'number' ? data.credits : null);
    } catch (e) {
      console.warn('fetch kie credits failed', e);
    } finally {
      setKieCreditsLoading(false);
    }
  };
  useEffect(() => {
    if (isAdmin) fetchKieCredits();
  }, [isAdmin]);

  useEffect(() => {
    let unsubUserDoc: any = null;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }
      setUser(u);
      if (u) {
        const isPrimaryAdmin = u.email === 'trungg9870@gmail.com';
        setIsAuthReady(false);
        setIsAdmin(isPrimaryAdmin);
        setUserPermissions(null);
        // Subscribe to user document
        unsubUserDoc = onSnapshot(doc(db, 'users', u.uid), { includeMetadataChanges: true }, (docSnap) => {
          // Firestore may emit a stale cached profile first. Never lock or
          // unlock an employee until the server has confirmed current access.
          if (!isPrimaryAdmin && docSnap.metadata.fromCache) return;
          if (docSnap.exists()) {
            const data = docSnap.data();
            const profileIsAdmin = isPrimaryAdmin || data.role === 'admin';
            if (!profileIsAdmin && !hasAnyFeaturePermission(data)) {
              setUserPermissions(data);
              setIsAuthReady(false);
              setLoginError('Tài khoản đã bị khóa vì không còn quyền sử dụng tính năng nào. Vui lòng liên hệ quản trị viên.');
              void signOut(auth);
              return;
            }
            setUserPermissions(data);
            setIsAdmin(profileIsAdmin);
            setIsAuthReady(true);
          } else if (isPrimaryAdmin) {
            setIsAdmin(true);
            setIsAuthReady(true);
          } else {
            setUserPermissions(null);
            setIsAuthReady(false);
            setLoginError('Tài khoản chưa được quản trị viên cấp quyền truy cập.');
            void signOut(auth);
          }
        }, (error) => {
          console.warn('User permission sync error:', error);
          setUserPermissions(null);
          setIsAuthReady(false);
          setLoginError('Không thể xác minh quyền truy cập. Vui lòng đăng nhập lại.');
          void signOut(auth);
        });
      } else {
        setIsAdmin(false);
        setUserPermissions(null);
        setIsAuthReady(true);
      }
    });
    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  // Keep the current user's recent Gen New history visible on the main canvas.
  // The same live listener also performs the 7-day lazy cleanup after login.
  useEffect(() => {
    if (!isAuthReady || !user) {
      setEcomHistoryItems([]);
      return;
    }

    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let cleanupStarted = false;
    const historyQuery = query(collection(db, 'history'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
      const all = snapshot.docs.map((historyDoc) => {
        const item = {
          id: historyDoc.id,
          ...(historyDoc.data() as Omit<EcomHistoryItem, 'id'>),
        };
        return item.promptSource === 'saved' && !isAdmin
          ? { ...item, prompt: '' }
          : item;
      });
      const toMillis = (value: any) => {
        if (typeof value?.toMillis === 'function') return value.toMillis();
        if (typeof value?.seconds === 'number') return value.seconds * 1000;
        return 0;
      };

      setEcomHistoryItems(all
        .filter((item) => ['ecom-gen-new', 'ecom-gen-video'].includes(item.feature) && toMillis(item.ts) >= cutoffMs)
        .sort((a, b) => toMillis(b.ts) - toMillis(a.ts))
        .slice(0, 12));

      if (!cleanupStarted) {
        cleanupStarted = true;
        const stale = all.filter((item) => toMillis(item.ts) < cutoffMs);
        void Promise.allSettled(stale.map((item) => deleteDoc(doc(db, 'history', item.id))));
      }
    }, (error) => {
      console.warn('inline history load failed', error);
      setEcomHistoryItems([]);
    });

    return unsubscribe;
  }, [isAuthReady, user?.uid, isAdmin]);

  // Auto-switch appMode khi user không có quyền với mode hiện tại
  useEffect(() => {
    if (!user || isAdmin || !userPermissions) return;
    const canClothing = !!userPermissions.canUseClothing;
    const canEcom = !!userPermissions.canUseEcom;
    const canOfa = !!userPermissions.canUseOfa;
    const canPicset = !!userPermissions.canUsePicset;
    const canRunninghub = !!(userPermissions.canUseRunninghub ?? userPermissions.canUsePicset);
    const currentNotAllowed =
      appMode === 'admin' ||
      (appMode === 'clothing' && !canClothing) ||
      (appMode === 'ecom' && !canEcom) ||
      (appMode === 'ofa' && !canOfa) ||
      (appMode === 'picset' && !canPicset) ||
      (appMode === 'runninghub' && !canRunninghub);
    if (!currentNotAllowed) return;
    if (canEcom) setAppMode('ecom');
    else if (canOfa) setAppMode('ofa');
    else if (canPicset) setAppMode('picset');
    else if (canRunninghub) setAppMode('runninghub');
    else if (canClothing) setAppMode('clothing');
  }, [user, isAdmin, userPermissions, appMode]);

  // Listen for child-component gen-done events (Picset etc dispatch via window CustomEvent)
  // and forward to the notify() handler. Also triggers the one-time ask modal.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ source: string; title: string; body: string }>).detail;
      if (!detail) return;
      notify.notify(detail.title, detail.body);
      if (!notify.asked && !notify.enabled) {
        setShowNotifyAsk(true);
      }
    };
    window.addEventListener('otama:gen-done', handler);
    return () => window.removeEventListener('otama:gen-done', handler);
  }, [notify]);

  // Inline helper used by all in-App.tsx completion sites (Ecom batches, OFA, Clothing).
  // Trips the one-time ask modal the first time something finishes.
  const onGenComplete = (title: string, body: string) => {
    notify.notify(title, body);
    if (!notify.asked && !notify.enabled) setShowNotifyAsk(true);
  };

  // Sync Prompts from Firestore
  useEffect(() => {
    if (!isAuthReady) return;

    if (!user) {
      setSavedGenPrompts(DEFAULT_GEN_PROMPTS);
      setSavedTryOnPrompts(DEFAULT_TRYON_PROMPTS);
      setEcomSavedPrompts(DEFAULT_ECOM_PROMPTS);
      setEcomThaySavedPrompts([]);
      return;
    }

    const userPromptsQ = query(collection(db, 'prompts'), where('uid', '==', user.uid));
    const defaultPromptsQ = query(collection(db, 'prompts'), where('isDefault', '==', true));

    let userDocs: any[] = [];
    let defaultDocs: any[] = [];

    const updatePrompts = () => {
      const allPrompts = [...userDocs, ...defaultDocs];
      // Deduplicate by ID favoring userDocs (if a user somehow overrides a default ID)
      const uniqueMap = new Map();
      allPrompts.forEach(p => uniqueMap.set(p.id, p));
      const merged = Array.from(uniqueMap.values());
      // Sort by createdAt descending
      merged.sort((a, b) => {
        const tA = Math.max(a.createdAt?.toMillis?.() || 0, a.localFallbackTime || 0);
        const tB = Math.max(b.createdAt?.toMillis?.() || 0, b.localFallbackTime || 0);
        return tB - tA;
      });

      const gen = merged.filter(p => p.type === 'generate');
      const tryon = merged.filter(p => p.type === 'tryon');
      const ecom = merged.filter(p => p.type === 'ecom');
      const ecomThay = merged.filter(p => p.type === 'ecom-thay');

      setSavedGenPrompts([...gen, ...DEFAULT_GEN_PROMPTS.filter(d => !merged.some(m => m.id === d.id))]);
      setSavedTryOnPrompts([...tryon, ...DEFAULT_TRYON_PROMPTS.filter(d => !merged.some(m => m.id === d.id))]);
      setEcomSavedPrompts([...ecom, ...DEFAULT_ECOM_PROMPTS.filter(d => !merged.some(m => m.id === d.id))]);
      setEcomThaySavedPrompts(ecomThay);

      if (gen.length > 0 && !selectedPromptId) {
        setSelectedPromptId(gen[0].id);
        setAiPrompt(gen[0].prompt);
      }
    };

    const unsubUser = onSnapshot(userPromptsQ, (snap) => {
      userDocs = snap.docs.map(doc => doc.data());
      updatePrompts();
    }, e => console.warn(e));

    const unsubDefault = onSnapshot(defaultPromptsQ, async (snap) => {
      const rawDefaults = snap.docs.map(snapshot => snapshot.data());
      defaultDocs = await Promise.all(rawDefaults.map(async (prompt) => {
        const encrypted = isEncryptedSharedPrompt(prompt.prompt);
        if (!encrypted) {
          // Firestore rules block plaintext shared prompts for employees. Admin
          // still sees the record so it can be repaired from the prompt manager.
          return { ...prompt, isSecret: true, prompt: isAdmin ? prompt.prompt : '' };
        }
        if (!isAdmin) return { ...prompt, isSecret: true, prompt: '' };
        try {
          return { ...prompt, isSecret: true, prompt: await decryptSharedPromptForAdmin(prompt.prompt) };
        } catch (decryptError) {
          console.warn('shared prompt decrypt failed', prompt.id, decryptError);
          return { ...prompt, isSecret: true, prompt: '' };
        }
      }));
      updatePrompts();
    }, e => console.warn(e));

    return () => { unsubUser(); unsubDefault(); };
  }, [isAuthReady, user, isAdmin]);

  // Sync Saved Models — merge personal (uid === me) + shared (isShared === true)
  useEffect(() => {
    if (!isAuthReady || !user) {
      setSavedModels([]);
      return;
    }

    let personal: SavedModel[] = [];
    let shared: SavedModel[] = [];
    const merge = () => {
      const map = new Map<string, SavedModel>();
      [...personal, ...shared].forEach(m => map.set(m.id, m));
      const list = Array.from(map.values()).sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setSavedModels(list);
    };

    const personalQ = query(collection(db, 'models'), where('uid', '==', user.uid));
    const sharedQ = query(collection(db, 'models'), where('isShared', '==', true));

    const unsubPersonal = onSnapshot(personalQ, (snap) => {
      personal = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SavedModel[];
      merge();
    }, (err) => console.error("Models personal sync error:", err));

    const unsubShared = onSnapshot(sharedQ, (snap) => {
      shared = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SavedModel[];
      merge();
    }, (err) => console.error("Models shared sync error:", err));

    return () => { unsubPersonal(); unsubShared(); };
  }, [isAuthReady, user]);

  const handleSaveModel = async (imageUrl: string, asShared: boolean = false) => {
    if (!user) {
      setGlobalError("Vui lòng đăng nhập để lưu người mẫu.");
      return;
    }
    if (asShared && !isAdmin) {
      setGlobalError("Chỉ Admin mới được thêm vào kho chung.");
      return;
    }
    if (asShared) {
      const sharedCount = savedModels.filter(m => m.isShared).length;
      if (sharedCount >= 5) {
        setGlobalError("Kho chung đã đầy (5/5). Vui lòng xóa bớt người mẫu chung trước.");
        return;
      }
    } else {
      const personalModelCount = savedModels.filter(m => m.uid === user.uid && !m.isShared).length;
      if (personalModelCount >= 5) {
        setGlobalError("Kho cá nhân đã đầy (5/5). Vui lòng xóa bớt người mẫu cá nhân để thêm mới.");
        return;
      }
    }

    setIsSavingModel(true);
    setGlobalError(null);
    
    try {
      // Resize image to ensure it stays under Firestore 1MB limit
      const resizedImage = await new Promise<string>((resolve, reject) => {
        let imageUrlToLoad = imageUrl;
        if (imageUrlToLoad.startsWith("http")) {
          imageUrlToLoad = `/api/proxy-image?url=${encodeURIComponent(imageUrlToLoad)}`;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_HEIGHT = 800; 
            let width = img.width;
            let height = img.height;

            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); // Lower quality slightly to be safe
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error("Không thể tải ảnh để xử lý."));
        img.src = imageUrlToLoad;
      });

      const modelId = `model-${Date.now()}`;
      await setDoc(doc(db, 'models', modelId), {
        id: modelId,
        imageUrl: resizedImage,
        uid: user.uid,
        isShared: asShared,
        createdAt: Timestamp.now()
      });
      console.log("Model saved successfully:", modelId, asShared ? "(shared)" : "(personal)");
    } catch (error: any) {
      console.error("Save model error:", error);
      let msg = "Không thể lưu người mẫu.";
      if (error.message?.includes('permission')) msg = "Bạn không có quyền lưu ảnh (lỗi bảo mật).";
      if (error.message?.includes('quota')) msg = "Hệ thống hết dung lượng lưu trữ tạm thời.";
      setGlobalError(msg);
    } finally {
      setIsSavingModel(false);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!user) return;
    if (!window.confirm('Xóa người mẫu này?\n\nHành động này không thể hoàn tác.')) return;
    try {
      await deleteDoc(doc(db, 'models', modelId));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'models');
    }
  };

  const [pendingUploadAsSharedModel, setPendingUploadAsSharedModel] = useState(false);
  const handleModelListUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const asShared = pendingUploadAsSharedModel;
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) handleSaveModel(result, asShared);
      };
      reader.readAsDataURL(file);
    }
    setPendingUploadAsSharedModel(false);
    e.target.value = '';
  };

  // Sync Saved Rooms — merge personal (uid === me) + shared (isShared === true)
  useEffect(() => {
    if (!isAuthReady || !user) {
      setSavedRooms([]);
      return;
    }

    let personal: SavedRoom[] = [];
    let shared: SavedRoom[] = [];
    const merge = () => {
      const map = new Map<string, SavedRoom>();
      [...personal, ...shared].forEach(r => map.set(r.id, r));
      const list = Array.from(map.values()).sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setSavedRooms(list);
    };

    const personalQ = query(collection(db, 'rooms'), where('uid', '==', user.uid));
    const sharedQ = query(collection(db, 'rooms'), where('isShared', '==', true));

    const unsubPersonal = onSnapshot(personalQ, (snap) => {
      personal = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SavedRoom[];
      merge();
    }, (err) => console.error("Rooms personal sync error:", err));

    const unsubShared = onSnapshot(sharedQ, (snap) => {
      shared = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SavedRoom[];
      merge();
    }, (err) => console.error("Rooms shared sync error:", err));

    return () => { unsubPersonal(); unsubShared(); };
  }, [isAuthReady, user]);

  const handleSaveRoom = async (imageUrl: string, asShared: boolean = false) => {
    if (!user) {
      setGlobalError("Vui lòng đăng nhập để lưu phòng/giường mẫu.");
      return;
    }
    if (asShared && !isAdmin) {
      setGlobalError("Chỉ Admin mới được thêm vào kho chung.");
      return;
    }
    if (asShared) {
      const sharedCount = savedRooms.filter(r => r.isShared).length;
      if (sharedCount >= 5) {
        setGlobalError("Kho chung đã đầy (5/5). Vui lòng xóa bớt giường chung trước.");
        return;
      }
    } else {
      const personalRoomCount = savedRooms.filter(r => r.uid === user.uid && !r.isShared).length;
      if (personalRoomCount >= 5) {
        setGlobalError("Kho cá nhân đã đầy (5/5). Vui lòng xóa bớt giường cá nhân để thêm mới.");
        return;
      }
    }

    setIsSavingRoom(true);
    setGlobalError(null);

    try {
      const resizedImage = await new Promise<string>((resolve, reject) => {
        let imageUrlToLoad = imageUrl;
        if (imageUrlToLoad.startsWith("http")) {
          imageUrlToLoad = `/api/proxy-image?url=${encodeURIComponent(imageUrlToLoad)}`;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error("Không thể tải ảnh để xử lý."));
        img.src = imageUrlToLoad;
      });

      const roomId = `room-${Date.now()}`;
      await setDoc(doc(db, 'rooms', roomId), {
        id: roomId,
        imageUrl: resizedImage,
        uid: user.uid,
        isShared: asShared,
        createdAt: Timestamp.now()
      });
      console.log("Room saved successfully:", roomId, asShared ? "(shared)" : "(personal)");
    } catch (error: any) {
      console.error("Save room error:", error);
      let msg = "Không thể lưu phòng/giường mẫu.";
      if (error.message?.includes('permission')) msg = "Bạn không có quyền lưu ảnh (lỗi bảo mật).";
      if (error.message?.includes('quota')) msg = "Hệ thống hết dung lượng lưu trữ tạm thời.";
      setGlobalError(msg);
    } finally {
      setIsSavingRoom(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!user) return;
    if (!window.confirm('Xóa giường này?\n\nHành động này không thể hoàn tác.')) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomId));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rooms');
    }
  };

  const toggleSyncRoom = async (room: SavedRoom) => {
    if (!isAdmin) {
      alert("Chỉ Admin mới có quyền đồng bộ giường lên kho chung.");
      return;
    }
    const newIsShared = !room.isShared;
    if (newIsShared) {
      const sharedCount = savedRooms.filter(r => r.isShared).length;
      if (sharedCount >= 5) {
        alert("Kho chung đã đầy (5/5). Vui lòng bỏ đồng bộ 1 giường trước khi thêm.");
        return;
      }
    }
    try {
      await setDoc(doc(db, 'rooms', room.id), { isShared: newIsShared }, { merge: true });
    } catch (error: any) {
      console.error("Toggle sync room error:", error);
      alert("Có lỗi khi đồng bộ: " + error.message);
    }
  };

  const toggleSyncModel = async (model: SavedModel) => {
    if (!isAdmin) {
      alert("Chỉ Admin mới có quyền đồng bộ người mẫu lên kho chung.");
      return;
    }
    const newIsShared = !model.isShared;
    if (newIsShared) {
      const sharedCount = savedModels.filter(m => m.isShared).length;
      if (sharedCount >= 5) {
        alert("Kho chung đã đầy (5/5). Vui lòng bỏ đồng bộ 1 người mẫu trước khi thêm.");
        return;
      }
    }
    try {
      await setDoc(doc(db, 'models', model.id), { isShared: newIsShared }, { merge: true });
    } catch (error: any) {
      console.error("Toggle sync model error:", error);
      alert("Có lỗi khi đồng bộ: " + error.message);
    }
  };

  const [pendingUploadAsSharedRoom, setPendingUploadAsSharedRoom] = useState(false);
  const handleRoomListUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const asShared = pendingUploadAsSharedRoom;
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) handleSaveRoom(result, asShared);
      };
      reader.readAsDataURL(file);
    }
    setPendingUploadAsSharedRoom(false);
    e.target.value = '';
  };

  const loadFileToThay = (file: File, target: 'model' | 'product') => {
    if (!file.type.startsWith('image/')) {
      setGlobalError("File không phải ảnh hợp lệ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (!result) return;
      if (target === 'model') setEcomThayModelImage(result);
      else setEcomThayProductImage(result);
    };
    reader.readAsDataURL(file);
  };

  // Paste (Ctrl+V) listener for Phân Tích Ảnh tab
  useEffect(() => {
    if (activeTab !== 'analyze') return;

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = (ev) => setAnalyzeImage(ev.target?.result as string);
            reader.readAsDataURL(file);
          }
          return;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab]);

  // Refs map for generic upload boxes (used by paste setters)
  const uploadSettersRef = useRef<Record<string, (dataUrl: string) => void>>({});

  // Generic drop-handlers helper. Also registers the setter so global paste can route to it.
  const makeDropHandlers = (id: string, setter: (dataUrl: string) => void) => {
    uploadSettersRef.current[id] = setter;
    return {
      onDragEnter: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOverId(id); },
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); },
      onDragLeave: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverId((prev: string | null) => (prev === id ? null : prev));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverId(null);
        setPasteTargetId(id);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
          const r = new FileReader();
          r.onload = (ev) => setter(ev.target?.result as string);
          r.readAsDataURL(file);
        }
      },
    };
  };

  // Global paste listener — routes to whichever upload box was last clicked
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!pasteTargetId) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const setter = uploadSettersRef.current[pasteTargetId];
      if (!setter) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const r = new FileReader();
            r.onload = (ev) => setter(ev.target?.result as string);
            r.readAsDataURL(file);
          }
          return;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [pasteTargetId]);

  // Paste (Ctrl+V) listener for THAY tab — routes pasted image to last-clicked box
  useEffect(() => {
    if (ecomSubTab !== 'thay') return;

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            loadFileToThay(file, thayPasteTarget);
          }
          return;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [ecomSubTab, thayPasteTarget]);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const handleLogin = () => {
    setLoginError(null);
    setShowLoginModal(true);
  };

  const handleGoogleLogin = async () => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email;

      // Chỉ cho phép admin hardcoded hoặc email đã được admin tạo trong collection users
      if (email !== 'trungg9870@gmail.com') {
        const { getDocs } = await import('firebase/firestore');
        const usersQ = query(collection(db, 'users'), where('email', '==', email));
        const snap = await getDocs(usersQ);
        if (snap.empty) {
          await signOut(auth);
          setLoginError(`Email ${email} chưa được cấp quyền truy cập. Vui lòng liên hệ quản trị viên.`);
          return;
        }
      }

      setShowLoginModal(false);
    } catch (error: any) {
      console.error("Google login error:", error);
      setLoginError(`Lỗi đăng nhập Google: ${error.message}`);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError("Vui lòng nhập đủ email và mật khẩu.");
      return;
    }
    setLoginError(null);
    setLoginLoading(true);
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');
    } catch (error: any) {
      console.error("Email login error:", error);
      const code = error.code || '';
      let msg = error.message || 'Lỗi không xác định';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        msg = 'Email hoặc mật khẩu không đúng.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Email không hợp lệ.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Sai mật khẩu nhiều lần. Vui lòng đợi vài phút.';
      }
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setImages([]);
      setSelectedIndex(0);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasPersonalKey(hasKey);
        setGlobalError("Đã cập nhật API Key mới!");
        setTimeout(() => setGlobalError(null), 3000);
      } catch (error) {
        console.error("Lỗi khi mở trình chọn API Key:", error);
      }
    }
  };

  const selectPrompt = (id: string) => {
    const p = savedGenPrompts.find(prompt => prompt.id === id);
    if (p) {
      setSelectedPromptId(id);
      setAiPrompt(p.prompt);
    }
  };

  const startEditPrompt = (p: SavedPrompt, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPromptId(p.id);
    setNewPromptName(p.name);
    setNewPromptText(p.prompt);
    setIsAddingPrompt(true);
  };

  const handleAddPrompt = async () => {
    if (!newPromptName || !newPromptText) return;
    if (!user) {
      setGlobalError("Vui lòng đăng nhập để lưu prompt!");
      return;
    }
    
    const isTryOn = activeTab === 'tryon';
    const promptId = editingPromptId || Math.random().toString(36).substr(2, 9);
    
    const existingPrompt = [...savedGenPrompts, ...savedTryOnPrompts].find(p => p.id === promptId);
    const isDefaultPrompt = isAdmin && existingPrompt?.isDefault === true;

    try {
      const storedPrompt = isDefaultPrompt ? await encryptSharedPromptForAdmin(newPromptText) : newPromptText;
      const newPromptData = {
        id: promptId,
        name: newPromptName,
        prompt: storedPrompt,
        type: isTryOn ? 'tryon' : 'generate',
        uid: isDefaultPrompt ? 'admin' : user.uid,
        createdAt: Timestamp.now(),
        ...(isDefaultPrompt ? { isDefault: true } : {})
      };
      await setDoc(doc(db, 'prompts', promptId), newPromptData);
      
      if (!isTryOn) {
        setSelectedPromptId(promptId);
        setAiPrompt(newPromptText);
      } else {
        setTryOnPrompt(newPromptText);
        setSelectedTryOnPromptId(promptId);
        setTryOnManualMode(false);
      }
      
      setEditingPromptId(null);
      setNewPromptName('');
      setNewPromptText('');
      setIsAddingPrompt(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `prompts/${promptId}`);
    }
  };

  const deletePrompt = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    if (!isAdmin && (DEFAULT_GEN_PROMPTS.some(p => p.id === id) || DEFAULT_TRYON_PROMPTS.some(p => p.id === id))) {
      setGlobalError("Không thể xóa prompt mặc định.");
      return;
    }

    const target = [...savedGenPrompts, ...savedTryOnPrompts].find(p => p.id === id);
    const name = target?.name || 'prompt này';
    if (!window.confirm(`Xóa "${name}"?\n\nHành động này không thể hoàn tác.`)) return;

    try {
      await deleteDoc(doc(db, 'prompts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `prompts/${id}`);
    }
  };

  const handleAddEcomPrompt = async () => {
    if (!newEcomPromptName || !ecomPromptText) return;
    if (!user) {
      setGlobalError("Vui lòng đăng nhập để lưu prompt!");
      return;
    }
    
    const promptId = editingEcomPromptId || Math.random().toString(36).substr(2, 9);
    const isDefaultPrompt = isAdmin && ecomSavedPrompts.some(p => p.id === promptId && p.isDefault);
    try {
      const storedPrompt = isDefaultPrompt ? await encryptSharedPromptForAdmin(ecomPromptText) : ecomPromptText;
      await setDoc(doc(db, 'prompts', promptId), {
        id: promptId,
        name: newEcomPromptName,
        prompt: storedPrompt,
        type: 'ecom',
        uid: isDefaultPrompt ? 'admin' : user.uid,
        createdAt: Timestamp.now(),
        ...(isDefaultPrompt ? { isDefault: true } : {})
      });
      setIsAddingEcomPrompt(false);
      setEditingEcomPromptId(null);
      setNewEcomPromptName('');
      setSelectedEcomPromptId(promptId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `prompts/${promptId}`);
    }
  };

  const deleteEcomPrompt = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    if (!isAdmin && ecomSavedPrompts.some(p => p.id === id && p.isDefault)) {
      setGlobalError("Không thể xóa prompt mặc định.");
      return;
    }

    const target = ecomSavedPrompts.find(p => p.id === id);
    const name = target?.name || 'prompt này';
    if (!window.confirm(`Xóa "${name}"?\n\nHành động này không thể hoàn tác.`)) return;

    try {
      if (selectedEcomPromptId === id) {
        setSelectedEcomPromptId('manual');
        setEcomPromptText('');
      }
      await deleteDoc(doc(db, 'prompts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `prompts/${id}`);
    }
  };

  const toggleSyncEcomPrompt = async (p: SavedPrompt, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) {
      alert("Chỉ Admin mới có quyền đồng bộ Prompt.");
      return;
    }
    try {
      if (!p.prompt) throw new Error('Prompt chưa có nội dung để đồng bộ.');
      const encryptedPrompt = await encryptSharedPromptForAdmin(p.prompt);
      await setDoc(doc(db, 'prompts', p.id), {
        prompt: encryptedPrompt,
        isDefault: true,
        uid: 'admin',
      }, { merge: true });
      alert("Đã đồng bộ Prompt này lên danh sách chung cho mọi người.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `prompts/${p.id}`);
      alert("Có lỗi xảy ra khi đồng bộ.");
    }
  };

  const toggleSyncGenPrompt = async (p: SavedPrompt, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) {
      alert("Chỉ Admin mới có quyền đồng bộ Prompt.");
      return;
    }
    try {
      if (!p.prompt) throw new Error('Prompt chưa có nội dung để đồng bộ.');
      const encryptedPrompt = await encryptSharedPromptForAdmin(p.prompt);
      await setDoc(doc(db, 'prompts', p.id), {
        prompt: encryptedPrompt,
        isDefault: true,
        uid: 'admin',
      }, { merge: true });
      alert("Đã đồng bộ Prompt này lên danh sách chung cho mọi người.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `prompts/${p.id}`);
      alert("Có lỗi xảy ra khi đồng bộ.");
    }
  };

  const checkApiKey = async () => {
    const activeModel = appMode === 'ecom' ? ecomModel : selectedModel;
    const config = MODEL_CONFIG[activeModel];
    
    if (config.requiredKey === 'kie') {
      setHasApiKey(!!kieApiKey || process.env.NODE_ENV === 'development'); // Or we just rely on local state
    } else if (config.requiredKey === 'google') {
      if (googleApiKey) {
        setHasApiKey(true);
      } else if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        setHasApiKey(false);
      }
    }
  };

  useEffect(() => {
    checkApiKey();
  }, [selectedModel, ecomModel, appMode, kieApiKey, googleApiKey]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      if (selectedIndex >= filtered.length) {
        setSelectedIndex(Math.max(0, filtered.length - 1));
      }
      return filtered;
    });
  };

  const handleDownload = async (img?: string) => {
    const targetImg = img || currentImage?.processed;
    if (!targetImg) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Use Web Share API ONLY for iOS to allow "Save Image" to Photos app
    if (isIOS && navigator.share) {
      try {
        const response = await fetch(targetImg);
        const blob = await response.blob();
        const file = new File([blob], `banana-pro-edit-${Date.now()}.png`, { type: 'image/png' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Lưu ảnh',
          });
          return;
        }
      } catch (err) {
        console.error('Share failed:', err);
      }
    }

    // Traditional download for Android and Desktop
    const link = document.createElement('a');
    link.href = targetImg;
    link.download = `banana-pro-edit-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    images.forEach((img, idx) => {
      if (img.processed && img.processed !== img.source) {
        setTimeout(() => {
          const link = document.createElement('a');
          link.href = img.processed!;
          link.download = `banana-pro-batch-${idx}-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, idx * 200);
      }
    });
  };

  // Simulate traditional brightness adjustment
  const applyBrightness = useCallback((imgSrc: string, value: number) => {
    return new Promise<string>((resolve) => {
      let imageUrlToLoad = imgSrc;
      if (imageUrlToLoad.startsWith("http")) {
        imageUrlToLoad = `/api/proxy-image?url=${encodeURIComponent(imageUrlToLoad)}`;
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imgSrc);

        ctx.filter = `brightness(${1 + value / 100})`;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve(imgSrc); // Fallback on error
      img.src = imageUrlToLoad;
    });
  }, []);

  // Simulate central crop based on aspect ratio
  const applyCentralCrop = useCallback((imgSrc: string, ratioStr: string) => {
    return new Promise<string>((resolve) => {
      let imageUrlToLoad = imgSrc;
      if (imageUrlToLoad.startsWith("http")) {
        imageUrlToLoad = `/api/proxy-image?url=${encodeURIComponent(imageUrlToLoad)}`;
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const [w, h] = ratioStr.split(':').map(Number);
        const targetAspect = w / h;
        
        let cropWidth, cropHeight, startX, startY;

        if (img.width / img.height > targetAspect) {
          cropHeight = img.height;
          cropWidth = img.height * targetAspect;
          startX = (img.width - cropWidth) / 2;
          startY = 0;
        } else {
          cropWidth = img.width;
          cropHeight = img.width / targetAspect;
          startX = 0;
          startY = (img.height - cropHeight) / 2;
        }

        canvas.width = cropWidth;
        canvas.height = cropHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imgSrc);

        ctx.drawImage(img, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve(imgSrc); // Fallback on error
      img.src = imageUrlToLoad;
    });
  }, []);

  const handleAiEdit = async (targetIndex?: number) => {
    const selectedSavedPrompt = savedGenPrompts.find(prompt => prompt.id === selectedPromptId);
    const usesSecretPrompt = selectedSavedPrompt?.isSecret === true;
    if (images.length === 0 || (!aiPrompt.trim() && !usesSecretPrompt)) return;
    
    const config = MODEL_CONFIG[selectedModel];
    
    const isSingle = typeof targetIndex === 'number';
    if (!isSingle) setIsBatchProcessing(true);
    setGlobalError(null);

    const modelId = config.id;

    // Determine which images to process
    const indicesToProcess = isSingle ? [targetIndex!] : images.map((_, idx) => idx);

    logUsage('clothing-gen', modelId, indicesToProcess.length, '1k');

    for (const i of indicesToProcess) {
      const img = images[i];
      
      // Update individual processing state
      setImages(prev => prev.map((item, idx) => 
        idx === i ? { ...item, isProcessing: true, error: null } : item
      ));

      const maxRetries = 3;
      let retryCount = 0;

      const executeEdit = async (): Promise<void> => {
        try {
          // Send the untouched source. Brightness, crop, resizing, and JPEG
          // re-encoding before AI materially reduce reference fidelity.
          const referenceImages = await prepareKieReferences([img.source], kieApiKey);
          const mainBase64 = img.source.includes(',') ? img.source.split(',')[1] : img.source;
          const promptText = aiPrompt;
          
          let resultUrl = '';

          // Try calling Server-side API first (using owner's key)
          try {
            const response = await apiFetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                modelId,
                prompt: usesSecretPrompt ? '' : promptText,
                savedPromptId: usesSecretPrompt ? selectedSavedPrompt.id : undefined,
                referenceImages,
                aspectRatio: img.aspectRatio,
              })
            });

            if (response.ok) {
              const data = await response.json();
              if (data.isAsync && Array.isArray(data.taskIds)) {
                const urls = await pollKieTasks(data.taskIds);
                if (!urls[0]) throw new Error("Kie.ai không trả về ảnh.");
                resultUrl = urls[0];
              } else if (data.isUrl) {
                resultUrl = data.imagesBase64[0];
              } else {
                resultUrl = `data:image/png;base64,${data.imageBase64}`;
              }
            } else {
              const errorData = await response.json();
              
              // Handle 503 from server
              if (response.status === 503 && retryCount < maxRetries) {
                retryCount++;
                const delay = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return await executeEdit();
              }

              throw new Error(errorData.error || "Lỗi từ máy chủ Kie.ai.");
            }
          } catch (serverErr: any) {
            // Check for 503 in client-side call or network error
            const is503 = serverErr.message?.includes("503") || serverErr.message?.includes("high demand");
            if (is503 && retryCount < maxRetries) {
              retryCount++;
              const delay = Math.pow(2, retryCount) * 1000;
              await new Promise(resolve => setTimeout(resolve, delay));
              return await executeEdit();
            }
            throw serverErr;
          }

          if (resultUrl) {
            setImages(prev => prev.map((item, idx) =>
              idx === i ? { ...item, processed: resultUrl, isProcessing: false } : item
            ));
            pushHistory(resultUrl, { feature: 'clothing-gen', model: modelId, size: '1k' });
          } else {
            throw new Error("AI did not return an image.");
          }
        } catch (err: any) {
          console.error(`Error processing image ${i}:`, err);
          const errorMessage = err.message?.includes("Requested entity was not found") 
            ? "API Key session expired." 
            : (err.message || "Lỗi xử lý AI.");
          
          setImages(prev => prev.map((item, idx) => 
            idx === i ? { ...item, isProcessing: false, error: errorMessage } : item
          ));
          
          if (err.message?.includes("Requested entity was not found")) {
            setHasApiKey(false);
            setGlobalError("API Key session expired. Please re-select your key.");
          }
        }
      };

      await executeEdit();
      if (globalError && globalError.includes("expired")) break;
    }

    if (!isSingle) setIsBatchProcessing(false);
  };

  const handleAnalyzeImage = async () => {
    if (!analyzeImage) return;
    setIsAnalyzing(true);
    setGlobalError(null);
    logUsage('analyze', 'gemini-3-5-flash-kie', 1, '');

    try {
      const base64 = analyzeImage.split(',')[1];

      // Try server-side API first (via Kie.ai — migrated from Gemini direct)
      try {
        const response = await apiFetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mode: analyzeMode })
        });

        if (response.ok) {
          const data = await response.json();
          setAnalyzedPrompt(data.result);
          return;
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || "Lỗi server");
        }
      } catch (serverErr: any) {
        throw serverErr;
      }

    } catch (err: any) {
      console.error("Analysis error:", err);
      setGlobalError(err.message || "Lỗi phân tích ảnh.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveAnalyzedPrompt = () => {
    if (!analyzedPrompt) return;
    setIsSavingAnalyzed(true);
    setSavePromptName(`🔍 Phân tích ${new Date().toLocaleTimeString()}`);
  };

  const confirmSaveAnalyzedPrompt = () => {
    if (!analyzedPrompt || !savePromptName) return;
    const newPrompt: SavedPrompt = {
      id: `p-${Date.now()}`,
      name: savePromptName,
      prompt: analyzedPrompt
    };
    const updated = [newPrompt, ...savedGenPrompts];
    // setSavedGenPrompts(updated); // Handled by onSnapshot
    // localStorage.setItem('banana_gen_prompts', JSON.stringify(updated)); // No longer needed
    
    if (user) {
      const promptId = `p-${Date.now()}`;
      setDoc(doc(db, 'prompts', promptId), {
        ...newPrompt,
        id: promptId,
        type: 'generate',
        uid: user.uid,
        createdAt: Timestamp.now()
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, `prompts/${promptId}`));
    }
    
    setSelectedPromptId(newPrompt.id);
    setAiPrompt(newPrompt.prompt);
    setIsSavingAnalyzed(false);
    setSavePromptName('');
    setGlobalError("Đã lưu prompt vào danh sách!");
    setTimeout(() => setGlobalError(null), 3000);
    setActiveTab('generate');
  };

  const useAnalyzedPrompt = () => {
    if (!analyzedPrompt) return;
    if (analyzeMode === 'bedding') {
      setEcomSupplementaryPrompt(analyzedPrompt);
      setAppMode('ecom');
      setEcomSubTab('gen-new');
      setGlobalError("Đã áp dụng vào BỔ SUNG PROMPT của Ecom > Gen new.");
    } else {
      setAiPrompt(analyzedPrompt);
      setActiveTab('generate');
      setGlobalError("Đã áp dụng prompt! Chuyển sang tab Gen ảnh.");
    }
    setTimeout(() => setGlobalError(null), 3000);
  };

  const handleTryOnUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'model' | 'product') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (type === 'model') setTryOnModelImage(ev.target?.result as string);
        else setTryOnProductImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTryOnProcess = async () => {
    if (!tryOnModelImage || !tryOnProductImage) return;
    setIsTryOnProcessing(true);
    setTryOnStep('preparing');
    setGlobalError(null);

    // Kie-only try-on. Keep the original product untouched and send it first;
    // the model photo is the composition reference in slot 2.
    try {
      const referenceImages = await prepareKieReferences(
        [tryOnProductImage, tryOnModelImage],
        kieApiKey
      );
      const categoryText = tryOnProductCategory === 'top' ? 'top/shirt/jacket'
        : tryOnProductCategory === 'bottom' ? 'pants/skirt/bottom'
          : tryOnProductCategory === 'shoes' ? 'shoes/footwear/accessories'
            : 'clothing item(s)';
      const selectedSavedPrompt = selectedTryOnPromptId
        ? savedTryOnPrompts.find(savedPrompt => savedPrompt.id === selectedTryOnPromptId)
        : undefined;
      const usesSecretPrompt = selectedSavedPrompt?.isSecret === true;
      const visibleInstruction = !usesSecretPrompt && tryOnPrompt
        ? `Additional instructions: ${tryOnPrompt}`
        : "Ensure the fit is natural and follows the person's pose.";
      const prompt = `Virtual Try-On Task: Take ONLY the ${categoryText} from Product Reference Image 1 and place it onto the person in Composition Reference Image 2. CRITICAL: Do NOT include any human parts from the product image. ${visibleInstruction} Output ONLY the resulting image.`;
      setTryOnStep('processing');
      const response = await apiFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: MODEL_CONFIG[selectedModel].id,
          prompt,
          savedPromptId: usesSecretPrompt ? selectedSavedPrompt!.id : undefined,
          savedPromptMode: usesSecretPrompt ? 'append' : undefined,
          referenceImages,
          referenceMode: 'product-composition',
          aspectRatio: '3:4',
          imageSize: '1K',
          numberOfImages: 1,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Lỗi Kie.ai' }));
        throw new Error(errorData.error || 'Lỗi Kie.ai');
      }
      const data = await response.json();
      const resultUrls = data.isAsync && Array.isArray(data.taskIds)
        ? await pollKieTasks(data.taskIds)
        : (data.imagesBase64 || []);
      if (!resultUrls[0]) throw new Error('Kie.ai không trả về ảnh.');
      setTryOnResult(resultUrls[0]);
      onGenComplete('Quần áo: Thay đồ xong', 'Ảnh sẵn sàng');
    } catch (error: any) {
      setGlobalError(error.message || 'Lỗi xử lý thay đồ qua Kie.ai.');
      onGenComplete('Quần áo: Thay đồ FAIL', error.message || 'Lỗi Kie.ai');
    } finally {
      setIsTryOnProcessing(false);
      setTryOnStep('idle');
    }
    return;

    const maxRetries = 3;
    let retryCount = 0;

    const executeTryOn = async (): Promise<void> => {
      try {
        const modelBase64 = tryOnModelImage.split(',')[1];
        let productBase64 = tryOnProductImage.split(',')[1];
        let productMimeType = tryOnProductImage.split(';')[0].split(':')[1];
        
        const config = MODEL_CONFIG[selectedModel];
        const modelId = config.id;

        let apiKey = '';
        if (config.requiredKey === 'google') {
          apiKey = googleApiKey || (process.env as any).GEMINI_API_KEY || '';
        } else {
          apiKey = kieApiKey || '';
        }
        
        if (!apiKey) {
           if (config.requiredKey === 'kie') {
             throw new Error("Vui lòng nhập API Key tại Mục Cài đặt.");
           } else if (config.requiredKey === 'google') {
             const hasKey = await window.aistudio?.hasSelectedApiKey();
             if (!hasKey && window.aistudio) {
               await window.aistudio.openSelectKey();
             }
           }
        }

        const ai = apiKey ? new KieOnlyGuard({ apiKey }) : new KieOnlyGuard({});

        // Step 1: Generate White Background for Product (if not already done or just always for best results)
        // We do this to ensure the best try-on quality as requested by the user
        try {
          const categoryText = tryOnProductCategory === 'top' ? 'top/shirt/jacket' : 
                               tryOnProductCategory === 'bottom' ? 'pants/skirt/bottom' : 
                               tryOnProductCategory === 'shoes' ? 'shoes/footwear/accessories' :
                               'full outfit (both top and bottom)';
          
          logGeminiCall('tryon-whitebg-auto', 'gemini-2.5-flash-image');
          const whiteBgResponse = await ai.models.blockedDirectCall({
            model: 'gemini-2.5-flash-image',
            contents: {
              parts: [
                { inlineData: { data: productBase64, mimeType: productMimeType } },
                { text: `Isolate ONLY the ${categoryText} from this image. CRITICAL: Remove ALL human parts (legs, feet, socks, hands, arms, etc.), mannequins, and background completely. Place ONLY the ${categoryText} on a clean, professional, solid white studio background (ghost mannequin or flat lay style). Ensure the product's texture and details are preserved perfectly. Output ONLY the resulting image.` }
              ]
            }
          });

          for (const part of whiteBgResponse.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              productBase64 = part.inlineData.data;
              // Update the preview as well so the user sees what's being used
              setTryOnProductImage(`data:image/png;base64,${productBase64}`);
              break;
            }
          }
        } catch (bgErr) {
          console.warn("Background removal failed, proceeding with original image:", bgErr);
          // We continue with original productBase64 if this step fails
        }

        // Step 2: Main Try-On Task
        setTryOnStep('processing');
        const mainCategoryText = tryOnProductCategory === 'top' ? 'top/shirt/jacket' : 
                                 tryOnProductCategory === 'bottom' ? 'pants/skirt/bottom' : 
                                 tryOnProductCategory === 'shoes' ? 'shoes/footwear/accessories' :
                                 'clothing item(s)';
                                 
        const callTryOn = async (currentApiKey: string) => {
          const ai = new KieOnlyGuard({ apiKey: currentApiKey });
          return await ai.models.blockedDirectCall({
            model: modelId,
            contents: {
              parts: [
                { text: `Virtual Try-On Task: Take ONLY the ${mainCategoryText} from the product image and place it onto the person in the model image. CRITICAL: Do NOT include any human parts (legs, feet, socks, etc.) from the product image. ${tryOnPrompt ? `Additional instructions: ${tryOnPrompt}` : "Ensure the fit is natural and follows the person's pose."} Output ONLY the resulting image.` },
                { inlineData: { data: modelBase64, mimeType: 'image/jpeg' } },
                { inlineData: { data: productBase64, mimeType: 'image/jpeg' } }
              ]
            },
            config: {
              imageConfig: {
                aspectRatio: "3:4",
                imageSize: "1K"
              }
            }
          });
        };

        let response;
        try {
          response = await callTryOn(apiKey);
        } catch (err: any) {
          // If 400 or 403, try prompting for key if not already using a personal one
          const isAuthError = err.message?.includes("400") || err.message?.includes("403") || 
                             err.message?.toLowerCase().includes("permission") || 
                             err.message?.toLowerCase().includes("api key not valid");
                             
          if (isAuthError) {
            if (window.aistudio) {
              const hasKey = await window.aistudio.hasSelectedApiKey();
              if (!hasKey) {
                await window.aistudio.openSelectKey();
                const updatedHasKey = await window.aistudio.hasSelectedApiKey();
                setHasPersonalKey(updatedHasKey);
                const newApiKey = process.env.API_KEY || '';
                if (newApiKey) {
                  response = await callTryOn(newApiKey);
                } else {
                  throw new Error("Vui lòng chọn API Key cá nhân để thực hiện Thay Đồ.");
                }
              } else {
                throw err;
              }
            } else {
              throw new Error("API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại ở mục Cài Đặt.");
            }
          } else {
            throw err;
          }
        }

        let foundImage = false;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            setTryOnResult(`data:image/png;base64,${part.inlineData.data}`);
            foundImage = true;
            break;
          }
        }
        
        if (!foundImage) {
          if (response.text) {
            console.warn("AI returned text instead of image for try-on:", response.text);
            throw new Error("AI không trả về ảnh. Vui lòng thử lại với prompt khác.");
          } else {
            throw new Error("AI không trả về kết quả hợp lệ.");
          }
        }

      } catch (err: any) {
        const is503 = err.message?.includes("503") || err.message?.includes("high demand");
        if (is503 && retryCount < maxRetries) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return await executeTryOn();
        }
        throw err;
      }
    };

    try {
      await executeTryOn();
      onGenComplete('Quần áo: Thay đồ xong', 'Ảnh sẵn sàng');
    } catch (err: any) {
      console.error("Try-on error:", err);
      let errorMessage = "Lỗi xử lý thay đồ.";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error && parsed.error.message) {
          errorMessage = parsed.error.message;
        }
      } catch (e) {
        errorMessage = err.message || errorMessage;
      }
      setGlobalError(errorMessage);
      onGenComplete('Quần áo: Thay đồ FAIL', errorMessage);
    } finally {
      setIsTryOnProcessing(false);
      setTryOnStep('idle');
    }
  };

  const handleGenerateWhiteBg = async () => {
    if (!tryOnProductImage) return;
    setIsGeneratingWhiteBg(true);
    setGlobalError(null);

    try {
      const referenceImages = await prepareKieReferences([tryOnProductImage], kieApiKey);
      const categoryText = tryOnProductCategory === 'top' ? 'top/shirt/jacket'
        : tryOnProductCategory === 'bottom' ? 'pants/skirt/bottom'
          : tryOnProductCategory === 'shoes' ? 'shoes/footwear/accessories'
            : 'full outfit (both top and bottom)';
      const response = await apiFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'nano-banana-pro',
          prompt: `Isolate ONLY the ${categoryText} from this image. Remove all human parts, mannequins, and background. Place only the product on a clean solid white studio background. Preserve texture, color, logos, shape, and fine details exactly. Output ONLY the resulting image.`,
          referenceImages,
          aspectRatio: '1:1',
          imageSize: '2K',
          numberOfImages: 1,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Lỗi Kie.ai' }));
        throw new Error(errorData.error || 'Lỗi Kie.ai');
      }
      const data = await response.json();
      const resultUrls = data.isAsync && Array.isArray(data.taskIds)
        ? await pollKieTasks(data.taskIds)
        : (data.imagesBase64 || []);
      if (!resultUrls[0]) throw new Error('Kie.ai không trả về ảnh.');
      setTryOnProductImage(resultUrls[0]);
    } catch (error: any) {
      setGlobalError(error.message || 'Không thể tạo nền trắng qua Kie.ai.');
    } finally {
      setIsGeneratingWhiteBg(false);
    }
  };

  // Use a result image as the new product image input.
  // Optionally snapshot current split results into "previous results" history
  // so the user can still see them after switching input.
  const useEcomImageAsInput = async (url: string, options?: { snapshot?: boolean }) => {
    let dataUrl = url;
    if (url.startsWith('http')) {
      try {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        const r = await fetch(proxyUrl);
        if (!r.ok) throw new Error('fetch failed');
        const blob = await r.blob();
        dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        setGlobalError('Không tải được ảnh để chỉnh sửa tiếp.');
        setTimeout(() => setGlobalError(null), 3000);
        return;
      }
    }
    if (options?.snapshot && ecomFinalImages.length > 0) {
      setEcomLastFinalImages(ecomFinalImages);
    }
    replaceEcomProductImages([dataUrl]);
    setSelectedEcomGrid(null);
    setEcomBoxes([]);
    setSelectedBoxIds([]);
    setEcomFinalImages([]);
    setGlobalError('Đã dùng ảnh làm input mới. Viết prompt và bấm Gen tiếp.');
    setTimeout(() => setGlobalError(null), 3000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reuseEcomGeneration = (
    settings: EcomGenerationSettings,
    options?: { silent?: boolean; scroll?: boolean },
  ) => {
    const savedPromptStillExists = !!settings.promptId
      && ecomSavedPrompts.some((prompt) => prompt.id === settings.promptId);
    const savedPrompt = savedPromptStillExists
      ? ecomSavedPrompts.find((prompt) => prompt.id === settings.promptId)
      : undefined;

    setAppMode('ecom');
    setEcomSubTab(settings.mediaType === 'video' ? 'gen-video' : 'gen-new');
    setEcomT2IMode(!!settings.t2iMode);
    replaceEcomProductImages(settings.t2iMode
      ? []
      : (settings.inputImages?.length ? settings.inputImages : (settings.inputImage ? [settings.inputImage] : [])));
    setEcomPromptText(savedPrompt?.isSecret ? '' : (settings.prompt || ''));
    setEcomSupplementaryPrompt(settings.supplementaryPrompt || '');
    setSelectedEcomPromptId(savedPromptStillExists ? settings.promptId! : 'manual');
    if (settings.modelKey && settings.modelKey in MODEL_CONFIG) setEcomModel(settings.modelKey);
    if (settings.aspectRatio) setEcomAspectRatio(settings.aspectRatio);
    if (settings.imageSize) setEcomImageSize(settings.imageSize);
    if (typeof settings.imageCount === 'number') setEcomImageCount(settings.imageCount);
    if (typeof settings.duration === 'number') setEcomVideoDuration(settings.duration);
    if (typeof settings.generateAudio === 'boolean') setEcomVideoGenerateAudio(settings.generateAudio);
    if (!options?.silent) {
      setGlobalError(settings.t2iMode || settings.inputImage || settings.inputImages?.length
        ? 'Đã nạp lại ảnh, prompt và cài đặt của lần gen trước. Bạn có thể chỉnh sửa rồi gen tiếp.'
        : 'Đã nạp lại prompt và cài đặt. Ảnh đầu vào của lịch sử cũ không còn dữ liệu.');
      setTimeout(() => setGlobalError(null), 4000);
    }
    if (options?.scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const regenerateEcomGeneration = (settings: EcomGenerationSettings) => {
    reuseEcomGeneration(settings, { silent: true, scroll: false });
    setPendingEcomRegenerate(settings);
  };

  const copyEcomPrompt = async (prompt: string, key: string) => {
    if (!prompt.trim()) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPromptKey(key);
      window.setTimeout(() => {
        setCopiedPromptKey((current) => current === key ? null : current);
      }, 1600);
    } catch {
      setGlobalError('Không thể copy prompt. Vui lòng thử lại.');
      window.setTimeout(() => setGlobalError(null), 3000);
    }
  };

  const confirmDeleteEcomHistoryGroup = async () => {
    if (!pendingEcomHistoryDelete || isDeletingEcomHistory) return;
    const target = pendingEcomHistoryDelete;
    setIsDeletingEcomHistory(true);

    const results = await Promise.allSettled(
      target.items.map((item) => deleteDoc(doc(db, 'history', item.id))),
    );
    const deletedIds = new Set(
      target.items
        .filter((_, index) => results[index].status === 'fulfilled')
        .map((item) => item.id),
    );
    const failedItems = target.items.filter((_, index) => results[index].status === 'rejected');

    if (deletedIds.size > 0) {
      setEcomHistoryItems((current) => current.filter((item) => !deletedIds.has(item.id)));
    }
    if (failedItems.length === 0) {
      setPendingEcomHistoryDelete(null);
    } else {
      setPendingEcomHistoryDelete({ ...target, items: failedItems });
      setGlobalError(`Không xoá được ${failedItems.length} ảnh. Vui lòng thử lại.`);
      window.setTimeout(() => setGlobalError(null), 3500);
    }
    setIsDeletingEcomHistory(false);
  };

  // ───────── Usage tracking (Admin analytics) ─────────
  const logUsage = async (
    feature: string,
    modelId: string,
    count: number,
    size?: string,
    options?: { mediaType?: 'image' | 'video'; duration?: number; generateAudio?: boolean; chargedCredits?: number },
  ) => {
    if (!user) return;
    try {
      const isVideo = options?.mediaType === 'video';
      const duration = Math.round(options?.duration || 4);
      const generateAudio = options?.generateAudio === true;
      const calculatedCredits = isVideo
        ? creditsPerVideo(modelId, size, duration, generateAudio)
        : creditsPerImage(modelId, size) * (count || 1);
      const credits = Number.isFinite(options?.chargedCredits) && Number(options?.chargedCredits) > 0
        ? Number(options?.chargedCredits)
        : calculatedCredits;
      const cost = credits * KIE_CREDIT_USD;
      const usageData: Record<string, any> = {
        type: 'gen',
        feature,
        model: modelId,
        count: count || 1,
        size: size || '',
        credits,
        cost,
        uid: user.uid,
        email: user.email,
        ts: Timestamp.now(),
      };
      if (isVideo) {
        usageData.mediaType = 'video';
        usageData.duration = duration;
        usageData.generateAudio = generateAudio;
      }
      await setDoc(doc(collection(db, 'usage')), usageData);
    } catch (e) {
      console.warn('logUsage failed', e);
    }
  };

  // Log each direct Gemini API call (billed to GEMINI_API_KEY, not Kie).
  // Kept separate from logUsage so Admin can spot leaks — after the Kie migration
  // only Try-on preprocess should still hit here.
  const logGeminiCall = async (feature: string, modelId: string) => {
    if (!user) return;
    try {
      await setDoc(doc(collection(db, 'usage')), {
        type: 'gemini_direct',
        feature,
        model: modelId,
        count: 1,
        uid: user.uid,
        email: user.email,
        ts: Timestamp.now(),
      });
    } catch (e) {
      console.warn('logGeminiCall failed', e);
    }
  };

  // Lưu lịch sử vào Firestore. Kết quả Kie đã là URL remote nên không cần
  // Firebase Storage (project Spark hiện không hỗ trợ tạo Storage bucket mới).
  // Với kết quả dạng data URL, nén đủ nhỏ để nằm dưới giới hạn 1 MiB/document.
  const pushHistory = async (imageSrc: string, meta: {
    feature: string;
    model: string;
    size?: string;
    batchId?: string;
    prompt?: string;
    supplementaryPrompt?: string;
    promptId?: string;
    promptSource?: 'manual' | 'saved';
    inputImage?: string | null;
    modelKey?: ModelType;
    aspectRatio?: string;
    imageCount?: number;
    t2iMode?: boolean;
    mediaType?: 'image' | 'video';
    duration?: number;
    generateAudio?: boolean;
  }) => {
    if (!user || !imageSrc) return;
    try {
      let historyUrl = imageSrc;
      if (imageSrc.startsWith('data:')) {
        historyUrl = await compressImageDataUrl(imageSrc, 1200, 0.72);
        if (historyUrl.length > 900_000) {
          historyUrl = await compressImageDataUrl(imageSrc, 900, 0.65);
        }
        if (historyUrl.length > 900_000) {
          throw new Error('Ảnh lịch sử vượt giới hạn Firestore 1 MiB');
        }
      }

      let reusableInput = meta.inputImage || '';
      if (reusableInput.startsWith('data:')) {
        reusableInput = await compressImageDataUrl(reusableInput, 900, 0.62);
        if (reusableInput.length > 600_000) {
          reusableInput = await compressImageDataUrl(meta.inputImage!, 700, 0.55);
        }
        if (reusableInput.length > 600_000) reusableInput = '';
      }
      // Firestore documents are capped at 1 MiB. Prefer keeping the output;
      // omit an oversized input snapshot rather than losing the whole history item.
      if (historyUrl.length + reusableInput.length > 900_000) reusableInput = '';

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const historyData: Record<string, any> = {
        id,
        url: historyUrl,
        feature: meta.feature,
        model: meta.model,
        size: meta.size || '',
        uid: user.uid,
        email: user.email,
        ts: Timestamp.now(),
      };
      if (meta.batchId) historyData.batchId = meta.batchId;
      if (meta.prompt) historyData.prompt = meta.prompt;
      if (meta.supplementaryPrompt) historyData.supplementaryPrompt = meta.supplementaryPrompt;
      if (meta.promptId) historyData.promptId = meta.promptId;
      if (meta.promptSource) historyData.promptSource = meta.promptSource;
      if (reusableInput) historyData.inputImage = reusableInput;
      if (meta.modelKey) historyData.modelKey = meta.modelKey;
      if (meta.aspectRatio) historyData.aspectRatio = meta.aspectRatio;
      if (typeof meta.imageCount === 'number') historyData.imageCount = meta.imageCount;
      if (typeof meta.t2iMode === 'boolean') historyData.t2iMode = meta.t2iMode;
      if (meta.mediaType) historyData.mediaType = meta.mediaType;
      if (typeof meta.duration === 'number') historyData.duration = meta.duration;
      if (typeof meta.generateAudio === 'boolean') historyData.generateAudio = meta.generateAudio;
      await setDoc(doc(collection(db, 'history'), id), historyData);
    } catch (e) {
      console.warn('pushHistory failed', e);
    }
  };

  const logView = async (view: string) => {
    if (!user) return;
    try {
      await setDoc(doc(collection(db, 'usage')), {
        type: 'view',
        view,
        uid: user.uid,
        email: user.email,
        ts: Timestamp.now(),
      });
    } catch (e) {
      console.warn('logView failed', e);
    }
  };

  // Log lượt truy cập tab khi đổi mode / sub-tab
  useEffect(() => {
    if (!user || !isAuthReady) return;
    let view: string = appMode;
    if (appMode === 'clothing') view = `clothing-${activeTab}`;
    else if (appMode === 'ecom') view = `ecom-${ecomSubTab}`;
    logView(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, activeTab, ecomSubTab, user, isAuthReady]);

  const handleEcomGenerate = async () => {
    // Text-to-image mode is gen-new only; otherwise the regular i2i product-image requirement applies.
    const generationTabActive = isEcomGenerationTab(ecomSubTab);
    const videoActive = ecomSubTab === 'gen-video' && isVideoModelKey(ecomModel);
    const t2iActive = generationTabActive && ecomT2IMode;
    if (!t2iActive && ecomProductImages.length === 0) return;
    if (t2iActive && !ecomPromptText.trim() && !ecomSupplementaryPrompt.trim() && !ecomUsesSecretPrompt) {
      setGlobalError(videoActive
        ? "Chế độ Text-to-Video cần ít nhất 1 prompt mô tả video muốn tạo."
        : "Chế độ Text-to-Image cần ít nhất 1 prompt mô tả ảnh muốn tạo.");
      return;
    }
    if (ecomSubTab === 'clone-template' && !ecomTemplateImage) {
      setGlobalError("Vui lòng tải lên cả Ảnh Template mẫu và Ảnh Sản phẩm");
      return;
    }

    // Gen-new uses concurrent batch mode (doesn't block UI); other sub-tabs use original single-batch flow.
    const isConcurrent = generationTabActive;

    // Snapshot all inputs at submit time so async run and history reuse the
    // exact values that were active when the user clicked.
    const isPromptManualAtSubmit = selectedEcomPromptId === 'manual';
    const selectedPromptAtSubmit = ecomSavedPrompts.find((prompt) => prompt.id === selectedEcomPromptId);
    const snapshot = {
      productImage: t2iActive ? null : (ecomProductImages[0] || ecomProductImage),
      productImages: t2iActive ? [] : ecomProductImages,
      t2iMode: t2iActive,
      promptText: ecomPromptText,
      promptIsSecret: generationTabActive && selectedPromptAtSubmit?.isSecret === true,
      supplementaryPrompt: ecomSupplementaryPrompt,
      model: ecomModel,
      aspectRatio: ecomAspectRatio,
      imageSize: ecomImageSize,
      imageCount: videoActive ? 1 : ecomImageCount,
      mediaType: (videoActive ? 'video' : 'image') as 'image' | 'video',
      duration: videoActive ? ecomVideoDuration : undefined,
      generateAudio: videoActive ? (ecomModel === 'seedance-2-5' && ecomVideoGenerateAudio) : undefined,
      templateImage: ecomTemplateImage,
      cloneManualMode,
      clonePromptType,
      promptId: isPromptManualAtSubmit ? undefined : selectedEcomPromptId,
      promptSource: (isPromptManualAtSubmit ? 'manual' : 'saved') as 'manual' | 'saved',
      promptLabel: isPromptManualAtSubmit ? undefined : selectedPromptAtSubmit?.name,
    };

    let currentPrompt = snapshot.promptIsSecret ? '' : snapshot.promptText;
    let config = MODEL_CONFIG[snapshot.model];
    let templateSource: string | undefined = undefined;

    if (ecomSubTab === 'clone-template') {
      currentPrompt = (snapshot.cloneManualMode && snapshot.promptText.trim())
        ? snapshot.promptText.trim()
        : (clonePrompts[snapshot.clonePromptType] || DEFAULT_CLONE_PROMPTS[snapshot.clonePromptType]);
      config = MODEL_CONFIG['gpt2'];
      templateSource = snapshot.templateImage!;
    }

    // Branch on mode: concurrent batches vs single-batch blocking
    let batchId: string | null = null;
    if (isConcurrent) {
      batchId = `ecom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newBatch: EcomBatch = {
        id: batchId,
        startedAt: Date.now(),
        promptText: currentPrompt,
        promptSource: snapshot.promptSource,
        promptLabel: snapshot.promptLabel,
        promptId: snapshot.promptId,
        basePromptText: snapshot.promptText,
        supplementaryPrompt: snapshot.supplementaryPrompt,
        inputImage: snapshot.productImage,
        inputImages: snapshot.productImages,
        imageCount: snapshot.imageCount,
        model: snapshot.model,
        aspectRatio: snapshot.aspectRatio,
        imageSize: snapshot.imageSize,
        t2iMode: snapshot.t2iMode,
        mediaType: snapshot.mediaType,
        duration: snapshot.duration,
        generateAudio: snapshot.generateAudio,
        results: [],
        status: 'running',
      };
      setEcomBatches((prev) => [newBatch, ...prev]);
      setGlobalError(null);
      // do NOT set isEcomGenerating — keep button enabled for next submission
    } else {
      setIsEcomGenerating(true);
      setGlobalError(null);
      setEcomResults([]);
      setEcomBoxes([]);
      setSelectedBoxIds([]);
    }

    try {
      // Prefer original Kie URLs/bytes; only the server-key fallback adapts
      // oversized payloads to Vercel's hard request limit.
      const referenceImages = snapshot.t2iMode
        ? []
        : await prepareKieReferences([
            ...snapshot.productImages,
            ...(templateSource ? [templateSource] : []),
          ], kieApiKey);
      const mainBase64 = referenceImages[0]?.startsWith('data:')
        ? referenceImages[0].split(',')[1]
        : null;

      let generatedImages: string[] = [];
      let protectedHistoryPrompt = '';
      let serverFailed = false;
      let chargedCredits: number | undefined;

      // Try server first
      try {
        const response = await apiFetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: config.id,
            prompt: currentPrompt,
            savedPromptId: snapshot.promptIsSecret ? snapshot.promptId : undefined,
            supplementaryPrompt: generationTabActive ? snapshot.supplementaryPrompt : undefined,
            referenceImages,
            referenceMode: templateSource ? 'product-composition' : undefined,
            aspectRatio: snapshot.aspectRatio,
            imageSize: snapshot.imageSize,
            numberOfImages: snapshot.imageCount,
            t2iMode: snapshot.t2iMode,
            mediaType: snapshot.mediaType,
            videoDuration: snapshot.duration,
            generateAudio: snapshot.generateAudio,
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (snapshot.promptIsSecret && isEncryptedSharedPrompt(data.protectedPrompt)) {
            protectedHistoryPrompt = data.protectedPrompt;
          }
          if (Number.isFinite(Number(data.chargedCredits)) && Number(data.chargedCredits) > 0) {
            chargedCredits = Number(data.chargedCredits);
          }
          if (data.isAsync && Array.isArray(data.taskIds)) {
            // KIE async: poll each task until done. Each poll is fast → no Vercel timeout.
            const urls = await pollKieTasks(data.taskIds, undefined, { mediaType: snapshot.mediaType });
            generatedImages = urls;
          } else if (data.isUrl) {
            generatedImages = data.imagesBase64;
          } else if (data.imagesBase64 && Array.isArray(data.imagesBase64)) {
            generatedImages = data.imagesBase64.map((b64: string) => `data:image/png;base64,${b64}`);
          } else if (data.imageBase64) {
            generatedImages = [`data:image/png;base64,${data.imageBase64}`];
          }
        } else {
          serverFailed = true;
          const err = await response.json();
          throw new Error(err.error || "Lỗi Server");
        }
      } catch (err: any) {
        if (!serverFailed) throw err;
        else throw err; // Just throw it so it surfaces globally
      }
      
      if (serverFailed) {
        throw new Error(`Không thể tạo ${snapshot.mediaType === 'video' ? 'video' : 'ảnh'} qua Kie.ai. Ứng dụng không fallback sang Google trực tiếp.`);
        // Fallback to client-side
        let apiKey = '';
        if (config.requiredKey === 'google') {
          apiKey = googleApiKey;
          if (!apiKey && window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) {
              await window.aistudio.openSelectKey();
            }
          }
        } else if (config.requiredKey === 'kie') {
          apiKey = kieApiKey;
        }

        if (!apiKey && config.requiredKey === 'kie') {
            throw new Error("Vui lòng nhập API Key tại Mục Cài đặt.");
        }
        
        if (config.id === 'gpt-image-2-image-to-image') {
          throw new Error("Mô hình này không hỗ trợ gọi trực tiếp từ trình duyệt bằng API Key cá nhân.");
        }

        const ai = apiKey ? new KieOnlyGuard({ apiKey }) : new KieOnlyGuard({});
            // Skip image inline data in T2I mode (mainBase64 is null)
            const aiParts: any[] = [];
            if (mainBase64) {
              aiParts.push({ inlineData: { data: mainBase64, mimeType: 'image/jpeg' } });
            }
            aiParts.push({ text: `${currentPrompt} (Quality: ${snapshot.imageSize.toUpperCase()})` });
            const aiResponse = await ai.models.blockedDirectCall({
              model: config.id,
              contents: { parts: aiParts },
              config: {
                imageConfig: {
                  aspectRatio: snapshot.aspectRatio as any,
                  numberOfImages: snapshot.imageCount,
                  imageSize: snapshot.imageSize.toUpperCase()
                } as any
              }
            });
            for (const part of aiResponse.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    generatedImages.push(`data:image/png;base64,${part.inlineData.data}`);
                }
            }
      }

      if (generatedImages.length > 0) {
        const feat = ecomSubTab === 'clone-template'
          ? 'ecom-clone'
          : ecomSubTab === 'gen-video' ? 'ecom-gen-video' : 'ecom-gen-new';
        logUsage(feat, config.id, generatedImages.length, snapshot.imageSize, {
          mediaType: snapshot.mediaType,
          duration: snapshot.duration,
          generateAudio: snapshot.generateAudio,
          chargedCredits,
        });
        // The Kie result is ready now. Do not block the result card on the
        // optional Firestore history write; a slow or
        // temporarily unavailable history service must never leave a batch
        // stuck in "ĐANG GEN".
        if (isConcurrent && batchId) {
          const finishedBatchId = batchId;
          setEcomBatches((prev) => prev.map(b => b.id === finishedBatchId
            ? { ...b, results: generatedImages, status: 'done' as const, finishedAt: Date.now() }
            : b
          ));
          onGenComplete('Ecom: gen xong', snapshot.mediaType === 'video' ? 'Video đã hoàn tất' : `${generatedImages.length} ảnh hoàn tất`);
        } else {
          setEcomResults(generatedImages);
          onGenComplete('Ecom: gen xong', snapshot.mediaType === 'video' ? 'Video đã hoàn tất' : `${generatedImages.length} ảnh hoàn tất`);
        }

        // Persist history in the background after the UI is marked complete.
        void Promise.allSettled(generatedImages.map((u) =>
          pushHistory(u, {
            feature: feat,
            model: config.id,
            size: snapshot.imageSize,
            batchId: batchId || undefined,
            prompt: snapshot.promptIsSecret ? protectedHistoryPrompt : snapshot.promptText,
            supplementaryPrompt: snapshot.supplementaryPrompt,
            promptId: snapshot.promptId,
            promptSource: snapshot.promptSource,
            inputImage: snapshot.t2iMode ? null : (referenceImages[0] || snapshot.productImage),
            modelKey: snapshot.model,
            aspectRatio: snapshot.aspectRatio,
            imageCount: snapshot.imageCount,
            t2iMode: snapshot.t2iMode,
            mediaType: snapshot.mediaType,
            duration: snapshot.duration,
            generateAudio: snapshot.generateAudio,
          })
        ));
      } else {
        throw new Error(`Không có ${snapshot.mediaType === 'video' ? 'video' : 'ảnh'} kết quả trả về.`);
      }
    } catch (error: any) {
      console.error(error);
      if (isConcurrent && batchId) {
        const failedBatchId = batchId;
        setEcomBatches((prev) => prev.map(b => b.id === failedBatchId
          ? { ...b, status: 'failed' as const, errorMessage: error.message, finishedAt: Date.now() }
          : b
        ));
        onGenComplete('Ecom: gen FAIL', error.message || 'Lỗi không rõ');
      } else {
        setGlobalError(error.message);
        onGenComplete('Ecom: gen FAIL', error.message || 'Lỗi không rõ');
      }
    } finally {
      if (!isConcurrent) {
        setIsEcomGenerating(false);
      }
    }
  };

  useEffect(() => {
    if (!pendingEcomRegenerate) return;
    setPendingEcomRegenerate(null);
    void handleEcomGenerate();
  }, [pendingEcomRegenerate]);

  const handleEcomGeneratePattern = async () => {
    if (!patternSourceImage) return;
    setIsGeneratingPattern(true);
    setGlobalError(null);
    setGeneratedPattern(null);

    const currentPrompt = "Recreate this image as a flat 2D seamless repeating pattern, formatted as a print-ready textile design file. Preserve all motifs, colors, proportions, and spatial layout exactly as in the reference. Solid flat background, no fabric texture, no folds, no shadows, no lighting effects, no mockup, no product photography, no borders, no frames, no extra decorative elements added. Output as a clean digital pattern tile, top-down view, 1:1 aspect ratio.";
    const config = MODEL_CONFIG[ecomModel];

    try {
      const referenceImages = await prepareKieReferences([patternSourceImage], kieApiKey);

      const response = await apiFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: config.id,
          prompt: currentPrompt,
          referenceImages,
          aspectRatio: '1:1',
          imageSize: '1k',
          numberOfImages: 1,
        })
      });

      if (response.ok) {
        const data = await response.json();
        let finalImage = "";
        if (data.isAsync && Array.isArray(data.taskIds) && data.taskIds.length > 0) {
          const urls = await pollKieTasks(data.taskIds);
          finalImage = urls[0];
        } else if (data.isUrl && data.imagesBase64?.length > 0) {
          finalImage = data.imagesBase64[0];
        } else if (Array.isArray(data.imagesBase64) && data.imagesBase64.length > 0) {
          finalImage = `data:image/png;base64,${data.imagesBase64[0]}`;
        } else if (data.imageBase64) {
          finalImage = `data:image/png;base64,${data.imageBase64}`;
        }
        if (finalImage) {
          setGeneratedPattern(finalImage);
        } else {
          throw new Error("Không nhận được ảnh hợp lệ từ API");
        }
      } else {
        const err = await response.json();
        throw new Error(err.error || "Lỗi Server");
      }
    } catch (error: any) {
      console.error("Generate Pattern Error:", error);
      setGlobalError(error.message);
    } finally {
      setIsGeneratingPattern(false);
    }
  };

  // Thêm / cập nhật prompt mẫu cho tab Thay (kho riêng type 'ecom-thay')
  const handleAddThayPrompt = async () => {
    if (!newThayPromptName || !newThayPromptText) return;
    if (!user) { setGlobalError('Vui lòng đăng nhập để lưu prompt!'); return; }
    const id = editingThayPromptId || Math.random().toString(36).substr(2, 9);
    const isDefaultPrompt = isAdmin && ecomThaySavedPrompts.some(p => p.id === id && p.isDefault);
    try {
      const storedPrompt = isDefaultPrompt ? await encryptSharedPromptForAdmin(newThayPromptText) : newThayPromptText;
      await setDoc(doc(db, 'prompts', id), {
        id,
        name: newThayPromptName,
        prompt: storedPrompt,
        type: 'ecom-thay',
        uid: isDefaultPrompt ? 'admin' : user.uid,
        createdAt: Timestamp.now(),
        ...(isDefaultPrompt ? { isDefault: true } : {}),
      });
      setIsAddingThayPrompt(false);
      setEditingThayPromptId(null);
      setNewThayPromptName('');
      setNewThayPromptText('');
      setSelectedEcomThayPromptId(id);
      setEcomThayPrompt(newThayPromptText);
      setThayManualMode(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `prompts/${id}`);
    }
  };

  const startEditThayPrompt = (p: SavedPrompt, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingThayPromptId(p.id);
    setNewThayPromptName(p.name);
    setNewThayPromptText(p.prompt);
    setIsAddingThayPrompt(true);
  };

  // Load a file into a specific compose slot
  const loadFileToCompose = (file: File, slotIndex: number) => {
    if (!file.type.startsWith('image/')) {
      setGlobalError('File không phải ảnh hợp lệ.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (!result) return;
      setComposeImages((prev) => prev.map((img, i) => (i === slotIndex ? result : img)));
    };
    reader.readAsDataURL(file);
  };

  const handleEcomCompose = async () => {
    const imgs = composeImages.filter((x): x is string => !!x);
    if (imgs.length < 2) {
      setGlobalError('Cần ít nhất 2 ảnh để ghép.');
      return;
    }
    setIsComposing(true);
    setGlobalError(null);
    setComposeResults([]);
    try {
      const referenceImages = await prepareKieReferences(imgs, kieApiKey);
      const config = MODEL_CONFIG[composeModel];

      const response = await apiFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: config.id,
          prompt: composePrompt,
          referenceImages,
          aspectRatio: composeAspectRatio,
          imageSize: composeQuality,
          numberOfImages: composeCount,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Lỗi server' }));
        throw new Error(err.error || 'Lỗi server');
      }
      const data = await response.json();
      let results: string[] = [];
      if (data.isAsync && Array.isArray(data.taskIds)) {
        results = await pollKieTasks(data.taskIds);
      } else if (data.isUrl) {
        results = data.imagesBase64;
      } else if (Array.isArray(data.imagesBase64)) {
        results = data.imagesBase64.map((b: string) => `data:image/png;base64,${b}`);
      } else if (data.imageBase64) {
        results = [`data:image/png;base64,${data.imageBase64}`];
      }
      if (results.length === 0) throw new Error('Không có ảnh kết quả trả về.');
      setComposeResults(results);
      logUsage('ecom-compose', MODEL_CONFIG[composeModel]?.id || composeModel, results.length, composeQuality);
      results.forEach((u) => pushHistory(u, { feature: 'ecom-compose', model: MODEL_CONFIG[composeModel]?.id || composeModel, size: composeQuality }));
    } catch (err: any) {
      console.error('Compose error:', err);
      setGlobalError(err.message || 'Có lỗi xảy ra khi ghép ảnh.');
    } finally {
      setIsComposing(false);
    }
  };

  // ---------- OFA tab ----------
  const loadFileToOfa = (file: File, slotIndex: number) => {
    if (!file.type.startsWith('image/')) {
      setGlobalError('File không phải ảnh hợp lệ.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (!result) return;
      setOfaImages((prev) => prev.map((img, i) => (i === slotIndex ? result : img)));
    };
    reader.readAsDataURL(file);
  };

  const toggleOfaCategory = (id: number) => {
    setOfaSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const runOfaBatch = async (batch: OfaBatch) => {
    const cancelRef = { current: false };
    const controller = new AbortController();
    ofaCancelMapRef.current.set(batch.id, cancelRef);
    ofaAbortMapRef.current.set(batch.id, controller);

    try {
      const config = MODEL_CONFIG[batch.model];
      const selected = OFA_PROMPT_LIBRARY.filter((c) => batch.categoryIds.includes(c.id));

      for (const category of selected) {
        if (cancelRef.current) break;
        const fullPrompt = buildOfaPrompt(category, batch.productName, batch.description);
        try {
          const response = await apiFetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              modelId: config.id,
              prompt: fullPrompt,
              referenceImages: batch.imageBase64s,
              aspectRatio: batch.aspectRatio,
              imageSize: batch.quality,
              numberOfImages: 1,
            }),
            signal: controller.signal,
          });
          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Lỗi server' }));
            throw new Error(err.error || 'Lỗi server');
          }
          const data = await response.json();
          let urls: string[] = [];
          if (data.isAsync && Array.isArray(data.taskIds)) {
            urls = await pollKieTasks(data.taskIds, controller.signal);
          } else if (data.isUrl) {
            urls = data.imagesBase64;
          } else if (Array.isArray(data.imagesBase64)) {
            urls = data.imagesBase64.map((b: string) => `data:image/png;base64,${b}`);
          } else if (data.imageBase64) {
            urls = [`data:image/png;base64,${data.imageBase64}`];
          }
          if (cancelRef.current) break;
          if (urls.length > 0) {
            setOfaBatches((prev) =>
              prev.map((b) =>
                b.id === batch.id
                  ? { ...b, results: [...b.results, { categoryId: category.id, urls }] }
                  : b
              )
            );
            logUsage(`ofa-${category.code}`, config.id, urls.length, batch.quality);
            urls.forEach((u) => pushHistory(u, { feature: `ofa-${category.code}`, model: config.id, size: batch.quality }));
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') break;
          console.error(`OFA gen failed for ${category.name}:`, err);
        }
      }

      setOfaBatches((prev) =>
        prev.map((b) =>
          b.id === batch.id
            ? { ...b, status: cancelRef.current ? 'cancelled' : 'done', finishedAt: Date.now() }
            : b
        )
      );
      if (!cancelRef.current) {
        const finalUrls = batch.results.reduce((acc, r) => acc + (r.urls?.length || 0), 0);
        onGenComplete(
          `OFA: ${batch.productName || 'gen'} xong`,
          `${batch.categoryIds.length} category • ${finalUrls} ảnh`
        );
      }
    } catch (err: any) {
      setOfaBatches((prev) =>
        prev.map((b) =>
          b.id === batch.id
            ? { ...b, status: 'error', errorMessage: err.message || 'Lỗi không xác định', finishedAt: Date.now() }
            : b
        )
      );
      onGenComplete(`OFA: ${batch.productName || 'gen'} FAIL`, err.message || 'Lỗi không rõ');
    } finally {
      ofaCancelMapRef.current.delete(batch.id);
      ofaAbortMapRef.current.delete(batch.id);
    }
  };

  // Auto-promote queued batches when a running slot opens up (cap = OFA_MAX_CONCURRENT)
  useEffect(() => {
    const running = ofaBatches.filter((b) => b.status === 'running').length;
    if (running >= OFA_MAX_CONCURRENT) return;
    const next = ofaBatches.find((b) => b.status === 'queued');
    if (!next) return;
    setOfaBatches((prev) => prev.map((b) => (b.id === next.id ? { ...b, status: 'running' } : b)));
    queueMicrotask(() => runOfaBatch({ ...next, status: 'running' }));
  }, [ofaBatches]);

  const handleOfaGenerate = async () => {
    if (!ofaProductName.trim()) {
      setGlobalError('Vui lòng nhập tên sản phẩm.');
      return;
    }
    if (ofaSelectedCategoryIds.length === 0) {
      setGlobalError('Vui lòng chọn ít nhất 1 mục prompt.');
      return;
    }
    const imgs = ofaImages.filter((x): x is string => !!x);
    if (imgs.length === 0) {
      setGlobalError('Vui lòng tải lên ít nhất 1 ảnh tham khảo.');
      return;
    }
    setGlobalError(null);
    try {
      const base64s = await prepareKieReferences(imgs, kieApiKey);
      const newBatch: OfaBatch = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        startedAt: Date.now(),
        productName: ofaProductName.trim(),
        description: ofaDescription.trim(),
        imageBase64s: base64s,
        categoryIds: [...ofaSelectedCategoryIds],
        aspectRatio: ofaAspectRatio,
        quality: ofaQuality,
        model: ofaModel,
        results: [],
        status: 'queued',
      };
      setOfaBatches((prev) => [...prev, newBatch]);
    } catch (err: any) {
      setGlobalError(err.message || 'Có lỗi khi chuẩn bị ảnh.');
    }
  };

  const handleOfaCancel = (batchId: string) => {
    const cancelRef = ofaCancelMapRef.current.get(batchId);
    if (cancelRef) cancelRef.current = true;
    const controller = ofaAbortMapRef.current.get(batchId);
    controller?.abort();
    setOfaBatches((prev) =>
      prev.map((b) =>
        b.id === batchId && (b.status === 'queued' || b.status === 'running')
          ? { ...b, status: 'cancelled', finishedAt: Date.now() }
          : b
      )
    );
  };

  const handleOfaClearFinished = () => {
    setOfaBatches((prev) => prev.filter((b) => b.status === 'queued' || b.status === 'running'));
  };

  const handleEcomThay = async () => {
    if (!ecomThayModelImage || !ecomThayProductImage) {
      setGlobalError("Vui lòng tải lên cả ẢNH GIƯỜNG (MODEL) và ẢNH SẢN PHẨM (PRODUCT).");
      return;
    }

    setIsEcomThayGenerating(true);
    setGlobalError(null);
    setEcomThayResults([]);
    setEcomThayActiveIdx(0);

    try {
      // Product first, model/composition second. Original files are uploaded
      // directly to Kie when a client Kie key is available.
      const referenceImages = await prepareKieReferences(
        [ecomThayProductImage, ecomThayModelImage],
        kieApiKey
      );
      const actualModelId = MODEL_CONFIG[ecomThayModel]?.id || 'nano-banana-pro';
      const count = Math.max(1, Math.min(3, ecomThayCount));
      const selectedSavedPrompt = selectedEcomThayPromptId
        ? ecomThaySavedPrompts.find(prompt => prompt.id === selectedEcomThayPromptId)
        : undefined;
      const usesSecretPrompt = selectedSavedPrompt?.isSecret === true;

      const response = await apiFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: actualModelId,
          prompt: usesSecretPrompt ? '' : ecomThayPrompt,
          savedPromptId: usesSecretPrompt ? selectedSavedPrompt!.id : undefined,
          referenceImages,
          referenceMode: 'product-composition',
          aspectRatio: ecomThayAspectRatio,
          imageSize: ecomThayQuality.toUpperCase(),
          numberOfImages: count,
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Lỗi server" }));
        throw new Error(err.error || "Lỗi server");
      }

      const data = await response.json();
      // GPT2 (Kie.ai) trả về async — cần poll; Gemini trả về base64 ngay
      let thayResultUrls: string[] = [];
      if (data.isAsync && Array.isArray(data.taskIds)) {
        const urls = await pollKieTasks(data.taskIds);
        thayResultUrls = urls.filter((u) => !!u);
      } else if (Array.isArray(data.imagesBase64) && data.imagesBase64.length > 0) {
        thayResultUrls = data.imagesBase64.map((b: string) => `data:image/png;base64,${b}`);
      } else if (data.imageBase64) {
        thayResultUrls = [`data:image/png;base64,${data.imageBase64}`];
      }
      if (thayResultUrls.length === 0) {
        throw new Error("AI không trả về ảnh. Vui lòng thử lại với prompt khác.");
      }
      setEcomThayResults(thayResultUrls);
      logUsage('ecom-thay', actualModelId, thayResultUrls.length, ecomThayQuality);
      thayResultUrls.forEach((u) =>
        pushHistory(u, { feature: 'ecom-thay', model: actualModelId, size: ecomThayQuality })
      );
    } catch (err: any) {
      console.error(err);
      setGlobalError(err.message || "Có lỗi xảy ra khi thực hiện THAY.");
    } finally {
      setIsEcomThayGenerating(false);
    }
  };

  const handleEcomApplyPattern = async () => {
    if (!patternMockupImage || !generatedPattern) return;
    setIsEcomGenerating(true);
    setGlobalError(null);
    setEcomResults([]);

    const currentPrompt = "Replace the pattern on the main textile product visible in image with the pattern from image 1. Apply the new pattern as actual printed fabric, not as a flat overlay or sticker. Preserve all original fabric wrinkles, folds, creases, soft shadows, highlights, and natural depth of the PRODUCT. The pattern must follow the contours of the fabric — stretching at tension points, compressing at folds, darkening in shadowed areas, brightening where light hits. Keep the original lighting, scene, composition, pose, and all other elements unchanged. Photorealistic textile rendering.";
    const config = MODEL_CONFIG[ecomModel];
    const patternPrompt = currentPrompt.replace('from image 1', 'from Reference Image 2');

    try {
      let finalTemplateBase64 = generatedPattern;
      if (generatedPattern.startsWith('http')) {
        const proxyUrl = generatedPattern.includes('tmpfiles.org') 
          ? generatedPattern.replace('tmpfiles.org/', 'tmpfiles.org/dl/') 
          : generatedPattern;
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(proxyUrl)}`);
        if (!res.ok) throw new Error("Không thể tải ảnh pattern");
        const blob = await res.blob();
        finalTemplateBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
      
      const referenceImages = await prepareKieReferences(
        [patternMockupImage, finalTemplateBase64],
        kieApiKey
      );

      const response = await apiFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: config.id,
          prompt: patternPrompt,
          referenceImages,
          referenceMode: 'product-composition',
          aspectRatio: ecomAspectRatio, // Use the selected aspect ratio
          imageSize: ecomImageSize,
          numberOfImages: ecomImageCount,
        })
      });

      if (response.ok) {
        const data = await response.json();
        let generatedImages: string[] = [];
        if (data.isAsync && Array.isArray(data.taskIds)) {
          const urls = await pollKieTasks(data.taskIds);
          generatedImages = urls;
        } else if (data.isUrl) {
          generatedImages = data.imagesBase64;
        } else if (data.imagesBase64 && Array.isArray(data.imagesBase64)) {
          generatedImages = data.imagesBase64.map((b64: string) => `data:image/png;base64,${b64}`);
        } else if (data.imageBase64) {
          generatedImages = [`data:image/png;base64,${data.imageBase64}`];
        }
        setEcomResults(generatedImages);
        logUsage('ecom-pattern', config.id, generatedImages.length || ecomImageCount, ecomImageSize);
        generatedImages.forEach((u) => pushHistory(u, { feature: 'ecom-pattern', model: config.id, size: ecomImageSize }));
      } else {
        const err = await response.json();
        throw new Error(err.error || "Lỗi Server");
      }
    } catch (error: any) {
      console.error("Apply Pattern Error:", error);
      setGlobalError(error.message);
    } finally {
      setIsEcomGenerating(false);
    }
  };

  const onPatternCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setPatternCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSavePatternCrop = async () => {
    if (!patternSourceImage || !patternCroppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(patternSourceImage, patternCroppedAreaPixels, patternRotation);
      if (croppedImage) {
        setPatternSourceImage(croppedImage);
        setIsPatternCropModalOpen(false);
      }
    } catch (e) {
      console.error(e);
      setGlobalError("Không thể cắt ảnh");
    }
  };

  const handleDetectGridBoxes = async () => {
    if (!selectedEcomGrid) return;
    setIsDetectingBoxes(true);
    setGlobalError(null);
    setEcomBoxes([]);
    setSelectedBoxIds([]);
    setEcomFinalImages([]);

    try {
      let imageUrlToLoad = selectedEcomGrid;
      if (imageUrlToLoad.startsWith("http")) {
        imageUrlToLoad = `/api/proxy-image?url=${encodeURIComponent(imageUrlToLoad)}`;
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      const imageLoaded = new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Lỗi tải ảnh"));
        img.src = imageUrlToLoad;
      });
      await imageLoaded;

      // Extract base64 for API
      let base64ForApi = "";
      if (selectedEcomGrid.startsWith("data:")) {
        base64ForApi = selectedEcomGrid.split(',')[1];
      } else {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) throw new Error("Could not get temporary canvas context");
        tempCtx.drawImage(img, 0, 0);
        base64ForApi = tempCanvas.toDataURL("image/jpeg").split(',')[1];
      }

      // 1. Ask AI to detect grid boxes (via Kie.ai — migrated from Gemini direct)
      const detectResponse = await apiFetch('/api/detect-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64ForApi })
      });
      if (!detectResponse.ok) {
        let errorData;
        try {
          errorData = await detectResponse.json();
        } catch (e) {
          errorData = { error: await detectResponse.text() };
        }
        throw new Error(errorData.error || `Lỗi server API (${detectResponse.status})`);
      }
      const detectData = await detectResponse.json();
      let parsedResponse = detectData.result;
      
      // Attempt to clean JSON markdown if present
      if (parsedResponse.includes('```json')) {
         parsedResponse = parsedResponse.split('```json')[1].split('```')[0].trim();
      } else if (parsedResponse.includes('```')) {
         parsedResponse = parsedResponse.split('```')[1].trim();
      }

      let boxes: any[] = [];
      try {
        boxes = JSON.parse(parsedResponse);
      } catch (e) {
        console.error("Parse boxes failed", parsedResponse);
        throw new Error("Kết quả phân tích không hợp lệ: " + parsedResponse);
      }

      if (!Array.isArray(boxes) || boxes.length === 0) {
        throw new Error("AI không tìm thấy ảnh nhỏ nào trong lưới.");
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      const crops: {id: string, cropUrl: string}[] = [];
      for (const box of boxes) {
        // box coords are 0-1000
        const x = (box.xmin / 1000) * img.width;
        const y = (box.ymin / 1000) * img.height;
        const width = ((box.xmax - box.xmin) / 1000) * img.width;
        const height = ((box.ymax - box.ymin) / 1000) * img.height;

        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
        crops.push({
          id: Math.random().toString(36).substr(2, 9),
          cropUrl: canvas.toDataURL("image/jpeg", 0.9)
        });
      }

      setEcomBoxes(crops);
      // Select all by default
      setSelectedBoxIds(crops.map(c => c.id));
    } catch (err: any) {
      console.error(err);
      setGlobalError("Lỗi phân tích: " + (err.message || String(err)));
    } finally {
      setIsDetectingBoxes(false);
    }
  };

  const handleEnhanceSelectedBoxes = async () => {
    if (selectedBoxIds.length === 0) {
      setGlobalError("Vui lòng chọn ít nhất một ảnh để xử lý.");
      return;
    }

    const alreadyGeneratedIds = selectedBoxIds.filter(id => ecomFinalImages.some(img => img.id === id && !img.loading));
    if (alreadyGeneratedIds.length > 0) {
      setGlobalError("Có phân cảnh bạn chọn đã được gen xong (Gen trùng). Vui lòng bỏ chọn phân cảnh đó để tiếp tục hoặc xóa kết quả cũ.");
      return;
    }
    
    setIsEcomEnhancing(true);
    setGlobalError(null);

    logUsage('ecom-enhance', enhanceModel === 'banana-pro' ? 'nano-banana-pro' : 'nano-banana-2', selectedBoxIds.length, '1k');

    const selectedBoxesList = ecomBoxes.filter(b => selectedBoxIds.includes(b.id));

    const newPlaceholders = selectedBoxesList.map(b => ({
      id: b.id,
      url: b.cropUrl,
      loading: true
    }));

    setEcomFinalImages(prev => [...prev, ...newPlaceholders]);

    try {
      const apiKey = googleApiKey || (process.env as any).GEMINI_API_KEY || '';
      
      const maxConcurrent = 2; // Process 2 at a time

      for (let i = 0; i < selectedBoxesList.length; i += maxConcurrent) {
        const batch = selectedBoxesList.slice(i, i + maxConcurrent);
        
        const promises = batch.map(async (box) => {
          try {
             const referenceImages = await prepareKieReferences([box.cropUrl], kieApiKey);
             const res = await apiFetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  modelId: enhanceModel === 'banana-pro' ? 'nano-banana-pro' : 'nano-banana-2',
                  prompt: 'High-resolution upscale of this product image. Preserve all details, colors, and the original composition. Enhance sharpness, clarity and remove any compression artifacts. Professional studio quality.',
                  referenceImages,
                  aspectRatio: enhanceAspectRatio,
                  imageSize: ecomImageSize.toUpperCase() || '1K',
                  numberOfImages: 1,
                })
             });

             let finalUrl = box.cropUrl;

             if (!res.ok) {
                const errData = await res.json();
                console.warn("Enhance error for piece", errData);
             } else {
                const data = await res.json();
                if (data.isAsync && Array.isArray(data.taskIds)) {
                  const urls = await pollKieTasks(data.taskIds);
                  if (urls[0]) finalUrl = urls[0];
                } else if (data.imageBase64) finalUrl = `data:image/jpeg;base64,${data.imageBase64}`;
                else if (data.imagesBase64?.length > 0) finalUrl = `data:image/jpeg;base64,${data.imagesBase64[0]}`;
             }

             setEcomFinalImages(prev => prev.map(img => img.id === box.id ? { ...img, url: finalUrl, loading: false } : img));
             if (finalUrl !== box.cropUrl) pushHistory(finalUrl, { feature: 'ecom-enhance', model: enhanceModel === 'banana-pro' ? 'nano-banana-pro' : 'nano-banana-2', size: ecomImageSize });
          } catch(e) {
             console.warn("Exception during piece enhancement", e);
             setEcomFinalImages(prev => prev.map(img => img.id === box.id ? { ...img, loading: false } : img));
          }
        });

        await Promise.all(promises);
      }

    } catch (err: any) {
      console.error(err);
      setGlobalError("Lỗi tách ảnh: " + err.message);
    } finally {
      setIsEcomEnhancing(false);
    }
  };

  const handleTranslateSelectedImages = async () => {
    if (selectedResultIds.length === 0) return;
    
    setIsTranslatingImages(true);
    setGlobalError(null);

    // Set loading state for selected images
    setEcomFinalImages(prev => prev.map(img => 
      selectedResultIds.includes(img.id) ? { ...img, loading: true } : img
    ));

    try {
      const apiKey = googleApiKey || (process.env as any).GEMINI_API_KEY || '';
      
      const maxConcurrent = 2; // Process 2 at a time
      
      for (let i = 0; i < selectedResultIds.length; i += maxConcurrent) {
        const batchIds = selectedResultIds.slice(i, i + maxConcurrent);
        
        const promises = batchIds.map(async (id) => {
          const imgToTranslate = ecomFinalImages.find(img => img.id === id);
          if (!imgToTranslate || !imgToTranslate.url) {
            setEcomFinalImages(prev => prev.map(img => img.id === id ? { ...img, loading: false } : img));
            return;
          }

          try {
             const referenceImages = await prepareKieReferences([imgToTranslate.url], kieApiKey);
             const res = await apiFetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  modelId: 'nano-banana-2', // Banana 2 qua Kie.ai (rẻ)
                  prompt: 'Translate all Chinese text in this image into Vietnamese. Keep the exact same layout, background, font style, formatting and colors. Only change the text to Vietnamese.',
                  referenceImages,
                  aspectRatio: enhanceAspectRatio,
                  imageSize: ecomImageSize.toUpperCase() || '1K',
                  numberOfImages: 1,
                })
             });

             let finalUrl = imgToTranslate.url;

             if (!res.ok) {
                const errData = await res.json();
                console.warn("Translation error for piece", errData);
             } else {
                const data = await res.json();
                if (data.isAsync && Array.isArray(data.taskIds)) {
                  const urls = await pollKieTasks(data.taskIds);
                  if (urls[0]) finalUrl = urls[0];
                } else if (data.imageBase64) finalUrl = `data:image/jpeg;base64,${data.imageBase64}`;
                else if (data.imagesBase64?.length > 0) finalUrl = `data:image/jpeg;base64,${data.imagesBase64[0]}`;
             }

             setEcomFinalImages(prev => prev.map(img => img.id === id ? { ...img, url: finalUrl, loading: false } : img));
          } catch(e) {
             console.warn("Exception during piece translation", e);
             setEcomFinalImages(prev => prev.map(img => img.id === id ? { ...img, loading: false } : img));
          }
        });

        await Promise.all(promises);
      }

    } catch (err: any) {
      console.error(err);
      setGlobalError("Lỗi dịch ảnh: " + err.message);
    } finally {
      setIsTranslatingImages(false);
    }
  };

  // Auth gate: buộc đăng nhập trước khi vào app
  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-editor-bg">
        <Loader2 size={32} className="animate-spin text-editor-accent" />
      </div>
    );
  }

  if (!user) {
    return (
      <Login
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        loginError={loginError}
        loginLoading={loginLoading}
        onEmailSubmit={handleEmailLogin}
        onGoogleLogin={handleGoogleLogin}
      />
    );
  }

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: 'transparent' }}
    >
      <Header
        appMode={appMode}
        onModeChange={(m) => setAppMode(m)}
        isAdmin={isAdmin}
        canUseClothing={!!userPermissions?.canUseClothing}
        canUseEcom={!!userPermissions?.canUseEcom}
        canUseOfa={!!userPermissions?.canUseOfa}
        canUsePicset={!!userPermissions?.canUsePicset}
        canUseRunninghub={!!(userPermissions?.canUseRunninghub ?? userPermissions?.canUsePicset)}
        theme={theme}
        resolvedTheme={resolvedTheme}
        onThemeChange={setTheme}
        hasApiKey={!!(kieApiKey || googleApiKey)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        isAuthReady={isAuthReady}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        workspaceNav={appMode === 'ecom' ? (
          <Segmented<EcomSubTab>
            value={ecomSubTab}
            onChange={(nextTab) => {
              setEcomSubTab(nextTab);
              if (nextTab === 'gen-video') {
                if (!isVideoModelKey(ecomModel)) setEcomModel('google-omni');
                setEcomT2IMode(true);
              } else if (nextTab === 'gen-new' && isVideoModelKey(ecomModel)) {
                setEcomModel('gpt2');
              }
            }}
            size="sm"
            fullWidth
            options={[
              { value: 'gen-new', label: 'Gen new' },
              { value: 'gen-video', label: 'Gen video' },
              { value: 'clone-template', label: 'Clone' },
              { value: 'pattern-replace', label: 'Pattern' },
              { value: 'thay', label: 'Thay' },
              { value: 'ghep-anh', label: 'Ghép ảnh' },
            ]}
          />
        ) : undefined}
        actions={
          <>
            {images.length > 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 5}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-editor-border text-xs hover:bg-editor-accent hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={14} />
                <span className="hidden sm:inline">Thêm ảnh ({images.length}/5)</span>
                <span className="sm:hidden">{images.length}/5</span>
              </button>
            )}
            {images.some(img => img.processed && img.processed !== img.source) && (
              <button
                onClick={handleDownloadAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-editor-accent text-white text-xs font-bold hover:opacity-90 transition-all"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Lưu tất cả</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={fetchKieCredits}
                disabled={kieCreditsLoading}
                title="Số dư KIE.AI — bấm để làm mới"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-editor-border text-xs hover:bg-editor-border/30 transition-colors disabled:opacity-60"
              >
                <Wallet size={14} />
                <span className="font-semibold tabular-nums">
                  {kieCreditsLoading ? '…' : kieCredits !== null ? kieCredits.toLocaleString() : '—'}
                </span>
                <span className="hidden sm:inline">credits</span>
              </button>
            )}
          </>
        }
      />

      <div className="flex-1 flex flex-col p-3 md:p-5 xl:p-6 max-w-[1800px] mx-auto w-full">
      {appMode === 'admin' && (
        <main className="flex-1 w-full max-w-[1800px] mx-auto py-2">
          <AdminPanel currentUser={user} />
        </main>
      )}

      {appMode === 'ecom' && (
        <main ref={ecomMainRef} className={`flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 xl:gap-6 relative ${isEcomGenerationTab(ecomSubTab) ? 'gen-new-workspace' : ''}`}>
          {/* Left panel: Upload and Settings — full width on gen-new, pattern-replace + clone */}
          <div className={`flex flex-col gap-6 ${
            ecomSubTab === 'thay' || ecomSubTab === 'ghep-anh' ? 'lg:col-span-4'
            : isEcomGenerationTab(ecomSubTab) ? 'gen-new-composer-shell lg:col-span-12'
            : 'lg:col-span-12'
          }`}>
            <div
              className={`p-4 ${isEcomGenerationTab(ecomSubTab) ? `gen-new-composer ${ecomComposerExpanded ? 'is-expanded' : ''}` : ''}`}
              style={{
                background: 'var(--color-card)',
                border: '0.5px solid var(--color-border-soft)',
                borderRadius: 18,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {ecomSubTab === 'clone-template' ? (
                <div className="flex flex-col gap-6">
                  {/* Title bar */}
                  <div>
                    <h2 className="font-bold" style={{ fontSize: 24, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                      Clone Templates
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      Bê layout từ ảnh mẫu sang sản phẩm của bạn.
                    </p>
                  </div>

                  {/* Settings — compact one-row dropdowns (Clone luôn dùng GPT2) */}
                  <div className="p-3 flex gap-2 items-start" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                    {(() => {
                      const availableSizes: string[] = ecomAspectRatio === '1:1' ? ['1k', '2k']
                        : ecomAspectRatio === '9:16' ? ['1k', '2k', '4k']
                        : ['1k'];
                      const arOpts: SettingsDropdownOption<string>[] = ['1:1', '3:4', '4:3', '9:16', '16:9'].map((a) => ({ value: a, label: a }));
                      const sizeOpts: SettingsDropdownOption<string>[] = ['1k', '2k', '4k'].map((s) => ({
                        value: s, label: s.toUpperCase(), disabled: !availableSizes.includes(s),
                      }));
                      const countOpts: SettingsDropdownOption<number>[] = [1, 2, 3].map((c) => ({ value: c, label: String(c) }));
                      return (
                        <>
                          <SettingsDropdown<string>
                            value={ecomAspectRatio}
                            onChange={(v) => setEcomAspectRatio(v)}
                            options={arOpts}
                            width="fill"
                          />
                          <SettingsDropdown<string>
                            value={ecomImageSize}
                            onChange={(v) => setEcomImageSize(v)}
                            options={sizeOpts}
                          />
                          <SettingsDropdown<number>
                            value={ecomImageCount}
                            onChange={(v) => setEcomImageCount(v)}
                            options={countOpts}
                          />
                          <CreditEstimate
                            compact
                            credits={estimateGenerationCredits({
                              modelId: MODEL_CONFIG.gpt2.id,
                              size: ecomImageSize,
                              count: ecomImageCount,
                            })}
                          />
                        </>
                      );
                    })()}
                  </div>

                  {/* 3-column grid: Template / Product / Type+Prompt */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Col 1 — Template mẫu */}
                    <div className="p-4 flex flex-col" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center font-bold rounded-full" style={{ width: 22, height: 22, fontSize: 11, background: 'var(--color-accent)', color: '#fff' }}>1</span>
                        <p className="font-semibold uppercase" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                          Template mẫu
                        </p>
                      </div>
                      <div
                        {...makeDropHandlers('ecom-template', setEcomTemplateImage)}
                        className="w-full aspect-square flex items-center justify-center cursor-pointer overflow-hidden transition-colors relative group"
                        style={{
                          background: dragOverId === 'ecom-template' ? 'var(--color-accent-soft)' : 'var(--color-card)',
                          border: `2px dashed ${dragOverId === 'ecom-template' || ecomTemplateImage ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          borderRadius: 12,
                        }}
                        onClick={() => {
                          setPasteTargetId('ecom-template');
                          if (ecomTemplateFileInputRef.current) ecomTemplateFileInputRef.current.click();
                        }}
                      >
                        {ecomTemplateImage ? (
                          <>
                            <img src={ecomTemplateImage} alt="Template" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                              <span className="text-white font-bold text-xs">Thay đổi ảnh Template</span>
                            </div>
                          </>
                        ) : isStitchingImages ? (
                          <div className="flex flex-col items-center gap-3" style={{ color: 'var(--color-accent)' }}>
                            <Loader2 className="animate-spin" size={32} />
                            <span className="text-sm font-bold animate-pulse">Đang ghép ảnh…</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-center px-4" style={{ color: 'var(--color-text-tertiary)' }}>
                            <Upload size={28} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>Click để tải 1 ảnh hoặc ghép nhiều ảnh</span>
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                        Có thể chọn nhiều ảnh cùng lúc để tự động ghép.
                      </p>
                    </div>

                    {/* Col 2 — Sản phẩm gốc */}
                    <div className="p-4 flex flex-col" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center font-bold rounded-full" style={{ width: 22, height: 22, fontSize: 11, background: 'var(--color-accent)', color: '#fff' }}>2</span>
                        <p className="font-semibold uppercase" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                          Sản phẩm gốc
                        </p>
                      </div>
                      <div
                        {...makeDropHandlers('ecom-product', (source) => replaceEcomProductImages([source]))}
                        className="w-full aspect-square flex items-center justify-center cursor-pointer overflow-hidden transition-colors relative group"
                        style={{
                          background: dragOverId === 'ecom-product' ? 'var(--color-accent-soft)' : 'var(--color-card)',
                          border: `2px dashed ${dragOverId === 'ecom-product' || ecomProductImage ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          borderRadius: 12,
                        }}
                        onClick={() => {
                          setPasteTargetId('ecom-product');
                          if (ecomFileInputRef.current) ecomFileInputRef.current.click();
                        }}
                      >
                        {ecomProductImage ? (
                          <>
                            <img src={ecomProductImage} alt="Product" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                              <span className="text-white font-bold text-xs">Thay đổi ảnh sản phẩm</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
                            <Upload size={28} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>Click để tải ảnh sản phẩm</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Col 3 — Loại template + Prompt */}
                    <div className="p-4 flex flex-col gap-4" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <span className="inline-flex items-center justify-center font-bold rounded-full" style={{ width: 22, height: 22, fontSize: 11, background: 'var(--color-accent)', color: '#fff' }}>3</span>
                          <p className="font-semibold uppercase" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                            Loại template
                          </p>
                        </div>
                        <Segmented<'amazon' | 'taobao'>
                          value={clonePromptType}
                          onChange={(v) => setClonePromptType(v)}
                          size="md"
                          fullWidth
                          options={[
                            { value: 'amazon', label: 'Amazon A+' },
                            { value: 'taobao', label: 'Taobao' },
                          ]}
                        />
                      </div>

                      {isAdmin && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="uppercase font-semibold flex items-center gap-1.5" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                              Prompt {clonePromptType === 'amazon' ? 'Amazon' : 'Taobao'} (admin)
                              {clonePromptsSynced[clonePromptType] && <CheckCircle2 size={11} style={{ color: 'var(--color-success)' }} />}
                            </p>
                            <div className="flex items-center gap-2">
                              <button onClick={syncClonePrompt} className="flex items-center gap-1 font-bold" style={{ fontSize: 9, color: 'var(--color-accent)' }} title="Đồng bộ prompt này cho mọi người dùng">
                                <Globe size={10} /> ĐỒNG BỘ
                              </button>
                              <button onClick={() => setClonePrompts(prev => ({ ...prev, [clonePromptType]: DEFAULT_CLONE_PROMPTS[clonePromptType] }))} className="font-bold" style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }} title="Khôi phục prompt mặc định">
                                ↺ MẶC ĐỊNH
                              </button>
                            </div>
                          </div>
                          <textarea
                            value={clonePrompts[clonePromptType]}
                            onChange={(e) => {
                              setClonePrompts(prev => ({ ...prev, [clonePromptType]: e.target.value }));
                              setClonePromptsSynced(prev => ({ ...prev, [clonePromptType]: false }));
                            }}
                            className="w-full h-16 outline-none transition-colors p-3 resize-none"
                            style={{ background: 'var(--color-fill)', color: 'var(--color-text)', borderRadius: 12, border: '0.5px solid transparent', fontSize: 12 }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                          />
                        </div>
                      )}

                      {/* Prompt thủ công */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="uppercase font-semibold" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                            Prompt
                          </p>
                          <button
                            onClick={() => {
                              setCloneManualMode((v) => {
                                const next = !v;
                                if (next) setEcomPromptText('');
                                return next;
                              });
                            }}
                            className="flex items-center gap-1 font-semibold transition-opacity hover:opacity-80"
                            style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.04em' }}
                          >
                            <Edit2 size={12} />
                            {cloneManualMode ? 'DÙNG TEMPLATE' : 'NHẬP THỦ CÔNG'}
                          </button>
                        </div>
                        {cloneManualMode ? (
                          <>
                            <textarea
                              value={ecomPromptText}
                              onChange={(e) => setEcomPromptText(e.target.value)}
                              placeholder="Nhập prompt riêng của bạn để tạo template (thay thế prompt mặc định)…"
                              className="w-full h-24 outline-none transition-colors p-3 resize-none"
                              style={{ background: 'var(--color-fill)', color: 'var(--color-text)', borderRadius: 12, border: '0.5px solid transparent', fontSize: 13, letterSpacing: '-0.01em' }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                              onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                            />
                            <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
                              Đang dùng prompt thủ công — bỏ qua template {clonePromptType === 'amazon' ? 'Amazon' : 'Taobao'}.
                            </p>
                          </>
                        ) : (
                          <div className="rounded-lg px-3 py-2.5 flex items-center gap-2" style={{ background: 'var(--color-accent-soft)', border: '0.5px solid var(--color-accent)' }}>
                            <CheckCircle2 size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                            <p className="font-bold" style={{ fontSize: 12, color: 'var(--color-accent)' }}>
                              Dùng template {clonePromptType === 'amazon' ? 'Amazon' : 'Taobao'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* CTA */}
                      <div className="mt-auto pt-2">
                        <Button
                          variant="filled"
                          size="lg"
                          fullWidth
                          icon={isEcomGenerating ? Loader2 : Copy}
                          onClick={handleEcomGenerate}
                          disabled={!ecomProductImage || !ecomTemplateImage || isEcomGenerating}
                        >
                          {isEcomGenerating ? 'Đang xử lý…' : 'Clone template này'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {globalError && (
                    <div className="p-3 rounded-lg flex items-start gap-3" style={{ background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', border: '0.5px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)', fontSize: 12 }}>
                      <p>{globalError}</p>
                    </div>
                  )}
                </div>
              ) : ecomSubTab === 'pattern-replace' ? (
                <div className="flex flex-col gap-6">
                  {/* Title bar */}
                  <div>
                    <h2 className="font-bold" style={{ fontSize: 24, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                      Thay hoạ tiết
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      Lấy pattern từ ảnh, đắp lên giường/mockup giữ nguyên ánh sáng & nếp gấp.
                    </p>
                  </div>

                  {/* Settings — compact one-row dropdowns */}
                  <div className="p-3 flex gap-2 items-start" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                    {(() => {
                      const modelOpts: SettingsDropdownOption<ModelType>[] = IMAGE_MODEL_KEYS.map((m) => ({
                        value: m, label: MODEL_CONFIG[m].name, icon: <ModelLogo model={m} />,
                      }));
                      const availableSizes: string[] = ecomModel === 'gpt2'
                        ? (ecomAspectRatio === '1:1' ? ['1k', '2k']
                          : ecomAspectRatio === '9:16' ? ['1k', '2k', '4k']
                          : ['1k'])
                        : ['1k', '2k', '4k'];
                      const arOpts: SettingsDropdownOption<string>[] = ['1:1', '3:4', '4:3', '9:16', '16:9'].map((a) => ({ value: a, label: a }));
                      const sizeOpts: SettingsDropdownOption<string>[] = ['1k', '2k', '4k'].map((s) => ({
                        value: s, label: s.toUpperCase(), disabled: !availableSizes.includes(s),
                      }));
                      const countOpts: SettingsDropdownOption<number>[] = [1, 2, 3].map((c) => ({ value: c, label: String(c) }));
                      return (
                        <>
                          <SettingsDropdown<ModelType>
                            value={ecomModel}
                            onChange={(v) => setEcomModel(v)}
                            options={modelOpts}
                            width="fill"
                          />
                          <SettingsDropdown<string>
                            value={ecomAspectRatio}
                            onChange={(v) => setEcomAspectRatio(v)}
                            options={arOpts}
                          />
                          <SettingsDropdown<string>
                            value={ecomImageSize}
                            onChange={(v) => setEcomImageSize(v)}
                            options={sizeOpts}
                          />
                          <SettingsDropdown<number>
                            value={ecomImageCount}
                            onChange={(v) => setEcomImageCount(v)}
                            options={countOpts}
                          />
                          <CreditEstimate
                            compact
                            credits={estimateGenerationCredits({
                              modelId: MODEL_CONFIG[ecomModel].id,
                              size: ecomImageSize,
                              count: ecomImageCount,
                            })}
                          />
                        </>
                      );
                    })()}
                  </div>

                  {/* 3-column grid: Source / Generated / Mockup */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Col 1 — Source pattern */}
                    <div className="p-4 flex flex-col" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center font-bold rounded-full" style={{ width: 22, height: 22, fontSize: 11, background: 'var(--color-accent)', color: '#fff' }}>1</span>
                        <p className="font-semibold uppercase" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                          Ảnh nguồn pattern
                        </p>
                      </div>
                      <div
                        {...makeDropHandlers('pattern-source', (s) => { setPatternSourceImage(s); setGeneratedPattern(null); })}
                        className="w-full aspect-square flex items-center justify-center cursor-pointer overflow-hidden transition-colors relative group"
                        style={{
                          background: dragOverId === 'pattern-source' ? 'var(--color-accent-soft)' : 'var(--color-card)',
                          border: `2px dashed ${dragOverId === 'pattern-source' || patternSourceImage ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          borderRadius: 12,
                        }}
                        onClick={() => {
                          setPasteTargetId('pattern-source');
                          if (patternSourceFileInputRef.current) patternSourceFileInputRef.current.click();
                        }}
                      >
                        {patternSourceImage ? (
                          <>
                            <img src={patternSourceImage} alt="Pattern Source" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                              <button onClick={(e) => { e.stopPropagation(); setIsPatternCropModalOpen(true); }} className="p-3 text-white rounded-md transition-colors" style={{ background: 'rgba(0,0,0,0.6)' }} title="Cắt ảnh"><Crop size={20} /></button>
                              <button onClick={(e) => { e.stopPropagation(); setPatternSourceImage(null); setGeneratedPattern(null); if (patternSourceFileInputRef.current) patternSourceFileInputRef.current.value = ''; }} className="p-3 text-white rounded-md transition-colors" style={{ background: 'rgba(0,0,0,0.6)' }} title="Xóa ảnh"><Trash2 size={20} /></button>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
                            <Upload size={28} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>Tải ảnh hoa văn tham khảo</span>
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                        AI sẽ trích xuất hoạ tiết & lặp seamless.
                      </p>
                    </div>

                    {/* Col 2 — Generated pattern */}
                    <div className="p-4 flex flex-col" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center font-bold rounded-full" style={{ width: 22, height: 22, fontSize: 11, background: 'var(--color-accent)', color: '#fff' }}>2</span>
                          <p className="font-semibold uppercase" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                            Pattern đã tạo
                          </p>
                        </div>
                        {generatedPattern && (
                          <span className="inline-flex items-center font-semibold rounded-full" style={{ padding: '3px 9px', fontSize: 11, background: 'color-mix(in srgb, var(--color-success) 16%, transparent)', color: 'var(--color-success)' }}>
                            <CheckCircle2 size={11} style={{ marginRight: 4 }} /> Sẵn sàng
                          </span>
                        )}
                      </div>
                      <div className="w-full aspect-square flex items-center justify-center overflow-hidden relative" style={{ background: 'var(--color-card)', border: generatedPattern ? '0.5px solid var(--color-border-soft)' : `2px dashed var(--color-border)`, borderRadius: 12 }}>
                        {generatedPattern ? (
                          <img src={generatedPattern} alt="Generated Pattern" className="w-full h-full object-cover" />
                        ) : isGeneratingPattern ? (
                          <div className="flex flex-col items-center gap-3" style={{ color: 'var(--color-accent)' }}>
                            <Loader2 className="animate-spin" size={28} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>Đang tạo pattern…</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
                            <Wand2 size={28} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>Pattern sẽ hiện ở đây</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        <Button
                          variant={generatedPattern ? 'secondary' : 'filled'}
                          size="md"
                          fullWidth
                          icon={isGeneratingPattern ? Loader2 : (generatedPattern ? RotateCcw : Wand2)}
                          onClick={handleEcomGeneratePattern}
                          disabled={!patternSourceImage || isGeneratingPattern}
                        >
                          {isGeneratingPattern
                            ? 'Đang tạo pattern…'
                            : generatedPattern
                              ? 'Tạo pattern khác'
                              : 'Tạo pattern 2D'}
                        </Button>
                        <div className="mt-2 flex justify-end">
                          <CreditEstimate compact credits={estimateGenerationCredits({ modelId: MODEL_CONFIG[ecomModel].id, size: '1k', count: 1 })} />
                        </div>
                      </div>
                    </div>

                    {/* Col 3 — Mockup */}
                    <div className={`p-4 flex flex-col transition-opacity duration-300 ${!generatedPattern ? 'opacity-50 pointer-events-none' : ''}`} style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center font-bold rounded-full" style={{ width: 22, height: 22, fontSize: 11, background: 'var(--color-accent)', color: '#fff' }}>3</span>
                        <p className="font-semibold uppercase" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                          Mockup sản phẩm
                        </p>
                      </div>
                      <div
                        {...makeDropHandlers('pattern-mockup', setPatternMockupImage)}
                        className="w-full aspect-square flex items-center justify-center cursor-pointer overflow-hidden transition-colors relative group"
                        style={{
                          background: dragOverId === 'pattern-mockup' ? 'var(--color-accent-soft)' : 'var(--color-card)',
                          border: `2px dashed ${dragOverId === 'pattern-mockup' || patternMockupImage ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          borderRadius: 12,
                        }}
                        onClick={() => {
                          setPasteTargetId('pattern-mockup');
                          if (patternMockupFileInputRef.current) patternMockupFileInputRef.current.click();
                        }}
                      >
                        {patternMockupImage ? (
                          <>
                            <img src={patternMockupImage} alt="Product Mockup" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                              <span className="text-white font-bold text-xs">Thay đổi ảnh sản phẩm</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
                            <Upload size={28} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>Tải ảnh sản phẩm (mockup)</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        <Button
                          variant="filled"
                          size="md"
                          fullWidth
                          icon={isEcomGenerating ? Loader2 : Shirt}
                          onClick={handleEcomApplyPattern}
                          disabled={!patternMockupImage || !generatedPattern || isEcomGenerating}
                        >
                          {isEcomGenerating ? 'Đang áp dụng…' : 'Áp pattern lên mockup'}
                        </Button>
                        <div className="mt-2 flex justify-end">
                          <CreditEstimate compact credits={estimateGenerationCredits({ modelId: MODEL_CONFIG[ecomModel].id, size: ecomImageSize, count: ecomImageCount })} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Results section: Mockup mới */}
                  {(isEcomGenerating || ecomResults.length > 0) && (
                    <div className="p-6" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
                      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
                        <div>
                          <p className="uppercase font-semibold mb-1" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                            Kết quả
                          </p>
                          <h2 className="font-bold" style={{ fontSize: 22, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                            Mockup mới
                          </h2>
                        </div>
                        {ecomResults.length > 0 && (
                          <span className="inline-flex items-center font-semibold rounded-full" style={{ padding: '4px 10px', fontSize: 11, background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
                            <Sparkles size={11} style={{ marginRight: 4 }} /> Vừa tạo
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {isEcomGenerating
                          ? Array.from({ length: ecomImageCount }).map((_, i) => (
                              <div key={i} className="relative aspect-square flex flex-col items-center justify-center gap-3" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '0.5px solid var(--color-border-soft)' }}>
                                <Loader2 className="animate-spin" size={28} style={{ color: 'var(--color-accent)' }} />
                                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Đang tạo ảnh {i + 1}…</p>
                              </div>
                            ))
                          : ecomResults.map((res, i) => (
                              <div key={i} className="relative group aspect-square overflow-hidden" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
                                <img src={res} alt={`Result ${i+1}`} className="w-full h-full object-cover" />
                                <span className="absolute top-2 left-2 font-semibold rounded-full" style={{ padding: '3px 9px', fontSize: 11, background: 'var(--color-card)', color: 'var(--color-text-secondary)', border: '0.5px solid var(--color-border-soft)', letterSpacing: '-0.01em' }}>
                                  output_{i+1}.png
                                </span>
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                                  <button onClick={() => setZoomImage(res)} className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }} title="Phóng to"><ZoomIn size={18} /></button>
                                  <button onClick={() => { const a = document.createElement('a'); a.href = res; a.download = `pattern-mockup-${Date.now()}-${i+1}.png`; a.click(); }} className="p-2 rounded-lg" style={{ background: 'var(--color-accent)', color: '#fff' }} title="Tải về"><Download size={18} /></button>
                                </div>
                              </div>
                            ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : ecomSubTab === 'thay' ? (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
                    <h3 className="font-bold" style={{ fontSize: 17, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>Cấu hình Thay Đồ</h3>
                  </div>

                  {/* Model — 4 cards in one row, compact */}
                  <div>
                    <p className="uppercase font-semibold mb-2" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Chọn mô hình AI</p>
                    <ModelCardPicker<ModelType>
                      value={ecomThayModel}
                      onChange={(m) => setEcomThayModel(m)}
                      columns={4}
                      size="sm"
                      options={IMAGE_MODEL_KEYS.map((m) => ({
                        value: m,
                        name: MODEL_CONFIG[m].name,
                        sub: MODEL_CONFIG[m].requiredKey === 'google' ? 'Google' : 'Kie.ai',
                        best: m === 'banana-pro',
                      }))}
                    />
                  </div>

                  {/* Aspect ratio + Quality + Count — three equal-width dropdowns, centered row */}
                  <div className="p-3 flex gap-2 items-stretch justify-center" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                    <SettingsDropdown<string>
                      value={ecomThayAspectRatio}
                      onChange={(v) => setEcomThayAspectRatio(v)}
                      options={['1:1', '3:4', '4:3', '9:16', '16:9', '4:5'].map((a) => ({ value: a, label: a }))}
                      width="fill"
                    />
                    <SettingsDropdown<'1k' | '2k' | '4k'>
                      value={ecomThayQuality}
                      onChange={(v) => setEcomThayQuality(v)}
                      options={(['1k', '2k', '4k'] as const).map((s) => ({ value: s, label: s.toUpperCase() }))}
                      width="fill"
                    />
                    <SettingsDropdown<number>
                      value={ecomThayCount}
                      onChange={(v) => setEcomThayCount(v)}
                      options={[1, 2, 3].map((c) => ({ value: c, label: `${c} ảnh` }))}
                      width="fill"
                    />
                    <CreditEstimate
                      compact
                      credits={estimateGenerationCredits({
                        modelId: MODEL_CONFIG[ecomThayModel].id,
                        size: ecomThayQuality,
                        count: ecomThayCount,
                      })}
                    />
                  </div>

                  {/* Saved prompts — full gen-new style */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="uppercase font-semibold" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Danh sách đã lưu</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setThayManualMode(true); setSelectedEcomThayPromptId(null); setEcomThayPrompt(''); }}
                          className="flex items-center gap-1 font-semibold hover:opacity-80 transition-opacity"
                          style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.04em' }}
                        >
                          <Edit2 size={12} /> THỦ CÔNG
                        </button>
                        <button
                          onClick={() => {
                            setNewThayPromptName('');
                            setNewThayPromptText(ecomThayPrompt);
                            setEditingThayPromptId(null);
                            setIsAddingThayPrompt(true);
                          }}
                          className="flex items-center gap-1 font-semibold hover:opacity-80 transition-opacity"
                          style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.04em' }}
                        >
                          <Plus size={12} /> THÊM
                        </button>
                      </div>
                    </div>

                    {isAddingThayPrompt ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl space-y-3 mb-2"
                        style={{ background: 'var(--color-accent-soft)', border: '0.5px solid var(--color-accent)' }}
                      >
                        <input
                          type="text"
                          placeholder="Tên prompt..."
                          value={newThayPromptName}
                          onChange={(e) => setNewThayPromptName(e.target.value)}
                          className="w-full outline-none p-2.5"
                          style={{ background: 'var(--color-card)', color: 'var(--color-text)', borderRadius: 10, fontSize: 12, border: '0.5px solid var(--color-border-soft)' }}
                        />
                        <textarea
                          placeholder="Nội dung prompt chi tiết..."
                          value={newThayPromptText}
                          onChange={(e) => setNewThayPromptText(e.target.value)}
                          className="w-full outline-none p-2.5 min-h-[80px] resize-none"
                          style={{ background: 'var(--color-card)', color: 'var(--color-text)', borderRadius: 10, fontSize: 12, border: '0.5px solid var(--color-border-soft)' }}
                        />
                        <div className="flex gap-2">
                          <Button variant="filled" size="sm" fullWidth onClick={handleAddThayPrompt}>
                            {editingThayPromptId ? 'Cập nhật' : 'Lưu prompt'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setIsAddingThayPrompt(false);
                              setEditingThayPromptId(null);
                              setNewThayPromptName('');
                              setNewThayPromptText('');
                            }}
                          >
                            Hủy
                          </Button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="space-y-1" style={showThayPromptAll ? { maxHeight: 200, overflowY: 'auto' } : undefined}>
                        {thayManualMode && (
                          <PromptRow name="📝 Nhập thủ công" active onClick={() => {}} showEdit={false} showDelete={false} />
                        )}
                        {(showThayPromptAll ? ecomThaySavedPrompts : ecomThaySavedPrompts.slice(0, 3)).map((p) => (
                          <PromptRow
                            key={p.id}
                            name={p.name}
                            active={!thayManualMode && selectedEcomThayPromptId === p.id}
                            synced={p.isDefault}
                            onClick={() => { setSelectedEcomThayPromptId(p.id); setEcomThayPrompt(p.prompt || ''); setThayManualMode(false); }}
                            showSync={isAdmin}
                            onSync={(e) => toggleSyncEcomPrompt(p, e)}
                            showEdit={isAdmin || !p.isDefault}
                            showDelete={isAdmin || !p.isDefault}
                            onEdit={(e) => startEditThayPrompt(p, e)}
                            onDelete={(e) => deleteEcomPrompt(p.id, e)}
                          />
                        ))}
                        {ecomThaySavedPrompts.length === 0 && !thayManualMode && (
                          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Chưa có prompt mẫu. Bấm "THÊM" để tạo, hoặc "THỦ CÔNG" để nhập trực tiếp.</p>
                        )}
                        {ecomThaySavedPrompts.length > 3 && (
                          <button
                            onClick={() => setShowThayPromptAll((v) => !v)}
                            className="w-full flex items-center justify-center gap-1.5 transition-colors mt-1"
                            style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--color-accent)', background: 'var(--color-fill)', borderRadius: 10 }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-soft)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-fill)')}
                          >
                            {showThayPromptAll ? 'Thu gọn' : `Xem tất cả (${ecomThaySavedPrompts.length})`}
                            <ChevronRight size={14} style={{ transform: showThayPromptAll ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Nội dung prompt hiện tại / thủ công */}
                  {(isAdmin || thayManualMode) && <div>
                    <p className="uppercase font-semibold mb-2" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                      {thayManualMode ? 'Nhập Prompt mới' : 'Nội dung Prompt hiện tại'}
                    </p>
                    <textarea
                      value={ecomThayPrompt}
                      onChange={(e) => { setEcomThayPrompt(e.target.value); if (!thayManualMode) setThayManualMode(true); }}
                      placeholder="Mô tả cách thay thế…"
                      className="w-full h-32 outline-none transition-colors p-3 resize-none"
                      style={{ background: 'var(--color-fill)', color: 'var(--color-text)', borderRadius: 12, border: '0.5px solid transparent', fontSize: 13, letterSpacing: '-0.01em' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                    />
                  </div>}
                  {!isAdmin && !thayManualMode && selectedEcomThayPromptId && (
                    <div className="rounded-lg px-4 py-3 flex items-center gap-2" style={{ background: 'var(--color-accent-soft)', border: '0.5px solid var(--color-accent)' }}>
                      <CheckCircle2 size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                      <p className="font-bold" style={{ fontSize: 12, color: 'var(--color-accent)' }}>
                        {selectedEcomThaySavedPrompt?.name || 'Prompt đã lưu'} — sẵn sàng Thay
                      </p>
                    </div>
                  )}

                  <Button
                    variant="filled"
                    size="lg"
                    fullWidth
                    icon={isEcomThayGenerating ? Loader2 : Shirt}
                    onClick={handleEcomThay}
                    disabled={!ecomThayModelImage || !ecomThayProductImage || isEcomThayGenerating}
                  >
                    {isEcomThayGenerating ? 'Đang xử lý…' : 'Bắt đầu Thay'}
                  </Button>

                  {(!ecomThayModelImage || !ecomThayProductImage) && (
                    <p className="text-center" style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                      👉 Tải ảnh Giường Đích & Chăn Ga ở khu vực bên phải
                    </p>
                  )}
                </div>
              ) : ecomSubTab === 'ghep-anh' ? (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
                    <h3 className="font-bold" style={{ fontSize: 17, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>Cấu hình Ghép ảnh</h3>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    Tải 2-5 ảnh (mỗi ảnh 1 người/vật) ở khu vực bên phải → AI ghép thành 1 ảnh chung.
                  </p>

                  {/* Settings — compact one-row dropdowns (Model fill, AR/Quality/Số ảnh auto) */}
                  <div className="p-3 flex gap-2 items-start" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                    {(() => {
                      const modelOpts: SettingsDropdownOption<'gpt2' | 'banana-pro'>[] = [
                        { value: 'banana-pro', label: MODEL_CONFIG['banana-pro'].name, icon: <ModelLogo model="banana-pro" /> },
                        { value: 'gpt2', label: MODEL_CONFIG['gpt2'].name, icon: <ModelLogo model="gpt2" /> },
                      ];
                      const arOpts: SettingsDropdownOption<string>[] = ['1:1', '3:4', '4:3', '9:16', '16:9'].map((a) => ({ value: a, label: a }));
                      const sizeOpts: SettingsDropdownOption<string>[] = ['1k', '2k', '4k'].map((s) => ({ value: s, label: s.toUpperCase() }));
                      const countOpts: SettingsDropdownOption<number>[] = [1, 2].map((c) => ({ value: c, label: String(c) }));
                      return (
                        <>
                          <SettingsDropdown<'gpt2' | 'banana-pro'>
                            value={composeModel}
                            onChange={(v) => setComposeModel(v)}
                            options={modelOpts}
                            width="fill"
                          />
                          <SettingsDropdown<string>
                            value={composeAspectRatio}
                            onChange={(v) => setComposeAspectRatio(v)}
                            options={arOpts}
                          />
                          <SettingsDropdown<string>
                            value={composeQuality}
                            onChange={(v) => setComposeQuality(v)}
                            options={sizeOpts}
                          />
                          <SettingsDropdown<number>
                            value={composeCount}
                            onChange={(v) => setComposeCount(v)}
                            options={countOpts}
                          />
                          <CreditEstimate
                            compact
                            credits={estimateGenerationCredits({
                              modelId: MODEL_CONFIG[composeModel].id,
                              size: composeQuality,
                              count: composeCount,
                            })}
                          />
                        </>
                      );
                    })()}
                  </div>

                  {/* Prompt */}
                  <div>
                    <p className="uppercase font-semibold mb-2" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Nội dung Prompt</p>
                    <textarea
                      value={composePrompt}
                      onChange={(e) => setComposePrompt(e.target.value)}
                      placeholder="Mô tả cách ghép các ảnh…"
                      className="w-full h-32 outline-none transition-colors p-3 resize-none"
                      style={{ background: 'var(--color-fill)', color: 'var(--color-text)', borderRadius: 12, border: '0.5px solid transparent', fontSize: 13, letterSpacing: '-0.01em' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                    />
                  </div>

                  <Button
                    variant="filled"
                    size="lg"
                    fullWidth
                    icon={isComposing ? Loader2 : Sparkles}
                    onClick={handleEcomCompose}
                    disabled={composeImages.filter(Boolean).length < 2 || isComposing}
                  >
                    {isComposing ? 'Đang ghép…' : 'Bắt đầu Ghép'}
                  </Button>

                  {composeImages.filter(Boolean).length < 2 && (
                    <p className="text-center" style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                      👉 Cần ít nhất 2 ảnh. Tải ảnh ở khu vực bên phải.
                    </p>
                  )}
                </div>
              ) : (
                <div className="gen-new-composer-content flex flex-col gap-3">
                {/* Settings — compact one-row dropdowns (per design handoff) */}
                <div className="gen-new-toolbar flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center font-bold rounded-full" style={{ width: 20, height: 20, fontSize: 11, background: 'var(--color-accent)', color: '#fff' }}>3</span>
                    <p className="font-semibold uppercase" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Cài đặt</p>
                  </div>
                  {isEcomGenerationTab(ecomSubTab) && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEcomT2IMode((v) => !v)}
                        className="flex items-center gap-2 px-2.5 py-1 rounded-full transition-all"
                        style={{
                          background: ecomT2IMode ? 'var(--color-accent-soft)' : 'var(--color-fill)',
                          border: ecomT2IMode ? '1px solid var(--color-accent)' : '1px solid transparent',
                          color: ecomT2IMode ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                        }}
                        title={ecomT2IMode
                          ? `Tắt chế độ Text-to-${isVideoModelKey(ecomModel) ? 'Video' : 'Image'} (dùng ảnh tham chiếu)`
                          : `Bật chế độ Text-to-${isVideoModelKey(ecomModel) ? 'Video' : 'Image'} (chỉ cần prompt)`}
                      >
                        <span
                          className="inline-block rounded-full transition-all"
                          style={{
                            width: 7,
                            height: 7,
                            background: ecomT2IMode ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                          }}
                        />
                        {ecomT2IMode
                          ? (isVideoModelKey(ecomModel) ? 'TEXT‑TO‑VIDEO' : 'TEXT‑TO‑IMAGE')
                          : (isVideoModelKey(ecomModel) ? 'IMAGE‑TO‑VIDEO' : 'IMAGE‑TO‑IMAGE')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEcomComposerExpanded((value) => !value)}
                        className="gen-new-expand flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors"
                        title={ecomComposerExpanded ? 'Thu gọn thanh tạo ảnh' : 'Mở prompt đã lưu và cài đặt nâng cao'}
                      >
                        {ecomComposerExpanded ? 'Thu gọn' : 'Mở rộng'}
                        <ChevronRight size={12} style={{ transform: ecomComposerExpanded ? 'rotate(90deg)' : 'none' }} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="gen-new-settings p-3 flex gap-2 items-start" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                  {(() => {
                    const promptOptions: SettingsDropdownOption<string>[] = [
                      { value: 'manual', label: 'Prompt thủ công' },
                      ...ecomSavedPrompts.map((prompt) => ({ value: prompt.id, label: prompt.name })),
                    ];
                    const modelKeys = ecomSubTab === 'gen-video' ? VIDEO_MODEL_KEYS : IMAGE_MODEL_KEYS;
                    const modelOptions: SettingsDropdownOption<ModelType>[] = modelKeys.map((m) => ({
                      value: m,
                      label: MODEL_CONFIG[m].name,
                      icon: <ModelLogo model={m} />,
                    }));
                    const videoModel = isVideoModelKey(ecomModel);
                    const availableSizes: string[] = ecomModel === 'google-omni'
                      ? ['720p', '1080p', '4k']
                      : ecomModel === 'seedance-2-5'
                        ? ['480p', '720p']
                        : ecomModel === 'gpt2'
                      ? (ecomAspectRatio === 'auto' ? ['1k']
                        : ecomAspectRatio === '5:4' || ecomAspectRatio === '4:5' ? ['1k']
                        : ecomAspectRatio === '1:1' ? ['1k', '2k']
                        : ['1k', '2k', '4k'])
                      : ['1k', '2k', '4k'];
                    const allSizes = videoModel ? ['480p', '720p', '1080p', '4k'] : ['1k', '2k', '4k'];
                    const sizeOptions: SettingsDropdownOption<string>[] = allSizes.map((s) => ({
                      value: s,
                      label: s.toUpperCase(),
                      disabled: !availableSizes.includes(s),
                    }));
                    const supportedAspectRatios = MODEL_ASPECT_RATIOS[ecomModel];
                    const arOptions: SettingsDropdownOption<string>[] = ALL_ASPECT_RATIOS.map((a) => ({
                      value: a,
                      label: a === 'auto' ? 'Tự động' : a,
                      disabled: !supportedAspectRatios.includes(a),
                    }));
                    const countOptions: SettingsDropdownOption<number>[] = [1, 2, 3].map((c) => ({
                      value: c,
                      label: String(c),
                    }));
                    const durationOptions: SettingsDropdownOption<number>[] = (ecomModel === 'google-omni'
                      ? [4, 6, 8, 10]
                      : [4, 6, 8, 10, 15, 20, 30]
                    ).map((duration) => ({ value: duration, label: String(duration) }));
                    const estimatedCredits = estimateGenerationCredits({
                      modelId: MODEL_CONFIG[ecomModel].id,
                      size: ecomImageSize,
                      count: videoModel ? 1 : ecomImageCount,
                      mediaType: videoModel ? 'video' : 'image',
                      duration: ecomVideoDuration,
                      generateAudio: videoModel && ecomModel === 'seedance-2-5' && ecomVideoGenerateAudio,
                    });
                    return (
                      <>
                        <SettingsDropdown<string>
                          value={selectedEcomPromptId}
                          onChange={(promptId) => {
                            setSelectedEcomPromptId(promptId);
                            if (promptId === 'manual') {
                              setEcomPromptText('');
                              return;
                            }
                            const selectedPrompt = ecomSavedPrompts.find((prompt) => prompt.id === promptId);
                            setEcomPromptText(selectedPrompt?.prompt || '');
                          }}
                          options={promptOptions}
                          width="fill"
                          placement="top"
                        />
                        <SettingsDropdown<ModelType>
                          value={ecomModel}
                          onChange={(v) => {
                            setEcomModel(v);
                            if (isVideoModelKey(v)) setEcomImageCount(1);
                          }}
                          options={modelOptions}
                          width="fill"
                          placement="top"
                        />
                        <GenerationSettingsPopover
                          mediaType={videoModel ? 'video' : 'image'}
                          aspectRatio={ecomAspectRatio}
                          aspectRatios={arOptions}
                          onAspectRatioChange={setEcomAspectRatio}
                          imageSize={ecomImageSize}
                          imageSizes={sizeOptions}
                          onImageSizeChange={setEcomImageSize}
                          imageCount={ecomImageCount}
                          imageCounts={countOptions}
                          onImageCountChange={setEcomImageCount}
                          duration={ecomVideoDuration}
                          durations={durationOptions}
                          onDurationChange={setEcomVideoDuration}
                          generateAudio={ecomVideoGenerateAudio}
                          onGenerateAudioChange={setEcomVideoGenerateAudio}
                          supportsAudio={ecomModel === 'seedance-2-5'}
                          estimatedCredits={estimatedCredits}
                          placement="top"
                        />
                      </>
                    );
                  })()}
                  {(() => {
                    const runningBatches = ecomBatches.filter((batch) => batch.status === 'running').length;
                    const t2iReady = ecomT2IMode && Boolean(ecomPromptText.trim() || ecomSupplementaryPrompt.trim() || ecomUsesSecretPrompt);
                    const i2iReady = !ecomT2IMode && ecomProductImages.length > 0;
                    const ready = t2iReady || i2iReady;
                    return (
                      <button
                        type="button"
                        onClick={handleEcomGenerate}
                        disabled={!ready}
                        className="gen-new-submit shrink-0 inline-flex items-center justify-center rounded-xl transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                        aria-label={runningBatches > 0 ? `Gen thêm batch, đang chạy ${runningBatches}` : `Bắt đầu tạo ${isVideoModelKey(ecomModel) ? 'video' : 'ảnh'}`}
                        title={runningBatches > 0
                          ? `Gen thêm batch · đang chạy ${runningBatches}`
                          : ecomT2IMode
                            ? `Gen ${isVideoModelKey(ecomModel) ? 'video' : 'ảnh'} từ prompt`
                            : `Gen ${isVideoModelKey(ecomModel) ? 'video' : 'ảnh'} từ ảnh tham chiếu`}
                      >
                        {runningBatches > 0 ? <span className="text-xs font-bold">+{runningBatches}</span> : <Sparkles size={18} />}
                      </button>
                    );
                  })()}
                </div>

                <div className="gen-new-input-grid grid grid-cols-1 gap-3">
                  {/* Col 1 — Ảnh sản phẩm (hidden in T2I mode) */}
                  {!ecomT2IMode && (
                    <div className="gen-new-reference-card p-3 flex flex-col" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center font-bold rounded-full" style={{ width: 20, height: 20, fontSize: 11, background: 'var(--color-accent)', color: '#fff' }}>1</span>
                        <p className="font-semibold uppercase" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                          {isVideoModelKey(ecomModel) ? 'Ảnh tham chiếu' : 'Ảnh sản phẩm'}
                        </p>
                      </div>
                      <div
                        className="gen-new-reference-drop w-full flex items-center transition-colors relative"
                        style={{
                          background: dragOverId === 'ecom-product-stack' ? 'var(--color-accent-soft)' : 'var(--color-card)',
                          border: `1px solid ${dragOverId === 'ecom-product-stack' || ecomProductImages.length > 0 ? 'var(--color-accent-muted)' : 'var(--color-border)'}`,
                          borderRadius: 12,
                        }}
                        onDragEnter={(event) => { event.preventDefault(); event.stopPropagation(); setDragOverId('ecom-product-stack'); }}
                        onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }}
                        onDragLeave={(event) => { event.preventDefault(); event.stopPropagation(); setDragOverId(null); }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDragOverId(null);
                          processFiles(Array.from(event.dataTransfer.files || []));
                        }}
                      >
                        <div className="gen-new-reference-stack relative w-full h-full group/stack">
                          {ecomProductImages.map((source, index) => (
                            <div
                              key={`${source.slice(0, 40)}-${index}`}
                              className={`gen-new-stack-item absolute ${index === 0 ? 'is-primary' : ''}`}
                              style={{
                                '--stack-index': index,
                                '--stack-spread': `${index * 52}px`,
                                '--stack-tilt': `${index % 2 === 0 ? -5 + index * 2 : 4 - index}px`,
                                zIndex: index + 1,
                              } as React.CSSProperties}
                            >
                              <button
                                type="button"
                                onClick={() => setZoomImage(source)}
                                className="w-full h-full overflow-hidden rounded-md"
                                title={`Xem ảnh tham chiếu ${index + 1}`}
                              >
                                <img src={source} alt={`Ảnh tham chiếu ${index + 1}`} className="w-full h-full object-cover" />
                              </button>
                              <button
                                type="button"
                                onClick={() => replaceEcomProductImages(ecomProductImages.filter((_, imageIndex) => imageIndex !== index))}
                                className="gen-new-stack-remove absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white bg-black/70"
                                title="Xoá ảnh"
                                aria-label={`Xoá ảnh tham chiếu ${index + 1}`}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                          {ecomProductImages.length < 5 && (
                            <button
                              type="button"
                              onClick={() => ecomFileInputRef.current?.click()}
                              className={`gen-new-stack-item gen-new-stack-add absolute flex items-center justify-center ${ecomProductImages.length > 0 ? 'is-compact' : ''}`}
                              style={{
                                '--stack-index': ecomProductImages.length,
                                '--stack-spread': ecomProductImages.length > 0
                                  ? `${Math.max(0, ecomProductImages.length - 1) * 52}px`
                                  : '0px',
                                '--stack-tilt': '4deg',
                                zIndex: ecomProductImages.length + 1,
                              } as React.CSSProperties}
                              title="Thêm ảnh tham chiếu"
                              aria-label="Thêm ảnh tham chiếu"
                            >
                              <Plus size={ecomProductImages.length > 0 ? 15 : 18} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Col 2 — Prompt */}
                  <div className="gen-new-prompt-card p-3 flex flex-col" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                    <textarea
                      value={!isAdmin && ecomUsesSecretPrompt ? '' : ecomPromptText}
                      onChange={(event) => {
                        if (!isAdmin && ecomUsesSecretPrompt) return;
                        setEcomPromptText(event.target.value);
                        if (selectedEcomPromptId !== 'manual') setSelectedEcomPromptId('manual');
                      }}
                      readOnly={!isAdmin && ecomUsesSecretPrompt}
                      placeholder={!isAdmin && ecomUsesSecretPrompt ? (selectedEcomSavedPrompt?.name || 'Prompt đã lưu') : 'Kết hợp ảnh tham chiếu và mô tả điều bạn muốn tạo…'}
                      className="gen-new-compact-prompt w-full resize-none outline-none"
                    />
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-flex items-center justify-center font-bold rounded-full" style={{ width: 20, height: 20, fontSize: 11, background: 'var(--color-accent)', color: '#fff' }}>2</span>
                      <p className="font-semibold uppercase" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                        Prompt
                      </p>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <p className="uppercase font-semibold" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                        Danh sách đã lưu
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setSelectedEcomPromptId('manual'); setEcomPromptText(''); }}
                          className="flex items-center gap-1 font-semibold hover:opacity-80 transition-opacity"
                          style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.04em' }}
                        >
                          <Edit2 size={12} /> THỦ CÔNG
                        </button>
                        <button
                          onClick={() => {
                            if (!isAdmin) { setEcomPromptText(''); setNewEcomPromptName(''); }
                            setIsAddingEcomPrompt(true);
                          }}
                          className="flex items-center gap-1 font-semibold hover:opacity-80 transition-opacity"
                          style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.04em' }}
                        >
                          <Plus size={12} /> THÊM
                        </button>
                      </div>
                    </div>

                    {isAddingEcomPrompt ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl space-y-3 mb-4"
                        style={{ background: 'var(--color-accent-soft)', border: '0.5px solid var(--color-accent)' }}
                      >
                        <input
                          type="text"
                          placeholder="Tên prompt..."
                          value={newEcomPromptName}
                          onChange={(e) => setNewEcomPromptName(e.target.value)}
                          className="w-full outline-none p-2.5"
                          style={{ background: 'var(--color-card)', color: 'var(--color-text)', borderRadius: 10, fontSize: 12, border: '0.5px solid var(--color-border-soft)' }}
                        />
                        <textarea
                          placeholder="Nội dung prompt chi tiết..."
                          value={ecomPromptText}
                          onChange={(e) => setEcomPromptText(e.target.value)}
                          className="w-full outline-none p-2.5 min-h-[80px] resize-none"
                          style={{ background: 'var(--color-card)', color: 'var(--color-text)', borderRadius: 10, fontSize: 12, border: '0.5px solid var(--color-border-soft)' }}
                        />
                        <div className="flex gap-2">
                          <Button variant="filled" size="sm" fullWidth onClick={handleAddEcomPrompt}>
                            {editingEcomPromptId ? 'Cập nhật' : 'Lưu prompt'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setIsAddingEcomPrompt(false);
                              setEditingEcomPromptId(null);
                              setNewEcomPromptName('');
                              setEcomPromptText('');
                            }}
                          >
                            Hủy
                          </Button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="mb-4">
                        {selectedEcomPromptId === 'manual' && (
                          <div className="mb-2">
                            <PromptRow name="📝 Nhập thủ công" active onClick={() => {}} showEdit={false} showDelete={false} />
                          </div>
                        )}
                        {/* TOP 4 prompts as compact tile grid (2x2) */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {ecomSavedPrompts.slice(0, 4).map((p) => {
                            const active = selectedEcomPromptId === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => { setSelectedEcomPromptId(p.id); setEcomPromptText(p.prompt || ''); }}
                                title={p.name}
                                className="text-left transition-all"
                                style={{
                                  padding: '9px 11px',
                                  borderRadius: 10,
                                  background: active ? 'var(--color-accent-soft)' : 'var(--color-card)',
                                  border: active ? '1px solid var(--color-accent)' : '1px solid var(--color-border-soft)',
                                  color: active ? 'var(--color-accent)' : 'var(--color-text)',
                                  boxShadow: active ? 'none' : 'var(--sh-up-sm)',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer',
                                  minHeight: 36,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                {p.isDefault && <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--color-success)', flexShrink: 0 }} />}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Show "Xem tất cả" only when there are >4 prompts (rest exists) */}
                        {ecomSavedPrompts.length > 4 && (
                          <>
                            <button
                              onClick={() => setShowEcomPromptModal((v) => !v)}
                              className="w-full flex items-center justify-center gap-1.5 transition-colors mt-2"
                              style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--color-accent)', background: 'var(--color-fill)', borderRadius: 10, letterSpacing: '-0.01em' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-soft)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-fill)')}
                            >
                              {showEcomPromptModal ? 'Thu gọn' : `Xem tất cả (${ecomSavedPrompts.length})`}
                              <ChevronRight size={14} style={{ transform: showEcomPromptModal ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
                            </button>
                            {showEcomPromptModal && (
                              <div className="space-y-1 mt-2" style={{ maxHeight: 320, overflowY: 'auto' }}>
                                {ecomSavedPrompts.map((p, idx) => (
                                  <motion.div
                                    key={p.id}
                                    layout={draggedEcomPromptIndex === idx ? false : 'position'}
                                    transition={{ type: 'tween', duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = 'move';
                                      if (draggedEcomPromptIndex === null || draggedEcomPromptIndex === idx) return;
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const midY = rect.top + rect.height / 2;
                                      const movingDown = draggedEcomPromptIndex < idx;
                                      const crossed = movingDown ? e.clientY > midY : e.clientY < midY;
                                      if (!crossed) return;
                                      const from = draggedEcomPromptIndex;
                                      setEcomSavedPrompts((prev) => {
                                        if (from >= prev.length || idx >= prev.length) return prev;
                                        const next = [...prev];
                                        const [moved] = next.splice(from, 1);
                                        next.splice(idx, 0, moved);
                                        return next;
                                      });
                                      setDraggedEcomPromptIndex(idx);
                                    }}
                                    onDrop={(e) => { e.preventDefault(); setDraggedEcomPromptIndex(null); }}
                                    className="flex items-center gap-1"
                                    style={{ opacity: draggedEcomPromptIndex === idx ? 0.4 : 1 }}
                                  >
                                    <div
                                      draggable
                                      onDragStart={(e) => {
                                        setDraggedEcomPromptIndex(idx);
                                        e.dataTransfer.effectAllowed = 'move';
                                        try { e.dataTransfer.setData('text/plain', String(idx)); } catch {}
                                      }}
                                      onDragEnd={() => setDraggedEcomPromptIndex(null)}
                                      className="cursor-grab active:cursor-grabbing shrink-0 p-1 rounded hover:bg-black/5"
                                      style={{ color: 'var(--color-text-tertiary)' }}
                                      title="Kéo để sắp xếp lại"
                                      aria-label="Kéo để sắp xếp"
                                    >
                                      <GripVertical size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <PromptRow
                                        name={p.name}
                                        active={selectedEcomPromptId === p.id}
                                        synced={p.isDefault}
                                        pinned={idx < 4}
                                        onClick={() => { setSelectedEcomPromptId(p.id); setEcomPromptText(p.prompt || ''); }}
                                        showSync={isAdmin}
                                        onSync={(e) => toggleSyncEcomPrompt(p, e)}
                                        showEdit={isAdmin || !p.isDefault}
                                        showDelete={isAdmin || !p.isDefault}
                                        onEdit={(e) => startEditEcomPrompt(p, e)}
                                        onDelete={(e) => deleteEcomPrompt(p.id, e)}
                                      />
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {(isAdmin || selectedEcomPromptId === 'manual') && (
                      <>
                        <p className="uppercase font-semibold mb-2" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                          {selectedEcomPromptId === 'manual' ? 'Nhập Prompt mới' : 'Nội dung Prompt hiện tại'}
                        </p>
                        <textarea
                          value={ecomPromptText}
                          onChange={(e) => {
                            setEcomPromptText(e.target.value);
                            if (selectedEcomPromptId !== 'manual') setSelectedEcomPromptId('manual');
                          }}
                          placeholder="Mô tả nội dung…"
                          className="w-full h-24 outline-none transition-colors p-3 mb-4 resize-none"
                          style={{ background: 'var(--color-fill)', color: 'var(--color-text)', borderRadius: 12, border: '0.5px solid transparent', fontSize: 13, letterSpacing: '-0.01em' }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                          onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                        />
                      </>
                    )}
                    {!isAdmin && selectedEcomPromptId !== 'manual' && selectedEcomPromptId && (
                      <div className="rounded-lg px-4 py-3 mb-4 flex items-center gap-2" style={{ background: 'var(--color-accent-soft)', border: '0.5px solid var(--color-accent)' }}>
                        <CheckCircle2 size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                        <p className="font-bold" style={{ fontSize: 12, color: 'var(--color-accent)' }}>
                          {selectedEcomSavedPrompt?.name || 'Prompt đã lưu'} — sẵn sàng Gen
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2 mt-auto">
                      <p className="uppercase font-semibold" style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.04em' }}>
                        + Bổ sung prompt (tuỳ chọn)
                      </p>
                      {ecomSupplementaryPrompt && (
                        <button
                          onClick={() => setEcomSupplementaryPrompt('')}
                          className="font-semibold transition-colors"
                          style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                        >
                          XOÁ
                        </button>
                      )}
                    </div>
                    <textarea
                      value={ecomSupplementaryPrompt}
                      onChange={(e) => setEcomSupplementaryPrompt(e.target.value)}
                      placeholder="VD: Sản phẩm là chăn ga họa tiết hoa cúc xanh navy, phong cách Hàn Quốc tối giản, không có chữ Trung Quốc trên ảnh…"
                      className="w-full h-20 outline-none transition-colors p-3 resize-none"
                      style={{ background: 'var(--color-accent-soft)', color: 'var(--color-text)', borderRadius: 12, border: '0.5px solid color-mix(in srgb, var(--color-accent) 35%, transparent)', fontSize: 13, letterSpacing: '-0.01em' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--color-accent) 35%, transparent)')}
                    />
                  </div>
                </div>
                </div>
              )}

              <input
                type="file"
                ref={ecomTemplateFileInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                multiple
                onChange={async (e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    if (files.length === 1) {
                      const r = new FileReader();
                      r.onload = (ev) => {
                        setEcomTemplateImage(ev.target?.result as string);
                      };
                      r.readAsDataURL(files[0]);
                    } else {
                      setIsStitchingImages(true);
                      const fileArray = Array.from(files);
                      const stitched = await stitchImages(fileArray);
                      if (stitched) {
                        setEcomTemplateImage(stitched);
                      } else {
                        setGlobalError("Có lỗi xảy ra khi ghép ảnh.");
                      }
                      setIsStitchingImages(false);
                    }
                  }
                }}
              />
              <input 
                type="file" 
                ref={ecomFileInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp" 
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).slice(0, 5 - ecomProductImages.length);
                  if (files.length > 0) processFiles(files);
                  e.currentTarget.value = '';
                }}
              />
              <input
                type="file"
                ref={patternSourceFileInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const r = new FileReader();
                    r.onload = (ev) => {
                      setPatternSourceImage(ev.target?.result as string);
                      setGeneratedPattern(null); // Reset when new source uploaded
                    };
                    r.readAsDataURL(file);
                  }
                }}
              />
              <input
                type="file"
                ref={patternMockupFileInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const r = new FileReader();
                    r.onload = (ev) => setPatternMockupImage(ev.target?.result as string);
                    r.readAsDataURL(file);
                  }
                }}
              />
              <input 
                type="file" 
                ref={ecomThayModelInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const r = new FileReader();
                    r.onload = (ev) => setEcomThayModelImage(ev.target?.result as string);
                    r.readAsDataURL(file);
                  }
                }}
              />
              <input 
                type="file" 
                ref={ecomThayProductInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const r = new FileReader();
                    r.onload = (ev) => setEcomThayProductImage(ev.target?.result as string);
                    r.readAsDataURL(file);
                  }
                }}
              />
            {isEcomGenerationTab(ecomSubTab) && (
              <>
                {globalError && (
                  <div
                    className="mb-6 p-3 rounded-lg flex items-start gap-3"
                    style={{
                      background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
                      border: '0.5px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
                      color: 'var(--color-danger)',
                      fontSize: 12,
                    }}
                  >
                    <p>{globalError}</p>
                  </div>
                )}

                <div className="gen-new-legacy-generate pt-2 space-y-3">
                  {(() => {
                    const runningBatches = ecomBatches.filter(b => b.status === 'running').length;
                    if (isEcomGenerationTab(ecomSubTab)) {
                      // In T2I mode: enabled if prompt non-empty. In i2i: enabled if image uploaded.
                      const t2iReady = ecomT2IMode && Boolean(ecomPromptText.trim() || ecomSupplementaryPrompt.trim() || ecomUsesSecretPrompt);
                      const i2iReady = !ecomT2IMode && ecomProductImages.length > 0;
                      return (
                        <Button
                          variant="filled"
                          size="lg"
                          fullWidth
                          icon={Sparkles}
                          onClick={handleEcomGenerate}
                          disabled={!(t2iReady || i2iReady)}
                        >
                          {runningBatches > 0
                            ? `Gen thêm batch (đang chạy ${runningBatches})`
                            : ecomT2IMode
                              ? `Gen ${isVideoModelKey(ecomModel) ? 'video' : 'ảnh'} từ Prompt`
                              : `Gen ${isVideoModelKey(ecomModel) ? 'video' : 'ảnh'} từ tham chiếu`}
                        </Button>
                      );
                    }
                    return (
                      <Button
                        variant="filled"
                        size="lg"
                        fullWidth
                        icon={isEcomGenerating ? Loader2 : Sparkles}
                        onClick={handleEcomGenerate}
                        disabled={!ecomProductImage || isEcomGenerating}
                      >
                        {isEcomGenerating ? 'Đang xử lý…' : 'Gen ảnh TMĐT'}
                      </Button>
                    );
                  })()}
                </div>
              </>
            )}

            {(ecomSubTab === 'thay' || ecomSubTab === 'pattern-replace') && globalError && (
               <div className="mt-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-xs">
                 <p>{globalError}</p>
               </div>
            )}
              </div>
            </div>
          {/* Right panel: Results — hidden on pattern-replace; side-by-side 5-col on gen-new; full-width below on clone */}
          <div className={`flex-col gap-4 ${
            ecomSubTab === 'pattern-replace' ? 'hidden'
            : isEcomGenerationTab(ecomSubTab) ? 'gen-new-canvas-shell lg:col-span-12 flex'
            : ecomSubTab === 'thay' || ecomSubTab === 'ghep-anh' ? 'lg:col-span-8 flex'
            : 'lg:col-span-12 flex'
          }`}>
            <div className={`glass-panel p-6 min-h-[500px] flex flex-col justify-center ${isEcomGenerationTab(ecomSubTab) ? 'gen-new-canvas' : ''}`}>
              {isEcomGenerationTab(ecomSubTab) && ecomLastFinalImages.length > 0 && (
                <div className="mb-4 pb-4 border-b border-editor-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                      Ảnh tách lần trước ({ecomLastFinalImages.length})
                    </p>
                    <button
                      onClick={() => setEcomLastFinalImages([])}
                      className="text-[10px] text-gray-500 hover:text-red-400 font-bold"
                    >
                      XOÁ LỊCH SỬ
                    </button>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {ecomLastFinalImages.map((img, i) => (
                      <div key={img.id} className="relative group rounded-lg overflow-hidden border border-editor-border bg-black aspect-[3/4]">
                        <img src={img.url} alt={`Prev ${i+1}`} className="w-full h-full object-contain" />
                        <button
                          onClick={() => useEcomImageAsInput(img.url)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          title="Dùng ảnh này làm input mới"
                        >
                          <span className="px-2 py-1 rounded bg-editor-accent text-white font-bold text-[10px] flex items-center gap-1">
                            <Edit2 size={10} /> EDIT
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {ecomSubTab === 'ghep-anh' ? (
                <div className="flex flex-col gap-6 w-full">
                  {/* Upload slots */}
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3">
                      Ảnh thành phần ({composeImages.filter(Boolean).length}/5) — tối thiểu 2
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {composeImages.map((img, i) => (
                        <div
                          key={i}
                          className={`w-full aspect-[3/4] border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer overflow-hidden transition-colors relative group bg-black/20 ${
                            composeDragOver === i ? 'border-editor-accent bg-editor-accent/10' : 'border-editor-border hover:border-editor-accent'
                          }`}
                          onClick={() => composeInputRefs.current[i]?.click()}
                          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setComposeDragOver(i); }}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setComposeDragOver(null); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setComposeDragOver(null);
                            const file = e.dataTransfer.files?.[0];
                            if (file) loadFileToCompose(file, i);
                          }}
                        >
                          {img ? (
                            <>
                              <img src={img} alt={`Ảnh ${i + 1}`} className="w-full h-full object-contain" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white font-bold text-[10px]">Đổi ảnh</span>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setComposeImages((prev) => prev.map((x, idx) => (idx === i ? null : x))); }}
                                className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-red-500 text-white rounded-md transition-colors z-10"
                                title="Xoá ảnh"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-gray-500 group-hover:text-editor-accent text-center px-2">
                              <Plus size={22} />
                              <span className="text-[10px] font-medium">Ảnh {i + 1}</span>
                            </div>
                          )}
                          <input
                            type="file"
                            ref={(el) => { composeInputRefs.current[i] = el; }}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) loadFileToCompose(file, i);
                              e.target.value = '';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Results */}
                  <div>
                    <p className="text-[10px] text-editor-accent uppercase tracking-widest font-bold mb-3">Kết quả ghép</p>
                    {isComposing ? (
                      <div className="w-full aspect-video border-2 border-dashed border-editor-border rounded-xl flex flex-col items-center justify-center gap-3 bg-black/30">
                        <Loader2 className="animate-spin text-editor-accent" size={40} />
                        <p className="text-editor-accent text-xs font-bold uppercase tracking-widest animate-pulse">Đang ghép ảnh…</p>
                        <p className="text-gray-400 text-[10px]">AI đang xử lý, 30s — 2 phút.</p>
                      </div>
                    ) : composeResults.length > 0 ? (
                      <div className={`grid gap-4 ${composeResults.length > 1 ? 'grid-cols-2' : 'grid-cols-1 max-w-md'}`}>
                        {composeResults.map((res, i) => (
                          <div key={i} className="relative group rounded-xl overflow-hidden border border-editor-border bg-black aspect-[3/4] flex items-center justify-center">
                            <img src={res} alt={`Kết quả ${i + 1}`} className="w-full h-full object-contain" />
                            <button
                              onClick={() => setZoomImage(res)}
                              className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-md backdrop-blur-sm border border-white/20 transition-colors z-10"
                              title="Phóng to"
                            >
                              <ZoomIn size={14} />
                            </button>
                            <button
                              onClick={() => { const link = document.createElement('a'); link.href = res; link.download = `ghep-anh-${Date.now()}-${i + 1}.png`; link.click(); }}
                              className="absolute bottom-3 right-3 p-3 bg-editor-accent text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                              title="Tải ảnh về"
                            >
                              <Download size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-full aspect-video border-2 border-dashed border-editor-border rounded-xl flex flex-col items-center justify-center gap-3 text-gray-500 bg-black/20">
                        <ImageIcon size={40} className="opacity-50" />
                        <p className="font-bold tracking-widest uppercase text-[10px]">CHƯA CÓ KẾT QUẢ</p>
                        <p className="text-[10px] opacity-70">Tải 2-5 ảnh & bấm Bắt Đầu Ghép</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : ecomSubTab === 'thay' ? (
                <div className="flex flex-col gap-6 w-full">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 1. Model Image */}
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold flex items-center gap-2">
                        <span>1. ẢNH GIƯỜNG ĐÍCH (MODEL)</span>
                        {thayPasteTarget === 'model' && (
                          <span className="text-[9px] text-editor-accent normal-case tracking-normal font-medium">• Ctrl+V</span>
                        )}
                      </p>
                      <div
                        className={`w-full aspect-[3/4] border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer overflow-hidden transition-colors relative group bg-black/20 ${
                          thayDragOver === 'model' ? 'border-editor-accent bg-editor-accent/10' : 'border-editor-border hover:border-editor-accent'
                        }`}
                        onClick={() => {
                          setThayPasteTarget('model');
                          ecomThayModelInputRef.current?.click();
                        }}
                        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setThayDragOver('model'); }}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setThayDragOver(null); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setThayDragOver(null);
                          setThayPasteTarget('model');
                          const file = e.dataTransfer.files?.[0];
                          if (file) loadFileToThay(file, 'model');
                        }}
                      >
                        {ecomThayModelImage ? (
                          <>
                            <img src={ecomThayModelImage} alt="Model" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white font-bold text-xs">Thay đổi</span>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setZoomImage(ecomThayModelImage); }}
                              className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-md backdrop-blur-sm border border-white/20 transition-colors z-10"
                              title="Phóng to"
                            >
                              <ZoomIn size={14} />
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-editor-accent text-center px-4">
                            <Bed size={32} />
                            <span className="text-xs font-medium">Tải ảnh Giường Đích</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. Product Image */}
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold flex items-center gap-2">
                        <span>2. ẢNH CHĂN GA (PRODUCT)</span>
                        {thayPasteTarget === 'product' && (
                          <span className="text-[9px] text-editor-accent normal-case tracking-normal font-medium">• Ctrl+V</span>
                        )}
                      </p>
                      <div
                        className={`w-full aspect-[3/4] border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer overflow-hidden transition-colors relative group bg-black/20 ${
                          thayDragOver === 'product' ? 'border-editor-accent bg-editor-accent/10' : 'border-editor-border hover:border-editor-accent'
                        }`}
                        onClick={() => {
                          setThayPasteTarget('product');
                          ecomThayProductInputRef.current?.click();
                        }}
                        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setThayDragOver('product'); }}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setThayDragOver(null); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setThayDragOver(null);
                          setThayPasteTarget('product');
                          const file = e.dataTransfer.files?.[0];
                          if (file) loadFileToThay(file, 'product');
                        }}
                      >
                        {ecomThayProductImage ? (
                          <>
                            <img src={ecomThayProductImage} alt="Product" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white font-bold text-xs">Thay đổi</span>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setZoomImage(ecomThayProductImage); }}
                              className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-md backdrop-blur-sm border border-white/20 transition-colors z-10"
                              title="Phóng to"
                            >
                              <ZoomIn size={14} />
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-editor-accent text-center px-4">
                            <Shirt size={32} />
                            <span className="text-xs font-medium">Tải ảnh Chăn Ga</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3. Result */}
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] text-editor-accent uppercase tracking-widest font-bold">KẾT QUẢ THAY ĐỔI (RESULT)</p>
                      <div className="w-full aspect-[3/4] border-2 border-dashed border-editor-border rounded-xl flex items-center justify-center bg-black/30 overflow-hidden relative">
                        {isEcomThayGenerating ? (
                          <>
                            <div className="animate-pulse absolute inset-0 bg-gray-800/20" />
                            <div className="flex flex-col items-center gap-3 relative z-10">
                              <Loader2 className="animate-spin text-editor-accent" size={40} />
                              <p className="text-editor-accent text-xs font-bold uppercase tracking-widest animate-pulse">Đang thay đồ...</p>
                              <p className="text-gray-400 text-[10px] max-w-[180px] text-center">AI đang xử lý, 30s — 2 phút.</p>
                            </div>
                          </>
                        ) : ecomThayResults.length > 0 ? (
                          (() => {
                            const activeIdx = Math.min(ecomThayActiveIdx, ecomThayResults.length - 1);
                            const activeUrl = ecomThayResults[activeIdx];
                            return (
                              <div className="w-full h-full relative flex flex-col">
                                <div className="flex-1 relative overflow-hidden">
                                  <img src={activeUrl} alt={`Thay Result ${activeIdx + 1}`} className="w-full h-full object-contain" />
                                  <button
                                    onClick={() => setZoomImage(activeUrl)}
                                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-md backdrop-blur-sm border border-white/20 transition-colors z-10"
                                    title="Phóng to"
                                  >
                                    <ZoomIn size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = activeUrl;
                                      link.download = `thay-result-${Date.now()}-${activeIdx + 1}.png`;
                                      link.click();
                                    }}
                                    className="absolute bottom-3 right-3 p-3 bg-editor-accent text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                                    title="Tải ảnh về"
                                  >
                                    <Download size={18} />
                                  </button>
                                  {ecomThayResults.length > 1 && (
                                    <span
                                      className="absolute top-2 left-2 rounded backdrop-blur-sm border border-white/20"
                                      style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                                    >
                                      {activeIdx + 1} / {ecomThayResults.length}
                                    </span>
                                  )}
                                </div>
                                {ecomThayResults.length > 1 && (
                                  <div className="flex gap-1.5 mt-1.5 px-1 pb-1">
                                    {ecomThayResults.map((url, idx) => {
                                      const isActive = idx === activeIdx;
                                      return (
                                        <button
                                          key={idx}
                                          onClick={() => setEcomThayActiveIdx(idx)}
                                          className="flex-1 aspect-square overflow-hidden rounded-md transition-all"
                                          style={{
                                            border: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
                                            outline: isActive ? '0.5px solid rgba(0,0,0,0.35)' : 'none',
                                            padding: 0,
                                            cursor: 'pointer',
                                            opacity: isActive ? 1 : 0.65,
                                          }}
                                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.opacity = '0.9'; }}
                                          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.opacity = '0.65'; }}
                                          title={`Ảnh ${idx + 1}`}
                                        >
                                          <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <div className="flex flex-col items-center gap-3 text-gray-500 px-4 text-center">
                            <ImageIcon size={40} className="opacity-50" />
                            <p className="font-bold tracking-widest uppercase text-[10px]">CHƯA CÓ KẾT QUẢ</p>
                            <p className="text-[10px] opacity-70">Tải 2 ảnh & bấm Bắt Đầu Thay</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Saved rooms — 2 sections: SHARED + PERSONAL */}
                  {(() => {
                    const sharedRooms = savedRooms.filter(r => r.isShared);
                    const personalRooms = savedRooms.filter(r => !r.isShared && r.uid === user?.uid);
                    const renderRoomCell = (room: SavedRoom, allowEdit: boolean) => {
                      const isMarkedForDelete = draftDeletedRoomIds.has(room.id);
                      return (
                        <div
                          key={room.id}
                          className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all group ${
                            isMarkedForDelete
                              ? 'border-red-500 opacity-50'
                              : ecomThayModelImage === room.imageUrl ? 'border-editor-accent cursor-pointer' : 'border-editor-border hover:border-gray-600 cursor-pointer'
                          }`}
                          onClick={() => {
                            if (!isEditingSavedRooms) {
                              setEcomThayModelImage(room.imageUrl);
                            }
                          }}
                        >
                          <img src={room.imageUrl} alt="Saved Room" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          {isEditingSavedRooms && allowEdit ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (room.isShared && !window.confirm("Giường này đang chia sẻ cho cả công ty. Xóa sẽ làm nhân viên mất quyền dùng. Tiếp tục?")) return;
                                setDraftDeletedRoomIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(room.id)) next.delete(room.id);
                                  else next.add(room.id);
                                  return next;
                                });
                              }}
                              className={`absolute top-1 right-1 p-1 rounded-md transition-colors ${isMarkedForDelete ? 'bg-red-500 text-white' : 'bg-black/70 hover:bg-red-500 text-white'}`}
                              title={isMarkedForDelete ? 'Bỏ chọn xóa' : 'Đánh dấu xóa'}
                            >
                              <Trash2 size={10} />
                            </button>
                          ) : (
                            <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isAdmin && !isEditingSavedRooms && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleSyncRoom(room); }}
                                  className={`p-1 rounded-md ${room.isShared ? 'bg-blue-500 text-white' : 'bg-black/70 text-white hover:bg-blue-500'}`}
                                  title={room.isShared ? 'Bỏ chia sẻ' : 'Chia sẻ cho cả công ty'}
                                >
                                  <Globe size={10} />
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); setZoomImage(room.imageUrl); }}
                                className="p-1 bg-black/70 text-white rounded-md hover:bg-black"
                                title="Phóng to"
                              >
                                <ZoomIn size={10} />
                              </button>
                            </div>
                          )}
                          {room.isShared && (
                            <div className="absolute top-1 left-1 px-1 py-0.5 bg-blue-500/80 rounded text-[7px] font-bold text-white">CHUNG</div>
                          )}
                          {isMarkedForDelete && (
                            <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center pointer-events-none">
                              <span className="text-[9px] font-bold text-white bg-red-600 px-2 py-0.5 rounded">SẼ XÓA</span>
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <div className="flex flex-col gap-4">
                        {/* Edit toggle (one for both sections) */}
                        <div className="flex items-center justify-end gap-3">
                          {isEditingSavedRooms ? (
                            <>
                              <button
                                onClick={async () => {
                                  for (const id of draftDeletedRoomIds) {
                                    await handleDeleteRoom(id);
                                  }
                                  setDraftDeletedRoomIds(new Set());
                                  setIsEditingSavedRooms(false);
                                }}
                                className="text-[10px] text-editor-accent font-bold hover:underline flex items-center gap-1"
                              >
                                <Check size={10} /> LƯU
                              </button>
                              <button
                                onClick={() => { setDraftDeletedRoomIds(new Set()); setIsEditingSavedRooms(false); }}
                                className="text-[10px] text-gray-400 font-bold hover:underline flex items-center gap-1"
                              >
                                <X size={10} /> HỦY
                              </button>
                            </>
                          ) : (
                            (personalRooms.length > 0 || (isAdmin && sharedRooms.length > 0)) && (
                              <button
                                onClick={() => setIsEditingSavedRooms(true)}
                                className="text-[10px] text-gray-400 font-bold hover:text-editor-accent hover:underline flex items-center gap-1"
                              >
                                <Pencil size={10} /> CHỈNH SỬA
                              </button>
                            )
                          )}
                        </div>

                        {/* SECTION 1: GIƯỜNG CHUNG OTAMA */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold flex items-center gap-1">
                              <Globe size={10} /> Giường chung Otama ({sharedRooms.length}/5)
                            </p>
                            {isAdmin && sharedRooms.length < 5 && !isEditingSavedRooms && (
                              <button
                                onClick={() => {
                                  if (!user) { handleLogin(); return; }
                                  setPendingUploadAsSharedRoom(true);
                                  roomListFileInputRef.current?.click();
                                }}
                                disabled={isSavingRoom}
                                className="text-[10px] text-blue-400 font-bold hover:underline flex items-center gap-1 disabled:opacity-50"
                              >
                                {isSavingRoom ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                                THÊM VÀO KHO CHUNG
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-5 gap-2 max-w-md">
                            {sharedRooms.map(r => renderRoomCell(r, isAdmin))}
                            {Array.from({ length: 5 - sharedRooms.length }).map((_, i) => (
                              <div
                                key={`empty-shared-${i}`}
                                onClick={() => {
                                  if (!isAdmin || isEditingSavedRooms) return;
                                  if (!user) { handleLogin(); return; }
                                  setPendingUploadAsSharedRoom(true);
                                  roomListFileInputRef.current?.click();
                                }}
                                className={`aspect-[3/4] rounded-lg border-2 border-dashed border-blue-500/30 flex items-center justify-center bg-blue-500/5 ${isAdmin && !isEditingSavedRooms ? 'cursor-pointer hover:border-blue-500 hover:bg-blue-500/10' : ''}`}
                                title={isAdmin && !isEditingSavedRooms ? 'Bấm để thêm vào kho chung' : ''}
                              >
                                {isAdmin && !isEditingSavedRooms ? <Plus size={16} className="text-blue-500/60" /> : <Bed size={16} className="text-blue-500/40" />}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* SECTION 2: GIƯỜNG CÁ NHÂN */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold flex items-center gap-1">
                              <UserIcon size={10} /> Giường cá nhân ({personalRooms.length}/5)
                            </p>
                            {personalRooms.length < 5 && !isEditingSavedRooms && (
                              <button
                                onClick={() => {
                                  if (!user) { handleLogin(); } else { roomListFileInputRef.current?.click(); }
                                }}
                                disabled={isSavingRoom}
                                className="text-[10px] text-editor-accent font-bold hover:underline flex items-center gap-1 disabled:opacity-50"
                              >
                                {isSavingRoom ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                                THÊM MỚI
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-5 gap-2 max-w-md">
                            {personalRooms.map(r => renderRoomCell(r, true))}
                            {Array.from({ length: 5 - personalRooms.length }).map((_, i) => (
                              <div key={`empty-personal-${i}`} className="aspect-[3/4] rounded-lg border-2 border-dashed border-editor-border flex items-center justify-center bg-black/20">
                                <Bed size={16} className="text-gray-700" />
                              </div>
                            ))}
                          </div>
                        </div>
                        <input type="file" ref={roomListFileInputRef} className="hidden" accept="image/*" onChange={handleRoomListUpload} />
                      </div>
                    );
                  })()}
                </div>
              ) : selectedEcomGrid ? (
                <div className="flex flex-col items-center">
                  {ecomBoxes.length > 0 ? (
                    <div className="w-full flex flex-col">
                      {/* Header: Kết quả + Dịch / Tải zip */}
                      <div className="flex items-end justify-between mb-4">
                        <div>
                          <h2
                            className="font-bold"
                            style={{ fontSize: 22, color: 'var(--color-text)', letterSpacing: '-0.02em' }}
                          >
                            Kết quả tách
                          </h2>
                          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            {ecomBoxes.length} ô · Chọn các ô để gen tiếp ({selectedBoxIds.length} đã chọn)
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        {ecomBoxes.map((box, idx) => {
                           const isSelected = selectedBoxIds.includes(box.id);
                           return (
                             <div
                               key={box.id}
                               className="relative group cursor-pointer transition-all aspect-[3/4] flex items-center justify-center overflow-hidden"
                               style={{
                                 background: 'var(--color-card)',
                                 border: isSelected ? '2px solid var(--color-accent)' : '0.5px solid var(--color-border-soft)',
                                 borderRadius: 14,
                                 boxShadow: isSelected ? '0 0 0 4px var(--color-accent-soft)' : 'var(--shadow-card)',
                                 opacity: 1,
                               }}
                               onClick={() => {
                                 setSelectedBoxIds(prev =>
                                   prev.includes(box.id) ? prev.filter(id => id !== box.id) : [...prev, box.id]
                                 );
                               }}
                             >
                                <img src={box.cropUrl} alt="Crop" className="w-full h-full object-contain" />
                                <span
                                  className="absolute top-2 left-2 font-semibold rounded-full"
                                  style={{
                                    padding: '3px 9px',
                                    fontSize: 11,
                                    background: 'var(--color-card)',
                                    color: 'var(--color-text-secondary)',
                                    border: '0.5px solid var(--color-border-soft)',
                                    letterSpacing: '-0.01em',
                                  }}
                                >
                                  Trang {idx + 1}
                                </span>
                                <div
                                  className="absolute top-2 right-2 rounded-full flex items-center justify-center transition-all"
                                  style={{
                                    width: 24,
                                    height: 24,
                                    background: isSelected ? 'var(--color-accent)' : 'rgba(255,255,255,0.85)',
                                    border: isSelected ? '0 solid transparent' : '0.5px solid var(--color-border)',
                                    color: '#fff',
                                  }}
                                >
                                  {isSelected && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                  )}
                                </div>
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
                                  <button onClick={(e) => {
                                      e.stopPropagation();
                                      setZoomImage(box.cropUrl);
                                  }} className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}><ZoomIn size={16} /></button>
                                </div>
                             </div>
                           );
                        })}
                      </div>
                      {/* Action bar */}
                      <div
                        className="flex flex-wrap items-center gap-2 mb-8 p-3"
                        style={{
                          background: 'var(--color-card)',
                          border: '0.5px solid var(--color-border-soft)',
                          borderRadius: 14,
                          boxShadow: 'var(--shadow-card)',
                        }}
                      >
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (ecomFinalImages.length > 0) {
                              if (!window.confirm("Phân tích lại sẽ xóa các kết quả đã tạo. Bạn có chắc chắn?")) return;
                            }
                            setEcomBoxes([]);
                            setSelectedBoxIds([]);
                            setEcomFinalImages([]);
                          }}
                          disabled={isEcomEnhancing}
                        >
                          Phân tích lại
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          icon={selectedBoxIds.length === ecomBoxes.length && ecomBoxes.length > 0 ? X : Check}
                          onClick={() => {
                            if (selectedBoxIds.length === ecomBoxes.length) {
                              setSelectedBoxIds([]);
                            } else {
                              setSelectedBoxIds(ecomBoxes.map(b => b.id));
                            }
                          }}
                          disabled={isEcomEnhancing || ecomBoxes.length === 0}
                        >
                          {selectedBoxIds.length === ecomBoxes.length && ecomBoxes.length > 0
                            ? 'Bỏ chọn tất cả'
                            : `Chọn tất cả (${ecomBoxes.length})`}
                        </Button>

                        <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: 'var(--color-fill)', borderRadius: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Tỉ lệ:</span>
                          <select
                            value={enhanceAspectRatio}
                            onChange={(e) => setEnhanceAspectRatio(e.target.value)}
                            className="outline-none border-0"
                            style={{
                              background: 'transparent',
                              color: 'var(--color-text)',
                              fontSize: 12,
                              fontWeight: 600,
                              padding: '2px 4px',
                            }}
                            disabled={isEcomEnhancing}
                          >
                            <option value="1:1">1:1 (Vuông)</option>
                            <option value="9:16">9:16 (Dọc)</option>
                            <option value="16:9">16:9 (Ngang)</option>
                            <option value="3:4">3:4 (Dọc ngắn)</option>
                            <option value="4:3">4:3 (Ngang ngắn)</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2 px-2 py-1" style={{ background: 'var(--color-fill)', borderRadius: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', paddingLeft: 4 }}>Model:</span>
                          <div className="flex gap-1 p-0.5" style={{ background: 'var(--color-card)', borderRadius: 8 }}>
                            <button
                              onClick={() => setEnhanceModel('banana-2')}
                              disabled={isEcomEnhancing}
                              className="px-2.5 py-1 transition-all"
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 6,
                                background: enhanceModel === 'banana-2' ? 'var(--color-accent)' : 'transparent',
                                color: enhanceModel === 'banana-2' ? '#fff' : 'var(--color-text-secondary)',
                              }}
                              title="Nhanh, tiết kiệm credit"
                            >
                              Banana 2
                            </button>
                            <button
                              onClick={() => setEnhanceModel('banana-pro')}
                              disabled={isEcomEnhancing}
                              className="px-2.5 py-1 transition-all"
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 6,
                                background: enhanceModel === 'banana-pro' ? 'var(--color-warning)' : 'transparent',
                                color: enhanceModel === 'banana-pro' ? '#fff' : 'var(--color-text-secondary)',
                              }}
                              title="Tốn phí, chi tiết hơn, chậm hơn"
                            >
                              Banana Pro
                            </button>
                          </div>
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                          <CreditEstimate
                            compact
                            credits={estimateGenerationCredits({
                              modelId: MODEL_CONFIG[enhanceModel].id,
                              size: ecomImageSize,
                              count: Math.max(1, selectedBoxIds.length),
                            })}
                          />
                          <Button
                            variant="filled"
                            size="md"
                            icon={isEcomEnhancing ? RotateCw : Sparkles}
                            onClick={handleEnhanceSelectedBoxes}
                            disabled={isEcomEnhancing || selectedBoxIds.length === 0}
                          >
                            {isEcomEnhancing
                              ? `Đang gen (${selectedBoxIds.length})…`
                              : `Gen ${selectedBoxIds.length} ảnh đã chọn`}
                          </Button>
                        </div>
                      </div>

                      {/* RESULTS SECTION BELOW GRID */}
                      {ecomFinalImages.length > 0 && (
                        <div ref={resultsRef} className="w-full pt-8" style={{ borderTop: '0.5px solid var(--color-border-soft)' }}>
                           <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
                              <div>
                                <h2
                                  className="font-bold"
                                  style={{ fontSize: 22, color: 'var(--color-text)', letterSpacing: '-0.02em' }}
                                >
                                  Kết quả
                                </h2>
                                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                                  {ecomFinalImages.length} trang chi tiết · Chọn các trang để xuất riêng
                                </p>
                              </div>
                              <div className="flex gap-2 items-center flex-wrap">
                                {(() => {
                                  const readyResults = ecomFinalImages.filter(img => !img.loading);
                                  const allSelected = readyResults.length > 0 && readyResults.every(img => selectedResultIds.includes(img.id));
                                  return (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      icon={allSelected ? X : Check}
                                      onClick={() => {
                                        if (allSelected) {
                                          setSelectedResultIds([]);
                                        } else {
                                          setSelectedResultIds(readyResults.map(img => img.id));
                                        }
                                      }}
                                      disabled={readyResults.length === 0}
                                    >
                                      {allSelected ? 'Bỏ chọn tất cả' : `Chọn tất cả (${readyResults.length})`}
                                    </Button>
                                  );
                                })()}
                                {selectedResultIds.length > 0 && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={isTranslatingImages ? RotateCw : Languages}
                                    onClick={handleTranslateSelectedImages}
                                    disabled={isTranslatingImages}
                                  >
                                    {isTranslatingImages
                                      ? 'Đang dịch…'
                                      : `Dịch ảnh (${selectedResultIds.length})`}
                                  </Button>
                                )}
                                {selectedResultIds.length > 0 && (
                                  <Button
                                    variant="filled"
                                    size="sm"
                                    icon={Download}
                                    onClick={async () => {
                                      const zip = new JSZip();
                                      const selectedImages = ecomFinalImages.filter(img => selectedResultIds.includes(img.id));
                                      for (let i = 0; i < selectedImages.length; i++) {
                                        const img = selectedImages[i];
                                        if (!img.url || img.loading) continue;
                                        const base64Data = img.url.split(',')[1];
                                        zip.file(`ecom-final-${Date.now()}-${i+1}.jpg`, base64Data, { base64: true });
                                      }
                                      const content = await zip.generateAsync({ type: "blob" });
                                      saveAs(content, "ecom-results.zip");
                                    }}
                                  >
                                    Tải zip ({selectedResultIds.length})
                                  </Button>
                                )}
                                <Button
                                  variant="plain"
                                  size="sm"
                                  tone="danger"
                                  onClick={() => {
                                    if (window.confirm("Bạn có chắc chắn muốn xóa tất cả kết quả?")) {
                                      setEcomFinalImages([]);
                                      setSelectedResultIds([]);
                                    }
                                  }}
                                >
                                  Xóa kết quả
                                </Button>
                              </div>
                           </div>
                           <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {ecomFinalImages.map((res, i) => {
                              const isSelected = selectedResultIds.includes(res.id);
                              return (
                                <div
                                  key={`${res.id}-${i}`}
                                  onClick={() => {
                                    if (res.loading) return;
                                    setSelectedResultIds(prev =>
                                      prev.includes(res.id) ? prev.filter(id => id !== res.id) : [...prev, res.id]
                                    );
                                  }}
                                  className="relative group transition-all cursor-pointer aspect-[3/4] flex items-center justify-center overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500"
                                  style={{
                                    background: 'var(--color-card)',
                                    border: isSelected ? '2px solid var(--color-accent)' : '0.5px solid var(--color-border-soft)',
                                    borderRadius: 14,
                                    boxShadow: isSelected ? '0 0 0 4px var(--color-accent-soft)' : 'var(--shadow-card)',
                                  }}
                                >
                                  <span
                                    className="absolute top-2 left-2 z-10 font-semibold rounded-full"
                                    style={{
                                      padding: '3px 9px',
                                      fontSize: 11,
                                      background: 'var(--color-card)',
                                      color: 'var(--color-text-secondary)',
                                      border: '0.5px solid var(--color-border-soft)',
                                      letterSpacing: '-0.01em',
                                    }}
                                  >
                                    Trang {i + 1}
                                  </span>
                                  <div
                                    className="absolute top-2 right-2 z-10 rounded-full flex items-center justify-center transition-all"
                                    style={{
                                      width: 24,
                                      height: 24,
                                      background: isSelected ? 'var(--color-accent)' : 'rgba(255,255,255,0.85)',
                                      border: isSelected ? '0 solid transparent' : '0.5px solid var(--color-border)',
                                      color: '#fff',
                                    }}
                                  >
                                    {isSelected && (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    )}
                                  </div>
                                  <img src={res.url} alt={`Final Result ${i+1}`} className={`w-full h-full object-contain transition-all ${res.loading ? 'opacity-50 blur-sm scale-105' : 'scale-100'}`} />
                                  {res.loading && (
                                     <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-bg) 70%, transparent)', backdropFilter: 'blur(8px)' }}>
                                       <RotateCw size={24} className="animate-spin mb-2" style={{ color: 'var(--color-accent)' }} />
                                       <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text)' }}>Đang xử lý…</span>
                                     </div>
                                  )}
                                  {!res.loading && (
                                    <>
                                      <button
                                        className="absolute bottom-2 left-2 z-10 flex items-center gap-1 font-semibold transition-opacity opacity-0 group-hover:opacity-100"
                                        style={{
                                          padding: '5px 9px',
                                          fontSize: 11,
                                          background: 'var(--color-accent)',
                                          color: '#fff',
                                          borderRadius: 8,
                                          boxShadow: 'var(--shadow-pop)',
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          useEcomImageAsInput(res.url, { snapshot: true });
                                        }}
                                        title="Dùng ảnh này để chỉnh sửa / viết prompt tiếp"
                                      >
                                        <Edit2 size={12} />
                                        Edit
                                      </button>
                                      <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 transition-opacity opacity-0 group-hover:opacity-100">
                                        <button
                                          className="rounded-lg flex items-center justify-center"
                                          style={{
                                            width: 28,
                                            height: 28,
                                            background: 'var(--color-accent)',
                                            color: '#fff',
                                            boxShadow: 'var(--shadow-pop)',
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const a = document.createElement('a');
                                            a.href = res.url;
                                            a.download = `ecom-${Date.now()}-${i + 1}.png`;
                                            a.click();
                                          }}
                                          title="Tải ảnh này"
                                        >
                                          <Download size={14} />
                                        </button>
                                        <button
                                          className="rounded-lg flex items-center justify-center"
                                          style={{
                                            width: 28,
                                            height: 28,
                                            background: 'rgba(0,0,0,0.55)',
                                            backdropFilter: 'blur(12px)',
                                            color: '#fff',
                                            boxShadow: 'var(--shadow-pop)',
                                            border: '0.5px solid rgba(255,255,255,0.18)',
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setZoomImage(res.url);
                                          }}
                                          title="Phóng to ảnh"
                                        >
                                          <ZoomIn size={14} />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                           </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="w-full max-w-sm relative rounded-xl overflow-hidden border-2 border-editor-accent bg-black aspect-[3/4] flex items-center justify-center mb-6">
                         <img src={selectedEcomGrid} alt="Selected Grid" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setSelectedEcomGrid(null)}
                          className="px-6 py-3 bg-gray-800 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-gray-700 transition"
                          disabled={isDetectingBoxes}
                        >
                          Hủy chọn
                        </button>
                        <button 
                          onClick={handleDetectGridBoxes}
                          disabled={isDetectingBoxes}
                          className="px-6 py-3 bg-editor-accent text-white font-bold rounded-xl flex items-center gap-2 hover:opacity-90 transition disabled:opacity-50"
                        >
                          {isDetectingBoxes ? (
                             <><RotateCw size={20} className="animate-spin" /> Đang phân tích...</>
                          ) : (
                             <><ScanSearch size={20} /> Phân tích AI & Tách ảnh</>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : isEcomGenerationTab(ecomSubTab) ? (
                ecomBatches.length === 0 && ecomHistoryItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-gray-500 h-full">
                    <ImageIcon size={64} className="opacity-20 mb-4" />
                    <p>Kết quả sẽ hiển thị ở đây</p>
                    <p className="text-xs mt-2 opacity-60">Chọn model rồi bấm Gen để tạo batch đầu tiên</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5 w-full">
                    {ecomBatches.map((batch) => {
                      const elapsed = ((batch.finishedAt || Date.now()) - batch.startedAt) / 1000;
                      const batchSettings: EcomGenerationSettings = {
                        prompt: batch.basePromptText || batch.promptText,
                        supplementaryPrompt: batch.supplementaryPrompt,
                        promptId: batch.promptId,
                        promptSource: batch.promptSource,
                        inputImage: batch.inputImage,
                        inputImages: batch.inputImages,
                        modelKey: batch.model,
                        aspectRatio: batch.aspectRatio,
                        imageSize: batch.imageSize,
                        imageCount: batch.imageCount,
                        t2iMode: batch.t2iMode,
                        mediaType: batch.mediaType,
                        duration: batch.duration,
                        generateAudio: batch.generateAudio,
                      };
                      return (
                        <div
                          key={batch.id}
                          className="rounded-2xl p-4 flex flex-col gap-3"
                          style={{
                            background: 'var(--color-card-secondary)',
                            border: '0.5px solid var(--color-border-soft)',
                          }}
                        >
                          {/* Batch header */}
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                {batch.status === 'running' && (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
                                    <Loader2 size={10} className="animate-spin" />
                                    Đang gen
                                  </span>
                                )}
                                {batch.status === 'done' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: 'rgba(52,199,89,0.15)', color: 'var(--color-success)' }}>
                                    <CheckCircle2 size={10} />
                                    Xong ({elapsed.toFixed(0)}s)
                                  </span>
                                )}
                                {batch.status === 'failed' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: 'rgba(255,59,48,0.15)', color: 'var(--color-danger)' }}>
                                    <AlertCircle size={10} />
                                    Fail
                                  </span>
                                )}
                                {batch.t2iMode && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: 'rgba(175,82,222,0.15)', color: '#af52de' }}>
                                    T2I
                                  </span>
                                )}
                                <span className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>
                                  {batch.model} • {batch.aspectRatio} • {batch.imageSize.toUpperCase()} • {batch.mediaType === 'video' ? `${batch.duration || 4}s video` : `${batch.imageCount} ảnh`}
                                </span>
                                {batch.status === 'done' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => reuseEcomGeneration(batchSettings)}
                                      className="px-2 py-1 rounded-lg inline-flex items-center gap-1 text-[10px] font-semibold"
                                      style={{ background: 'var(--color-fill)', color: 'var(--color-accent)' }}
                                      title="Nạp lại ảnh, prompt và cài đặt để chỉnh sửa"
                                    >
                                      <RotateCcw size={10} /> Sử dụng lại
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => regenerateEcomGeneration(batchSettings)}
                                      className="px-2 py-1 rounded-lg inline-flex items-center gap-1 text-[10px] font-semibold"
                                      style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                                      title="Tạo ngay một batch mới với toàn bộ cài đặt cũ"
                                    >
                                      <Sparkles size={10} /> Gen lại
                                    </button>
                                  </>
                                )}
                              </div>
                              <div className="flex items-start gap-2">
                                {batch.promptSource === 'saved' && (
                                  <Save
                                    size={11}
                                    className="mt-0.5 shrink-0"
                                    style={{ color: 'var(--color-text-tertiary)' }}
                                    aria-label={`Prompt đã lưu: ${batch.promptLabel || '(không tên)'}`}
                                  />
                                )}
                                <p
                                  className="flex-1 min-w-0 text-xs whitespace-pre-wrap"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                  title={batch.promptSource === 'saved' && !isAdmin ? (batch.promptLabel || 'Prompt đã lưu') : batch.promptText}
                                >
                                  {batch.promptSource === 'saved' && !isAdmin ? (batch.promptLabel || 'Prompt đã lưu') : batch.promptText}
                                  {!(batch.promptSource === 'saved' && !isAdmin) && batch.promptText && <button
                                    type="button"
                                    onClick={() => void copyEcomPrompt(batch.promptText, `batch-${batch.id}`)}
                                    className="inline-flex items-center justify-center ml-1 p-1 rounded-md transition-colors"
                                    style={{
                                      verticalAlign: 'middle',
                                      color: copiedPromptKey === `batch-${batch.id}` ? 'var(--color-success)' : 'var(--color-text-tertiary)',
                                      background: 'var(--color-fill)',
                                    }}
                                    title="Copy prompt"
                                    aria-label="Copy prompt của batch"
                                  >
                                    {copiedPromptKey === `batch-${batch.id}` ? <Check size={12} /> : <Copy size={12} />}
                                  </button>}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setEcomBatches((prev) => prev.filter(b => b.id !== batch.id))}
                                className="p-1.5 rounded-lg"
                                style={{ color: 'var(--color-text-tertiary)' }}
                                title="Xoá batch khỏi danh sách"
                                aria-label="Xoá batch"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Batch body */}
                          {(() => {
                            // Fix card size at 1/3 width regardless of imageCount — empty cells stay invisible
                            const batchGridCols = batch.mediaType === 'video' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3';
                            return batch.status === 'running' ? (
                            <div className={`grid ${batchGridCols} gap-3`}>
                              {Array.from({ length: batch.imageCount }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`relative overflow-hidden ${batch.mediaType === 'video' ? 'aspect-video' : 'aspect-[3/4]'} flex flex-col items-center justify-center gap-3`}
                                  style={{
                                    borderRadius: 14,
                                    background:
                                      'linear-gradient(155deg, var(--color-card) 0%, var(--color-card-secondary) 60%, var(--color-fill) 100%)',
                                    border: '1px solid var(--color-border-soft)',
                                    boxShadow:
                                      'inset 0 2px 6px rgba(60,70,100,0.13), inset 0 -1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(60,70,100,0.08)',
                                  }}
                                >
                                  {/* shimmer sweep */}
                                  <div
                                    className="absolute inset-0 pointer-events-none"
                                    style={{
                                      background:
                                        'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.32) 50%, transparent 75%)',
                                      backgroundSize: '200% 100%',
                                      animation: 'ofa-shimmer 1.6s linear infinite',
                                    }}
                                  />
                                  <Loader2 className="animate-spin relative z-10" size={26} style={{ color: 'var(--color-accent)' }} />
                                  <p className="relative z-10 animate-pulse" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                                    {batch.mediaType === 'video' ? 'Đang tạo video…' : `Đang tạo ảnh ${i + 1}...`}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : batch.status === 'failed' ? (
                            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(255,59,48,0.08)', color: 'var(--color-danger)' }}>
                              {batch.errorMessage || 'Lỗi không rõ'}
                            </div>
                          ) : (
                            <div className={`grid ${batchGridCols} gap-3 items-start`}>
                              {batch.results.map((res, i) => (
                                <div
                                  key={i}
                                  className="relative group overflow-hidden"
                                  style={{ borderRadius: 14, background: 'var(--color-card-secondary)' }}
                                >
                                  {batch.mediaType === 'video' ? (
                                    <>
                                      <video src={res} controls playsInline preload="metadata" className="block w-full max-h-[70vh] bg-black" />
                                    <button
                                      onClick={() => handleImageDownload(res, `ecom-${batch.id}-${i + 1}.mp4`)}
                                      className="absolute top-2 right-2 p-2 rounded-lg text-white"
                                      style={{ background: 'rgba(0,0,0,.58)', backdropFilter: 'blur(10px)' }}
                                      title="Tải video"
                                    >
                                      <Download size={16} />
                                    </button>
                                    </>
                                  ) : (
                                    <>
                                      <img src={res} alt={`Batch ${batch.id} #${i+1}`} className="block w-full h-auto" />
                                      <div className="image-action-overlay absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                        <button onClick={() => setZoomImage(res)} className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg transition" title="Phóng to"><ZoomIn size={16} /></button>
                                        <button onClick={() => setSelectedEcomGrid(res)} className="px-3 py-1.5 bg-white text-black font-bold rounded-lg flex items-center gap-1.5 text-[11px]"><Crop size={12} /> Chọn Tách</button>
                                        <button onClick={() => useEcomImageAsInput(res)} className="px-3 py-1.5 bg-indigo-500 text-white font-bold rounded-lg flex items-center gap-1.5 text-[11px] hover:bg-indigo-600 transition-colors"><Copy size={12} /> Dùng làm Mẫu</button>
                                        <button onClick={() => handleImageDownload(res, `ecom-${batch.id}-${i + 1}.png`)} className="px-3 py-1.5 bg-editor-accent text-white font-bold rounded-lg flex items-center gap-1.5 text-[11px]"><Download size={12} /> Tải</button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                          })()}
                        </div>
                      );
                    })}
                    {(() => {
                      const currentResultUrls = new Set(ecomBatches.flatMap((batch) => batch.results));
                      const visibleHistory = ecomHistoryItems.filter((item) => !currentResultUrls.has(item.url));
                      if (visibleHistory.length === 0) return null;

                      const historyGroups = visibleHistory.reduce<Array<{ key: string; items: EcomHistoryItem[] }>>((groups, item) => {
                        const key = item.batchId || item.id;
                        const existing = groups.find((group) => group.key === key);
                        if (existing) existing.items.push(item);
                        else groups.push({ key, items: [item] });
                        return groups;
                      }, []);

                      return (
                        <section
                          className="rounded-2xl p-4"
                          style={{
                            background: 'var(--color-card-secondary)',
                            border: '0.5px solid var(--color-border-soft)',
                          }}
                        >
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <Clock size={15} style={{ color: 'var(--color-accent)' }} />
                              <div className="min-w-0">
                                <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>Lịch sử 7 ngày</p>
                                <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                                  {visibleHistory.length} kết quả Gen New gần nhất
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsHistoryOpen(true)}
                              className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                              style={{ background: 'var(--color-fill)', color: 'var(--color-accent)' }}
                            >
                              Xem tất cả
                            </button>
                          </div>
                          <div className="flex flex-col gap-4">
                            {historyGroups.map((historyGroup) => {
                              const representative = historyGroup.items[0];
                              const protectedSavedPrompt = representative.promptSource === 'saved' && !isAdmin;
                              const historyPrompt = protectedSavedPrompt ? '' : representative.supplementaryPrompt?.trim()
                                ? `${representative.prompt || ''}\n\n[YÊU CẦU BỔ SUNG — ƯU TIÊN CAO]:\n${representative.supplementaryPrompt.trim()}`
                                : (representative.prompt || '');
                              const copyKey = `history-${historyGroup.key}`;
                              const historySettings: EcomGenerationSettings = {
                                prompt: representative.prompt,
                                supplementaryPrompt: representative.supplementaryPrompt,
                                promptId: representative.promptId,
                                promptSource: representative.promptSource,
                                inputImage: representative.inputImage,
                                inputImages: representative.inputImages,
                                modelKey: representative.modelKey,
                                aspectRatio: representative.aspectRatio,
                                imageSize: representative.size,
                                imageCount: representative.imageCount,
                                t2iMode: representative.t2iMode,
                                mediaType: representative.mediaType,
                                duration: representative.duration,
                                generateAudio: representative.generateAudio,
                              };
                              const canRegenerate = Boolean(
                                representative.t2iMode
                                || representative.inputImage
                                || representative.inputImages?.length,
                              );

                              return (
                                <div
                                  key={historyGroup.key}
                                  className="relative p-3 rounded-xl"
                                  style={{ background: 'var(--color-card)', border: '1px solid var(--color-border-soft)' }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setPendingEcomHistoryDelete({
                                      key: historyGroup.key,
                                      items: historyGroup.items,
                                    })}
                                    className="absolute top-3 right-3 p-2 rounded-lg transition-colors"
                                    style={{ color: 'var(--color-text-tertiary)', background: 'var(--color-fill)' }}
                                    title="Xoá lần gen này khỏi lịch sử"
                                    aria-label="Xoá lần gen khỏi lịch sử"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                  <div className="flex items-start gap-3 mb-3 pr-10">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>
                                          {representative.model || 'Gen New'}{representative.aspectRatio ? ` • ${representative.aspectRatio}` : ''}{representative.size ? ` • ${representative.size.toUpperCase()}` : ''}{representative.mediaType === 'video' ? ` • ${representative.duration || 4}s video` : ` • ${historyGroup.items.length} ảnh`}
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => reuseEcomGeneration(historySettings)}
                                          className="px-2 py-1 rounded-lg inline-flex items-center gap-1 text-[10px] font-semibold"
                                          style={{ background: 'var(--color-fill)', color: 'var(--color-accent)' }}
                                          title="Nạp lại ảnh, prompt và cài đặt để chỉnh sửa"
                                        >
                                          <RotateCcw size={10} /> Sử dụng lại
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => regenerateEcomGeneration(historySettings)}
                                          disabled={!canRegenerate}
                                          className="px-2 py-1 rounded-lg inline-flex items-center gap-1 text-[10px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                                          style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                                          title={canRegenerate
                                            ? 'Tạo ngay một batch mới với toàn bộ cài đặt cũ'
                                            : 'Lịch sử cũ này không còn lưu ảnh đầu vào để gen lại'}
                                        >
                                          <Sparkles size={10} /> Gen lại
                                        </button>
                                      </div>
                                      {historyPrompt && (
                                        <p
                                          className="text-xs whitespace-pre-wrap"
                                          style={{ color: 'var(--color-text-secondary)' }}
                                          title={historyPrompt}
                                        >
                                          {historyPrompt}
                                          <button
                                            type="button"
                                            onClick={() => void copyEcomPrompt(historyPrompt, copyKey)}
                                            className="inline-flex items-center justify-center ml-1 p-1 rounded-md transition-colors"
                                            style={{
                                              verticalAlign: 'middle',
                                              color: copiedPromptKey === copyKey ? 'var(--color-success)' : 'var(--color-text-tertiary)',
                                              background: 'var(--color-fill)',
                                            }}
                                            title="Copy prompt"
                                            aria-label="Copy prompt của lần gen"
                                          >
                                            {copiedPromptKey === copyKey ? <Check size={13} /> : <Copy size={13} />}
                                          </button>
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                                    {historyGroup.items.map((item, index) => (
                                      <div
                                        key={item.id}
                                        className="relative group overflow-hidden"
                                        style={{ borderRadius: 14, background: 'var(--color-card-secondary)' }}
                                      >
                                        {item.mediaType === 'video' ? (
                                          <>
                                            <video src={item.url} controls playsInline preload="metadata" className="block w-full max-h-[70vh] bg-black" />
                                            <button
                                              onClick={() => handleImageDownload(item.url, `ecom-history-${item.id}.mp4`)}
                                              className="absolute top-2 right-2 p-2 rounded-lg text-white"
                                              style={{ background: 'rgba(0,0,0,.58)', backdropFilter: 'blur(10px)' }}
                                              title="Tải video"
                                            >
                                              <Download size={16} />
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <img src={item.url} alt={`Lịch sử Gen New ${index + 1}`} className="block w-full h-auto" />
                                            <div className="image-action-overlay absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                              <button onClick={() => setZoomImage(item.url)} className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg transition" title="Phóng to"><ZoomIn size={16} /></button>
                                              <button onClick={() => useEcomImageAsInput(item.url)} className="px-3 py-1.5 bg-indigo-500 text-white font-bold rounded-lg flex items-center gap-1.5 text-[11px]"><Copy size={12} /> Dùng làm Mẫu</button>
                                              <button onClick={() => handleImageDownload(item.url, `ecom-history-${item.id}.png`)} className="px-3 py-1.5 bg-editor-accent text-white font-bold rounded-lg flex items-center gap-1.5 text-[11px]"><Download size={12} /> Tải</button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })()}
                  </div>
                )
              ) : isEcomGenerating ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: ecomImageCount }).map((_, i) => (
                    <div
                      key={i}
                      className="relative overflow-hidden aspect-[3/4] flex flex-col items-center justify-center gap-4"
                      style={{
                        borderRadius: 14,
                        background:
                          'linear-gradient(155deg, var(--color-card) 0%, var(--color-card-secondary) 60%, var(--color-fill) 100%)',
                        border: '1px solid var(--color-border-soft)',
                        boxShadow:
                          'inset 0 2px 6px rgba(60,70,100,0.13), inset 0 -1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(60,70,100,0.08)',
                      }}
                    >
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.32) 50%, transparent 75%)',
                          backgroundSize: '200% 100%',
                          animation: 'ofa-shimmer 1.6s linear infinite',
                        }}
                      />
                      <Loader2 className="animate-spin relative z-10" size={32} style={{ color: 'var(--color-accent)' }} />
                      <p className="relative z-10 animate-pulse" style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Đang tạo ảnh {i + 1}...</p>
                    </div>
                  ))}
                </div>
              ) : ecomResults.length > 0 ? (
                <div className="grid gap-4 items-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {ecomResults.map((res, i) => (
                    <div
                      key={i}
                      className="relative group overflow-hidden"
                      style={{ borderRadius: 14, background: 'var(--color-card-secondary)' }}
                    >
                      <img src={res} alt={`Result ${i+1}`} className="block w-full h-auto" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setZoomImage(res)}
                            className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg transition"
                            title="Phóng to"
                          >
                            <ZoomIn size={18} />
                          </button>
                        </div>

                        <button 
                          onClick={() => setSelectedEcomGrid(res)}
                          className="px-4 py-2 bg-white text-black font-bold rounded-lg flex items-center gap-2 w-32 justify-center text-xs"
                        >
                          <Crop size={14} /> Chọn Tách
                        </button>
                        <button 
                          onClick={() => handleImageDownload(res, `ecom-result-${i + 1}-${Date.now()}.png`)}
                          className="px-4 py-2 bg-editor-accent text-white font-bold rounded-lg flex items-center gap-2 w-32 justify-center text-xs"
                        >
                          <Download size={14} /> Tải xuống
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-500 h-full">
                  <ImageIcon size={64} className="opacity-20 mb-4" />
                  <p>Kết quả sẽ hiển thị ở đây</p>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {appMode === 'ofa' && (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 xl:gap-6">
          {/* Left panel: settings */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div
              className="p-5 flex flex-col gap-4"
              style={{
                background: 'var(--color-card)',
                border: '0.5px solid var(--color-border-soft)',
                borderRadius: 18,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {/* Title row */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
                  <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)', letterSpacing: '-0.02em' }}>OFA Studio</h2>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '4px 9px', borderRadius: 999, background: 'var(--color-fill)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>One-For-All</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  Một sản phẩm → cả bộ ảnh detail page. Nhập thông tin, chọn các mục ảnh muốn có, AI tạo song song.
                </p>
              </div>

              {/* 1. Sản phẩm — name + description */}
              <div className="p-3 flex flex-col gap-2" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center justify-center font-bold rounded-full" style={{ width: 20, height: 20, fontSize: 11, background: 'var(--color-accent)', color: '#fff' }}>1</span>
                  <p className="font-semibold uppercase" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Sản phẩm</p>
                </div>
                <input
                  type="text"
                  value={ofaProductName}
                  onChange={(e) => setOfaProductName(e.target.value)}
                  placeholder="Tên sản phẩm (vd: Set chăn ga 4 món hoạ tiết hoa)"
                  className="w-full outline-none"
                  style={{ padding: '10px 12px', borderRadius: 11, border: '1px solid transparent', background: 'var(--color-fill)', color: 'var(--color-text)', fontSize: 12.5, fontWeight: 500 }}
                />
                <textarea
                  value={ofaDescription}
                  onChange={(e) => setOfaDescription(e.target.value)}
                  placeholder="Mô tả ngắn: chất liệu, ưu điểm, đối tượng…"
                  rows={3}
                  className="w-full outline-none resize-none"
                  style={{ padding: '10px 12px', borderRadius: 11, border: '1px solid transparent', background: 'var(--color-fill)', color: 'var(--color-text)', fontSize: 12, lineHeight: 1.5 }}
                />
              </div>

              {/* 2. Ảnh tham khảo — 3 slots */}
              <div className="p-3" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center justify-center font-bold rounded-full" style={{ width: 20, height: 20, fontSize: 11, background: 'var(--color-accent)', color: '#fff' }}>2</span>
                  <p className="font-semibold uppercase" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Ảnh tham khảo (tối đa 3)</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((slot) => {
                    const img = ofaImages[slot];
                    return (
                      <div
                        key={slot}
                        onDragOver={(e) => { e.preventDefault(); setOfaDragOver(slot); }}
                        onDragLeave={() => setOfaDragOver(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setOfaDragOver(null);
                          const f = e.dataTransfer.files?.[0];
                          if (f) loadFileToOfa(f, slot);
                        }}
                        onClick={() => ofaInputRefs.current[slot]?.click()}
                        className="aspect-square flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition-all"
                        style={{
                          borderRadius: 11,
                          background: img ? 'var(--color-card)' : 'var(--color-card)',
                          border: `2px dashed ${ofaDragOver === slot ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          color: 'var(--color-text-tertiary)',
                        }}
                      >
                        {img ? (
                          <>
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOfaImages((prev) => prev.map((v, i) => (i === slot ? null : v)));
                              }}
                              className="absolute top-1 right-1 rounded-full p-1"
                              style={{ background: 'rgba(0,0,0,0.6)' }}
                            >
                              <X size={12} color="white" />
                            </button>
                          </>
                        ) : (
                          <Plus size={20} />
                        )}
                        <input
                          ref={(el) => { ofaInputRefs.current[slot] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) loadFileToOfa(f, slot);
                            e.currentTarget.value = '';
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Mục ảnh muốn tạo — chip pills */}
              <div className="p-3" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center font-bold rounded-full" style={{ width: 20, height: 20, fontSize: 11, background: 'var(--color-accent)', color: '#fff' }}>3</span>
                    <p className="font-semibold uppercase" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                      Mục ảnh ({ofaSelectedCategoryIds.length}/{OFA_PROMPT_LIBRARY.length})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOfaSelectedCategoryIds(OFA_PROMPT_LIBRARY.map((c) => c.id))}
                      className="font-semibold hover:opacity-80"
                      style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.04em' }}
                    >
                      TẤT CẢ
                    </button>
                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10 }}>·</span>
                    <button
                      type="button"
                      onClick={() => setOfaSelectedCategoryIds([])}
                      className="font-semibold hover:opacity-80"
                      style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}
                    >
                      BỎ
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {OFA_PROMPT_LIBRARY.map((c) => {
                    const selected = ofaSelectedCategoryIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleOfaCategory(c.id)}
                        className="transition-all"
                        style={{
                          padding: '7px 12px',
                          borderRadius: 9,
                          border: selected ? '1px solid var(--color-accent)' : '1px solid var(--color-border-soft)',
                          background: selected ? 'var(--color-accent-soft)' : 'var(--color-card)',
                          color: selected ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                          fontSize: 11.5,
                          fontWeight: 600,
                          boxShadow: selected ? 'none' : 'var(--sh-up-sm)',
                          cursor: 'pointer',
                        }}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Cài đặt — compact dropdown row (Model / AR / Quality) */}
              <div className="p-3 flex gap-2 items-start" style={{ background: 'var(--color-card-secondary)', borderRadius: 14, border: '1px solid var(--color-border-soft)', boxShadow: 'var(--sh-in)' }}>
                {(() => {
                  const modelOpts: SettingsDropdownOption<'gpt2' | 'banana-pro'>[] = [
                    { value: 'banana-pro', label: 'Banana Pro', icon: <ModelLogo model="banana-pro" /> },
                    { value: 'gpt2', label: 'GPT2', icon: <ModelLogo model="gpt2" /> },
                  ];
                  const arOpts: SettingsDropdownOption<string>[] = ['1:1', '3:4', '4:3', '9:16', '16:9'].map((a) => ({ value: a, label: a }));
                  const sizeOpts: SettingsDropdownOption<string>[] = ['1k', '2k', '4k'].map((s) => ({ value: s, label: s.toUpperCase() }));
                  return (
                    <>
                      <SettingsDropdown<'gpt2' | 'banana-pro'>
                        value={ofaModel}
                        onChange={(v) => setOfaModel(v)}
                        options={modelOpts}
                        width="fill"
                      />
                      <SettingsDropdown<string>
                        value={ofaAspectRatio}
                        onChange={(v) => setOfaAspectRatio(v)}
                        options={arOpts}
                      />
                      <SettingsDropdown<string>
                        value={ofaQuality}
                        onChange={(v) => setOfaQuality(v)}
                        options={sizeOpts}
                      />
                      <CreditEstimate
                        compact
                        credits={estimateGenerationCredits({
                          modelId: MODEL_CONFIG[ofaModel].id,
                          size: ofaQuality,
                          count: Math.max(1, ofaSelectedCategoryIds.length),
                        })}
                      />
                    </>
                  );
                })()}
              </div>

              {/* 5. Gen button */}
              <button
                onClick={handleOfaGenerate}
                className="w-full flex items-center justify-center gap-2 font-semibold transition-all"
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: 'var(--color-accent)',
                  color: '#fff',
                  fontSize: 15,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(37, 112, 224, 0.32)',
                }}
              >
                <Sparkles size={18} /> Tạo bộ ảnh OFA ({ofaSelectedCategoryIds.length} ảnh)
              </button>
              {(() => {
                const running = ofaBatches.filter((b) => b.status === 'running').length;
                const queued = ofaBatches.filter((b) => b.status === 'queued').length;
                if (running + queued === 0) return null;
                return (
                  <p className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                    {running} lượt đang chạy{queued > 0 ? `, ${queued} đang chờ` : ''} (cap {OFA_MAX_CONCURRENT})
                  </p>
                );
              })()}
            </div>
          </div>

          {/* Right panel: results */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div
              className="p-6 flex-1"
              style={{
                background: 'var(--color-card)',
                border: '0.5px solid var(--color-border-soft)',
                borderRadius: 18,
                boxShadow: 'var(--shadow-card)',
                minHeight: 600,
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>Kết quả</h3>
                {ofaBatches.some((b) => b.status === 'done' || b.status === 'cancelled' || b.status === 'error') && (
                  <button
                    type="button"
                    onClick={handleOfaClearFinished}
                    className="text-xs font-medium"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Xoá lượt đã xong
                  </button>
                )}
              </div>
              {ofaBatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20" style={{ color: 'var(--color-text-tertiary)' }}>
                  <ImageIcon size={56} className="opacity-20 mb-3" />
                  <p className="text-sm">Ảnh kết quả sẽ hiển thị ở đây — Sếp có thể bấm Gen liên tục, mỗi lượt là 1 section riêng.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {[...ofaBatches].reverse().map((batch) => {
                    const seq = ofaBatches.indexOf(batch) + 1;
                    const doneCount = batch.results.length;
                    const total = batch.categoryIds.length;
                    const time = new Date(batch.startedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    const statusBadge = (() => {
                      switch (batch.status) {
                        case 'queued': return { label: 'Đang chờ', bg: 'var(--color-fill)', color: 'var(--color-text-secondary)' };
                        case 'running': return { label: `Đang chạy ${doneCount}/${total}`, bg: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' };
                        case 'done': return { label: `Xong ${doneCount}/${total}`, bg: 'rgba(52,199,89,0.15)', color: 'var(--color-success)' };
                        case 'cancelled': return { label: `Đã huỷ ${doneCount}/${total}`, bg: 'rgba(255,149,0,0.15)', color: 'var(--color-warning)' };
                        case 'error': return { label: 'Lỗi', bg: 'rgba(255,59,48,0.15)', color: 'var(--color-danger)' };
                      }
                    })();
                    const canCancel = batch.status === 'queued' || batch.status === 'running';
                    return (
                      <div
                        key={batch.id}
                        className="p-3"
                        style={{
                          background: 'var(--color-fill)',
                          border: '0.5px solid var(--color-border-soft)',
                          borderRadius: 14,
                        }}
                      >
                        {/* Batch header */}
                        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="text-sm font-bold shrink-0" style={{ color: 'var(--color-text)' }}>
                              Lượt {seq}
                            </span>
                            <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                              {batch.productName} · {total} mục · {batch.quality.toUpperCase()} · {batch.aspectRatio} · {time}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className="px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                              style={{ background: statusBadge.bg, color: statusBadge.color }}
                            >
                              {batch.status === 'running' && <Loader2 size={10} className="animate-spin" />}
                              {statusBadge.label}
                            </span>
                            {canCancel && (
                              <button
                                type="button"
                                onClick={() => handleOfaCancel(batch.id)}
                                className="px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                                style={{ background: 'var(--color-danger)', color: 'white' }}
                                title="Huỷ lượt này"
                              >
                                <X size={10} /> Huỷ
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Batch grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {batch.categoryIds.map((catId) => {
                            const cat = OFA_PROMPT_LIBRARY.find((c) => c.id === catId);
                            if (!cat) return null;
                            const group = batch.results.find((g) => g.categoryId === catId);
                            const isDone = !!group;
                            const url = isDone ? group!.urls[0] : null;
                            const showSpinner = !isDone && (batch.status === 'running' || batch.status === 'queued');
                            return (
                              <div key={catId} className="flex flex-col gap-1">
                                <p className="text-xs font-semibold flex items-center gap-1 leading-tight" style={{ color: 'var(--color-text)' }}>
                                  <span style={{ color: 'var(--color-accent)' }}>#{cat.id}</span>
                                  <span className="truncate">{cat.name}</span>
                                </p>
                                {isDone && url ? (
                                  <div
                                    className="relative aspect-square rounded-md overflow-hidden group"
                                    style={{ background: 'var(--color-bg)' }}
                                  >
                                    <img
                                      src={url}
                                      alt={cat.name}
                                      className="w-full h-full object-cover cursor-zoom-in"
                                      onClick={() => setZoomImage(url)}
                                    />
                                    <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        onClick={() => setZoomImage(url)}
                                        className="rounded-full p-1.5"
                                        style={{ background: 'rgba(0,0,0,0.7)' }}
                                        title="Phóng to"
                                      >
                                        <ZoomIn size={12} color="white" />
                                      </button>
                                      <a
                                        href={url}
                                        download={`ofa-${seq}-${cat.code}.png`}
                                        className="rounded-full p-1.5"
                                        style={{ background: 'rgba(0,0,0,0.7)' }}
                                        title="Tải về"
                                      >
                                        <Download size={12} color="white" />
                                      </a>
                                    </div>
                                  </div>
                                ) : showSpinner ? (
                                  <div
                                    className="relative aspect-square rounded-md overflow-hidden flex items-center justify-center"
                                    style={{
                                      background: 'linear-gradient(90deg, var(--color-bg) 0%, var(--color-fill) 50%, var(--color-bg) 100%)',
                                      backgroundSize: '200% 100%',
                                      animation: 'ofa-shimmer 1.4s ease-in-out infinite',
                                    }}
                                  >
                                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />
                                  </div>
                                ) : (
                                  <div
                                    className="relative aspect-square rounded-md flex items-center justify-center"
                                    style={{ background: 'var(--color-bg)', border: '1px dashed var(--color-border-soft)' }}
                                  >
                                    <X size={16} style={{ color: 'var(--color-text-tertiary)', opacity: 0.5 }} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* Picset stays mounted across tab switches so in-flight analyze/generate doesn't lose state */}
      <div style={{ display: appMode === 'picset' ? 'block' : 'none' }}>
        <PicsetTab />
      </div>

      {/* Runninghub: stays mounted so polling continues if user tabs away mid-run */}
      <div style={{ display: appMode === 'runninghub' ? 'block' : 'none' }}>
        <RunninghubTab />
      </div>

      {appMode === 'clothing' && (
        <>
          {/* Tab Switcher (Apple HIG Segmented) */}
          <div className="mb-6">
            <Segmented<'generate' | 'analyze' | 'tryon'>
              value={activeTab}
              onChange={(v) => setActiveTab(v)}
              size="lg"
              fullWidth
              options={[
                { value: 'generate', label: 'Gen Ảnh', icon: Sparkles },
                { value: 'analyze', label: 'Phân Tích', icon: Search },
                { value: 'tryon', label: 'Thay Đồ', icon: Shirt },
              ]}
            />
          </div>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-5 xl:gap-6">
        {activeTab === 'generate' && (
          <>
            {/* Preview Area */}
            <div className="lg:col-span-2 flex flex-col gap-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="flex-1 relative overflow-hidden flex items-center justify-center min-h-[400px] lg:min-h-0 transition-all"
            style={{
              background: isDragging ? 'var(--color-accent-soft)' : 'var(--color-card)',
              border: isDragging ? '1px solid var(--color-accent)' : '0.5px solid var(--color-border-soft)',
              borderRadius: 18,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <AnimatePresence mode="wait">
              {images.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center transition-colors"
                    style={{
                      border: '2px dashed var(--color-border)',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium" style={{ color: 'var(--color-text)' }}>Tải lên tối đa 5 ảnh</p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Nhấn để mở thư viện ảnh</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key={currentImage?.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative w-full h-full p-4 grid grid-cols-1 md:grid-cols-2 gap-4 group"
                >
                  {/* Original Image Section */}
                  <div className="relative flex flex-col gap-2 h-full">
                    <div className="flex justify-between items-center">
                      <p
                        className="uppercase font-semibold"
                        style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                      >
                        Ảnh gốc
                      </p>
                      <button
                        onClick={() => {
                          setIsReplacing(true);
                          fileInputRef.current?.click();
                        }}
                        className="font-semibold hover:underline"
                        style={{ fontSize: 11, color: 'var(--color-accent)' }}
                      >
                        THAY ẢNH
                      </button>
                    </div>
                    <div
                      className="flex-1 relative rounded-lg overflow-hidden flex items-center justify-center cursor-pointer transition-colors"
                      style={{
                        background: 'var(--color-card-secondary)',
                        border: '0.5px solid var(--color-border-soft)',
                      }}
                      onClick={() => {
                        setIsReplacing(true);
                        fileInputRef.current?.click();
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-soft)')}
                    >
                      <img
                        src={currentImage?.source}
                        alt="Original"
                        className="max-w-full max-h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <div
                        className="absolute inset-0 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Upload size={24} className="text-white" />
                          <span className="text-[10px] font-bold text-white uppercase">Thay đổi ảnh gốc</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Processed Image Section */}
                  <div className="relative flex flex-col gap-2 h-full">
                    <div className="flex justify-between items-center">
                      <p
                        className="uppercase font-semibold"
                        style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.06em' }}
                      >
                        ✨ Sau xử lý
                      </p>
                      {currentImage?.processed && currentImage.processed !== currentImage.source && (
                        <button
                          onClick={() => handleAiEdit(selectedIndex)}
                          disabled={currentImage.isProcessing}
                          className="font-semibold hover:underline flex items-center gap-1"
                          style={{ fontSize: 11, color: 'var(--color-accent)' }}
                        >
                          <RotateCcw size={10} />
                          THỬ LẠI TỪ GỐC
                        </button>
                      )}
                    </div>
                    <div
                      className="flex-1 relative rounded-lg overflow-hidden flex items-center justify-center"
                      style={{
                        background: 'var(--color-card-secondary)',
                        border: '0.5px solid var(--color-border-soft)',
                      }}
                    >
                      {currentImage?.processed && currentImage.processed !== currentImage.source ? (
                        <img
                          src={currentImage.processed}
                          alt="Processed"
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          className="flex flex-col items-center justify-center gap-2"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          <ImageIcon size={32} />
                          <p className="uppercase font-semibold" style={{ fontSize: 10, letterSpacing: '0.06em' }}>Chưa xử lý</p>
                          <button
                            onClick={() => handleAiEdit(selectedIndex)}
                            className="mt-2 font-semibold transition-all hover:brightness-110"
                            style={{
                              padding: '8px 14px',
                              fontSize: 11,
                              background: 'var(--color-accent)',
                              color: '#fff',
                              borderRadius: 9999,
                              letterSpacing: '-0.01em',
                            }}
                          >
                            GEN ẢNH NÀY
                          </button>
                        </div>
                      )}

                      {/* Download Button Overlay for Result */}
                      {currentImage?.processed && currentImage.processed !== currentImage.source && !isBatchProcessing && (
                        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                          <button
                            onClick={() => handleDownload()}
                            className="flex items-center gap-2 font-semibold transition-all hover:brightness-110"
                            style={{
                              padding: '7px 11px',
                              fontSize: 12,
                              background: 'var(--color-accent)',
                              color: '#fff',
                              borderRadius: 10,
                              boxShadow: 'var(--shadow-pop)',
                            }}
                          >
                            <Download size={14} />
                            Lưu
                          </button>
                          <button
                            onClick={() => handleAiEdit(selectedIndex)}
                            className="flex items-center gap-2 font-semibold transition-all hover:brightness-110"
                            style={{
                              padding: '7px 11px',
                              fontSize: 12,
                              background: 'rgba(0,0,0,0.55)',
                              backdropFilter: 'blur(12px)',
                              color: '#fff',
                              borderRadius: 10,
                              boxShadow: 'var(--shadow-pop)',
                              border: '0.5px solid rgba(255,255,255,0.18)',
                            }}
                          >
                            <RotateCcw size={14} />
                            Gen lại
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Global Overlays */}
                  {currentImage?.isProcessing && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20"
                      style={{
                        background: 'color-mix(in srgb, var(--color-bg) 65%, transparent)',
                        backdropFilter: 'blur(12px)',
                      }}
                    >
                      <Loader2 className="animate-spin" size={48} style={{ color: 'var(--color-accent)' }} />
                      <div className="text-center">
                        <p className="font-bold" style={{ fontSize: 17, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                          Đang xử lý AI…
                        </p>
                        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                          Vui lòng đợi trong giây lát
                        </p>
                      </div>
                    </div>
                  )}

                  {currentImage?.error && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center z-20"
                      style={{
                        background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)',
                        backdropFilter: 'blur(12px)',
                      }}
                    >
                      <AlertCircle size={48} style={{ color: 'var(--color-danger)' }} />
                      <div>
                        <p className="font-bold" style={{ fontSize: 17, color: 'var(--color-danger)', letterSpacing: '-0.02em' }}>Lỗi xử lý</p>
                        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>{currentImage.error}</p>
                      </div>
                      <button
                        onClick={() => void handleAiEdit()}
                        className="font-semibold transition-all hover:brightness-110"
                        style={{
                          padding: '8px 16px',
                          fontSize: 13,
                          background: 'var(--color-fill)',
                          color: 'var(--color-text)',
                          borderRadius: 10,
                        }}
                      >
                        Thử lại
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple
              accept="image/*" 
              onChange={handleImageUpload} 
            />
          </div>

          {/* Batch Strip */}
          {images.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {images.map((img, idx) => {
                const active = selectedIndex === idx;
                return (
                  <div
                    key={img.id}
                    className="relative shrink-0 w-[72px] h-[72px] cursor-pointer group transition-all"
                    style={{
                      borderRadius: 12,
                      border: active ? '2px solid var(--color-accent)' : '1px solid var(--color-border-soft)',
                      overflow: 'visible',
                    }}
                    onClick={() => setSelectedIndex(idx)}
                  >
                    <img
                      src={img.processed || img.source}
                      className="w-full h-full object-cover"
                      style={{ borderRadius: 10 }}
                      alt={`Thumb ${idx}`}
                    />
                    {img.isProcessing && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', borderRadius: 10 }}
                      >
                        <Loader2 className="animate-spin" size={16} style={{ color: 'var(--color-accent)' }} />
                      </div>
                    )}
                    {img.processed && img.processed !== img.source && !img.isProcessing && (
                      <div
                        className="absolute top-1 right-1 rounded-full p-0.5 flex items-center justify-center"
                        style={{ background: 'var(--color-success)' }}
                      >
                        <CheckCircle2 className="text-white" size={11} />
                      </div>
                    )}
                    {img.error && (
                      <div
                        className="absolute top-1 right-1 rounded-full p-0.5 flex items-center justify-center"
                        style={{ background: 'var(--color-danger)' }}
                      >
                        <AlertCircle className="text-white" size={11} />
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(img.id);
                      }}
                      className="absolute -top-2 -right-2 rounded-full p-1 transition-colors z-10 opacity-0 group-hover:opacity-100"
                      style={{
                        background: 'var(--color-card)',
                        border: '0.5px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                        boxShadow: 'var(--shadow-pop)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--color-danger)';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--color-card)';
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
              {images.length < 5 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 w-[72px] h-[72px] flex flex-col items-center justify-center gap-1 transition-colors"
                  style={{
                    borderRadius: 12,
                    border: '1.5px dashed var(--color-border)',
                    color: 'var(--color-text-tertiary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                    e.currentTarget.style.color = 'var(--color-accent)';
                    e.currentTarget.style.background = 'var(--color-accent-soft)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.color = 'var(--color-text-tertiary)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Upload size={16} />
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.06em' }}>THÊM</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Controls Area */}
        <div className="flex flex-col gap-6">
          {/* Main Control Panel */}
          <div
            className="p-6 flex-1 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-150px)]"
            style={{
              background: 'var(--color-card)',
              border: '0.5px solid var(--color-border-soft)',
              borderRadius: 18,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="space-y-6 flex-1 flex flex-col">
              <div>
                <h3
                  className="font-bold flex items-center gap-2 mb-4"
                  style={{ fontSize: 17, color: 'var(--color-text)', letterSpacing: '-0.02em' }}
                >
                  <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
                  Google AI Engine
                </h3>
                
                {/* Model Selector — Apple HIG cards */}
                <ModelCardPicker<ModelType>
                  value={selectedModel}
                  onChange={(m) => setSelectedModel(m)}
                  options={IMAGE_MODEL_KEYS.map((m) => ({
                    value: m,
                    name: MODEL_CONFIG[m].name,
                    sub: MODEL_CONFIG[m].requiredKey === 'google' ? 'Google' : 'Kie.ai',
                    best: m === 'banana-pro',
                  }))}
                />
                <p
                  className="mb-6 mt-2 italic leading-tight"
                  style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}
                >
                  {MODEL_CONFIG[selectedModel].description}
                </p>

                {/* Aspect Ratio Selector - Integrated */}
                <div className="mb-6 space-y-3">
                  <div className="flex justify-between items-center">
                    <p
                      className="uppercase font-semibold"
                      style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                    >
                      Tỉ lệ khung hình
                    </p>
                    {images.length > 1 && (
                      <button
                        onClick={() => {
                          const currentRatio = images[selectedIndex].aspectRatio;
                          setImages(prev => prev.map(img => ({ ...img, aspectRatio: currentRatio })));
                        }}
                        className="font-semibold hover:underline"
                        style={{ fontSize: 11, color: 'var(--color-accent)' }}
                      >
                        ÁP DỤNG TẤT CẢ
                      </button>
                    )}
                  </div>
                  <ARSelector
                    value={(currentImage?.aspectRatio as any) || '1:1'}
                    onChange={(v) => {
                      setImages(prev => prev.map((img, idx) =>
                        idx === selectedIndex ? { ...img, aspectRatio: v } : img
                      ));
                    }}
                  />
                </div>

                <div className="flex items-center justify-between mb-4">
                  <p
                    className="uppercase font-semibold"
                    style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                  >
                    Danh sách Prompt đã lưu
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSelectedPromptId('manual');
                        setAiPrompt('');
                      }}
                      className="flex items-center gap-1 font-semibold hover:opacity-80 transition-opacity"
                      style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.04em' }}
                    >
                      <Edit2 size={12} />
                      NHẬP THỦ CÔNG
                    </button>
                    <button
                      onClick={() => setIsAddingPrompt(true)}
                      className="flex items-center gap-1 font-semibold hover:opacity-80 transition-opacity"
                      style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.04em' }}
                    >
                      <Plus size={12} />
                      THÊM MỚI
                    </button>
                  </div>
                </div>

                {isAddingPrompt ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl border border-editor-accent bg-editor-accent/5 space-y-3 mb-6"
                  >
                    <input 
                      type="text"
                      placeholder="Tên prompt (VD: Biển hoàng hôn)"
                      value={newPromptName}
                      onChange={(e) => setNewPromptName(e.target.value)}
                      className="w-full bg-black/40 border border-editor-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-editor-accent"
                    />
                    <textarea 
                      placeholder="Nội dung prompt chi tiết..."
                      value={newPromptText}
                      onChange={(e) => setNewPromptText(e.target.value)}
                      className="w-full bg-black/40 border border-editor-border rounded-lg px-3 py-2 text-xs min-h-[80px] focus:outline-none focus:border-editor-accent"
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={handleAddPrompt}
                        className="flex-1 py-2 bg-editor-accent text-white rounded-lg text-[10px] font-bold hover:opacity-90"
                      >
                        {editingPromptId ? 'CẬP NHẬT' : 'LƯU PROMPT'}
                      </button>
                      <button 
                        onClick={() => {
                          setIsAddingPrompt(false);
                          setEditingPromptId(null);
                          setNewPromptName('');
                          setNewPromptText('');
                        }}
                        className="px-4 py-2 border border-editor-border rounded-lg text-[10px] font-bold hover:bg-white/5"
                      >
                        HỦY
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-2 mb-6 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedPromptId === 'manual' && (
                      <div
                        className="flex items-center gap-3 p-3 rounded-xl border border-editor-accent bg-editor-accent/5 transition-all cursor-pointer"
                      >
                        <div className="shrink-0 w-2 h-2 rounded-full bg-editor-accent shadow-[0_0_8px_var(--color-accent)]" />
                        <p className="text-xs font-bold text-editor-accent">
                          📝 Nhập thủ công
                        </p>
                      </div>
                    )}
                    {savedGenPrompts.slice(0, 3).map((p) => (
                      <PromptRow
                        key={p.id}
                        name={p.name}
                        active={selectedPromptId === p.id}
                        synced={p.isDefault}
                        onClick={() => selectPrompt(p.id)}
                        showSync={isAdmin}
                        onSync={(e) => toggleSyncGenPrompt(p, e)}
                        showEdit={isAdmin || !p.isDefault}
                        showDelete={isAdmin || !p.isDefault}
                        onEdit={(e) => startEditPrompt(p, e)}
                        onDelete={(e) => deletePrompt(p.id, e)}
                      />
                    ))}
                    {savedGenPrompts.length > 3 && (
                      <button
                        onClick={() => setShowGenPromptModal(true)}
                        className="w-full flex items-center justify-center gap-1.5 transition-colors mt-1"
                        style={{
                          padding: '8px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--color-accent)',
                          background: 'var(--color-fill)',
                          borderRadius: 10,
                          letterSpacing: '-0.01em',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-soft)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-fill)')}
                      >
                        Xem tất cả ({savedGenPrompts.length})
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                )}

                {(isAdmin || selectedPromptId === 'manual') && (
                  <>
                    <p
                      className="uppercase font-semibold mb-3"
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-tertiary)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {selectedPromptId === 'manual' ? 'Nhập Prompt mới' : 'Nội dung Prompt hiện tại'}
                    </p>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Mô tả nền và phong cách... (VD: phong cách anime, nền bãi biển)"
                      className="w-full min-h-[100px] resize-none mb-6 outline-none transition-colors p-3"
                      style={{
                        background: 'var(--color-fill)',
                        color: 'var(--color-text)',
                        borderRadius: 12,
                        border: '0.5px solid transparent',
                        fontSize: 13,
                        letterSpacing: '-0.01em',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                    />
                  </>
                )}
                {!isAdmin && selectedPromptId !== 'manual' && selectedPromptId && (
                  <div
                    className="rounded-lg px-4 py-3 mb-6 flex items-center gap-2"
                    style={{
                      background: 'var(--color-accent-soft)',
                      border: '0.5px solid var(--color-accent)',
                    }}
                  >
                    <CheckCircle2 size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                    <p className="font-bold" style={{ fontSize: 12, color: 'var(--color-accent)' }}>
                      {selectedGenSavedPrompt?.name || 'Prompt đã lưu'} — sẵn sàng Gen
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-auto space-y-4">
                {globalError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-xs">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p>{globalError}</p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <CreditEstimate
                      compact
                      credits={estimateGenerationCredits({ modelId: MODEL_CONFIG[selectedModel].id, size: '1k', count: 1 })}
                      label="Ảnh hiện tại"
                    />
                    {images.length > 1 && (
                      <CreditEstimate
                        compact
                        credits={estimateGenerationCredits({ modelId: MODEL_CONFIG[selectedModel].id, size: '1k', count: images.length })}
                        label="Gen tất cả"
                      />
                    )}
                  </div>
                  <Button
                    variant="filled"
                    size="lg"
                    fullWidth
                    icon={currentImage?.isProcessing ? Loader2 : Sparkles}
                    onClick={() => handleAiEdit(selectedIndex)}
                    disabled={isBatchProcessing || images.length === 0 || !hasClothingPrompt || currentImage?.isProcessing}
                  >
                    {currentImage?.isProcessing ? 'Đang xử lý ảnh này…' : 'Gen ảnh hiện tại'}
                  </Button>

                  {images.length > 1 && (
                    <Button
                      variant="secondary"
                      size="md"
                      fullWidth
                      icon={isBatchProcessing ? Loader2 : Layers}
                      onClick={() => handleAiEdit()}
                      disabled={isBatchProcessing || !hasClothingPrompt}
                    >
                      {isBatchProcessing ? 'Đang xử lý hàng loạt…' : `Gen tất cả (${images.length} ảnh)`}
                    </Button>
                  )}
                </div>

                <p
                  className="text-center"
                  style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}
                >
                  {images.length > 0 ? `Đang chọn ảnh ${selectedIndex + 1}/${images.length}` : 'Vui lòng tải ảnh lên để bắt đầu'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    )}

        {activeTab === 'analyze' && (
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Analyze Tab Content — left card */}
            <div
              className="flex flex-col gap-4 p-6"
              style={{
                background: 'var(--color-card)',
                border: '0.5px solid var(--color-border-soft)',
                borderRadius: 18,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div>
                <p
                  className="uppercase font-semibold mb-1"
                  style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                >
                  Ảnh mẫu
                </p>
                <h2
                  className="font-bold"
                  style={{ fontSize: 22, color: 'var(--color-text)', letterSpacing: '-0.02em' }}
                >
                  Tải ảnh để AI phân tích
                </h2>
              </div>

              <div>
                <p
                  className="uppercase font-semibold mb-2"
                  style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                >
                  Loại phân tích
                </p>
                <Segmented<'fashion' | 'bedding'>
                  value={analyzeMode}
                  onChange={(v) => setAnalyzeMode(v)}
                  size="md"
                  fullWidth
                  options={[
                    { value: 'fashion', label: 'Fashion' },
                    { value: 'bedding', label: 'Bedding' },
                  ]}
                />
                <p className="mt-2" style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  {analyzeMode === 'fashion'
                    ? 'Sinh prompt tả phong cách chụp (JSON) — dùng để gen ảnh giống style.'
                    : 'Sinh 8 cặp HEADLINE + BODY tiếng Việt cho trang chi tiết chăn ga.'}
                </p>
              </div>

              <div
                onClick={() => analyzeFileInputRef.current?.click()}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setAnalyzeDragOver(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setAnalyzeDragOver(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAnalyzeDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('image/')) {
                    const r = new FileReader();
                    r.onload = (ev) => setAnalyzeImage(ev.target?.result as string);
                    r.readAsDataURL(file);
                  }
                }}
                className="aspect-video flex flex-col items-center justify-center gap-4 cursor-pointer transition-all relative overflow-hidden"
                style={{
                  background: analyzeDragOver ? 'var(--color-accent-soft)' : 'var(--color-card)',
                  border: analyzeDragOver ? '1px solid var(--color-accent)' : '0.5px solid var(--color-border-soft)',
                  borderRadius: 18,
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {analyzeImage ? (
                  <>
                    <img src={analyzeImage} alt="To analyze" className="w-full h-full object-contain" />
                    <div
                      className="absolute inset-0 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
                    >
                      <p className="text-sm font-bold text-white">Thay đổi ảnh</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{
                        background: 'var(--color-fill)',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      <Upload />
                    </div>
                    <div className="text-center">
                      <p className="font-bold" style={{ color: 'var(--color-text)' }}>Bấm để tải ảnh</p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                        Ảnh sản phẩm bạn muốn lấy phong cách
                      </p>
                    </div>
                  </>
                )}
                <input
                  type="file"
                  ref={analyzeFileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setAnalyzeImage(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>
              <Button
                variant="filled"
                size="lg"
                fullWidth
                onClick={handleAnalyzeImage}
                disabled={!analyzeImage || isAnalyzing}
                icon={isAnalyzing ? Loader2 : Search}
              >
                {isAnalyzing ? 'Đang phân tích…' : 'Bắt đầu phân tích'}
              </Button>
            </div>

            {/* Analyze right card — Kết quả Prompt JSON */}
            <div
              className="flex flex-col gap-4 p-6"
              style={{
                background: 'var(--color-card)',
                border: '0.5px solid var(--color-border-soft)',
                borderRadius: 18,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="flex items-end justify-between">
                <div>
                  <p
                    className="uppercase font-semibold mb-1"
                    style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                  >
                    Kết quả
                  </p>
                  <h2
                    className="font-bold"
                    style={{ fontSize: 22, color: 'var(--color-text)', letterSpacing: '-0.02em' }}
                  >
                    Prompt JSON
                  </h2>
                </div>
                {analyzedPrompt && (
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(analyzedPrompt);
                        setAnalyzedCopied(true);
                        setTimeout(() => setAnalyzedCopied(false), 1800);
                      } catch (err) {
                        console.error('Copy failed:', err);
                      }
                    }}
                    className="flex items-center gap-1 font-semibold transition-all hover:brightness-110"
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      borderRadius: 10,
                      background: analyzedCopied ? 'var(--color-success)' : 'var(--color-fill)',
                      color: analyzedCopied ? '#fff' : 'var(--color-text-secondary)',
                    }}
                    title="Sao chép kết quả"
                  >
                    {analyzedCopied ? (
                      <><CheckCircle2 size={12} /> Đã copy</>
                    ) : (
                      <><Copy size={12} /> Copy</>
                    )}
                  </button>
                )}
              </div>
              <div
                className="flex-1 min-h-[300px] p-4 font-mono text-xs overflow-auto"
                style={{
                  background: '#0f0f12',
                  color: '#a8d5ff',
                  borderRadius: 14,
                }}
              >
                {analyzedPrompt ? (
                  <pre className="whitespace-pre-wrap">{analyzedPrompt}</pre>
                ) : (
                  <div className="h-full flex items-center justify-center italic" style={{ color: 'rgba(168,213,255,0.4)' }}>
                    Kết quả phân tích sẽ hiện ở đây...
                  </div>
                )}
              </div>
              {analyzedPrompt && (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    icon={Save}
                    onClick={saveAnalyzedPrompt}
                  >
                    Lưu Prompt
                  </Button>
                  <Button
                    variant="filled"
                    size="md"
                    fullWidth
                    icon={Copy}
                    onClick={useAnalyzedPrompt}
                  >
                    Sử dụng ngay
                  </Button>
                </div>
              )}
            </div>

            {/* Save Prompt Modal */}
            <AnimatePresence>
              {isSavingAnalyzed && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSavingAnalyzed(false)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-md glass-panel p-6 space-y-4 shadow-2xl border-editor-accent/30"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-editor-accent/20 flex items-center justify-center">
                        <Save className="text-editor-accent" size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">Lưu Prompt</h3>
                        <p className="text-xs text-gray-400">Đặt tên cho prompt vừa phân tích</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Tên prompt</label>
                      <input 
                        type="text"
                        autoFocus
                        value={savePromptName}
                        onChange={(e) => setSavePromptName(e.target.value)}
                        placeholder="VD: Phong cách Chụp Flat Lay..."
                        className="w-full bg-black/40 border border-editor-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-editor-accent transition-all"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmSaveAnalyzedPrompt();
                          if (e.key === 'Escape') setIsSavingAnalyzed(false);
                        }}
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => setIsSavingAnalyzed(false)}
                        className="flex-1 py-3 border border-editor-border rounded-xl text-sm font-bold hover:bg-white/5 transition-all"
                      >
                        HỦY
                      </button>
                      <button 
                        onClick={confirmSaveAnalyzedPrompt}
                        className="flex-1 py-3 bg-editor-accent text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all"
                      >
                        LƯU NGAY
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === 'tryon' && (
          <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Model Image Upload */}
                <div className="flex flex-col gap-3">
                  <p
                    className="uppercase font-semibold"
                    style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                  >
                    Ảnh người mẫu (Model)
                  </p>
                  <div
                    onClick={() => { setPasteTargetId('tryon-model'); modelFileInputRef.current?.click(); }}
                    {...makeDropHandlers('tryon-model', setTryOnModelImage)}
                    className="aspect-[3/4] relative overflow-hidden flex items-center justify-center cursor-pointer transition-all"
                    style={{
                      background: dragOverId === 'tryon-model' ? 'var(--color-accent-soft)' : 'var(--color-card)',
                      border: `2px dashed ${dragOverId === 'tryon-model' || tryOnModelImage ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      borderRadius: 14,
                    }}
                  >
                    {tryOnModelImage ? (
                      <>
                        <img src={tryOnModelImage} alt="Model" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        <button
                          onClick={(e) => { e.stopPropagation(); setZoomImage(tryOnModelImage); }}
                          className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-md backdrop-blur-sm border border-white/20 transition-colors z-10"
                          title="Phóng to"
                        >
                          <ZoomIn size={14} />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
                        <UserIcon size={32} />
                        <span style={{ fontSize: 12 }}>Tải ảnh người mẫu</span>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={modelFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleTryOnUpload(e, 'model')} />

                  {/* Saved Models List — 2 sections: SHARED + PERSONAL */}
                  {(() => {
                    const sharedModels = savedModels.filter(m => m.isShared);
                    const personalModels = savedModels.filter(m => !m.isShared && m.uid === user?.uid);
                    const renderModelCell = (model: SavedModel, allowEdit: boolean) => {
                      const isMarkedForDelete = draftDeletedModelIds.has(model.id);
                      return (
                        <div
                          key={model.id}
                          className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all group ${
                            isMarkedForDelete
                              ? 'border-red-500 opacity-50'
                              : tryOnModelImage === model.imageUrl ? 'border-editor-accent cursor-pointer' : 'border-editor-border hover:border-gray-600 cursor-pointer'
                          }`}
                          onClick={() => {
                            if (!isEditingSavedModels) {
                              setTryOnModelImage(model.imageUrl);
                            }
                          }}
                        >
                          <img src={model.imageUrl} alt="Saved Model" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          {isEditingSavedModels && allowEdit ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (model.isShared && !window.confirm("Người mẫu này đang chia sẻ cho cả công ty. Xóa sẽ làm nhân viên mất quyền dùng. Tiếp tục?")) return;
                                setDraftDeletedModelIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(model.id)) next.delete(model.id);
                                  else next.add(model.id);
                                  return next;
                                });
                              }}
                              className={`absolute top-1 right-1 p-1 rounded-md transition-colors ${isMarkedForDelete ? 'bg-red-500 text-white' : 'bg-black/70 hover:bg-red-500 text-white'}`}
                              title={isMarkedForDelete ? 'Bỏ chọn xóa' : 'Đánh dấu xóa'}
                            >
                              <Trash2 size={10} />
                            </button>
                          ) : (
                            <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isAdmin && !isEditingSavedModels && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleSyncModel(model); }}
                                  className={`p-1 rounded-md ${model.isShared ? 'bg-blue-500 text-white' : 'bg-black/70 text-white hover:bg-blue-500'}`}
                                  title={model.isShared ? 'Bỏ chia sẻ' : 'Chia sẻ cho cả công ty'}
                                >
                                  <Globe size={10} />
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); setZoomImage(model.imageUrl); }}
                                className="p-1 bg-black/70 text-white rounded-md hover:bg-black"
                                title="Phóng to"
                              >
                                <ZoomIn size={10} />
                              </button>
                            </div>
                          )}
                          {model.isShared && (
                            <div className="absolute top-1 left-1 px-1 py-0.5 bg-blue-500/80 rounded text-[7px] font-bold text-white">CHUNG</div>
                          )}
                          {isMarkedForDelete && (
                            <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center pointer-events-none">
                              <span className="text-[9px] font-bold text-white bg-red-600 px-2 py-0.5 rounded">SẼ XÓA</span>
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-end gap-3">
                          {isEditingSavedModels ? (
                            <>
                              <button
                                onClick={async () => {
                                  for (const id of draftDeletedModelIds) {
                                    await handleDeleteModel(id);
                                  }
                                  setDraftDeletedModelIds(new Set());
                                  setIsEditingSavedModels(false);
                                }}
                                className="font-semibold hover:underline flex items-center gap-1"
                                style={{ fontSize: 11, color: 'var(--color-accent)' }}
                              >
                                <Check size={10} /> LƯU
                              </button>
                              <button
                                onClick={() => { setDraftDeletedModelIds(new Set()); setIsEditingSavedModels(false); }}
                                className="font-semibold hover:underline flex items-center gap-1"
                                style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}
                              >
                                <X size={10} /> HỦY
                              </button>
                            </>
                          ) : (
                            (personalModels.length > 0 || (isAdmin && sharedModels.length > 0)) && (
                              <button
                                onClick={() => setIsEditingSavedModels(true)}
                                className="font-semibold hover:underline flex items-center gap-1 transition-colors"
                                style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                              >
                                <Pencil size={10} /> CHỈNH SỬA
                              </button>
                            )
                          )}
                        </div>

                        {/* SECTION 1: NGƯỜI MẪU CHUNG OTAMA */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <p
                              className="uppercase font-semibold flex items-center gap-1"
                              style={{ fontSize: 11, color: 'var(--color-teal)', letterSpacing: '0.06em' }}
                            >
                              <Globe size={10} /> Người mẫu chung Otama ({sharedModels.length}/5)
                            </p>
                            {isAdmin && sharedModels.length < 5 && !isEditingSavedModels && (
                              <button
                                onClick={() => {
                                  if (!user) { handleLogin(); return; }
                                  setPendingUploadAsSharedModel(true);
                                  modelListFileInputRef.current?.click();
                                }}
                                disabled={isSavingModel}
                                className="font-semibold hover:underline flex items-center gap-1 disabled:opacity-50"
                                style={{ fontSize: 11, color: 'var(--color-teal)' }}
                              >
                                {isSavingModel ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                                THÊM VÀO KHO CHUNG
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            {sharedModels.map(m => renderModelCell(m, isAdmin))}
                            {Array.from({ length: 5 - sharedModels.length }).map((_, i) => (
                              <div
                                key={`empty-shared-${i}`}
                                onClick={() => {
                                  if (!isAdmin || isEditingSavedModels) return;
                                  if (!user) { handleLogin(); return; }
                                  setPendingUploadAsSharedModel(true);
                                  modelListFileInputRef.current?.click();
                                }}
                                className={`aspect-[3/4] rounded-lg border-2 border-dashed border-blue-500/30 flex items-center justify-center bg-blue-500/5 ${isAdmin && !isEditingSavedModels ? 'cursor-pointer hover:border-blue-500 hover:bg-blue-500/10' : ''}`}
                                title={isAdmin && !isEditingSavedModels ? 'Bấm để thêm vào kho chung' : ''}
                              >
                                {isAdmin && !isEditingSavedModels ? <Plus size={16} className="text-blue-500/60" /> : <UserIcon size={16} className="text-blue-500/40" />}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* SECTION 2: NGƯỜI MẪU CÁ NHÂN */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <p
                              className="uppercase font-semibold flex items-center gap-1"
                              style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.06em' }}
                            >
                              <UserIcon size={10} /> Người mẫu cá nhân ({personalModels.length}/5)
                            </p>
                            {personalModels.length < 5 && !isEditingSavedModels && (
                              <button
                                onClick={() => {
                                  if (!user) { handleLogin(); } else { modelListFileInputRef.current?.click(); }
                                }}
                                disabled={isSavingModel}
                                className="font-semibold hover:underline flex items-center gap-1 disabled:opacity-50"
                                style={{ fontSize: 11, color: 'var(--color-accent)' }}
                              >
                                {isSavingModel ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                                THÊM MỚI
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            {personalModels.map(m => renderModelCell(m, true))}
                            {Array.from({ length: 5 - personalModels.length }).map((_, i) => (
                              <div
                                key={`empty-personal-${i}`}
                                className="aspect-[3/4] flex items-center justify-center"
                                style={{
                                  borderRadius: 10,
                                  border: '1.5px dashed var(--color-border-soft)',
                                  background: 'var(--color-fill)',
                                  color: 'var(--color-text-tertiary)',
                                }}
                              >
                                <UserIcon size={16} />
                              </div>
                            ))}
                          </div>
                        </div>
                        <input type="file" ref={modelListFileInputRef} className="hidden" accept="image/*" onChange={handleModelListUpload} />
                      </div>
                    );
                  })()}
                </div>

                {/* Product Image Upload */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p
                      className="uppercase font-semibold"
                      style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                    >
                      Ảnh sản phẩm (Product)
                    </p>
                    {tryOnProductImage && (
                      <button
                        onClick={handleGenerateWhiteBg}
                        disabled={isGeneratingWhiteBg}
                        className="font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                        style={{
                          padding: '3px 9px',
                          fontSize: 11,
                          background: 'var(--color-accent-soft)',
                          color: 'var(--color-accent)',
                          borderRadius: 8,
                        }}
                      >
                        {isGeneratingWhiteBg ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Sparkles size={10} />
                        )}
                        Tạo nền trắng
                      </button>
                    )}
                  </div>
                  <div
                    onClick={() => { setPasteTargetId('tryon-product'); productFileInputRef.current?.click(); }}
                    {...makeDropHandlers('tryon-product', setTryOnProductImage)}
                    className="aspect-[3/4] relative overflow-hidden flex items-center justify-center cursor-pointer transition-all"
                    style={{
                      background: dragOverId === 'tryon-product' ? 'var(--color-accent-soft)' : 'var(--color-card)',
                      border: `2px dashed ${dragOverId === 'tryon-product' || tryOnProductImage ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      borderRadius: 14,
                    }}
                  >
                    {tryOnProductImage ? (
                      <>
                        <img src={tryOnProductImage} alt="Product" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        {isGeneratingWhiteBg && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                            <Loader2 size={24} className="text-editor-accent animate-spin" />
                            <span className="text-[10px] text-editor-accent font-bold uppercase tracking-widest">Đang tạo nền trắng...</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setZoomImage(tryOnProductImage); }}
                          className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-md backdrop-blur-sm border border-white/20 transition-colors z-10"
                          title="Phóng to"
                        >
                          <ZoomIn size={14} />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
                        <Shirt size={32} />
                        <span style={{ fontSize: 12 }}>Tải ảnh sản phẩm</span>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={productFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleTryOnUpload(e, 'product')} />
                  
                  {/* Category Selection */}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="uppercase font-semibold"
                      style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                    >
                      Loại:
                    </span>
                    <div className="flex-1">
                      <Segmented<'top' | 'bottom' | 'shoes' | 'all'>
                        value={tryOnProductCategory}
                        onChange={(v) => setTryOnProductCategory(v)}
                        size="sm"
                        fullWidth
                        options={[
                          { value: 'top', label: 'Áo' },
                          { value: 'bottom', label: 'Quần' },
                          { value: 'shoes', label: 'Giày' },
                          { value: 'all', label: 'Tất cả' },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Result Image Area */}
                <div className="flex flex-col gap-3">
                  <p
                    className="uppercase font-semibold"
                    style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.06em' }}
                  >
                    ✨ Kết quả thay đồ
                  </p>
                  <div
                    className="aspect-[3/4] relative overflow-hidden flex items-center justify-center"
                    style={{
                      background: 'var(--color-card-secondary)',
                      border: '0.5px solid var(--color-border-soft)',
                      borderRadius: 14,
                    }}
                  >
                    {isTryOnProcessing ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--color-accent)' }} />
                        <p
                          className="uppercase font-semibold"
                          style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.06em' }}
                        >
                          {tryOnStep === 'preparing' ? 'Đang chuẩn bị sản phẩm…' : 'Đang thay đồ…'}
                        </p>
                      </div>
                    ) : tryOnResult ? (
                      <>
                        <img src={tryOnResult} alt="Result" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        <button
                          onClick={() => setZoomImage(tryOnResult)}
                          className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-md backdrop-blur-sm border border-white/20 transition-colors z-10"
                          title="Phóng to"
                        >
                          <ZoomIn size={14} />
                        </button>
                        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = tryOnResult!;
                              link.download = `tryon-${Date.now()}.png`;
                              link.click();
                            }}
                            className="rounded-full hover:scale-110 transition-transform flex items-center justify-center"
                            style={{
                              padding: 12,
                              background: 'var(--color-accent)',
                              color: '#fff',
                              boxShadow: 'var(--shadow-pop)',
                            }}
                            title="Tải ảnh về"
                          >
                            <Download size={20} />
                          </button>
                          <button
                            onClick={() => {
                              setTryOnModelImage(tryOnResult);
                              setTryOnResult(null);
                            }}
                            className="rounded-full hover:scale-110 transition-transform flex items-center justify-center"
                            style={{
                              padding: 12,
                              background: 'rgba(0,0,0,0.55)',
                              backdropFilter: 'blur(12px)',
                              border: '0.5px solid rgba(255,255,255,0.18)',
                              color: '#fff',
                              boxShadow: 'var(--shadow-pop)',
                            }}
                            title="Dùng làm người mẫu để thay tiếp"
                          >
                            <ArrowLeft size={20} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
                        <ImageIcon size={32} />
                        <span className="uppercase font-semibold" style={{ fontSize: 11, letterSpacing: '0.06em' }}>
                          Chưa có kết quả
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-6">
              <div
                className="p-6 flex flex-col gap-6"
                style={{
                  background: 'var(--color-card)',
                  border: '0.5px solid var(--color-border-soft)',
                  borderRadius: 18,
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div>
                  <h2
                    className="font-bold flex items-center gap-2 mb-4"
                    style={{ fontSize: 17, color: 'var(--color-text)', letterSpacing: '-0.02em' }}
                  >
                    <Sparkles style={{ color: 'var(--color-accent)' }} size={18} />
                    Cấu hình Thay Đồ
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <p
                        className="uppercase font-semibold mb-2"
                        style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                      >
                        Chọn Mô hình AI
                      </p>
                      <ModelCardPicker<ModelType>
                        value={selectedModel}
                        onChange={(m) => setSelectedModel(m)}
                        options={IMAGE_MODEL_KEYS.map((m) => ({
                          value: m,
                          name: MODEL_CONFIG[m].name,
                          sub: MODEL_CONFIG[m].requiredKey === 'google' ? 'Google' : 'Kie.ai',
                          best: m === 'banana-pro',
                        }))}
                      />
                      <p
                        className="mt-2 italic px-1"
                        style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}
                      >
                        {MODEL_CONFIG[selectedModel].description}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p
                          className="uppercase font-semibold"
                          style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                        >
                          Chọn Prompt nhanh
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setTryOnManualMode(true);
                              setSelectedTryOnPromptId(null);
                              setTryOnPrompt('');
                            }}
                            className="flex items-center gap-1 font-semibold hover:opacity-80 transition-opacity"
                            style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.04em' }}
                          >
                            <Edit2 size={12} />
                            NHẬP THỦ CÔNG
                          </button>
                          <button
                            onClick={() => {
                              if (!isAdmin) {
                                setNewPromptName('');
                                setNewPromptText('');
                              }
                              setIsAddingPrompt(true);
                            }}
                            className="flex items-center gap-1 font-semibold hover:opacity-80 transition-opacity"
                            style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.04em' }}
                          >
                            <Plus size={12} />
                            THÊM MỚI
                          </button>
                        </div>
                      </div>

                      {isAddingPrompt ? (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-xl border border-editor-accent bg-editor-accent/5 space-y-3 mb-4"
                        >
                          <input 
                            type="text"
                            placeholder="Tên prompt (VD: Nửa người)"
                            value={newPromptName}
                            onChange={(e) => setNewPromptName(e.target.value)}
                            className="w-full bg-black/40 border border-editor-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-editor-accent"
                          />
                          <textarea 
                            placeholder="Nội dung prompt chi tiết..."
                            value={newPromptText}
                            onChange={(e) => setNewPromptText(e.target.value)}
                            className="w-full bg-black/40 border border-editor-border rounded-lg px-3 py-2 text-xs min-h-[80px] focus:outline-none focus:border-editor-accent"
                          />
                          <div className="flex gap-2">
                            <button 
                              onClick={handleAddPrompt}
                              className="flex-1 py-2 bg-editor-accent text-white rounded-lg text-[10px] font-bold hover:opacity-90"
                            >
                              {editingPromptId ? 'CẬP NHẬT' : 'LƯU PROMPT'}
                            </button>
                            <button 
                              onClick={() => {
                                setIsAddingPrompt(false);
                                setEditingPromptId(null);
                                setNewPromptName('');
                                setNewPromptText('');
                              }}
                              className="px-4 py-2 border border-editor-border rounded-lg text-[10px] font-bold hover:bg-white/5"
                            >
                              HỦY
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="space-y-1 mb-4">
                          {tryOnManualMode && (
                            <PromptRow
                              name="📝 Nhập thủ công"
                              active
                              onClick={() => {}}
                              showEdit={false}
                              showDelete={false}
                            />
                          )}
                          {savedTryOnPrompts.slice(0, 3).map((p) => (
                            <PromptRow
                              key={p.id}
                              name={p.name}
                              active={!tryOnManualMode && selectedTryOnPromptId === p.id}
                              synced={p.isDefault}
                              onClick={() => {
                                setTryOnPrompt(p.prompt);
                                setTryOnManualMode(false);
                                setSelectedTryOnPromptId(p.id);
                              }}
                              showSync={isAdmin}
                              onSync={(e) => toggleSyncGenPrompt(p, e)}
                              showEdit={isAdmin || !p.isDefault}
                              showDelete={isAdmin || !p.isDefault}
                              onEdit={(e) => startEditPrompt(p, e)}
                              onDelete={(e) => deletePrompt(p.id, e)}
                            />
                          ))}
                          {savedTryOnPrompts.length > 3 && (
                            <button
                              onClick={() => setShowTryOnPromptModal(true)}
                              className="w-full flex items-center justify-center gap-1.5 transition-colors mt-1"
                              style={{
                                padding: '8px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--color-accent)',
                                background: 'var(--color-fill)',
                                borderRadius: 10,
                                letterSpacing: '-0.01em',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-soft)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-fill)')}
                            >
                              Xem tất cả ({savedTryOnPrompts.length})
                              <ChevronRight size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {(isAdmin || tryOnManualMode) && (
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                          {tryOnManualMode ? 'Nhập Prompt mới' : 'Nội dung Prompt'}
                        </p>
                        <textarea
                          value={tryOnPrompt}
                          onChange={(e) => setTryOnPrompt(e.target.value)}
                          placeholder="Mô tả cách thay đồ... (VD: Thay chiếc áo thun này cho người mẫu, giữ nguyên tư thế)"
                          className="w-full min-h-[120px] resize-none outline-none transition-colors p-3"
                          style={{
                            background: 'var(--color-fill)',
                            color: 'var(--color-text)',
                            borderRadius: 12,
                            border: '0.5px solid transparent',
                            fontSize: 13,
                            letterSpacing: '-0.01em',
                          }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                          onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                        />
                      </div>
                    )}
                    {!isAdmin && !tryOnManualMode && selectedTryOnPromptId && (
                      <div
                        className="rounded-lg px-4 py-3 flex items-center gap-2"
                        style={{
                          background: 'var(--color-accent-soft)',
                          border: '0.5px solid var(--color-accent)',
                        }}
                      >
                        <CheckCircle2 size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                        <p className="font-bold" style={{ fontSize: 12, color: 'var(--color-accent)' }}>
                          {selectedTryOnSavedPrompt?.name || 'Prompt đã lưu'} — sẵn sàng Thay đồ
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="filled"
                  size="lg"
                  fullWidth
                  icon={isTryOnProcessing ? Loader2 : Shirt}
                  onClick={handleTryOnProcess}
                  disabled={!tryOnModelImage || !tryOnProductImage || isTryOnProcessing}
                >
                  {isTryOnProcessing ? 'Đang xử lý…' : 'Bắt đầu Thay Đồ'}
                </Button>
                <div className="flex justify-end">
                  <CreditEstimate
                    compact
                    credits={estimateGenerationCredits({ modelId: MODEL_CONFIG[selectedModel].id, size: '1k', count: 1 })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      </>
      )}

      {/* Footer Info */}
      <footer className="mt-8 py-4 border-t flex flex-col md:flex-row justify-between items-center gap-3" style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-tertiary)' }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-editor-accent" />
            <span className="text-[10px] uppercase tracking-widest">{MODEL_CONFIG[selectedModel].name} Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers size={14} className="text-editor-accent" />
            <span className="text-[10px] uppercase tracking-widest">Batch Editing (Max 5)</span>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.12em]">
          © 2026 Otama Creative Studio
        </div>
      </footer>
      <HistoryModal
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        userId={user?.uid || null}
        onZoom={(url) => setZoomImage(url)}
      />

      {/* Confirm deleting one complete Gen New history batch. */}
      <AnimatePresence>
        {pendingEcomHistoryDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ background: 'rgba(15, 23, 42, 0.46)', backdropFilter: 'blur(7px)' }}
              onClick={() => !isDeletingEcomHistory && setPendingEcomHistoryDelete(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-ecom-history-title"
              className="relative w-full max-w-sm p-5"
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border-soft)',
                borderRadius: 20,
                boxShadow: 'var(--shadow-sheet)',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className="flex items-center justify-center mb-4"
                style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,59,48,.12)', color: 'var(--color-danger)' }}
              >
                <Trash2 size={22} />
              </div>
              <h3 id="delete-ecom-history-title" className="font-bold mb-1" style={{ fontSize: 17, color: 'var(--color-text)' }}>
                Xoá lần gen này?
              </h3>
              <p className="mb-5" style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
                {pendingEcomHistoryDelete.items.length} ảnh của lần gen này sẽ bị xoá khỏi lịch sử và không xuất hiện lại sau khi tải lại trang.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="plain"
                  size="md"
                  disabled={isDeletingEcomHistory}
                  onClick={() => setPendingEcomHistoryDelete(null)}
                >
                  Huỷ
                </Button>
                <button
                  type="button"
                  disabled={isDeletingEcomHistory}
                  onClick={() => void confirmDeleteEcomHistoryGroup()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
                  style={{ background: 'var(--color-danger)', color: '#fff', fontSize: 13 }}
                >
                  {isDeletingEcomHistory ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  {isDeletingEcomHistory ? 'Đang xoá…' : 'Xác nhận xoá'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              className="relative w-full md:w-[480px] flex flex-col"
              style={{
                maxHeight: '88vh',
                background: 'var(--color-card)',
                border: '0.5px solid var(--color-border-soft)',
                boxShadow: 'var(--shadow-sheet)',
                borderRadius: 22,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
              }}
            >
              {/* Mobile drag handle */}
              <div className="md:hidden flex justify-center pt-3">
                <div style={{ width: 36, height: 5, borderRadius: 999, background: 'var(--color-border)' }} />
              </div>

              <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '0.5px solid var(--color-border-soft)' }}>
                <h2 className="font-bold flex items-center gap-2" style={{ fontSize: 20, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                  <Settings size={20} style={{ color: 'var(--color-accent)' }} /> Cài đặt
                </h2>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-full p-1.5 transition-colors"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-fill)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* SECTION: Server credentials */}
                <div>
                  <p className="uppercase font-semibold mb-3" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Bảo mật API</p>
                  <div className="p-4" style={{ background: 'var(--color-fill)', borderRadius: 14 }}>
                    <p className="font-semibold" style={{ fontSize: 13, color: 'var(--color-text)' }}>API key được quản lý trên server</p>
                    <p className="mt-1" style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                      Kie.ai và RunningHub không còn lưu key trong trình duyệt. Nhân viên mở DevTools sẽ không đọc được credential nhà cung cấp.
                    </p>
                  </div>
                </div>

                {/* SECTION: Giao diện */}
                <div>
                  <p className="uppercase font-semibold mb-3" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Giao diện</p>
                  <div className="p-4 flex items-center justify-between" style={{ background: 'var(--color-fill)', borderRadius: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>Chế độ hiển thị</span>
                    <Segmented<'light' | 'dark' | 'system'>
                      value={theme}
                      onChange={(v) => setTheme(v)}
                      size="sm"
                      options={[
                        { value: 'light', label: 'Sáng', icon: Sun },
                        { value: 'dark', label: 'Tối', icon: Moon },
                        { value: 'system', label: 'Auto', icon: Monitor },
                      ]}
                    />
                  </div>
                </div>

                {/* SECTION: Thông báo */}
                <div>
                  <p className="uppercase font-semibold mb-3" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Thông báo</p>
                  <div className="space-y-2">
                    <div className="p-4 flex items-center justify-between" style={{ background: 'var(--color-fill)', borderRadius: 14 }}>
                      <div className="flex-1 min-w-0 pr-4">
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>Báo khi gen xong</p>
                        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                          Ngay cả khi đang ở tab khác. Tab title cũng hiện badge (N).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!notify.enabled) {
                            // Turning ON — request OS permission if needed
                            if (notify.permission === 'default') {
                              await notify.requestPermission();
                            }
                            notify.setEnabled(true);
                            notify.markAsked();
                          } else {
                            notify.setEnabled(false);
                          }
                        }}
                        className="shrink-0 transition-all"
                        style={{
                          width: 44, height: 26, borderRadius: 999,
                          background: notify.enabled ? 'var(--color-accent)' : 'var(--color-border)',
                          position: 'relative',
                        }}
                        aria-label="Bật thông báo gen xong"
                      >
                        <span
                          className="block transition-all"
                          style={{
                            width: 20, height: 20, borderRadius: 999, background: '#fff',
                            position: 'absolute', top: 3,
                            left: notify.enabled ? 21 : 3,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }}
                        />
                      </button>
                    </div>
                    {notify.enabled && notify.permission === 'denied' && (
                      <div className="p-3 flex items-start gap-2" style={{ background: 'rgba(255,149,0,0.10)', borderRadius: 12 }}>
                        <AlertCircle size={14} style={{ color: 'var(--color-warning)', marginTop: 2, flexShrink: 0 }} />
                        <p style={{ fontSize: 11, color: 'var(--color-warning)', lineHeight: 1.5 }}>
                          Browser đã chặn thông báo. Title bar (N) vẫn hoạt động. Để bật lại OS notification, vào Settings của browser cho site này.
                        </p>
                      </div>
                    )}
                    <div className="p-4 flex items-center justify-between" style={{ background: 'var(--color-fill)', borderRadius: 14, opacity: notify.enabled ? 1 : 0.5 }}>
                      <div className="flex-1 min-w-0 pr-4">
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>Âm thanh "ding"</p>
                        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                          Phát 1 tiếng ngắn khi gen xong.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!notify.enabled}
                        onClick={() => notify.setSoundEnabled(!notify.soundEnabled)}
                        className="shrink-0 transition-all disabled:cursor-not-allowed"
                        style={{
                          width: 44, height: 26, borderRadius: 999,
                          background: notify.soundEnabled && notify.enabled ? 'var(--color-accent)' : 'var(--color-border)',
                          position: 'relative',
                        }}
                        aria-label="Bật âm thanh thông báo"
                      >
                        <span
                          className="block transition-all"
                          style={{
                            width: 20, height: 20, borderRadius: 999, background: '#fff',
                            position: 'absolute', top: 3,
                            left: notify.soundEnabled && notify.enabled ? 21 : 3,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* SECTION: Tài khoản */}
                {user && (
                  <div>
                    <p className="uppercase font-semibold mb-3" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Tài khoản</p>
                    <Button
                      variant="secondary"
                      size="md"
                      tone="danger"
                      icon={LogOut}
                      fullWidth
                      onClick={() => { setIsSettingsOpen(false); handleLogout(); }}
                      style={{ color: 'var(--color-danger)' }}
                    >
                      Đăng xuất ({user.email})
                    </Button>
                  </div>
                )}
              </div>

              <div className="px-6 py-4" style={{ borderTop: '0.5px solid var(--color-border-soft)' }}>
                <Button variant="filled" size="md" fullWidth onClick={() => setIsSettingsOpen(false)}>
                  Xong
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Crop Modal */}
      <AnimatePresence>
        {isPatternCropModalOpen && patternSourceImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-2xl bg-[#1e1e1e] rounded-xl overflow-hidden flex flex-col shadow-2xl">
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#252525]">
                <h3 className="text-white font-bold">Chỉnh sửa hình ảnh sản phẩm</h3>
                <button onClick={() => setIsPatternCropModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              
              <div className="relative w-full h-[50vh] min-h-[300px] bg-black/80">
                <Cropper
                  image={patternSourceImage}
                  crop={patternCrop}
                  zoom={patternZoom}
                  rotation={patternRotation}
                  aspect={1}
                  onCropChange={setPatternCrop}
                  onZoomChange={setPatternZoom}
                  onRotationChange={setPatternRotation}
                  onCropComplete={onPatternCropComplete}
                />
              </div>

              <div className="p-4 border-t border-white/10 flex flex-col gap-4 bg-[#252525]">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider w-20">Thu phóng:</span>
                    <input
                      type="range"
                      value={patternZoom}
                      min={1}
                      max={3}
                      step={0.1}
                      aria-labelledby="Zoom"
                      onChange={(e) => setPatternZoom(Number(e.target.value))}
                      className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider w-20">Xoay ảnh:</span>
                    <input
                      type="range"
                      value={patternRotation}
                      min={-180}
                      max={180}
                      step={1}
                      aria-labelledby="Rotation"
                      onChange={(e) => setPatternRotation(Number(e.target.value))}
                      className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-editor-accent font-bold w-8 text-right">{patternRotation}°</span>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-2">
                  <button 
                    onClick={() => setIsPatternCropModalOpen(false)}
                    className="px-6 py-2 border border-white/20 rounded-lg text-white font-bold hover:bg-white/10 transition-colors"
                  >
                    Đóng
                  </button>
                  <button 
                    onClick={handleSavePatternCrop}
                    className="px-6 py-2 bg-[#f05123] text-white rounded-lg font-bold hover:bg-[#d0451e] transition-colors shadow-lg"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !loginLoading && setShowLoginModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a1f] border border-editor-border rounded-2xl p-8 w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <LogIn size={20} className="text-editor-accent" /> Đăng nhập
                </h2>
                <button
                  onClick={() => !loginLoading && setShowLoginModal(false)}
                  disabled={loginLoading}
                  className="text-gray-500 hover:text-white p-1 disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loginLoading}
                className="w-full py-3 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition disabled:opacity-50 mb-4"
              >
                {loginLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 0 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.1 29 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 44c5 0 9.5-1.9 12.9-5l-6-5c-1.8 1.4-4.2 2.3-6.9 2.3-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6 5c-.4.4 6.5-4.7 6.5-14.7 0-1.3-.1-2.6-.4-3.9z"/>
                  </svg>
                )}
                Đăng nhập bằng Google
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-editor-border" />
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">hoặc</span>
                <div className="flex-1 h-px bg-editor-border" />
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={loginLoading}
                    placeholder="nhanvien@otama.vn"
                    className="w-full bg-[#252525] text-white p-3 rounded-lg border border-white/10 focus:border-editor-accent focus:outline-none text-sm"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">Mật khẩu</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loginLoading}
                    placeholder="••••••••"
                    className="w-full bg-[#252525] text-white p-3 rounded-lg border border-white/10 focus:border-editor-accent focus:outline-none text-sm"
                    autoComplete="current-password"
                  />
                </div>

                {loginError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 bg-editor-accent text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
                >
                  {loginLoading ? (
                    <><Loader2 size={18} className="animate-spin" /> Đang đăng nhập...</>
                  ) : (
                    <><LogIn size={18} /> Đăng nhập bằng Email</>
                  )}
                </button>
              </form>

              <p className="text-[10px] text-gray-500 text-center mt-4">
                Tài khoản nhân viên do quản trị viên (Sếp) cấp.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt list full picker modals (Clothing only — Ecom uses inline panel) */}
      <PromptListModal
        open={showGenPromptModal}
        onClose={() => setShowGenPromptModal(false)}
        title="Tất cả Prompt Gen Ảnh"
        prompts={savedGenPrompts}
        selectedId={selectedPromptId}
        onSelect={(p) => selectPrompt(p.id)}
        isAdmin={isAdmin}
        onSync={(p, e) => toggleSyncGenPrompt(p as any, e)}
        onEdit={(p, e) => startEditPrompt(p as any, e)}
        onDelete={(id, e) => deletePrompt(id, e)}
      />
      <PromptListModal
        open={showTryOnPromptModal}
        onClose={() => setShowTryOnPromptModal(false)}
        title="Tất cả Prompt Thay Đồ"
        prompts={savedTryOnPrompts}
        selectedId={tryOnManualMode ? null : selectedTryOnPromptId}
        onSelect={(p) => {
          setTryOnPrompt((p as any).prompt);
          setTryOnManualMode(false);
          setSelectedTryOnPromptId((p as any).id);
        }}
        isAdmin={isAdmin}
        onSync={(p, e) => toggleSyncGenPrompt(p as any, e)}
        onEdit={(p, e) => startEditPrompt(p as any, e)}
        onDelete={(id, e) => deletePrompt(id, e)}
      />

      {/* Notification ask modal — shown once after the first gen completes */}
      <AnimatePresence>
        {showNotifyAsk && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => {
              notify.markAsked();
              setShowNotifyAsk(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className="w-full max-w-sm p-6"
              style={{ background: 'var(--color-card)', borderRadius: 18, boxShadow: 'var(--shadow-card)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center mb-3" style={{ width: 56, height: 56, borderRadius: 999, background: 'var(--color-accent-soft)', margin: '0 auto' }}>
                <Sparkles size={26} style={{ color: 'var(--color-accent)' }} />
              </div>
              <h3 className="text-center font-bold mb-1" style={{ fontSize: 17, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                Báo khi gen xong?
              </h3>
              <p className="text-center mb-5" style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                Khi bạn chuyển sang tab khác, Otama sẽ nhảy thông báo lúc batch hoàn tất. Có thể tắt bất kỳ lúc nào trong Cài đặt.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="filled"
                  size="md"
                  fullWidth
                  onClick={async () => {
                    if (notify.permission === 'default') {
                      await notify.requestPermission();
                    }
                    notify.setEnabled(true);
                    notify.markAsked();
                    setShowNotifyAsk(false);
                  }}
                >
                  Bật thông báo
                </Button>
                <Button
                  variant="plain"
                  size="md"
                  fullWidth
                  onClick={() => {
                    notify.markAsked();
                    setShowNotifyAsk(false);
                  }}
                >
                  Để sau
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom Lightbox */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setZoomImage(null)}
          >
            <motion.button 
              className="absolute top-6 right-6 text-white hover:text-editor-accent transition p-2 bg-white/10 rounded-full"
              onClick={() => setZoomImage(null)}
            >
              <ArrowLeft size={24} />
            </motion.button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={zoomImage} 
              alt="Zoomed" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
