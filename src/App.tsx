/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, Component } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { GoogleGenAI } from "@google/genai";
import Cropper from 'react-easy-crop';
import { getCroppedImg } from './utils/cropImage';
import { 
  Upload, 
  Palette, 
  RotateCcw, 
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
  Languages
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

// Error Boundary Component
class ErrorBoundary extends (Component as any) {
  constructor(props: any) {
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
    const state = (this as any).state;
    const props = (this as any).props;

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
}

interface SavedModel {
  id: string;
  imageUrl: string;
  uid: string;
  createdAt: any;
}

const DEFAULT_GEN_PROMPTS: SavedPrompt[] = [
  { 
    id: 'g1', 
    name: '✨ Prompt chính', 
    prompt: 'A bright minimalist light-colored wood flooring in a herringbone pattern.. Soft, natural indoor lighting creating a professional retail aesthetic\n\nhigh-angle, aerial front view, close-up view to the clothes . The surface is a light grey oak parquet floor with a chevron/herringbone texture.',
    isDefault: true
  },
  { 
    id: 'g2', 
    name: '📸 Chụp Flat Lay', 
    prompt: '{\n  "prompt_structure": {\n    "subject": "A collection of premium men\'s short",\n    "styling": "laid flat",\n    "angle": "High-angle top-down shot, professional flat lay photography",\n    "lighting": "Soft natural studio lighting, diffused shadows, bright and clean aesthetic",\n    "background": "Light grey herringbone wooden floor texture",\n    "props": "Minimalist framed line art posters in the background corners, \'Vogue\' style aesthetic",\n    "technical_details": "High resolution, 8k, commercial fashion photography, sharp focus on fabric texture, clean lines"\n  },\n  "keywords": [\n    "flat lay",\n    "apparel photography",\n    "minimalist",\n    "folded clothes",\n    "e-commerce style",\n    "layered composition"\n  ]\n}',
    isDefault: true
  },
];

const DEFAULT_TRYON_PROMPTS: SavedPrompt[] = [
  {
    id: 't1',
    name: '👕 Nửa người',
    prompt: 'Thay chiếc áo này cho người mẫu trong ảnh, giữ nguyên tư thế và biểu cảm. Đảm bảo ánh sáng và màu sắc hòa hợp với môi trường xung quanh.',
    isDefault: true
  },
  {
    id: 't2',
    name: '👖 Thay quần',
    prompt: 'Thay chiếc quần này cho người mẫu, giữ nguyên phần thân trên. Đảm bảo nếp nhăn và bóng đổ của vải trông tự nhiên.',
    isDefault: true
  }
];

const MODEL_CONFIG = {
  'gpt2': {
    id: 'gpt-image-2-image-to-image',
    name: 'GPT2',
    description: 'Sử dụng Kie.ai (Yêu cầu Kie API Key trong cài đặt)',
    requiredKey: 'kie'
  },
  'banana-pro': {
    id: 'gemini-3-pro-image-preview',
    name: 'Banana Pro',
    description: 'Sử dụng Google (Yêu cầu Google API Key trong cài đặt)',
    requiredKey: 'google'
  },
  'banana-2': {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Banana 2',
    description: 'Sử dụng Google (Yêu cầu Google API Key trong cài đặt)',
    requiredKey: 'google'
  }
};

type ModelType = keyof typeof MODEL_CONFIG;

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [images, setImages] = useState<EditableImage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState<ModelType>('banana-pro');
  const [activeTab, setActiveTab] = useState<'generate' | 'analyze' | 'tryon'>('generate');
  
  // App Mode
  const [appMode, setAppMode] = useState<'clothing' | 'ecom' | 'admin'>('clothing');

  // API Keys and Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [kieApiKey, setKieApiKey] = useState<string>(() => localStorage.getItem('kieApiKey') || '');
  const [googleApiKey, setGoogleApiKey] = useState<string>(() => localStorage.getItem('googleApiKey') || '');

  // Ecom State
  const defaultEcomPrompts: SavedPrompt[] = [
    { id: 'e1', name: 'Prompt 1', prompt: '帮我给我们这件产品做一个详情页,高级感,像山下有松一样表达的售卖详情页。帮我生成电商详情页9:16详情图8张图一张图一页面一卖点', isDefault: true },
    { id: 'e2', name: 'Prompt 2', prompt: '生成一套淘寶详情图, 越南语', isDefault: true }
  ];
  const [ecomSavedPrompts, setEcomSavedPrompts] = useState<SavedPrompt[]>(() => {
    try {
      const saved = localStorage.getItem('ecomPrompts');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return defaultEcomPrompts;
  });
  const [selectedEcomPromptId, setSelectedEcomPromptId] = useState<string>('e1');
  const [ecomPromptText, setEcomPromptText] = useState<string>(defaultEcomPrompts[0].prompt);

  useEffect(() => {
    if (selectedEcomPromptId !== 'manual') {
      const selected = ecomSavedPrompts.find(p => p.id === selectedEcomPromptId);
      if (selected && selected.prompt !== ecomPromptText) {
        setEcomPromptText(selected.prompt);
      }
    }
  }, [ecomSavedPrompts, selectedEcomPromptId]);

  const [isAddingEcomPrompt, setIsAddingEcomPrompt] = useState(false);
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
    localStorage.setItem('ecomPrompts', JSON.stringify(ecomSavedPrompts));
  }, [ecomSavedPrompts]);

  const [ecomBoxes, setEcomBoxes] = useState<{id: string, cropUrl: string}[]>([]);
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [enhanceAspectRatio, setEnhanceAspectRatio] = useState<string>('9:16');
  const [isDetectingBoxes, setIsDetectingBoxes] = useState(false);
  const [ecomProductImage, setEcomProductImage] = useState<string | null>(null);
  const [ecomModel, setEcomModel] = useState<ModelType>('gpt2');
  const [ecomAspectRatio, setEcomAspectRatio] = useState<string>('9:16');
  const [ecomImageSize, setEcomImageSize] = useState<string>('1k');
  const [ecomImageCount, setEcomImageCount] = useState<number>(3);
  const [isEcomGenerating, setIsEcomGenerating] = useState(false);
  const [ecomResults, setEcomResults] = useState<string[]>([]);
  const [selectedEcomGrid, setSelectedEcomGrid] = useState<string | null>(null);
  const [isEcomEnhancing, setIsEcomEnhancing] = useState(false);
  const [isTranslatingImages, setIsTranslatingImages] = useState(false);
  const [ecomFinalImages, setEcomFinalImages] = useState<{ id: string, url: string, loading: boolean }[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [ecomSubTab, setEcomSubTab] = useState<'gen-new' | 'clone-template' | 'pattern-replace'>('gen-new');
  const [ecomTemplateImage, setEcomTemplateImage] = useState<string | null>(null);
  
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

  // Try-On State
  const [tryOnModelImage, setTryOnModelImage] = useState<string | null>(null);
  const [tryOnProductImage, setTryOnProductImage] = useState<string | null>(null);
  const [tryOnProductCategory, setTryOnProductCategory] = useState<'top' | 'bottom' | 'shoes' | 'all'>('all');
  const [isTryOnProcessing, setIsTryOnProcessing] = useState(false);
  const [tryOnStep, setTryOnStep] = useState<'idle' | 'preparing' | 'processing'>('idle');
  const [isGeneratingWhiteBg, setIsGeneratingWhiteBg] = useState(false);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [tryOnPrompt, setTryOnPrompt] = useState<string>('');
  const modelFileInputRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);

  // Prompt Management - Gen
  const [savedGenPrompts, setSavedGenPrompts] = useState<SavedPrompt[]>(DEFAULT_GEN_PROMPTS);

  // Prompt Management - Try-On
  const [savedTryOnPrompts, setSavedTryOnPrompts] = useState<SavedPrompt[]>(DEFAULT_TRYON_PROMPTS);
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [isSavingModel, setIsSavingModel] = useState(false);
  const modelListFileInputRef = useRef<HTMLInputElement>(null);

  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptText, setNewPromptText] = useState('');

  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasPersonalKey, setHasPersonalKey] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const currentImage = images[selectedIndex];

  const processFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;

    if (appMode === 'ecom') {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEcomProductImage(ev.target?.result as string);
        setEcomResults([]); // Reset results when new image is uploaded
      };
      reader.readAsDataURL(file);
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
  }, [activeTab, isReplacing, selectedIndex]);

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

  useEffect(() => {
    let unsubUserDoc: any = null;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        if (u.email === 'trungg9870@gmail.com') setIsAdmin(true);
        // Subscribe to user document
        unsubUserDoc = onSnapshot(doc(db, 'users', u.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserPermissions(data);
            if (data.role === 'admin') setIsAdmin(true);
          } else {
            setUserPermissions(null);
          }
        });
        setIsAuthReady(true);
      } else {
        setIsAdmin(false);
        setUserPermissions(null);
        if (unsubUserDoc) unsubUserDoc();
        setIsAuthReady(true);
      }
    });
    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  // Sync Prompts from Firestore
  useEffect(() => {
    if (!isAuthReady) return;

    if (!user) {
      setSavedGenPrompts(DEFAULT_GEN_PROMPTS);
      setSavedTryOnPrompts(DEFAULT_TRYON_PROMPTS);
      setEcomSavedPrompts(defaultEcomPrompts);
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

      setSavedGenPrompts([...gen, ...DEFAULT_GEN_PROMPTS.filter(d => !merged.some(m => m.id === d.id))]);
      setSavedTryOnPrompts([...tryon, ...DEFAULT_TRYON_PROMPTS.filter(d => !merged.some(m => m.id === d.id))]);
      setEcomSavedPrompts([...ecom, ...defaultEcomPrompts.filter(d => !merged.some(m => m.id === d.id))]);

      if (gen.length > 0 && !selectedPromptId) {
        setSelectedPromptId(gen[0].id);
        setAiPrompt(gen[0].prompt);
      }
    };

    const unsubUser = onSnapshot(userPromptsQ, (snap) => {
      userDocs = snap.docs.map(doc => doc.data());
      updatePrompts();
    }, e => console.warn(e));

    const unsubDefault = onSnapshot(defaultPromptsQ, (snap) => {
      defaultDocs = snap.docs.map(doc => doc.data());
      updatePrompts();
    }, e => console.warn(e));

    return () => { unsubUser(); unsubDefault(); };
  }, [isAuthReady, user]);

  // Sync Saved Models
  useEffect(() => {
    if (!isAuthReady || !user) {
      setSavedModels([]);
      return;
    }

    // Removing orderBy to avoid composite index requirement for now
    const q = query(
      collection(db, 'models'),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const models = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedModel[];
      
      // Sort on client side instead
      const sortedModels = models.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      
      setSavedModels(sortedModels);
    }, (error) => {
      console.error("Models sync error:", error);
      // Don't throw here to avoid crashing, but log it
      if (error.message.includes('index')) {
        setGlobalError("Hệ thống đang khởi tạo dữ liệu (thiếu index). Vui lòng thử lại sau vài phút.");
      }
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const handleSaveModel = async (imageUrl: string) => {
    if (!user) {
      setGlobalError("Vui lòng đăng nhập để lưu người mẫu.");
      return;
    }
    if (savedModels.length >= 5) {
      setGlobalError("Bạn chỉ có thể lưu tối đa 5 người mẫu. Vui lòng xóa bớt để thêm mới.");
      return;
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
        createdAt: Timestamp.now()
      });
      console.log("Model saved successfully:", modelId);
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
    try {
      await deleteDoc(doc(db, 'models', modelId));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'models');
    }
  };

  const handleModelListUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) handleSaveModel(result);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login error:", error);
      setGlobalError(`Lỗi đăng nhập: ${error.message}`);
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
    
    const isDefaultPrompt = isAdmin && (DEFAULT_GEN_PROMPTS.some(p => p.id === promptId) || DEFAULT_TRYON_PROMPTS.some(p => p.id === promptId));
    
    const newPromptData = {
      id: promptId,
      name: newPromptName,
      prompt: newPromptText,
      type: isTryOn ? 'tryon' : 'generate',
      uid: isDefaultPrompt ? 'admin' : user.uid,
      createdAt: Timestamp.now(),
      ...(isDefaultPrompt ? { isDefault: true } : {})
    };

    try {
      await setDoc(doc(db, 'prompts', promptId), newPromptData);
      
      if (!isTryOn) {
        setSelectedPromptId(promptId);
        setAiPrompt(newPromptText);
      } else {
        setTryOnPrompt(newPromptText);
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
    const isDefaultPrompt = isAdmin && defaultEcomPrompts.some(p => p.id === promptId);
    
    try {
      await setDoc(doc(db, 'prompts', promptId), {
        id: promptId,
        name: newEcomPromptName,
        prompt: ecomPromptText,
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
    
    if (!isAdmin && defaultEcomPrompts.some(p => p.id === id)) {
      setGlobalError("Không thể xóa prompt mặc định.");
      return;
    }

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
      await setDoc(doc(db, 'prompts', p.id), { 
        isDefault: true
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

  const resetEditor = () => {
    setImages([]);
    setSelectedIndex(0);
    setGlobalError(null);
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
    if (images.length === 0 || !aiPrompt) return;
    
    const config = MODEL_CONFIG[selectedModel];
    
    const isSingle = typeof targetIndex === 'number';
    if (!isSingle) setIsBatchProcessing(true);
    setGlobalError(null);

    const modelId = config.id;

    // Determine which images to process
    const indicesToProcess = isSingle ? [targetIndex!] : images.map((_, idx) => idx);

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
          // 1. Apply simulated traditional edits - ALWAYS start from source image
          let currentImageData = img.source;
          // Apply fixed 20% brightness as per original requirement
          currentImageData = await applyBrightness(currentImageData, 20);
          currentImageData = await applyCentralCrop(currentImageData, img.aspectRatio);

          // 2. Call AI
          const mainBase64 = currentImageData.split(',')[1];
          const promptText = aiPrompt;
          
          let resultUrl = '';

          // Try calling Server-side API first (using owner's key)
          try {
            const response = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                modelId,
                prompt: promptText,
                imageBase64: mainBase64,
                aspectRatio: img.aspectRatio,
                clientKieApiKey: kieApiKey,
                clientGoogleApiKey: googleApiKey
              })
            });

            if (response.ok) {
              const data = await response.json();
              if (data.isUrl) {
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

              // If server fails with 400 (Invalid Key), 403 (Permission Denied) or it's a paid model, try client-side if key is available
              if (config.requiredKey === 'kie') {
                 throw new Error(errorData.error || "Lỗi từ máy chủ Kie.ai.");
              }
              if (response.status === 400 || response.status === 403 || config.requiredKey !== 'google') {
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
                   throw new Error("Vui lòng nhập API Key cho model này tại Mục Cài đặt.");
                }

                // If it is google and we have no key but aistudio is ready, we initialize without key
                const ai = apiKey ? new GoogleGenAI({ apiKey }) : new GoogleGenAI({});
                const aiResponse = await ai.models.generateContent({
                  model: modelId,
                  contents: {
                    parts: [
                      {
                        inlineData: {
                          data: mainBase64,
                          mimeType: 'image/jpeg',
                        },
                      },
                      { text: promptText }
                    ]
                  },
                  config: {
                    imageConfig: {
                      aspectRatio: img.aspectRatio as any,
                      imageSize: "1K"
                    }
                  }
                });

                for (const part of aiResponse.candidates?.[0]?.content?.parts || []) {
                  if (part.inlineData) {
                    resultUrl = `data:image/png;base64,${part.inlineData.data}`;
                    break;
                  }
                }
              } else {
                throw new Error(errorData.error || "Lỗi từ máy chủ AI");
              }
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

    try {
      const base64 = analyzeImage.split(',')[1];
      
      // Try server-side API first
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 })
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

      // Fallback to client-side if server fails
      let apiKey = process.env.API_KEY;
      
      if (!apiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
          const updatedHasKey = await window.aistudio.hasSelectedApiKey();
          setHasPersonalKey(updatedHasKey);
        }
        apiKey = process.env.API_KEY;
      }

      if (!apiKey) {
        throw new Error("Vui lòng chọn API Key cá nhân để thực hiện phân tích ảnh.");
      }

      const ai = new GoogleGenAI({ apiKey });
      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64,
                  mimeType: 'image/jpeg',
                },
              },
              { 
                text: "Analyze this image and generate a detailed prompt for recreating a similar product photo. Focus on: styling, angle, lighting, background, props, and technical details. IMPORTANT: Do not describe the specific product shown in the image (e.g., don't say 'denim shorts'). Instead, use a generic placeholder like 'the product' or 'main subject' so this prompt can be reused for any item. Output ONLY the JSON object." 
              }
            ]
          },
          config: {
            responseMimeType: "application/json"
          }
        });
      } catch (genAiErr: any) {
        if (genAiErr.message?.includes("API key not valid") || genAiErr.message?.includes("400")) {
          throw new Error("API Key cá nhân của bạn không hợp lệ hoặc đã hết hạn. Vui lòng nhấn nút 'Cài đặt API' để chọn Key mới.");
        }
        throw genAiErr;
      }

      const result = response.text;
      setAnalyzedPrompt(result);
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
    setAiPrompt(analyzedPrompt);
    setActiveTab('generate');
    setGlobalError("Đã áp dụng prompt! Chuyển sang tab Gen ảnh.");
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

        const ai = apiKey ? new GoogleGenAI({ apiKey }) : new GoogleGenAI({});

        // Step 1: Generate White Background for Product (if not already done or just always for best results)
        // We do this to ensure the best try-on quality as requested by the user
        try {
          const categoryText = tryOnProductCategory === 'top' ? 'top/shirt/jacket' : 
                               tryOnProductCategory === 'bottom' ? 'pants/skirt/bottom' : 
                               tryOnProductCategory === 'shoes' ? 'shoes/footwear/accessories' :
                               'full outfit (both top and bottom)';
          
          const whiteBgResponse = await ai.models.generateContent({
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
          const ai = new GoogleGenAI({ apiKey: currentApiKey });
          return await ai.models.generateContent({
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
      const productBase64 = tryOnProductImage.split(',')[1];
      const mimeType = tryOnProductImage.split(';')[0].split(':')[1];
      
      const apiKey = (process.env as any).GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      
      const categoryText = tryOnProductCategory === 'top' ? 'top/shirt/jacket' : 
                           tryOnProductCategory === 'bottom' ? 'pants/skirt/bottom' : 
                           tryOnProductCategory === 'shoes' ? 'shoes/footwear/accessories' :
                           'full outfit (both top and bottom)';

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: productBase64, mimeType } },
            { text: `Isolate ONLY the ${categoryText} from this image. CRITICAL: Remove ALL human parts (legs, feet, socks, hands, arms, etc.), mannequins, and background completely. Place ONLY the ${categoryText} on a clean, professional, solid white studio background (ghost mannequin or flat lay style). Ensure the product's texture and details are preserved perfectly. Output ONLY the resulting image.` }
          ]
        }
      });

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setTryOnProductImage(`data:image/png;base64,${part.inlineData.data}`);
          foundImage = true;
          break;
        }
      }
      
      if (!foundImage) {
        throw new Error("Không tìm thấy ảnh kết quả từ AI.");
      }
    } catch (error: any) {
      console.error("Error generating white background:", error);
      setGlobalError("Không thể tạo nền trắng cho sản phẩm. Vui lòng thử lại.");
    } finally {
      setIsGeneratingWhiteBg(false);
    }
  };

  const handleEcomGenerate = async () => {
    if (!ecomProductImage) return;
    if (ecomSubTab === 'clone-template' && !ecomTemplateImage) {
      setGlobalError("Vui lòng tải lên cả Ảnh Template mẫu và Ảnh Sản phẩm");
      return;
    }

    setIsEcomGenerating(true);
    setGlobalError(null);
    setEcomResults([]);
    setEcomBoxes([]);
    setSelectedBoxIds([]);

    let currentPrompt = ecomPromptText || "帮我给我们这件产品做一个详情页,高级感,像山下有松一样表达的售卖详情页。帮我生成电商详情页9:16详情图8张图一张图一页面一卖点";
    let config = MODEL_CONFIG[ecomModel];
    let templateB64: string | undefined = undefined;

    if (ecomSubTab === 'clone-template') {
      currentPrompt = "请复刻图1的设计,为图二生成亚马逊视觉电商A+,越南语";
      config = MODEL_CONFIG['gpt2']; // force GPT2
      templateB64 = ecomTemplateImage!.split(',')[1];
    }

    try {
      const mainBase64 = ecomProductImage.split(',')[1];
      
      let generatedImages: string[] = [];
      let serverFailed = false;

      // Try server first
      try {
        const fullEcomPrompt = `${currentPrompt} (Quality: ${ecomImageSize.toUpperCase()})`;
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: config.id,
            prompt: fullEcomPrompt,
            imageBase64: mainBase64,
            templateBase64: templateB64,
            aspectRatio: ecomAspectRatio,
            imageSize: ecomImageSize,
            numberOfImages: ecomImageCount,
            clientKieApiKey: kieApiKey,
            clientGoogleApiKey: googleApiKey
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.isUrl) {
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

        const ai = apiKey ? new GoogleGenAI({ apiKey }) : new GoogleGenAI({});
            const aiResponse = await ai.models.generateContent({
              model: config.id,
              contents: {
                parts: [
                  {
                    inlineData: {
                      data: mainBase64,
                      mimeType: 'image/jpeg',
                    },
                  },
                  { text: `${currentPrompt} (Quality: ${ecomImageSize.toUpperCase()})` }
                ]
              },
              config: {
                imageConfig: {
                  aspectRatio: ecomAspectRatio as any,
                  numberOfImages: ecomImageCount,
                  imageSize: ecomImageSize.toUpperCase()
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
        setEcomResults(generatedImages);
      } else {
        throw new Error("Không có ảnh kết quả trả về.");
      }
    } catch (error: any) {
      console.error(error);
      setGlobalError(error.message);
    } finally {
      setIsEcomGenerating(false);
    }
  };

  const handleEcomGeneratePattern = async () => {
    if (!patternSourceImage) return;
    setIsGeneratingPattern(true);
    setGlobalError(null);
    setGeneratedPattern(null);

    const currentPrompt = "Recreate this image as a flat 2D seamless repeating pattern, formatted as a print-ready textile design file. Preserve all motifs, colors, proportions, and spatial layout exactly as in the reference. Solid flat background, no fabric texture, no folds, no shadows, no lighting effects, no mockup, no product photography, no borders, no frames, no extra decorative elements added. Output as a clean digital pattern tile, top-down view, 1:1 aspect ratio.";
    const config = MODEL_CONFIG[ecomModel];

    try {
      const mainBase64 = patternSourceImage.split(',')[1];
      const fullPrompt = `${currentPrompt} (Quality: 1K)`;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: config.id,
          prompt: fullPrompt,
          imageBase64: mainBase64,
          aspectRatio: '1:1',
          imageSize: '1k',
          numberOfImages: 1,
          clientKieApiKey: kieApiKey,
          clientGoogleApiKey: googleApiKey
        })
      });

      if (response.ok) {
        const data = await response.json();
        let finalImage = "";
        if (data.isUrl && data.imagesBase64?.length > 0) {
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

  const handleEcomApplyPattern = async () => {
    if (!patternMockupImage || !generatedPattern) return;
    setIsEcomGenerating(true);
    setGlobalError(null);
    setEcomResults([]);

    const currentPrompt = "Replace the pattern on the main textile product visible in image with the pattern from image 1. Apply the new pattern as actual printed fabric, not as a flat overlay or sticker. Preserve all original fabric wrinkles, folds, creases, soft shadows, highlights, and natural depth of the PRODUCT. The pattern must follow the contours of the fabric — stretching at tension points, compressing at folds, darkening in shadowed areas, brightening where light hits. Keep the original lighting, scene, composition, pose, and all other elements unchanged. Photorealistic textile rendering.";
    const config = MODEL_CONFIG[ecomModel];

    try {
      const mainBase64 = patternMockupImage.split(',')[1];
      
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
      
      const templateBase64 = finalTemplateBase64.split(',')[1];
      const fullPrompt = `${currentPrompt} (Quality: ${ecomImageSize.toUpperCase()})`;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: config.id,
          prompt: fullPrompt,
          imageBase64: mainBase64,
          templateBase64: templateBase64,
          aspectRatio: ecomAspectRatio, // Use the selected aspect ratio
          imageSize: ecomImageSize,
          numberOfImages: ecomImageCount,
          clientKieApiKey: kieApiKey,
          clientGoogleApiKey: googleApiKey
        })
      });

      if (response.ok) {
        const data = await response.json();
        let generatedImages: string[] = [];
        if (data.isUrl) {
          generatedImages = data.imagesBase64;
        } else if (data.imagesBase64 && Array.isArray(data.imagesBase64)) {
          generatedImages = data.imagesBase64.map((b64: string) => `data:image/png;base64,${b64}`);
        } else if (data.imageBase64) {
          generatedImages = [`data:image/png;base64,${data.imageBase64}`];
        }
        setEcomResults(generatedImages);
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

      // 1. Ask AI to detect grid boxes 
      const apiKey = googleApiKey || (process.env as any).GEMINI_API_KEY || '';
      const detectResponse = await fetch('/api/detect-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64ForApi, clientGoogleApiKey: apiKey })
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
             const base64Data = box.cropUrl.split(',')[1];
             const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  modelId: 'gemini-3-pro-image-preview', // Force Banana Pro
                  prompt: 'High-resolution upscale of this product image. Preserve all details, colors, and the original composition. Enhance sharpness, clarity and remove any compression artifacts. Professional studio quality.',
                  imageBase64: base64Data,
                  aspectRatio: enhanceAspectRatio,
                  imageSize: ecomImageSize.toUpperCase() || '1K',
                  numberOfImages: 1,
                  clientGoogleApiKey: apiKey,
                  clientKieApiKey: kieApiKey
                })
             });

             let finalUrl = box.cropUrl;

             if (!res.ok) {
                const errData = await res.json();
                console.warn("Enhance error for piece", errData);
             } else {
                const data = await res.json();
                if (data.imageBase64) finalUrl = `data:image/jpeg;base64,${data.imageBase64}`;
                else if (data.imagesBase64?.length > 0) finalUrl = `data:image/jpeg;base64,${data.imagesBase64[0]}`;
             }

             setEcomFinalImages(prev => prev.map(img => img.id === box.id ? { ...img, url: finalUrl, loading: false } : img));
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
             const base64Data = imgToTranslate.url.split(',')[1];
             const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  modelId: 'gemini-3-pro-image-preview', // Force Banana Pro
                  prompt: 'Translate all Chinese text in this image into Vietnamese. Keep the exact same layout, background, font style, formatting and colors. Only change the text to Vietnamese.',
                  imageBase64: base64Data,
                  aspectRatio: enhanceAspectRatio,
                  imageSize: ecomImageSize.toUpperCase() || '1K',
                  numberOfImages: 1,
                  clientGoogleApiKey: apiKey,
                  clientKieApiKey: kieApiKey
                })
             });

             let finalUrl = imgToTranslate.url;

             if (!res.ok) {
                const errData = await res.json();
                console.warn("Translation error for piece", errData);
             } else {
                const data = await res.json();
                if (data.imageBase64) finalUrl = `data:image/jpeg;base64,${data.imageBase64}`;
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

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-editor-accent rounded-lg flex items-center justify-center">
              <Palette className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tighter leading-none">PHOTO</h1>
              <p className="text-[10px] tracking-[0.3em] text-editor-accent font-bold">EDITOR</p>
            </div>
          </div>
          <div className="hidden sm:flex bg-editor-border/20 p-1 rounded-lg">
            {(isAdmin || userPermissions?.canUseClothing) && (
              <button
                onClick={() => setAppMode('clothing')}
                className={`px-3 py-1.5 text-sm font-bold rounded-md transition-all ${appMode === 'clothing' ? 'bg-editor-accent text-black' : 'text-editor-text'}`}
              >
                Quần áo
              </button>
            )}
            {(isAdmin || userPermissions?.canUseEcom) && (
              <button
                onClick={() => setAppMode('ecom')}
                className={`px-3 py-1.5 text-sm font-bold rounded-md transition-all ${appMode === 'ecom' ? 'bg-editor-accent text-black' : 'text-editor-text'}`}
              >
                Ecom
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setAppMode('admin')}
                className={`px-3 py-1.5 text-sm font-bold rounded-md transition-all ${appMode === 'admin' ? 'bg-editor-accent text-black' : 'text-editor-text'}`}
              >
                Admin
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4">
          <div className="flex sm:hidden w-full bg-editor-border/20 p-1 rounded-lg mb-2">
            {(isAdmin || userPermissions?.canUseClothing) && (
              <button
                onClick={() => setAppMode('clothing')}
                className={`flex-1 px-3 py-1.5 text-sm font-bold rounded-md transition-all ${appMode === 'clothing' ? 'bg-editor-accent text-black' : 'text-editor-text'}`}
              >
                Quần áo
              </button>
            )}
            {(isAdmin || userPermissions?.canUseEcom) && (
              <button
                onClick={() => setAppMode('ecom')}
                className={`flex-1 px-3 py-1.5 text-sm font-bold rounded-md transition-all ${appMode === 'ecom' ? 'bg-editor-accent text-black' : 'text-editor-text'}`}
              >
                Ecom
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setAppMode('admin')}
                className={`flex-1 px-3 py-1.5 text-sm font-bold rounded-md transition-all ${appMode === 'admin' ? 'bg-editor-accent text-black' : 'text-editor-text'}`}
              >
                Admin
              </button>
            )}
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${
              kieApiKey || googleApiKey
                ? 'bg-green-500/10 border-green-500/30 text-green-500' 
                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'
            }`}
          >
            <Settings size={12} />
            {kieApiKey || googleApiKey ? 'Cài đặt API' : 'Thêm API Key'}
          </button>

          {isAuthReady && (
            <div className="flex items-center gap-3 bg-editor-border/20 px-3 py-1.5 rounded-full border border-editor-border/30">
              {user ? (
                <>
                  <div className="flex items-center gap-2">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="w-6 h-6 rounded-full border border-editor-accent/50" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-editor-accent flex items-center justify-center">
                        <UserIcon size={12} className="text-black" />
                      </div>
                    )}
                    <span className="text-xs font-bold hidden sm:inline-block max-w-[100px] truncate">{user.displayName}</span>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-1.5 hover:text-red-500 transition-colors"
                    title="Đăng xuất"
                  >
                    <LogOut size={16} />
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="flex items-center gap-2 text-xs font-bold text-editor-accent hover:opacity-80 transition-opacity"
                >
                  <LogIn size={16} />
                  Đăng nhập đồng bộ
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            {images.length > 0 && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 5}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-editor-border text-sm hover:bg-editor-accent hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={16} />
                <span className="hidden sm:inline">Thêm ảnh ({images.length}/5)</span>
                <span className="sm:hidden">{images.length}/5</span>
              </button>
            )}
            {images.some(img => img.processed && img.processed !== img.source) && (
              <button 
                onClick={handleDownloadAll}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-editor-accent text-black text-sm font-bold hover:opacity-90 transition-all"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Lưu tất cả</span>
              </button>
            )}
            <button 
              onClick={resetEditor}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-editor-border text-sm hover:bg-editor-border/30 transition-colors"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </header>

      {appMode === 'admin' && (
        <main className="flex-1 w-full max-w-7xl mx-auto py-8">
          <AdminPanel currentUser={user} />
        </main>
      )}

      {appMode === 'ecom' && (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left panel: Upload and Settings */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="glass-panel p-6">
              <h2 className="text-xl font-bold text-white mb-4">Giao diện Ecom</h2>
              <p className="text-sm text-gray-400 mb-6">Tự động tạo ra kết quả xịn xò cho ảnh sản phẩm TMĐT của bạn.</p>
              
              <div className="flex bg-editor-border/20 p-1 rounded-lg mb-6">
                <button
                  onClick={() => setEcomSubTab('gen-new')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${ecomSubTab === 'gen-new' ? 'bg-editor-accent text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                >
                  Gen new
                </button>
                <button
                  onClick={() => setEcomSubTab('clone-template')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${ecomSubTab === 'clone-template' ? 'bg-editor-accent text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                >
                  Clone Templates
                </button>
                <button
                  onClick={() => setEcomSubTab('pattern-replace')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${ecomSubTab === 'pattern-replace' ? 'bg-editor-accent text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                >
                  Thay Pattern
                </button>
              </div>

              {ecomSubTab === 'clone-template' ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">1. ẢNH TEMPLATE MẪU</p>
                    <div 
                      className="w-full aspect-square border-2 border-dashed border-editor-border rounded-xl flex items-center justify-center cursor-pointer hover:border-editor-accent overflow-hidden transition-colors relative group bg-black/20"
                      onClick={() => {
                        if (ecomTemplateFileInputRef.current) ecomTemplateFileInputRef.current.click();
                      }}
                    >
                      {ecomTemplateImage ? (
                        <>
                          <img src={ecomTemplateImage} alt="Template" className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white font-bold text-xs">Thay đổi ảnh Template</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-editor-accent">
                          <Upload size={32} />
                          <span className="text-sm font-medium">Click để tải ảnh Template mẫu</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">2. ẢNH SẢN PHẨM (GỐC)</p>
                    <div 
                      className="w-full aspect-square border-2 border-dashed border-editor-border rounded-xl flex items-center justify-center cursor-pointer hover:border-editor-accent overflow-hidden transition-colors relative group bg-black/20"
                      onClick={() => {
                        if (ecomFileInputRef.current) ecomFileInputRef.current.click();
                      }}
                    >
                      {ecomProductImage ? (
                        <>
                          <img src={ecomProductImage} alt="Product" className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white font-bold text-xs">Thay đổi ảnh sản phẩm</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-editor-accent">
                          <Upload size={32} />
                          <span className="text-sm font-medium">Click để tải ảnh Sản phẩm</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : ecomSubTab === 'pattern-replace' ? (
                <div className="flex flex-col gap-6">
                  {/* Step 1 */}
                  <div className="bg-editor-border/10 p-4 rounded-xl border border-editor-border">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-editor-accent text-black flex items-center justify-center text-xs">1</span>
                      TẠO PATTERN TỪ ẢNH MẪU
                    </h3>
                    <div 
                      className="w-full aspect-square border-2 border-dashed border-editor-border rounded-xl flex items-center justify-center cursor-pointer hover:border-editor-accent overflow-hidden transition-colors relative group bg-black/20"
                      onClick={() => {
                        if (patternSourceFileInputRef.current) patternSourceFileInputRef.current.click();
                      }}
                    >
                      {patternSourceImage ? (
                        <>
                          <img src={patternSourceImage} alt="Pattern Source" className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsPatternCropModalOpen(true);
                              }}
                              className="p-3 bg-black/60 text-white rounded-md hover:bg-editor-accent hover:text-black transition-colors"
                              title="Cắt ảnh"
                            >
                              <Crop size={24} />
                            </button>
                            <div className="w-[1px] h-8 bg-white/30"></div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setPatternSourceImage(null);
                                setGeneratedPattern(null);
                                if (patternSourceFileInputRef.current) patternSourceFileInputRef.current.value = '';
                              }}
                              className="p-3 bg-black/60 text-white rounded-md hover:bg-red-500 transition-colors"
                              title="Xóa ảnh"
                            >
                              <Trash2 size={24} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-editor-accent">
                          <Upload size={32} />
                          <span className="text-sm font-medium text-center px-4">Tải ảnh hoa văn tham khảo</span>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={handleEcomGeneratePattern}
                      disabled={!patternSourceImage || isGeneratingPattern}
                      className="w-full mt-4 py-3 bg-editor-accent text-black rounded-xl font-bold hover:bg-editor-accent/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      {isGeneratingPattern ? (
                        <><Loader2 className="animate-spin" size={20} /> ĐANG TẠO PATTERN 2D...</>
                      ) : (
                        <><Wand2 size={20} /> TẠO PATTERN 2D</>
                      )}
                    </button>

                    {generatedPattern && (
                      <div className="mt-4">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">KẾT QUẢ PATTERN 2D</p>
                        <div className="w-full aspect-square rounded-xl overflow-hidden border border-editor-accent/30 bg-black/40 relative group">
                          <img src={generatedPattern} alt="Generated Pattern" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2 */}
                  <div className={`bg-editor-border/10 p-4 rounded-xl border border-editor-border transition-opacity duration-300 ${!generatedPattern ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-editor-accent text-black flex items-center justify-center text-xs">2</span>
                      ÁP DỤNG LÊN SẢN PHẨM MẪU
                    </h3>
                    <div 
                      className="w-full aspect-square border-2 border-dashed border-editor-border rounded-xl flex items-center justify-center cursor-pointer hover:border-editor-accent overflow-hidden transition-colors relative group bg-black/20"
                      onClick={() => {
                        if (patternMockupFileInputRef.current) patternMockupFileInputRef.current.click();
                      }}
                    >
                      {patternMockupImage ? (
                        <>
                          <img src={patternMockupImage} alt="Product Mockup" className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white font-bold text-xs">Thay đổi ảnh sản phẩm</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-editor-accent">
                          <Upload size={32} />
                          <span className="text-sm font-medium text-center px-4">Tải ảnh sản phẩm (mockup)</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleEcomApplyPattern}
                      disabled={!patternMockupImage || !generatedPattern || isEcomGenerating}
                      className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      {isEcomGenerating ? (
                        <><Loader2 className="animate-spin" size={20} /> ĐANG ÁP DỤNG...</>
                      ) : (
                        <><Shirt size={20} /> ÁP DỤNG PATTERN</>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="w-full aspect-square border-2 border-dashed border-editor-border rounded-xl flex items-center justify-center cursor-pointer hover:border-editor-accent overflow-hidden transition-colors relative group"
                  onClick={() => {
                    if (ecomFileInputRef.current) ecomFileInputRef.current.click();
                  }}
                >
                  {ecomProductImage ? (
                    <>
                      <img src={ecomProductImage} alt="Product" className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white font-bold text-xs">Thay đổi ảnh sản phẩm</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-editor-accent">
                      <Upload size={32} />
                      <span className="text-sm font-medium">Click để tải ảnh sản phẩm</span>
                    </div>
                  )}
                </div>
              )}

              <input
                type="file"
                ref={ecomTemplateFileInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const r = new FileReader();
                    r.onload = (ev) => {
                      setEcomTemplateImage(ev.target?.result as string);
                    };
                    r.readAsDataURL(file);
                  }
                }}
              />
              <input 
                type="file" 
                ref={ecomFileInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const r = new FileReader();
                    r.onload = (ev) => {
                      setEcomProductImage(ev.target?.result as string);
                      setEcomResults([]);
                    };
                    r.readAsDataURL(file);
                  }
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
              {ecomSubTab === 'gen-new' && (
                <>
                  <div className="mt-6 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">DANH SÁCH PROMPT ĐÃ LƯU</p>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                          setSelectedEcomPromptId('manual');
                          setEcomPromptText('');
                        }}
                        className="flex items-center gap-1 text-[10px] text-editor-accent font-bold hover:opacity-80 transition-opacity"
                      >
                        <Edit2 size={12} />
                        NHẬP THỦ CÔNG
                      </button>
                      {isAdmin && (
                        <button 
                          onClick={() => setIsAddingEcomPrompt(true)}
                          className="flex items-center gap-1 text-[10px] text-editor-accent font-bold hover:opacity-80 transition-opacity"
                        >
                          <Plus size={12} />
                          THÊM MỚI
                        </button>
                      )}
                    </div>
                  </div>

                  {isAddingEcomPrompt ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl border border-editor-accent bg-editor-accent/5 space-y-3 mb-6"
                    >
                      <input 
                        type="text"
                        placeholder="Tên prompt..."
                        value={newEcomPromptName}
                        onChange={(e) => setNewEcomPromptName(e.target.value)}
                        className="w-full bg-black/40 border border-editor-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-editor-accent"
                      />
                      <textarea 
                        placeholder="Nội dung prompt chi tiết..."
                        value={ecomPromptText}
                        onChange={(e) => setEcomPromptText(e.target.value)}
                        className="w-full bg-black/40 border border-editor-border rounded-lg px-3 py-2 text-xs min-h-[80px] focus:outline-none focus:border-editor-accent"
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={handleAddEcomPrompt}
                          className="flex-1 py-2 bg-editor-accent text-black rounded-lg text-[10px] font-bold hover:opacity-90"
                        >
                          {editingEcomPromptId ? 'CẬP NHẬT' : 'LƯU PROMPT'}
                        </button>
                        <button 
                          onClick={() => {
                            setIsAddingEcomPrompt(false);
                            setEditingEcomPromptId(null);
                            setNewEcomPromptName('');
                            setEcomPromptText('');
                          }}
                          className="px-4 py-2 border border-editor-border rounded-lg text-[10px] font-bold hover:bg-white/5"
                        >
                          HỦY
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-2 mb-6 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                      {selectedEcomPromptId === 'manual' && (
                        <div
                          className="flex items-center gap-3 p-3 rounded-xl border border-editor-accent bg-editor-accent/5 transition-all cursor-pointer"
                        >
                          <div className="shrink-0 w-2 h-2 rounded-full bg-editor-accent shadow-[0_0_8px_rgba(255,255,0,0.5)]" />
                          <p className="text-xs font-bold text-editor-accent">
                            📝 Nhập thủ công
                          </p>
                        </div>
                      )}
                      {ecomSavedPrompts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedEcomPromptId(p.id);
                            setEcomPromptText(p.prompt);
                          }}
                          className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                            selectedEcomPromptId === p.id 
                              ? 'border-editor-accent bg-editor-accent/5' 
                              : 'border-editor-border hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`shrink-0 w-2 h-2 rounded-full ${selectedEcomPromptId === p.id ? 'bg-editor-accent shadow-[0_0_8px_rgba(255,255,0,0.5)]' : 'bg-gray-700'}`} />
                            <div className="overflow-hidden flex items-center gap-2">
                              <p className={`text-xs font-bold truncate ${selectedEcomPromptId === p.id ? 'text-editor-accent' : 'text-white'}`}>
                                {p.name}
                              </p>
                              {p.isDefault && <CheckCircle2 size={14} className="text-green-500 shrink-0" title="Đã đồng bộ" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 transition-all">
                            {isAdmin && (
                              <>
                                <button 
                                  onClick={(e) => toggleSyncEcomPrompt(p, e)}
                                  className="p-1.5 transition-all text-gray-500 hover:text-blue-400"
                                  title="Đồng bộ"
                                >
                                  <Globe size={12} />
                                </button>
                                <button 
                                  onClick={(e) => startEditEcomPrompt(p, e)}
                                  className="p-1.5 hover:text-editor-accent transition-all"
                                  title="Sửa"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  onClick={(e) => deleteEcomPrompt(p.id, e)}
                                  className="p-1.5 hover:text-red-500 transition-all"
                                  title="Xóa"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">NỘI DUNG PROMPT HIỆN TẠI</p>
                  <textarea 
                    value={ecomPromptText}
                    onChange={(e) => {
                      setEcomPromptText(e.target.value);
                      if (selectedEcomPromptId !== 'manual') {
                        setSelectedEcomPromptId('manual');
                      }
                    }}
                    placeholder="Mô tả nội dung..."
                    className="w-full h-24 bg-editor-border/10 border border-editor-border rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-editor-accent resize-none placeholder-gray-600 mb-6"
                  />
                </div>

              </div>
            </>
            )}

                <div className="mb-6">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-bold mt-4">Google AI Engine</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(MODEL_CONFIG) as ModelType[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setEcomModel(m)}
                        className={`p-2 rounded-xl border text-center transition-all relative overflow-hidden ${
                          ecomModel === m 
                            ? 'border-editor-accent bg-editor-accent/5' 
                            : m === 'banana-pro'
                              ? 'border-amber-500/50 bg-amber-500/5'
                              : 'border-editor-border hover:border-gray-600'
                        }`}
                      >
                        {m === 'banana-pro' && (
                          <div className="absolute top-0 right-0 bg-amber-500 text-black text-[6px] font-black px-1 py-0.5 rounded-bl-md">
                            BEST
                          </div>
                        )}
                        <p className={`text-[11px] font-bold ${
                          ecomModel === m 
                            ? 'text-editor-accent' 
                            : m === 'banana-pro'
                              ? 'text-amber-500'
                              : 'text-white'
                        }`}>
                          {MODEL_CONFIG[m].name}
                        </p>
                        {MODEL_CONFIG[m].requiredKey === 'google' && (
                          <span className="text-[7px] text-editor-accent uppercase font-bold block mt-0.5">Google</span>
                        )}
                        {MODEL_CONFIG[m].requiredKey === 'kie' && (
                          <span className="text-[7px] text-amber-500/70 uppercase font-bold block mt-0.5">Kie.ai</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-bold">TỈ LỆ KHUNG HÌNH</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.value}
                        onClick={() => setEcomAspectRatio(ratio.value)}
                        className={`py-2 px-1 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                          ecomAspectRatio === ratio.value 
                            ? 'border-editor-accent bg-editor-accent/5' 
                            : 'border-editor-border hover:border-gray-600'
                        }`}
                      >
                        <div className={`border border-current ${
                          ratio.value === '1:1' ? 'w-3 h-3' : 
                          ratio.value === '3:4' ? 'w-2.5 h-3' : 
                          ratio.value === '4:3' ? 'w-3 h-2.5' : 
                          ratio.value === '9:16' ? 'w-2 h-3.5' : 'w-3.5 h-2'
                        } ${ecomAspectRatio === ratio.value ? 'text-editor-accent' : 'text-gray-500'}`} />
                        <span className={`text-[8px] font-bold ${ecomAspectRatio === ratio.value ? 'text-editor-accent' : 'text-white'}`}>
                          {ratio.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-bold">CHẤT LƯỢNG ẢNH</p>
                  <div className="grid grid-cols-3 gap-2">
                    {['1k', '2k', '4k'].map((size) => (
                      <button
                        key={size}
                        onClick={() => setEcomImageSize(size)}
                        className={`py-2 rounded-xl border text-center transition-all ${
                          ecomImageSize === size 
                            ? 'border-editor-accent bg-editor-accent/5 text-editor-accent' 
                            : 'border-editor-border hover:border-gray-600 text-gray-400 hover:text-white'
                        }`}
                      >
                        <span className="text-[11px] font-bold uppercase">{size}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-bold">SỐ LƯỢNG KẾT QUẢ</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(ecomSubTab === 'pattern-replace' ? [1, 2] : [1, 2, 3]).map((count) => (
                      <button
                        key={count}
                        onClick={() => setEcomImageCount(count)}
                        className={`py-2 rounded-xl border text-center transition-all ${
                          ecomImageCount === count 
                            ? 'border-editor-accent bg-editor-accent/5 text-editor-accent' 
                            : 'border-editor-border hover:border-gray-600 text-gray-400 hover:text-white'
                        }`}
                      >
                        <span className="text-[11px] font-bold uppercase">{count} ẢNH</span>
                      </button>
                    ))}
                  </div>
                </div>

                {globalError && (
                  <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-xs">
                    <p>{globalError}</p>
                  </div>
                )}

                {ecomSubTab !== 'pattern-replace' && (
                  <div className="pt-4 space-y-4">
                    <button 
                      onClick={handleEcomGenerate}
                      disabled={!ecomProductImage || isEcomGenerating}
                      className="w-full py-4 rounded-xl bg-editor-accent text-black font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isEcomGenerating ? (
                        <><Loader2 className="animate-spin" size={20} /> Đang xử lý...</>
                      ) : (
                        <><Sparkles size={20} /> Gen ảnh TMĐT</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          {/* Right panel: Results */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="glass-panel p-6 min-h-[500px] flex flex-col justify-center">
              {selectedEcomGrid ? (
                <div className="flex flex-col items-center">
                  {ecomBoxes.length > 0 ? (
                    <div className="w-full flex flex-col items-center">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        {ecomBoxes.map((box) => {
                           const isSelected = selectedBoxIds.includes(box.id);
                           return (
                             <div 
                               key={box.id} 
                               className={`relative group rounded-xl overflow-hidden border-2 cursor-pointer transition-all aspect-[3/4] bg-black ${isSelected ? 'border-editor-accent' : 'border-editor-border opacity-50'}`}
                               onClick={() => {
                                 setSelectedBoxIds(prev => 
                                   prev.includes(box.id) ? prev.filter(id => id !== box.id) : [...prev, box.id]
                                 );
                               }}
                             >
                                <img src={box.cropUrl} alt="Crop" className="w-full h-full object-contain" />
                                <div className={`absolute top-2 right-2 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-editor-accent border-editor-accent text-black' : 'border-white text-transparent'}`}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <button onClick={(e) => {
                                      e.stopPropagation();
                                      setZoomImage(box.cropUrl);
                                  }} className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/40"><ZoomIn size={16} /></button>
                                </div>
                             </div>
                           );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mb-8">
                        <button 
                          onClick={() => {
                            if (ecomFinalImages.length > 0) {
                              if (!window.confirm("Phân tích lại sẽ xóa các kết quả đã tạo. Bạn có chắc chắn?")) return;
                            }
                            setEcomBoxes([]); 
                            setSelectedBoxIds([]); 
                            setEcomFinalImages([]); 
                          }}
                          className="px-6 py-3 bg-gray-800 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-gray-700 transition"
                          disabled={isEcomEnhancing}
                        >
                          Phân tích lại
                        </button>
                        
                        <div className="flex items-center gap-3 bg-editor-border/20 px-4 py-2 rounded-xl border border-editor-border/50">
                          <span className="text-sm font-medium text-gray-300">Tỉ lệ xuất:</span>
                          <select 
                            value={enhanceAspectRatio} 
                            onChange={(e) => setEnhanceAspectRatio(e.target.value)}
                            className="bg-gray-900 border border-editor-border text-white text-sm rounded-lg py-1.5 px-3 focus:ring-editor-accent focus:border-editor-accent outline-none"
                            disabled={isEcomEnhancing}
                          >
                            <option value="1:1">1:1 (Vuông)</option>
                            <option value="9:16">9:16 (Dọc)</option>
                            <option value="16:9">16:9 (Ngang)</option>
                            <option value="3:4">3:4 (Dọc ngắn)</option>
                            <option value="4:3">4:3 (Ngang ngắn)</option>
                          </select>
                        </div>

                        <button 
                          onClick={handleEnhanceSelectedBoxes}
                          disabled={isEcomEnhancing || selectedBoxIds.length === 0}
                          className="px-6 py-3 bg-editor-accent text-black font-bold rounded-xl flex items-center gap-2 hover:opacity-90 transition disabled:opacity-50"
                        >
                          {isEcomEnhancing ? (
                             <><RotateCw size={20} className="animate-spin" /> Đang gen ảnh ({selectedBoxIds.length})...</>
                          ) : (
                             <><Sparkles size={20} /> Gen {selectedBoxIds.length} ảnh đã chọn</>
                          )}
                        </button>
                      </div>

                      {/* RESULTS SECTION BELOW GRID */}
                      {ecomFinalImages.length > 0 && (
                        <div ref={resultsRef} className="w-full space-y-6 pt-8 border-t border-editor-border/30">
                           <div className="flex justify-between items-center bg-editor-border/20 p-4 rounded-xl">
                              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                <Sparkles size={20} className="text-editor-accent" /> Kết quả Tách Ảnh ({ecomFinalImages.length})
                              </h3>
                              <div className="flex gap-3">
                                {selectedResultIds.length > 0 && (
                                  <button onClick={async () => {
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
                                  }} className="px-4 py-2 bg-editor-accent text-black font-bold rounded-lg hover:opacity-90 transition text-xs flex items-center gap-2">
                                    <Download size={14} /> Tải {selectedResultIds.length} ảnh
                                  </button>
                                )}
                                {selectedResultIds.length > 0 && (
                                  <button onClick={handleTranslateSelectedImages}
                                    disabled={isTranslatingImages}
                                    className="px-4 py-2 bg-[#ff5722] text-white font-bold rounded-lg hover:opacity-90 transition text-xs flex items-center gap-2 disabled:opacity-50"
                                  >
                                    {isTranslatingImages ? (
                                      <><RotateCw size={14} className="animate-spin" /> Đang dịch...</>
                                    ) : (
                                      <><Languages size={14} /> Chuyển tiếng Việt ({selectedResultIds.length})</>
                                    )}
                                  </button>
                                )}
                                <button onClick={() => {
                                  if (window.confirm("Bạn có chắc chắn muốn xóa tất cả kết quả?")) {
                                    setEcomFinalImages([]);
                                    setSelectedResultIds([]);
                                  }
                                }} className="px-4 py-2 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition text-xs">
                                  Xóa kết quả
                                </button>
                              </div>
                           </div>
                           <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                                  className={`relative group rounded-xl overflow-hidden border transition-all cursor-pointer aspect-[3/4] flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500 bg-black ${isSelected ? 'border-editor-accent ring-2 ring-editor-accent/50' : 'border-editor-border hover:border-gray-500'}`}
                                >
                                  <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded border flex items-center justify-center transition-colors bg-black/60 border-gray-500">
                                    {isSelected && <CheckCircle2 size={24} className="text-editor-accent bg-black rounded-full" />}
                                  </div>
                                  <img src={res.url} alt={`Final Result ${i+1}`} className={`w-full h-full object-contain transition-all ${res.loading ? 'opacity-50 blur-sm scale-105' : 'scale-100'}`} />
                                  {res.loading && (
                                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
                                       <RotateCw size={24} className="animate-spin text-white mb-2" />
                                       <span className="text-white text-xs font-medium">Đang xử lý...</span>
                                     </div>
                                  )}
                                  {!res.loading && (
                                    <>
                                      {!isSelected && (
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                          <span className="px-4 py-2 bg-gray-800/80 text-white font-bold rounded-lg text-sm">Chọn</span>
                                        </div>
                                      )}
                                      <button 
                                        className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-lg bg-black/80 flex items-center justify-center hover:bg-black transition-colors opacity-0 group-hover:opacity-100 border border-editor-border/50 text-white hover:text-editor-accent pointer-events-auto"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setZoomImage(res.url);
                                        }}
                                        title="Phóng to ảnh"
                                      >
                                        <ZoomIn size={16} />
                                      </button>
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
                          className="px-6 py-3 bg-editor-accent text-black font-bold rounded-xl flex items-center gap-2 hover:opacity-90 transition disabled:opacity-50"
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
              ) : isEcomGenerating ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: ecomImageCount }).map((_, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden border border-editor-border bg-[#0f0f13] aspect-[3/4] flex flex-col items-center justify-center gap-4">
                      <div className="animate-pulse absolute inset-0 bg-gray-800/20" />
                      <Loader2 className="animate-spin text-editor-accent relative z-10" size={32} />
                      <p className="text-gray-400 text-xs font-medium relative z-10 animate-pulse">Đang tạo ảnh {i + 1}...</p>
                    </div>
                  ))}
                </div>
              ) : ecomResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ecomResults.map((res, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden border border-editor-border bg-black aspect-[3/4] flex items-center justify-center">
                      <img src={res} alt={`Result ${i+1}`} className="w-full h-full object-contain" />
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
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = res;
                            link.download = `ecom-result-${i+1}-${Date.now()}.png`;
                            link.click();
                          }}
                          className="px-4 py-2 bg-editor-accent text-black font-bold rounded-lg flex items-center gap-2 w-32 justify-center text-xs"
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

      {appMode === 'clothing' && (
        <>
          {/* Tab Switcher */}
          <div className="flex gap-4 mb-6 border-b border-editor-border">
        <button 
          onClick={() => setActiveTab('generate')}
          className={`pb-2 px-4 text-sm font-bold transition-all relative ${activeTab === 'generate' ? 'text-editor-accent' : 'text-gray-500 hover:text-white'}`}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            Gen Ảnh
          </div>
          {activeTab === 'generate' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-editor-accent" />}
        </button>
        <button 
          onClick={() => setActiveTab('analyze')}
          className={`pb-2 px-4 text-sm font-bold transition-all relative ${activeTab === 'analyze' ? 'text-editor-accent' : 'text-gray-500 hover:text-white'}`}
        >
          <div className="flex items-center gap-2">
            <Search size={16} />
            Phân Tích Ảnh
          </div>
          {activeTab === 'analyze' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-editor-accent" />}
        </button>
        <button 
          onClick={() => setActiveTab('tryon')}
          className={`pb-2 px-4 text-sm font-bold transition-all relative ${activeTab === 'tryon' ? 'text-editor-accent' : 'text-gray-500 hover:text-white'}`}
        >
          <div className="flex items-center gap-2">
            <Shirt size={16} />
            Thay Đồ
          </div>
          {activeTab === 'tryon' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-editor-accent" />}
        </button>
      </div>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {activeTab === 'generate' && (
          <>
            {/* Preview Area */}
            <div className="lg:col-span-2 flex flex-col gap-4">
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 glass-panel relative overflow-hidden flex items-center justify-center min-h-[400px] lg:min-h-0 transition-all ${isDragging ? 'border-editor-accent bg-editor-accent/5' : ''}`}
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
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-editor-border flex items-center justify-center group-hover:border-editor-accent transition-colors">
                    <Upload className="text-editor-border group-hover:text-editor-accent transition-colors" size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">Tải lên tối đa 5 ảnh</p>
                    <p className="text-xs text-gray-500">Nhấn để mở thư viện ảnh</p>
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
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Ảnh gốc ban đầu</p>
                      <button 
                        onClick={() => {
                          setIsReplacing(true);
                          fileInputRef.current?.click();
                        }}
                        className="text-[10px] text-editor-accent font-bold hover:underline"
                      >
                        THAY ĐỔI
                      </button>
                    </div>
                    <div 
                      className="flex-1 relative bg-black/20 rounded-lg overflow-hidden flex items-center justify-center border border-editor-border cursor-pointer hover:border-editor-accent transition-colors"
                      onClick={() => {
                        setIsReplacing(true);
                        fileInputRef.current?.click();
                      }}
                    >
                      <img 
                        src={currentImage?.source} 
                        alt="Original" 
                        className="max-w-full max-h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <div className="flex flex-col items-center gap-2">
                          <Upload size={24} className="text-editor-accent" />
                          <span className="text-[10px] font-bold text-white uppercase">Thay đổi ảnh gốc</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Processed Image Section */}
                  <div className="relative flex flex-col gap-2 h-full">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-editor-accent uppercase tracking-widest font-bold">Ảnh đầu ra sau khi Gen</p>
                      {currentImage?.processed && currentImage.processed !== currentImage.source && (
                        <button 
                          onClick={() => handleAiEdit(selectedIndex)}
                          disabled={currentImage.isProcessing}
                          className="text-[10px] text-editor-accent font-bold hover:underline flex items-center gap-1"
                        >
                          <RotateCcw size={10} />
                          THỬ LẠI TỪ GỐC
                        </button>
                      )}
                    </div>
                    <div className="flex-1 relative bg-black/20 rounded-lg overflow-hidden flex items-center justify-center border border-editor-border">
                      {currentImage?.processed && currentImage.processed !== currentImage.source ? (
                        <img 
                          src={currentImage.processed} 
                          alt="Processed" 
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-600 gap-2">
                          <ImageIcon size={32} />
                          <p className="text-[10px] uppercase font-bold">Chưa xử lý</p>
                          <button 
                            onClick={() => handleAiEdit(selectedIndex)}
                            className="mt-2 px-4 py-2 bg-editor-accent text-black text-[10px] font-bold rounded-full hover:opacity-90"
                          >
                            GEN ẢNH NÀY
                          </button>
                        </div>
                      )}
                      
                      {/* Download Button Overlay for Result */}
                      {currentImage?.processed && currentImage.processed !== currentImage.source && !isBatchProcessing && (
                        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                          <button 
                            onClick={() => handleDownload()}
                            className="flex items-center gap-2 px-3 py-2 bg-editor-accent text-black border border-editor-accent rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-lg"
                          >
                            <Download size={14} />
                            Lưu ảnh
                          </button>
                          <button 
                            onClick={() => handleAiEdit(selectedIndex)}
                            className="flex items-center gap-2 px-3 py-2 bg-black/60 text-white border border-white/20 backdrop-blur-md rounded-lg text-xs font-bold hover:bg-black/80 transition-all shadow-lg"
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
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-20">
                      <Loader2 className="animate-spin text-editor-accent" size={48} />
                      <div className="text-center">
                        <p className="font-bold text-lg">Đang xử lý AI...</p>
                        <p className="text-sm text-gray-400">Vui lòng đợi trong giây lát</p>
                      </div>
                    </div>
                  )}

                  {currentImage?.error && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6 text-center z-20">
                      <AlertCircle className="text-red-500" size={48} />
                      <div>
                        <p className="font-bold text-lg text-red-500">Lỗi xử lý</p>
                        <p className="text-sm text-gray-400">{currentImage.error}</p>
                      </div>
                      <button 
                        onClick={handleAiEdit}
                        className="px-4 py-2 bg-editor-border rounded-lg text-xs font-bold hover:bg-gray-700 transition-all"
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
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {images.map((img, idx) => (
                <div 
                  key={img.id}
                  className={`relative shrink-0 w-20 h-20 rounded-lg border-2 transition-all cursor-pointer group ${
                    selectedIndex === idx ? 'border-editor-accent' : 'border-editor-border hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedIndex(idx)}
                >
                  <img 
                    src={img.processed || img.source} 
                    className="w-full h-full object-cover rounded-md"
                    alt={`Thumb ${idx}`}
                  />
                  {img.isProcessing && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-md">
                      <Loader2 className="animate-spin text-editor-accent" size={16} />
                    </div>
                  )}
                  {img.processed && img.processed !== img.source && !img.isProcessing && (
                    <div className="absolute top-1 right-1 bg-editor-accent rounded-full p-0.5">
                      <CheckCircle2 className="text-black" size={10} />
                    </div>
                  )}
                  {img.error && (
                    <div className="absolute top-1 right-1 bg-red-500 rounded-full p-0.5">
                      <AlertCircle className="text-white" size={10} />
                    </div>
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(img.id);
                    }}
                    className="absolute -top-2 -right-2 bg-black border border-editor-border rounded-full p-1 transition-opacity hover:bg-red-500 hover:border-red-500 z-10"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-editor-border flex flex-col items-center justify-center gap-1 hover:border-editor-accent hover:bg-editor-accent/5 transition-all text-gray-500 hover:text-editor-accent"
                >
                  <Upload size={16} />
                  <span className="text-[8px] font-bold uppercase">Thêm</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Controls Area */}
        <div className="flex flex-col gap-6">
          {/* Main Control Panel */}
          <div className="glass-panel p-6 flex-1 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-150px)]">
            <div className="space-y-6 flex-1 flex flex-col">
              <div>
                <h3 className="font-bold flex items-center gap-2 mb-4">
                  <Sparkles size={18} className="text-editor-accent" />
                  Google AI Engine
                </h3>
                
                {/* Model Selector */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {(Object.keys(MODEL_CONFIG) as ModelType[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedModel(m)}
                      className={`p-2 rounded-xl border text-center transition-all relative overflow-hidden ${
                        selectedModel === m 
                          ? 'border-editor-accent bg-editor-accent/5' 
                          : m === 'banana-pro'
                            ? 'border-amber-500/50 bg-amber-500/5'
                            : 'border-editor-border hover:border-gray-600'
                      }`}
                    >
                      {m === 'banana-pro' && (
                        <div className="absolute top-0 right-0 bg-amber-500 text-black text-[6px] font-black px-1 py-0.5 rounded-bl-md">
                          BEST
                        </div>
                      )}
                      <p className={`text-[11px] font-bold ${
                        selectedModel === m 
                          ? 'text-editor-accent' 
                          : m === 'banana-pro'
                            ? 'text-amber-500'
                            : 'text-white'
                      }`}>
                        {MODEL_CONFIG[m].name}
                      </p>
                      {MODEL_CONFIG[m].requiredKey === 'google' && (
                        <span className="text-[7px] text-editor-accent uppercase font-bold block mt-0.5">Google</span>
                      )}
                      {MODEL_CONFIG[m].requiredKey === 'kie' && (
                        <span className="text-[7px] text-amber-500/70 uppercase font-bold block mt-0.5">Kie.ai</span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-gray-500 mb-6 italic leading-tight">
                  {MODEL_CONFIG[selectedModel].description}
                </p>

                {/* Aspect Ratio Selector - Integrated */}
                <div className="mb-6 space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Tỉ lệ khung hình</p>
                    {images.length > 1 && (
                      <button 
                        onClick={() => {
                          const currentRatio = images[selectedIndex].aspectRatio;
                          setImages(prev => prev.map(img => ({ ...img, aspectRatio: currentRatio })));
                        }}
                        className="text-[10px] text-editor-accent font-bold hover:underline"
                      >
                        ÁP DỤNG TẤT CẢ
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.value}
                        onClick={() => {
                          setImages(prev => prev.map((img, idx) => 
                            idx === selectedIndex ? { ...img, aspectRatio: ratio.value } : img
                          ));
                        }}
                        className={`py-2 px-1 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                          currentImage?.aspectRatio === ratio.value 
                            ? 'border-editor-accent bg-editor-accent/5' 
                            : 'border-editor-border hover:border-gray-600'
                        }`}
                      >
                        <div className={`border border-current ${
                          ratio.value === '1:1' ? 'w-3 h-3' : 
                          ratio.value === '3:4' ? 'w-2.5 h-3' : 
                          ratio.value === '4:3' ? 'w-3 h-2.5' : 
                          ratio.value === '9:16' ? 'w-2 h-3.5' : 'w-3.5 h-2'
                        } ${currentImage?.aspectRatio === ratio.value ? 'text-editor-accent' : 'text-gray-500'}`} />
                        <span className={`text-[8px] font-bold ${currentImage?.aspectRatio === ratio.value ? 'text-editor-accent' : 'text-white'}`}>
                          {ratio.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Danh sách Prompt đã lưu</p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setSelectedPromptId('manual');
                        setAiPrompt('');
                      }}
                      className="flex items-center gap-1 text-[10px] text-editor-accent font-bold hover:opacity-80 transition-opacity"
                    >
                      <Edit2 size={12} />
                      NHẬP THỦ CÔNG
                    </button>
                    <button 
                      onClick={() => setIsAddingPrompt(true)}
                      className="flex items-center gap-1 text-[10px] text-editor-accent font-bold hover:opacity-80 transition-opacity"
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
                        className="flex-1 py-2 bg-editor-accent text-black rounded-lg text-[10px] font-bold hover:opacity-90"
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
                        <div className="shrink-0 w-2 h-2 rounded-full bg-editor-accent shadow-[0_0_8px_rgba(255,255,0,0.5)]" />
                        <p className="text-xs font-bold text-editor-accent">
                          📝 Nhập thủ công
                        </p>
                      </div>
                    )}
                    {savedGenPrompts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => selectPrompt(p.id)}
                        className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          selectedPromptId === p.id 
                            ? 'border-editor-accent bg-editor-accent/5' 
                            : 'border-editor-border hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`shrink-0 w-2 h-2 rounded-full ${selectedPromptId === p.id ? 'bg-editor-accent shadow-[0_0_8px_rgba(255,255,0,0.5)]' : 'bg-gray-700'}`} />
                          <div className="overflow-hidden">
                            <p className={`text-xs font-bold truncate ${selectedPromptId === p.id ? 'text-editor-accent' : 'text-white'}`}>
                              {p.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 transition-all">
                          {(isAdmin || !p.isDefault) && (
                            <>
                              <button 
                                onClick={(e) => startEditPrompt(p, e)}
                                className="p-1.5 hover:text-editor-accent transition-all"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                onClick={(e) => deletePrompt(p.id, e)}
                                className="p-1.5 hover:text-red-500 transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Nội dung Prompt hiện tại</p>
                <textarea 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Mô tả nền và phong cách... (VD: phong cách anime, nền bãi biển)"
                  className="ai-input min-h-[100px] resize-none mb-6"
                />
              </div>

              <div className="mt-auto space-y-4">
                {globalError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-xs">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p>{globalError}</p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => handleAiEdit(selectedIndex)}
                    disabled={isBatchProcessing || images.length === 0 || !aiPrompt || currentImage?.isProcessing}
                    className="primary-btn flex items-center justify-center gap-2"
                  >
                    {currentImage?.isProcessing ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Đang xử lý ảnh này...
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} />
                        ✨ Gen ảnh hiện tại
                      </>
                    )}
                  </button>
                  
                  {images.length > 1 && (
                    <button 
                      onClick={() => handleAiEdit()}
                      disabled={isBatchProcessing || !aiPrompt}
                      className="w-full py-3 rounded-xl border border-editor-border text-white text-sm font-bold hover:bg-white/5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isBatchProcessing ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          Đang xử lý hàng loạt...
                        </>
                      ) : (
                        <>
                          <Layers size={16} />
                          Gen tất cả ({images.length} ảnh)
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                <p className="text-[10px] text-center text-gray-600">
                  {images.length > 0 ? `Đang chọn ảnh ${selectedIndex + 1}/${images.length}` : 'Vui lòng tải ảnh lên để bắt đầu'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    )}

        {activeTab === 'analyze' && (
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Analyze Tab Content */}
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Scan className="text-editor-accent" />
                Tải ảnh mẫu để phân tích
              </h2>
              <div 
                onClick={() => analyzeFileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`glass-panel aspect-video flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-editor-accent transition-all relative overflow-hidden ${isDragging ? 'border-editor-accent bg-editor-accent/5' : ''}`}
              >
                {analyzeImage ? (
                  <>
                    <img src={analyzeImage} alt="To analyze" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                      <p className="text-sm font-bold">Thay đổi ảnh</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-editor-border/30 flex items-center justify-center">
                      <Upload className="text-gray-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold">Bấm để tải ảnh</p>
                      <p className="text-xs text-gray-500">Ảnh sản phẩm bạn muốn lấy phong cách</p>
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
              <button 
                onClick={handleAnalyzeImage}
                disabled={!analyzeImage || isAnalyzing}
                className="w-full py-4 rounded-xl bg-editor-accent text-black font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Đang phân tích...
                  </>
                ) : (
                  <>
                    <Search size={20} />
                    Bắt đầu phân tích
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="text-editor-accent" />
                Kết quả Prompt
              </h2>
              <div className="glass-panel flex-1 min-h-[300px] p-4 font-mono text-xs overflow-auto bg-black/20">
                {analyzedPrompt ? (
                  <pre className="whitespace-pre-wrap text-editor-accent">{analyzedPrompt}</pre>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 italic">
                    Kết quả phân tích sẽ hiện ở đây...
                  </div>
                )}
              </div>
              {analyzedPrompt && (
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={saveAnalyzedPrompt}
                    className="py-3 rounded-xl border border-editor-border font-bold flex items-center justify-center gap-2 hover:bg-editor-border/30 transition-all"
                  >
                    <Save size={18} />
                    Lưu Prompt
                  </button>
                  <button 
                    onClick={useAnalyzedPrompt}
                    className="py-3 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                  >
                    <Copy size={18} />
                    Sử dụng ngay
                  </button>
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
                        className="flex-1 py-3 bg-editor-accent text-black rounded-xl text-sm font-bold hover:opacity-90 transition-all"
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
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Ảnh người mẫu (Model)</p>
                  <div 
                    onClick={() => modelFileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setTryOnModelImage(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className={`aspect-[3/4] glass-panel relative overflow-hidden flex items-center justify-center cursor-pointer transition-all border-dashed border-2 ${tryOnModelImage ? 'border-editor-accent' : 'border-editor-border hover:border-editor-accent'}`}
                  >
                    {tryOnModelImage ? (
                      <img src={tryOnModelImage} alt="Model" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <UserIcon size={32} className="text-gray-500" />
                        <span className="text-xs text-gray-500">Tải ảnh người mẫu</span>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={modelFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleTryOnUpload(e, 'model')} />
                  
                  {/* Saved Models List */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Người mẫu đã lưu ({savedModels.length}/5)</p>
                      {savedModels.length < 5 && (
                        <button 
                          onClick={() => {
                            if (!user) {
                              handleLogin();
                            } else {
                              modelListFileInputRef.current?.click();
                            }
                          }}
                          disabled={isSavingModel}
                          className="text-[10px] text-editor-accent font-bold hover:underline flex items-center gap-1 disabled:opacity-50"
                        >
                          {isSavingModel ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                          THÊM MỚI
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {savedModels.map((model) => (
                        <div 
                          key={model.id}
                          className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${
                            tryOnModelImage === model.imageUrl ? 'border-editor-accent' : 'border-editor-border hover:border-gray-600'
                          }`}
                          onClick={() => setTryOnModelImage(model.imageUrl)}
                        >
                          <img src={model.imageUrl} alt="Saved Model" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteModel(model.id);
                            }}
                            className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                      {Array.from({ length: 5 - savedModels.length }).map((_, i) => (
                        <div 
                          key={`empty-${i}`}
                          className="aspect-[3/4] rounded-lg border-2 border-dashed border-editor-border flex items-center justify-center bg-black/20"
                        >
                          <UserIcon size={16} className="text-gray-700" />
                        </div>
                      ))}
                    </div>
                    <input type="file" ref={modelListFileInputRef} className="hidden" accept="image/*" onChange={handleModelListUpload} />
                  </div>
                </div>

                {/* Product Image Upload */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Ảnh sản phẩm (Product)</p>
                    {tryOnProductImage && (
                      <button 
                        onClick={handleGenerateWhiteBg}
                        disabled={isGeneratingWhiteBg}
                        className="text-[10px] bg-editor-accent/20 text-editor-accent px-2 py-1 rounded hover:bg-editor-accent/30 transition-colors flex items-center gap-1 disabled:opacity-50"
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
                    onClick={() => productFileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setTryOnProductImage(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className={`aspect-[3/4] glass-panel relative overflow-hidden flex items-center justify-center cursor-pointer transition-all border-dashed border-2 ${tryOnProductImage ? 'border-editor-accent' : 'border-editor-border hover:border-editor-accent'}`}
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
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Shirt size={32} className="text-gray-500" />
                        <span className="text-xs text-gray-500">Tải ảnh sản phẩm</span>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={productFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleTryOnUpload(e, 'product')} />
                  
                  {/* Category Selection */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Loại:</span>
                    <div className="flex bg-black/40 rounded-lg p-1 border border-editor-border flex-1">
                      {(['top', 'bottom', 'shoes', 'all'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setTryOnProductCategory(cat)}
                          className={`flex-1 py-1 text-[10px] font-bold uppercase rounded transition-all ${
                            tryOnProductCategory === cat 
                              ? 'bg-editor-accent text-black shadow-lg' 
                              : 'text-gray-500 hover:text-white'
                          }`}
                        >
                          {cat === 'top' ? 'Áo' : cat === 'bottom' ? 'Quần' : cat === 'shoes' ? 'Giày' : 'Tất cả'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Result Image Area */}
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] text-editor-accent uppercase tracking-widest font-bold">Kết quả thay đồ (Result)</p>
                  <div className="aspect-[3/4] glass-panel relative overflow-hidden flex items-center justify-center bg-black/40 border-2 border-editor-border">
                    {isTryOnProcessing ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-editor-accent" size={32} />
                        <p className="text-[10px] font-bold uppercase text-editor-accent">
                          {tryOnStep === 'preparing' ? 'Đang chuẩn bị sản phẩm...' : 'Đang thay đồ...'}
                        </p>
                      </div>
                    ) : tryOnResult ? (
                      <>
                        <img src={tryOnResult} alt="Result" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                          <button 
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = tryOnResult!;
                              link.download = `tryon-${Date.now()}.png`;
                              link.click();
                            }}
                            className="p-3 bg-editor-accent text-black rounded-full shadow-lg hover:scale-110 transition-transform"
                            title="Tải ảnh về"
                          >
                            <Download size={20} />
                          </button>
                          <button 
                            onClick={() => {
                              setTryOnModelImage(tryOnResult);
                              setTryOnResult(null);
                            }}
                            className="p-3 bg-black/60 text-white backdrop-blur-md border border-white/20 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
                            title="Dùng làm người mẫu để thay tiếp"
                          >
                            <ArrowLeft size={20} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-600">
                        <ImageIcon size={32} />
                        <span className="text-xs uppercase font-bold">Chưa có kết quả</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-6">
              <div className="glass-panel p-6 flex flex-col gap-6">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <Sparkles className="text-editor-accent" />
                    Cấu hình Thay Đồ
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Chọn Mô hình AI</p>
                      <div className="flex gap-2 p-1 bg-black/40 rounded-2xl border border-editor-border">
                        {(Object.keys(MODEL_CONFIG) as ModelType[]).map((m) => (
                          <button
                            key={m}
                            onClick={() => setSelectedModel(m)}
                            className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${selectedModel === m ? 'bg-editor-accent text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                          >
                            {MODEL_CONFIG[m].name}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2 italic px-1">
                        {MODEL_CONFIG[selectedModel].description}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Chọn Prompt nhanh</p>
                        <button 
                          onClick={() => setIsAddingPrompt(true)}
                          className="flex items-center gap-1 text-[10px] text-editor-accent font-bold hover:opacity-80 transition-opacity"
                        >
                          <Plus size={12} />
                          THÊM MỚI
                        </button>
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
                              className="flex-1 py-2 bg-editor-accent text-black rounded-lg text-[10px] font-bold hover:opacity-90"
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
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar mb-4">
                          {savedTryOnPrompts.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => setTryOnPrompt(p.prompt)}
                              className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                tryOnPrompt === p.prompt 
                                  ? 'border-editor-accent bg-editor-accent/5' 
                                  : 'border-editor-border hover:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`shrink-0 w-2 h-2 rounded-full ${tryOnPrompt === p.prompt ? 'bg-editor-accent shadow-[0_0_8px_rgba(255,255,0,0.5)]' : 'bg-gray-700'}`} />
                                <div className="overflow-hidden">
                                  <p className={`text-xs font-bold truncate ${tryOnPrompt === p.prompt ? 'text-editor-accent' : 'text-white'}`}>
                                    {p.name}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                {(isAdmin || !p.isDefault) && (
                                  <>
                                    <button 
                                      onClick={(e) => startEditPrompt(p, e)}
                                      className="p-1.5 hover:text-editor-accent transition-all"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button 
                                      onClick={(e) => deletePrompt(p.id, e)}
                                      className="p-1.5 hover:text-red-500 transition-all"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Nội dung Prompt</p>
                      <textarea 
                        value={tryOnPrompt}
                        onChange={(e) => setTryOnPrompt(e.target.value)}
                        placeholder="Mô tả cách thay đồ... (VD: Thay chiếc áo thun này cho người mẫu, giữ nguyên tư thế)"
                        className="ai-input min-h-[120px] resize-none"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleTryOnProcess}
                  disabled={!tryOnModelImage || !tryOnProductImage || isTryOnProcessing}
                  className="w-full py-4 rounded-xl bg-editor-accent text-black font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isTryOnProcessing ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Shirt size={20} />
                      Bắt đầu Thay Đồ
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      </>
      )}

      {/* Footer Info */}
      <footer className="mt-8 pt-4 border-t border-editor-border flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-editor-accent" />
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">{MODEL_CONFIG[selectedModel].name} Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers size={14} className="text-editor-accent" />
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">Batch Editing (Max 5)</span>
          </div>
        </div>
        <div className="text-[10px] text-gray-600">
          © 2026 Professional Photo Editor AI
        </div>
      </footer>
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-6 w-full max-w-md relative"
            >
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <Settings className="text-editor-accent" size={24} />
                <h2 className="text-xl font-bold">Cài đặt API Key</h2>
              </div>
              
              <div className="space-y-6">
                <div className="bg-editor-border/30 p-4 rounded-xl border border-editor-border space-y-3">
                  <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                    Kie.ai API Key
                  </h3>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Sử dụng cho các mô hình "GPT2" và "Banana Pro".
                    <br/>Lấy tại <a href="https://kie.ai" target="_blank" rel="noopener noreferrer" className="text-editor-accent underline">kie.ai</a>.
                  </p>
                  <input 
                    type="password"
                    placeholder="sk-..."
                    value={kieApiKey}
                    onChange={(e) => {
                      setKieApiKey(e.target.value);
                      localStorage.setItem('kieApiKey', e.target.value);
                    }}
                    className="w-full bg-black/50 border border-editor-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-editor-accent"
                  />
                </div>

                <div className="bg-editor-border/30 p-4 rounded-xl border border-editor-border space-y-3">
                  <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                    Google AI Studio API Key  
                  </h3>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Sử dụng cho mô hình "Banana 2" (miễn phí).
                    <br/>Lấy tại <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-editor-accent underline">aistudio.google.com</a>.
                  </p>
                  <input 
                    type="password"
                    placeholder="AIzaSy..."
                    value={googleApiKey}
                    onChange={(e) => {
                      setGoogleApiKey(e.target.value);
                      localStorage.setItem('googleApiKey', e.target.value);
                    }}
                    className="w-full bg-black/50 border border-editor-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-editor-accent"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="bg-editor-accent text-black font-bold px-6 py-2 rounded-lg hover:shadow-[0_0_15px_rgba(212,255,0,0.3)] transition-all"
                >
                  Xong
                </button>
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
  );
}
