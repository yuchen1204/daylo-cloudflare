export interface Note {
  id: string;
  notebookId: string;
  ownerId: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  format: 'markdown' | 'txt' | 'canvas' | 'mindmap';
  isPinned?: boolean;
  order?: number;
  accessInfo?: AccessInfo;
}

export interface NoteHistoryEntry {
  id: string;
  noteId: string;
  content: string;
  timestamp: number;
}

export interface Notebook {
  id: string;
  name: string;
  createdAt: number;
  order?: number;
}

export type NoteFormat = 'markdown' | 'txt' | 'canvas' | 'mindmap';

export interface MarkdownSettings {
  fontSize: number;
  fontFamily: 'sans' | 'serif' | 'mono';
  lineHeight: number;
}

export interface CanvasSettings {
  gridSize: number;
  showGrid: boolean;
  snapToGrid: boolean;
}

export interface MindMapSettings {
  layout: 'radial' | 'horizontal' | 'vertical';
  curveStyle: 'straight' | 'step' | 'bezier';
}

export interface AppSettings {
  defaultNoteFormat: NoteFormat;
  theme: 'light' | 'dark';
  historySnapshotInterval: number; // in milliseconds. 0 means "every change"
  markdown: MarkdownSettings;
  canvas: CanvasSettings;
  mindmap: MindMapSettings;
  activeNoteId?: string | null;
}

// --- New Permission Model Types (Phase 1) ---

export type AccessLevel = 'viewer' | 'editor';

// A summary of permissions on the note itself for quick access in the UI
export interface AccessInfo {
  isPublic: boolean;
  sharedWithCount: number;
  publicLinkId?: string;
}

// Represents the document in the top-level `permissions` collection
export interface Permission {
  resourceId: string;
  resourceType: 'note' | 'notebook';
  ownerId: string;
  publicAccess: {
    enabled: boolean;
    accessLevel: 'viewer';
    linkId: string;
  };
  userAccess: {
    [userId: string]: {
      accessLevel: 'editor';
    };
  };
}
