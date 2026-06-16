import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Upload, Image as ImageIcon, X, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui';

// ============== Public types ==============
export type PicsetPlatform = 'Shopee' | 'TikTok Shop' | 'Lazada' | 'Smart Match';
export type PicsetLanguage = 'Vietnamese' | 'English' | 'Chinese';
export type PicsetModel = 'gpt2' | 'banana-pro';
export type PicsetAspect = '1:1' | '9:16' | '16:9' | '4:5' | '3:4' | '4:3';
export type PicsetQuality = '1K' | '2K' | '4K';

export interface PicsetStep1Form {
  productName: string;
  brief: string;
  mainImageBase64: string;          // single primary image (data url stripped to base64)
  mainImageDataUrl: string;         // for preview
  refImagesDataUrls: string[];      // for preview only (analyze uses main only)
  platform: PicsetPlatform;
  language: PicsetLanguage;
  model: PicsetModel;
  aspectRatio: PicsetAspect;
  quality: PicsetQuality;
  quantity: number;                 // 1..15
}

export function emptyForm(): PicsetStep1Form {
  return {
    productName: '',
    brief: '',
    mainImageBase64: '',
    mainImageDataUrl: '',
    refImagesDataUrls: [],
    platform: 'Smart Match',
    language: 'Vietnamese',
    model: 'banana-pro',
    aspectRatio: '4:5',
    quality: '2K',
    quantity: 8,
  };
}

// ============== Cost table (Section 9 spec) ==============
const KIE_PRICES: Record<PicsetModel, Record<PicsetQuality, number>> = {
  'gpt2':       { '1K': 0.02, '2K': 0.07, '4K': 0.19 },
  'banana-pro': { '1K': 0.09, '2K': 0.12, '4K': 0.15 },
};
// Analyze giờ chạy qua Kie.ai (Gemini 3.5 Flash) — ~tương đương Gemini direct, hơi rẻ hơn
const ANALYZE_COST_USD = 0.025;
const USD_TO_VND = 25000;

export function estimatePicsetCost(model: PicsetModel, quality: PicsetQuality, quantity: number) {
  const perImage = KIE_PRICES[model][quality];
  const genTotal = perImage * quantity;
  const total = genTotal + ANALYZE_COST_USD;
  return {
    perImageUsd: perImage,
    genTotalUsd: genTotal,
    analyzeUsd: ANALYZE_COST_USD,
    totalUsd: total,
    totalVnd: Math.round(total * USD_TO_VND),
  };
}

// ============== Helpers ==============
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function stripBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

// ============== Component ==============
interface Step1Props {
  form: PicsetStep1Form;
  onChange: (f: PicsetStep1Form) => void;
  isAnalyzing: boolean;
  analyzeError: string | null;
  onAnalyze: () => void;
}

