import React, { useEffect, useRef, useState } from 'react';

export interface SettingsDropdownOption<T extends string | number = string> {
  value: T;
  label: string;
  badge?: { text: string; tone?: 'accent' | 'neutral' };
  disabled?: boolean;
}

export interface SettingsDropdownProps<T extends string | number = string> {
  value: T;
  options: SettingsDropdownOption<T>[];
  onChange: (v: T) => void;
  /** Width hint. `auto` = fit to current value text, `fill` = take remaining row width. */
  width?: 'auto' | 'fill';
  className?: string;
}

/**
 * Compact pill dropdown used in Ecom settings row (Model / Tỉ lệ / Chất lượng / Số ảnh).
 * Shows only the current value + chevron; opens a menu with checkmark + optional badge.
 * Closes on outside click or Escape.
 */
export function SettingsDropdown<T extends string | number = string>({
  value,
  options,
  onChange,
  width = 'auto',
  className,
}: SettingsDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ position: 'relative', flex: width === 'fill' ? '1 1 0' : '0 0 auto', minWidth: 0 }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
          padding: '7px 8px',
          borderRadius: 9,
          border: '1px solid var(--color-border-soft)',
          background: 'var(--color-card)',
          cursor: 'pointer',
          color: 'var(--color-text)',
          font: '600 11px/1 inherit',
          letterSpacing: '-0.01em',
          boxShadow: 'var(--sh-up-sm)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{current?.label ?? '—'}</span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-tertiary)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            left: 0,
            zIndex: 30,
            minWidth: '100%',
            width: 'max-content',
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
            padding: 5,
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '9px 10px',
                  border: 'none',
                  borderRadius: 8,
                  background: active ? 'var(--color-accent-soft)' : 'transparent',
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  color: 'var(--color-text)',
                  opacity: opt.disabled ? 0.4 : 1,
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!active && !opt.disabled) (e.currentTarget as HTMLElement).style.background = 'var(--color-fill)';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, font: '600 12px/1 inherit', whiteSpace: 'nowrap' }}>
                  {opt.label}
                  {opt.badge && (
                    <span
                      style={{
                        font: '700 7px/1 inherit',
                        letterSpacing: '0.05em',
                        padding: '2px 5px',
                        borderRadius: 4,
                        background: opt.badge.tone === 'accent' ? 'var(--color-accent)' : 'var(--color-fill)',
                        color: opt.badge.tone === 'accent' ? '#fff' : 'var(--color-text-tertiary)',
                      }}
                    >
                      {opt.badge.text}
                    </span>
                  )}
                </span>
                {active && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
