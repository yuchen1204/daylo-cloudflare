# MCP Tools Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose all user-executable operations through MCP tools and resources.

**Architecture:** Add 5 new tools and extend 2 existing tools in `functions/mcp-tools.ts`. Add `resources/list` and extend `resources/read` in `functions/[[route]].ts`. No schema changes.

**Tech Stack:** TypeScript, Cloudflare Workers (D1), MCP protocol

---

### Task 1: Extend `update_note` with new optional params

**Files:**
- Modify: `functions/mcp-tools.ts:130-171` (updateNoteTool)

- [ ] **Step 1: Update inputSchema to add new optional parameters**

In `updateNoteTool.inputSchema.properties`, add:

```ts
is_pinned: { type: 'boolean', description: 'Pin or unpin the note' },
notebook_id: { type: 'string', description: 'Move note to another notebook' },
format: { type: 'string', enum: ['markdown', 'txt', 'canvas', 'mindmap'], description: 'Change note format' },
```

- [ ] **Step 2: Update the SQL query and bind params**

Replace the handler's SQL and bind section:

```ts
handler: async (input, db, userId) => {
    const existing = await db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
      .bind(input.note_id, userId)
      .first();
    
    if (!existing) {
      throw new Error('Note not found');
    }

    await db.prepare(
      `UPDATE notes SET
        title = COALESCE(?, title),
        content = COALESCE(?, content),
        tags = COALESCE(?, tags),
        is_pinned = COALESCE(?, is_pinned),
        notebook_id = COALESCE(?, notebook_id),
        format = COALESCE(?, format),
        updated_at = unixepoch()
      WHERE id = ? AND user_id = ?`
    )
      .bind(
        input.title ?? null,
        input.content ?? null,
        input.tags ? JSON.stringify(input.tags) : null,
        input.is_pinned !== undefined ? (input.is_pinned ? 1 : 0) : null,
        input.notebook_id ?? null,
        input.format ?? null,
        input.note_id,
        userId
      )
      .run();

    return { success: true };
  },
```

- [ ] **Step 3: Commit**

```bash
git add functions/mcp-tools.ts
git commit -m "feat(mcp): extend update_note with is_pinned, notebook_id, format params"
```

---

### Task 2: Extend `list_notes` with `pinned_only` filter

**Files:**
- Modify: `functions/mcp-tools.ts:38-68` (listNotesTool)

- [ ] **Step 1: Update inputSchema**

In `listNotesTool.inputSchema.properties`, add:

```ts
pinned_only: { type: 'boolean', description: 'If true, only return pinned notes' },
```

- [ ] **Step 2: Update the handler to filter by is_pinned**

Replace the handler:

```ts
handler: async (input, db, userId) => {
    let query = 'SELECT id, title, format, tags, notebook_id, is_pinned, created_at, updated_at FROM notes WHERE user_id = ?';
    const params: string[] = [userId];

    if (input.notebook_id) {
      query += ' AND notebook_id = ?';
      params.push(input.notebook_id as string);
    }

    if (input.pinned_only) {
      query += ' AND is_pinned = 1';
    }

    const { results } = await db.prepare(query).bind(...params).all();
    
    if (input.tag) {
      return results.filter((note: any) => {
        const tags = JSON.parse(note.tags || '[]');
        return tags.includes(input.tag);
      });
    }
    
    return results;
  },
```

- [ ] **Step 3: Commit**

```bash
git add functions/mcp-tools.ts
git commit -m "feat(mcp): add pinned_only filter to list_notes"
```

---

### Task 3: Add `update_notebook` tool

**Files:**
- Modify: `functions/mcp-tools.ts` (add before `deleteNotebookTool`)

- [ ] **Step 1: Add the updateNotebookTool definition**

Insert before `deleteNotebookTool`:

```ts
const updateNotebookTool: MCPTool = {
  name: 'update_notebook',
  description: 'Update notebook name, color, or icon',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: { type: 'string', description: 'Notebook ID' },
      name: { type: 'string', description: 'New notebook name' },
      color: { type: 'string', description: 'Hex color code (e.g. "#ff0000")' },
      icon: { type: 'string', description: 'Icon identifier' },
    },
    required: ['notebook_id'],
  },
  handler: async (input, db, userId) => {
    const existing = await db.prepare('SELECT id FROM notebooks WHERE id = ? AND user_id = ?')
      .bind(input.notebook_id, userId)
      .first();
    
    if (!existing) {
      throw new Error('Notebook not found');
    }

    await db.prepare(
      `UPDATE notebooks SET
        name = COALESCE(?, name),
        color = COALESCE(?, color),
        icon = COALESCE(?, icon)
      WHERE id = ? AND user_id = ?`
    )
      .bind(
        input.name ?? null,
        input.color ?? null,
        input.icon ?? null,
        input.notebook_id,
        userId
      )
      .run();

    return { success: true };
  },
};
```

