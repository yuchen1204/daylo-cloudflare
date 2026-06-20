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
  description: 'List all notes, optionally filtered by notebook, tag, or pinned status',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: { type: 'string', description: 'Filter by notebook ID' },
      tag: { type: 'string', description: 'Filter by tag' },
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
  description: 'Get a single note by ID',
  inputSchema: {
    type: 'object',
    properties: {
      note_id: { type: 'string', description: 'Note ID' },
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
  description: 'Create a new note',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Note title' },
      content: { type: 'string', description: 'Note content' },
      format: { type: 'string', enum: ['markdown', 'txt', 'canvas', 'mindmap'], description: 'Note format' },
      notebook_id: { type: 'string', description: 'Notebook ID' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags' },
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
  description: 'Update an existing note (title, content, tags, pin status, notebook, format)',
  inputSchema: {
    type: 'object',
    properties: {
      note_id: { type: 'string', description: 'Note ID' },
      title: { type: 'string', description: 'New title' },
      content: { type: 'string', description: 'New content' },
      tags: { type: 'array', items: { type: 'string' }, description: 'New tags' },
      is_pinned: { type: 'boolean', description: 'Pin or unpin the note' },
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
  description: 'Delete a note',
  inputSchema: {
    type: 'object',
    properties: {
      note_id: { type: 'string', description: 'Note ID' },
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

const searchNotesTool: MCPTool = {
  name: 'search_notes',
  description: 'Full-text search notes',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  handler: async (input, db, userId) => {
    const { results } = await db.prepare(
      "SELECT id, title, content, format, tags, notebook_id, created_at, updated_at FROM notes WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)"
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

const listNotebooksTool: MCPTool = {
  name: 'list_notebooks',
  description: 'List all notebooks',
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
  description: 'Create a new notebook',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Notebook name' },
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

const deleteNotebookTool: MCPTool = {
  name: 'delete_notebook',
  description: 'Delete a notebook',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: { type: 'string', description: 'Notebook ID' },
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
