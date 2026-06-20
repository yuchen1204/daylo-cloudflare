# Feature Expansion Design Spec

## Overview

Expand Daylo notes app with high and medium priority features, implemented in 3 batches:

- **Batch 1**: Markdown enhancements (LaTeX, Mermaid, task lists) + Keyboard shortcuts
- **Batch 2**: Performance optimization (virtual scrolling, memo) + Note templates
- **Batch 3**: Bidirectional links + Knowledge graph + Reminders/Todos + Batch operations

## Architecture Strategy

Sequential batch implementation. Each batch is independent and can be tested/reverted separately. Batch N+1 starts only after Batch N is complete and verified.

---

## Batch 1: Markdown Enhancements + Keyboard Shortcuts

### 1.1 LaTeX Math Formulas

**Dependencies**: `katex`, `remark-math`, `rehype-katex`

**Implementation**:
- Install packages: `npm install katex remark-math rehype-katex`
- Add KaTeX CSS to `index.html` or import in `Editor.tsx`
- Configure `react-markdown` in `Editor.tsx` with plugins:
  ```tsx
  <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath]}
    rehypePlugins={[rehypeKatex]}
  >
  ```
- Support inline `$...$` and block `$$...$$` syntax
- In edit mode: show raw LaTeX source
- In preview mode: render KaTeX output
- Add KaTeX error handling for invalid expressions

**Style**: Use KaTeX CSS with `--text-primary` color variables for theme consistency.

### 1.2 Mermaid Diagrams

**Dependencies**: `mermaid`

**Implementation**:
- Install: `npm install mermaid`
- Create `components/MermaidBlock.tsx`:
  - Accepts `code` prop (mermaid syntax string)
  - Uses `useEffect` to call `mermaid.render()` on mount
  - Renders SVG output via `dangerouslySetInnerHTML`
  - Handles errors gracefully with fallback display
- Add custom `code` renderer in `Editor.tsx` Markdown component:
  - Detect `language === 'mermaid'` on code blocks
  - Render `MermaidBlock` instead of styled code block
- Edit mode: show raw mermaid code in code editor
- Preview mode: render diagram via MermaidBlock

**Supported diagrams**: flowchart, sequence, gantt, pie, class, state, ER.

### 1.3 Task List Checkboxes

**Implementation**:
- Create custom `TaskListItem` component:
  - Renders checkbox + content
  - Checkbox state derived from `- [ ]` / `- [x]` in markdown source
  - On checkbox toggle: find and replace the corresponding `- [ ]` or `- [x]` in content string
  - Uses local `useState` for immediate UI response
  - Debounces content update (500ms) to avoid excessive saves
- Register custom `li` renderer in `react-markdown` components:
  - Detect if list item starts with `[ ]` or `[x]`
  - Render `TaskListItem` for task items
  - Render default `li` for regular items
- Works in preview mode (interactive checkboxes)
- In edit mode: raw `- [ ]` / `- [x]` syntax shown as plain text (user edits directly)

### 1.4 Keyboard Shortcuts

**Implementation**:
- Create `hooks/useKeyboardShortcuts.ts`:
  - Accepts `ShortcutConfig[]` array
  - Registers `keydown` listener on `window`
  - Matches key combinations (Ctrl/Cmd + key + modifiers)
  - Returns `registerShortcut` function
- Integrate in `App.tsx` via `useEffect`:
  - `Ctrl/Cmd+N`: Call `handleCreateNote()` with default format
  - `Ctrl/Cmd+Shift+N`: Call `handleCreateNotebook()`
  - `Ctrl/Cmd+P`: Focus search input (ref in Sidebar)
  - `Ctrl/Cmd+E`: Toggle `isPreview` state in Editor
  - `Ctrl/Cmd+Shift+F`: Toggle `isFocusMode` state
  - `Ctrl/Cmd+,`: Open settings modal
- Add shortcut hints to relevant UI elements (tooltips)
- Create `components/ShortcutsHelp.tsx` modal showing all shortcuts
- Add "Keyboard Shortcuts" entry in Settings > General tab

**Platform detection**: Check `navigator.platform` or `userAgentData` for Mac vs Windows/Linux. Use `Meta` key on Mac, `Ctrl` elsewhere.

---

## Batch 2: Performance Optimization + Note Templates

### 2.1 Virtual Scrolling

