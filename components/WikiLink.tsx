import React, { useState } from 'react';
import { Note } from '../types';

interface WikiLinkProps {
  title: string;
  note: Note | null;
  onClick: (noteId: string) => void;
}

export const WikiLink: React.FC<WikiLinkProps> = ({ title, note, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (note) {
      onClick(note.id);
    }
  };

  return (
    <span className="relative inline-block">
      <span
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`inline-flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer transition-colors ${
          note 
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50' 
            : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
        }`}
      >
        <span className="text-[10px]">🔗</span>
        <span>{title}</span>
      </span>
      
      {isHovered && note && (
        <div 
          className="absolute bottom-full left-0 mb-2 w-64 p-3 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
        >
          <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{note.title}</div>
          <div className="text-xs line-clamp-3" style={{ color: 'var(--text-muted)' }}>
            {note.content.substring(0, 150)}{note.content.length > 150 ? '...' : ''}
          </div>
          <div className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
            Click to open
          </div>
        </div>
      )}
    </span>
  );
};
