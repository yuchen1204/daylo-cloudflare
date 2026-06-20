# Profile Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Profile Dashboard modal to the Daylo UI, accessible by clicking the user avatar in the sidebar, allowing users to view their profile, update password, and manage MCP API key.

**Architecture:** Create a new ProfileModal component following existing modal patterns. Add API routes for password update and API key management. Update Sidebar to open ProfileModal on avatar click. Add api_keys table to schema.

**Tech Stack:** React, TypeScript, Tailwind CSS, Cloudflare Pages Functions, D1 Database

---

## File Structure

| File | Responsibility |
|------|----------------|
| `components/ProfileModal.tsx` | New modal component for profile dashboard |
| `components/Sidebar.tsx` | Modified to open ProfileModal on avatar click |
| `functions/[[route]].ts` | Add API routes for password and API key |
| `schema.sql` | Add api_keys table |
| `services/cloudflare-sync.ts` | Add API methods |

---

### Task 1: Database Schema Update

**Files:**
- Modify: `schema.sql`

- [ ] **Step 1: Add api_keys table to schema.sql**

Add after the settings table:

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT DEFAULT 'default',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
```

- [ ] **Step 2: Commit**

```bash
git add schema.sql
git commit -m "feat: add api_keys table to schema"
```

---

### Task 2: Backend API Routes

**Files:**
- Modify: `functions/[[route]].ts`

- [ ] **Step 1: Add password update route**

Add before the MCP routes (around line 150):

```typescript
// Password update
if (path === '/api/auth/password' && method === 'PUT') {
  const { currentPassword, newPassword } = await request.json<{ currentPassword: string; newPassword: string }>();
  
  if (!currentPassword || !newPassword) {
    return json({ error: 'Current password and new password required' }, 400);
  }
  
  if (newPassword.length < 6) {
    return json({ error: 'New password must be at least 6 characters' }, 400);
  }
  
  // Get current password hash
  const userRecord = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(userId)
    .first<{ password_hash: string }>();
  
  if (!userRecord) {
    return json({ error: 'User not found' }, 404);
  }
  
  // Verify current password
  const currentHash = await hashPassword(currentPassword);
  if (currentHash !== userRecord.password_hash) {
    return json({ error: 'Current password is incorrect' }, 401);
  }
  
  // Update to new password
  const newHash = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(newHash, userId)
    .run();
  
  return json({ success: true });
}
```

- [ ] **Step 2: Add API key routes**

Add after the password update route:

```typescript
// Get API key
if (path === '/api/auth/api-key' && method === 'GET') {
  const apiKey = await env.DB.prepare('SELECT id, key_hash, created_at FROM api_keys WHERE user_id = ?')
    .bind(userId)
    .first<{ id: string; key_hash: string; created_at: number }>();
  
  if (!apiKey) {
    return json({ key: null, createdAt: null });
  }
  
  // Return masked key (first 8 chars + dots)
  const maskedKey = apiKey.key_hash.substring(0, 8) + '••••••••••••';
  return json({ key: maskedKey, createdAt: apiKey.created_at });
}

// Generate new API key
if (path === '/api/auth/api-key' && method === 'POST') {
  // Delete existing key if any
  await env.DB.prepare('DELETE FROM api_keys WHERE user_id = ?')
    .bind(userId)
    .run();
  
  // Generate new key
  const rawKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const keyHash = await hashPassword(rawKey);
  
  // Store hash
  const keyId = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO api_keys (id, user_id, key_hash) VALUES (?, ?, ?)')
    .bind(keyId, userId, keyHash)
    .run();
  
  // Return plain text key (shown once)
  return json({ key: rawKey });
}

