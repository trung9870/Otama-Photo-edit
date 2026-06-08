import React from 'react';

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface ARSelectorProps {
  value: AspectRatio | string;
  onChange: (v: AspectRatio) => void;
  options?: AspectRatio[];
  size?: 'xs' | 'sm' | 'md';
}

const DEFAULT: AspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9'];

// Icon dimensions (w, h) per ratio — clipped to 18px max
const ICON_DIMS: Record<AspectRatio, [number, number]> = {
  '1:1': [14, 14],
  '3:4': [12, 16],
  '4:3': [16, 12],
  '9:16': [10, 18],
  '16:9': [18, 10],
};

function ARIcon({ value, active }: { value: AspectRatio; active: boolean }) {
  const [w, h] = ICON_DIMS[value];
  return (
    <div
      style={{
        width: w,
        height: h,
        border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-text-tertiary)'}`,
        borderRadius: 2,
      }}
    />
  );
}

export function ARSelector({ value, onChange, options = DEFAULT, size = 'md' }: ARSelectorProps) {
  const h = size === 'xs' ? 34 : size === 'sm' ? 48 : 56;
  const fontSize = size === 'xs' ? 10 : 11;
  return (
    <div className={`grid grid-cols-5 gap-1`}>
      {options.map((v) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex flex-col items-center justify-center ${size === 'xs' ? 'gap-0.5' : 'gap-1'} transition-all`}
            style={{
              height: h,
              borderRadius: size === 'xs' ? 8 : 10,
              background: active ? 'var(--color-accent-soft)' : 'var(--color-fill)',
              color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              border: active ? '1px solid var(--color-accent)' : '1px solid transparent',
              fontSize,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            <ARIcon value={v} active={active} />
            {v}
          </button>
        );
      })}
    </div>
  );
}
