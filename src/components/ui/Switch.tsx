import React from 'react';

export type SwitchSize = 'sm' | 'md';

export interface SwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  /** 'sm' (40×23, knob 19) for tables. 'md' (51×31, knob 27) — iOS default. */
  size?: SwitchSize;
}

const DIM: Record<SwitchSize, { w: number; h: number; knob: number; onLeft: number; offLeft: number }> = {
  sm: { w: 40, h: 23, knob: 19, onLeft: 19, offLeft: 2 },
  md: { w: 51, h: 31, knob: 27, onLeft: 22, offLeft: 2 },
};

export function Switch({ checked, onChange, disabled, ariaLabel, size = 'md' }: SwitchProps) {
  const d = DIM[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className="relative shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        width: d.w,
        height: d.h,
        background: checked
          ? 'var(--color-accent)'
          : 'var(--color-fill-strong)',
        boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.04)',
      }}
    >
      <span
        className="absolute top-[2px] block rounded-full bg-white transition-[left] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          left: checked ? d.onLeft : d.offLeft,
          width: d.knob,
          height: d.knob,
          boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.06)',
        }}
      />
    </button>
  );
}
