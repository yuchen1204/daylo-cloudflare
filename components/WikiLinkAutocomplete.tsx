import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Note } from '../types';

interface WikiLinkAutocompleteProps {
  notes: Note[];
  isOpen: boolean;
  filter: string;
  position: { top: number; left: number };
  onSelect: (title: string) => void;
  onClose: () => void;
}

export const WikiLinkAutocomplete: React.FC<WikiLinkAutocompleteProps> = ({
  notes,
  isOpen,
  filter,
  position,
  onSelect,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredNotes = useMemo(() => {
    if (!filter.trim()) return notes.slice(0, 10);
    return notes
      .filter(note => 
        note.title?.toLowerCase().includes(filter.toLowerCase())
      )
      .slice(0, 10);
  }, [notes, filter]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredNotes.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredNotes.length) % filteredNotes.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredNotes[selectedIndex]) {
          onSelect(filteredNotes[selectedIndex].title);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredNotes, selectedIndex, onSelect, onClose]);

  if (!isOpen || filteredNotes.length === 0) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={listRef}
        className="fixed z-50 w-64 max-h-64 overflow-y-auto rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100"
        style={{
          top: position.top,
          left: position.left,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <div className="p-1">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Link to Note
          </div>
          {filteredNotes.map((note, index) => (
            <button
              key={note.id}
              onClick={() => onSelect(note.title)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${
                index === selectedIndex
                  ? 'bg-[var(--interactive-active)]'
                  : 'hover:bg-[var(--interactive-hover)]'
              }`}
              style={{ color: index === selectedIndex ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <div className="font-medium truncate">{note.title || 'Untitled'}</div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {note.content.substring(0, 50)}...
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
