import React, { useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
import { NoteTemplate } from '../types';

interface TemplatePickerProps {
  templates: NoteTemplate[];
  onSelect: (template: NoteTemplate) => void;
  className?: string;
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({ templates, onSelect, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const builtinTemplates = templates.filter(t => t.isBuiltin);
  const customTemplates = templates.filter(t => !t.isBuiltin);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 text-sm rounded-md transition-colors hover:bg-[var(--interactive-hover)]"
        style={{ color: 'var(--text-muted)' }}
      >
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">Templates</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div 
            className="absolute top-full left-0 mt-1 w-56 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
          >
            {builtinTemplates.length > 0 && (
              <div className="p-1">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Built-in Templates
                </div>
                {builtinTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => { onSelect(template); setIsOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-[var(--interactive-hover)] transition-colors text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span className="text-base">{template.icon}</span>
                    <span>{template.name}</span>
                  </button>
                ))}
              </div>
            )}

            {customTemplates.length > 0 && (
              <div className="p-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  My Templates
                </div>
                {customTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => { onSelect(template); setIsOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-[var(--interactive-hover)] transition-colors text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span className="text-base">{template.icon}</span>
                    <span>{template.name}</span>
                  </button>
                ))}
              </div>
            )}

            {templates.length === 0 && (
              <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No templates available
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
