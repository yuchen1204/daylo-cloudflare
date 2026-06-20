import React from 'react';
import { AppSettings } from '../../types';

interface CanvasSettingsProps {
  localSettings: AppSettings;
  updateNested: (section: 'canvas', key: string, value: any) => void;
}

export const CanvasSettings: React.FC<CanvasSettingsProps> = ({ localSettings, updateNested }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">Canvas</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border dark:border-slate-700">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Show Grid</span>
          <input
            type="checkbox"
            checked={localSettings.canvas.showGrid}
            onChange={(e) => updateNested('canvas', 'showGrid', e.target.checked)}
            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600"
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border dark:border-slate-700">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Snap to Grid</span>
          <input
            type="checkbox"
            checked={localSettings.canvas.snapToGrid}
            onChange={(e) => updateNested('canvas', 'snapToGrid', e.target.checked)}
            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Grid Size ({localSettings.canvas.gridSize}px)</label>
          <input
            type="range" min="10" max="100" step="5"
            value={localSettings.canvas.gridSize}
            onChange={(e) => updateNested('canvas', 'gridSize', parseInt(e.target.value))}
            className="w-full accent-indigo-600"
          />
        </div>
      </div>
    </div>
  );
};
