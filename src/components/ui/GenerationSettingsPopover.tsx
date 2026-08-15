import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Crop } from 'lucide-react';
import type { SettingsDropdownOption } from './SettingsDropdown';
import { CreditEstimate } from './CreditEstimate';

export interface GenerationSettingsPopoverProps {
  mediaType?: 'image' | 'video';
  aspectRatio: string;
  aspectRatios: SettingsDropdownOption<string>[];
  onAspectRatioChange: (value: string) => void;
  imageSize: string;
  imageSizes: SettingsDropdownOption<string>[];
  onImageSizeChange: (value: string) => void;
  imageCount: number;
  imageCounts: SettingsDropdownOption<number>[];
  onImageCountChange: (value: number) => void;
  duration?: number;
  durations?: SettingsDropdownOption<number>[];
  onDurationChange?: (value: number) => void;
  generateAudio?: boolean;
  onGenerateAudioChange?: (value: boolean) => void;
  supportsAudio?: boolean;
  estimatedCredits?: number;
  placement?: 'top' | 'bottom';
}

function ratioPreview(value: string) {
  if (value === 'auto') return { width: 17, height: 17 };
  const [rawWidth, rawHeight] = value.split(':').map(Number);
  if (!rawWidth || !rawHeight) return { width: 17, height: 17 };
  const maxSide = 18;
  const minSide = 7;
  if (rawWidth >= rawHeight) {
    return { width: maxSide, height: Math.max(minSide, Math.round(maxSide * rawHeight / rawWidth)) };
  }
  return { width: Math.max(minSide, Math.round(maxSide * rawWidth / rawHeight)), height: maxSide };
}

