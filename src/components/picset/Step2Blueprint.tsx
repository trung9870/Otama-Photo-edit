import { useState, type Key, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Trash2, ArrowLeft, RefreshCcw, Wand2, Loader2 } from 'lucide-react';
import { Button } from '../ui';
import type { Blueprint, BlueprintImage } from './PicsetTab';
import {
  PICSET_CATEGORIES_UI,
  DENSITY_TONE,
  isPicsetCategoryId,
} from './picsetCategoriesUI';

interface Step2Props {
  blueprint: Blueprint;
  productImageDataUrl: string;
  isGenerating: boolean;
  isReanalyzing: boolean;
  onChange: (next: Blueprint) => void;
  onBack: () => void;
  onReanalyze: () => void;
  onGenerate: () => void;
}

export default function Step2Blueprint({
  blueprint,
  productImageDataUrl,
  isGenerating,
  isReanalyzing,
  onChange,
  onBack,
  onReanalyze,
  onGenerate,
}: Step2Props) {
  const [showSpecs, setShowSpecs] = useState(false);

  const updateImage = (idx: number, patch: Partial<BlueprintImage>) => {
    const next = { ...blueprint, images: blueprint.images.map((img, i) => (i === idx ? { ...img, ...patch } : img)) };
    onChange(next);
  };
  const updateText = (idx: number, key: 'main_title' | 'subtitle' | 'description', value: string) => {
    const img = blueprint.images[idx];
    updateImage(idx, { text_content_vi: { ...img.text_content_vi, [key]: value } });
  };
  const removeImage = (idx: number) => {
    if (blueprint.images.length <= 1) return;
    const remaining = blueprint.images.filter((_, i) => i !== idx).map((img, i) => ({ ...img, slot: i + 1 }));
    onChange({ ...blueprint, images: remaining });
  };

  const ds = blueprint.design_specs || {};
  const cs = ds.color_system || {};
  const vs = ds.visual_style || {};
  const ty = ds.typography || {};

  return (
    <div className="flex flex-col gap-4">
      {/* Header summary */}
      <div
        className="flex items-center gap-3 p-3 rounded-2xl"
        style={{
          background: 'var(--color-card)',
          border: '0.5px solid var(--color-border-soft)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {productImageDataUrl && (
          <img
            src={productImageDataUrl}
            alt="Sản phẩm"
            className="rounded-lg object-cover"
            style={{ width: 56, height: 56, border: '0.5px solid var(--color-border-soft)' }}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
            {blueprint.product_analysis?.product_type || 'Sản phẩm'}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
            {blueprint.images.length} ảnh trong plan
            {Array.isArray(blueprint.product_analysis?.set_components) &&
              ` • ${blueprint.product_analysis.set_components.slice(0, 3).join(', ')}`}
          </p>
        </div>
      </div>

      {/* Design Specs (collapsible, readonly) */}
      <div
        className="rounded-2xl"
        style={{
          background: 'var(--color-card)',
          border: '0.5px solid var(--color-border-soft)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <button
          type="button"
          onClick={() => setShowSpecs((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Wand2 size={14} style={{ color: 'var(--color-accent)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Design Specifications
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              (specs chung — readonly)
            </span>
          </div>
          {showSpecs ? (
            <ChevronUp size={16} style={{ color: 'var(--color-text-tertiary)' }} />
          ) : (
            <ChevronDown size={16} style={{ color: 'var(--color-text-tertiary)' }} />
          )}
        </button>
        {showSpecs && (
          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <SpecBlock title="Visual Style">
              <SpecRow k="Keywords" v={(vs.keywords || []).join(', ')} />
              <div
                className="mt-2 pt-2 pl-2"
                style={{ borderLeft: '2px solid var(--color-border-soft)' }}
              >
                <p
                  className="uppercase font-semibold mb-1"
                  style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
                >
                  Atmosphere Creation
                </p>
                <SpecRow k="Mood Keywords" v={(vs.mood_keywords || []).join(', ')} />
                <SpecRow k="Lighting" v={vs.lighting} />
              </div>
            </SpecBlock>
            <SpecBlock title="Color System">
              <ColorRow label="Primary" hex={cs.primary_hex} />
              <ColorRow label="Secondary" hex={cs.secondary_hex} />
              <ColorRow label="Accent" hex={cs.accent_hex} />
              <SpecRow k="Background" v={cs.background_tone} />
            </SpecBlock>
            <SpecBlock title="Typography System">
              <SpecRow k="Title font" v={ty.title_font_style} />
              <SpecRow k="Body font" v={ty.body_font_style} />
              <ColorRow label="Main title color" hex={ty.main_title_color_hex} />
              <ColorRow label="Subtitle color" hex={ty.subtitle_color_hex} />
              <ColorRow label="Description color" hex={ty.description_color_hex} />
            </SpecBlock>
            <SpecBlock title="Visual Language">
              <SpecRow k="Decorative props" v={(ds.decorative_props || []).join(', ')} />
              <SpecRow k="Icon style" v={ds.icon_style} />
            </SpecBlock>
            <SpecBlock title="Quality Requirements">
              <SpecRow k="Resolution" v={ds.quality?.resolution} />
              <SpecRow k="Realism" v={ds.quality?.realism} />
            </SpecBlock>
            {(Array.isArray(ds.hard_rules) && ds.hard_rules.length > 0) ||
            (Array.isArray(ds.user_special_requirements) && ds.user_special_requirements.length > 0) ? (
              <div className="md:col-span-2">
                <SpecBlock title="User Special Requirements (Hard Constraints)">
                  <ul className="list-disc pl-5 space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {Array.isArray(ds.hard_rules) &&
                      ds.hard_rules.map((r: string, i: number) => <li key={`h${i}`}>{r}</li>)}
                    {Array.isArray(ds.user_special_requirements) &&
                      ds.user_special_requirements.map((r: string, i: number) => <li key={`u${i}`}>{r}</li>)}
                  </ul>
                </SpecBlock>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Image plan cards */}
      <div className="flex flex-col gap-3">
        {blueprint.images.map((img, idx) => (
          <ImageCard
            key={`${img.slot}-${idx}`}
            index={idx}
            image={img}
            canDelete={blueprint.images.length > 1}
            onUpdateTitle={(v) => updateImage(idx, { title_vi: v })}
            onUpdateText={(k, v) => updateText(idx, k, v)}
            onDelete={() => removeImage(idx)}
          />
        ))}
      </div>

      {/* Bottom actions */}
      <div
        className="sticky bottom-2 flex flex-wrap items-center gap-2 p-3 rounded-2xl"
        style={{
          background: 'var(--color-card)',
          border: '0.5px solid var(--color-border-soft)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <Button variant="secondary" size="md" icon={ArrowLeft} onClick={onBack} disabled={isGenerating}>
          Quay lại Input
        </Button>
        <Button
          variant="tinted"
          size="md"
          icon={isReanalyzing ? undefined : RefreshCcw}
          onClick={onReanalyze}
          disabled={isReanalyzing || isGenerating}
        >
          {isReanalyzing ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Đang phân tích lại...
            </span>
          ) : (
            'Phân tích lại'
          )}
        </Button>
        <div className="flex-1" />
        <Button
          variant="filled"
          size="lg"
          onClick={onGenerate}
          disabled={isGenerating || blueprint.images.length === 0}
        >
          {isGenerating ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Đang gen...
            </span>
          ) : (
            `Generate All (${blueprint.images.length} ảnh) →`
          )}
        </Button>
      </div>
    </div>
  );
}

// ============== Sub components ==============
interface ImageCardProps {
  key?: Key;
  index: number;
  image: BlueprintImage;
  canDelete: boolean;
  onUpdateTitle: (v: string) => void;
  onUpdateText: (k: 'main_title' | 'subtitle' | 'description', v: string) => void;
  onDelete: () => void;
}

// Broad image_category (6 enum) → small secondary pill color
const IMAGE_CATEGORY_TONE: Record<string, { bg: string; fg: string }> = {
  'Feature Image':                  { bg: 'rgba(0,122,255,0.10)',  fg: 'var(--color-accent)' },
  'Pain Point Image':               { bg: 'rgba(255,59,48,0.10)',  fg: 'var(--color-danger)' },
  'Detail / Material Image':        { bg: 'rgba(175,82,222,0.10)', fg: '#af52de' },
  'Selling Point Image':            { bg: 'rgba(52,199,89,0.10)',  fg: 'var(--color-success)' },
  'Scene Image':                    { bg: 'rgba(255,149,0,0.10)',  fg: 'var(--color-warning)' },
  'Specification / Parameter Image':{ bg: 'rgba(142,142,147,0.10)', fg: 'var(--color-text-secondary)' },
};

function ImageCard({ index, image, canDelete, onUpdateTitle, onUpdateText, onDelete }: ImageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const ce = image.content_elements || ({} as BlueprintImage['content_elements']);
  const tc = image.text_content_vi || ({} as BlueprintImage['text_content_vi']);

  // PATCH §6: Chinese category badge (primary) + image_category (secondary)
  const catId = isPicsetCategoryId(image.category) ? image.category : null;
  const catMeta = catId ? PICSET_CATEGORIES_UI[catId] : null;
  const catTone = catMeta ? DENSITY_TONE[catMeta.density] : { bg: 'var(--color-fill)', fg: 'var(--color-text-tertiary)' };

  const broadCat = (image.image_category || '') as string;
  const broadTone = IMAGE_CATEGORY_TONE[broadCat];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--color-card)',
        border: '0.5px solid var(--color-border-soft)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header: slot + title editable + Chinese category badge + broad pill + delete */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div
          className="flex items-center justify-center font-bold text-sm shrink-0"
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent)',
          }}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={image.title_vi}
              onChange={(e) => onUpdateTitle(e.target.value)}
              placeholder={image.title_en || 'Tiêu đề ảnh'}
              className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg text-sm font-semibold"
              style={{
                background: 'transparent',
                color: 'var(--color-text)',
                border: '0.5px solid transparent',
              }}
              onFocus={(e) => (e.currentTarget.style.border = '0.5px solid var(--color-border)')}
              onBlur={(e) => (e.currentTarget.style.border = '0.5px solid transparent')}
            />
            {catMeta && (
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ background: catTone.bg, color: catTone.fg, letterSpacing: '0.02em' }}
                title={`Chinese design block: ${catId} • density: ${catMeta.density}`}
              >
                {catMeta.cn_name} · {catMeta.vi_name}
              </span>
            )}
            {broadCat && broadTone && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{ background: broadTone.bg, color: broadTone.fg, letterSpacing: '0.02em' }}
              >
                {broadCat}
              </span>
            )}
          </div>
          {image.title_en && image.title_en !== image.title_vi && (
            <p className="px-2 mt-0.5 text-xs italic" style={{ color: 'var(--color-text-tertiary)' }}>
              {image.title_en}
            </p>
          )}
          {image.outer_description && (
            <p className="px-2 mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {image.outer_description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs px-2 py-1 rounded-lg shrink-0"
          style={{ color: 'var(--color-text-secondary)', background: 'var(--color-fill)' }}
        >
          {expanded ? 'Thu gọn' : 'Chi tiết ▾'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          className="p-1.5 rounded-lg shrink-0"
          style={{
            color: 'var(--color-danger)',
            background: 'transparent',
            opacity: canDelete ? 1 : 0.3,
            cursor: canDelete ? 'pointer' : 'not-allowed',
          }}
          aria-label="Xóa ảnh"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Text content — editable (luôn hiển thị) */}
      <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-3 gap-2">
        <TextField
          label="Main title"
          value={tc.main_title || ''}
          onChange={(v) => onUpdateText('main_title', v)}
        />
        <TextField
          label="Subtitle"
          value={tc.subtitle || ''}
          onChange={(v) => onUpdateText('subtitle', v)}
        />
        <TextField
          label="Description"
          value={tc.description || ''}
          onChange={(v) => onUpdateText('description', v)}
        />
      </div>

      {/* Expanded readonly details */}
      {expanded && (
        <div
          className="px-4 py-3 text-xs space-y-2"
          style={{ background: 'var(--color-fill)', color: 'var(--color-text-secondary)' }}
        >
          {image.design_objective && <SpecRow k="Design Objective" v={image.design_objective} />}
          <div className="flex flex-wrap gap-2 mb-1">
            <FlagPill
              label={image.product_appearance === false ? 'Không có sản phẩm' : 'Có sản phẩm trực tiếp'}
              active={image.product_appearance !== false}
            />
            <FlagPill
              label={image.complex_structure_assessment ? 'Composite phức tạp' : 'Composite đơn giản'}
              active={!!image.complex_structure_assessment}
              tone={image.complex_structure_assessment ? 'warn' : 'neutral'}
            />
          </div>
          <SpecRow k="Display Focus" v={ce.display_focus} />
          {ce.pain_point_scenario && ce.pain_point_scenario !== 'N/A' && (
            <SpecRow k="Pain Point Scenario" v={ce.pain_point_scenario} />
          )}
          <SpecRow k="Background Elements" v={ce.background_elements} />
          {image.image_within_image && (
            <SpecRow k="Image-within-Image" v={image.image_within_image} />
          )}
          {image.size_chart && (
            <SpecRow k="Size Chart" v={typeof image.size_chart === 'string' ? image.size_chart : JSON.stringify(image.size_chart)} />
          )}
          {image.special_requirements && (
            <SpecRow k="Special Requirements" v={image.special_requirements} />
          )}
        </div>
      )}
    </div>
  );
}

function FlagPill({
  label,
  active,
  tone = 'neutral',
}: {
  label: string;
  active: boolean;
  tone?: 'neutral' | 'warn';
}) {
  const bg = !active
    ? 'var(--color-fill)'
    : tone === 'warn'
    ? 'rgba(255,149,0,0.15)'
    : 'rgba(52,199,89,0.15)';
  const fg = !active
    ? 'var(--color-text-tertiary)'
    : tone === 'warn'
    ? 'var(--color-warning)'
    : 'var(--color-success)';
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label
        className="block uppercase font-semibold mb-1"
        style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded-lg text-xs"
        style={{
          background: 'var(--color-bg)',
          border: '0.5px solid var(--color-border-soft)',
          color: 'var(--color-text)',
        }}
      />
    </div>
  );
}

function SpecBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="p-3 rounded-xl"
      style={{ background: 'var(--color-fill)' }}
    >
      <p
        className="uppercase font-semibold mb-2"
        style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}
      >
        {title}
      </p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function SpecRow({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <div className="flex gap-2">
      <span className="font-semibold shrink-0" style={{ color: 'var(--color-text-tertiary)', minWidth: 110 }}>
        {k}:
      </span>
      <span style={{ color: 'var(--color-text-secondary)' }}>{v}</span>
    </div>
  );
}

function ColorRow({ label, hex }: { label: string; hex?: string }) {
  if (!hex) return null;
  return (
    <div className="flex items-center gap-2">
      <span
        className="font-semibold shrink-0"
        style={{ color: 'var(--color-text-tertiary)', minWidth: 110 }}
      >
        {label}:
      </span>
      <span
        className="inline-block rounded"
        style={{
          width: 16,
          height: 16,
          background: hex,
          border: '0.5px solid var(--color-border-soft)',
        }}
      />
      <span style={{ color: 'var(--color-text-secondary)' }}>{hex}</span>
    </div>
  );
}
