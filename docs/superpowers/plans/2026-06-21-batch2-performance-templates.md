# Batch 2: Performance Optimization + Note Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize rendering performance with virtual scrolling and memoization, and add a note template system.

**Architecture:** Use `react-window` for virtual scrolling in the note list, wrap components with `React.memo`, and create a template system with built-in and custom templates stored in localStorage.

**Tech Stack:** React 19, TypeScript, react-window

---

## File Structure

| File | Purpose |
|------|---------|
| `components/TemplatePicker.tsx` | NEW - Template selection dropdown/modal |
| `components/TemplateManager.tsx` | NEW - Settings panel for managing templates |
| `hooks/useTemplates.ts` | NEW - Template CRUD operations hook |
| `types.ts` | MODIFY - Add NoteTemplate type |
| `components/Sidebar.tsx` | MODIFY - Add virtual scrolling, template picker |
| `components/Editor.tsx` | MODIFY - Wrap with React.memo |
| `App.tsx` | MODIFY - Wrap callbacks with useCallback |
| `components/SettingsModal.tsx` | MODIFY - Add Templates tab |
| `package.json` | MODIFY - Add react-window |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install react-window**

Run: `npm install react-window`
Expected: Package added to package.json dependencies

- [ ] **Step 2: Install type definitions**

Run: `npm install -D @types/react-window`
Expected: Type definitions added

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add react-window for virtual scrolling"
```

---

### Task 2: Add NoteTemplate Type

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Add NoteTemplate interface**

At the end of `types.ts`, add:

```ts
export interface NoteTemplate {
  id: string;
  name: string;
  icon: string;
  content: string;
  format: 'markdown' | 'txt';
  isBuiltin: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add types.ts
git commit -m "feat: add NoteTemplate type definition"
```

---

### Task 3: Create useTemplates Hook

**Files:**
- Create: `hooks/useTemplates.ts`

- [ ] **Step 1: Create useTemplates hook**

Create `hooks/useTemplates.ts`:

```ts
import { useState, useCallback, useEffect } from 'react';
import { NoteTemplate } from '../types';

const STORAGE_KEY = 'daylo-templates';

const BUILTIN_TEMPLATES: NoteTemplate[] = [
  {
    id: 'builtin-journal',
    name: 'Daily Journal',
    icon: '📝',
    content: `# ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n## Today\n\n- \n\n## Notes\n\n`,
    format: 'markdown',
    isBuiltin: true,
  },
  {
    id: 'builtin-meeting',
    name: 'Meeting Notes',
    icon: '📋',
    content: `# Meeting: \n\n**Date**: ${new Date().toLocaleDateString()}\n**Attendees**: \n\n## Agenda\n\n## Discussion\n\n## Action Items\n\n- [ ] `,
    format: 'markdown',
    isBuiltin: true,
  },
  {
    id: 'builtin-weekly',
    name: 'Weekly Report',
    icon: '📊',
    content: `# Week ${Math.ceil((new Date().getDate()) / 7)}\n\n## Summary\n\n## Completed\n\n## In Progress\n\n## Next Week\n`,
    format: 'markdown',
    isBuiltin: true,
  },
  {
    id: 'builtin-reading',
    name: 'Reading Notes',
    icon: '📚',
    content: `# \n\n**Author**: \n**Date**: ${new Date().toLocaleDateString()}\n\n## Key Takeaways\n\n## Quotes\n\n## Thoughts\n`,
    format: 'markdown',
    isBuiltin: true,
  },
  {
    id: 'builtin-project',
    name: 'Project Plan',
    icon: '🎯',
    content: `# Project: \n\n## Overview\n\n## Goals\n\n## Timeline\n\n## Tasks\n\n- [ ] `,
    format: 'markdown',
    isBuiltin: true,
  },
];

const loadTemplates = (): NoteTemplate[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const custom = JSON.parse(stored) as NoteTemplate[];
      return [...BUILTIN_TEMPLATES, ...custom];
    }
  } catch (e) {
    console.error('Failed to load templates:', e);
  }
  return BUILTIN_TEMPLATES;
};

