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
        <div className="border p-4 rounded-lg flex items-center justify-between"
             style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Download className="w-4 h-4" /> Install App
            </h4>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Install Daylo on your device for offline access.
            </p>
          </div>
          <button
            onClick={onInstallPWA}
            className="px-3 py-1.5 text-xs font-medium rounded shadow-sm transition-colors"
            style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
          >
            Install
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Default Format</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(['markdown', 'txt', 'canvas', 'mindmap'] as NoteFormat[]).map(fmt => (
            <button
              key={fmt}
              onClick={() => updateLocal('defaultNoteFormat', fmt)}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all duration-200 ease-in-out gap-2 capitalize shadow-sm hover:shadow-md ${
                localSettings.defaultNoteFormat === fmt
                  ? 'border-[var(--text-muted)] bg-[var(--interactive-active)] scale-105'
                  : 'border-[var(--border-primary)] hover:border-[var(--text-muted)]'
              }`}
              style={{ 
                color: localSettings.defaultNoteFormat === fmt ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: localSettings.defaultNoteFormat === fmt ? undefined : 'var(--bg-primary)'
              }}
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
        <label className="block text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <History className="w-4 h-4" /> History Snapshots
        </label>
        <div className="p-4 rounded-lg border"
             style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="number" min="1" disabled={snapshotUnit === 'changes'}
              value={snapshotValue} onChange={(e) => setSnapshotValue(Math.max(1, parseInt(e.target.value) || 1))}
              className={`w-full sm:w-24 px-3 py-2 rounded-md border focus:ring-2 focus:ring-[var(--text-muted)] focus:border-[var(--text-muted)] outline-none transition-colors ${snapshotUnit === 'changes' ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
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
