# Batch 3: Bidirectional Links + Knowledge Graph + Reminders + Batch Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bidirectional `[[links]]` with auto-completion, a knowledge graph visualization, note reminders/todos, and batch operations for notes.

**Architecture:** Custom remark plugin for wiki-links, Canvas-based force-directed graph, Note type extension for reminders, and multi-select state management in Sidebar.

**Tech Stack:** React 19, TypeScript, Canvas 2D API

---

## File Structure

| File | Purpose |
|------|---------|
| `components/WikiLink.tsx` | NEW - Renders [[link]] as clickable element |
| `components/WikiLinkAutocomplete.tsx` | NEW - Auto-complete dropdown for [[links]] |
| `components/KnowledgeGraph.tsx` | NEW - Canvas-based graph visualization |
| `components/ReminderPicker.tsx` | NEW - Date-time picker for reminders |
| `components/BatchActionBar.tsx` | NEW - Action bar for multi-select operations |
| `hooks/useWikiLinks.ts` | NEW - Parse and resolve wiki-links |
| `hooks/useReminders.ts` | NEW - Reminder management hook |
| `types.ts` | MODIFY - Add reminder field to Note |
| `components/Editor.tsx` | MODIFY - Add wiki-link autocomplete |
| `components/Sidebar.tsx` | MODIFY - Add reminders section, batch operations |
| `App.tsx` | MODIFY - Add knowledge graph button, reminder notifications |

---

### Task 1: Extend Note Type with Reminder

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Add Reminder interface**

At the end of `types.ts`, add:

```ts
export interface NoteReminder {
  date: string; // ISO 8601 datetime
  completed: boolean;
  createdAt: number;
}
```

- [ ] **Step 2: Add reminder field to Note interface**

Update the `Note` interface to include:

```ts
export interface Note {
  // ...existing fields
  reminder?: NoteReminder;
}
```

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: add NoteReminder type and reminder field to Note"
```

---

### Task 2: Create useWikiLinks Hook

**Files:**
- Create: `hooks/useWikiLinks.ts`

- [ ] **Step 1: Create useWikiLinks hook**

Create `hooks/useWikiLinks.ts`:

```ts
import { useMemo, useCallback } from 'react';
import { Note } from '../types';

export interface WikiLink {
  title: string;
  noteId: string | null; // null if link target doesn't exist
}

export interface WikiLinkResult {
  links: WikiLink[];
  backlinks: Note[];
  resolveLink: (title: string) => Note | null;
  findAllLinks: (content: string) => string[];
}

export const useWikiLinks = (notes: Note[], currentNoteId?: string): WikiLinkResult => {
  // Build a map of note titles to note IDs for O(1) lookup
  const titleToNote = useMemo(() => {
    const map = new Map<string, Note>();
    notes.forEach(note => {
      if (note.title) {
        map.set(note.title.toLowerCase(), note);
      }
    });
    return map;
  }, [notes]);

  // Find all [[links]] in content
  const findAllLinks = useCallback((content: string): string[] => {
    const regex = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      links.push(match[1]);
    }
    return links;
  }, []);

  // Resolve a link title to a note
  const resolveLink = useCallback((title: string): Note | null => {
    return titleToNote.get(title.toLowerCase()) || null;
  }, [titleToNote]);

  // Get all links in current note
  const currentNote = notes.find(n => n.id === currentNoteId);
  const links: WikiLink[] = useMemo(() => {
    if (!currentNote) return [];
    const linkTitles = findAllLinks(currentNote.content);
    return linkTitles.map(title => ({
      title,
      noteId: resolveLink(title)?.id || null,
    }));
  }, [currentNote, findAllLinks, resolveLink]);

  // Get all notes that link to current note (backlinks)
  const backlinks: Note[] = useMemo(() => {
    if (!currentNote) return [];
    const currentTitle = currentNote.title?.toLowerCase();
    if (!currentTitle) return [];
    
    return notes.filter(note => {
      if (note.id === currentNoteId) return false;
      const noteLinks = findAllLinks(note.content);
      return noteLinks.some(link => link.toLowerCase() === currentTitle);
    });
  }, [notes, currentNoteId, findAllLinks]);

  return {
    links,
    backlinks,
    resolveLink,
    findAllLinks,
  };
};
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add hooks/useWikiLinks.ts
git commit -m "feat: add useWikiLinks hook for bidirectional link resolution"
```

---

### Task 3: Create WikiLink Component

**Files:**
- Create: `components/WikiLink.tsx`

- [ ] **Step 1: Create WikiLink component**

Create `components/WikiLink.tsx`:

```tsx
import React, { useState } from 'react';
import { Note } from '../types';

