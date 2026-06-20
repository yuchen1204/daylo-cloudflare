import { Note, Notebook, AppSettings } from '../types';
import { saveNote, saveNotebook, deleteNote, deleteNotebook, initializeData } from './storage';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://daylo-api.YOUR_SUBDOMAIN.workers.dev';

interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

interface User {
  id: string;
  email: string;
}

interface CloudNote {
  id: string;
  user_id: string;
  notebook_id: string;
  title: string;
  content: string;
  format: string;
  tags: string;
  is_public: number;
  public_link_id: string | null;
  created_at: number;
  updated_at: number;
}

interface CloudNotebook {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  created_at: number;
}

function getToken(): string | null {
  return localStorage.getItem('cf_auth_token');
}

function setToken(token: string): void {
  localStorage.setItem('cf_auth_token', token);
}

function removeToken(): void {
  localStorage.removeItem('cf_auth_token');
}

function getUser(): User | null {
  const data = localStorage.getItem('cf_user');
  return data ? JSON.parse(data) : null;
}

function setUser(user: User): void {
  localStorage.setItem('cf_user', JSON.stringify(user));
}

function removeUser(): void {
  localStorage.removeItem('cf_user');
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json<{ error: string }>();
    throw new Error(error.error || `API error: ${res.status}`);
  }
  return res.json<T>();
}

function toCloudNote(note: Note): Partial<CloudNote> {
  return {
    id: note.id,
    notebook_id: note.notebookId,
    title: note.title,
    content: note.content,
    format: note.format,
    tags: JSON.stringify(note.tags),
    is_public: note.accessInfo?.isPublic ? 1 : 0,
    public_link_id: note.accessInfo?.publicLinkId || null,
    updated_at: note.updatedAt,
  };
}

function fromCloudNote(cn: CloudNote): Note {
  let tags: string[] = [];
  try {
    tags = JSON.parse(cn.tags);
  } catch {}

  return {
    id: cn.id,
    notebookId: cn.notebook_id,
    ownerId: cn.user_id,
    title: cn.title,
    content: cn.content,
    format: cn.format as Note['format'],
    tags,
    createdAt: cn.created_at,
    updatedAt: cn.updated_at,
    accessInfo: {
      isPublic: cn.is_public === 1,
      sharedWithCount: 0,
      publicLinkId: cn.public_link_id || undefined,
    },
  };
}

function toCloudNotebook(nb: Notebook): Partial<CloudNotebook> {
  return {
    id: nb.id,
    name: nb.name,
  };
}

function fromCloudNotebook(cn: CloudNotebook): Notebook {
  return {
    id: cn.id,
    name: cn.name,
    createdAt: cn.created_at,
  };
}

export const cloudSyncService = {
  async register(email: string, password: string): Promise<User> {
    const data = await apiFetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  },

  async login(email: string, password: string): Promise<User> {
    const data = await apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  },

  logout(): void {
    removeToken();
    removeUser();
  },

  get currentUser(): User | null {
    return getUser();
  },

  get isAuthenticated(): boolean {
    return !!getToken();
  },

  async handleLogin(user: User): Promise<{ notes: Note[], notebooks: Notebook[] }> {
    const [cloudData, localData] = await Promise.all([
      apiFetch<{ notebooks: CloudNotebook[]; notes: CloudNote[]; settings: Record<string, unknown> }>('/api/sync/pull'),
      initializeData(),
    ]);

    const cloudNotebooks = cloudData.notebooks.map(fromCloudNotebook);
    const cloudNotes = cloudData.notes.map(fromCloudNote);

    const allNotebooks = [...cloudNotebooks, ...localData.notebooks];
    const allNotes = [...cloudNotes, ...localData.notes];

    const canonicalNotebooks = new Map<string, Notebook>();
    allNotebooks.forEach(nb => {
      if (!canonicalNotebooks.has(nb.name)) {
        canonicalNotebooks.set(nb.name, nb);
      }
    });

    const notebookIdMap = new Map<string, string>();
    const redundantNotebookIds = new Set<string>();
    allNotebooks.forEach(nb => {
      const canonical = canonicalNotebooks.get(nb.name)!;
      if (nb.id !== canonical.id) {
        redundantNotebookIds.add(nb.id);
      }
      notebookIdMap.set(nb.id, canonical.id);
    });

    const notesById = new Map<string, Note[]>();
    allNotes.forEach(note => {
      if (!notesById.has(note.id)) notesById.set(note.id, []);
      notesById.get(note.id)!.push(note);
    });

    const finalNotes: Note[] = [];
    for (const [_, noteVersions] of notesById.entries()) {
      noteVersions.sort((a, b) => b.updatedAt - a.updatedAt);
      const newestNote = { ...noteVersions[0] };
      const canonicalNotebookId = notebookIdMap.get(newestNote.notebookId);
      if (canonicalNotebookId) {
        newestNote.notebookId = canonicalNotebookId;
        finalNotes.push(newestNote);
      }
    }

    const finalNotebooks = Array.from(canonicalNotebooks.values());

    const notebooksToPush = finalNotebooks.filter(
      nb => !cloudNotebooks.some(cnb => cnb.id === nb.id)
    );
    const notesToPush = finalNotes.filter(
      note => !cloudNotes.some(cn => cn.id === note.id && cn.updatedAt >= note.updatedAt)
    );

    for (const nb of finalNotebooks) await saveNotebook(nb);
    for (const note of finalNotes) await saveNote(note);

    if (notebooksToPush.length > 0 || notesToPush.length > 0) {
      await apiFetch('/api/sync/push', {
        method: 'POST',
        body: JSON.stringify({
          notebooks: notebooksToPush.map(toCloudNotebook),
          notes: notesToPush.map(toCloudNote),
        }),
      });
    }

    for (const id of redundantNotebookIds) {
      if (localData.notebooks.some(nb => nb.id === id)) await deleteNotebook(id);
    }

    return initializeData();
  },

  async pushNote(note: Note): Promise<void> {
    await apiFetch('/api/notes', {
      method: 'POST',
      body: JSON.stringify(toCloudNote(note)),
    });
  },

  async updateNote(note: Note): Promise<void> {
    await apiFetch(`/api/notes/${note.id}`, {
      method: 'PUT',
      body: JSON.stringify(toCloudNote(note)),
    });
  },

  async deleteNote(noteId: string): Promise<void> {
    await apiFetch(`/api/notes/${noteId}`, { method: 'DELETE' });
  },

  async pushNotebook(notebook: Notebook): Promise<void> {
    await apiFetch('/api/notebooks', {
      method: 'POST',
      body: JSON.stringify(toCloudNotebook(notebook)),
    });
  },

  async updateNotebook(notebook: Notebook): Promise<void> {
    await apiFetch(`/api/notebooks/${notebook.id}`, {
      method: 'PUT',
      body: JSON.stringify(toCloudNotebook(notebook)),
    });
  },

  async deleteNotebook(notebookId: string): Promise<void> {
    await apiFetch(`/api/notebooks/${notebookId}`, { method: 'DELETE' });
  },

  async shareNote(note: Note, enable: boolean): Promise<string | null> {
    const linkId = note.accessInfo?.publicLinkId || crypto.randomUUID();
    await apiFetch(`/api/notes/${note.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        is_public: enable,
        public_link_id: enable ? linkId : null,
      }),
    });
    return enable ? linkId : null;
  },

  async getPublicNote(linkId: string): Promise<Note | null> {
    try {
      const cn = await apiFetch<CloudNote>(`/api/public/${linkId}`);
      return fromCloudNote(cn);
    } catch {
      return null;
    }
  },
};
