import { useMemo, useCallback } from 'react';
import { Note } from '../types';

export interface WikiLink {
  title: string;
  noteId: string | null;
}

export interface WikiLinkResult {
  links: WikiLink[];
  backlinks: Note[];
  resolveLink: (title: string) => Note | null;
  findAllLinks: (content: string) => string[];
}

export const useWikiLinks = (notes: Note[], currentNoteId?: string): WikiLinkResult => {
  const titleToNote = useMemo(() => {
    const map = new Map<string, Note>();
    notes.forEach(note => {
      if (note.title) {
        map.set(note.title.toLowerCase(), note);
      }
    });
    return map;
  }, [notes]);

  const findAllLinks = useCallback((content: string): string[] => {
    const regex = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      links.push(match[1]);
    }
    return links;
  }, []);

  const resolveLink = useCallback((title: string): Note | null => {
    return titleToNote.get(title.toLowerCase()) || null;
  }, [titleToNote]);

  const currentNote = notes.find(n => n.id === currentNoteId);
  const links: WikiLink[] = useMemo(() => {
    if (!currentNote) return [];
    const linkTitles = findAllLinks(currentNote.content);
    return linkTitles.map(title => ({
      title,
      noteId: resolveLink(title)?.id || null,
    }));
  }, [currentNote, findAllLinks, resolveLink]);

  const backlinks: Note[] = useMemo(() => {
    if (!currentNote) return [];
    const currentTitle = currentNote.title?.toLowerCase();
    if (!currentTitle) return [];
    
    return notes.filter(note => {
      if (note.id === currentNoteId) return false;
      const noteLinks = findAllLinks(note.content);
      return noteLinks.some(link => link.toLowerCase() === currentTitle);
    });
  }, [notes, currentNoteId, findAllLinks]);

  return {
    links,
    backlinks,
    resolveLink,
    findAllLinks,
  };
};
