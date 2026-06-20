import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { ShortcutConfig, formatShortcut } from '../hooks/useKeyboardShortcuts';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutConfig[];
}

export const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({ isOpen, onClose, shortcuts }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 transition-colors overflow-hidden"
           style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--interactive-hover)] transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-3">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{shortcut.description}</span>
                <kbd 
                  className="px-2 py-1 text-xs font-mono rounded"
                  style={{ 
                    background: 'var(--bg-tertiary)', 
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-primary)'
                  }}
                >
                  {formatShortcut(shortcut)}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