const saveCustomTemplates = (templates: NoteTemplate[]) => {
  const custom = templates.filter(t => !t.isBuiltin);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
};

export const useTemplates = () => {
  const [templates, setTemplates] = useState<NoteTemplate[]>(loadTemplates);

  useEffect(() => {
    saveCustomTemplates(templates);
  }, [templates]);

  const addTemplate = useCallback((template: Omit<NoteTemplate, 'id' | 'isBuiltin'>) => {
    const newTemplate: NoteTemplate = {
      ...template,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isBuiltin: false,
    };
    setTemplates(prev => [...prev, newTemplate]);
    return newTemplate;
  }, []);

  const updateTemplate = useCallback((id: string, updates: Partial<NoteTemplate>) => {
    setTemplates(prev => prev.map(t => 
      t.id === id && !t.isBuiltin ? { ...t, ...updates } : t
    ));
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id || t.isBuiltin));
  }, []);

  const getTemplate = useCallback((id: string) => {
    return templates.find(t => t.id === id);
  }, [templates]);

  const applyTemplate = useCallback((content: string): string => {
    return content
      .replace(/\{date\}/g, new Date().toLocaleDateString())
      .replace(/\{time\}/g, new Date().toLocaleTimeString())
      .replace(/\{datetime\}/g, new Date().toLocaleString())
      .replace(/\{week\}/g, String(Math.ceil(new Date().getDate() / 7)))
      .replace(/\{year\}/g, String(new Date().getFullYear()))
      .replace(/\{month\}/g, String(new Date().getMonth() + 1))
      .replace(/\{day\}/g, String(new Date().getDate()));
  }, []);

  return {
    templates,
    builtinTemplates: templates.filter(t => t.isBuiltin),
    customTemplates: templates.filter(t => !t.isBuiltin),
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    applyTemplate,
  };
};
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add hooks/useTemplates.ts
git commit -m "feat: add useTemplates hook for template CRUD operations"
```

---

### Task 4: Create TemplatePicker Component

**Files:**
- Create: `components/TemplatePicker.tsx`

- [ ] **Step 1: Create TemplatePicker component**

Create `components/TemplatePicker.tsx`:

```tsx
import React, { useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
import { NoteTemplate } from '../types';

interface TemplatePickerProps {
  templates: NoteTemplate[];
  onSelect: (template: NoteTemplate) => void;
  className?: string;
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({ templates, onSelect, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const builtinTemplates = templates.filter(t => t.isBuiltin);
  const customTemplates = templates.filter(t => !t.isBuiltin);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 text-sm rounded-md transition-colors hover:bg-[var(--interactive-hover)]"
        style={{ color: 'var(--text-muted)' }}
      >
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">Templates</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div 
            className="absolute top-full left-0 mt-1 w-56 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
          >
            {builtinTemplates.length > 0 && (
              <div className="p-1">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Built-in Templates
                </div>
                {builtinTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => { onSelect(template); setIsOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-[var(--interactive-hover)] transition-colors text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span className="text-base">{template.icon}</span>
                    <span>{template.name}</span>
                  </button>
                ))}
              </div>
            )}

            {customTemplates.length > 0 && (
              <div className="p-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  My Templates
                </div>
                {customTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => { onSelect(template); setIsOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-[var(--interactive-hover)] transition-colors text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span className="text-base">{template.icon}</span>
                    <span>{template.name}</span>
                  </button>
                ))}
              </div>
            )}

            {templates.length === 0 && (
              <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No templates available
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
git add components/TemplatePicker.tsx
git commit -m "feat: add TemplatePicker dropdown component"
```

---

### Task 5: Create TemplateManager Component

**Files:**
- Create: `components/TemplateManager.tsx`

- [ ] **Step 1: Create TemplateManager component**

Create `components/TemplateManager.tsx`:

```tsx
import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { NoteTemplate } from '../types';

interface TemplateManagerProps {
  templates: NoteTemplate[];
  onAdd: (template: Omit<NoteTemplate, 'id' | 'isBuiltin'>) => void;
  onUpdate: (id: string, updates: Partial<NoteTemplate>) => void;
  onDelete: (id: string) => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ templates, onAdd, onUpdate, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', icon: '📄', content: '', format: 'markdown' as 'markdown' | 'txt' });
  const [editTemplate, setEditTemplate] = useState<Partial<NoteTemplate>>({});

  const handleAdd = () => {
    if (newTemplate.name.trim() && newTemplate.content.trim()) {
      onAdd(newTemplate);
      setNewTemplate({ name: '', icon: '📄', content: '', format: 'markdown' });
      setIsAdding(false);
    }
  };

  const handleUpdate = (id: string) => {
    if (editTemplate.name && editTemplate.content) {
      onUpdate(id, editTemplate);
      setEditingId(null);
      setEditTemplate({});
    }
  };

  const startEdit = (template: NoteTemplate) => {
    setEditingId(template.id);
    setEditTemplate({ name: template.name, icon: template.icon, content: template.content, format: template.format });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Note Templates</h3>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <Plus className="w-3 h-3" /> Add Template
        </button>
      </div>

      {/* Add New Template Form */}
      {isAdding && (
        <div className="p-3 rounded-lg border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTemplate.icon}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, icon: e.target.value }))}
                className="w-12 px-2 py-1 text-sm rounded border text-center"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                placeholder="Icon"
              />
              <input
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                className="flex-1 px-2 py-1 text-sm rounded border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                placeholder="Template name"
              />
            </div>
            <textarea
              value={newTemplate.content}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
              className="w-full px-2 py-1 text-sm rounded border font-mono"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              placeholder="Template content (use {date}, {time}, {week} for placeholders)"
              rows={4}
            />
            <div className="flex gap-2">
              <select
                value={newTemplate.format}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, format: e.target.value as 'markdown' | 'txt' }))}
                className="px-2 py-1 text-sm rounded border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="markdown">Markdown</option>
                <option value="txt">Plain Text</option>
              </select>
              <div className="flex-1" />
              <button onClick={() => setIsAdding(false)} className="px-2 py-1 text-xs rounded hover:bg-[var(--interactive-hover)]" style={{ color: 'var(--text-muted)' }}>
                Cancel
              </button>
              <button onClick={handleAdd} className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template List */}
      <div className="space-y-2">
        {templates.map(template => (
          <div key={template.id} className="p-2 rounded-lg border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
            {editingId === template.id ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editTemplate.icon}
                    onChange={(e) => setEditTemplate(prev => ({ ...prev, icon: e.target.value }))}
                    className="w-12 px-2 py-1 text-sm rounded border text-center"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="text"
                    value={editTemplate.name}
                    onChange={(e) => setEditTemplate(prev => ({ ...prev, name: e.target.value }))}
                    className="flex-1 px-2 py-1 text-sm rounded border"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <textarea
                  value={editTemplate.content}
                  onChange={(e) => setEditTemplate(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-2 py-1 text-sm rounded border font-mono"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  rows={3}
                />
                <div className="flex gap-2">
                  <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs rounded hover:bg-[var(--interactive-hover)]" style={{ color: 'var(--text-muted)' }}>
                    Cancel
                  </button>
                  <button onClick={() => handleUpdate(template.id)} className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600">
                    Update
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{template.icon}</span>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{template.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{template.format} • {template.content.length} chars</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!template.isBuiltin && (
                    <>
                      <button onClick={() => startEdit(template)} className="p-1 rounded hover:bg-[var(--interactive-hover)]" style={{ color: 'var(--text-muted)' }}>
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => onDelete(template.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30" style={{ color: 'var(--text-muted)' }}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  {template.isBuiltin && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>Built-in</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
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
git add components/TemplateManager.tsx
git commit -m "feat: add TemplateManager component for settings"
```

---

### Task 6: Add Templates Tab to Settings

**Files:**
- Modify: `components/SettingsModal.tsx`

- [ ] **Step 1: Add Templates tab import and state**

In `SettingsModal.tsx`, add import for TemplateManager:

```tsx
import { TemplateManager } from './TemplateManager';
import { useTemplates } from '../hooks/useTemplates';
```

Add 'templates' to the SettingsTab type:

```tsx
type SettingsTab = 'general' | 'markdown' | 'canvas' | 'mindmap' | 'templates';
```

- [ ] **Step 2: Add useTemplates hook**

Inside the `SettingsModal` component, add:

```tsx
const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates();
```

- [ ] **Step 3: Add Templates tab to sidebar**

In the `renderSidebar` function, add a new button after MindMap:

```tsx
<button 
  onClick={() => setActiveTab('templates')}
  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'templates' ? 'bg-[var(--interactive-active)]' : 'hover:bg-[var(--interactive-hover)]'}`}
  style={{ color: activeTab === 'templates' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
>
  <FileText className="w-4 h-4" /> Templates
</button>
```

Add FileText to the lucide-react import at the top.

- [ ] **Step 4: Add Templates content**

In the content section, add:

```tsx
{activeTab === 'templates' && (
  <TemplateManager
    templates={templates}
    onAdd={addTemplate}
    onUpdate={updateTemplate}
    onDelete={deleteTemplate}
  />
)}
```

- [ ] **Step 5: Commit**

```bash
git add components/SettingsModal.tsx
git commit -m "feat: add Templates tab to Settings modal"
```

---

### Task 7: Integrate TemplatePicker into Sidebar

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Add TemplatePicker import**

In `Sidebar.tsx`, add:

```tsx
import { TemplatePicker } from './TemplatePicker';
import { useTemplates } from '../hooks/useTemplates';
```

- [ ] **Step 2: Add useTemplates hook**

Inside the `Sidebar` component, add:

```tsx
const { templates, applyTemplate } = useTemplates();
```

- [ ] **Step 3: Update handleCreateNote to support templates**

Modify the `handleCreateNote` call in `startCreateNote` to accept optional template content. Since we need to pass template content from the picker to the creation function, we'll update the flow.

Add a new function for template-based creation:

```tsx
const handleCreateFromTemplate = (template: NoteTemplate) => {
  if (creatingNoteInNotebookId) {
    const content = applyTemplate(template.content);
    onCreateNote(creatingNoteInNotebookId, '', template.format, content);
  }
};
```

- [ ] **Step 4: Add TemplatePicker to the notebook header**

In the `SortableNotebookTrigger` component, we need to pass the template handler. Since `SortableNotebookTrigger` is a separate component, we need to add a prop.

Actually, a simpler approach: Add the TemplatePicker directly in the notebook actions area. Let me update the notebook header in the main Sidebar render.

Find the notebook group rendering (around line 671-683) and add the TemplatePicker after the create note button:

Actually, let me simplify this. Instead of modifying the SortableNotebookTrigger, let's add the TemplatePicker to the new note creation flow. When the user clicks "New Note", they can choose a template.

Update the `startCreateNote` function to show a template picker first, or add the template picker as a separate button.

Let me revise: Add a template picker dropdown next to each notebook's "New Note" button. We need to modify the SortableNotebookTrigger to include it.

Update the SortableNotebookTriggerProps:

```tsx
interface SortableNotebookTriggerProps {
  notebook: Notebook;
  expanded: boolean;
  onToggle: () => void;
  onCreateSpecial: (format: 'canvas' | 'mindmap', e: React.MouseEvent) => void;
  onCreateNote: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onImport: (e: React.MouseEvent) => void;
  onCreateFromTemplate: (template: NoteTemplate) => void;
  noteCount: number;
  disabled?: boolean;
}
```

Update the SortableNotebookTrigger component to accept and use the template picker:

```tsx
function SortableNotebookTrigger({ 
  notebook, expanded, onToggle, onCreateSpecial, onCreateNote, onDelete, onImport, onCreateFromTemplate, noteCount, disabled 
}: SortableNotebookTriggerProps) {
  // ... existing code
  
  // Add TemplatePicker in the action buttons area
  return (
    // ... existing JSX
    <div className={`flex items-center transition-opacity ${expanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
      {/* Existing buttons */}
      {!disabled && (
        <TemplatePicker
          templates={templates}
          onSelect={(template) => onCreateFromTemplate(template)}
        />
      )}
      {/* ... rest of buttons */}
    </div>
  );
}
```

Wait, this requires passing `templates` to the SortableNotebookTrigger. Let me simplify further.

Actually, the cleanest approach is to add the TemplatePicker as a separate element in the notebook group, not inside SortableNotebookTrigger. Let me revise.

- [ ] **Step 4: Add TemplatePicker next to new note button**

In the notebook group rendering (around line 671-683), update to include a TemplatePicker:

```tsx
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
    {/* Template Picker for this notebook */}
    {expandedNotebooks.has(group.id) && !disabled && (
      <div className="ml-6 mb-1">
        <TemplatePicker
          templates={templates}
          onSelect={(template) => {
            const content = applyTemplate(template.content);
            onCreateNote(group.id, '', template.format, content);
            const newExpanded = new Set(expandedNotebooks);
            newExpanded.add(group.id);
            setExpandedNotebooks(newExpanded);
          }}
        />
      </div>
    )}
    {/* Notes List */}
    {/* ... */}
  </div>
))}
```

- [ ] **Step 5: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: integrate TemplatePicker into Sidebar notebook view"
```

---

### Task 8: Add Virtual Scrolling to Sidebar

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Add react-window import**

In `Sidebar.tsx`, add:

```tsx
import { FixedSizeList as List } from 'react-window';
```

- [ ] **Step 2: Create VirtualNoteItem wrapper**

Inside the `Sidebar` component, create a wrapper for the virtual list:

```tsx
interface VirtualNoteItemProps {
  note: Note;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRequestDelete: (id: string, title: string, e: React.MouseEvent) => void;
}

const VirtualNoteItem: React.FC<VirtualNoteItemProps> = ({ note, isActive, onSelect, onRequestDelete }) => (
  <NoteItem
    note={note}
    isActive={isActive}
    onSelect={() => onSelect(note.id)}
    onRequestDelete={(e) => onRequestDelete(note.id, note.title, e)}
  />
);
```

- [ ] **Step 3: Add virtual scrolling to search results**

Find the search results section (around line 630-639) and replace with virtual scrolling:

```tsx
{isSearching ? (
  <div>
    <h3 className="px-2 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Search Results</h3>
    {filteredNotes.length === 0 ? (
      <div className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No matches found.</div>
    ) : filteredNotes.length > 50 ? (
      <List
        height={400}
        itemCount={filteredNotes.length}
        itemSize={40}
        width="100%"
      >
        {({ index, style }) => (
          <div style={style}>
            <VirtualNoteItem
              note={filteredNotes[index]}
              isActive={activeNoteId === filteredNotes[index].id}
              onSelect={onSelectNote}
              onRequestDelete={requestDeleteNote}
            />
          </div>
        )}
      </List>
    ) : (
      <ul className="space-y-0.5">
        {filteredNotes.map(note => (
          <NoteItem key={note.id} note={note} isActive={activeNoteId === note.id} onSelect={() => onSelectNote(note.id)} onRequestDelete={(e) => requestDeleteNote(note.id, note.title, e)} />
        ))}
      </ul>
    )}
  </div>
) : (
  // ... rest of the non-search view
)}
```

- [ ] **Step 4: Add virtual scrolling to notebook note lists**

For each notebook's note list (around line 695-712), add virtual scrolling when notes exceed 50:

```tsx
<SortableContext items={group.notes.map(n => n.id)} strategy={verticalListSortingStrategy} disabled={!isDnDEnabled}>
  {group.notes.length === 0 && !creatingNoteInNotebookId ? (
    <div className="pl-4 py-2 text-xs italic" style={{ color: 'var(--text-muted)' }}>Empty notebook</div>
  ) : group.notes.length > 50 ? (
    <List
      height={Math.min(group.notes.length * 40, 400)}
      itemCount={group.notes.length}
      itemSize={40}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <SortableNoteItem
            note={group.notes[index]}
            isActive={activeNoteId === group.notes[index].id}
            onSelect={() => onSelectNote(group.notes[index].id)}
            onRequestDelete={(e) => requestDeleteNote(group.notes[index].id, group.notes[index].title, e)}
            disabled={!isDnDEnabled}
          />
        </div>
      )}
    </List>
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
```

- [ ] **Step 5: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: add virtual scrolling for large note lists"
```

---

### Task 9: Add React.memo Optimizations

**Files:**
- Modify: `components/Editor.tsx`, `App.tsx`

- [ ] **Step 1: Wrap NoteItem with React.memo**

In `Sidebar.tsx`, find the `NoteItem` component definition (search for `const NoteItem` or `function NoteItem`) and wrap it with React.memo:

```tsx
const NoteItem = React.memo(({ note, isActive, onSelect, onRequestDelete, showPinIcon }: NoteItemProps) => {
  // ... existing NoteItem implementation
});
```

- [ ] **Step 2: Wrap Editor with React.memo**

In `Editor.tsx`, wrap the Editor component:

```tsx
export const Editor: React.FC<EditorProps> = React.memo(({ 
  note, 
  onUpdate, 
  isSidebarOpen, 
  onToggleSidebar,
  isFocusMode,
  onToggleFocusMode,
  availableTags = [],
  user
}) => {
  // ... existing Editor implementation
});
```

- [ ] **Step 3: Add useCallback to App.tsx handlers**

In `App.tsx`, wrap the handler functions with useCallback:

```tsx
const handleCreateNote = useCallback(async (notebookId: string, title?: string, format?: NoteFormat, content: string = "") => {
  // ... existing implementation
}, [notebooks, user, settings.defaultNoteFormat]);

const handleUpdateNote = useCallback(async (updatedNote: Note) => {
  // ... existing implementation
}, []);

const handleDeleteNote = useCallback(async (id: string) => {
  // ... existing implementation
}, [activeNoteId, notes]);
```

- [ ] **Step 4: Add useMemo for filtered notes**

In `Sidebar.tsx`, wrap the filtered notes computation with useMemo:

```tsx
const filteredNotes = useMemo(() => {
  const searchFiltered = notes.filter(note => 
    (note.title && note.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (note.content && note.content.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const tagFiltered = selectedTag 
    ? searchFiltered.filter(n => Array.isArray(n.tags) && n.tags.includes(selectedTag))
    : searchFiltered;

  return tagFiltered.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    return b.updatedAt - a.updatedAt;
  });
}, [notes, searchTerm, selectedTag]);
```

- [ ] **Step 5: Commit**

```bash
git add components/Editor.tsx components/Sidebar.tsx App.tsx
git commit -m "perf: add React.memo and useCallback optimizations"
```

---

### Task 10: Final Verification

**Files:**
- All modified files

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Test virtual scrolling**

1. Create more than 50 notes in a notebook
2. Verify the note list renders correctly
3. Verify scrolling is smooth
4. Verify search still works with virtual scrolling

- [ ] **Step 4: Test templates**

1. Open Settings > Templates tab
2. Create a new custom template
3. Go to Sidebar, click on a notebook's template picker
4. Select a template and verify note is created with template content
5. Verify placeholders ({date}, {time}) are replaced

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Batch 2 - Performance optimization and Note templates"
```

---

## Summary

After completing all tasks, the app will have:

1. **Virtual Scrolling**: Large note lists (>50 items) use react-window for smooth rendering
2. **React.memo**: Components only re-render when props change
3. **useCallback**: Event handlers are memoized to prevent unnecessary re-renders
4. **Note Templates**: Built-in and custom templates with placeholder substitution
5. **Template Management**: Settings panel to create, edit, and delete custom templates

Total new files: 3 (`TemplatePicker.tsx`, `TemplateManager.tsx`, `useTemplates.ts`)
Total modified files: 6 (`types.ts`, `Sidebar.tsx`, `Editor.tsx`, `App.tsx`, `SettingsModal.tsx`, `package.json`)
Total new dependencies: 2 (`react-window`, `@types/react-window`)
