import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { Note } from '../types';
import { 
  Download, 
  Eye, EyeOff, Star, AlignLeft, Columns, Tag, X, Maximize, Minimize, Network,
  File, Image, FileJson, Upload, Share2, Copy, Lock
} from 'lucide-react';
import { downloadNote } from '../services/storage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SlashMenu, SLASH_COMMANDS, SlashCommand } from './SlashMenu';
import { getTagColor } from '../constants';
import { CanvasEditor, CanvasEditorRef } from './CanvasEditor';
import { MindMapEditor } from './MindMapEditor';

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
    <div className={`${fullScreenClasses} shadow-lg dark:shadow-2xl bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-gray-700/50 overflow-hidden font-sans transition-all duration-300 ease-in-out`}>
      {isFullScreen && <div className="fixed inset-0 bg-black/70 z-[-1] animate-in fade-in duration-200" onClick={() => setIsFullScreen(false)} />}
      {/* Window Header */}
      <div className="flex items-center h-9 px-3 bg-slate-100/70 dark:bg-gray-800/50 backdrop-blur-sm border-b border-slate-200 dark:border-gray-700/50">
        <div className="flex items-center gap-2">
          <div onClick={handleCopy} className="w-3.5 h-3.5 bg-red-400 dark:bg-red-500 rounded-full flex items-center justify-center cursor-pointer group">
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-red-800 dark:text-red-900 opacity-0 group-hover:opacity-100 transition-opacity">
              {isCopied ? <path d="M20 6 9 17l-5-5"/> : <><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></>}
            </svg>
          </div>
          <div onClick={() => setIsCollapsed(!isCollapsed)} className="w-3.5 h-3.5 bg-yellow-400 dark:bg-yellow-500 rounded-full flex items-center justify-center cursor-pointer group">
             <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-800 dark:text-yellow-900 opacity-0 group-hover:opacity-100 transition-opacity">
              {isCollapsed ? <><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></> : <line x1="5" x2="19" y1="12" y2="12"/>}
            </svg>
          </div>
          <div onClick={() => setIsFullScreen(!isFullScreen)} className="w-3.5 h-3.5 bg-green-400 dark:bg-green-500 rounded-full flex items-center justify-center cursor-pointer group">
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-green-800 dark:text-green-900 opacity-0 group-hover:opacity-100 transition-opacity">
              {isFullScreen ? <><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></> : <><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2S0 0 1-2-2h-3"/></>}
            </svg>
          </div>
        </div>
        <div className="flex-1 text-right text-xs text-slate-500 dark:text-gray-400 font-sans tracking-wide pr-2">{language}</div>
      </div>

      {!isCollapsed && (
        <div
        className={`${isFullScreen ? 'overflow-auto' : 'overflow-x-auto'} p-4 text-sm font-mono bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-slate-200 leading-6 whitespace-pre-wrap break-words`}
      >
          {codeEl}
        </div>
      )}
    </div>
  );
};


