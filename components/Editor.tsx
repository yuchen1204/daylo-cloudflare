import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { Note } from '../types';
import { 
  Download, 
  Eye, EyeOff, Star, AlignLeft, Columns, Tag, X, Maximize, Minimize, Network,
  File, Image, FileJson, Upload, Share2, Copy, Lock, ChevronRight
} from 'lucide-react';
import { downloadNote } from '../services/storage';
import { cloudSyncService } from '../services/cloudflare-sync';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SlashMenu, SLASH_COMMANDS, SlashCommand } from './SlashMenu';
import { getTagColor } from '../constants';
import { CanvasEditor, CanvasEditorRef } from './CanvasEditor';
import { MindMapEditor } from './MindMapEditor';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { MermaidBlock } from './MermaidBlock';
import { TaskListItem } from './TaskListItem';
import { WikiLink } from './WikiLink';
import { useWikiLinks } from '../hooks/useWikiLinks';
import { ReminderPicker } from './ReminderPicker';

// Final, optimized Code Block. This replaces the <pre> tag entirely.
const CodeBlock = ({ children }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // The child is the <code> element, we need to extract props from it
  const codeEl = React.Children.only(children) as React.ReactElement;
  const code = String(codeEl.props.children).replace(/\n$/, '');
  const className = codeEl.props.className || '';
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'txt';

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const fullScreenClasses = isFullScreen
    ? 'fixed inset-0 z-[100] m-0 rounded-none w-full h-full max-w-full'
    : 'relative my-4 rounded-xl';

  return (
    <div className={`${fullScreenClasses} overflow-hidden font-sans transition-all duration-300 ease-in-out`} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', boxShadow: 'var(--shadow-lg)' }}>
      {isFullScreen && <div className="fixed inset-0 bg-black/70 z-[-1] animate-in fade-in duration-200" onClick={() => setIsFullScreen(false)} />}
      {/* Window Header */}
      <div className="flex items-center h-9 px-3 backdrop-blur-sm" style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)' }}>
        <div className="flex items-center gap-2">
          <div onClick={handleCopy} className="w-8 h-8 bg-red-400 dark:bg-red-500 rounded-full flex items-center justify-center cursor-pointer group relative">
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-red-800 dark:text-red-900 opacity-0 group-hover:opacity-100 transition-opacity">
              {isCopied ? <path d="M20 6 9 17l-5-5"/> : <><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></>}
            </svg>
          </div>
          <div onClick={() => setIsCollapsed(!isCollapsed)} className="w-8 h-8 bg-yellow-400 dark:bg-yellow-500 rounded-full flex items-center justify-center cursor-pointer group relative">
             <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-800 dark:text-yellow-900 opacity-0 group-hover:opacity-100 transition-opacity">
              {isCollapsed ? <><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></> : <line x1="5" x2="19" y1="12" y2="12"/>}
            </svg>
          </div>
          <div onClick={() => setIsFullScreen(!isFullScreen)} className="w-8 h-8 bg-green-400 dark:bg-green-500 rounded-full flex items-center justify-center cursor-pointer group relative">
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-green-800 dark:text-green-900 opacity-0 group-hover:opacity-100 transition-opacity">
              {isFullScreen ? <><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></> : <><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2S0 0 1-2-2h-3"/></>}
            </svg>
          </div>
        </div>
        <div className="flex-1 text-right text-xs font-sans tracking-wide pr-2" style={{ color: 'var(--text-muted)' }}>{language}</div>
      </div>

      {!isCollapsed && (
        <div
        className={`${isFullScreen ? 'overflow-auto' : 'overflow-x-auto'} p-4 text-sm font-mono leading-6 whitespace-pre-wrap break-words`}
        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
          {codeEl}
        </div>
      )}
    </div>
  );
};


