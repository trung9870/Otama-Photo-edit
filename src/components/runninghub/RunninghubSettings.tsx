import { useState } from 'react';
import { Key, ChevronDown, ChevronUp, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const RH_LS_KEY = 'runninghub-api-key';

export function loadRunninghubKey(): string {
  return localStorage.getItem(RH_LS_KEY) || '';
}
export function saveRunninghubKey(v: string) {
  localStorage.setItem(RH_LS_KEY, v);
}

interface Props {
  apiKey: string;
  onChange: (v: string) => void;
  defaultOpen?: boolean;
}

export function RunninghubSettings({ apiKey, onChange, defaultOpen }: Props) {
  const has = !!apiKey;
  const [open, setOpen] = useState<boolean>(defaultOpen ?? !has);
  const [show, setShow] = useState(false);

  const update = (v: string) => {
    onChange(v);
    saveRunninghubKey(v);
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
              background: has ? 'rgba(52,199,89,0.15)' : 'rgba(255,149,0,0.15)',
              color: has ? 'var(--color-success)' : 'var(--color-warning)',
            }}
          >
            {has ? <Check size={14} strokeWidth={2.5} /> : <AlertCircle size={14} strokeWidth={2.5} />}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>RunningHub API Key (BYOK)</p>
            <p className="text-xs" style={{ color: has ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {has ? 'Đã cài đặt' : 'Cần API key để chạy workflow'}
            </p>
          </div>
        </div>
        {open ? <ChevronUp size={16} style={{ color: 'var(--color-text-tertiary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--color-text-tertiary)' }} />}
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          <div className="relative">
            <Key size={14} className="absolute top-1/2 left-3 -translate-y-1/2" style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              type={show ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => update(e.target.value)}
              placeholder="32-character RunningHub API key"
              className="w-full pl-9 pr-10 py-2 rounded-lg text-sm"
              style={{
                background: 'var(--color-bg)',
                border: '0.5px solid var(--color-border-soft)',
                color: 'var(--color-text)',
              }}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute top-1/2 right-2 -translate-y-1/2 p-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Lấy ở <a href="https://www.runninghub.ai/user-center/api-key" target="_blank" rel="noopener" style={{ color: 'var(--color-accent)' }}>runninghub.ai → User Center → API Key</a>. Key lưu LocalStorage, không gửi lên server Otama. Storage key: <code>{RH_LS_KEY}</code>
          </p>
        </div>
      )}
    </div>
  );
}