export function GenerationSettingsPopover({
  mediaType = 'image',
  aspectRatio,
  aspectRatios,
  onAspectRatioChange,
  imageSize,
  imageSizes,
  onImageSizeChange,
  imageCount,
  imageCounts,
  onImageCountChange,
  duration = 4,
  durations = [],
  onDurationChange,
  generateAudio = false,
  onGenerateAudioChange,
  supportsAudio = false,
  estimatedCredits,
  placement = 'top',
}: GenerationSettingsPopoverProps) {
  const isVideo = mediaType === 'video';
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="generation-settings-root" style={{ position: 'relative', flex: '0 0 auto', minWidth: 0 }}>
      <button
        type="button"
        className="generation-settings-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={isVideo ? 'Tỉ lệ, độ phân giải và thời lượng video' : 'Tỉ lệ, chất lượng và số lượng ảnh'}
        style={{
          minHeight: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 10px',
          borderRadius: 11,
          border: `1px solid ${open ? 'var(--color-accent)' : 'var(--color-border-soft)'}`,
          background: 'var(--color-card)',
          color: 'var(--color-text)',
          boxShadow: open ? 'var(--shadow-focus)' : 'var(--sh-up-sm)',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        <Crop size={14} strokeWidth={1.8} style={{ color: 'var(--color-accent)' }} />
        <span style={{ font: '600 12px/1 inherit' }}>{aspectRatio === 'auto' ? 'Tự động' : aspectRatio}</span>
        <span aria-hidden="true" style={{ width: 1, height: 13, background: 'var(--color-border)' }} />
        <span style={{ font: '600 12px/1 inherit' }}>{imageSize.toUpperCase()}</span>
        <span aria-hidden="true" style={{ width: 1, height: 13, background: 'var(--color-border)' }} />
        <span style={{ font: '600 12px/1 inherit' }}>{isVideo ? `${duration}s` : `${imageCount} ảnh`}</span>
        {typeof estimatedCredits === 'number' && estimatedCredits > 0 && (
          <>
            <span aria-hidden="true" style={{ width: 1, height: 13, background: 'var(--color-border)' }} />
            <span style={{ font: '700 11px/1 inherit', color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(estimatedCredits).toLocaleString('vi-VN')} cr
            </span>
          </>
        )}
        <ChevronDown
          size={12}
          strokeWidth={2}
          style={{
            color: 'var(--color-text-tertiary)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease',
          }}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={isVideo ? 'Cài đặt đầu ra video' : 'Cài đặt đầu ra ảnh'}
          className="generation-settings-menu"
          style={{
            position: 'absolute',
            ...(placement === 'top'
              ? { bottom: 'calc(100% + 8px)' }
              : { top: 'calc(100% + 8px)' }),
            right: 0,
            zIndex: 60,
            width: 'min(520px, calc(100vw - 24px))',
            maxHeight: 'min(70vh, 520px)',
            overflowY: 'auto',
            padding: 14,
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            background: 'var(--color-card)',
            color: 'var(--color-text)',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <section>
            <p style={{ margin: '0 0 8px', color: 'var(--color-text-tertiary)', font: '600 11px/1.2 inherit' }}>
              {isVideo ? 'Tỉ lệ video' : 'Tỉ lệ ảnh'}
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(10, minmax(38px, 1fr))',
                gap: 4,
                padding: 5,
                borderRadius: 12,
                background: 'var(--color-card-secondary)',
                overflowX: 'auto',
              }}
            >
              {aspectRatios.map((option) => {
                const active = option.value === aspectRatio;
                const preview = ratioPreview(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => onAspectRatioChange(option.value)}
                    aria-pressed={active}
                    title={option.disabled ? `${option.label} không được model hiện tại hỗ trợ` : option.label}
                    style={{
                      minWidth: 38,
                      minHeight: 52,
                      padding: '6px 3px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      border: 'none',
                      borderRadius: 9,
                      background: active ? 'var(--color-accent-soft)' : 'transparent',
                      color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      opacity: option.disabled ? 0.28 : 1,
                      cursor: option.disabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: preview.width,
                        height: preview.height,
                        border: `1.6px solid ${active ? 'var(--color-accent)' : 'currentColor'}`,
                        borderRadius: 3,
                      }}
                    />
                    <span style={{ font: '600 10px/1 inherit', whiteSpace: 'nowrap' }}>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 8px', color: 'var(--color-text-tertiary)', font: '600 11px/1.2 inherit' }}>
              {isVideo ? 'Độ phân giải' : 'Chất lượng'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${imageSizes.length}, minmax(0, 1fr))`, gap: 5, padding: 5, borderRadius: 12, background: 'var(--color-card-secondary)' }}>
              {imageSizes.map((option) => {
                const active = option.value === imageSize;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => onImageSizeChange(option.value)}
                    aria-pressed={active}
                    style={{
                      minHeight: 38,
                      padding: '8px 10px',
                      border: 'none',
                      borderRadius: 9,
                      background: active ? 'var(--color-fill-strong)' : 'transparent',
                      color: 'var(--color-text)',
                      opacity: option.disabled ? 0.28 : 1,
                      cursor: option.disabled ? 'not-allowed' : 'pointer',
                      font: '600 12px/1 inherit',
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 8px', color: 'var(--color-text-tertiary)', font: '600 11px/1.2 inherit' }}>
              {isVideo ? 'Thời lượng' : 'Số lượng ảnh'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isVideo ? durations.length : imageCounts.length}, minmax(0, 1fr))`, gap: 5, padding: 5, borderRadius: 12, background: 'var(--color-card-secondary)' }}>
              {(isVideo ? durations : imageCounts).map((option) => {
                const active = option.value === (isVideo ? duration : imageCount);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => isVideo ? onDurationChange?.(option.value) : onImageCountChange(option.value)}
                    aria-pressed={active}
                    style={{
                      minHeight: 38,
                      padding: '8px 10px',
                      border: 'none',
                      borderRadius: 9,
                      background: active ? 'var(--color-fill-strong)' : 'transparent',
                      color: 'var(--color-text)',
                      opacity: option.disabled ? 0.28 : 1,
                      cursor: option.disabled ? 'not-allowed' : 'pointer',
                      font: '600 12px/1 inherit',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {isVideo ? `${option.label}s` : option.label}
                      {active && <Check size={12} strokeWidth={2.2} style={{ color: 'var(--color-accent)' }} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {isVideo && supportsAudio && (
            <section style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={() => onGenerateAudioChange?.(!generateAudio)}
                className="w-full flex items-center justify-between"
                style={{ padding: '10px 12px', border: 'none', borderRadius: 12, background: 'var(--color-card-secondary)', color: 'var(--color-text)', cursor: 'pointer' }}
              >
                <span style={{ font: '600 12px/1.2 inherit' }}>Tạo âm thanh cùng video</span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 36,
                    height: 21,
                    padding: 2,
                    display: 'flex',
                    justifyContent: generateAudio ? 'flex-end' : 'flex-start',
                    borderRadius: 999,
                    background: generateAudio ? 'var(--color-accent)' : 'var(--color-fill-strong)',
                  }}
                >
                  <span style={{ width: 17, height: 17, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.22)' }} />
                </span>
              </button>
            </section>
          )}

          {typeof estimatedCredits === 'number' && estimatedCredits > 0 && (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <CreditEstimate credits={estimatedCredits} label="Lượt này" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
