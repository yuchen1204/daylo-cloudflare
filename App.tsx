import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Note, Notebook, AppSettings, NoteFormat, NoteHistoryEntry } from './types';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { SettingsModal } from './components/SettingsModal';
import { PublicNoteView } from './components/PublicNoteView';
import {
  initializeData,
  saveNote,
  deleteNote,
  createNewNote,
  getStoredSettings,
  saveSettingsToStorage,
  saveNotebook,
  deleteNotebook,
  createNewNotebook,
  getNoteHistory,
  updateNoteOrder,
  updateNotebookOrder
} from './services/storage';
import { cloudSyncService } from './services/cloudflare-sync';
import { SpeedInsights } from "@vercel/speed-insights/react";

interface User {
  id: string;
  email: string;
}

const AuthenticatedApp: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Auth State
  const [user, setUser] = useState<User | null>(null);

  // History State
  const [currentNoteHistory, setCurrentNoteHistory] = useState<NoteHistoryEntry[]>([]);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPWABanner, setShowPWABanner] = useState(false);

  // Key to force re-mounting editor when content is restored externally
  const [editorKey, setEditorKey] = useState(0);

  // Compute all unique tags for autocomplete
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(note => {
      if (note.tags) note.tags.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [notes]);

  // Apply theme to document
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Handle PWA Installation
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const isDismissed = localStorage.getItem('pwa-banner-dismissed') === 'true';
      if (!isDismissed) {
        setShowPWABanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    if (isInstalled) {
      setShowPWABanner(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPWABanner(false);
    }
  };

  const handleDismissPWABanner = () => {
    setShowPWABanner(false);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  // Auth Listener - check for existing token on mount
  useEffect(() => {
    const currentUser = cloudSyncService.currentUser;
    if (currentUser && cloudSyncService.isAuthenticated) {
      setUser(currentUser);
      cloudSyncService.handleLogin(currentUser).then(newData => {
        setNotes(newData.notes);
        setNotebooks(newData.notebooks);
      }).catch(e => console.error("Initial sync failed", e));
    }
  }, []);

  // No real-time sync listeners needed - cloudflare-sync uses REST API
  // Sync happens on login and on each mutation

  // Load data from IndexedDB on mount
  useEffect(() => {
    const init = async () => {
      try {
        const data = await initializeData();
        setNotes(data.notes);
        setNotebooks(data.notebooks);

        if (data.notes.length > 0) {
          setActiveNoteId(data.notes[0].id);
        }
      } catch (err) {
        console.error("Failed to initialize app data:", err);
      } finally {
        setIsLoaded(true);
      }
    };
    init();
  }, []);


  // --- Actions ---

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettingsToStorage(newSettings);
    if (user && cloudSyncService.isAuthenticated) {
      fetch(`${import.meta.env.VITE_API_BASE || 'https://daylo-api.YOUR_SUBDOMAIN.workers.dev'}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cf_auth_token')}`,
        },
        body: JSON.stringify(newSettings),
      }).catch(e => console.error("Failed to sync settings", e));
    }
  };

  const handleReorderNotebooks = async (newOrder: Notebook[]) => {
    setNotebooks(newOrder);
    await updateNotebookOrder(newOrder);
  };

  const handleReorderNotes = async (newOrder: Note[]) => {
    setNotes(prev => {
      const reorderedMap = new Map(newOrder.map(n => [n.id, n]));
      return prev.map(n => reorderedMap.get(n.id) || n);
    });
    await updateNoteOrder(newOrder);

    if (user && cloudSyncService.isAuthenticated) {
      newOrder.forEach(n => cloudSyncService.updateNote(n));
    }
  };

  const handleCreateNotebook = async (name: string) => {
    const newNotebook = createNewNotebook(name);
    setNotebooks(prev => [...prev, newNotebook]);
    await saveNotebook(newNotebook);
    if (user && cloudSyncService.isAuthenticated) cloudSyncService.pushNotebook(newNotebook);
  };

  const handleDeleteNotebook = async (id: string) => {
    setNotebooks(prev => prev.filter(nb => nb.id !== id));
    const notesToDelete = notes.filter(n => n.notebookId === id);
    setNotes(prev => prev.filter(n => n.notebookId !== id));
    if (notesToDelete.some(n => n.id === activeNoteId)) {
       setActiveNoteId(null);
    }
    await deleteNotebook(id);
    if (user && cloudSyncService.isAuthenticated) {
      cloudSyncService.deleteNotebook(id);
      notesToDelete.forEach(n => cloudSyncService.deleteNote(n.id));
    }
  };

  const handleCreateNote = async (notebookId: string, title?: string, format?: NoteFormat, content: string = "") => {
    if (!user) return;
    if (!notebooks.find(n => n.id === notebookId)) {
      if (notebooks.length > 0) notebookId = notebooks[0].id;
      else return;
    }
    const finalFormat = format || settings.defaultNoteFormat;
    const newNote = createNewNote(notebookId, user.id, finalFormat, title, content);
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    await saveNote(newNote);
    if (user && cloudSyncService.isAuthenticated) cloudSyncService.pushNote(newNote);

    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleUpdateNote = async (updatedNote: Note) => {
    setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
    await saveNote(updatedNote);
    if (user && cloudSyncService.isAuthenticated) cloudSyncService.updateNote(updatedNote);
  };

  const handleDeleteNote = async (id: string) => {
    const newNotes = notes.filter(n => n.id !== id);
    setNotes(newNotes);
    if (activeNoteId === id) {
      const deletedNote = notes.find(n => n.id === id);
      const siblings = newNotes.filter(n => n.notebookId === deletedNote?.notebookId);
      setActiveNoteId(siblings.length > 0 ? siblings[0].id : null);
    }
    await deleteNote(id);
    if (user && cloudSyncService.isAuthenticated) cloudSyncService.deleteNote(id);
  };

  const handleRestoreHistory = async (content: string) => {
    if (!activeNoteId) return;
    const note = notes.find(n => n.id === activeNoteId);
    if (!note) return;
    const updatedNote = {
      ...note,
      content: content,
      updatedAt: Date.now()
    };
    await handleUpdateNote(updatedNote);
    setEditorKey(prev => prev + 1);
  };

  const toggleTheme = () => {
    const newSettings = {
      ...settings,
      theme: settings.theme === 'light' ? 'dark' : 'light'
    };
    handleSaveSettings(newSettings);
  };

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-4">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
           <span className="text-sm font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  const activeNote = notes.find(n => n.id === activeNoteId);

  return (
    <div className="flex h-full w-full bg-white dark:bg-slate-950 relative">
      {!isFocusMode && (
        <Sidebar
          notebooks={notebooks}
          notes={notes}
          activeNoteId={activeNoteId}
          onSelectNote={(id) => {
            setActiveNoteId(id);
            setIsSidebarOpen(false);
          }}
          onCreateNote={handleCreateNote}
          onDeleteNote={handleDeleteNote}
          onCreateNotebook={handleCreateNotebook}
          onDeleteNotebook={handleDeleteNotebook}
          onReorderNotebooks={handleReorderNotebooks}
          onReorderNotes={handleReorderNotes}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isOpen={isSidebarOpen}
          onOpenSettings={() => setIsSettingsOpen(true)}
          theme={settings.theme}
          onToggleTheme={toggleTheme}
          history={currentNoteHistory}
          onRestoreHistory={handleRestoreHistory}
          currentContent={activeNote?.content || ""}
          showPWABanner={showPWABanner}
          onInstallPWA={handleInstallPWA}
          onDismissPWABanner={handleDismissPWABanner}
          user={user}
          onLogin={handleUserLogin}
        />
      )}

      {isSidebarOpen && !isFocusMode && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm md:hidden"
          style={{ zIndex: 9990 }}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {activeNote ? (
        <Editor
          key={`${activeNote.id}-${editorKey}`}
          note={activeNote}
          onUpdate={handleUpdateNote}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isFocusMode={isFocusMode}
          onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
          availableTags={allTags}
          user={user}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 p-6 text-center transition-colors">
            {!isFocusMode && (
              <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="absolute top-4 left-4 md:hidden text-slate-600 dark:text-slate-400"
              >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center mb-4 transition-colors">
                <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <h2 className="text-lg font-medium text-slate-600 dark:text-slate-300">Select a page to view</h2>
            <p className="text-sm mt-2 max-w-xs">Select a notebook from the sidebar to create or view a page.</p>
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        installPrompt={deferredPrompt}
        onInstallPWA={handleInstallPWA}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<AuthenticatedApp />} />
        <Route path="/share/:linkId" element={<PublicNoteView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SpeedInsights />
    </>
  );
};
