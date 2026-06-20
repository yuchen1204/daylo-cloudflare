
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDangerous = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm rounded-xl shadow-2xl p-6 transform transition-all scale-100"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
        role="dialog" 
        aria-modal="true"
      >
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-full flex-shrink-0 ${isDangerous ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-[var(--interactive-active)]'}`}
               style={{ color: isDangerous ? undefined : 'var(--text-primary)' }}>
             <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {message}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-[var(--text-muted)] focus:outline-none transition-colors hover:bg-[var(--interactive-hover)]"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-slate-900 focus:outline-none transition-colors ${
              isDangerous 
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                : ''
            }`}
            style={!isDangerous ? { background: 'var(--text-primary)', color: 'var(--bg-primary)' } : undefined}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};