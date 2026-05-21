import React from 'react';
import { CheckCircle2, Edit2, Trash2, Globe } from 'lucide-react';

export interface PromptRowProps {
  name: string;
  active: boolean;
  synced?: boolean;
  onClick: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  onSync?: (e: React.MouseEvent) => void;
  showSync?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
}

export function PromptRow({
  name, active, synced,
  onClick, onEdit, onDelete, onSync,
  showSync, showEdit = true, showDelete = true,
}: PromptRowProps) {
  return (
    <div
      onClick={onClick}
      className="group flex items-center justify-between cursor-pointer transition-all"
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        background: active ? 'var(--color-accent-soft)' : 'transparent',
        border: active ? '1px solid var(--color-accent)' : '1px solid transparent',
      }}
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div
          className="shrink-0 rounded-full"
          style={{
            width: 7,
            height: 7,
            background: active ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
            boxShadow: active ? '0 0 0 4px var(--color-accent-soft)' : 'none',
          }}
        />
        <div
          className="truncate"
          style={{
            fontSize: 13,
            fontWeight: active ? 600 : 500,
            color: active ? 'var(--color-accent)' : 'var(--color-text)',
            letterSpacing: '-0.01em',
          }}
        >
          {name}
        </div>
        {synced && <CheckCircle2 size={12} style={{ color: 'var(--color-success)', flexShrink: 0 }} />}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {showSync && onSync && (
          <button
            onClick={onSync}
            className="p-1.5 transition-colors hover:opacity-100 opacity-60"
            style={{ color: 'var(--color-text-tertiary)' }}
            title="Đồng bộ"
          >
            <Globe size={12} strokeWidth={1.8} />
          </button>
        )}
        {showEdit && onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 transition-colors hover:opacity-100 opacity-60"
            style={{ color: 'var(--color-text-tertiary)' }}
            title="Sửa"
          >
            <Edit2 size={12} strokeWidth={1.8} />
          </button>
        )}
        {showDelete && onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 transition-colors hover:opacity-100 opacity-60"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
            title="Xóa"
          >
            <Trash2 size={12} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </div>
  );
}
