import { Note, Notebook, AppSettings, NoteFormat, NoteHistoryEntry } from '../types';
import { SETTINGS_STORAGE_KEY } from '../constants';

// --- IndexedDB Configuration ---
const DB_NAME = 'GeminiNotesDB';
const DB_VERSION = 3; // Incremented for history support
const STORE_NOTES = 'notes';
const STORE_NOTEBOOKS = 'notebooks';
const STORE_HISTORY = 'history';

// Helper to open the database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create notes store if missing
      if (!db.objectStoreNames.contains(STORE_NOTES)) {
        db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
      }

      // Create notebooks store if missing
      if (!db.objectStoreNames.contains(STORE_NOTEBOOKS)) {
        db.createObjectStore(STORE_NOTEBOOKS, { keyPath: 'id' });
      }

      // Create history store if missing
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        const historyStore = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
        // Create an index to search by noteId for fast retrieval
        historyStore.createIndex('noteId', 'noteId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// --- Data Initialization & Migration ---

export const initializeData = async (): Promise<{ notes: Note[], notebooks: Notebook[] }> => {
  const db = await openDB();
  
  // 1. Fetch Notebooks
  let notebooks = await new Promise<Notebook[]>((resolve, reject) => {
    const transaction = db.transaction(STORE_NOTEBOOKS, 'readonly');
    const store = transaction.objectStore(STORE_NOTEBOOKS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // 2. Fetch Notes
  let notes = await new Promise<Note[]>((resolve, reject) => {
    const transaction = db.transaction(STORE_NOTES, 'readonly');
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // --- Migration Logic ---
  // If absolutely no data, create a default notebook anyway.
  if (notebooks.length === 0) {
    const defaultNotebook: Notebook = {
      id: crypto.randomUUID(),
      name: 'General',
      createdAt: Date.now()
    };
    await saveNotebook(defaultNotebook);
    notebooks = [defaultNotebook];
  }

  // Assign orphan notes to the first notebook
  const defaultNotebookId = notebooks[0].id;
  let notesUpdated = false;

  const migratedNotes = notes.map(note => {
    if (!note.notebookId) {
      notesUpdated = true;
      return { ...note, notebookId: defaultNotebookId };
    }
    return note;
  });

  if (notesUpdated) {
    console.log("Migrating orphan notes to default notebook...");
    for (const note of migratedNotes) {
      await saveNote(note);
    }
    notes = migratedNotes;
  }

  return {
    notes: notes.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        return b.updatedAt - a.updatedAt;
    }),
    notebooks: notebooks.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        return a.createdAt - b.createdAt;
    })
  };
};

// --- Notebook Operations ---

export const updateNotebookOrder = async (notebooks: Notebook[]): Promise<void> => {
    const db = await openDB();
    const transaction = db.transaction(STORE_NOTEBOOKS, 'readwrite');
    const store = transaction.objectStore(STORE_NOTEBOOKS);
    
    notebooks.forEach((nb, index) => {
        nb.order = index;
        store.put(nb);
    });
    
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const saveNotebook = async (notebook: Notebook): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NOTEBOOKS, 'readwrite');
    const store = transaction.objectStore(STORE_NOTEBOOKS);
    const request = store.put(notebook);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteNotebook = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NOTEBOOKS, STORE_NOTES, STORE_HISTORY], 'readwrite');
    const nbStore = transaction.objectStore(STORE_NOTEBOOKS);
    const noteStore = transaction.objectStore(STORE_NOTES);
    // Ideally we also delete history, but for simplicity/performance in this block we focus on notes
    
    // Delete notebook
    nbStore.delete(id);

    // Also delete all notes in this notebook
    const noteRequest = noteStore.getAll();
    noteRequest.onsuccess = () => {
      const notes = noteRequest.result as Note[];
      notes.forEach(note => {
        if (note.notebookId === id) {
          noteStore.delete(note.id);
        }
      });
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// --- Note Operations ---

export const getAllNotes = async (): Promise<Note[]> => {
  const db = await openDB();
  return new Promise<Note[]>((resolve, reject) => {
    const transaction = db.transaction(STORE_NOTES, 'readonly');
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const updateNoteOrder = async (notes: Note[]): Promise<void> => {
    const db = await openDB();
    const transaction = db.transaction(STORE_NOTES, 'readwrite');
    const store = transaction.objectStore(STORE_NOTES);
    
    notes.forEach((note, index) => {
        note.order = index;
        store.put(note);
    });
    
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const saveNote = async (note: Note): Promise<void> => {
  const db = await openDB();
  
  // 1. Save the Note
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NOTES, 'readwrite');
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.put(note);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // 2. Check and Save History Snapshot
  await trySaveHistorySnapshot(db, note);
};

export const deleteNote = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NOTES, STORE_HISTORY], 'readwrite');
    const noteStore = transaction.objectStore(STORE_NOTES);
    const historyStore = transaction.objectStore(STORE_HISTORY);
    const historyIndex = historyStore.index('noteId');
    
    // Delete the note
    noteStore.delete(id);

    // Delete associated history
    const historyRequest = historyIndex.getAllKeys(id);
    historyRequest.onsuccess = () => {
      const keys = historyRequest.result;
      keys.forEach(key => historyStore.delete(key));
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// --- History Operations ---

const trySaveHistorySnapshot = async (db: IDBDatabase, note: Note): Promise<void> => {
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_HISTORY, 'readwrite');
    const store = transaction.objectStore(STORE_HISTORY);
    const index = store.index('noteId');
    
    // Get all history for this note
    const request = index.getAll(note.id);

    request.onsuccess = () => {
      const history = request.result as NoteHistoryEntry[];
      
      // Sort by timestamp descending
      history.sort((a, b) => b.timestamp - a.timestamp);
      
      const lastEntry = history[0];
      const now = Date.now();

      const settings = getStoredSettings();
      const snapshotInterval = settings.historySnapshotInterval;

      // Logic: 
      // 1. Content MUST change.
      // 2. Time elapsed > interval OR No previous history OR Interval is 0 (Every Change)
      const contentChanged = !lastEntry || lastEntry.content !== note.content;
      
      const shouldSave = contentChanged && (
        !lastEntry || 
        snapshotInterval === 0 || 
        (now - lastEntry.timestamp > snapshotInterval)
      );

      if (shouldSave) {
        const newEntry: NoteHistoryEntry = {
          id: crypto.randomUUID(),
          noteId: note.id,
          content: note.content,
          timestamp: now
        };
        store.add(newEntry);
        
        // Optional: Limit history depth (e.g., keep last 50)
        if (history.length > 50) {
           const oldest = history[history.length - 1];
           store.delete(oldest.id);
        }
      }
      resolve();
    };
    
    request.onerror = () => resolve(); // Fail silently for history
  });
};

