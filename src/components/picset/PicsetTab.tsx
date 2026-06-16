import { useState } from 'react';
import { Check, Loader2, Wand2 } from 'lucide-react';
import Step1Input, { emptyForm, type PicsetStep1Form } from './Step1Input';
import Step2Blueprint from './Step2Blueprint';
import Step3Results, { type PicsetSlotState } from './Step3Results';

// ============== Types (mirror api/_lib/picset.ts blueprint schema) ==============
export type ImageCategory =
  | 'Feature Image'
  | 'Pain Point Image'
  | 'Detail / Material Image'
  | 'Selling Point Image'
  | 'Scene Image'
  | 'Specification / Parameter Image';

export interface BlueprintImage {
  slot: number;
  /** Chinese design-block id (1 of 16 — patch PICSET-PATCH-CHINESE-BLOCKS.md) */
  category?: string;
  title_en: string;
  title_vi: string;
  outer_description?: string;
  /** Broad role enum (6 values) — separate from `category` */
  image_category?: ImageCategory | string;
  design_objective?: string;
  product_appearance?: boolean;
  complex_structure_assessment?: boolean;
  content_elements: {
    display_focus: string;
    pain_point_scenario: string;
    background_elements: string;
  };
  image_within_image: string | null;
  text_content_vi: {
    main_title: string;
    subtitle: string;
    description: string;
  };
  size_chart: any | null;
  special_requirements: string | null;
}

export interface Blueprint {
  product_analysis: any;
  design_specs: any;
  images: BlueprintImage[];
}

export type PicsetStep = 1 | 2 | 3;

// Stepper labels (Section 4 — Step 2 spec)
const STEP_LABELS = ['Input', 'Analyzing', 'Plan Preview', 'Generating', 'Complete'];

interface StepperProps {
  step: PicsetStep;
  isAnalyzing?: boolean;
  isGenerating?: boolean;
  allDone?: boolean;
}

