
import React from 'react';
import { 
  Heading1, Heading2, Heading3, List, ListOrdered, 
  Quote, Code, Table, Image as ImageIcon, Minus 
} from 'lucide-react';

export interface SlashCommand {
  id: string;
  label: string;
  icon: React.ReactNode;
  syntax: string;
  offset?: number; // How many chars to move cursor back, default 0 (end)
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'h1', label: 'Heading 1', icon: <Heading1 size={18} />, syntax: '# ' },
  { id: 'h2', label: 'Heading 2', icon: <Heading2 size={18} />, syntax: '## ' },
  { id: 'h3', label: 'Heading 3', icon: <Heading3 size={18} />, syntax: '### ' },
  { id: 'ul', label: 'Bullet List', icon: <List size={18} />, syntax: '- ' },
  { id: 'ol', label: 'Numbered List', icon: <ListOrdered size={18} />, syntax: '1. ' },
  { id: 'quote', label: 'Quote', icon: <Quote size={18} />, syntax: '> ' },
  { id: 'code', label: 'Code Block', icon: <Code size={18} />, syntax: '```\n\n```', offset: 4 },
  { id: 'table', label: 'Table', icon: <Table size={18} />, syntax: '| Header | Header |\n|---|---|\n| Cell | Cell |', offset: 0 },
  { id: 'image', label: 'Image', icon: <ImageIcon size={18} />, syntax: '![Alt text](url)', offset: 1 },
  { id: 'hr', label: 'Divider', icon: <Minus size={18} />, syntax: '---\n' },
];

interface SlashMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  filter: string;
  selectedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({
  isOpen, position, filter, selectedIndex, onSelect, onClose
}) => {
  if (!isOpen) return null;

  const filtered = SLASH_COMMANDS.filter(c => 
    c.label.toLowerCase().includes(filter.toLowerCase()) || 
    c.syntax.includes(filter)
  );

  if (filtered.length === 0) return null;

  return (
    <div 
      className="fixed z-[100] w-64 bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
      style={{ top: position.top, left: position.left }}
    >
        <div className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
            Basic Blocks
        </div>
      {filtered.map((cmd, idx) => (
        <button
          key={cmd.id}
          onClick={() => onSelect(cmd)}
          className={`flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
            idx === selectedIndex 
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' 
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <span className={`${idx === selectedIndex ? 'text-indigo-500' : 'text-slate-400'}`}>
             {cmd.icon}
          </span>
          <span className="flex-1 font-medium">{cmd.label}</span>
          <span className="text-xs text-slate-300 font-mono hidden group-hover:block opacity-50">{cmd.syntax.trim().substring(0, 5)}...</span>
        </button>
      ))}
    </div>
  );
};
