import { useEffect, useCallback } from 'react';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  handler: (e: KeyboardEvent) => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const useKeyboardShortcuts = (shortcuts: ShortcutConfig[]) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const ctrlKey = isMac ? shortcut.meta : shortcut.ctrl;
      const metaKey = isMac ? shortcut.ctrl : shortcut.meta;
      
      const ctrlMatch = ctrlKey ? (isMac ? e.metaKey : e.ctrlKey) : true;
      const metaMatch = metaKey ? (isMac ? e.ctrlKey : e.metaKey) : true;
      const shiftMatch = shortcut.shift ? e.shiftKey : true;
      const altMatch = shortcut.alt ? e.altKey : true;
      
      if (
        e.key.toLowerCase() === shortcut.key.toLowerCase() &&
        ctrlMatch &&
        metaMatch &&
        shiftMatch &&
        altMatch
      ) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          if (shortcut.key === 'p' || shortcut.key === 'n') {
            // Allow Ctrl/Cmd+P and Ctrl/Cmd+N even in inputs
          } else {
            return;
          }
        }
        
        e.preventDefault();
        shortcut.handler(e);
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

export const formatShortcut = (shortcut: ShortcutConfig): string => {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push(isMac ? '⌘' : 'Ctrl');
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  parts.push(shortcut.key.toUpperCase());
  return parts.join(isMac ? '' : '+');
};
