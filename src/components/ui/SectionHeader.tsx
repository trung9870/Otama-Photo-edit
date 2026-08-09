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
      className={`flex items-end justify-between gap-4 mb-4 ${className}`}
      style={style}
    >
      <div>
        {eyebrow && (
          <div
            className="font-semibold uppercase mb-1"
            style={{
              fontSize: 10,
              color: 'var(--color-text-tertiary)',
              letterSpacing: '0.09em',
            }}
          >
            {eyebrow}
          </div>
        )}
        {title && (
          <div
            className="font-semibold"
            style={{
              fontSize: 18,
              color: 'var(--color-text)',
              letterSpacing: '-0.035em',
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
