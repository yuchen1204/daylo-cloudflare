# MCP Tools Expansion Design

## Goal

Expose all user-executable operations through MCP so LLMs can perform any action the UI allows.

## Current State

MCP tools: `list_notes`, `get_note`, `create_note`, `update_note`, `delete_note`, `search_notes`, `list_notebooks`, `create_notebook`, `delete_notebook`.

MCP resources: `readNoteResource` (note://), `listNotebookResources` (notebook://).

Missing: notebook update, note pinning, note move, format change, tags, settings, resource discovery.

## Changes

### 1. New Tool: `update_notebook`

Updates notebook name, color, or icon.

```
Input:
  notebook_id: string (required)
  name?: string
  color?: string (hex, e.g. "#ff0000")
  icon?: string

SQL:
  UPDATE notebooks SET
    name = COALESCE(?, name),
    color = COALESCE(?, color),
    icon = COALESCE(?, icon)
  WHERE id = ? AND user_id = ?
```

### 2. Extend Tool: `update_note`

Add optional parameters to existing tool. Existing behavior unchanged.

New optional parameters:
- `is_pinned?: boolean` - Pin/unpin note
- `notebook_id?: string` - Move note to another notebook
- `format?: string` - Change note format (markdown/txt/canvas/mindmap)

Updated SQL:
```sql
UPDATE notes SET
  title = COALESCE(?, title),
  content = COALESCE(?, content),
  tags = COALESCE(?, tags),
  is_pinned = COALESCE(?, is_pinned),
  notebook_id = COALESCE(?, notebook_id),
  format = COALESCE(?, format),
  updated_at = unixepoch()
WHERE id = ? AND user_id = ?
```

Bind params:
```ts
input.title ?? null,
input.content ?? null,
input.tags ? JSON.stringify(input.tags) : null,
input.is_pinned !== undefined ? (input.is_pinned ? 1 : 0) : null,
input.notebook_id ?? null,
input.format ?? null,
input.note_id,
userId
```

### 3. New Tool: `list_tags`

Returns all unique tags across all notes with counts.

```
Input: (none)

Handler:
  SELECT tags FROM notes WHERE user_id = ?
  Parse JSON array from each row
  Aggregate counts, sort by count desc

Output:
  [{ tag: "work", count: 12 }, { tag: "ideas", count: 5 }, ...]
```

### 4. Skip: `get_note_history`

History is stored in IndexedDB (browser), not in D1. No MCP-accessible history data. This tool is intentionally omitted.

### 5. New Tool: `restore_note_history`

Restores note content to arbitrary content (effectively "restore to version X" where X is the content string).

```
Input:
  note_id: string (required)
  content: string (required) - The full content to restore to

Handler:
  UPDATE notes SET content = ?, updated_at = unixepoch()
  WHERE id = ? AND user_id = ?

  Returns: { success: true, message: "Note restored" }
```

### 6. New Tool: `get_settings`

Returns user settings.

```
Input: (none)

Handler:
  SELECT data FROM settings WHERE user_id = ?
  Parse JSON, return with defaults merged

Output:
  { theme: "light", defaultNoteFormat: "markdown", ... }
```

### 7. New Tool: `update_settings`

Partially updates user settings (merge with existing).

```
Input:
  settings: object (required) - Partial settings to merge

Handler:
  GET current settings
  Deep merge with input
  PUT merged settings back

SQL:
  INSERT INTO settings (user_id, data, updated_at)
  VALUES (?, ?, unixepoch())
  ON CONFLICT(user_id) DO UPDATE
  SET data = ?, updated_at = unixepoch()
```

### 8. New Resources

Add `resources/list` handler in `[[route]].ts`:

```
Method: resources/list

Resources returned:
  - { uri: "resources://notes", name: "All Notes", mimeType: "application/json" }
  - { uri: "resources://notebooks", name: "All Notebooks", mimeType: "application/json" }

Handler for resources/read:
  - resources://notes -> SELECT id, title, format, tags, notebook_id, is_pinned, updated_at FROM notes WHERE user_id = ?
  - resources://notebooks -> SELECT * FROM notebooks WHERE user_id = ?
```

### 9. Extend `list_notes`: add `pinned_only` filter

New optional parameter:
```
pinned_only?: boolean - If true, only return pinned notes
```

Add SQL condition:
```sql
AND is_pinned = 1
```

## Files to Modify

1. `functions/mcp-tools.ts` - Add `update_notebook`, `list_tags`, `restore_note_history`, `get_settings`, `update_settings`; extend `update_note` and `list_notes`
2. `functions/[[route]].ts` - Add `resources/list` handler, extend `resources/read` for `resources://notes` and `resources://notebooks`

## Backward Compatibility

- `update_note` new parameters are all optional
- `list_notes` new parameter is optional
- All existing tool signatures unchanged
- No database schema changes

## Error Handling

- All tools throw on missing required params
- `update_note` and `update_notebook` throw if record not found
- `restore_note_history` throws if note not found

## Testing

- Call each new tool via MCP endpoint
- Verify `update_note` with new params (is_pinned, notebook_id, format) works
- Verify `update_notebook` updates name/color/icon
- Verify `list_notes` with `pinned_only` filter
- Verify `list_tags` returns aggregated tags
- Verify `get_settings` returns merged settings
- Verify `update_settings` merges correctly
- Verify `restore_note_history` updates note content
- Verify `resources/list` returns both resources
- Verify `resources/read` with `resources://notes` and `resources://notebooks`
