import React, { useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { NoteTemplate } from '../types';

interface TemplateManagerProps {
  templates: NoteTemplate[];
  onAdd: (template: Omit<NoteTemplate, 'id' | 'isBuiltin'>) => void;
  onUpdate: (id: string, updates: Partial<NoteTemplate>) => void;
  onDelete: (id: string) => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ templates, onAdd, onUpdate, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', icon: '📄', content: '', format: 'markdown' as 'markdown' | 'txt' });
  const [editTemplate, setEditTemplate] = useState<Partial<NoteTemplate>>({});

  const handleAdd = () => {
    if (newTemplate.name.trim() && newTemplate.content.trim()) {
      onAdd(newTemplate);
      setNewTemplate({ name: '', icon: '📄', content: '', format: 'markdown' });
      setIsAdding(false);
    }
  };

  const handleUpdate = (id: string) => {
    if (editTemplate.name && editTemplate.content) {
      onUpdate(id, editTemplate);
      setEditingId(null);
      setEditTemplate({});
    }
  };

  const startEdit = (template: NoteTemplate) => {
    setEditingId(template.id);
    setEditTemplate({ name: template.name, icon: template.icon, content: template.content, format: template.format });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Note Templates</h3>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <Plus className="w-3 h-3" /> Add Template
        </button>
      </div>

      {/* Add New Template Form */}
      {isAdding && (
        <div className="p-3 rounded-lg border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTemplate.icon}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, icon: e.target.value }))}
                className="w-12 px-2 py-1 text-sm rounded border text-center"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                placeholder="Icon"
              />
              <input
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                className="flex-1 px-2 py-1 text-sm rounded border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                placeholder="Template name"
              />
            </div>
            <textarea
              value={newTemplate.content}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
              className="w-full px-2 py-1 text-sm rounded border font-mono"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              placeholder="Template content (use {date}, {time}, {week} for placeholders)"
              rows={4}
            />
            <div className="flex gap-2">
              <select
                value={newTemplate.format}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, format: e.target.value as 'markdown' | 'txt' }))}
                className="px-2 py-1 text-sm rounded border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="markdown">Markdown</option>
                <option value="txt">Plain Text</option>
              </select>
              <div className="flex-1" />
              <button onClick={() => setIsAdding(false)} className="px-2 py-1 text-xs rounded hover:bg-[var(--interactive-hover)]" style={{ color: 'var(--text-muted)' }}>
                Cancel
              </button>
              <button onClick={handleAdd} className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template List */}
      <div className="space-y-2">
        {templates.map(template => (
          <div key={template.id} className="p-2 rounded-lg border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
            {editingId === template.id ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editTemplate.icon}
                    onChange={(e) => setEditTemplate(prev => ({ ...prev, icon: e.target.value }))}
                    className="w-12 px-2 py-1 text-sm rounded border text-center"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="text"
                    value={editTemplate.name}
                    onChange={(e) => setEditTemplate(prev => ({ ...prev, name: e.target.value }))}
                    className="flex-1 px-2 py-1 text-sm rounded border"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <textarea
                  value={editTemplate.content}
                  onChange={(e) => setEditTemplate(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-2 py-1 text-sm rounded border font-mono"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  rows={3}
                />
                <div className="flex gap-2">
                  <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs rounded hover:bg-[var(--interactive-hover)]" style={{ color: 'var(--text-muted)' }}>
                    Cancel
                  </button>
                  <button onClick={() => handleUpdate(template.id)} className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600">
                    Update
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{template.icon}</span>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{template.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{template.format} • {template.content.length} chars</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!template.isBuiltin && (
                    <>
                      <button onClick={() => startEdit(template)} className="p-1 rounded hover:bg-[var(--interactive-hover)]" style={{ color: 'var(--text-muted)' }}>
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => onDelete(template.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30" style={{ color: 'var(--text-muted)' }}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  {template.isBuiltin && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>Built-in</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
