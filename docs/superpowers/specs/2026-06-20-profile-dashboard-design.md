# Profile Dashboard Design

**Date:** 2026-06-20
**Status:** Approved

## Overview

Add a Profile Dashboard modal to the Daylo UI, accessible by clicking the user avatar in the sidebar. The dashboard allows users to view their profile information, update their password, and manage their MCP API key.

## Goals

- Provide easy access to user profile information
- Enable password changes with current password verification
- Allow MCP API key management (view, copy, regenerate)
- Follow existing UI patterns (modal style, dark mode support)

## Architecture

### Component Structure

| File | Responsibility |
|------|----------------|
| `components/ProfileModal.tsx` | New modal component for profile dashboard |
| `components/Sidebar.tsx` | Modified to open ProfileModal on avatar click |
| `functions/[[route]].ts` | Add API routes for password update and API key management |
| `schema.sql` | Add `api_keys` table |
| `services/cloudflare-sync.ts` | Add API methods for password/key operations |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/api/auth/password` | Update password (requires current password) |
| `GET` | `/api/auth/api-key` | Get user's masked API key |
| `POST` | `/api/auth/api-key` | Generate new API key |
| `DELETE` | `/api/auth/api-key` | Revoke API key |

### Data Model

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT DEFAULT 'default',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## UI Design

### ProfileModal Layout

```
┌─────────────────────────────────────────┐
│  Profile                          [X]   │
├─────────────────────────────────────────┤
│                                         │
│         ┌─────────┐                     │
│         │  Avatar │  (generated from    │
│         │  (80px) │   email)            │
│         └─────────┘                     │
│         user@example.com                │
│                                         │
├─────────────────────────────────────────┤
│  Password Update                        │
│  ┌─────────────────────────────────┐    │
│  │ Current Password                │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ New Password                    │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ Confirm New Password            │    │
│  └─────────────────────────────────┘    │
│  [Update Password]                      │
├─────────────────────────────────────────┤
│  MCP API Key                            │
│  ┌─────────────────────────────────┐    │
│  │ •••••••••••••••••••••••••••••• │    │
│  └─────────────────────────────────┘    │
│  [Copy] [Regenerate]                    │
└─────────────────────────────────────────┘
```

### Avatar Generation

- Use `https://ui-avatars.com/api/?name=email&background=6366f1&color=fff&size=80`
- Falls back to a default icon if image fails to load

### Modal Pattern

- Follow existing SettingsModal pattern
- z-index: 10003 (above other modals)
- Sections separated by borders
- Dark mode support with Tailwind classes

## File Changes

### New Files

1. **`components/ProfileModal.tsx`** — Profile Dashboard modal component

### Modified Files

2. **`components/Sidebar.tsx`** — Change avatar click to open ProfileModal
3. **`functions/[[route]].ts`** — Add API routes for password and API key
4. **`schema.sql`** — Add api_keys table
5. **`services/cloudflare-sync.ts`** — Add API methods

## API Implementation

### Password Update

```typescript
// PUT /api/auth/password
// Body: { currentPassword: string, newPassword: string }
// Validates current password, updates to new password
// Returns: { success: boolean }
```

### API Key Management

```typescript
// GET /api/auth/api-key
// Returns: { key: string (masked), createdAt: string }

// POST /api/auth/api-key
// Generates new API key, stores hash
// Returns: { key: string (plain text, shown once) }

// DELETE /api/auth/api-key
// Revokes API key
// Returns: { success: boolean }
```

## Error Handling

| Error | Message |
|-------|---------|
| Password mismatch | "Passwords do not match" |
| Wrong current password | "Current password is incorrect" |
| API key generation failure | "Failed to generate API key" |
| No API key exists | "No API key configured" |

## Security Considerations

- Passwords hashed with SHA-256 (existing pattern)
- API keys stored as hashes, never plain text
- API key shown in plain text only once after generation
- Current password required for password changes
- CORS headers on all new endpoints

## Integration with MCP

The current MCP implementation uses a global `MCP_API_KEY` environment variable. This feature adds per-user API keys stored in the database. After implementation:

1. MCP endpoints will validate against per-user keys (from `api_keys` table) instead of the global key
2. The global `MCP_API_KEY` in `wrangler.toml` can be removed
3. Each user gets their own API key for MCP access

## Testing

### Manual Testing

1. Click avatar in sidebar → ProfileModal opens
2. Verify avatar displays correctly from email
3. Test password update with correct/incorrect current password
4. Test API key generation, copy, and regeneration
5. Test dark mode appearance
6. Test responsive layout

### Test Cases

- Password update with matching new passwords
- Password update with mismatched new passwords
- Password update with wrong current password
- API key generation (first time)
- API key regeneration (replaces existing)
- API key copy to clipboard
- API key revocation