**Dependencies**: `react-window`

**Implementation**:
- Install: `npm install react-window`
- In `Sidebar.tsx`, wrap note list in `FixedSizeList`:
  - Only activate when `notes.length > 50`
  - Item height: 40px (fixed)
  - Dynamic height calculation: `Math.min(notes.length * 40, containerHeight)`
- Preserve existing features:
  - Search filtering applied before virtual list
  - Tag filtering applied before virtual list
  - Drag-and-drop via `@dnd-kit` (compatible with react-window)
  - Pinned notes section remains above virtual list

**Fallback**: For ≤50 notes, keep current rendering (no virtual list overhead).

### 2.2 React.memo Optimization

**Components to optimize**:

1. `NoteItem` (in `Sidebar.tsx`):
   - Wrap with `React.memo`
   - Memoize `onClick`, `onDragStart` callbacks with `useCallback`
   - Compare by `note.id`, `note.title`, `note.isPinned`, `note.tags`

2. `Sidebar` notebook list:
   - `useMemo` to cache filtered/sorted notebook list
   - Dependencies: `notebooks`, `searchQuery`, `selectedNotebookId`

3. `Editor` Markdown rendering:
   - `useMemo` for `ReactMarkdown` output
   - Dependencies: `content`, `isPreview`, `settings.fontSize`

4. All callback props in `App.tsx`:
   - `handleCreateNote`, `handleUpdateNote`, `handleDeleteNote`, etc.
   - Wrap with `useCallback` and appropriate dependencies

### 2.3 Note Templates

**Data structure**:
```ts
interface NoteTemplate {
  id: string;
  name: string;
  icon: string; // emoji or icon name
  content: string;
  format: 'markdown' | 'txt';
  isBuiltin: boolean;
}
```

**Storage**: `localStorage` key `gemini-notes-templates`. Not synced to cloud.

**Built-in templates** (5):
1. 📝 Daily Journal — `# {date}\n\n## Today\n\n- \n\n## Notes\n\n`
2. 📋 Meeting Notes — `# Meeting: {title}\n\n**Date**: {date}\n**Attendees**: \n\n## Agenda\n\n## Discussion\n\n## Action Items\n\n- [ ] `
3. 📊 Weekly Report — `# Week {week}\n\n## Summary\n\n## Completed\n\n## In Progress\n\n## Next Week\n`
4. 📚 Reading Notes — `# {title}\n\n**Author**: \n**Date**: {date}\n\n## Key Takeaways\n\n## Quotes\n\n## Thoughts\n`
5. 🎯 Project Plan — `# Project: {title}\n\n## Overview\n\n## Goals\n\n## Timeline\n\n## Tasks\n\n- [ ] `

**UI**:
- In `Sidebar.tsx`, add template picker dropdown next to "New Note" button
- Click "New Note" → shows template list (builtin + custom)
- Select template → creates note with template content, inserts current date where `{date}` placeholder exists
- "Save as Template" option in note menu (three-dot menu on note item)

**Template management** (Settings > General):
- List all custom templates
- Edit/Delete custom templates
- Cannot delete builtin templates
- "Reset to defaults" button

---

## Batch 3: Bidirectional Links + Knowledge Graph + Reminders/Todos + Batch Operations

### 3.1 Bidirectional Links `[[笔记名]]`

**Markdown processing**:
- Add custom remark plugin or regex-based parser for `[[...]]` syntax
- Create `WikiLink` component:
  - Renders as styled link
  - Click handler: find note by title, navigate to it
  - Hover: show tooltip with note preview (first 100 chars)
  - Style: distinct color (e.g., blue/purple) to differentiate from regular links

**Auto-completion**:
- In `Editor.tsx`, detect `[[` input trigger
- Show dropdown with all note titles (filtered by typed text)
- Use `@headlessui/react` `Combobox` or custom positioned dropdown
- Keyboard navigation: arrow keys + Enter to select
- Insert `[[Selected Title]]` and close dropdown
- Close dropdown on `]]` or `Escape` or click outside

**Backlinks tracking**:
- In `Sidebar.tsx` note detail panel, show "Referenced by X notes"
- Click to see list of notes that link to current note
- When deleting a note, scan all notes for `[[deleted title]]` references and warn user

### 3.2 Knowledge Graph View

**New component**: `components/KnowledgeGraph.tsx`

