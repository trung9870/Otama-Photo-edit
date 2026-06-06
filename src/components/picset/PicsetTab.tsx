import { useState } from 'react';
import { Check, Loader2, Wand2 } from 'lucide-react';
import { PicsetSettings, loadPicsetKeys, type PicsetKeys } from './PicsetSettings';

// ============== Types (mirror api/_lib/picset.ts blueprint schema) ==============
export interface BlueprintImage {
  slot: number;
  title_en: string;
  title_vi: string;
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
}

function Stepper({ step, isAnalyzing, isGenerating }: StepperProps) {
  // Map step+phase to active index in 5-stage stepper
  let activeIdx = 0;
  if (step === 1) activeIdx = isAnalyzing ? 1 : 0;
  else if (step === 2) activeIdx = 2;
  else if (step === 3) activeIdx = isGenerating ? 3 : 4;

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
interface PicsetTabProps {
  // Reserved for Phase 3: user (for history pushing), logUsage (for admin tracking)
  // Currently unused — Phase 2 is the shell only.
}

export default function PicsetTab(_props: PicsetTabProps) {
  const [keys, setKeys] = useState<PicsetKeys>(() => loadPicsetKeys());
  const [step, setStep] = useState<PicsetStep>(1);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Phase 2 placeholder reset — real reset wires through Step3 button in Phase 3
  const handleReset = () => {
    setStep(1);
    setBlueprint(null);
  };

  return (
    <main className="flex-1 max-w-7xl mx-auto w-full">
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

      {/* Settings card (BYOK) */}
      <PicsetSettings keys={keys} onChange={setKeys} />

      {/* Stepper */}
      <Stepper step={step} isAnalyzing={isAnalyzing} isGenerating={isGenerating} />

      {/* Step content — placeholders for Phase 3 */}
      {step === 1 && (
        <div
          className="p-8 text-center"
          style={{
            background: 'var(--color-card)',
            border: '0.5px solid var(--color-border-soft)',
            borderRadius: 18,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <strong>Step 1 — Input</strong> (Phase 3 sẽ build form + cost estimate ở đây)
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
            Backend đã sẵn sàng: <code>/api/picset/analyze</code> và <code>/api/picset/generate</code>.
          </p>
        </div>
      )}
      {step === 2 && (
        <div
          className="p-8 text-center"
          style={{
            background: 'var(--color-card)',
            border: '0.5px solid var(--color-border-soft)',
            borderRadius: 18,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <strong>Step 2 — Blueprint Review</strong> (Phase 3)
          </p>
          <button onClick={handleReset} className="text-xs mt-3 underline" style={{ color: 'var(--color-accent)' }}>
            ← Quay lại Input
          </button>
        </div>
      )}
      {step === 3 && (
        <div
          className="p-8 text-center"
          style={{
            background: 'var(--color-card)',
            border: '0.5px solid var(--color-border-soft)',
            borderRadius: 18,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <strong>Step 3 — Results</strong> (Phase 3)
          </p>
          <button onClick={handleReset} className="text-xs mt-3 underline" style={{ color: 'var(--color-accent)' }}>
            ↺ Bắt đầu sản phẩm mới
          </button>
        </div>
      )}
    </main>
  );
}