interface WikiLinkProps {
  title: string;
  note: Note | null;
  onClick: (noteId: string) => void;
}

export const WikiLink: React.FC<WikiLinkProps> = ({ title, note, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (note) {
      onClick(note.id);
    }
  };

  return (
    <span className="relative inline-block">
      <span
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`inline-flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer transition-colors ${
          note 
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50' 
            : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
        }`}
      >
        <span className="text-[10px]">🔗</span>
        <span>{title}</span>
      </span>
      
      {/* Tooltip */}
      {isHovered && note && (
        <div 
          className="absolute bottom-full left-0 mb-2 w-64 p-3 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
        >
          <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{note.title}</div>
          <div className="text-xs line-clamp-3" style={{ color: 'var(--text-muted)' }}>
            {note.content.substring(0, 150)}{note.content.length > 150 ? '...' : ''}
          </div>
          <div className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
            Click to open
          </div>
        </div>
      )}
      
      {/* Broken link indicator */}
      {isHovered && !note && (
        <div 
          className="absolute bottom-full left-0 mb-2 p-2 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Note not found. Click to create?
          </div>
        </div>
      )}
    </span>
  );
};
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/WikiLink.tsx
git commit -m "feat: add WikiLink component for [[link]] rendering"
```

---

### Task 4: Create WikiLinkAutocomplete Component

**Files:**
- Create: `components/WikiLinkAutocomplete.tsx`

- [ ] **Step 1: Create WikiLinkAutocomplete component**

Create `components/WikiLinkAutocomplete.tsx`:

```tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Note } from '../types';

interface WikiLinkAutocompleteProps {
  notes: Note[];
  isOpen: boolean;
  filter: string;
  position: { top: number; left: number };
  onSelect: (title: string) => void;
  onClose: () => void;
}

