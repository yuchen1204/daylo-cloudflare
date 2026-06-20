import React from 'react';
import { AppSettings } from '../../types';

interface CanvasSettingsProps {
  localSettings: AppSettings;
  updateNested: (section: 'canvas', key: string, value: any) => void;
}

export const CanvasSettings: React.FC<CanvasSettingsProps> = ({ localSettings, updateNested }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium border-b pb-2" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}>Canvas</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg border"
             style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Show Grid</span>
          <input
            type="checkbox"
            checked={localSettings.canvas.showGrid}
            onChange={(e) => updateNested('canvas', 'showGrid', e.target.checked)}
            className="w-5 h-5 rounded focus:ring-[var(--text-muted)]"
            style={{ accentColor: 'var(--text-primary)' }}
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border"
             style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Snap to Grid</span>
          <input
            type="checkbox"
            checked={localSettings.canvas.snapToGrid}
            onChange={(e) => updateNested('canvas', 'snapToGrid', e.target.checked)}
            className="w-5 h-5 rounded focus:ring-[var(--text-muted)]"
            style={{ accentColor: 'var(--text-primary)' }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Grid Size ({localSettings.canvas.gridSize}px)</label>
          <input
            type="range" min="10" max="100" step="5"
            value={localSettings.canvas.gridSize}
            onChange={(e) => updateNested('canvas', 'gridSize', parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};
