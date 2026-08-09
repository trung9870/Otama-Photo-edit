import React from 'react';

export interface ModelLogoProps {
  model: string;
  size?: number;
}

/** Small, dependency-free marks for model selectors. */
export function ModelLogo({ model, size = 18 }: ModelLogoProps) {
  const normalized = model.toLowerCase();

  if (normalized.includes('banana')) {
    return (
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          flex: `0 0 ${size}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.round(size * 0.9),
          lineHeight: 1,
        }}
      >
        🍌
      </span>
    );
  }

  if (normalized.includes('seedream')) {
    return (
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          flex: `0 0 ${size}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          color: '#fff',
          background: 'linear-gradient(145deg, #8b5cf6, #ec4899)',
          font: `800 ${Math.round(size * 0.58)}px/1 inherit`,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.24)',
        }}
      >
        S
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#111827',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
        <g stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3.2a4.4 4.4 0 0 1 4.15 2.95 4.4 4.4 0 0 1 3.5 6.85 4.4 4.4 0 0 1-4.2 6.45A4.4 4.4 0 0 1 8 18.85 4.4 4.4 0 0 1 4.35 12a4.4 4.4 0 0 1 4.2-6.45A4.38 4.38 0 0 1 12 3.2Z" />
          <path fill="none" d="m8.15 7.7 7.7 4.45M8.15 16.3V7.7L15.6 12v8.45M15.85 7.7l-7.7 4.45M15.85 7.7v8.6L8.4 12V3.55" />
        </g>
      </svg>
    </span>
  );
}
