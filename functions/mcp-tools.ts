import { D1Database } from '@cloudflare/workers-types';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>, db: D1Database, userId: string) => Promise<unknown>;
}

export interface MCPToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const CHUNK_THRESHOLD = 4096; // 4KB

function createResult(data: unknown, isError = false): MCPToolResult {
  const text = JSON.stringify(data, null, 2);
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

function createChunkedResult(data: unknown): { chunks: string[]; final: MCPToolResult } {
  const text = JSON.stringify(data, null, 2);
  if (text.length <= CHUNK_THRESHOLD) {
    return { chunks: [], final: createResult(data) };
  }
  
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_THRESHOLD) {
    chunks.push(text.slice(i, i + CHUNK_THRESHOLD));
  }
  return { chunks, final: createResult(data) };
}

const listNotesTool: MCPTool = {
  name: 'list_notes',
  description: `List all notes in the user's library. Returns note metadata including id, title, format, tags, notebook_id, pin status, and timestamps.

Optional filters:
- notebook_id: Only return notes in a specific notebook
- tag: Only return notes with a specific tag
- pinned_only: If true, only return notes that are pinned

Note formats: "markdown" (rich text), "txt" (plain text), "canvas" (drawing), "mindmap" (visual mind map).`,
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: { type: 'string', description: 'Filter by notebook ID' },
      tag: { type: 'string', description: 'Filter by tag name' },
      pinned_only: { type: 'boolean', description: 'If true, only return pinned notes' },
    },
  },
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
};

const getNoteTool: MCPTool = {
  name: 'get_note',
  description: `Get a single note by ID, including full content. Returns all note fields: id, title, content, format, tags, notebook_id, is_pinned, created_at, updated_at.

Content format depends on note type:
- "markdown": Markdown text string
- "txt": Plain text string
- "canvas": JSON array of drawing strokes
- "mindmap": JSON array of mind map nodes`,
  inputSchema: {
    type: 'object',
    properties: {
      note_id: { type: 'string', description: 'Note ID to retrieve' },
    },
    required: ['note_id'],
  },
  handler: async (input, db, userId) => {
    const note = await db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?')
      .bind(input.note_id, userId)
      .first();
    
    if (!note) {
      throw new Error('Note not found');
    }
    
    return { ...note, tags: JSON.parse((note as any).tags || '[]') };
  },
};

const createNoteTool: MCPTool = {
  name: 'create_note',
  description: `Create a new note. If notebook_id is not provided, the note is created in the first available notebook.

FORMAT OPTIONS:

1. "markdown" (default) - Rich text with Markdown syntax
   Content: Markdown text string
   Example: "# Hello\\n\\nThis is **bold** and *italic* text."

2. "txt" - Plain text, no formatting
   Content: Raw text string
   Example: "Just plain text here."

3. "canvas" - Drawing/whiteboard for sketches and diagrams
   Content: JSON array of stroke objects (or "[]" for empty canvas)
   Stroke format: {"points":[{"x":100,"y":100},{"x":200,"y":200}],"color":"#000000","width":3,"type":"pen"}
   - type: "pen" (drawing) or "eraser" (erase)
   - color: Hex color string
   - width: Stroke width in pixels
   - points: Array of {x, y} coordinates

4. "mindmap" - Visual mind map for brainstorming and organizing ideas
   Content: JSON array of node objects
   Node format: {"id":"unique-id","text":"Topic","x":400,"y":300,"children":["child-id"],"parentId":null,"color":"#3b82f6"}
   - id: Unique identifier for the node
   - text: Display text
   - x, y: Position coordinates
   - children: Array of child node IDs
   - parentId: Parent node ID (null for root)
   - color: Hex color string`,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Note title' },
      content: { type: 'string', description: 'Note content (format depends on note type)' },
      format: { type: 'string', enum: ['markdown', 'txt', 'canvas', 'mindmap'], description: 'Note format: markdown, txt, canvas, or mindmap' },
      notebook_id: { type: 'string', description: 'Notebook ID (optional, uses first available notebook if not provided)' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags for organizing notes' },
    },
    required: ['title', 'content'],
  },
  handler: async (input, db, userId) => {
    const id = crypto.randomUUID();
    const notebookId = input.notebook_id as string || 
      (await db.prepare('SELECT id FROM notebooks WHERE user_id = ? LIMIT 1').bind(userId).first<{ id: string }>())?.id;
    
    if (!notebookId) {
      throw new Error('No notebook found. Create a notebook first.');
    }

    await db.prepare(
      'INSERT INTO notes (id, user_id, notebook_id, title, content, format, tags) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(
        id, userId, notebookId, input.title, input.content,
        (input.format as string) || 'markdown',
        JSON.stringify(input.tags || [])
      )
      .run();

    return { id, success: true };
  },
};

