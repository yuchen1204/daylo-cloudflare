import React from 'react';
import { AppSettings } from '../../types';
import { CustomSelect, SelectOption } from '../shared/CustomSelect';

interface MarkdownSettingsProps {
  localSettings: AppSettings;
  updateNested: (section: 'markdown', key: string, value: any) => void;
}

const fontOptions: SelectOption[] = [
  { value: 'sans', label: 'Sans-Serif (Inter)' },
  { value: 'serif', label: 'Serif (Merriweather)' },
  { value: 'mono', label: 'Monospace (JetBrains Mono)' },
];

export const MarkdownSettings: React.FC<MarkdownSettingsProps> = ({ localSettings, updateNested }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">Markdown Editor</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CustomSelect
          label="Font Family"
          options={fontOptions}
          value={localSettings.markdown.fontFamily}
          onChange={(value) => updateNested('markdown', 'fontFamily', value)}
        />

        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Font Size ({localSettings.markdown.fontSize}px)</label>
          <input
            type="range" min="12" max="24" step="1"
            value={localSettings.markdown.fontSize}
            onChange={(e) => updateNested('markdown', 'fontSize', parseInt(e.target.value))}
            className="w-full accent-indigo-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Line Height ({localSettings.markdown.lineHeight})</label>
          <input
            type="range" min="1.0" max="2.0" step="0.1"
            value={localSettings.markdown.lineHeight}
            onChange={(e) => updateNested('markdown', 'lineHeight', parseFloat(e.target.value))}
            className="w-full accent-indigo-600"
          />
        </div>
      </div>
    </div>
  );
};