function Stepper({ step, isAnalyzing, isGenerating, allDone }: StepperProps) {
  // Map step+phase to active index in 5-stage stepper
  let activeIdx = 0;
  if (step === 1) activeIdx = isAnalyzing ? 1 : 0;
  else if (step === 2) activeIdx = 2;
  else if (step === 3) activeIdx = allDone ? 4 : 3;

  return (
    <div className="flex items-center gap-1 flex-wrap mb-4">
      {STEP_LABELS.map((label, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        const inProgress = active && (isAnalyzing || isGenerating);
        return (
          <div key={label} className="flex items-center gap-1">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: done ? 'rgba(52,199,89,0.15)' : active ? 'rgba(0,122,255,0.15)' : 'var(--color-fill)',
                color: done ? 'var(--color-success)' : active ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              }}
            >
              {done && <Check size={11} strokeWidth={2.5} />}
              {inProgress && <Loader2 size={11} className="animate-spin" />}
              <span className="text-xs font-semibold">{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10 }}>›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============== Main shell ==============
export default function PicsetTab() {
  const [step, setStep] = useState<PicsetStep>(1);
  const [form, setForm] = useState<PicsetStep1Form>(() => emptyForm());
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [slots, setSlots] = useState<PicsetSlotState[]>([]);
  const [allGenDone, setAllGenDone] = useState(false);

  // ============== Analyze ==============
  const callAnalyze = async (): Promise<Blueprint | null> => {
    setAnalyzeError(null);
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/picset/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: form.mainImageBase64,
          brief: form.brief,
          targetCount: form.quantity,
          targetPlatform: form.platform,
          language: form.language,
          // Analyze giờ chạy qua Kie.ai (Gemini 3.5 Flash) thay vì Gemini direct
          clientKieApiKey: localStorage.getItem('kieApiKey') || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (!data.blueprint) throw new Error('Server không trả blueprint.');
      return data.blueprint as Blueprint;
    } catch (e: any) {
      setAnalyzeError(e?.message || 'Lỗi không rõ khi analyze.');
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    const bp = await callAnalyze();
    if (bp) {
      setBlueprint(bp);
      setStep(2);
    }
  };

  const handleReanalyze = async () => {
    const bp = await callAnalyze();
    if (bp) setBlueprint(bp);
  };

  // ============== Generate ==============
  const callGenerate = async (images: BlueprintImage[]): Promise<PicsetSlotState[] | null> => {
    if (!blueprint) return null;
    try {
      const res = await fetch('/api/picset/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          designSpecs: blueprint.design_specs,
          productImageBase64: form.mainImageBase64,
          model: form.model,
          aspectRatio: form.aspectRatio,
          quality: form.quality,
          clientKieApiKey: localStorage.getItem('kieApiKey') || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const tasks: Array<{ slot: number; taskId: string | null; error: string | null }> = data.tasks || [];
      const next: PicsetSlotState[] = tasks.map((t) => {
        const img = images.find((i) => i.slot === t.slot);
        return {
          slot: t.slot,
          taskId: t.taskId,
          status: t.taskId ? 'pending' : 'failed',
          url: null,
          error: t.error,
          title: img?.title_vi || img?.title_en || `Ảnh ${t.slot}`,
        };
      });
      return next;
    } catch (e: any) {
      setAnalyzeError(e?.message || 'Lỗi gen.');
      return null;
    }
  };

  const handleGenerate = async () => {
    if (!blueprint) return;
    setIsGenerating(true);
    setAllGenDone(false);
    const next = await callGenerate(blueprint.images);
    if (next) {
      setSlots(next);
      setStep(3);
    }
    setIsGenerating(false);
  };

  const handleRegenerateFailed = async () => {
    if (!blueprint) return;
    const failedSlots = slots.filter((s) => s.status === 'failed').map((s) => s.slot);
    if (failedSlots.length === 0) return;
    const failedImages = blueprint.images.filter((img) => failedSlots.includes(img.slot));
    if (failedImages.length === 0) return;
    setIsGenerating(true);
    setAllGenDone(false);
    const regen = await callGenerate(failedImages);
    if (regen) {
      // Merge: replace failed slots with new pending/failed entries, keep successful ones
      setSlots((prev) =>
        prev.map((s) => {
          const replacement = regen.find((r) => r.slot === s.slot);
          return replacement ? replacement : s;
        })
      );
    }
    setIsGenerating(false);
  };

  // ============== Navigation ==============
  const handleBackToInput = () => setStep(1);
  const handleBackToBlueprint = () => {
    setStep(2);
    setAllGenDone(false);
  };
  const handleRestart = () => {
    setStep(1);
    setBlueprint(null);
    setSlots([]);
    setAllGenDone(false);
    setAnalyzeError(null);
    setForm(emptyForm());
  };

  return (
    <main className="flex-1 max-w-7xl mx-auto w-full p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Wand2 size={20} style={{ color: 'var(--color-accent)' }} />
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Picset Studio</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-fill)', color: 'var(--color-text-tertiary)' }}>
          Workflow 3-step
        </span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        AI phân tích sản phẩm → tạo blueprint customize → user review/edit → gen N ảnh detail page TMĐT chất lượng cao.
      </p>

      {/* Stepper */}
      <Stepper step={step} isAnalyzing={isAnalyzing} isGenerating={isGenerating} allDone={allGenDone} />

      {/* Step content */}
      {step === 1 && (
        <Step1Input
          form={form}
          onChange={setForm}
          isAnalyzing={isAnalyzing}
          analyzeError={analyzeError}
          onAnalyze={handleAnalyze}
        />
      )}

      {step === 2 && blueprint && (
        <Step2Blueprint
          blueprint={blueprint}
          productImageDataUrl={form.mainImageDataUrl}
          isGenerating={isGenerating}
          isReanalyzing={isAnalyzing}
          onChange={setBlueprint}
          onBack={handleBackToInput}
          onReanalyze={handleReanalyze}
          onGenerate={handleGenerate}
        />
      )}

      {step === 3 && (
        <Step3Results
          slots={slots}
          productName={form.productName}
          onAllDone={(final) => {
            setSlots(final);
            setAllGenDone(true);
          }}
          onBackToBlueprint={handleBackToBlueprint}
          onRestart={handleRestart}
          onRegenerateFailed={handleRegenerateFailed}
          isRegenerating={isGenerating}
        />
      )}
    </main>
  );
}