export const getNoteHistory = async (noteId: string): Promise<NoteHistoryEntry[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_HISTORY, 'readonly');
    const store = transaction.objectStore(STORE_HISTORY);
    const index = store.index('noteId');
    const request = index.getAll(noteId);
    
    request.onsuccess = () => {
      const results = request.result as NoteHistoryEntry[];
      // Sort newest first
      resolve(results.sort((a, b) => b.timestamp - a.timestamp));
    };
    request.onerror = () => reject(request.error);
  });
};

// --- Settings Operations ---

const DEFAULT_SETTINGS: AppSettings = {
  defaultNoteFormat: 'markdown',
  theme: 'light',
  historySnapshotInterval: 120000, // 2 minutes default
  markdown: {
    fontSize: 14,
    fontFamily: 'sans',
    lineHeight: 1.5
  },
  canvas: {
    gridSize: 20,
    showGrid: true,
    snapToGrid: true
  },
  mindmap: {
    layout: 'radial',
    curveStyle: 'bezier'
  }
};

export const getStoredSettings = (): AppSettings => {
  try {
    const data = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!data) return DEFAULT_SETTINGS;
    
    const parsed = JSON.parse(data);
    // Merge with default settings to ensure new keys are present
    return { 
      ...DEFAULT_SETTINGS, 
      ...parsed,
      markdown: { ...DEFAULT_SETTINGS.markdown, ...(parsed.markdown || {}) },
      canvas: { ...DEFAULT_SETTINGS.canvas, ...(parsed.canvas || {}) },
      mindmap: { ...DEFAULT_SETTINGS.mindmap, ...(parsed.mindmap || {}) }
    };
  } catch (error) {
    console.error("Failed to load settings", error);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettingsToStorage = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save settings", error);
  }
};

// --- Utility Functions ---

export const downloadNote = (note: Note) => {
  let extension = 'md';
  let mimeType = 'text/plain';

  if (note.format === 'txt') {
    extension = 'txt';
  } else if (note.format === 'canvas') {
    extension = 'json';
    mimeType = 'application/json';
  } else if (note.format === 'mindmap') {
    extension = 'mm.json'; // using json storage for now
    mimeType = 'application/json';
  }

  const element = document.createElement("a");
  const file = new Blob([note.content], {type: mimeType});
  element.href = URL.createObjectURL(file);
  element.download = `${note.title || 'Untitled'}.${extension}`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export const createNewNote = (notebookId: string, userId: string, format: NoteFormat = 'markdown', title: string = '', content: string = ''): Note => {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    notebookId,
    ownerId: userId,
    title: title,
    content: content,
    createdAt: now,
    updatedAt: now,
    tags: [],
    format: format,
    isPinned: false,
    accessInfo: {
      isPublic: false,
      sharedWithCount: 0
    }
  };
};

export const createNewNotebook = (name: string): Notebook => {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now()
  };
};