- [ ] **Step 2: Add to mcpTools array**

In the `mcpTools` array export, add `updateNotebookTool` before `deleteNotebookTool`:

```ts
export const mcpTools: MCPTool[] = [
  listNotesTool,
  getNoteTool,
  createNoteTool,
  updateNoteTool,
  deleteNoteTool,
  searchNotesTool,
  listNotebooksTool,
  createNotebookTool,
  updateNotebookTool,
  deleteNotebookTool,
];
```

- [ ] **Step 3: Commit**

```bash
git add functions/mcp-tools.ts
git commit -m "feat(mcp): add update_notebook tool"
```

---

### Task 4: Add `list_tags` tool

**Files:**
- Modify: `functions/mcp-tools.ts` (add after `searchNotesTool`)

- [ ] **Step 1: Add the listTagsTool definition**

Insert after `searchNotesTool`:

```ts
const listTagsTool: MCPTool = {
  name: 'list_tags',
  description: 'List all unique tags across notes with counts',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (_input, db, userId) => {
    const { results } = await db.prepare('SELECT tags FROM notes WHERE user_id = ?')
      .bind(userId)
      .all();

    const counts = new Map<string, number>();
    for (const row of results) {
      const tags = JSON.parse((row as any).tags || '[]');
      for (const tag of tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  },
};
```

- [ ] **Step 2: Add to mcpTools array**

Add `listTagsTool` after `searchNotesTool` in the array:

```ts
export const mcpTools: MCPTool[] = [
  listNotesTool,
  getNoteTool,
  createNoteTool,
  updateNoteTool,
  deleteNoteTool,
  searchNotesTool,
  listTagsTool,
  listNotebooksTool,
  createNotebookTool,
  updateNotebookTool,
  deleteNotebookTool,
];
```

- [ ] **Step 3: Commit**

```bash
git add functions/mcp-tools.ts
git commit -m "feat(mcp): add list_tags tool"
```

---

### Task 5: Add `restore_note_history` tool

**Files:**
- Modify: `functions/mcp-tools.ts` (add after `deleteNoteTool`)

- [ ] **Step 1: Add the restoreNoteHistoryTool definition**

Insert after `deleteNoteTool`:

```ts
const restoreNoteHistoryTool: MCPTool = {
  name: 'restore_note_history',
  description: 'Restore a note to specific content',
  inputSchema: {
    type: 'object',
    properties: {
      note_id: { type: 'string', description: 'Note ID' },
      content: { type: 'string', description: 'Content to restore' },
    },
    required: ['note_id', 'content'],
  },
  handler: async (input, db, userId) => {
    const existing = await db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
      .bind(input.note_id, userId)
      .first();
    
    if (!existing) {
      throw new Error('Note not found');
    }

    await db.prepare(
      `UPDATE notes SET content = ?, updated_at = unixepoch()
       WHERE id = ? AND user_id = ?`
    )
      .bind(input.content, input.note_id, userId)
      .run();

    return { success: true, message: 'Note restored' };
  },
};
```

- [ ] **Step 2: Add to mcpTools array**

Add `restoreNotebookTool` after `deleteNoteTool` in the array:

```ts
export const mcpTools: MCPTool[] = [
  listNotesTool,
  getNoteTool,
  createNoteTool,
  updateNoteTool,
  deleteNoteTool,
  restoreNoteHistoryTool,
  searchNotesTool,
  listTagsTool,
  listNotebooksTool,
  createNotebookTool,
  updateNotebookTool,
  deleteNotebookTool,
];
```

- [ ] **Step 3: Commit**

```bash
git add functions/mcp-tools.ts
git commit -m "feat(mcp): add restore_note_history tool"
```

---

### Task 6: Add `get_settings` and `update_settings` tools

**Files:**
- Modify: `functions/mcp-tools.ts` (add after `restoreNoteHistoryTool`)

- [ ] **Step 1: Add getSettingsTool**

```ts
const DEFAULT_SETTINGS = {
  defaultNoteFormat: 'markdown',
  theme: 'light',
  historySnapshotInterval: 120000,
  markdown: { fontSize: 14, fontFamily: 'sans', lineHeight: 1.5 },
  canvas: { gridSize: 20, showGrid: true, snapToGrid: true },
  mindmap: { layout: 'radial', curveStyle: 'bezier' }
};

const getSettingsTool: MCPTool = {
  name: 'get_settings',
  description: 'Get user settings',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (_input, db, userId) => {
    const row = await db.prepare('SELECT data FROM settings WHERE user_id = ?')
      .bind(userId)
      .first<{ data: string }>();
    
    if (!row) return DEFAULT_SETTINGS;
    
    const stored = JSON.parse(row.data);
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      markdown: { ...DEFAULT_SETTINGS.markdown, ...(stored.markdown || {}) },
      canvas: { ...DEFAULT_SETTINGS.canvas, ...(stored.canvas || {}) },
      mindmap: { ...DEFAULT_SETTINGS.mindmap, ...(stored.mindmap || {}) }
    };
  },
};
```

