import React, { useState, useEffect } from 'react';
import { AppSettings, NoteFormat } from '../types';
import { X, Settings, Type, Grid, GitGraph, FileText } from 'lucide-react';
import { GeneralSettings } from './settings/GeneralSettings';
import { MarkdownSettings } from './settings/MarkdownSettings';
import { CanvasSettings } from './settings/CanvasSettings';
import { MindmapSettings } from './settings/MindmapSettings';
import { TemplateManager } from './TemplateManager';
import { useTemplates } from '../hooks/useTemplates';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  installPrompt?: any;
  onInstallPWA?: () => void;
}

type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'changes';
type SettingsTab = 'general' | 'markdown' | 'canvas' | 'mindmap' | 'templates';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, installPrompt, onInstallPWA }) => {
  // Local state for history inputs to allow validation/formatting before saving
  const [snapshotValue, setSnapshotValue] = useState<number>(2);
  const [snapshotUnit, setSnapshotUnit] = useState<TimeUnit>('minutes');
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  
  // Templates
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates();

  // Load settings into local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      const ms = settings.historySnapshotInterval;
      if (ms === 0) {
        setSnapshotUnit('changes');
        setSnapshotValue(1); 
      } else if (ms % 3600000 === 0) {
        setSnapshotUnit('hours');
        setSnapshotValue(ms / 3600000);
      } else if (ms % 60000 === 0) {
        setSnapshotUnit('minutes');
        setSnapshotValue(ms / 60000);
      } else {
        setSnapshotUnit('seconds');
        setSnapshotValue(Math.floor(ms / 1000));
      }
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSaveSettings = () => {
    let ms = 0;
    if (snapshotUnit === 'changes') {
      ms = 0;
    } else if (snapshotUnit === 'hours') {
      ms = snapshotValue * 3600000;
    } else if (snapshotUnit === 'minutes') {
      ms = snapshotValue * 60000;
    } else {
      ms = snapshotValue * 1000;
    }

    onSave({ ...localSettings, historySnapshotInterval: ms });
    onClose();
  };

  const updateLocal = (key: keyof AppSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateNested = (section: 'markdown' | 'canvas' | 'mindmap', key: string, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value }
    }));
  };

  const renderSidebar = () => (
    <div className="w-full md:w-48 border-b md:border-b-0 md:border-r p-2 flex flex-row md:flex-col gap-1 overflow-x-auto" style={{ borderColor: 'var(--border-subtle)' }}>
      <button 
        onClick={() => setActiveTab('general')}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-[var(--interactive-active)]' : 'hover:bg-[var(--interactive-hover)]'}`}
        style={{ color: activeTab === 'general' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
      >
        <Settings className="w-4 h-4" /> General
      </button>
      <button 
        onClick={() => setActiveTab('markdown')}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'markdown' ? 'bg-[var(--interactive-active)]' : 'hover:bg-[var(--interactive-hover)]'}`}
        style={{ color: activeTab === 'markdown' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
      >
        <Type className="w-4 h-4" /> Markdown
      </button>
      <button 
        onClick={() => setActiveTab('canvas')}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'canvas' ? 'bg-[var(--interactive-active)]' : 'hover:bg-[var(--interactive-hover)]'}`}
        style={{ color: activeTab === 'canvas' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
      >
        <Grid className="w-4 h-4" /> Canvas
      </button>
      <button 
        onClick={() => setActiveTab('mindmap')}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'mindmap' ? 'bg-[var(--interactive-active)]' : 'hover:bg-[var(--interactive-hover)]'}`}
        style={{ color: activeTab === 'mindmap' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
      >
        <GitGraph className="w-4 h-4" /> MindMap
      </button>
      <button 
        onClick={() => setActiveTab('templates')}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'templates' ? 'bg-[var(--interactive-active)]' : 'hover:bg-[var(--interactive-hover)]'}`}
        style={{ color: activeTab === 'templates' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
      >
        <FileText className="w-4 h-4" /> Templates
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl h-[80vh] max-h-[600px] rounded-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 transition-colors overflow-hidden"
           style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--interactive-hover)] transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {renderSidebar()}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && (
              <GeneralSettings
                localSettings={localSettings}
                updateLocal={updateLocal}
                snapshotValue={snapshotValue}
                setSnapshotValue={setSnapshotValue}
                snapshotUnit={snapshotUnit}
                setSnapshotUnit={setSnapshotUnit}
                installPrompt={installPrompt}
                onInstallPWA={onInstallPWA}
              />
            )}
            {activeTab === 'markdown' && (
              <MarkdownSettings localSettings={localSettings} updateNested={updateNested} />
            )}
            {activeTab === 'canvas' && (
              <CanvasSettings localSettings={localSettings} updateNested={updateNested} />
            )}
            {activeTab === 'mindmap' && (
              <MindmapSettings localSettings={localSettings} updateNested={updateNested} />
            )}
            {activeTab === 'templates' && (
              <TemplateManager
                templates={templates}
                onAdd={addTemplate}
                onUpdate={updateTemplate}
                onDelete={deleteTemplate}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex flex-col sm:flex-row justify-end gap-3 shrink-0" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 hover:bg-[var(--interactive-hover)] rounded-md text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors"
            style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};