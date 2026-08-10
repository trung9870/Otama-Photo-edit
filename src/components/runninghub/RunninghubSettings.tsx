import { Check, ShieldCheck } from 'lucide-react';

/** @deprecated Provider keys are server-only; retained for import compatibility. */
export function loadRunninghubKey(): string {
  return '';
}

/** @deprecated Browser key persistence is intentionally disabled. */
export function saveRunninghubKey(_value: string) {}

interface Props {
  apiKey?: string;
  onChange?: (value: string) => void;
  defaultOpen?: boolean;
}

export function RunninghubSettings(_props: Props) {
  return (
    <div
      className="mb-4 flex items-center gap-3 px-4 py-3"
      style={{
        background: 'var(--color-card)',
        border: '0.5px solid var(--color-border-soft)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center justify-center" style={{ width: 28, height: 28, color: 'var(--color-success)' }}>
        <ShieldCheck size={18} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>RunningHub key được bảo vệ trên server</p>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Trình duyệt không lưu hoặc nhận credential nhà cung cấp.</p>
      </div>
      <Check size={15} style={{ color: 'var(--color-success)' }} />
    </div>
  );
}