const OldCodeBlock = ({ node, inline, className, children, ...props }) => {
  return (
    <code className={`font-mono text-sm bg-slate-200 dark:bg-slate-700 rounded-sm px-1 py-0.5 ${className}`} {...props}>
      {children}
    </code>
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
}

export const Editor: React.FC<EditorProps> = ({ 
  note, 
  onUpdate, 
  isSidebarOpen, 
  onToggleSidebar,
  isFocusMode,
  onToggleFocusMode,
  availableTags = [],
  user
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState<string[]>(note.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);
  
  const [isPreview, setIsPreview] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  
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
    setTags(note.tags || []);
    setIsPreview(false);
    setIsSplitView(false); // Reset split view on note change
    setSlashMenu(prev => ({ ...prev, isOpen: false }));
    setTagInput("");
    setIsFileMenuOpen(false);
    setIsShareMenuOpen(false);
    // Reset height after state update
    if (!isVisualEditor) {
      setTimeout(adjustTextareaHeight, 0);
    }
  }, [note.id]);

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
        const linkId = await syncService.shareNote(user, note, newStatus);
        
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
    if (isMarkdown) return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400';
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  };

  return (
    <div className="flex-1 flex flex-col h-full relative bg-white dark:bg-slate-950 transition-colors">
            {/* Top Bar */}
      <div className={`h-16 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 bg-white dark:bg-slate-950 sticky top-0 z-20 transition-all ${isFocusMode ? 'shadow-sm opacity-80 hover:opacity-100' : ''}`}>
         <div className="flex items-center gap-4">
             {!isFocusMode && (
               <button onClick={onToggleSidebar} className="md:hidden text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
               </button>
             )}
             <button onClick={onToggleFocusMode} className={`p-2 rounded-md transition-all ${isFocusMode ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`} title={isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}>
                {isFocusMode ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
             </button>
             <div className="flex flex-col">
               <div className="flex items-center gap-2">
                 {!isFocusMode && <div className="text-xs text-slate-400 font-mono hidden sm:block">Last edited: {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                 <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ${formatColorClass()}`}>
                   {formatLabel()}
                 </span>
               </div>
             </div>
         </div>
         <div className="flex items-center gap-3">
             
             {/* Share Button */}
             <div className="relative">
                <button 
                  onClick={() => {
                    if (!user) {
                      alert("Please sign in to share notes.");
                      return;
                    }
                    note.accessInfo?.isPublic ? setIsShareMenuOpen(!isShareMenuOpen) : handleShareToggle();
                  }}
                  className={`p-2 rounded-md transition-all ${
                    !user 
                      ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' 
                      : note.accessInfo?.isPublic 
                        ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400' 
                        : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  title={!user ? "Sign in to Share" : "Share Note"}
                >
                  <Share2 className={`w-4 h-4 ${note.accessInfo?.isPublic ? "fill-current" : ""}`} />
                </button>
                
                {/* Share Menu */}
                {isShareMenuOpen && note.accessInfo?.isPublic && (
                   <div 
                     className="absolute top-full right-0 mt-2 z-[60] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg p-1 w-56 animate-in fade-in zoom-in-95 duration-100"
                     onPointerDown={(e) => e.stopPropagation()}
                   >
                      <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                         <span className="font-medium text-indigo-600 dark:text-indigo-400">Public Link Active</span>
                      </div>
                      <button 
                        onClick={copyShareLink} 
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-left"
                      >
                         <Copy className="w-4 h-4" /> {showCopyFeedback ? "Copied!" : "Copy Link"}
                      </button>
                      <button 
                        onClick={() => { handleShareToggle(); setIsShareMenuOpen(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors text-left"
                      >
                         <Lock className="w-4 h-4" /> Make Private
                      </button>
                   </div>
                )}
             </div>

             <button onClick={togglePin} className={`p-2 rounded-md transition-all ${note.isPinned ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`} title={note.isPinned ? "Unpin Note" : "Pin Note"}>
               <Star className={`w-4 h-4 ${note.isPinned ? "fill-amber-500" : ""}`} />
             </button>
             
             {/* NEW CANVAS FILE MENU */}
             {isCanvas && (
              <div className="relative">
                 <button 
                    onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
                    className={`p-2 rounded-md transition-all ${isFileMenuOpen ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    title="Canvas Options"
                 >
                    <File className="w-4 h-4" />
                 </button>
                 {isFileMenuOpen && (
                    <div 
                      className="absolute top-full right-0 mt-2 z-[60] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg p-1 w-48 animate-in fade-in zoom-in-95 duration-100"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                       <button 
                         onClick={() => { canvasRef.current?.exportPNG(); setIsFileMenuOpen(false); }} 
                         className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-left"
                       >
                          <Image className="w-4 h-4" /> Export as PNG
                       </button>
                       <button 
                         onClick={() => { canvasRef.current?.exportJSON(); setIsFileMenuOpen(false); }} 
                         className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-left"
                       >
                          <FileJson className="w-4 h-4" /> Export as JSON
                       </button>
                       <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                       <button 
                         onClick={() => { canvasRef.current?.importJSON(); setIsFileMenuOpen(false); }} 
                         className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-left"
                       >
                          <Upload className="w-4 h-4" /> Import JSON
                       </button>
                    </div>
                 )}
              </div>
             )}

             {!isCanvas && (
               <>
                 <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                 <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-100 dark:border-slate-800 transition-colors">
                   {isMarkdown && (
                     <>
                       <button onClick={toggleSplitView} className={`p-2 rounded-md transition-all hidden sm:block ${isSplitView ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800'}`} title="Split View"><Columns className="w-4 h-4" /></button>
                       <button onClick={() => !isSplitView && setIsPreview(!isPreview)} className={`p-2 rounded-md transition-all ${isPreview && !isSplitView ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800'} ${isSplitView ? 'opacity-50 cursor-not-allowed' : ''}`} title={isPreview ? "Switch to Edit" : "Switch to Preview"} disabled={isSplitView}>{isPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                     </>
                   )}
                   <button onClick={handleDownload} className="p-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-all" title="Export"><Download className="w-4 h-4" /></button>
                 </div>
               </>
             )}
         </div>
      </div>

      {/* Editor Area */}
      {isVisualEditor ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-none px-6 py-4 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
            {/* Visual Header (Title + Tags) */}
             <div className="max-w-4xl mx-auto">
               <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`${isCanvas ? 'Canvas' : 'MindMap'} Title`}
                  className="w-full text-2xl font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 border-none outline-none bg-transparent transition-colors mb-2"
                />
               
               {/* Minimal Tags */}
               <div className="flex flex-wrap items-center gap-2">
                  {tags.map(tag => (
                    <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${getTagColor(tag)} group`}>
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
                       className="bg-transparent text-sm text-slate-600 dark:text-slate-300 placeholder:text-slate-400 outline-none min-w-[60px]"
                     />
                      {showTagSuggestions && tagSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-900 rounded-md shadow-lg border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
                           {tagSuggestions.map((suggestion, idx) => (
                             <button
                               key={suggestion}
                               onClick={() => addTag(suggestion)}
                               className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                                 idx === selectedTagIndex 
                                   ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' 
                                   : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                               }`}
                             >
                                <span>#{suggestion}</span>
                                {idx === selectedTagIndex && <span className="text-[10px] text-indigo-400">Enter</span>}
                             </button>
                           ))}
                        </div>
                      )}
                   </div>
               </div>
             </div>
          </div>
          <div className="flex-1 bg-slate-100 dark:bg-slate-900 relative">
             {isCanvas ? (
               <CanvasEditor ref={canvasRef} content={content} onChange={setContent} theme={theme} />
             ) : (
               <MindMapEditor content={content} onChange={setContent} theme={theme} />
             )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto relative" onClick={() => textareaRef.current?.focus()}>
          <div className={`mx-auto py-10 px-8 min-h-full pb-20 ${isSplitView ? 'max-w-full' : 'max-w-3xl'}`}>

             <div 
               className="max-w-3xl mx-auto mb-6"
               onClick={(e) => e.stopPropagation()}
             >
               {/* Title Input */}
               <input
                 type="text"
                 value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="Note Title"
                 className="w-full text-4xl font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 border-none outline-none bg-transparent transition-colors"
               />
               
               {/* Tags Input */}
               <div className="relative flex flex-wrap items-center gap-2 mt-3">
                  <Tag className="w-4 h-4 text-slate-400" />
                  {tags.map(tag => (
                    <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${getTagColor(tag)} group`}>
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
                      className="bg-transparent text-sm text-slate-600 dark:text-slate-300 placeholder:text-slate-400 outline-none min-w-[60px]"
                      autoComplete="off"
                    />
                    
                    {/* Tag Suggestions Dropdown */}
                    {showTagSuggestions && tagSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-900 rounded-md shadow-lg border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
                         {tagSuggestions.map((suggestion, idx) => (
                           <button
                             key={suggestion}
                             onClick={() => addTag(suggestion)}
                             className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                               idx === selectedTagIndex 
                                 ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' 
                                 : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                             }`}
                           >
                              <span>#{suggestion}</span>
                              {idx === selectedTagIndex && <span className="text-[10px] text-indigo-400">Enter</span>}
                           </button>
                         ))}
                      </div>
                    )}
                  </div>
               </div>
             </div>
             
             {isSplitView && isMarkdown ? (
               <div className="grid grid-cols-2 gap-8 h-full">
                 <div className="relative border-r border-slate-100 dark:border-slate-800 pr-4">
                   <textarea
                     ref={textareaRef}
                     value={content}
                     onChange={handleChange}
                     onKeyDown={handleKeyDown}
                     placeholder="Start writing..."
                     className="w-full min-h-[50vh] overflow-hidden resize-none text-lg text-slate-600 dark:text-slate-300 leading-relaxed placeholder:text-slate-300 dark:placeholder:text-slate-600 border-none outline-none bg-transparent font-mono transition-colors"
                     spellCheck={false}
                   />
                   <SlashMenu isOpen={slashMenu.isOpen} position={{ top: slashMenu.top, left: slashMenu.left }} filter={slashMenu.filter} selectedIndex={slashMenu.selectedIndex} onSelect={applySlashCommand} onClose={() => setSlashMenu(prev => ({ ...prev, isOpen: false }))} />
                 </div>
                 <div className="markdown-preview prose dark:prose-invert prose-lg text-lg leading-relaxed text-slate-700 dark:text-slate-300 h-full overflow-y-auto">
                   {content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      pre: CodeBlock,
                      code: OldCodeBlock,
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600 italic">Preview...</span>
                )}
                 </div>
               </div>
             ) : isPreview && isMarkdown ? (
               <div className="max-w-3xl mx-auto markdown-preview prose dark:prose-invert prose-lg text-lg leading-relaxed text-slate-700 dark:text-slate-300 min-h-[50vh]">
                 {content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre: CodeBlock,
                    code: OldCodeBlock,
                  }}
                >
                  {content}
                </ReactMarkdown>
              ) : (
                <span className="text-slate-300 dark:text-slate-600 italic">No content to preview</span>
              )}
               </div>
             ) : (
               <div className="relative max-w-3xl mx-auto">
                 <textarea
                   ref={textareaRef}
                   value={content}
                   onChange={handleChange}
                   onKeyDown={handleKeyDown}
                   placeholder={isMarkdown ? "Start writing or type '/' for commands..." : "Start writing..."}
                   className="w-full min-h-[50vh] overflow-hidden resize-none text-lg text-slate-600 dark:text-slate-300 leading-relaxed placeholder:text-slate-300 dark:placeholder:text-slate-600 border-none outline-none bg-transparent font-mono transition-colors"
                   spellCheck={false}
                 />
                 <SlashMenu isOpen={slashMenu.isOpen} position={{ top: slashMenu.top, left: slashMenu.left }} filter={slashMenu.filter} selectedIndex={slashMenu.selectedIndex} onSelect={applySlashCommand} onClose={() => setSlashMenu(prev => ({ ...prev, isOpen: false }))} />
               </div>
             )}
             
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="h-8 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end px-4 gap-4 text-[10px] text-slate-400 dark:text-slate-500 font-mono select-none">
          {!isVisualEditor && (
            <>
              <div className="flex items-center gap-1.5"><AlignLeft className="w-3 h-3" /><span>{stats.wordCount} words</span></div>
              <div className="w-px h-3 bg-slate-200 dark:bg-slate-800"></div>
              <div><span>{stats.charCount} chars</span></div>
              <div className="w-px h-3 bg-slate-200 dark:bg-slate-800"></div>
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