// Revoke API key
if (path === '/api/auth/api-key' && method === 'DELETE') {
  await env.DB.prepare('DELETE FROM api_keys WHERE user_id = ?')
    .bind(userId)
    .run();
  
  return json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add functions/[[route]].ts
git commit -m "feat: add password update and API key management routes"
```

---

### Task 3: Frontend API Methods

**Files:**
- Modify: `services/cloudflare-sync.ts`

- [ ] **Step 1: Add API methods to cloudflare-sync.ts**

Add after the existing API methods (around line 280):

```typescript
// Password update
export async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiFetch('/api/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// Get API key
export async function getApiKey(): Promise<{ key: string | null; createdAt: number | null }> {
  return apiFetch<{ key: string | null; createdAt: number | null }>('/api/auth/api-key');
}

// Generate new API key
export async function generateApiKey(): Promise<string> {
  const result = await apiFetch<{ key: string }>('/api/auth/api-key', {
    method: 'POST',
  });
  return result.key;
}

// Revoke API key
export async function revokeApiKey(): Promise<void> {
  await apiFetch('/api/auth/api-key', {
    method: 'DELETE',
  });
}
```

- [ ] **Step 2: Export new methods**

Update the export statement at the end of the file to include the new methods.

- [ ] **Step 3: Commit**

```bash
git add services/cloudflare-sync.ts
git commit -m "feat: add password and API key API methods"
```

---

### Task 4: Create ProfileModal Component

**Files:**
- Create: `components/ProfileModal.tsx`

- [ ] **Step 1: Create ProfileModal.tsx with basic structure**

```tsx
import React, { useState, useEffect } from 'react';
import { X, User, Copy, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { updatePassword, getApiKey, generateApiKey, revokeApiKey } from '../services/cloudflare-sync';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; email: string } | null;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadApiKey();
    }
  }, [isOpen, user]);

  const loadApiKey = async () => {
    try {
      const result = await getApiKey();
      setApiKey(result.key);
    } catch (err) {
      console.error('Failed to load API key:', err);
    }
  };

  const handlePasswordUpdate = async () => {
    setError('');
    setSuccess('');
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateApiKey = async () => {
    setLoading(true);
    try {
      const newKey = await generateApiKey();
      setApiKey(newKey.substring(0, 8) + '••••••••••••');
      setSuccess('API key generated. Copy it now - it won\'t be shown again.');
    } catch (err: any) {
      setError(err.message || 'Failed to generate API key');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = async () => {
    if (apiKey) {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevokeKey = async () => {
    setLoading(true);
    try {
      await revokeApiKey();
      setApiKey(null);
      setSuccess('API key revoked');
    } catch (err: any) {
      setError(err.message || 'Failed to revoke API key');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=6366f1&color=fff&size=80`;

  return (
    <div className="fixed inset-0 z-[10003] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Profile</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-3">
            <img 
              src={avatarUrl} 
              alt="Avatar" 
              className="w-20 h-20 rounded-full"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden w-20 h-20 rounded-full bg-indigo-500 flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{user.email}</p>
          </div>

          {/* Password Update Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Password Update</h3>
            <input
              type="password"
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              onClick={handlePasswordUpdate}
              disabled={loading}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>

          {/* API Key Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">MCP API Key</h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={apiKey || 'No API key configured'}
                readOnly
                className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
              {apiKey && (
                <button
                  onClick={handleCopyKey}
                  className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleGenerateApiKey}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {apiKey ? 'Regenerate' : 'Generate'}
              </button>
              {apiKey && (
                <button
                  onClick={handleRevokeKey}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Revoke
                </button>
              )}
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Check className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add components/ProfileModal.tsx
git commit -m "feat: add ProfileModal component"
```

---

### Task 5: Update Sidebar to Use ProfileModal

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Add ProfileModal import and state**

Add import at the top of Sidebar.tsx:

```tsx
import { ProfileModal } from './ProfileModal';
```

Add state after existing state declarations (around line 60):

```tsx
const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
```

- [ ] **Step 2: Update user footer button**

Replace the user button (lines 729-740) to open ProfileModal instead of logout confirm:

```tsx
{user ? (
  <button onClick={() => setIsProfileModalOpen(true)} className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
    <div className="flex items-center gap-2 overflow-hidden">
      <img 
        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=6366f1&color=fff&size=32`}
        alt="Avatar"
        className="w-6 h-6 rounded-full"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextElementSibling?.classList.remove('hidden');
        }}
      />
      <div className="hidden w-6 h-6 rounded-full bg-indigo-500 items-center justify-center">
        <UserIcon className="w-3 h-3 text-white" />
      </div>
      <div className="flex flex-col items-start truncate">
        <span className="text-xs font-semibold">{user.email?.split('@')[0]}</span>
        <span className="text-[10px] text-emerald-500 flex items-center gap-1">
          <Cloud className="w-3 h-3" /> Sync Active
        </span>
      </div>
    </div>
    <LogOut className="w-4 h-4" />
  </button>
) : (
  // ... rest of logged out button
)}
```

- [ ] **Step 3: Add ProfileModal to modals section**

Add after the LoginModal (around line 808):

```tsx
<ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} />
```

- [ ] **Step 4: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: integrate ProfileModal with Sidebar"
```

---

### Task 6: Update MCP Routes to Use Per-User API Keys

**Files:**
- Modify: `functions/[[route]].ts`

- [ ] **Step 1: Update validateApiKey function**

Replace the existing validateApiKey function:

```typescript
async function validateApiKey(request: Request, env: Env, userId?: string): Promise<boolean> {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) return false;
  
  // Check per-user API key in database
  if (userId) {
    const keyHash = await hashPassword(apiKey);
    const existingKey = await env.DB.prepare('SELECT id FROM api_keys WHERE user_id = ? AND key_hash = ?')
      .bind(userId, keyHash)
      .first();
    if (existingKey) return true;
  }
  
  // Fallback to global MCP_API_KEY for backward compatibility
  if (env.MCP_API_KEY && apiKey === env.MCP_API_KEY) {
    return true;
  }
  
  return false;
}
```

- [ ] **Step 2: Update MCP routes to use new validation**

Update the MCP SSE and messages endpoints to use the new validation:

```typescript
// MCP SSE endpoint
if (path === '/api/mcp/sse' && method === 'GET') {
  // Get userId from token if available
  const authUser = await authenticate(request, env);
  if (!await validateApiKey(request, env, authUser?.sub)) {
    return json({ error: 'Invalid API key' }, 401);
  }
  // ... rest of SSE handler
}

// MCP Messages endpoint
if (path === '/api/mcp/messages' && method === 'POST') {
  // Get userId from token if available
  const authUser = await authenticate(request, env);
  if (!await validateApiKey(request, env, authUser?.sub)) {
    return json({ error: 'Invalid API key' }, 401);
  }
  // ... rest of messages handler
}
```

- [ ] **Step 3: Commit**

```bash
git add functions/[[route]].ts
git commit -m "feat: update MCP to use per-user API keys"
```

---

### Task 7: Test the Implementation

**Files:**
- None (manual testing)

- [ ] **Step 1: Start development server**

```bash
npm run dev
```

- [ ] **Step 2: Test ProfileModal opens**

Click avatar in sidebar → ProfileModal should open with user email and avatar

- [ ] **Step 3: Test password update**

Enter current password, new password, confirm password → click Update Password

- [ ] **Step 4: Test API key generation**

Click Generate → API key should appear with copy button

- [ ] **Step 5: Test API key copy**

Click Copy → key should be copied to clipboard

- [ ] **Step 6: Test API key regeneration**

Click Regenerate → new key should be generated

- [ ] **Step 7: Test API key revocation**

Click Revoke → API key should be removed

- [ ] **Step 8: Test MCP with new API key**

Use generated API key with MCP endpoints

- [ ] **Step 9: Commit final changes**

```bash
git add .
git commit -m "feat: Profile Dashboard implementation complete"
```

---

## Verification

After completing all tasks:

1. **ProfileModal:** Click avatar opens modal with user info
2. **Avatar:** Generated avatar displays correctly from email
3. **Password Update:** Can update password with current password verification
4. **API Key:** Can generate, copy, regenerate, and revoke API keys
5. **MCP Integration:** MCP endpoints work with per-user API keys
6. **Dark Mode:** All components support dark mode
7. **Error Handling:** Appropriate error messages displayed

## Future Enhancements

- Avatar upload support
- Account deletion
- Email change
- Two-factor authentication
- Session management
