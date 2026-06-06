import { useState } from 'react';
import { Key, ChevronDown, ChevronUp, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

export interface PicsetKeys {
  kie: string;
  gemini: string;
}

export const PICSET_LS_KEY = 'picset-api-keys';

export function loadPicsetKeys(): PicsetKeys {
  try {
    const raw = localStorage.getItem(PICSET_LS_KEY);
    if (!raw) return { kie: '', gemini: '' };
    const parsed = JSON.parse(raw);
    return {
      kie: typeof parsed.kie === 'string' ? parsed.kie : '',
      gemini: typeof parsed.gemini === 'string' ? parsed.gemini : '',
    };
  } catch {
    return { kie: '', gemini: '' };
  }
}

export function savePicsetKeys(keys: PicsetKeys) {
  localStorage.setItem(PICSET_LS_KEY, JSON.stringify(keys));
}

interface Props {
  keys: PicsetKeys;
  onChange: (keys: PicsetKeys) => void;
  defaultOpen?: boolean;
}

export function PicsetSettings({ keys, onChange, defaultOpen }: Props) {
  const both = !!keys.kie && !!keys.gemini;
  const hasKie = !!keys.kie;
  const hasGemini = !!keys.gemini;
  const count = (hasKie ? 1 : 0) + (hasGemini ? 1 : 0);

  const [open, setOpen] = useState<boolean>(defaultOpen ?? !both);
  const [showKie, setShowKie] = useState(false);
  const [showGemini, setShowGemini] = useState(false);

  const update = (k: Partial<PicsetKeys>) => {
    const next = { ...keys, ...k };
    onChange(next);
    savePicsetKeys(next);
  };

  return (
    <div
      className="mb-4"
      style={{
        background: 'var(--color-card)',
        border: '0.5px solid var(--color-border-soft)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: both ? 'rgba(52,199,89,0.15)' : 'rgba(255,149,0,0.15)',
              color: both ? 'var(--color-success)' : 'var(--color-warning)',
            }}
          >
            {both ? <Check size={14} strokeWidth={2.5} /> : <AlertCircle size={14} strokeWidth={2.5} />}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>API Keys (BYOK)</p>
            <p className="text-xs" style={{ color: both ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {count}/2 key đã cài{both ? '' : count === 0 ? ' — cần Kie + Gemini' : count === 1 ? ` — thiếu ${hasKie ? 'Gemini' : 'Kie'}` : ''}
            </p>
          </div>
        </div>
        {open ? <ChevronUp size={16} style={{ color: 'var(--color-text-tertiary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--color-text-tertiary)' }} />}
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div>
            <label className="block uppercase font-semibold mb-1.5" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
              Kie.ai API Key <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <div className="relative">
              <Key size={14} className="absolute top-1/2 left-3 -translate-y-1/2" style={{ color: 'var(--color-text-tertiary)' }} />
              <input
                type={showKie ? 'text' : 'password'}
                value={keys.kie}
                onChange={(e) => update({ kie: e.target.value })}
                placeholder="sk-..."
                className="w-full pl-9 pr-10 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--color-bg)',
                  border: '0.5px solid var(--color-border-soft)',
                  color: 'var(--color-text)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowKie((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 p-1"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {showKie ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Dùng cho phần generate (GPT2 / Banana Pro)
            </p>
          </div>

          <div>
            <label className="block uppercase font-semibold mb-1.5" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
              Gemini API Key <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <div className="relative">
              <Key size={14} className="absolute top-1/2 left-3 -translate-y-1/2" style={{ color: 'var(--color-text-tertiary)' }} />
              <input
                type={showGemini ? 'text' : 'password'}
                value={keys.gemini}
                onChange={(e) => update({ gemini: e.target.value })}
                placeholder="AIza..."
                className="w-full pl-9 pr-10 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--color-bg)',
                  border: '0.5px solid var(--color-border-soft)',
                  color: 'var(--color-text)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowGemini((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 p-1"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {showGemini ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Dùng cho phần analyze blueprint
            </p>
          </div>

          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Key lưu LocalStorage trình duyệt, không gửi lên server Otama. Storage key: <code>{PICSET_LS_KEY}</code>
          </p>
        </div>
      )}
    </div>
  );
}