- [ ] **Step 2: Add updateSettingsTool**

```ts
const updateSettingsTool: MCPTool = {
  name: 'update_settings',
  description: 'Update user settings (partial merge)',
  inputSchema: {
    type: 'object',
    properties: {
      settings: { type: 'object', description: 'Partial settings to merge' },
    },
    required: ['settings'],
  },
  handler: async (input, db, userId) => {
    // Get current settings
    const row = await db.prepare('SELECT data FROM settings WHERE user_id = ?')
      .bind(userId)
      .first<{ data: string }>();
    
    const current = row ? JSON.parse(row.data) : DEFAULT_SETTINGS;
    const merged = {
      ...current,
      ...(input.settings as Record<string, unknown>),
      markdown: { ...current.markdown, ...((input.settings as any).markdown || {}) },
      canvas: { ...current.canvas, ...((input.settings as any).canvas || {}) },
      mindmap: { ...current.mindmap, ...((input.settings as any).mindmap || {}) }
    };

    await db.prepare(
      `INSERT INTO settings (user_id, data, updated_at)
       VALUES (?, ?, unixepoch())
       ON CONFLICT(user_id) DO UPDATE
       SET data = ?, updated_at = unixepoch()`
    )
      .bind(userId, JSON.stringify(merged), JSON.stringify(merged))
      .run();

    return { success: true, settings: merged };
  },
};
```

- [ ] **Step 3: Add both to mcpTools array**

```ts
export const mcpTools: MCPTool[] = [
  listNotesTool,
  getNoteTool,
  createNoteTool,
  updateNoteTool,
  deleteNoteTool,
  restoreNoteHistoryTool,
  searchNotesTool,
  listTagsTool,
  listNotebooksTool,
  createNotebookTool,
  updateNotebookTool,
  deleteNotebookTool,
  getSettingsTool,
  updateSettingsTool,
];
```

- [ ] **Step 4: Commit**

```bash
git add functions/mcp-tools.ts
git commit -m "feat(mcp): add get_settings and update_settings tools"
```

---

### Task 7: Add `resources/list` handler and extend `resources/read`

**Files:**
- Modify: `functions/[[route]].ts` (add resources/list handler, extend resources/read)

- [ ] **Step 1: Add resources/list handler**

In the MCP messages endpoint handler (after the `resources/read` block), add:

```ts
// Handle resources/list
if (body.method === 'resources/list') {
  return json({
    jsonrpc: '2.0',
    id: body.id,
    result: {
      resources: [
        {
          uri: 'resources://notes',
          name: 'All Notes',
          mimeType: 'application/json',
          description: 'List of all notes with metadata',
        },
        {
          uri: 'resources://notebooks',
          name: 'All Notebooks',
          mimeType: 'application/json',
          description: 'List of all notebooks',
        },
      ],
    },
  });
}
```

- [ ] **Step 2: Extend resources/read to handle new URIs**

In the existing `resources/read` handler, add new URI patterns before the error fallback:

```ts
// Handle resources://notes
if (uri === 'resources://notes') {
  if (!mcpUserId) throw new Error('No user associated with this API key');
  const { results } = await env.DB.prepare(
    'SELECT id, title, format, tags, notebook_id, is_pinned, created_at, updated_at FROM notes WHERE user_id = ?'
  ).bind(mcpUserId).all();
  return json({
    jsonrpc: '2.0',
    id: body.id,
    result: {
      contents: [{
        uri: 'resources://notes',
        mimeType: 'application/json',
        text: JSON.stringify(results.map((n: any) => ({
          ...n, tags: JSON.parse(n.tags || '[]')
        })), null, 2),
      }],
    },
  });
}

// Handle resources://notebooks
if (uri === 'resources://notebooks') {
  if (!mcpUserId) throw new Error('No user associated with this API key');
  const { results } = await env.DB.prepare(
    'SELECT * FROM notebooks WHERE user_id = ?'
  ).bind(mcpUserId).all();
  return json({
    jsonrpc: '2.0',
    id: body.id,
    result: {
      contents: [{
        uri: 'resources://notebooks',
        mimeType: 'application/json',
        text: JSON.stringify(results, null, 2),
      }],
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add functions/[[route]].ts
git commit -m "feat(mcp): add resources/list and resources:// URIs for notes and notebooks"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: No errors in `functions/mcp-tools.ts` or `functions/[[route]].ts`

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 3: Final commit (if needed)**

```bash
git add -A
git commit -m "feat(mcp): complete MCP tools expansion"
```
