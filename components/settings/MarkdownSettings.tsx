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
      <h3 className="text-lg font-medium border-b pb-2" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}>Markdown Editor</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CustomSelect
          label="Font Family"
          options={fontOptions}
          value={localSettings.markdown.fontFamily}
          onChange={(value) => updateNested('markdown', 'fontFamily', value)}
        />

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Font Size ({localSettings.markdown.fontSize}px)</label>
          <input
            type="range" min="12" max="24" step="1"
            value={localSettings.markdown.fontSize}
            onChange={(e) => updateNested('markdown', 'fontSize', parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Line Height ({localSettings.markdown.lineHeight})</label>
          <input
            type="range" min="1.0" max="2.0" step="0.1"
            value={localSettings.markdown.lineHeight}
            onChange={(e) => updateNested('markdown', 'lineHeight', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};