const OldCodeBlock = ({ node, inline, className, children, ...props }) => {
  return (
    <code className={`font-mono text-sm rounded-sm px-1 py-0.5 ${className}`} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} {...props}>
      {children}
    </code>
  );
};

const MermaidCodeBlock = ({ node, inline, className, children, ...props }) => {
  const match = /language-mermaid/.exec(className || '');
  if (match) {
    const code = String(children).replace(/\n$/, '');
    return <MermaidBlock code={code} />;
  }
  return (
    <code className={`font-mono text-sm rounded-sm px-1 py-0.5 ${className}`} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} {...props}>
      {children}
    </code>
  );
};

// WikiLink renderer for [[links]] in markdown
const WikiLinkRenderer = ({ children, allNotes, onNavigateToNote }: { children: React.ReactNode, allNotes: Note[], onNavigateToNote?: (noteId: string) => void }) => {
  const text = String(children);
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^\[\[([^\]]+)\]$/);
        if (match) {
          const title = match[1];
          const note = allNotes.find(n => n.title?.toLowerCase() === title.toLowerCase());
          return (
            <WikiLink
              key={index}
              title={title}
              note={note || null}
              onClick={(noteId) => onNavigateToNote?.(noteId)}
            />
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};


interface User {
  id: string;
  email: string;
}

interface EditorProps {
  note: Note;
  onUpdate: (updatedNote: Note) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  availableTags?: string[];
  user?: User | null;
  allNotes?: Note[];
  onNavigateToNote?: (noteId: string) => void;
}

export const Editor: React.FC<EditorProps> = ({ 
  note, 
  onUpdate, 
  isSidebarOpen, 
  onToggleSidebar,
  isFocusMode,
  onToggleFocusMode,
  availableTags = [],
  user,
  allNotes = [],
  onNavigateToNote
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState<string[]>(Array.isArray(note.tags) ? note.tags : []);
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);
  
  const [isPreview, setIsPreview] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  
  // Slash Menu State
  const [slashMenu, setSlashMenu] = useState<{
    isOpen: boolean;
    top: number;
    left: number;
    filter: string;
    selectedIndex: number;
    startIndex: number; // Index where '/' was typed
  }>({
    isOpen: false, top: 0, left: 0, filter: '', selectedIndex: 0, startIndex: -1
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<CanvasEditorRef>(null);
  
  const isCanvas = note.format === 'canvas';
  const isMindMap = note.format === 'mindmap';
  const isVisualEditor = isCanvas || isMindMap;

  // Filter available tags based on input
  const tagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return [];
    return availableTags.filter(t => 
      t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t)
    ).slice(0, 5); // Limit to 5 suggestions
  }, [tagInput, availableTags, tags]);

  // Auto-resize textarea logic
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Sync local state when note changes
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setTags(Array.isArray(note.tags) ? note.tags : []);
    setIsPreview(false);
    setIsSplitView(false); // Reset split view on note change
    setSlashMenu(prev => ({ ...prev, isOpen: false }));
    setTagInput("");
    setIsFileMenuOpen(false);
    setIsShareMenuOpen(false);
    setIsToolbarExpanded(false);
    // Reset height after state update
    if (!isVisualEditor) {
      setTimeout(adjustTextareaHeight, 0);
    }
  }, [note.id]);

  // Close secondary toolbar when entering focus mode
  useEffect(() => {
    if (isFocusMode) setIsToolbarExpanded(false);
  }, [isFocusMode]);

  // Close More dropdown when clicking outside
  useEffect(() => {
    if (!isToolbarExpanded) return;
    const handleClick = () => setIsToolbarExpanded(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isToolbarExpanded]);

  // Adjust height on content change
  useLayoutEffect(() => {
    if (!isVisualEditor) {
      adjustTextareaHeight();
    }
  }, [content, isPreview, isSplitView, isVisualEditor]);

  // Debounced update to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title !== note.title || content !== note.content || JSON.stringify(tags) !== JSON.stringify(note.tags)) {
        onUpdate({
          ...note,
          title,
          content,
          tags,
          updatedAt: Date.now()
        });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [title, content, tags, note, onUpdate]);

  const togglePin = () => {
    onUpdate({
      ...note,
      isPinned: !note.isPinned,
      updatedAt: Date.now()
    });
  };

  // Reminder handlers
  const handleSetReminder = (date: string) => {
    onUpdate({
      ...note,
      reminder: {
        date,
        completed: false,
        createdAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
  };

  const handleClearReminder = () => {
    onUpdate({
      ...note,
      reminder: undefined,
      updatedAt: Date.now(),
    });
  };

  const handleCompleteReminder = () => {
    onUpdate({
      ...note,
      reminder: note.reminder ? {
        ...note.reminder,
        completed: true,
      } : undefined,
      updatedAt: Date.now(),
    });
  };

  const handleDownload = () => {
    downloadNote({ ...note, title, content, tags });
  };

  const getShareUrl = () => {
    const linkId = note.accessInfo?.publicLinkId;
    if (!linkId) return "";
    return `${window.location.origin}/share/${linkId}`;
  };

  const handleShareToggle = async () => {
    if (!user) {
      alert("Please sign in to share notes.");
      return;
    }
    
    const isCurrentlyShared = note.accessInfo?.isPublic || false;
    const newStatus = !isCurrentlyShared;
    
    try {
        const linkId = await cloudSyncService.shareNote(note, newStatus);
        
        onUpdate({
          ...note,
          accessInfo: {
              isPublic: newStatus,
              sharedWithCount: note.accessInfo?.sharedWithCount || 0,
              publicLinkId: linkId || undefined
          },
          updatedAt: Date.now()
        });
        
        if (newStatus && linkId) {
            // Re-calculate URL with the new Link ID
            const url = `${window.location.origin}/share/${linkId}`;
            navigator.clipboard.writeText(url);
            setShowCopyFeedback(true);
            setTimeout(() => setShowCopyFeedback(false), 2000);
        }
    } catch (error) {
        console.error("Failed to toggle share:", error);
        alert("Failed to update share settings.");
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(getShareUrl());
    setShowCopyFeedback(true);
    setTimeout(() => setShowCopyFeedback(false), 2000);
    setIsShareMenuOpen(false);
  };

  const addTag = (newTag: string) => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
      setShowTagSuggestions(false);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showTagSuggestions && tagSuggestions.length > 0) {
        addTag(tagSuggestions[selectedTagIndex]);
      } else {
        addTag(tagInput);
      }
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      // Remove last tag if input is empty
      setTags(tags.slice(0, -1));
    } else if (e.key === 'ArrowDown' && showTagSuggestions) {
      e.preventDefault();
      setSelectedTagIndex(prev => (prev + 1) % tagSuggestions.length);
    } else if (e.key === 'ArrowUp' && showTagSuggestions) {
      e.preventDefault();
      setSelectedTagIndex(prev => (prev - 1 + tagSuggestions.length) % tagSuggestions.length);
    } else if (e.key === 'Escape') {
      setShowTagSuggestions(false);
    }
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
    setShowTagSuggestions(true);
    setSelectedTagIndex(0);
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    if (isVisualEditor) return { wordCount: 0, charCount: 0, readingTime: 0 };
    
    const text = content || "";
    const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    const charCount = text.length;
    // Avg reading speed ~200 words/min
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    return { wordCount, charCount, readingTime };
  }, [content, isVisualEditor]);

  // --- Slash Command Logic (Text Only) ---
  const getCaretCoordinates = () => {
    if (!textareaRef.current) return { top: 0, left: 0 };
    const element = textareaRef.current;
    const { selectionStart } = element;
    const div = document.createElement('div');
    const style = window.getComputedStyle(element);
    Array.from(style).forEach(prop => {
        if (!['width', 'height', 'position', 'left', 'top'].includes(prop)) {
             div.style.setProperty(prop, style.getPropertyValue(prop), style.getPropertyPriority(prop));
        }
    });
    div.style.position = 'fixed';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.width = style.width;
    div.style.padding = style.padding;
    div.style.border = style.border;
    div.style.overflow = 'hidden';
    div.textContent = element.value.substring(0, selectionStart);
    const span = document.createElement('span');
    span.textContent = '.';
    div.appendChild(span);
    document.body.appendChild(div);
    const rect = element.getBoundingClientRect();
    const top = rect.top + span.offsetTop - element.scrollTop;
    const left = rect.left + span.offsetLeft;
    document.body.removeChild(div);
    return { 
        top: top + parseFloat(style.lineHeight || '24'), 
        left: Math.min(left, window.innerWidth - 300) 
    };
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenu.isOpen) {
      const filtered = SLASH_COMMANDS.filter(c => 
        c.label.toLowerCase().includes(slashMenu.filter.toLowerCase()) || 
        c.syntax.includes(slashMenu.filter)
      );

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashMenu(prev => ({ ...prev, selectedIndex: (prev.selectedIndex + 1) % filtered.length }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashMenu(prev => ({ ...prev, selectedIndex: (prev.selectedIndex - 1 + filtered.length) % filtered.length }));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filtered[slashMenu.selectedIndex]) applySlashCommand(filtered[slashMenu.selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenu(prev => ({ ...prev, isOpen: false }));
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setContent(newVal);
    const cursorPos = e.target.selectionStart;
    
    if (slashMenu.isOpen) {
        const filterText = newVal.substring(slashMenu.startIndex + 1, cursorPos);
        if (cursorPos <= slashMenu.startIndex || filterText.includes(' ')) {
            setSlashMenu(prev => ({ ...prev, isOpen: false }));
        } else {
            setSlashMenu(prev => ({ ...prev, filter: filterText, selectedIndex: 0 }));
        }
    } else {
        const charBefore = newVal[cursorPos - 1];
        if (charBefore === '/' && (cursorPos === 1 || /\s/.test(newVal[cursorPos - 2]))) {
            setTimeout(() => {
                const coords = getCaretCoordinates();
                setSlashMenu({
                    isOpen: true, top: coords.top, left: coords.left, filter: '', selectedIndex: 0, startIndex: cursorPos - 1
                });
            }, 10);
        }
    }
  };

  const applySlashCommand = (cmd: SlashCommand) => {
    if (!textareaRef.current) return;
    const before = content.substring(0, slashMenu.startIndex);
    const after = content.substring(textareaRef.current.selectionStart);
    const newContent = before + cmd.syntax + after;
    setContent(newContent);
    setSlashMenu(prev => ({ ...prev, isOpen: false }));
    setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            const newCursorPos = before.length + cmd.syntax.length - (cmd.offset || 0);
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            adjustTextareaHeight();
        }
    }, 0);
  };

  const isMarkdown = note.format === 'markdown' || !note.format;
  const toggleSplitView = () => { setIsSplitView(!isSplitView); if (!isSplitView) setIsPreview(false); };

  // Detect theme
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
    // Observer for class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
           if (document.documentElement.classList.contains('dark')) {
             setTheme('dark');
           } else {
             setTheme('light');
           }
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const formatLabel = () => {
    if (isCanvas) return 'CANVAS';
    if (isMindMap) return 'MINDMAP';
    if (isMarkdown) return 'MD';
    return 'TXT';
  };
  
  const formatColorClass = () => {
    if (isCanvas) return 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
    if (isMindMap) return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (isMarkdown) return 'bg-[var(--interactive-active)]';
                     return 'bg-[var(--interactive-active)]';
  };

  return (
    <div className="flex-1 flex flex-col h-full relative transition-colors" style={{ background: 'var(--bg-primary)' }}>
            {/* Top Bar */}
      <div className="border-b sticky top-0 z-20 transition-all" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
        {/* Primary Toolbar Row */}
        <div className={`h-14 flex items-center justify-between px-4 md:px-6 ${isFocusMode ? 'shadow-sm opacity-80 hover:opacity-100' : ''}`}>
          <div className="flex items-center gap-2 md:gap-4">
              {!isFocusMode && (
                 <button onClick={onToggleSidebar} className="md:hidden p-1.5 rounded-md hover:bg-[var(--interactive-hover)] transition-colors" style={{ color: 'var(--text-muted)' }}>
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                 </button>
              )}
               <button onClick={onToggleFocusMode} className={`p-2 rounded-md transition-all ${isFocusMode ? 'bg-[var(--interactive-active)]' : 'hover:bg-[var(--interactive-hover)]'}`} style={{ color: isFocusMode ? 'var(--text-primary)' : 'var(--text-muted)' }} title={isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}>
                 {isFocusMode ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
              <div className="flex items-center gap-2">
                 {!isFocusMode && <div className="text-xs font-mono hidden sm:block" style={{ color: 'var(--text-muted)' }}>Last edited: {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                 <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ${formatColorClass()}`}>
                   {formatLabel()}
                 </span>
              </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
              {/* Canvas File Menu - always visible */}
              {isCanvas && (
               <div className="relative">
                  <button 
                     onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
                     className={`p-2 rounded-md transition-all ${isFileMenuOpen ? 'bg-[var(--interactive-active)]' : 'hover:bg-[var(--interactive-hover)]'}`}
                     style={{ color: isFileMenuOpen ? 'var(--text-primary)' : 'var(--text-muted)' }}
                     title="Canvas Options"
                  >
                     <File className="w-4 h-4" />
                  </button>
                  {isFileMenuOpen && (
                     <div 
                       className="absolute top-full right-0 mt-2 z-[60] shadow-xl rounded-lg p-1 w-48 animate-in fade-in zoom-in-95 duration-100"
                       style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                       onPointerDown={(e) => e.stopPropagation()}
                     >
                        <button 
                          onClick={() => { canvasRef.current?.exportPNG(); setIsFileMenuOpen(false); }} 
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors text-left hover:bg-[var(--interactive-hover)]"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                           <Image className="w-4 h-4" /> Export as PNG
                        </button>
                        <button 
                          onClick={() => { canvasRef.current?.exportJSON(); setIsFileMenuOpen(false); }} 
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors text-left hover:bg-[var(--interactive-hover)]"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                           <FileJson className="w-4 h-4" /> Export as JSON
                        </button>
                        <div className="h-px my-1" style={{ background: 'var(--border-subtle)' }} />
                        <button 
                          onClick={() => { canvasRef.current?.importJSON(); setIsFileMenuOpen(false); }} 
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors text-left hover:bg-[var(--interactive-hover)]"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                           <Upload className="w-4 h-4" /> Import JSON
                        </button>
                     </div>
                  )}
               </div>
              )}

              {/* Non-canvas: View controls + More button */}
              {!isCanvas && (
                <>
                   <div className="flex p-1 rounded-lg transition-colors"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                     {isMarkdown && (
                       <>
                          <button onClick={toggleSplitView} className={`p-2 rounded-md transition-all hidden sm:block ${isSplitView ? 'bg-[var(--interactive-active)]' : 'hover:bg-[var(--interactive-hover)]'}`} style={{ color: isSplitView ? 'var(--text-primary)' : 'var(--text-muted)' }} title="Split View"><Columns className="w-4 h-4" /></button>
                          <button onClick={() => !isSplitView && setIsPreview(!isPreview)} className={`p-2 rounded-md transition-all ${isPreview && !isSplitView ? 'bg-[var(--interactive-active)]' : 'hover:bg-[var(--interactive-hover)]'} ${isSplitView ? 'opacity-50 cursor-not-allowed' : ''}`} style={{ color: isPreview && !isSplitView ? 'var(--text-primary)' : 'var(--text-muted)' }} title={isPreview ? "Switch to Edit" : "Switch to Preview"} disabled={isSplitView}>{isPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                       </>
                     )}
                     <button onClick={handleDownload} className="p-2 hover:bg-[var(--interactive-hover)] rounded-md transition-all" style={{ color: 'var(--text-muted)' }} title="Export"><Download className="w-4 h-4" /></button>
                   </div>

                    {/* Rotating circular button + vertical capsule bar */}
                    <div
                      className="relative"
                      style={{ width: '36px', height: '36px' }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Unified capsule container */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '36px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: isToolbarExpanded ? '18px 18px 18px 18px' : '50%',
                          boxShadow: isToolbarExpanded ? 'var(--shadow-lg)' : 'none',
                          transition: 'all 300ms ease-out',
                          overflow: 'hidden',
                        }}
                      >
                        <button
                          onClick={() => setIsToolbarExpanded(!isToolbarExpanded)}
                          className="w-9 h-9 flex items-center justify-center transition-all duration-300 hover:bg-[var(--interactive-hover)]"
                          style={{
                            color: isToolbarExpanded ? 'var(--text-primary)' : 'var(--text-muted)',
                            background: 'transparent',
                            border: 'none',
                          }}
                          title="More Actions"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>

                        {/* Vertical capsule bar content */}
                        <div
                          className="flex flex-col items-center overflow-hidden transition-all duration-300 ease-out"
                          style={{
                            maxHeight: isToolbarExpanded ? '140px' : '0px',
                            opacity: isToolbarExpanded ? 1 : 0,
                          }}
                        >
                          <div className="flex flex-col items-center pb-2 gap-1">
                           {/* Share */}
                           <button
                             onClick={() => {
                               if (!user) {
                                 alert("Please sign in to share notes.");
                                 setIsToolbarExpanded(false);
                                 return;
                               }
                               setIsToolbarExpanded(false);
                               note.accessInfo?.isPublic ? setIsShareMenuOpen(!isShareMenuOpen) : handleShareToggle();
                             }}
                             className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-[var(--interactive-hover)] ${
                               note.accessInfo?.isPublic ? 'text-[var(--text-primary)]' : ''
                             }`}
                             style={{ color: note.accessInfo?.isPublic ? undefined : 'var(--text-secondary)' }}
                             title="Share"
                           >
                             <Share2 className={`w-4 h-4 ${note.accessInfo?.isPublic ? "fill-current" : ""}`} />
                           </button>

                           {/* Pin */}
                           <button
                             onClick={() => { togglePin(); setIsToolbarExpanded(false); }}
                             className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-[var(--interactive-hover)]"
                             style={{ color: note.isPinned ? '#f59e0b' : 'var(--text-secondary)' }}
                             title={note.isPinned ? "Unpin" : "Pin"}
                           >
                             <Star className={`w-4 h-4 ${note.isPinned ? "fill-amber-500" : ""}`} />
                           </button>

                           {/* Reminder */}
                           <div className="flex items-center justify-center" onClick={() => setIsToolbarExpanded(false)}>
                             <ReminderPicker
                               reminder={note.reminder}
                               onSet={handleSetReminder}
                               onClear={handleClearReminder}
                               onComplete={handleCompleteReminder}
                             />
                           </div>
                        </div>
                      </div>
                      </div>
                    </div>
                </>
              )}
          </div>
       </div>

       </div>

      {/* Editor Area */}
      {isVisualEditor ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-none px-6 py-4 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
            {/* Visual Header (Title + Tags) */}
             <div className="max-w-4xl">
               <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`${isCanvas ? 'Canvas' : 'MindMap'} Title`}
                   className="w-full text-2xl font-bold placeholder:border-none outline-none bg-transparent transition-colors mb-2"
                   style={{ color: 'var(--text-primary)' }}
                />
               
               {/* Minimal Tags */}
               <div className="flex flex-wrap items-center gap-2">
                  {tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border group"
                          style={{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text, borderColor: getTagColor(tag).border }}>
                      #{tag}
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                        className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  
                   <div className="relative">
                     <input 
                       type="text"
                       value={tagInput}
                       onChange={handleTagInputChange}
                       onKeyDown={handleTagInputKeyDown}
                       onFocus={() => setShowTagSuggestions(true)}
                       onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                       placeholder={tags.length === 0 ? "Add tag..." : ""}
                        className="bg-transparent text-sm placeholder:text-[var(--text-muted)] outline-none min-w-[60px]"
                        style={{ color: 'var(--text-secondary)' }}
                     />
                      {showTagSuggestions && tagSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 mt-1 w-48 rounded-md shadow-lg z-50 overflow-hidden"
                             style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                            {tagSuggestions.map((suggestion, idx) => (
                              <button
                                key={suggestion}
                                onClick={() => addTag(suggestion)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                                  idx === selectedTagIndex 
                                    ? 'bg-[var(--interactive-active)]' 
                                    : 'hover:bg-[var(--interactive-hover)]'
                                }`}
                                style={{ color: idx === selectedTagIndex ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                              >
                                 <span>#{suggestion}</span>
                                 {idx === selectedTagIndex && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Enter</span>}
                              </button>
                            ))}
                        </div>
                      )}
                   </div>
               </div>
             </div>
          </div>
           <div className="flex-1 relative" style={{ background: 'var(--bg-secondary)' }}>
             {isCanvas ? (
               <CanvasEditor ref={canvasRef} content={content} onChange={setContent} theme={theme} />
             ) : (
               <MindMapEditor content={content} onChange={setContent} theme={theme} />
             )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto relative" onClick={() => textareaRef.current?.focus()}>
          <div className={`py-6 sm:py-10 px-4 sm:px-8 min-h-full pb-20 ${isSplitView ? 'max-w-full' : 'max-w-3xl'}`}>

             <div 
               className="max-w-3xl mb-6"
               onClick={(e) => e.stopPropagation()}
             >
               {/* Title Input */}
               <input
                 type="text"
                 value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="Note Title"
                    className="w-full text-2xl sm:text-3xl md:text-4xl font-bold placeholder:border-none outline-none bg-transparent transition-colors"
                   style={{ color: 'var(--text-primary)' }}
               />
               
               {/* Tags Input */}
               <div className="relative flex flex-wrap items-center gap-2 mt-3">
                   <Tag className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  {tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border group"
                          style={{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text, borderColor: getTagColor(tag).border }}>
                      #{tag}
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                        className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  
                  <div className="relative">
                    <input 
                      type="text"
                      value={tagInput}
                      onChange={handleTagInputChange}
                      onKeyDown={handleTagInputKeyDown}
                      onFocus={() => setShowTagSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                      placeholder={tags.length === 0 ? "Add tag..." : ""}
                      className="bg-transparent text-sm placeholder:text-[var(--text-muted)] outline-none min-w-[60px]"
                      style={{ color: 'var(--text-secondary)' }}
                      autoComplete="off"
                    />
                    
                    {/* Tag Suggestions Dropdown */}
                    {showTagSuggestions && tagSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 w-48 rounded-md shadow-lg z-50 overflow-hidden"
                           style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                         {tagSuggestions.map((suggestion, idx) => (
                           <button
                             key={suggestion}
                             onClick={() => addTag(suggestion)}
                             className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                               idx === selectedTagIndex 
                                 ? 'bg-[var(--interactive-active)]' 
                                 : 'hover:bg-[var(--interactive-hover)]'
                             }`}
                             style={{ color: idx === selectedTagIndex ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                           >
                              <span>#{suggestion}</span>
                              {idx === selectedTagIndex && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Enter</span>}
                           </button>
                         ))}
                      </div>
                    )}
                  </div>
               </div>
             </div>
             
             {isSplitView && isMarkdown ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 h-full">
                  <div className="relative border-r pr-4" style={{ borderColor: 'var(--border-subtle)' }}>
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Start writing..."
                       className="w-full min-h-[50vh] overflow-hidden resize-none text-base sm:text-lg leading-relaxed border-none outline-none bg-transparent font-mono transition-colors"
                      style={{ color: 'var(--text-primary)', caretColor: 'var(--text-primary)' }}
                      spellCheck={false}
                    />
                   <SlashMenu isOpen={slashMenu.isOpen} position={{ top: slashMenu.top, left: slashMenu.left }} filter={slashMenu.filter} selectedIndex={slashMenu.selectedIndex} onSelect={applySlashCommand} onClose={() => setSlashMenu(prev => ({ ...prev, isOpen: false }))} />
                 </div>
                   <div className="markdown-preview prose dark:prose-invert prose-lg text-base sm:text-lg leading-relaxed h-full overflow-y-auto">
                   {content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      pre: CodeBlock,
                      code: MermaidCodeBlock,
                      p: ({ children }) => (
                        <WikiLinkRenderer allNotes={allNotes} onNavigateToNote={onNavigateToNote}>
                          {children}
                        </WikiLinkRenderer>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                ) : (
                   <span className="italic" style={{ color: 'var(--text-muted)' }}>Preview...</span>
                )}
                 </div>
               </div>
             ) : isPreview && isMarkdown ? (
                <div className="max-w-3xl markdown-preview prose dark:prose-invert prose-lg text-base sm:text-lg leading-relaxed min-h-[50vh]">
                 {content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    pre: CodeBlock,
                    code: MermaidCodeBlock,
                    p: ({ children }) => (
                      <WikiLinkRenderer allNotes={allNotes} onNavigateToNote={onNavigateToNote}>
                        {children}
                      </WikiLinkRenderer>
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              ) : (
                <span className="italic" style={{ color: 'var(--text-muted)' }}>No content to preview</span>
              )}
               </div>
             ) : (
               <div className="relative max-w-3xl">
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={isMarkdown ? "Start writing or type '/' for commands..." : "Start writing..."}
                    className="w-full min-h-[50vh] overflow-hidden resize-none text-base sm:text-lg leading-relaxed border-none outline-none bg-transparent font-mono transition-colors"
                    style={{ color: 'var(--text-primary)', caretColor: 'var(--text-primary)' }}
                    spellCheck={false}
                  />
                 <SlashMenu isOpen={slashMenu.isOpen} position={{ top: slashMenu.top, left: slashMenu.left }} filter={slashMenu.filter} selectedIndex={slashMenu.selectedIndex} onSelect={applySlashCommand} onClose={() => setSlashMenu(prev => ({ ...prev, isOpen: false }))} />
               </div>
             )}
             
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="h-8 flex items-center justify-end px-4 gap-4 text-[10px] font-mono select-none" style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          {!isVisualEditor && (
            <>
              <div className="flex items-center gap-1.5"><AlignLeft className="w-3 h-3" /><span>{stats.wordCount} words</span></div>
              <div className="w-px h-3" style={{ background: 'var(--border-primary)' }}></div>
              <div><span>{stats.charCount} chars</span></div>
              <div className="w-px h-3" style={{ background: 'var(--border-primary)' }}></div>
              <div><span>{stats.readingTime} min read</span></div>
            </>
          )}
          {isCanvas && (
             <div className="flex items-center gap-1.5">
               <span>Canvas Mode</span>
             </div>
          )}
          {isMindMap && (
             <div className="flex items-center gap-1.5">
               <span>MindMap Mode</span>
             </div>
          )}
      </div>
    </div>
  );
};