**Rendering**:
- Canvas 2D context for node/edge rendering
- Nodes: circles with note title text, size based on reference count
- Edges: lines connecting notes that reference each other
- Layout: force-directed graph (simple spring simulation)
- Colors: based on notebook assignment

**Interactions**:
- Drag nodes to reposition
- Mouse wheel / pinch to zoom
- Click node to navigate to note
- Hover node: highlight connected edges + show tooltip
- Toolbar: zoom in/out, reset view, toggle labels, filter by notebook/tag

**Access**:
- New button in Sidebar (network graph icon)
- Opens full-screen overlay with graph
- ESC or close button to return

**Performance**:
- Limit to 500 notes max for rendering (show warning if exceeded: "Graph supports up to 500 notes. Please filter by notebook or tag to view a subset.")
- Use `requestAnimationFrame` for smooth animation
- Only recompute layout when data changes

### 3.3 Reminders/Todos

**Data model extension**:
```ts
interface Note {
  // ...existing fields
  reminder?: {
    date: string; // ISO 8601 datetime
    completed: boolean;
  };
}
```

**Editor UI**:
- Add alarm/clock icon button in Editor header (next to pin/share buttons)
- Click opens date-time picker (native `<input type="datetime-local">`)
- Set reminder: saves to note metadata
- Clear reminder: removes `reminder` field
- When reminder is set: show filled alarm icon in editor header
- When reminder is past and not completed: show red alarm icon

**Sidebar integration**:
- New "Reminders" section at top of Sidebar (before notebooks)
- Shows all notes with `reminder.completed === false`
- Sorted by reminder date (nearest first)
- Click to navigate to note
- Checkbox to mark as completed (moves to "Completed" sub-section)
- Completed reminders hidden after 7 days (configurable in settings)

**Browser notifications**:
- On app load, scan all notes with upcoming reminders
- Register `setTimeout` for each reminder within 24 hours
- On timeout: request `Notification.permission`, show notification
- Notification click: navigate to note
- Permission request: shown once on first reminder set

### 3.4 Batch Operations

**Multi-select mode**:
- Entry: long-press (500ms) on note item OR Shift+click
- Exit: ESC key, "Cancel" button, or after operation completes
- Visual: each note item shows checkbox, selected items highlighted
- Top bar shows: "X selected" + action buttons

**Supported operations**:
1. **Delete**: Delete all selected notes (with confirmation modal)
2. **Move**: Show notebook picker, move all selected notes to chosen notebook
3. **Add Tag**: Show tag input, add tag to all selected notes
4. **Remove Tag**: Show tag selector, remove tag from all selected notes

**Implementation**:
- State: `selectedNoteIds: Set<string>` in `Sidebar.tsx`
- Multi-select mode: `isMultiSelectMode: boolean`
- Action handlers: iterate over `selectedNoteIds`, call existing CRUD functions
- Confirmation modal before destructive operations (delete)
- Progress indication for large batches

**Mobile support**:
- Long-press to enter multi-select mode
- Swipe to select/deselect
- Bottom action bar on mobile

---

## Cross-cutting Concerns

### Theme Integration
All new components use CSS custom properties (`var(--text-primary)`, `var(--bg-primary)`, etc.) for dark/light theme support.

### Accessibility
- All interactive elements have proper `aria-label` attributes
- Keyboard navigation works throughout
- Screen reader support for new UI elements

### Error Handling
- KaTeX/Mermaid render errors: show fallback with raw source
- Template creation errors: show toast notification
- Batch operation errors: show per-item error summary
- Browser notification permission denied: silent fallback

### Testing
Each batch includes:
- Unit tests for new hooks/utilities
- Component tests for new UI elements
- Integration tests for critical paths (template creation, batch delete)

---

## Dependencies Summary

### Batch 1
- `katex` — LaTeX rendering
- `remark-math` — Markdown math syntax parser
- `rehype-katex` — KaTeX rehype plugin

### Batch 2
- `react-window` — Virtual scrolling

### Batch 3
- No new dependencies (Canvas 2D for graph, native inputs for date picker)

### Existing dependencies utilized
- `react-markdown` — Extended with new plugins
- `@headlessui/react` — Used for auto-completion dropdown
- `@dnd-kit/*` — Compatible with virtual scrolling
- `lucide-react` — Icons for new UI elements
