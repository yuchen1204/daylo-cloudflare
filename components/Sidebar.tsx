import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Note, Notebook, NoteHistoryEntry } from '../types';
import {
  Plus,
  Trash2,
  Search,
  FileText,
  Settings,
  Book,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  FilePlus,
  Palette,
  X,
  Moon,
  Sun,
  History,
  Pin,
  Tag,
  Network,
  GripVertical,
  Upload,
  LogIn,
  LogOut,
  User as UserIcon,
  Cloud,
  Download
} from 'lucide-react';
import { cloudSyncService } from '../services/cloudflare-sync';
import { ConfirmModal } from './ConfirmModal';
import { Share2 } from 'lucide-react';
import { HistoryCompareModal } from './HistoryCompareModal';
import { LoginModal } from './LoginModal'; // Added
import { ProfileModal } from './ProfileModal';
import { getTagColor } from '../constants';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent,
  TouchSensor,
  MouseSensor
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
interface User {
  id: string;
  email: string;
}

interface SidebarProps {
  notebooks: Notebook[];
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: (notebookId: string, title: string, format?: 'markdown' | 'txt' | 'canvas' | 'mindmap', content?: string) => void;
  onDeleteNote: (id: string) => void;
  onCreateNotebook: (name: string) => void;
  onDeleteNotebook: (id: string) => void;
  onReorderNotebooks: (notebooks: Notebook[]) => void;
  onReorderNotes: (notes: Note[]) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  isOpen: boolean;
  onOpenSettings: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  history: NoteHistoryEntry[];
  onRestoreHistory: (content: string) => void;
  currentContent: string;
  showPWABanner?: boolean;
  onInstallPWA?: () => void;
  onDismissPWABanner?: () => void;
  user: User | null; 
  onLogin: (user: User) => void; 
}

interface DeleteState {
  type: 'notebook' | 'note';
  id: string;
  name: string;
}

// ... SortableNotebookTrigger ...
interface SortableNotebookTriggerProps {
  notebook: Notebook;
  expanded: boolean;
  onToggle: () => void;
  onCreateSpecial: (format: 'canvas' | 'mindmap', e: React.MouseEvent) => void;
  onCreateNote: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onImport: (e: React.MouseEvent) => void;
  noteCount: number;
  disabled?: boolean;
}

