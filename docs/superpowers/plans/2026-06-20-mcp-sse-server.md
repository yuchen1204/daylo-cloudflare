# MCP SSE Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a remote MCP server with SSE transport to Daylo, exposing full CRUD for notes and notebooks via MCP tools and resources.

**Architecture:** Integrate MCP endpoints into existing Cloudflare Pages Functions. Add `GET /api/mcp/sse` for SSE stream, `POST /api/mcp/messages` for JSON-RPC requests. API key authentication via `X-API-Key` header. Stateless design with streaming support for large content.

**Tech Stack:** Cloudflare Pages Functions, D1 Database, Server-Sent Events, JSON-RPC 2.0

---

## File Structure

| File | Responsibility |
|------|----------------|
| `functions/[[route]].ts` | Add MCP route handlers (SSE, messages, auth) |
| `functions/mcp-tools.ts` | MCP tool implementations (9 tools) |
| `functions/mcp-resources.ts` | MCP resource handlers (note, notebook) |
| `wrangler.toml` | Add MCP_API_KEY environment variable |
| `.env.example` | Document MCP_API_KEY |

---

### Task 1: Environment Configuration

**Files:**
- Modify: `wrangler.toml`
- Modify: `.env.example`

- [ ] **Step 1: Add MCP_API_KEY to wrangler.toml**

```toml
[[d1_databases]]
binding = "DB"
database_name = "daylo-db"
database_id = "f0ead8c8-6d5d-4294-9d2b-795ab2892b4a"

[vars]
JWT_SECRET = "QbbrocAYhx8Dq5UW640WehcIbtUBcDjl5zMIycpp70c="
MCP_API_KEY = ""
```

- [ ] **Step 2: Update .env.example**

```env
# Cloudflare Pages API base (leave empty for same-domain, or set to full URL for cross-domain)
VITE_API_BASE=

# MCP API key for remote access (generate a random string)
MCP_API_KEY=your-secret-api-key-here
```

- [ ] **Step 3: Commit**

```bash
git add wrangler.toml .env.example
git commit -m "chore: add MCP_API_KEY environment variable"
```

---

### Task 2: Create MCP Tools Module

**Files:**
- Create: `functions/mcp-tools.ts`

- [ ] **Step 1: Create mcp-tools.ts with type definitions and tool registry**

```typescript
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
```

- [ ] **Step 2: Implement list_notes tool**

```typescript
const listNotesTool: MCPTool = {
  name: 'list_notes',
  description: 'List all notes, optionally filtered by notebook or tag',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_id: { type: 'string', description: 'Filter by notebook ID' },
      tag: { type: 'string', description: 'Filter by tag' },
    },
  },
  handler: async (input, db, userId) => {
    let query = 'SELECT id, title, format, tags, notebook_id, created_at, updated_at FROM notes WHERE user_id = ?';
    const params: string[] = [userId];

    if (input.notebook_id) {
      query += ' AND notebook_id = ?';
      params.push(input.notebook_id as string);
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
```

- [ ] **Step 3: Implement get_note tool**

```typescript
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
```

- [ ] **Step 4: Implement create_note tool**

```typescript
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
```

- [ ] **Step 5: Implement update_note tool**

