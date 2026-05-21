import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PromptRow } from './PromptRow';

export interface PromptListModalItem {
  id: string;
  name: string;
  isDefault?: boolean;
  uid?: string;
}

export interface PromptListModalProps<T extends PromptListModalItem> {
  open: boolean;
  onClose: () => void;
  title?: string;
  prompts: T[];
  selectedId: string | null;
  onSelect: (p: T) => void;
  isAdmin?: boolean;
  onSync?: (p: T, e: React.MouseEvent) => void;
  onEdit?: (p: T, e: React.MouseEvent) => void;
  onDelete?: (id: string, e: React.MouseEvent) => void;
}

export function PromptListModal<T extends PromptListModalItem>({
  open, onClose, title = 'Tất cả prompt đã lưu',
  prompts, selectedId, onSelect,
  isAdmin, onSync, onEdit, onDelete,
}: PromptListModalProps<T>) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-md flex flex-col"
            style={{
              maxHeight: '80vh',
              background: 'var(--color-card)',
              borderRadius: 22,
              border: '0.5px solid var(--color-border-soft)',
              boxShadow: 'var(--shadow-sheet)',
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{
                padding: '16px 20px',
                borderBottom: '0.5px solid var(--color-border-soft)',
              }}
            >
              <h3 className="font-bold" style={{ fontSize: 17, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                {title}
              </h3>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-fill)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                title="Đóng"
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {prompts.length === 0 ? (
                <div className="py-12 text-center" style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                  Chưa có prompt nào được lưu.
                </div>
              ) : (
                prompts.map((p) => (
                  <PromptRow
                    key={p.id}
                    name={p.name}
                    active={selectedId === p.id}
                    synced={p.isDefault}
                    onClick={() => {
                      onSelect(p);
                      onClose();
                    }}
                    showSync={isAdmin}
                    onSync={onSync ? (e) => onSync(p, e) : undefined}
                    showEdit={isAdmin || !p.isDefault}
                    showDelete={isAdmin || !p.isDefault}
                    onEdit={onEdit ? (e) => onEdit(p, e) : undefined}
                    onDelete={onDelete ? (e) => onDelete(p.id, e) : undefined}
                  />
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
