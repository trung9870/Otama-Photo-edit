import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Switch({ checked, onChange, disabled, ariaLabel }: SwitchProps) {
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
        width: 51,
        height: 31,
        background: checked
          ? 'var(--color-success)'
          : 'color-mix(in srgb, var(--color-text-tertiary) 35%, transparent)',
        boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.04)',
      }}
    >
      <span
        className="absolute top-[2px] block rounded-full bg-white transition-[left] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          left: checked ? 22 : 2,
          width: 27,
          height: 27,
          boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.06)',
        }}
      />
    </button>
  );
}
