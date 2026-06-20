# MCP SSE Server Design

**Date:** 2026-06-20
**Status:** Approved
**Approach:** Full Streaming (Approach C)

## Overview

Add a remote MCP (Model Context Protocol) server to Daylo using SSE (Server-Sent Events) transport. The server will be integrated into the existing Cloudflare Pages Functions, providing full CRUD access to notes and notebooks via MCP tools and resources.

## Goals

- Expose Daylo's note/notebook data via MCP protocol
- Support SSE transport for real-time server→client communication
- API key authentication for secure access
- Streaming support for large note content
- Stateless design for simplicity and scalability

## Architecture

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/mcp/sse` | Establish SSE stream, receive session endpoint |
| `POST` | `/api/mcp/messages` | Send JSON-RPC requests to MCP server |
| `DELETE` | `/api/mcp/sse` | Close SSE connection (optional) |

### Authentication

- API key passed via `X-API-Key` header on both endpoints
- Key stored in Cloudflare environment variable `MCP_API_KEY`
- Validated before establishing SSE connection or processing messages
- 401 response for invalid/missing keys

### Request Flow

```
Client                        Server
  |                             |
  |-- GET /api/mcp/sse -------->|  (establish SSE)
  |<-- event: endpoint --------|  (returns message URL with session ID)
  |                             |
  |-- POST /api/mcp/messages -->|  (JSON-RPC: tools/list)
  |<-- event: message ---------|  (SSE: JSON-RPC response)
  |                             |
  |-- POST /api/mcp/messages -->|  (JSON-RPC: tools/call {name: "list_notes"})
  |<-- event: message ---------|  (SSE: JSON-RPC response with results)
  |<-- event: chunk -----------|  (if large content, streamed in chunks)
```

## MCP Tools

### Tool Definitions

| Tool | Input Schema | Description |
|------|-------------|-------------|
| `list_notes` | `{notebook_id?: string, tag?: string}` | List all notes, optionally filtered |
| `get_note` | `{note_id: string}` | Get a single note by ID |
| `create_note` | `{title: string, content: string, format: string, notebook_id?: string, tags?: string[]}` | Create a new note |
| `update_note` | `{note_id: string, title?: string, content?: string, tags?: string[]}` | Update an existing note |
| `delete_note` | `{note_id: string}` | Delete a note |
| `search_notes` | `{query: string}` | Full-text search notes |
| `list_notebooks` | `{}` | List all notebooks |
| `create_notebook` | `{name: string}` | Create a new notebook |
| `delete_notebook` | `{notebook_id: string}` | Delete a notebook |

### Tool Input Validation

Each tool validates its input against the JSON Schema before execution. Invalid inputs return MCP error code `-32602` (Invalid Params).

## MCP Resources

### Resource Templates

| URI Pattern | Description |
|-------------|-------------|
| `note:///{note_id}` | Read a note's content as a resource |
| `notebook:///{notebook_id}` | List notes in a notebook |

### Resource Responses

Resources return structured content with metadata:
```json
{
  "contents": [{
    "uri": "note:///abc123",
    "mimeType": "text/markdown",
    "text": "# Note Title\n\nContent here..."
  }]
}
```

## Streaming

### Chunked Responses

For large note content (>4KB), responses are streamed in chunks:

1. Server sends `event: chunk` with partial content
2. Continues until complete
3. Sends final `event: message` with complete JSON-RPC response

### SSE Event Types

| Event | Purpose |
|-------|---------|
| `endpoint` | Initial event with message URL |
| `message` | Complete JSON-RPC response |
| `chunk` | Partial content for streaming |
| `error` | Error notification |

## File Changes

### Modified Files

1. **`functions/[[route]].ts`** — Add MCP route handlers
   - `GET /api/mcp/sse` — SSE stream setup
   - `POST /api/mcp/messages` — JSON-RPC processing
   - `validateApiKey(request)` — API key validation
   - `createSSEStream(response)` — SSE stream creation

### New Files

2. **`functions/mcp-tools.ts`** — Tool implementations
   - Each tool function: validated input → storage call → JSON-RPC result
   - Chunked response support for large payloads

3. **`functions/mcp-resources.ts`** — Resource handlers
   - `readNoteResource(noteId)` — note content as MCP resource
   - `listNotebookResources(notebookId)` — notebook contents

### Configuration

4. **`wrangler.toml`** — Add `MCP_API_KEY` to environment variables
5. **`.env.example`** — Document `MCP_API_KEY` variable

## Error Handling

### MCP JSON-RPC Errors

| Code | Name | Usage |
|------|------|-------|
| `-32600` | Invalid Request | Malformed JSON-RPC |
| `-32601` | Method Not Found | Unknown tool/resource |
| `-32602` | Invalid Params | Tool input validation failure |
| `-32603` | Internal Error | Server-side failures |

### SSE Connection Errors

- Connection failures logged to Cloudflare Workers log
- Stream closed gracefully on client disconnect
- API key validation failure returns 401 before SSE establishment

## Security Considerations

- API key stored as encrypted environment variable
- Rate limiting recommended (not in scope for initial implementation)
- CORS headers configured for allowed origins
- No sensitive data in SSE events (content via POST messages only)

## Testing

### Manual Testing

1. Start dev server: `npm run dev`
2. Set `MCP_API_KEY` in `.env`
3. Use MCP client or curl to test endpoints
4. Verify all tools work correctly
5. Test streaming with large notes

### Automated Testing (Future)

- Unit tests for tool implementations
- Integration tests for SSE connection lifecycle
- API key validation tests

## Future Enhancements

- Rate limiting per API key
- WebSocket transport option
- Batch operations support
- Webhook notifications for note changes