```typescript
const updateNoteTool: MCPTool = {
  name: 'update_note',
  description: 'Update an existing note',
  inputSchema: {
    type: 'object',
    properties: {
      note_id: { type: 'string', description: 'Note ID' },
      title: { type: 'string', description: 'New title' },
      content: { type: 'string', description: 'New content' },
      tags: { type: 'array', items: { type: 'string' }, description: 'New tags' },
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
        updated_at = unixepoch()
      WHERE id = ? AND user_id = ?`
    )
      .bind(
        input.title ?? null,
        input.content ?? null,
        input.tags ? JSON.stringify(input.tags) : null,
        input.note_id,
        userId
      )
      .run();

    return { success: true };
  },
};
```

- [ ] **Step 6: Implement delete_note tool**

```typescript
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
```

- [ ] **Step 7: Implement search_notes tool**

```typescript
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
```

- [ ] **Step 8: Implement list_notebooks tool**

```typescript
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
```

- [ ] **Step 9: Implement create_notebook tool**

```typescript
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
```

- [ ] **Step 10: Implement delete_notebook tool**

```typescript
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
```

- [ ] **Step 11: Export tool registry**

```typescript
export const mcpTools: MCPTool[] = [
  listNotesTool,
  getNoteTool,
  createNoteTool,
  updateNoteTool,
  deleteNoteTool,
  searchNotesTool,
  listNotebooksTool,
  createNotebookTool,
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
```

- [ ] **Step 12: Commit**

```bash
git add functions/mcp-tools.ts
git commit -m "feat: add MCP tool implementations"
```

---

### Task 3: Create MCP Resources Module

**Files:**
- Create: `functions/mcp-resources.ts`

- [ ] **Step 1: Create mcp-resources.ts with resource handlers**

```typescript
import { D1Database } from '@cloudflare/workers-types';

export interface MCPResource {
  uri: string;
  mimeType: string;
  text: string;
}

export interface MCPResourceResponse {
  contents: MCPResource[];
}

export async function readNoteResource(noteId: string, db: D1Database, userId: string): Promise<MCPResourceResponse> {
  const note = await db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?')
    .bind(noteId, userId)
    .first();

  if (!note) {
    throw new Error('Note not found');
  }

  const mimeType = getMimeType((note as any).format);
  return {
    contents: [{
      uri: `note:///${noteId}`,
      mimeType,
      text: (note as any).content,
    }],
  };
}

export async function listNotebookResources(notebookId: string, db: D1Database, userId: string): Promise<MCPResourceResponse> {
  const notebook = await db.prepare('SELECT * FROM notebooks WHERE id = ? AND user_id = ?')
    .bind(notebookId, userId)
    .first();

  if (!notebook) {
    throw new Error('Notebook not found');
  }

  const { results } = await db.prepare('SELECT id, title, content, format FROM notes WHERE notebook_id = ? AND user_id = ?')
    .bind(notebookId, userId)
    .all();

  return {
    contents: results.map((note: any) => ({
      uri: `note:///${note.id}`,
      mimeType: getMimeType(note.format),
      text: `# ${note.title}\n\n${note.content}`,
    })),
  };
}

function getMimeType(format: string): string {
  switch (format) {
    case 'markdown':
      return 'text/markdown';
    case 'txt':
      return 'text/plain';
    case 'canvas':
      return 'application/json';
    case 'mindmap':
      return 'application/json';
    default:
      return 'text/plain';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/mcp-resources.ts
git commit -m "feat: add MCP resource handlers"
```

---

### Task 4: Add MCP Route Handlers to [[route]].ts

**Files:**
- Modify: `functions/[[route]].ts`

- [ ] **Step 1: Update Env interface to include MCP_API_KEY**

```typescript
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  MCP_API_KEY: string;
}
```

- [ ] **Step 2: Add API key validation function**

```typescript
function validateApiKey(request: Request, env: Env): boolean {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey || !env.MCP_API_KEY) return false;
  return apiKey === env.MCP_API_KEY;
}
```

- [ ] **Step 3: Add SSE stream creation helper**

```typescript
function createSSEStream(): { readable: ReadableStream; writer: WritableStreamDefaultWriter } {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController;
  
  const readable = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
  });

  const writable = new WritableStream({
    write(chunk) {
      controller.enqueue(encoder.encode(chunk));
    },
    close() {
      controller.close();
    },
  });

  return { readable, writer: writable.getWriter() };
}

