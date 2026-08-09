import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type ButtonVariant = 'filled' | 'tinted' | 'plain' | 'secondary' | 'outline' | 'glass';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonTone = 'accent' | 'danger' | 'success' | 'warning';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ButtonTone;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const SIZE: Record<ButtonSize, { h: string; px: string; fs: string; gap: string; r: string; iconSize: number }> = {
  sm: { h: 'h-9',  px: 'px-3',  fs: 'text-xs', gap: 'gap-1.5', r: 'rounded-[9px]',  iconSize: 14 },
  md: { h: 'h-11', px: 'px-4',  fs: 'text-[13px]', gap: 'gap-2',   r: 'rounded-[12px]', iconSize: 16 },
  lg: { h: 'h-12', px: 'px-5', fs: 'text-sm', gap: 'gap-2.5', r: 'rounded-[14px]', iconSize: 18 },
};

const TONE_COLOR: Record<ButtonTone, string> = {
  accent: 'var(--color-accent)',
  danger: 'var(--color-danger)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
};

function variantStyle(variant: ButtonVariant, tone: ButtonTone): React.CSSProperties {
  const color = TONE_COLOR[tone];
  switch (variant) {
    case 'filled':
      return { background: color, color: '#fff', boxShadow: '0 5px 14px color-mix(in srgb, var(--color-accent) 22%, transparent)' };
    case 'tinted':
      return { background: 'var(--color-accent-soft)', color };
    case 'plain':
      return { background: 'transparent', color };
    case 'secondary':
      return { background: 'var(--color-fill)', color: 'var(--color-text)', boxShadow: 'inset 0 0 0 1px var(--color-border-soft)' };
    case 'outline':
      return { background: 'var(--color-card)', color: 'var(--color-text)', boxShadow: 'inset 0 0 0 1px var(--color-border)' };
    case 'glass':
      return { background: 'rgba(255,255,255,0.08)', color: 'var(--color-text)', boxShadow: 'inset 0 0 0 0.5px var(--color-border)', backdropFilter: 'blur(12px)' };
  }
}

export function Button({
  variant = 'filled',
  size = 'md',
  tone = 'accent',
  icon: Icon,
  iconRight: IconRight,
  fullWidth,
  children,
  type = 'button',
  className = '',
  style,
  ...rest
}: ButtonProps) {
  const s = SIZE[size];
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-semibold whitespace-nowrap cursor-pointer transition-[filter,transform,box-shadow,background-color] duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-105 active:translate-y-px ${s.h} ${s.px} ${s.fs} ${s.gap} ${s.r} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{ letterSpacing: '-0.015em', ...variantStyle(variant, tone), ...style }}
      {...rest}
    >
      {Icon && <Icon size={s.iconSize} strokeWidth={1.8} />}
      {children}
      {IconRight && <IconRight size={s.iconSize} strokeWidth={1.8} />}
    </button>
  );
}
