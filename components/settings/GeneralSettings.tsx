import React from 'react';
import { AppSettings, NoteFormat } from '../../types';
import { Download, FileText, FileType, History, Network, Palette } from 'lucide-react';
import { CustomSelect, SelectOption } from '../shared/CustomSelect';

interface GeneralSettingsProps {
  localSettings: AppSettings;
  updateLocal: (key: keyof AppSettings, value: any) => void;
  snapshotValue: number;
  setSnapshotValue: (value: number) => void;
  snapshotUnit: string;
  setSnapshotUnit: (value: string) => void;
  installPrompt?: any;
  onInstallPWA?: () => void;
}

const snapshotUnitOptions: SelectOption[] = [
  { value: 'seconds', label: 'Seconds' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'changes', label: 'Every Change (Instant)' },
];

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  localSettings,
  updateLocal,
  snapshotValue,
  setSnapshotValue,
  snapshotUnit,
  setSnapshotUnit,
  installPrompt,
  onInstallPWA,
}) => {
  return (
    <div className="space-y-8">
      {installPrompt && onInstallPWA && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4 rounded-lg flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
              <Download className="w-4 h-4" /> Install App
            </h4>
            <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
              Install Daylo on your device for offline access.
            </p>
          </div>
          <button
            onClick={onInstallPWA}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded shadow-sm transition-colors"
          >
            Install
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Default Format</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(['markdown', 'txt', 'canvas', 'mindmap'] as NoteFormat[]).map(fmt => (
            <button
              key={fmt}
              onClick={() => updateLocal('defaultNoteFormat', fmt)}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all duration-200 ease-in-out gap-2 capitalize shadow-sm hover:shadow-md ${
                localSettings.defaultNoteFormat === fmt
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-500 scale-105'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
              }`}
            >
              {fmt === 'markdown' && <FileType className="w-5 h-5" />}
              {fmt === 'txt' && <FileText className="w-5 h-5" />}
              {fmt === 'canvas' && <Palette className="w-5 h-5" />}
              {fmt === 'mindmap' && <Network className="w-5 h-5" />}
              <span>{fmt}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-500" /> History Snapshots
        </label>
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="number" min="1" disabled={snapshotUnit === 'changes'}
              value={snapshotValue} onChange={(e) => setSnapshotValue(Math.max(1, parseInt(e.target.value) || 1))}
              className={`w-full sm:w-24 px-3 py-2 rounded-md border-slate-300 bg-white dark:bg-slate-900/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${snapshotUnit === 'changes' ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            <div className="w-full sm:flex-1">
              <CustomSelect
                options={snapshotUnitOptions}
                value={snapshotUnit}
                onChange={setSnapshotUnit}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