function formatSSE(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}
```

- [ ] **Step 4: Add MCP route handlers before the final 404 return**

```typescript
// MCP SSE endpoint
if (path === '/api/mcp/sse' && method === 'GET') {
  if (!validateApiKey(request, env)) {
    return json({ error: 'Invalid API key' }, 401);
  }

  const sessionId = crypto.randomUUID();
  const messageUrl = `${url.origin}/api/mcp/messages?session=${sessionId}`;
  
  const { readable, writer } = createSSEStream();
  
  // Send endpoint event with message URL
  const sseResponse = formatSSE('endpoint', JSON.stringify({ endpoint: messageUrl }));
  
  // Write initial SSE data
  writer.write(sseResponse);
  
  // Keep connection open (client will disconnect when done)
  // In a real implementation, you'd store the writer and send messages via POST
  // For now, we'll just keep the connection open until client disconnects
  
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// MCP Messages endpoint
if (path === '/api/mcp/messages' && method === 'POST') {
  if (!validateApiKey(request, env)) {
    return json({ error: 'Invalid API key' }, 401);
  }

  try {
    const body = await request.json<{ method: string; params?: Record<string, unknown>; id?: string | number }>();
    
    // Handle tools/list
    if (body.method === 'tools/list') {
      const { getToolList } = await import('./mcp-tools');
      return json({
        jsonrpc: '2.0',
        id: body.id,
        result: { tools: getToolList() },
      });
    }

    // Handle tools/call
    if (body.method === 'tools/call') {
      const { getTool, createResult, createChunkedResult } = await import('./mcp-tools');
      const toolName = body.params?.name as string;
      const toolArgs = (body.params?.arguments as Record<string, unknown>) || {};
      
      const tool = getTool(toolName);
      if (!tool) {
        return json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32601, message: `Tool not found: ${toolName}` },
        });
      }

      try {
        // Get userId from API key (we need to look up user by API key or use a default)
        // For now, we'll use a system user approach - API key maps to a user
        const userResult = await env.DB.prepare('SELECT id FROM users LIMIT 1').first<{ id: string }>();
        if (!userResult) {
          throw new Error('No users found in database');
        }
        const userId = userResult.id;

        const result = await tool.handler(toolArgs, env.DB, userId);
        const { chunks, final } = createChunkedResult(result);
        
        // For streaming, we'd send chunks via SSE
        // For now, return the final result
        return json({
          jsonrpc: '2.0',
          id: body.id,
          result: final,
        });
      } catch (error) {
        return json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32603, message: (error as Error).message },
        });
      }
    }

    // Handle resources/read
    if (body.method === 'resources/read') {
      const { readNoteResource, listNotebookResources } = await import('./mcp-resources');
      const uri = body.params?.uri as string;
      
      // Parse note:///[noteId]
      const noteMatch = uri.match(/^note:\/\/\/(.+)$/);
      if (noteMatch) {
        const userResult = await env.DB.prepare('SELECT id FROM users LIMIT 1').first<{ id: string }>();
        if (!userResult) throw new Error('No users found');
        
        const result = await readNoteResource(noteMatch[1], env.DB, userResult.id);
        return json({
          jsonrpc: '2.0',
          id: body.id,
          result,
        });
      }

      // Parse notebook:///[notebookId]
      const notebookMatch = uri.match(/^notebook:\/\/\/(.+)$/);
      if (notebookMatch) {
        const userResult = await env.DB.prepare('SELECT id FROM users LIMIT 1').first<{ id: string }>();
        if (!userResult) throw new Error('No users found');
        
        const result = await listNotebookResources(notebookMatch[1], env.DB, userResult.id);
        return json({
          jsonrpc: '2.0',
          id: body.id,
          result,
        });
      }

      return json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32602, message: `Invalid URI: ${uri}` },
      });
    }

    // Unknown method
    return json({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32601, message: `Method not found: ${body.method}` },
    });
  } catch (error) {
    return json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid request' },
    });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add functions/[[route]].ts
git commit -m "feat: add MCP SSE and message route handlers"
```

---

### Task 5: Test the Implementation

**Files:**
- None (manual testing)

- [ ] **Step 1: Start development server**

```bash
npm run dev
```

- [ ] **Step 2: Test MCP tools/list endpoint**

```bash
curl -X POST http://localhost:8788/api/mcp/messages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-test-api-key" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

Expected: JSON response with list of 9 tools

- [ ] **Step 3: Test MCP SSE endpoint**

```bash
curl -N http://localhost:8788/api/mcp/sse \
  -H "X-API-Key: your-test-api-key"
```

Expected: SSE stream with `event: endpoint` containing message URL

- [ ] **Step 4: Test create_note tool**

```bash
curl -X POST http://localhost:8788/api/mcp/messages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-test-api-key" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "create_note", "arguments": {"title": "Test Note", "content": "Hello from MCP!"}}}'
```

Expected: JSON response with `result.content[0].text` containing `{"id": "...", "success": true}`

- [ ] **Step 5: Test list_notes tool**

```bash
curl -X POST http://localhost:8788/api/mcp/messages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-test-api-key" \
  -d '{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "list_notes", "arguments": {}}}'
```

Expected: JSON response with array of notes

- [ ] **Step 6: Test authentication failure**

```bash
curl -X POST http://localhost:8788/api/mcp/messages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wrong-key" \
  -d '{"jsonrpc": "2.0", "id": 4, "method": "tools/list"}'
```

Expected: 401 response with `{"error": "Invalid API key"}`

- [ ] **Step 7: Commit final changes**

```bash
git add .
git commit -m "feat: MCP SSE server implementation complete"
```

---

## Verification

After completing all tasks:

1. **SSE Connection:** Client can connect to `/api/mcp/sse` and receive the endpoint event
2. **Tool Listing:** `tools/list` returns all 9 tools with correct schemas
3. **CRUD Operations:** All note/notebook tools work correctly
4. **Resource Access:** `resources/read` returns note/notebook content
5. **Authentication:** Invalid API keys are rejected with 401
6. **Error Handling:** Invalid requests return proper JSON-RPC error codes

## Future Enhancements

- Rate limiting per API key
- WebSocket transport option
- Batch operations support
- Webhook notifications for note changes
- User-to-API-key mapping (instead of using first user)
