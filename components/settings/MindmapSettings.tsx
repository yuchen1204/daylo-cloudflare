import React from 'react';
import { AppSettings } from '../../types';
import { CustomSelect, SelectOption } from '../shared/CustomSelect';

interface MindmapSettingsProps {
  localSettings: AppSettings;
  updateNested: (section: 'mindmap', key: string, value: any) => void;
}

const layoutOptions: SelectOption[] = [
  { value: 'radial', label: 'Radial (Star)' },
  { value: 'horizontal', label: 'Horizontal (Tree)' },
  { value: 'vertical', label: 'Vertical (Org Chart)' },
];

const curveStyleOptions: SelectOption[] = [
  { value: 'bezier', label: 'Bezier Curve' },
  { value: 'step', label: 'Step Line' },
  { value: 'straight', label: 'Straight Line' },
];

export const MindmapSettings: React.FC<MindmapSettingsProps> = ({ localSettings, updateNested }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium border-b pb-2" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}>MindMap</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CustomSelect
          label="Default Layout"
          options={layoutOptions}
          value={localSettings.mindmap.layout}
          onChange={(value) => updateNested('mindmap', 'layout', value)}
        />
        <CustomSelect
          label="Connection Style"
          options={curveStyleOptions}
          value={localSettings.mindmap.curveStyle}
          onChange={(value) => updateNested('mindmap', 'curveStyle', value)}
        />
      </div>
    </div>
  );
};
