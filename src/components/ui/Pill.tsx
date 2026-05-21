import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type PillTone = 'accent' | 'success' | 'warning' | 'danger' | 'secondary' | 'plain';

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  icon?: LucideIcon;
}

function toneStyle(tone: PillTone): React.CSSProperties {
  switch (tone) {
    case 'accent':
      return { background: 'var(--color-accent-soft)', color: 'var(--color-accent)' };
    case 'success':
      return { background: 'color-mix(in srgb, var(--color-success) 16%, transparent)', color: 'var(--color-success)' };
    case 'warning':
      return { background: 'color-mix(in srgb, var(--color-warning) 16%, transparent)', color: 'var(--color-warning)' };
    case 'danger':
      return { background: 'color-mix(in srgb, var(--color-danger) 16%, transparent)', color: 'var(--color-danger)' };
    case 'secondary':
      return { background: 'var(--color-fill)', color: 'var(--color-text)' };
    case 'plain':
      return { background: 'transparent', color: 'var(--color-text-secondary)' };
  }
}

export function Pill({ tone = 'secondary', icon: Icon, children, className = '', style, ...rest }: PillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${className}`}
      style={{
        padding: '3px 9px',
        fontSize: 11,
        letterSpacing: '-0.01em',
        ...toneStyle(tone),
        ...style,
      }}
      {...rest}
    >
      {Icon && <Icon size={11} strokeWidth={2} />}
      {children}
    </span>
  );
}
