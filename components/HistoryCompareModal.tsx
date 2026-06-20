

import React, { useMemo } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { NoteHistoryEntry } from '../types';
import { diffWords } from 'diff';

interface HistoryCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  historyEntry: NoteHistoryEntry | null;
  currentContent: string;
  onRestore: (content: string) => void;
}

export const HistoryCompareModal: React.FC<HistoryCompareModalProps> = ({
  isOpen,
  onClose,
  historyEntry,
  currentContent,
  onRestore
}) => {
  if (!isOpen || !historyEntry) return null;

  const dateStr = new Date(historyEntry.timestamp).toLocaleString();

  // Compute Diff
  // We compare: Old (History) -> New (Current)
  // Red = Removed from Old (Present in History, missing in Current)
  // Green = Added in New (Missing in History, present in Current)
  const diff = useMemo(() => {
    if (!historyEntry) return [];
    return diffWords(historyEntry.content, currentContent);
  }, [historyEntry, currentContent]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[80vh] rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-indigo-500" />
              Compare Version
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Snapshot from: <span className="font-medium text-slate-700 dark:text-slate-300">{dateStr}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
             <button
               onClick={() => {
                 onRestore(historyEntry.content);
                 onClose();
               }}
               className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
             >
               <RotateCcw className="w-4 h-4" />
               Restore This Version
             </button>
             <button 
               onClick={onClose}
               className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
             >
               <X className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* Legend */}
        <div className="px-6 py-2 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex items-center gap-6 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-red-200 dark:bg-red-900/40"></span>
            <span>Deleted (In History, Not Current)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-green-200 dark:bg-green-900/40"></span>
            <span>Added (In Current, Not History)</span>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-950 font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300">
           {diff.map((part, index) => {
             // Styling based on diff type
             let className = '';
             if (part.added) {
               className = 'bg-green-200 dark:bg-green-900/40 text-green-900 dark:text-green-100';
             } else if (part.removed) {
               className = 'bg-red-200 dark:bg-red-900/40 text-red-900 dark:text-red-100 line-through opacity-70 decoration-red-900/50 dark:decoration-red-100/50';
             }

             return (
               <span key={index} className={className}>
                 {part.value}
               </span>
             );
           })}
        </div>
      </div>
    </div>
  );
};