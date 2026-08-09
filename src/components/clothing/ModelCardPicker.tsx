import React from 'react';

export interface ModelOption<T extends string = string> {
  value: T;
  name: string;
  sub?: string;
  best?: boolean;
  disabled?: boolean;
}

export interface ModelCardPickerProps<T extends string = string> {
  value: T;
  options: ModelOption<T>[];
  onChange: (v: T) => void;
  columns?: number;
  size?: 'sm' | 'md';
}

export function ModelCardPicker<T extends string = string>({
  value,
  options,
  onChange,
  columns = 3,
  size = 'md',
}: ModelCardPickerProps<T>) {
  const isSm = size === 'sm';
  const padding = isSm ? 5 : 10;
  const nameFontSize = isSm ? 11 : 12;
  const subFontSize = isSm ? 9 : 10;
  const borderRadius = isSm ? 8 : 12;
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className="relative flex flex-col items-center gap-0.5 transition-all overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              padding,
              borderRadius,
              background: active ? 'var(--color-accent-soft)' : 'var(--color-fill)',
              border: active ? '1px solid var(--color-accent)' : '1px solid transparent',
            }}
          >
            <div
              className="font-bold"
              style={{
                fontSize: nameFontSize,
                color: active ? 'var(--color-accent)' : 'var(--color-text)',
                letterSpacing: '-0.01em',
              }}
            >
              {opt.name}
            </div>
            {opt.sub && (
              <div
                className="font-medium uppercase"
                style={{
                  fontSize: subFontSize,
                  color: 'var(--color-text-tertiary)',
                  letterSpacing: '0.06em',
                }}
              >
                {opt.sub}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
