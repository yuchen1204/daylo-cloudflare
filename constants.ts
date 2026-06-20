

export const APP_TITLE = "Markdown Notes";
export const LOCAL_STORAGE_KEY = "gemini-notes-data"; // Keeping ID to preserve data
export const SETTINGS_STORAGE_KEY = "gemini-notes-settings"; // Keeping ID to preserve settings

export const EMPTY_NOTE_TITLE = "Untitled Note";
export const EMPTY_NOTE_CONTENT = "";

// Debounce delay for auto-saving
export const SAVE_DELAY_MS = 800;

// Deterministic Tag Colors - inline styles for guaranteed contrast
export const getTagColor = (tag: string): { bg: string; text: string; border: string } => {
  const colors = [
    { bg: '#ef4444', text: '#ffffff', border: '#dc2626' },
    { bg: '#f97316', text: '#ffffff', border: '#ea580c' },
    { bg: '#f59e0b', text: '#ffffff', border: '#d97706' },
    { bg: '#eab308', text: '#ffffff', border: '#ca8a04' },
    { bg: '#84cc16', text: '#ffffff', border: '#65a30d' },
    { bg: '#22c55e', text: '#ffffff', border: '#16a34a' },
    { bg: '#10b981', text: '#ffffff', border: '#059669' },
    { bg: '#14b8a6', text: '#ffffff', border: '#0d9488' },
    { bg: '#06b6d4', text: '#ffffff', border: '#0891b2' },
    { bg: '#0ea5e9', text: '#ffffff', border: '#0284c7' },
    { bg: '#3b82f6', text: '#ffffff', border: '#2563eb' },
    { bg: '#6366f1', text: '#ffffff', border: '#4f46e5' },
    { bg: '#8b5cf6', text: '#ffffff', border: '#7c3aed' },
    { bg: '#a855f7', text: '#ffffff', border: '#9333ea' },
    { bg: '#d946ef', text: '#ffffff', border: '#c026d3' },
    { bg: '#ec4899', text: '#ffffff', border: '#db2777' },
    { bg: '#f43f5e', text: '#ffffff', border: '#e11d48' },
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};