export default function Step1Input({
  form,
  onChange,
  isAnalyzing,
  analyzeError,
  onAnalyze,
}: Step1Props) {
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const mainInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const cost = useMemo(
    () => estimatePicsetCost(form.model, form.quality, form.quantity),
    [form.model, form.quality, form.quantity]
  );

  const handleMainUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadErr('File không phải ảnh.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadErr('Ảnh quá lớn (max 8MB).');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange({ ...form, mainImageDataUrl: dataUrl, mainImageBase64: stripBase64(dataUrl) });
      setUploadErr(null);
    } catch {
      setUploadErr('Không đọc được file ảnh.');
    }
  };

  const handleRefUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 3 - form.refImagesDataUrls.length;
    const take = Math.min(files.length, remaining);
    const next = [...form.refImagesDataUrls];
    for (let i = 0; i < take; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;
      if (f.size > 8 * 1024 * 1024) continue;
      try {
        const dataUrl = await fileToDataUrl(f);
        next.push(dataUrl);
      } catch {}
    }
    onChange({ ...form, refImagesDataUrls: next });
  };

  const removeMain = () => onChange({ ...form, mainImageBase64: '', mainImageDataUrl: '' });
  const removeRef = (idx: number) =>
    onChange({ ...form, refImagesDataUrls: form.refImagesDataUrls.filter((_, i) => i !== idx) });

  const canAnalyze =
    !!form.mainImageBase64 && !!form.productName.trim() && !isAnalyzing;

  const disabledReason = !form.mainImageBase64
    ? 'Cần upload ảnh sản phẩm'
    : !form.productName.trim()
    ? 'Cần tên sản phẩm'
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ============== Left column: form ============== */}
      <div
        className="p-5 flex flex-col gap-4"
        style={{
          background: 'var(--color-card)',
          border: '0.5px solid var(--color-border-soft)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <Field label="Tên sản phẩm" required>
          <input
            type="text"
            value={form.productName}
            onChange={(e) => onChange({ ...form, productName: e.target.value })}
            placeholder="VD: Bộ chăn ga gối 4 món bướm tím"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={inputStyle}
          />
        </Field>

        <Field label="Mô tả / Brief">
          <textarea
            value={form.brief}
            onChange={(e) => onChange({ ...form, brief: e.target.value })}
            placeholder="Nhập điểm bán, đặc tính, gam màu... cách nhau bằng dấu phẩy"
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm resize-y"
            style={inputStyle}
          />
        </Field>

        <Field label="Ảnh sản phẩm chính" required>
          {!form.mainImageDataUrl ? (
            <button
              type="button"
              onClick={() => mainInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-lg"
              style={{
                background: 'var(--color-fill)',
                border: '1px dashed var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <Upload size={20} />
              <span className="text-xs">Bấm để upload ảnh chính (1 ảnh, max 8MB)</span>
            </button>
          ) : (
            <div className="relative inline-block">
              <img
                src={form.mainImageDataUrl}
                alt="Sản phẩm"
                className="rounded-lg object-cover"
                style={{ width: 140, height: 140, border: '0.5px solid var(--color-border-soft)' }}
              />
              <button
                type="button"
                onClick={removeMain}
                className="absolute -top-2 -right-2 p-1 rounded-full"
                style={{ background: 'var(--color-danger)', color: '#fff' }}
                aria-label="Xóa ảnh chính"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <input
            ref={mainInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleMainUpload(e.target.files?.[0])}
          />
          {uploadErr && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
              {uploadErr}
            </p>
          )}
        </Field>

        <Field label={`Ảnh tham khảo (optional, ${form.refImagesDataUrls.length}/3)`}>
          <div className="flex flex-wrap gap-2">
            {form.refImagesDataUrls.map((url, i) => (
              <div key={i} className="relative">
                <img
                  src={url}
                  alt={`ref ${i + 1}`}
                  className="rounded-lg object-cover"
                  style={{ width: 64, height: 64, border: '0.5px solid var(--color-border-soft)' }}
                />
                <button
                  type="button"
                  onClick={() => removeRef(i)}
                  className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full"
                  style={{ background: 'var(--color-danger)', color: '#fff' }}
                  aria-label={`Xóa ảnh ref ${i + 1}`}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {form.refImagesDataUrls.length < 3 && (
              <button
                type="button"
                onClick={() => refInputRef.current?.click()}
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 64,
                  height: 64,
                  background: 'var(--color-fill)',
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                <ImageIcon size={16} />
              </button>
            )}
          </div>
          <input
            ref={refInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleRefUpload(e.target.files);
              e.target.value = '';
            }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target Platform">
            <Select
              value={form.platform}
              onChange={(v) => onChange({ ...form, platform: v as PicsetPlatform })}
              options={[
                { value: 'Smart Match', label: 'Smart Match (auto)' },
                { value: 'Shopee', label: 'Shopee' },
                { value: 'TikTok Shop', label: 'TikTok Shop' },
                { value: 'Lazada', label: 'Lazada' },
              ]}
            />
          </Field>

          <Field label="Output Language">
            <Select
              value={form.language}
              onChange={(v) => onChange({ ...form, language: v as PicsetLanguage })}
              options={[
                { value: 'Vietnamese', label: 'Tiếng Việt' },
                { value: 'English', label: 'English' },
                { value: 'Chinese', label: '中文' },
              ]}
            />
          </Field>

          <Field label="Model">
            <Select
              value={form.model}
              onChange={(v) => onChange({ ...form, model: v as PicsetModel })}
              options={[
                { value: 'banana-pro', label: 'Banana Pro (Kie.ai)' },
                { value: 'gpt2', label: 'GPT2 (Kie.ai)' },
              ]}
            />
          </Field>

          <Field label="Aspect Ratio">
            <Select
              value={form.aspectRatio}
              onChange={(v) => onChange({ ...form, aspectRatio: v as PicsetAspect })}
              options={[
                { value: '4:5', label: '4:5 (TMĐT chuẩn)' },
                { value: '1:1', label: '1:1' },
                { value: '9:16', label: '9:16' },
                { value: '16:9', label: '16:9' },
                { value: '3:4', label: '3:4' },
                { value: '4:3', label: '4:3' },
              ]}
            />
          </Field>

          <Field label="Quality">
            <Select
              value={form.quality}
              onChange={(v) => onChange({ ...form, quality: v as PicsetQuality })}
              options={[
                { value: '1K', label: '1K (rẻ nhất)' },
                { value: '2K', label: '2K' },
                { value: '4K', label: '4K (đẹp nhất)' },
              ]}
            />
          </Field>

          <Field label={`Quantity: ${form.quantity} ảnh`}>
            <input
              type="range"
              min={1}
              max={15}
              value={form.quantity}
              onChange={(e) => onChange({ ...form, quantity: Number(e.target.value) })}
              className="w-full"
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Field>
        </div>

        {/* Cost estimate */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded-lg"
          style={{
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent)',
          }}
        >
          <div className="text-xs font-semibold">
            Ước tính chi phí ({form.quantity} ảnh + analyze)
          </div>
          <div className="text-sm font-bold">
            ~${cost.totalUsd.toFixed(2)} (~{(cost.totalVnd / 1000).toFixed(1)}k₫)
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-2">
          <Button
            variant="filled"
            size="lg"
            icon={isAnalyzing ? undefined : Sparkles}
            fullWidth
            disabled={!canAnalyze}
            onClick={onAnalyze}
          >
            {isAnalyzing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Đang phân tích...
              </span>
            ) : (
              'Analyze & Blueprint'
            )}
          </Button>
          {!isAnalyzing && disabledReason && (
            <p className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              {disabledReason}
            </p>
          )}
          {analyzeError && (
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
              style={{
                background: 'rgba(255,59,48,0.10)',
                color: 'var(--color-danger)',
              }}
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{analyzeError}</span>
            </div>
          )}
        </div>
      </div>

      {/* ============== Right column: empty state ============== */}
      <div
        className="p-5 flex flex-col items-center justify-center text-center min-h-[400px]"
        style={{
          background: 'var(--color-card)',
          border: '0.5px solid var(--color-border-soft)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {isAnalyzing ? (
          <>
            <Loader2 size={32} className="animate-spin mb-3" style={{ color: 'var(--color-accent)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              AI đang phân tích sản phẩm...
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
              Mất 5–15 giây. Đang tạo blueprint {form.quantity} ảnh dựa trên ảnh + brief.
            </p>
          </>
        ) : (
          <>
            <Sparkles size={32} className="mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Bấm "Analyze & Blueprint" để bắt đầu
            </p>
            <p className="text-xs mt-2 max-w-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              AI sẽ phân tích sản phẩm và đề xuất blueprint {form.quantity} ảnh customize cho bộ detail page.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ============== Small UI helpers ==============
const inputStyle: CSSProperties = {
  background: 'var(--color-bg)',
  border: '0.5px solid var(--color-border-soft)',
  color: 'var(--color-text)',
  outline: 'none',
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        className="block uppercase font-semibold mb-1.5"
        style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
      >
        {label}
        {required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full px-3 py-2 rounded-lg text-sm"
      style={inputStyle}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
