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
}

export function ModelCardPicker<T extends string = string>({
  value,
  options,
  onChange,
  columns = 3,
}: ModelCardPickerProps<T>) {
  return (
    <div
      className="grid gap-2"
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
              padding: 10,
              borderRadius: 12,
              background: active ? 'var(--color-accent-soft)' : 'var(--color-fill)',
              border: active ? '1px solid var(--color-accent)' : '1px solid transparent',
            }}
          >
            {opt.best && (
              <div
                className="absolute top-0 right-0 text-white font-bold"
                style={{
                  padding: '2px 6px',
                  background: 'var(--color-warning)',
                  fontSize: 9,
                  borderBottomLeftRadius: 6,
                  letterSpacing: '0.04em',
                }}
              >
                BEST
              </div>
            )}
            <div
              className="font-bold"
              style={{
                fontSize: 12,
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
                  fontSize: 10,
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
