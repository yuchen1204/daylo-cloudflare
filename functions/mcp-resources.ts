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
