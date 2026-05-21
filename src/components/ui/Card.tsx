import React from 'react';

export type CardRadius = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: number;
  radius?: CardRadius;
  raised?: boolean;
}

const RADIUS_PX: Record<CardRadius, number> = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 22,
};

export function Card({
  children,
  padding = 20,
  radius = 'xl',
  raised = false,
  className = '',
  style,
  ...rest
}: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--color-card)',
        borderRadius: RADIUS_PX[radius],
        padding,
        boxShadow: raised ? 'var(--shadow-card)' : 'none',
        border: raised ? 'none' : '0.5px solid var(--color-border-soft)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