const updateNoteTool: MCPTool = {
  name: 'update_note',
  description: `Update an existing note. Only provided fields will be updated - existing values are preserved (COALESCE).

Use this to:
- Edit note content or title
- Add/remove tags
- Pin or unpin a note
- Move a note to a different notebook
- Change the note format (warning: this changes the content structure)

CONTENT FORMAT (by note type):
- "markdown": Markdown text string
- "txt": Plain text string
- "canvas": JSON array of stroke objects: [{"points":[{"x":100,"y":100}],"color":"#000000","width":3,"type":"pen"}]
- "mindmap": JSON array of node objects: [{"id":"node-1","text":"Topic","x":400,"y":300,"children":[],"parentId":null,"color":"#3b82f6"}]`,
  inputSchema: {
    type: 'object',
    properties: {
      note_id: { type: 'string', description: 'Note ID to update' },
      title: { type: 'string', description: 'New title' },
      content: { type: 'string', description: 'New content (format depends on note type)' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags (replaces existing tags)' },
      is_pinned: { type: 'boolean', description: 'Pin (true) or unpin (false) the note' },
      notebook_id: { type: 'string', description: 'Move note to another notebook' },
      format: { type: 'string', enum: ['markdown', 'txt', 'canvas', 'mindmap'], description: 'Change note format' },
    },
    required: ['note_id'],
  },
  handler: async (input, db, userId) => {
    const existing = await db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
      .bind(input.note_id, userId)
      .first();
    
    if (!existing) {
      throw new Error('Note not found');
    }

    // Validate notebook_id if provided
    if (input.notebook_id) {
      const notebook = await db.prepare('SELECT id FROM notebooks WHERE id = ? AND user_id = ?')
        .bind(input.notebook_id, userId)
        .first();
      if (!notebook) {
        throw new Error('Notebook not found');
      }
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
};

const deleteNoteTool: MCPTool = {
  name: 'delete_note',
  description: `Permanently delete a note. This action cannot be undone.

The note must belong to the user. If the note is pinned, it will be unpinned automatically before deletion.`,
  inputSchema: {
    type: 'object',
    properties: {
      note_id: { type: 'string', description: 'Note ID to delete' },
    },
    required: ['note_id'],
  },
  handler: async (input, db, userId) => {
    const existing = await db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
      .bind(input.note_id, userId)
      .first();
    
    if (!existing) {
      throw new Error('Note not found');
    }

    await db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
      .bind(input.note_id, userId)
      .run();

    return { success: true };
  },
};

const restoreNoteHistoryTool: MCPTool = {
  name: 'restore_note_history',
  description: `Restore a note's content to a specific version. This creates a new history entry with the provided content.

Use this to undo changes or revert to a previous version of a note. The content must match the note's format:
- "markdown": Markdown text
- "txt": Plain text
- "canvas": JSON array of strokes
- "mindmap": JSON array of nodes`,
  inputSchema: {
    type: 'object',
    properties: {
      note_id: { type: 'string', description: 'Note ID to restore' },
      content: { type: 'string', description: 'Content to restore to' },
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
  description: `Get the user's current settings. Returns the full settings object with defaults applied.

Settings structure:
- defaultNoteFormat: Default format for new notes ("markdown", "txt", "canvas", or "mindmap")
- theme: UI theme ("light" or "dark")
- historySnapshotInterval: How often to save history snapshots (in milliseconds)
- markdown: Markdown editor settings (fontSize, fontFamily, lineHeight)
- canvas: Canvas editor settings (gridSize, showGrid, snapToGrid)
- mindmap: Mind map settings (layout: "radial"|"horizontal"|"vertical", curveStyle: "straight"|"step"|"bezier")`,
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

const updateSettingsTool: MCPTool = {
  name: 'update_settings',
  description: `Update user settings. Only provided fields will be merged - existing settings are preserved.

Example updates:
- Change default note format: {"defaultNoteFormat": "canvas"}
- Change markdown font size: {"markdown": {"fontSize": 16}}
- Change mind map layout: {"mindmap": {"layout": "horizontal"}}
- Change theme: {"theme": "dark"}`,
  inputSchema: {
    type: 'object',
    properties: {
      settings: { type: 'object', description: 'Partial settings object to merge with existing settings' },
    },
    required: ['settings'],
  },
  handler: async (input, db, userId) => {
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

const searchNotesTool: MCPTool = {
  name: 'search_notes',
  description: `Search across all notes by title and content. Returns matching notes with metadata.

The search is case-insensitive and matches partial strings. For example, searching "react" will find notes containing "React", "react hooks", "reaction", etc.

Use this to find notes on a specific topic or keyword.`,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query string' },
    },
    required: ['query'],
  },
  handler: async (input, db, userId) => {
    const { results } = await db.prepare(
      "SELECT id, title, content, format, tags, notebook_id, is_pinned, created_at, updated_at FROM notes WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)"
    )
      .bind(userId, `%${input.query}%`, `%${input.query}%`)
      .all();

    return results.map((note: any) => ({
      ...note,
      tags: JSON.parse(note.tags || '[]'),
    }));
  },
};

const listTagsTool: MCPTool = {
  name: 'list_tags',
  description: `List all unique tags used across all notes, sorted by frequency (most used first).

Returns an array of objects with "tag" (tag name) and "count" (number of notes using this tag). Useful for understanding the user's tagging system and finding common topics.`,
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

const listNotebooksTool: MCPTool = {
  name: 'list_notebooks',
  description: `List all notebooks in the user's library. Notebooks are used to organize notes into groups.

Returns notebook metadata: id, name, created_at. Notebooks can contain notes of any format (markdown, txt, canvas, mindmap).`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (_input, db, userId) => {
    const { results } = await db.prepare('SELECT * FROM notebooks WHERE user_id = ?')
      .bind(userId)
      .all();
    return results;
  },
};

const createNotebookTool: MCPTool = {
  name: 'create_notebook',
  description: `Create a new notebook to organize notes. Notebooks are like folders that contain notes.

Every user has a default "Default" notebook. Create additional notebooks to categorize notes by topic, project, or any other system.`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Notebook name (e.g. "Work", "Personal", "Project Ideas")' },
    },
    required: ['name'],
  },
  handler: async (input, db, userId) => {
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO notebooks (id, user_id, name) VALUES (?, ?, ?)')
      .bind(id, userId, input.name)
      .run();
    return { id, success: true };
  },
};

const updateNotebookTool: MCPTool = {
  name: 'update_notebook',
  description: `Update a notebook's properties. All fields except notebook_id are optional - only provided fields will be updated.

Properties:
- name: Notebook display name
- color: Hex color code for the notebook icon (e.g. "#ff0000" for red, "#3b82f6" for blue)
- icon: Icon identifier (lucide-react icon name, e.g. "Folder", "Book", "Code", "Heart", "Star")`,
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: { type: 'string', description: 'Notebook ID to update' },
      name: { type: 'string', description: 'New notebook name' },
      color: { type: 'string', description: 'Hex color code (e.g. "#ff0000")' },
      icon: { type: 'string', description: 'Icon identifier (lucide-react icon name)' },
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

const deleteNotebookTool: MCPTool = {
  name: 'delete_notebook',
  description: `Permanently delete a notebook. This action cannot be undone.

WARNING: All notes inside this notebook will also be deleted. Make sure to move or export important notes before deleting.`,
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: { type: 'string', description: 'Notebook ID to delete' },
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

    await db.prepare('DELETE FROM notebooks WHERE id = ? AND user_id = ?')
      .bind(input.notebook_id, userId)
      .run();

    return { success: true };
  },
};

const shareNoteTool: MCPTool = {
  name: 'share_note',
  description: `Make a note publicly accessible via a share link. Returns the share URL.

The note will be viewable by anyone with the link. The public page shows the note title, content, tags, and last updated date (no editing).`,
  inputSchema: {
    type: 'object',
    properties: {
      note_id: { type: 'string', description: 'Note ID to share' },
    },
    required: ['note_id'],
  },
  handler: async (input, db, userId) => {
    const existing = await db.prepare('SELECT id, public_link_id FROM notes WHERE id = ? AND user_id = ?')
      .bind(input.note_id, userId)
      .first<{ id: string; public_link_id: string | null }>();

    if (!existing) {
      throw new Error('Note not found');
    }

    const linkId = existing.public_link_id || crypto.randomUUID();

    await db.prepare(
      'UPDATE notes SET is_public = 1, public_link_id = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?'
    )
      .bind(linkId, input.note_id, userId)
      .run();

    const shareUrl = `https://daylo-app.pages.dev/share/${linkId}`;
    return { success: true, share_url: shareUrl, link_id: linkId };
  },
};

const unshareNoteTool: MCPTool = {
  name: 'unshare_note',
  description: `Make a note private by disabling its public share link. The note will no longer be accessible via the share URL.`,
  inputSchema: {
    type: 'object',
    properties: {
      note_id: { type: 'string', description: 'Note ID to make private' },
    },
    required: ['note_id'],
  },
  handler: async (input, db, userId) => {
    const existing = await db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
      .bind(input.note_id, userId)
      .first();

    if (!existing) {
      throw new Error('Note not found');
    }

    await db.prepare(
      'UPDATE notes SET is_public = 0, public_link_id = NULL, updated_at = unixepoch() WHERE id = ? AND user_id = ?'
    )
      .bind(input.note_id, userId)
      .run();

    return { success: true, message: 'Note is now private' };
  },
};

export const mcpTools: MCPTool[] = [
  listNotesTool,
  getNoteTool,
  createNoteTool,
  updateNoteTool,
  deleteNoteTool,
  restoreNoteHistoryTool,
  searchNotesTool,
  listTagsTool,
  shareNoteTool,
  unshareNoteTool,
  listNotebooksTool,
  createNotebookTool,
  updateNotebookTool,
  deleteNotebookTool,
  getSettingsTool,
  updateSettingsTool,
];

export function getTool(name: string): MCPTool | undefined {
  return mcpTools.find(tool => tool.name === name);
}

export function getToolList(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
  return mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export { createResult, createChunkedResult };
