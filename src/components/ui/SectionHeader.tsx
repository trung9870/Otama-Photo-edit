import React from 'react';

export interface SectionHeaderProps {
  eyebrow?: string;
  title?: string;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function SectionHeader({ eyebrow, title, action, className = '', style }: SectionHeaderProps) {
  return (
    <div
      className={`flex items-end justify-between mb-3 ${className}`}
      style={style}
    >
      <div>
        {eyebrow && (
          <div
            className="font-semibold uppercase mb-1"
            style={{
              fontSize: 11,
              color: 'var(--color-text-tertiary)',
              letterSpacing: '0.06em',
            }}
          >
            {eyebrow}
          </div>
        )}
        {title && (
          <div
            className="font-semibold"
            style={{
              fontSize: 17,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}