function SortableNotebookTrigger({ 
  notebook, expanded, onToggle, onCreateSpecial, onCreateNote, onDelete, onImport, noteCount, disabled 
}: SortableNotebookTriggerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: notebook.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center justify-between py-1 px-2 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors">
      {/* Drag Handle */}
      {!disabled && (
        <div 
            {...attributes} 
            {...listeners} 
            className="mr-1 p-1 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
        >
            <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}

      <button 
          className="flex items-center gap-2 flex-1 text-left overflow-hidden cursor-pointer"
          onClick={onToggle}
      >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{notebook.name}</span>
          <span className="text-xs text-slate-400">({noteCount})</span>
      </button>
      
      {/* Action Buttons */}
      <div className={`flex items-center transition-opacity ${expanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button 
            onClick={onImport}
            className="p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mr-0.5"
            title="Import Markdown/Text"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => onCreateSpecial('mindmap', e)}
            className="p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mr-0.5"
            title="New MindMap"
          >
            <Network className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => onCreateSpecial('canvas', e)}
            className="p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors mr-0.5"
            title="New Canvas"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={onCreateNote}
            className="p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            title="New Text Note"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={onDelete}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Delete Notebook"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
      </div>
    </div>
  );
}

// ... SortableNoteItem ... (No changes needed)
interface SortableNoteItemProps {
  note: Note;
  isActive: boolean;
  onSelect: () => void;
  onRequestDelete: (e: React.MouseEvent) => void;
  disabled?: boolean;
}

function SortableNoteItem({ note, isActive, onSelect, onRequestDelete, disabled }: SortableNoteItemProps) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging
    } = useSortable({ id: note.id, disabled });
  
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      position: 'relative' as const,
      zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <li ref={setNodeRef} style={style} className="flex items-stretch group">
            {!disabled && (
                <div 
                    {...attributes} 
                    {...listeners}
                    className="flex items-center justify-center px-1 cursor-grab active:cursor-grabbing touch-none text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400"
                >
                    <GripVertical className="w-3 h-3" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                 <NoteItem 
                    note={note} 
                    isActive={isActive} 
                    onSelect={onSelect} 
                    onRequestDelete={onRequestDelete} 
                 />
            </div>
        </li>
    );
}


export const Sidebar: React.FC<SidebarProps> = ({
  notebooks,
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onCreateNotebook,
  onDeleteNotebook,
  onReorderNotebooks,
  onReorderNotes,
  searchTerm,
  onSearchChange,
  isOpen,
  onOpenSettings,
  theme,
  onToggleTheme,
  history,
  onRestoreHistory,
  currentContent,
  showPWABanner,
  onInstallPWA,
  onDismissPWABanner,
  user,
  onLogin
}) => {
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(new Set(notebooks.map(n => n.id)));
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  
  // Login Modal State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Creation States
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [creatingNoteInNotebookId, setCreatingNoteInNotebookId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importTargetNotebookId, setImportTargetNotebookId] = useState<string | null>(null);

  // Deletion State
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);

  // History Comparison State
  const [selectedHistory, setSelectedHistory] = useState<NoteHistoryEntry | null>(null);

  // Tag Filtering State
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const triggerImport = (notebookId: string) => {
    setImportTargetNotebookId(notebookId);
    if (importInputRef.current) {
        importInputRef.current.value = '';
        importInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importTargetNotebookId) return;

    try {
        const buffer = await file.arrayBuffer();
        let text = "";
        
        try {
            // Try UTF-8 first (strict)
            const decoder = new TextDecoder('utf-8', { fatal: true });
            text = decoder.decode(buffer);
        } catch (err) {
            // If failed, try GBK (common for older Chinese text files)
            try {
                const decoder = new TextDecoder('gbk', { fatal: true });
                text = decoder.decode(buffer);
            } catch (err2) {
                // Fallback to non-fatal UTF-8 (best effort)
                const decoder = new TextDecoder('utf-8');
                text = decoder.decode(buffer);
            }
        }

        const title = file.name.replace(/\.(md|txt)$/i, "");
        const format = file.name.toLowerCase().endsWith('.md') ? 'markdown' : 'txt';
        
        onCreateNote(importTargetNotebookId, title, format, text);
        setImportTargetNotebookId(null);
        
    } catch (error) {
        console.error("Import failed", error);
        alert("Failed to import file.");
    }
  };

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 5,
        }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Compute Unique Tags with Counts
  const tagStats = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach(note => {
      if (note.tags) {
        note.tags.forEach(t => {
          counts.set(t, (counts.get(t) || 0) + 1);
        });
      }
    });
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [notes]);

  useEffect(() => {
    if ((isCreatingNotebook || creatingNoteInNotebookId) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreatingNotebook, creatingNoteInNotebookId]);

  const toggleNotebook = (id: string) => {
    const newExpanded = new Set(expandedNotebooks);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNotebooks(newExpanded);
  };

  const startCreateNotebook = () => {
    setIsCreatingNotebook(true);
    setCreatingNoteInNotebookId(null);
    setInputValue("");
  };

  const startCreateNote = (notebookId: string) => {
    setCreatingNoteInNotebookId(notebookId);
    setIsCreatingNotebook(false);
    setInputValue("");
    const newExpanded = new Set(expandedNotebooks);
    newExpanded.add(notebookId);
    setExpandedNotebooks(newExpanded);
  };

  const createSpecialNote = (notebookId: string, format: 'canvas' | 'mindmap', e: React.MouseEvent) => {
    e.stopPropagation();
    const title = format === 'canvas' ? "Untitled Canvas" : "Untitled MindMap";
    onCreateNote(notebookId, title, format);
    const newExpanded = new Set(expandedNotebooks);
    newExpanded.add(notebookId);
    setExpandedNotebooks(newExpanded);
  };

  const cancelCreation = () => {
    setIsCreatingNotebook(false);
    setCreatingNoteInNotebookId(null);
    setInputValue("");
  };

  const handleInputKeyDown = (e: React.KeyboardEvent, type: 'notebook' | 'note', notebookId?: string) => {
    if (e.key === 'Enter') {
      if (!inputValue.trim()) {
        cancelCreation();
        return;
      }

      if (type === 'notebook') {
        onCreateNotebook(inputValue.trim());
      } else if (type === 'note' && notebookId) {
        let title = inputValue.trim();
        let format: 'markdown' | 'txt' | 'canvas' | 'mindmap' | undefined = undefined;
        if (title.endsWith('.md')) { title = title.slice(0, -3); format = 'markdown'; } 
        else if (title.endsWith('.txt')) { title = title.slice(0, -4); format = 'txt'; } 
        else if (title.endsWith('.canvas')) { title = title.slice(0, -7); format = 'canvas'; } 
        else if (title.endsWith('.mm')) { title = title.slice(0, -3); format = 'mindmap'; }
        onCreateNote(notebookId, title, format);
      }
      cancelCreation();
    } else if (e.key === 'Escape') {
      cancelCreation();
    }
  };

  const requestDeleteNotebook = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteState({ type: 'notebook', id, name });
  };

  const requestDeleteNote = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteState({ type: 'note', id, name: title || 'Untitled Note' });
  };

  const handleConfirmDelete = () => {
    if (!deleteState) return;
    if (deleteState.type === 'notebook') onDeleteNotebook(deleteState.id);
    else onDeleteNote(deleteState.id);
    setDeleteState(null);
  };

  const handleLogout = async () => {
    try {
      cloudSyncService.logout();
      window.location.reload(); // Reload to clear state/sync context
    } catch (e) {
      console.error(e);
    }
  };

  const searchFilteredNotes = notes.filter(note => 
    (note.title && note.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (note.content && note.content.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const finalFilteredNotes = selectedTag 
    ? searchFilteredNotes.filter(n => n.tags && n.tags.includes(selectedTag))
    : searchFilteredNotes;

  const filteredNotes = finalFilteredNotes.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    return b.updatedAt - a.updatedAt;
  });

  const notebookGroups = notebooks.map(nb => ({
    ...nb,
    notes: filteredNotes.filter(n => n.notebookId === nb.id)
  }));

  const isSearching = searchTerm.length > 0;
  const isFilteringTags = !!selectedTag;
  const isDnDEnabled = !isSearching && !isFilteringTags; 

  const pinnedNotes = isDnDEnabled ? notes.filter(n => n.isPinned) : [];
  const activeNote = notes.find(n => n.id === activeNoteId);
  const showHistoryPanel = activeNote && activeNote.format !== 'canvas' && activeNote.format !== 'mindmap';

  const handleDragEnd = (event: DragEndEvent) => {
    // ... (Same DragEnd logic)
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeNotebookIndex = notebooks.findIndex(nb => nb.id === active.id);
    const overNotebookIndex = notebooks.findIndex(nb => nb.id === over.id);

    if (activeNotebookIndex !== -1 && overNotebookIndex !== -1) {
       const newOrder = arrayMove(notebooks, activeNotebookIndex, overNotebookIndex);
       onReorderNotebooks(newOrder);
       return;
    }

    const activeNote = notes.find(n => n.id === active.id);
    const overNote = notes.find(n => n.id === over.id);
    const overNotebook = notebooks.find(nb => nb.id === over.id);

    if (activeNote) {
       let targetNotebookId: string | null = null;
       let insertIndex = -1;

       if (overNote) {
          targetNotebookId = overNote.notebookId;
       } else if (overNotebook) {
          targetNotebookId = overNotebook.id;
          insertIndex = 0;
       }

       if (targetNotebookId) {
          const sourceNotebookId = activeNote.notebookId;
          const sortNotes = (n1: Note, n2: Note) => {
             if (n1.order !== undefined && n2.order !== undefined) return n1.order - n2.order;
             return n2.updatedAt - n1.updatedAt;
          };

          if (sourceNotebookId === targetNotebookId) {
             const notebookNotes = notes.filter(n => n.notebookId === sourceNotebookId).sort(sortNotes);
             const oldIndex = notebookNotes.findIndex(n => n.id === active.id);
             const newIndex = overNote ? notebookNotes.findIndex(n => n.id === over.id) : (insertIndex === 0 ? 0 : notebookNotes.length);
             if (oldIndex !== -1 && newIndex !== -1) {
                const reordered = arrayMove(notebookNotes, oldIndex, newIndex);
                const finalNotes = reordered.map((n, i) => ({ ...n, order: i }));
                onReorderNotes(finalNotes);
             }
          } else {
             const sourceNotes = notes.filter(n => n.notebookId === sourceNotebookId && n.id !== active.id).sort(sortNotes);
             const targetNotes = notes.filter(n => n.notebookId === targetNotebookId).sort(sortNotes);
             if (insertIndex === -1 && overNote) {
                const overIndex = targetNotes.findIndex(n => n.id === over.id);
                insertIndex = overIndex >= 0 ? overIndex : targetNotes.length;
             } else if (insertIndex === -1) { insertIndex = targetNotes.length; }
             const updatedActiveNote = { ...activeNote, notebookId: targetNotebookId };
             targetNotes.splice(insertIndex, 0, updatedActiveNote);
             const updatedSourceNotes = sourceNotes.map((n, i) => ({ ...n, order: i }));
             const updatedTargetNotes = targetNotes.map((n, i) => ({ ...n, order: i }));
             onReorderNotes([...updatedSourceNotes, ...updatedTargetNotes]);
             if (!expandedNotebooks.has(targetNotebookId)) {
                const newExpanded = new Set(expandedNotebooks);
                newExpanded.add(targetNotebookId);
                setExpandedNotebooks(newExpanded);
             }
          }
       }
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div 
        className={`
          fixed inset-y-0 left-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
        `}
        style={{ zIndex: 9999 }}
      >
        {/* Header & Search */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pl-2">
               <Book className="w-3.5 h-3.5" /> Library
            </h1>
            <button onClick={startCreateNotebook} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="New Notebook">
               <FolderPlus className="w-4 h-4" />
             </button>
          </div>
        </div>

        <div className="p-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-2 min-h-0">
          {/* PWA Install Banner */}
          {showPWABanner && onInstallPWA && onDismissPWABanner && (
            <div className="mb-4 mx-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-lg relative group">
               <button 
                 onClick={onDismissPWABanner}
                 className="absolute top-1 right-1 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
               >
                 <X className="w-3 h-3" />
               </button>
               <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                     <Download className="w-4 h-4" />
                     <span className="text-xs font-semibold">Install App</span>
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Install Daylo for a better experience and offline access.
                  </p>
                  <button 
                    onClick={onInstallPWA}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded shadow-sm transition-colors"
                  >
                    Install
                  </button>
               </div>
            </div>
          )}

          {isSearching ? (
            <div>
               <h3 className="px-2 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Search Results</h3>
               {filteredNotes.length === 0 ? <div className="p-4 text-center text-slate-400 text-sm">No matches found.</div> : (
                  <ul className="space-y-0.5">
                    {filteredNotes.map(note => (
                      <NoteItem key={note.id} note={note} isActive={activeNoteId === note.id} onSelect={() => onSelectNote(note.id)} onRequestDelete={(e) => requestDeleteNote(note.id, note.title, e)} />
                    ))}
                  </ul>
               )}
            </div>
          ) : (
            <div className="space-y-4 py-2">
               
               {/* Pinned */}
               {pinnedNotes.length > 0 && (
                 <div className="mb-4">
                   <div className="flex items-center gap-2 px-2 py-1 mb-1 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      <Pin className="w-3 h-3" /> <span>Pinned</span>
                   </div>
                   <ul className="ml-0 space-y-0.5">
                      {pinnedNotes.map(note => (
                        <NoteItem key={note.id} note={note} isActive={activeNoteId === note.id} onSelect={() => onSelectNote(note.id)} onRequestDelete={(e) => requestDeleteNote(note.id, note.title, e)} showPinIcon />
                      ))}
                   </ul>
                   <div className="my-2 border-b border-slate-100 dark:border-slate-800 mx-2"></div>
                 </div>
               )}

               {/* Notebooks Sortable */}
               <SortableContext items={notebooks.map(n => n.id)} strategy={verticalListSortingStrategy} disabled={!isDnDEnabled}>
                 <div>
                    <div className="flex items-center justify-between px-2 py-1 mb-1 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                       <span>Notebooks</span>
                       {selectedTag && (
                         <button onClick={() => setSelectedTag(null)} className="text-[10px] text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                            <X className="w-3 h-3" /> Clear Filter
                         </button>
                       )}
                    </div>

                    {notebookGroups.map(group => (
                      <div key={group.id} className="select-none">
                          <SortableNotebookTrigger 
                             notebook={group}
                             expanded={expandedNotebooks.has(group.id)}
                             onToggle={() => toggleNotebook(group.id)}
                             onCreateSpecial={(fmt, e) => createSpecialNote(group.id, fmt, e)}
                             onCreateNote={() => startCreateNote(group.id)}
                             onDelete={(e) => requestDeleteNotebook(group.id, group.name, e)}
                             onImport={(e) => { e.stopPropagation(); triggerImport(group.id); }}
                             noteCount={group.notes.length}
                             disabled={!isDnDEnabled}
                          />

                          {/* Notes List */}
                          {expandedNotebooks.has(group.id) && (
                            <div className="ml-2 mt-1 border-l border-slate-200 dark:border-slate-800 pl-1">
                              {creatingNoteInNotebookId === group.id && (
                                <div className="pl-3 py-1.5 pr-2 mb-1">
                                    <input
                                      ref={inputRef} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => handleInputKeyDown(e, 'note', group.id)} onBlur={() => !inputValue && cancelCreation()} placeholder="Note title..." className="w-full bg-transparent text-sm text-slate-700 dark:text-slate-200 border-b border-indigo-500 focus:outline-none placeholder:text-slate-400"
                                    />
                                </div>
                              )}
                              <SortableContext items={group.notes.map(n => n.id)} strategy={verticalListSortingStrategy} disabled={!isDnDEnabled}>
                                {group.notes.length === 0 && !creatingNoteInNotebookId ? (
                                  <div className="pl-4 py-2 text-xs text-slate-400 italic">Empty notebook</div>
                                ) : (
                                  <ul className="space-y-0.5">
                                    {group.notes.map(note => (
                                      <SortableNoteItem 
                                         key={note.id} 
                                         note={note} 
                                         isActive={activeNoteId === note.id} 
                                         onSelect={() => onSelectNote(note.id)} 
                                         onRequestDelete={(e) => requestDeleteNote(note.id, note.title, e)}
                                         disabled={!isDnDEnabled}
                                      />
                                    ))}
                                  </ul>
                                )}
                              </SortableContext>
                            </div>
                          )}
                      </div>
                    ))}
                 </div>
               </SortableContext>

               {/* New Notebook Input */}
               {isCreatingNotebook ? (
                  <div className="mt-2 px-2">
                     <input
                       ref={inputRef} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => handleInputKeyDown(e, 'notebook')} onBlur={() => !inputValue && cancelCreation()} placeholder="Notebook Name..." className="w-full bg-white dark:bg-slate-800 border border-indigo-500 rounded px-2 py-1.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
                     />
                  </div>
               ) : (
                  <button onClick={startCreateNotebook} className="w-full mt-2 flex items-center gap-2 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-md transition-colors border border-dashed border-slate-200 dark:border-slate-800">
                     <Plus className="w-4 h-4" /> New Notebook
                  </button>
               )}
            </div>
          )}
        </div>

        {/* User Auth Footer - NEW */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
           {user ? (
             <button onClick={() => setIsProfileModalOpen(true)} className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2 overflow-hidden">
                   <img 
                     src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=6366f1&color=fff&size=32`}
                     alt="Avatar"
                     className="w-6 h-6 rounded-full"
                     onError={(e) => {
                       e.currentTarget.style.display = 'none';
                       e.currentTarget.nextElementSibling?.classList.remove('hidden');
                     }}
                   />
                   <div className="hidden w-6 h-6 rounded-full bg-indigo-500 items-center justify-center">
                     <UserIcon className="w-3 h-3 text-white" />
                   </div>
                   <div className="flex flex-col items-start truncate">
                      <span className="text-xs font-semibold">{user.email?.split('@')[0]}</span>
                      <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                        <Cloud className="w-3 h-3" /> Sync Active
                      </span>
                   </div>
                </div>
                <LogOut className="w-4 h-4" />
             </button>
           ) : (
             <button onClick={() => setIsLoginModalOpen(true)} className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2">
                   <LogIn className="w-4 h-4" /> <span>Sync to Cloud</span>
                </div>
             </button>
           )}
        </div>

        {/* History Panel */}
        {showHistoryPanel && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
             <button onClick={() => setIsTimelineExpanded(!isTimelineExpanded)} className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2">
                   <History className="w-4 h-4" /> <span>History & Backups</span>
                </div>
                {isTimelineExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
             </button>

             {isTimelineExpanded && (
               <div className="max-h-48 overflow-y-auto px-2 pb-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                  {history.length === 0 ? <p className="p-3 text-xs text-slate-400 text-center italic">No history available for this note.</p> : (
                    <ul className="space-y-1 pt-2">
                      {history.map((entry) => (
                        <li key={entry.id}>
                          <button onClick={() => setSelectedHistory(entry)} className="w-full text-left px-3 py-2 rounded-md hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 group transition-all">
                             <div className="flex items-center justify-between mb-1">
                               <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{new Date(entry.timestamp).toLocaleDateString()}</span>
                               <span className="text-[10px] text-slate-400 font-mono">{new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                             </div>
                             <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 opacity-80 font-mono">{entry.content.startsWith('[') ? '[Drawing Data]' : (entry.content.substring(0, 50) || "(Empty)")}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
               </div>
             )}
          </div>
        )}

        {/* Theme & Settings */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
           <div className="flex items-center gap-1">
              <button onClick={onToggleTheme} className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors" title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}>
                 {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              <button onClick={onOpenSettings} className="flex-1 flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                 <Settings className="w-4 h-4" /> <span>Settings</span>
              </button>
           </div>
        </div>
      </div>
      
      {/* Hidden Import Input */}
      <input 
        type="file" 
        ref={importInputRef} 
        onChange={handleFileChange} 
        accept=".md,.txt" 
        className="hidden" 
      />
      
      {/* Modals */}
      <ConfirmModal isOpen={!!deleteState} onClose={() => setDeleteState(null)} onConfirm={handleConfirmDelete} title={deleteState?.type === 'notebook' ? 'Delete Notebook' : 'Delete Note'} message={deleteState ? (deleteState.type === 'notebook' ? `Are you sure you want to delete "${deleteState.name}"? All notes inside it will also be deleted. This action cannot be undone.` : `Are you sure you want to delete "${deleteState.name}"? This action cannot be undone.`) : ""} confirmText="Delete" isDangerous />
      <ConfirmModal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} onConfirm={handleLogout} title="Sign Out" message="Are you sure you want to sign out? Your local data will remain, but cloud sync will stop." confirmText="Sign Out" />
      <HistoryCompareModal isOpen={!!selectedHistory} onClose={() => setSelectedHistory(null)} historyEntry={selectedHistory} currentContent={currentContent} onRestore={onRestoreHistory} />
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={onLogin} />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} />
    </DndContext>
  );
};

// ... NoteItem ... (No changes needed)
const NoteItem: React.FC<NoteItemProps> = ({ note, isActive, onSelect, onRequestDelete, showPinIcon }) => {
  let Icon = FileText;
  if (note.format === 'txt') Icon = FilePlus;
  if (note.format === 'canvas') Icon = Palette;
  if (note.format === 'mindmap') Icon = Network;

  return (
    <button 
        onClick={onSelect}
        className={`group w-full text-left px-3 py-2 rounded-md flex items-start gap-2.5 transition-all relative ${
          isActive 
            ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700' 
            : 'hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'
        }`}
    >
        <div className={`mt-0.5 shrink-0 ${isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400'}`}>
           <Icon className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
             <span className={`text-sm font-medium truncate pr-6 ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
               {note.title || 'Untitled'}
             </span>
             {showPinIcon && <Pin className="w-3 h-3 text-amber-500 rotate-45 shrink-0" />}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 shrink-0">
               {new Date(note.updatedAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
            </span>
            {note.tags && note.tags.length > 0 && (
              <div className="flex gap-1 overflow-hidden">
                {note.tags.slice(0, 2).map(tag => (
                   <span key={tag} className={`inline-block w-1.5 h-1.5 rounded-full ${getTagColor(tag).split(' ')[0]}`}></span>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div role="button" onClick={onRequestDelete} className={`absolute right-2 top-2 p-1.5 rounded-md bg-white/80 dark:bg-slate-800/80 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all shadow-sm md:shadow-none ${isActive ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`} title="Delete Note">
          <Trash2 className="w-4 h-4" />
        </div>
    </button>
  );
};