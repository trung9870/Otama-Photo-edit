import React, { useId } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

export type SegmentedSize = 'sm' | 'md' | 'lg';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export interface SegmentedProps<T extends string = string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange?: (value: T) => void;
  size?: SegmentedSize;
  fullWidth?: boolean;
  className?: string;
}

const SIZE: Record<SegmentedSize, { h: number; fs: number; r: number; p: number; iconSize: number }> = {
  sm: { h: 28, fs: 12, r: 7, p: 2, iconSize: 13 },
  md: { h: 32, fs: 13, r: 8, p: 2, iconSize: 14 },
  lg: { h: 40, fs: 14, r: 10, p: 3, iconSize: 15 },
};

export function Segmented<T extends string = string>({
  value,
  options,
  onChange,
  size = 'md',
  fullWidth,
  className = '',
}: SegmentedProps<T>) {
  const s = SIZE[size];
  const groupId = useId();

  return (
    <div
      className={`inline-flex ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{
        padding: s.p,
        background: 'var(--color-fill)',
        borderRadius: s.r + 2,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange?.(opt.value)}
            className="relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
            style={{
              flex: fullWidth ? 1 : undefined,
              height: s.h,
              padding: '0 14px',
              fontSize: s.fs,
              fontWeight: active ? 600 : 500,
              color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
              border: 'none',
              borderRadius: s.r,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
              background: 'transparent',
            }}
          >
            {active && (
              <motion.span
                layoutId={`segmented-thumb-${groupId}`}
                className="absolute inset-0"
                style={{
                  borderRadius: s.r,
                  background: 'var(--color-card)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08), 0 3px 8px rgba(0,0,0,0.06)',
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {Icon && <Icon size={s.iconSize} strokeWidth={1.8} />}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
