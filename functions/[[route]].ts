export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  MCP_API_KEY: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  exp: number;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function createJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '');
  return `${data}.${sig}`;
}

async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sigBytes = Uint8Array.from(atob(sig + '='.repeat((4 - sig.length % 4) % 4)), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(`${header}.${body}`));
  if (!valid) return null;
  try {
    const payload: JwtPayload = JSON.parse(atob(body));
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data: unknown, status = 200, origin = '*'): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function authenticate(request: Request, env: Env): Promise<JwtPayload | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7), env.JWT_SECRET);
}

function validateApiKey(request: Request, env: Env): boolean {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey || !env.MCP_API_KEY) return false;
  return apiKey === env.MCP_API_KEY;
}

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

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  notebook_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'markdown',
  tags TEXT NOT NULL DEFAULT '[]',
  is_public INTEGER NOT NULL DEFAULT 0,
  public_link_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

let dbInitialized = false;

async function ensureDbInitialized(db: D1Database) {
  if (dbInitialized) return;
  try {
    const stmts = SCHEMA_SQL.split(';').filter(s => s.trim()).map(sql => db.prepare(sql));
    await db.batch(stmts);
    dbInitialized = true;
  } catch {
    dbInitialized = true;
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '*';
  const method = request.method;
  const path = url.pathname;

  // Only handle /api/* routes, pass everything else to static assets
  if (!path.startsWith('/api/')) {
    return context.next();
  }

  await ensureDbInitialized(env.DB);

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  // Auth routes
  if (path === '/api/auth/register' && method === 'POST') {
    const { email, password } = await request.json<{ email: string; password: string }>();
    if (!email || !password) return json({ error: 'Email and password required' }, 400);

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return json({ error: 'Email already exists' }, 409);

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await env.DB.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
      .bind(id, email, passwordHash)
      .run();

    const defaultNotebookId = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO notebooks (id, user_id, name) VALUES (?, ?, ?)')
      .bind(defaultNotebookId, id, 'Default')
      .run();

    const token = await createJwt({ sub: id, email, exp: Math.floor(Date.now() / 1000) + 86400 * 30 }, env.JWT_SECRET);
    return json({ token, user: { id, email } });
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const { email, password } = await request.json<{ email: string; password: string }>();
    if (!email || !password) return json({ error: 'Email and password required' }, 400);

    const user = await env.DB.prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email: string; password_hash: string }>();
    if (!user) return json({ error: 'Invalid credentials' }, 401);

    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.password_hash) return json({ error: 'Invalid credentials' }, 401);

    const token = await createJwt({ sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 86400 * 30 }, env.JWT_SECRET);
    return json({ token, user: { id: user.id, email: user.email } });
  }

  // Public notes (no auth) - must be before auth check
  if (path.match(/^\/api\/public\/[^/]+$/) && method === 'GET') {
    const linkId = path.split('/').pop()!;
    const note = await env.DB.prepare('SELECT id, title, content, format, tags, created_at, updated_at FROM notes WHERE public_link_id = ? AND is_public = 1')
      .bind(linkId)
      .first();
    return note ? json(note) : json({ error: 'Not found' }, 404);
  }

  // MCP SSE endpoint (no JWT auth, uses API key) - must be before auth check
  if (path === '/api/mcp/sse' && method === 'GET') {
    if (!validateApiKey(request, env)) {
      return json({ error: 'Invalid API key' }, 401);
    }

    const sessionId = crypto.randomUUID();
    const messageUrl = `${url.origin}/api/mcp/messages?session=${sessionId}`;

    const { readable, writer } = createSSEStream();

    const sseResponse = formatSSE('endpoint', JSON.stringify({ endpoint: messageUrl }));
    writer.write(sseResponse);

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // MCP Messages endpoint (no JWT auth, uses API key) - must be before auth check
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
          const userResult = await env.DB.prepare('SELECT id FROM users LIMIT 1').first<{ id: string }>();
          if (!userResult) {
            throw new Error('No users found in database');
          }
          const userId = userResult.id;

          const result = await tool.handler(toolArgs, env.DB, userId);
          const { chunks, final } = createChunkedResult(result);

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

  // All other routes require auth
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const userId = user.sub;

  // Notebooks CRUD
  if (path === '/api/notebooks') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM notebooks WHERE user_id = ?').bind(userId).all();
      return json(results);
    }
    if (method === 'POST') {
      const body = await request.json<{ id: string; name: string; color?: string; icon?: string }>();
      await env.DB.prepare('INSERT INTO notebooks (id, user_id, name, color, icon) VALUES (?, ?, ?, ?, ?)')
        .bind(body.id, userId, body.name, body.color || null, body.icon || null)
        .run();
      return json({ success: true });
    }
  }

  if (path.match(/^\/api\/notebooks\/[^/]+$/)) {
    const notebookId = path.split('/').pop()!;
    if (method === 'PUT') {
      const body = await request.json<{ name?: string; color?: string; icon?: string }>();
      await env.DB.prepare('UPDATE notebooks SET name = COALESCE(?, name), color = COALESCE(?, color), icon = COALESCE(?, icon) WHERE id = ? AND user_id = ?')
        .bind(body.name || null, body.color || null, body.icon || null, notebookId, userId)
        .run();
      return json({ success: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM notebooks WHERE id = ? AND user_id = ?').bind(notebookId, userId).run();
      return json({ success: true });
    }
  }

  // Notes CRUD
  if (path === '/api/notes') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM notes WHERE user_id = ?').bind(userId).all();
      return json(results);
    }
    if (method === 'POST') {
      const body = await request.json<{
        id: string; notebook_id: string; title: string; content: string;
        format?: string; tags?: string[]; is_public?: boolean; public_link_id?: string;
      }>();
      await env.DB.prepare(
        'INSERT INTO notes (id, user_id, notebook_id, title, content, format, tags, is_public, public_link_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          body.id, userId, body.notebook_id, body.title, body.content,
          body.format || 'markdown', JSON.stringify(body.tags || []),
          body.is_public ? 1 : 0, body.public_link_id || null
        )
        .run();
      return json({ success: true });
    }
  }

  if (path.match(/^\/api\/notes\/[^/]+$/)) {
    const noteId = path.split('/').pop()!;
    if (method === 'GET') {
      const note = await env.DB.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').bind(noteId, userId).first();
      return note ? json(note) : json({ error: 'Not found' }, 404);
    }
    if (method === 'PUT') {
      const body = await request.json<{
        title?: string; content?: string; format?: string;
        tags?: string[]; is_public?: boolean; public_link_id?: string | null; notebook_id?: string;
      }>();
      await env.DB.prepare(
        `UPDATE notes SET
          title = COALESCE(?, title),
          content = COALESCE(?, content),
          format = COALESCE(?, format),
          tags = COALESCE(?, tags),
          is_public = COALESCE(?, is_public),
          public_link_id = ?,
          notebook_id = COALESCE(?, notebook_id),
          updated_at = unixepoch()
        WHERE id = ? AND user_id = ?`
      )
        .bind(
          body.title ?? null, body.content ?? null, body.format ?? null,
          body.tags ? JSON.stringify(body.tags) : null,
          body.is_public !== undefined ? (body.is_public ? 1 : 0) : null,
          body.public_link_id !== undefined ? body.public_link_id : undefined,
          body.notebook_id ?? null,
          noteId, userId
        )
        .run();
      return json({ success: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').bind(noteId, userId).run();
      return json({ success: true });
    }
  }

  // Settings
  if (path === '/api/settings') {
    if (method === 'GET') {
      const setting = await env.DB.prepare('SELECT data FROM settings WHERE user_id = ?').bind(userId).first();
      return json(setting ? JSON.parse((setting as any).data) : {});
    }
    if (method === 'PUT') {
      const body = await request.json<Record<string, unknown>>();
      await env.DB.prepare('INSERT INTO settings (user_id, data, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(user_id) DO UPDATE SET data = ?, updated_at = unixepoch()')
        .bind(userId, JSON.stringify(body), JSON.stringify(body))
        .run();
      return json({ success: true });
    }
  }

  // Pull all (initial sync)
  if (path === '/api/sync/pull' && method === 'GET') {
    const [notebooks, notes, settings] = await Promise.all([
      env.DB.prepare('SELECT * FROM notebooks WHERE user_id = ?').bind(userId).all(),
      env.DB.prepare('SELECT * FROM notes WHERE user_id = ?').bind(userId).all(),
      env.DB.prepare('SELECT data FROM settings WHERE user_id = ?').bind(userId).first(),
    ]);
    return json({
      notebooks: notebooks.results,
      notes: notes.results,
      settings: settings ? JSON.parse((settings as any).data) : {},
    });
  }

  // Batch push (for sync)
  if (path === '/api/sync/push' && method === 'POST') {
    const body = await request.json<{
      notebooks?: Array<{ id: string; name: string; color?: string; icon?: string }>;
      notes?: Array<{
        id: string; notebook_id: string; title: string; content: string;
        format?: string; tags?: string[]; is_public?: boolean; public_link_id?: string;
        updated_at?: number;
      }>;
      settings?: Record<string, unknown>;
    }>();

    const stmts: D1PreparedStatement[] = [];

    if (body.notebooks) {
      for (const nb of body.notebooks) {
        stmts.push(
          env.DB.prepare('INSERT INTO notebooks (id, user_id, name, color, icon) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = ?, color = ?, icon = ?')
            .bind(nb.id, userId, nb.name, nb.color || null, nb.icon || null, nb.name, nb.color || null, nb.icon || null)
        );
      }
    }

    if (body.notes) {
      for (const note of body.notes) {
        stmts.push(
          env.DB.prepare(
            `INSERT INTO notes (id, user_id, notebook_id, title, content, format, tags, is_public, public_link_id, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               title = ?, content = ?, format = ?, tags = ?,
               is_public = ?, public_link_id = ?, notebook_id = ?, updated_at = ?`
          )
            .bind(
              note.id, userId, note.notebook_id, note.title, note.content,
              note.format || 'markdown', JSON.stringify(note.tags || []),
              note.is_public ? 1 : 0, note.public_link_id || null, note.updated_at || Date.now(),
              note.title, note.content, note.format || 'markdown', JSON.stringify(note.tags || []),
              note.is_public ? 1 : 0, note.public_link_id || null, note.notebook_id, note.updated_at || Date.now()
            )
        );
      }
    }

    if (body.settings) {
      stmts.push(
        env.DB.prepare('INSERT INTO settings (user_id, data, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(user_id) DO UPDATE SET data = ?, updated_at = unixepoch()')
          .bind(userId, JSON.stringify(body.settings), JSON.stringify(body.settings))
      );
    }

    if (stmts.length > 0) {
      await env.DB.batch(stmts);
    }

    return json({ success: true });
  }

  return json({ error: 'Not found' }, 404);
};