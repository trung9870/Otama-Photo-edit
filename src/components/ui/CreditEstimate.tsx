import React from 'react';
import { WalletCards } from 'lucide-react';
import { estimateCreditUsd } from '../../utils/creditEstimate';

export interface CreditEstimateProps {
  credits: number;
  className?: string;
  compact?: boolean;
  label?: string;
}

export function CreditEstimate({
  credits,
  className = '',
  compact = false,
  label = 'Dự kiến',
}: CreditEstimateProps) {
  const safeCredits = Number.isFinite(credits) ? Math.max(0, Math.round(credits)) : 0;
  const usd = estimateCreditUsd(safeCredits);
  const title = `${label}: ${safeCredits.toLocaleString('vi-VN')} credits (~$${usd.toFixed(3)})`;

  return (
    <span
      className={`credit-estimate inline-flex items-center ${className}`}
      title={title}
      aria-label={title}
      style={{
        minHeight: compact ? 28 : 34,
        gap: compact ? 5 : 7,
        padding: compact ? '5px 8px' : '7px 10px',
        borderRadius: compact ? 9 : 11,
        background: 'var(--color-accent-soft)',
        color: 'var(--color-accent)',
        border: '1px solid color-mix(in srgb, var(--color-accent) 24%, transparent)',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <WalletCards size={compact ? 13 : 14} strokeWidth={1.9} aria-hidden="true" />
      {(!compact || label !== 'Dự kiến') && (
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)' }}>{label}</span>
      )}
      <strong style={{ fontSize: compact ? 11 : 12, lineHeight: 1 }}>{safeCredits.toLocaleString('vi-VN')} cr</strong>
      {!compact && (
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)' }}>~${usd.toFixed(3)}</span>
      )}
    </span>
  );
}