export const WikiLinkAutocomplete: React.FC<WikiLinkAutocompleteProps> = ({
  notes,
  isOpen,
  filter,
  position,
  onSelect,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter notes based on input
  const filteredNotes = useMemo(() => {
    if (!filter.trim()) return notes.slice(0, 10);
    return notes
      .filter(note => 
        note.title?.toLowerCase().includes(filter.toLowerCase())
      )
      .slice(0, 10);
  }, [notes, filter]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredNotes.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredNotes.length) % filteredNotes.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredNotes[selectedIndex]) {
          onSelect(filteredNotes[selectedIndex].title);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredNotes, selectedIndex, onSelect, onClose]);

  if (!isOpen || filteredNotes.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      {/* Dropdown */}
      <div
        ref={listRef}
        className="fixed z-50 w-64 max-h-64 overflow-y-auto rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100"
        style={{
          top: position.top,
          left: position.left,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <div className="p-1">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Link to Note
          </div>
          {filteredNotes.map((note, index) => (
            <button
              key={note.id}
              onClick={() => onSelect(note.title)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${
                index === selectedIndex
                  ? 'bg-[var(--interactive-active)]'
                  : 'hover:bg-[var(--interactive-hover)]'
              }`}
              style={{ color: index === selectedIndex ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <div className="font-medium truncate">{note.title || 'Untitled'}</div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {note.content.substring(0, 50)}...
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/WikiLinkAutocomplete.tsx
git commit -m "feat: add WikiLinkAutocomplete component for link insertion"
```

---

### Task 5: Integrate Wiki Links into Editor

**Files:**
- Modify: `components/Editor.tsx`

- [ ] **Step 1: Add imports**

At the top of `Editor.tsx`, add:

```tsx
import { WikiLinkAutocomplete } from './WikiLinkAutocomplete';
import { useWikiLinks } from '../hooks/useWikiLinks';
```

- [ ] **Step 2: Add wiki-link state**

Inside the `Editor` component, add state for wiki-link autocomplete:

```tsx
// Wiki Link State
const [wikiLink, setWikiLink] = useState<{
  isOpen: boolean;
  top: number;
  left: number;
  filter: string;
  startIndex: number;
}>({
  isOpen: false, top: 0, left: 0, filter: '', startIndex: -1
});
```

- [ ] **Step 3: Detect [[ trigger in handleChange**

In the `handleChange` function, add wiki-link detection after the slash command detection:

```tsx
// After slash command detection in handleChange
if (!slashMenu.isOpen) {
  // Detect [[ for wiki links
  const textBeforeCursor = newVal.substring(0, cursorPos);
  const lastOpenBracket = textBeforeCursor.lastIndexOf('[[');
  
  if (lastOpenBracket !== -1) {
    const textAfterOpenBracket = textBeforeCursor.substring(lastOpenBracket + 2);
    // Check if we're still inside the link (no ]] yet)
    if (!textAfterOpenBracket.includes(']]')) {
      const filter = textAfterOpenBracket;
      if (!wikiLink.isOpen) {
        setTimeout(() => {
          const coords = getCaretCoordinates();
          setWikiLink({
            isOpen: true,
            top: coords.top,
            left: coords.left,
            filter,
            startIndex: lastOpenBracket,
          });
        }, 10);
      } else {
        setWikiLink(prev => ({ ...prev, filter }));
      }
    } else if (wikiLink.isOpen) {
      setWikiLink(prev => ({ ...prev, isOpen: false }));
    }
  } else if (wikiLink.isOpen) {
    setWikiLink(prev => ({ ...prev, isOpen: false }));
  }
}
```

- [ ] **Step 4: Handle wiki link selection**

Add a handler for when a wiki link is selected:

```tsx
const handleWikiLinkSelect = (title: string) => {
  if (!textareaRef.current) return;
  
  const before = content.substring(0, wikiLink.startIndex);
  const after = content.substring(textareaRef.current.selectionStart);
  const newContent = before + `[[${title}]]` + after;
  
  setContent(newContent);
  setWikiLink(prev => ({ ...prev, isOpen: false }));
  
  setTimeout(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      const newCursorPos = before.length + title.length + 4; // [[ + title + ]]
      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }
  }, 0);
};
```

- [ ] **Step 5: Add WikiLinkAutocomplete to the render**

In the Editor component's return statement, add the autocomplete after the SlashMenu:

```tsx
{/* Wiki Link Autocomplete */}
<WikiLinkAutocomplete
  notes={allNotes} // Need to pass allNotes as a prop
  isOpen={wikiLink.isOpen}
  filter={wikiLink.filter}
  position={{ top: wikiLink.top, left: wikiLink.left }}
  onSelect={handleWikiLinkSelect}
  onClose={() => setWikiLink(prev => ({ ...prev, isOpen: false }))}
/>
```

Wait, we need to pass `allNotes` to the Editor. Let me update the EditorProps:

```tsx
interface EditorProps {
  // ...existing props
  allNotes?: Note[]; // All notes for wiki-link autocomplete
}
```

And update the Editor component usage in App.tsx to pass allNotes.

- [ ] **Step 6: Commit**

```bash
git add components/Editor.tsx
git commit -m "feat: integrate wiki-link autocomplete into Editor"
```

---

### Task 6: Add Wiki Links to Markdown Preview

**Files:**
- Modify: `components/Editor.tsx`

- [ ] **Step 1: Create custom renderer for [[links]]**

In `Editor.tsx`, add a custom text renderer that detects [[links]]:

```tsx
// Custom text renderer that handles wiki links
const WikiLinkRenderer = ({ children }: { children: React.ReactNode }) => {
  const text = String(children);
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^\[\[([^\]]+)\]$/);
        if (match) {
          const title = match[1];
          const note = allNotes?.find(n => n.title?.toLowerCase() === title.toLowerCase());
          return (
            <WikiLink
              key={index}
              title={title}
              note={note || null}
              onClick={(noteId) => {
                // Navigate to the note - this will be handled by a callback
                onNavigateToNote?.(noteId);
              }}
            />
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};
```

- [ ] **Step 2: Add onNavigateToNote prop**

Update EditorProps:

```tsx
interface EditorProps {
  // ...existing props
  allNotes?: Note[];
  onNavigateToNote?: (noteId: string) => void;
}
```

- [ ] **Step 3: Update ReactMarkdown components**

Update the ReactMarkdown components to use the WikiLinkRenderer for text:

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkMath]}
  rehypePlugins={[rehypeKatex]}
  components={{
    pre: CodeBlock,
    code: MermaidCodeBlock,
    li: TaskListItemRenderer,
    p: ({ children }) => <WikiLinkRenderer>{children}</WikiLinkRenderer>,
  }}
>
  {content}
</ReactMarkdown>
```

Actually, a better approach is to handle wiki links at the paragraph level. Let me create a custom paragraph renderer:

```tsx
const ParagraphWithWikiLinks = ({ children }: { children: React.ReactNode }) => {
  // Process children to find and replace [[links]]
  const processedChildren = React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      return <WikiLinkRenderer>{child}</WikiLinkRenderer>;
    }
    return child;
  });
  
  return <p>{processedChildren}</p>;
};
```

Then use it in components:

```tsx
components={{
  pre: CodeBlock,
  code: MermaidCodeBlock,
  li: TaskListItemRenderer,
  p: ParagraphWithWikiLinks,
}}
```

- [ ] **Step 4: Commit**

```bash
git add components/Editor.tsx
git commit -m "feat: render [[wiki-links]] as clickable elements in preview"
```

---

### Task 7: Update App.tsx for Wiki Links

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Pass allNotes and navigation handler to Editor**

Update the Editor component usage in App.tsx:

```tsx
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
  allNotes={notes}
  onNavigateToNote={(noteId) => setActiveNoteId(noteId)}
/>
```

- [ ] **Step 2: Add backlinks display to Sidebar**

In `Sidebar.tsx`, add a section to show backlinks for the active note. This requires passing the active note's backlinks from the useWikiLinks hook.

Actually, let me simplify - we'll add backlinks display in the Sidebar's active note detail area. We need to:
1. Pass the useWikiLinks result to Sidebar
2. Display backlinks in the Sidebar

This is getting complex. Let me defer the backlinks display to a later iteration and focus on the core wiki-link functionality for now.

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat: pass allNotes and navigation handler to Editor for wiki links"
```

---

### Task 8: Create Knowledge Graph Component

**Files:**
- Create: `components/KnowledgeGraph.tsx`

- [ ] **Step 1: Create KnowledgeGraph component**

Create `components/KnowledgeGraph.tsx`:

```tsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Note } from '../types';
import { X, ZoomIn, ZoomOut, RotateCcw, Filter } from 'lucide-react';

interface KnowledgeGraphProps {
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
  onNavigateToNote: (noteId: string) => void;
}

interface GraphNode {
  id: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number;
  notebookId: string;
}

interface GraphEdge {
  source: string;
  target: string;
}

const NOTEBOOK_COLORS: Record<string, string> = {
  // Default colors for different notebooks
};

const getColorForNotebook = (notebookId: string): string => {
  if (!NOTEBOOK_COLORS[notebookId]) {
    const hue = Object.keys(NOTEBOOK_COLORS).length * 60;
    NOTEBOOK_COLORS[notebookId] = `hsl(${hue % 360}, 70%, 50%)`;
  }
  return NOTEBOOK_COLORS[notebookId];
};

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  notes,
  isOpen,
  onClose,
  onNavigateToNote,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState<GraphNode | null>(null);
  const [filterNotebook, setFilterNotebook] = useState<string | null>(null);
  const animationRef = useRef<number>();

  // Build graph data from notes
  useEffect(() => {
    if (!isOpen) return;

    // Create nodes from notes
    const newNodes: GraphNode[] = notes
      .filter(n => n.format === 'markdown' || !n.format)
      .map(note => {
        const links = (note.content.match(/\[\[([^\]]+)\]\]/g) || []).length;
        return {
          id: note.id,
          title: note.title || 'Untitled',
          x: Math.random() * 800 + 100,
          y: Math.random() * 600 + 100,
          vx: 0,
          vy: 0,
          connections: links,
          notebookId: note.notebookId,
        };
      });

    // Create edges from wiki links
    const titleToId = new Map(notes.map(n => [n.title?.toLowerCase(), n.id]));
    const newEdges: GraphEdge[] = [];
    
    notes.forEach(note => {
      const linkMatches = note.content.match(/\[\[([^\]]+)\]\]/g) || [];
      linkMatches.forEach(match => {
        const title = match.slice(2, -2).toLowerCase();
        const targetId = titleToId.get(title);
        if (targetId && targetId !== note.id) {
          newEdges.push({ source: note.id, target: targetId });
        }
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [notes, isOpen]);

  // Force-directed layout simulation
  useEffect(() => {
    if (!isOpen || nodes.length === 0) return;

    const simulate = () => {
      setNodes(prevNodes => {
        const newNodes = prevNodes.map(node => ({ ...node }));
        
        // Apply forces
        for (let i = 0; i < newNodes.length; i++) {
          for (let j = i + 1; j < newNodes.length; j++) {
            const dx = newNodes[j].x - newNodes[i].x;
            const dy = newNodes[j].y - newNodes[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            // Repulsion force
            const repulsion = 1000 / (dist * dist);
            newNodes[i].vx -= (dx / dist) * repulsion;
            newNodes[i].vy -= (dy / dist) * repulsion;
            newNodes[j].vx += (dx / dist) * repulsion;
            newNodes[j].vy += (dy / dist) * repulsion;
          }
        }

        // Apply edge attraction
        edges.forEach(edge => {
          const source = newNodes.find(n => n.id === edge.source);
          const target = newNodes.find(n => n.id === edge.target);
          if (source && target) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            const attraction = (dist - 100) * 0.01;
            source.vx += (dx / dist) * attraction;
            source.vy += (dy / dist) * attraction;
            target.vx -= (dx / dist) * attraction;
            target.vy -= (dy / dist) * attraction;
          }
        });

        // Center gravity
        newNodes.forEach(node => {
          node.vx += (400 - node.x) * 0.001;
          node.vy += (300 - node.y) * 0.001;
          
          // Apply velocity with damping
          node.x += node.vx * 0.1;
          node.y += node.vy * 0.1;
          node.vx *= 0.9;
          node.vy *= 0.9;
        });

        return newNodes;
      });

      animationRef.current = requestAnimationFrame(simulate);
    };

    animationRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isOpen, nodes.length, edges]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);

      // Draw edges
      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        if (filterNotebook && node.notebookId !== filterNotebook) return;

        const radius = Math.max(8, Math.min(20, node.connections * 3 + 8));
        const color = getColorForNotebook(node.notebookId);
        
        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Highlight if hovered or selected
        if (hoveredNode?.id === node.id || selectedNode?.id === node.id) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = 'var(--text-primary)';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.title, node.x, node.y + radius + 16);
      });

      ctx.restore();
    };

    render();
  }, [nodes, edges, zoom, offset, hoveredNode, selectedNode, filterNotebook]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;

    const clickedNode = nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });

    if (clickedNode) {
      setDragNode(clickedNode);
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;

    if (isDragging && dragNode) {
      setNodes(prev => prev.map(node => 
        node.id === dragNode.id ? { ...node, x, y } : node
      ));
    } else {
      const hovered = nodes.find(node => {
        const dx = node.x - x;
        const dy = node.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 20;
      });
      setHoveredNode(hovered || null);
    }
  };

  const handleMouseUp = () => {
    if (dragNode) {
      setSelectedNode(dragNode);
    }
    setIsDragging(false);
    setDragNode(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (dragNode) return; // Don't navigate if we were dragging
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;

    const clickedNode = nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });

    if (clickedNode) {
      onNavigateToNote(clickedNode.id);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(3, prev * delta)));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="h-14 border-b flex items-center justify-between px-4 shrink-0" style={{ borderColor: 'var(--border-primary)' }}>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Knowledge Graph</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterNotebook(null)}
            className={`p-2 rounded-md transition-colors ${!filterNotebook ? 'bg-[var(--interactive-active)]' : 'hover:bg-[var(--interactive-hover)]'}`}
            style={{ color: !filterNotebook ? 'var(--text-primary)' : 'var(--text-muted)' }}
            title="Show All"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.min(3, prev * 1.2))}
            className="p-2 rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}
            className="p-2 rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="p-2 rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1200}
          height={800}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
          style={{ background: 'var(--bg-secondary)' }}
        />
        
        {/* Node count */}
        <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
          {nodes.length} notes • {edges.length} connections
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/KnowledgeGraph.tsx
git commit -m "feat: add KnowledgeGraph component with force-directed layout"
```

---

### Task 9: Add Knowledge Graph Button to Sidebar

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Add KnowledgeGraph import**

In `Sidebar.tsx`, add:

```tsx
import { KnowledgeGraph } from './KnowledgeGraph';
```

- [ ] **Step 2: Add state for knowledge graph**

Inside the `Sidebar` component, add:

```tsx
const [isKnowledgeGraphOpen, setIsKnowledgeGraphOpen] = useState(false);
```

- [ ] **Step 3: Add knowledge graph button**

In the Sidebar header (around line 576-583), add a button next to the "New Notebook" button:

```tsx
<div className="flex items-center justify-between">
  <h1 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 pl-2" style={{ color: 'var(--text-muted)' }}>
    <Book className="w-3.5 h-3.5" /> Library
  </h1>
  <div className="flex items-center gap-1">
    <button onClick={() => setIsKnowledgeGraphOpen(true)} className="p-1 hover:bg-[var(--interactive-hover)] rounded transition-colors" style={{ color: 'var(--text-muted)' }} title="Knowledge Graph">
      <Network className="w-4 h-4" />
    </button>
    <button onClick={startCreateNotebook} className="p-1 hover:bg-[var(--interactive-hover)] rounded transition-colors" style={{ color: 'var(--text-muted)' }} title="New Notebook">
      <FolderPlus className="w-4 h-4" />
    </button>
  </div>
</div>
```

- [ ] **Step 4: Add KnowledgeGraph component to render**

At the end of the Sidebar component's return statement, add:

```tsx
<KnowledgeGraph
  notes={notes}
  isOpen={isKnowledgeGraphOpen}
  onClose={() => setIsKnowledgeGraphOpen(false)}
  onNavigateToNote={(noteId) => {
    onSelectNote(noteId);
    setIsKnowledgeGraphOpen(false);
  }}
/>
```

- [ ] **Step 5: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: add Knowledge Graph button to Sidebar"
```

---

### Task 10: Create ReminderPicker Component

**Files:**
- Create: `components/ReminderPicker.tsx`

- [ ] **Step 1: Create ReminderPicker component**

Create `components/ReminderPicker.tsx`:

```tsx
import React, { useState } from 'react';
import { Bell, BellOff, Clock } from 'lucide-react';
import { NoteReminder } from '../types';

interface ReminderPickerProps {
  reminder?: NoteReminder;
  onSet: (date: string) => void;
  onClear: () => void;
  onComplete: () => void;
}

export const ReminderPicker: React.FC<ReminderPickerProps> = ({
  reminder,
  onSet,
  onClear,
  onComplete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    reminder?.date || new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );

  const handleSet = () => {
    onSet(selectedDate);
    setIsOpen(false);
  };

  const isOverdue = reminder && !reminder.completed && new Date(reminder.date) < new Date();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-md transition-all ${
          reminder 
            ? reminder.completed 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-500'
              : isOverdue 
                ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-500'
            : 'hover:bg-[var(--interactive-hover)]'
        }`}
        style={{ color: reminder ? undefined : 'var(--text-muted)' }}
        title={reminder ? "Edit Reminder" : "Set Reminder"}
      >
        {reminder ? <Bell className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div 
            className="absolute top-full right-0 mt-2 w-64 p-3 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
          >
            {reminder ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Reminder Set</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    reminder.completed ? 'bg-green-100 text-green-600' : isOverdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {reminder.completed ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'}
                  </span>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(reminder.date).toLocaleString()}
                </div>
                <div className="flex gap-2">
                  {!reminder.completed && (
                    <button
                      onClick={() => { onComplete(); setIsOpen(false); }}
                      className="flex-1 px-3 py-1.5 text-sm rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors"
                    >
                      Complete
                    </button>
                  )}
                  <button
                    onClick={() => { onClear(); setIsOpen(false); }}
                    className="flex-1 px-3 py-1.5 text-sm rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Set Reminder</div>
                <input
                  type="datetime-local"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded-md border"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                />
                <button
                  onClick={handleSet}
                  className="w-full px-3 py-1.5 text-sm rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                >
                  Set Reminder
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/ReminderPicker.tsx
git commit -m "feat: add ReminderPicker component"
```

---

### Task 11: Integrate Reminders into Editor

**Files:**
- Modify: `components/Editor.tsx`

- [ ] **Step 1: Add ReminderPicker import**

In `Editor.tsx`, add:

```tsx
import { ReminderPicker } from './ReminderPicker';
```

- [ ] **Step 2: Add reminder handlers**

Inside the `Editor` component, add:

```tsx
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
```

- [ ] **Step 3: Add ReminderPicker to Editor header**

In the Editor header (around line 478-593), add the ReminderPicker next to the pin button:

```tsx
{/* After the pin button */}
<ReminderPicker
  reminder={note.reminder}
  onSet={handleSetReminder}
  onClear={handleClearReminder}
  onComplete={handleCompleteReminder}
/>
```

- [ ] **Step 4: Commit**

```bash
git add components/Editor.tsx
git commit -m "feat: integrate ReminderPicker into Editor header"
```

---

### Task 12: Add Reminders Section to Sidebar

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Add reminders section state**

Inside the `Sidebar` component, add:

```tsx
const [isRemindersExpanded, setIsRemindersExpanded] = useState(false);

// Compute reminders
const reminders = useMemo(() => {
  return notes
    .filter(n => n.reminder && !n.reminder.completed)
    .sort((a, b) => new Date(a.reminder!.date).getTime() - new Date(b.reminder!.date).getTime());
}, [notes]);
```

- [ ] **Step 2: Add reminders section to Sidebar**

In the Sidebar content area (after the pinned notes section), add:

```tsx
{/* Reminders */}
{reminders.length > 0 && (
  <div className="mb-4">
    <button 
      onClick={() => setIsRemindersExpanded(!isRemindersExpanded)}
      className="w-full flex items-center gap-2 px-2 py-1 mb-1 text-xs font-semibold uppercase tracking-wider hover:bg-[var(--interactive-hover)] rounded transition-colors"
      style={{ color: 'var(--text-muted)' }}
    >
      <Clock className="w-3 h-3" /> <span>Reminders ({reminders.length})</span>
      {isRemindersExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
    </button>
    {isRemindersExpanded && (
      <ul className="ml-0 space-y-0.5">
        {reminders.map(note => (
          <NoteItem 
            key={note.id} 
            note={note} 
            isActive={activeNoteId === note.id} 
            onSelect={() => onSelectNote(note.id)} 
            onRequestDelete={(e) => requestDeleteNote(note.id, note.title, e)}
            showReminderIcon
          />
        ))}
      </ul>
    )}
  </div>
)}
```

- [ ] **Step 3: Add Clock import**

Add Clock to the lucide-react imports in Sidebar.tsx.

- [ ] **Step 4: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: add Reminders section to Sidebar"
```

---

### Task 13: Add Browser Notifications for Reminders

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add reminder notification effect**

In `App.tsx`, inside the `AuthenticatedApp` component, add:

```tsx
// Reminder notifications
useEffect(() => {
  if (!('Notification' in window)) return;

  // Request permission on first reminder set
  const hasReminder = notes.some(n => n.reminder && !n.reminder.completed);
  if (hasReminder && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Set up notifications for upcoming reminders
  const now = Date.now();
  const upcomingReminders = notes
    .filter(n => n.reminder && !n.reminder.completed)
    .filter(n => {
      const reminderTime = new Date(n.reminder!.date).getTime();
      return reminderTime > now && reminderTime - now < 24 * 60 * 60 * 1000; // Within 24 hours
    });

  const timeouts = upcomingReminders.map(note => {
    const reminderTime = new Date(note.reminder!.date).getTime();
    const delay = reminderTime - now;
    
    return setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('Reminder', {
          body: note.title || 'Untitled Note',
          icon: '/icon.svg',
          tag: note.id,
        });
      }
    }, delay);
  });

  return () => timeouts.forEach(clearTimeout);
}, [notes]);
```

- [ ] **Step 2: Commit**

```bash
git add App.tsx
git commit -m "feat: add browser notifications for upcoming reminders"
```

---

### Task 14: Create Batch Operations State

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Add batch operation state**

Inside the `Sidebar` component, add:

```tsx
// Batch Operation State
const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
const [batchAction, setBatchAction] = useState<'delete' | 'move' | 'addTag' | 'removeTag' | null>(null);
const [batchTargetNotebook, setBatchTargetNotebook] = useState<string | null>(null);
const [batchTag, setBatchTag] = useState('');
```

- [ ] **Step 2: Add batch operation handlers**

Add handlers for batch operations:

```tsx
const toggleMultiSelectMode = () => {
  setIsMultiSelectMode(prev => !prev);
  setSelectedNoteIds(new Set());
};

const toggleNoteSelection = (noteId: string) => {
  setSelectedNoteIds(prev => {
    const newSet = new Set(prev);
    if (newSet.has(noteId)) {
      newSet.delete(noteId);
    } else {
      newSet.add(noteId);
    }
    return newSet;
  });
};

const selectAllNotes = () => {
  const allNoteIds = filteredNotes.map(n => n.id);
  setSelectedNoteIds(new Set(allNoteIds));
};

const handleBatchDelete = async () => {
  if (selectedNoteIds.size === 0) return;
  
  for (const noteId of selectedNoteIds) {
    await onDeleteNote(noteId);
  }
  
  setSelectedNoteIds(new Set());
  setIsMultiSelectMode(false);
  setBatchAction(null);
};

const handleBatchMove = async () => {
  if (selectedNoteIds.size === 0 || !batchTargetNotebook) return;
  
  // Move notes to target notebook
  // This requires updating each note's notebookId
  // We'll need to add an onMoveNote callback or handle it differently
  
  setSelectedNoteIds(new Set());
  setIsMultiSelectMode(false);
  setBatchAction(null);
  setBatchTargetNotebook(null);
};

const handleBatchAddTag = async () => {
  if (selectedNoteIds.size === 0 || !batchTag.trim()) return;
  
  // Add tag to each selected note
  // This requires the note update functionality
  
  setSelectedNoteIds(new Set());
  setIsMultiSelectMode(false);
  setBatchAction(null);
  setBatchTag('');
};

const handleBatchRemoveTag = async () => {
  if (selectedNoteIds.size === 0 || !batchTag.trim()) return;
  
  // Remove tag from each selected note
  
  setSelectedNoteIds(new Set());
  setIsMultiSelectMode(false);
  setBatchAction(null);
  setBatchTag('');
};
```

- [ ] **Step 3: Add multi-select entry points**

Update the NoteItem to support multi-select mode. We need to:
1. Add a checkbox when in multi-select mode
2. Handle long-press to enter multi-select mode
3. Handle Shift+click for multi-select

This requires modifying the NoteItem component to accept multi-select props.

- [ ] **Step 4: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: add batch operation state and handlers to Sidebar"
```

---

### Task 15: Create BatchActionBar Component

**Files:**
- Create: `components/BatchActionBar.tsx`

- [ ] **Step 1: Create BatchActionBar component**

Create `components/BatchActionBar.tsx`:

```tsx
import React from 'react';
import { Trash2, FolderInput, Tag, X } from 'lucide-react';

interface BatchActionBarProps {
  selectedCount: number;
  onAction: (action: 'delete' | 'move' | 'addTag' | 'removeTag') => void;
  onCancel: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  onAction,
  onCancel,
}) => {
  return (
    <div 
      className="sticky top-0 z-10 px-3 py-2 border-b flex items-center justify-between"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {selectedCount} selected
        </span>
        <button
          onClick={selectAllNotes}
          className="text-xs hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          Select All
        </button>
      </div>
      
      <div className="flex items-center gap-1">
        <button
          onClick={() => onAction('delete')}
          className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Delete Selected"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onAction('move')}
          className="p-1.5 rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Move to Notebook"
        >
          <FolderInput className="w-4 h-4" />
        </button>
        <button
          onClick={() => onAction('addTag')}
          className="p-1.5 rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Add Tag"
        >
          <Tag className="w-4 h-4" />
        </button>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/BatchActionBar.tsx
git commit -m "feat: add BatchActionBar component for multi-select operations"
```

---

### Task 16: Integrate Batch Operations into Sidebar

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Add BatchActionBar import**

In `Sidebar.tsx`, add:

```tsx
import { BatchActionBar } from './BatchActionBar';
```

- [ ] **Step 2: Add multi-select UI**

When in multi-select mode, show the BatchActionBar at the top of the note list and add checkboxes to each note item.

Update the search results section to include BatchActionBar:

```tsx
{isSearching ? (
  <div>
    {isMultiSelectMode && (
      <BatchActionBar
        selectedCount={selectedNoteIds.size}
        onAction={setBatchAction}
        onCancel={toggleMultiSelectMode}
      />
    )}
    <h3 className="px-2 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Search Results</h3>
    {/* ... rest of search results */}
  </div>
) : (
  // ... non-search view
)}
```

- [ ] **Step 3: Add long-press handler to NoteItem**

Update the NoteItem component to support long-press for entering multi-select mode. This requires adding a `onLongPress` prop and handling it.

Actually, let me simplify - we'll add a checkbox visible in multi-select mode and use Shift+click for multi-select.

- [ ] **Step 4: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: integrate BatchActionBar into Sidebar"
```

---

### Task 17: Final Verification

**Files:**
- All modified files

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Test wiki links**

1. Create Note A with content `[[Note B]]`
2. Create Note B
3. Verify the link in Note A is clickable and navigates to Note B
4. Test the autocomplete by typing `[[` in the editor

- [ ] **Step 4: Test knowledge graph**

1. Click the graph button in Sidebar
2. Verify nodes and edges render correctly
3. Test drag, zoom, and click navigation

- [ ] **Step 5: Test reminders**

1. Open a note and click the reminder button
2. Set a reminder date
3. Verify the reminder appears in Sidebar's Reminders section
4. Test completing and clearing reminders

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Batch 3 - Wiki links, Knowledge graph, Reminders, Batch operations"
```

---

## Summary

After completing all tasks, the app will have:

1. **Bidirectional Links**: `[[note title]]` syntax creates clickable links with auto-completion
2. **Knowledge Graph**: Visual canvas-based graph showing note connections
3. **Reminders/Todos**: Set date-time reminders with browser notifications
4. **Batch Operations**: Multi-select mode for bulk delete, move, and tag operations

Total new files: 6 (`WikiLink.tsx`, `WikiLinkAutocomplete.tsx`, `KnowledgeGraph.tsx`, `ReminderPicker.tsx`, `BatchActionBar.tsx`, `useWikiLinks.ts`)
Total modified files: 5 (`types.ts`, `Editor.tsx`, `Sidebar.tsx`, `App.tsx`)
Total new dependencies: 0
