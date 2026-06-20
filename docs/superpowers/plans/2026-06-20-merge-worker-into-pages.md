# Merge Cloudflare Worker API into Pages Functions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the separate `daylo-api` Worker and `daylo-app` Pages project into a single Cloudflare Pages project with Functions, eliminating dashboard clutter.

**Architecture:** Move the Worker API code into Cloudflare Pages Functions (`functions/[[route]].ts`). Pages automatically serves static assets from `dist/` and routes unmatched requests to Functions. A single `wrangler.toml` at the root configures both the Pages project and D1 bindings. The frontend's `API_BASE` changes from the Worker URL to the Pages domain (`/api`).

**Tech Stack:** Cloudflare Pages, Cloudflare Functions (Workers runtime), D1, Vite, React, TypeScript

---

## File Structure

| File | Purpose |
|------|---------|
| `functions/[[route]].ts` | **NEW** - Catch-all Pages Function handling all `/api/*` routes |
| `wrangler.toml` | **NEW** - Root-level Pages + D1 configuration |
| `package.json` | **MODIFY** - Add `deploy` script, add `wrangler` devDep |
| `.env` | **MODIFY** - Change `VITE_API_BASE` to relative path |
| `.env.example` | **MODIFY** - Update example |
| `services/cloudflare-sync.ts` | **MODIFY** - Use relative `/api` path as default |
| `worker/` | **DELETE** - Entire directory (replaced by Functions) |

---

### Task 1: Create Pages Function entry point

**Files:**
- Create: `functions/[[route]].ts`

- [ ] **Step 1: Create the catch-all Pages Function**

Create `functions/[[route]].ts` with the full API code adapted for Pages Functions format. The `[[route]]` catch-all pattern means this function handles every request that isn't matched by static files in `dist/`.

```typescript
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
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

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '*';
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  // Strip /api prefix for routing (Pages Functions receive full path)
  const path = url.pathname;

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

  // Public notes (no auth)
  if (path.match(/^\/api\/public\/[^/]+$/) && method === 'GET') {
    const linkId = path.split('/').pop()!;
    const note = await env.DB.prepare('SELECT id, title, content, format, tags, created_at, updated_at FROM notes WHERE public_link_id = ? AND is_public = 1')
      .bind(linkId)
      .first();
    return note ? json(note) : json({ error: 'Not found' }, 404);
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
```

- [ ] **Step 2: Verify file exists**

Run: `dir functions\[[route]].ts`
Expected: File exists with ~300 lines

---

### Task 2: Create root wrangler.toml for Pages

**Files:**
- Create: `wrangler.toml`

- [ ] **Step 1: Create root wrangler.toml**

This configures the Pages project name and D1 binding. Note: the `name` here must match your existing Pages project name.

```toml
name = "daylo-app"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "DB"
database_name = "daylo-db"
database_id = "f0ead8c8-6d5d-4294-9d2b-795ab2892b4a"

[vars]
JWT_SECRET = "QbbrocAYhx8Dq5UW640WehcIbtUBcDjl5zMIycpp70c="
```

- [ ] **Step 2: Verify file**

Run: `type wrangler.toml`
Expected: Shows Pages project name and D1 config

---

### Task 3: Update package.json with deploy scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add wrangler to devDependencies and deploy scripts**

Add `wrangler` as a devDependency and add `deploy` and `pages:dev` scripts:

```json
{
  "name": "markdown-notes",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && wrangler pages deploy dist --project-name=daylo-app",
    "pages:dev": "wrangler pages dev dist --d1 DB=daylo-db --port 8788"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@headlessui/react": "^2.2.9",
    "@vercel/speed-insights": "^1.3.1",
    "diff": "5.2.0",
    "firebase": "^12.6.0",
    "lucide-react": "^0.555.0",
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "react-markdown": "9",
    "react-router-dom": "^7.10.1",
    "remark-gfm": "4"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.1",
    "@types/node": "^22.14.0",
    "@vitejs/plugin-react": "^5.0.0",
    "tailwindcss": "^4.3.1",
    "typescript": "~5.8.2",
    "vite": "^6.2.0",
    "vite-plugin-pwa": "^1.2.0",
    "wrangler": "^3.99.0"
  }
}
```

- [ ] **Step 2: Install wrangler**

Run: `npm install`
Expected: wrangler is installed as a devDependency

---

### Task 4: Update frontend API base URL

**Files:**
- Modify: `services/cloudflare-sync.ts:4`
- Modify: `.env`
- Modify: `.env.example`

- [ ] **Step 1: Change default API_BASE to relative path**

In `services/cloudflare-sync.ts`, change the default from the Worker URL to `/api`:

```typescript
const API_BASE = import.meta.env.VITE_API_BASE || '/api';
```

- [ ] **Step 2: Update .env**

```
# Cloudflare Pages API base (relative path since frontend and API share same domain)
VITE_API_BASE=/api
```

- [ ] **Step 3: Update .env.example**

```
# Cloudflare Pages API base (relative path since frontend and API share same domain)
VITE_API_BASE=/api
```

---

### Task 5: Delete old worker directory

**Files:**
- Delete: `worker/` (entire directory)

- [ ] **Step 1: Remove the old worker directory**

Run: `Remove-Item -Recurse -Force worker`
Expected: The `worker/` directory is completely removed

- [ ] **Step 2: Verify removal**

Run: `dir`
Expected: No `worker/` directory in listing

---

### Task 6: Deploy and verify

**Files:** None (deployment step)

- [ ] **Step 1: Build the frontend**

Run: `npm run build`
Expected: `dist/` directory created with built frontend

- [ ] **Step 2: Deploy to Cloudflare Pages**

Run: `npx wrangler pages deploy dist --project-name=daylo-app`
Expected: Deployment URL shown (e.g., `https://daylo-app.pages.dev`)

- [ ] **Step 3: Initialize D1 schema on the Pages-bound database**

The D1 database already exists from the old Worker. The schema should already be applied. If needed:

Run: `npx wrangler d1 execute daylo-db --file=./worker/src/schema.sql` (before deleting worker) or keep a copy of `schema.sql` at root.

Note: Since the `database_id` is the same in the new `wrangler.toml`, the existing D1 data is preserved.

- [ ] **Step 4: Verify API works on Pages domain**

Test in browser or curl:
```
curl https://daylo-app.pages.dev/api/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"password"}'
```

Expected: Returns JWT token or appropriate error (not 404)

- [ ] **Step 5: Verify frontend loads**

Open `https://daylo-app.pages.dev` in browser

Expected: Frontend loads, login works, notes sync correctly

---

### Task 7: Clean up Cloudflare dashboard

**Manual step:** After confirming everything works on Pages:
1. Go to Cloudflare dashboard → Workers & Pages
2. Find the old `daylo-api` Worker project
3. Delete it (Settings → Delete this Worker)

This removes the clutter from your dashboard.
