import { useState, useCallback, useEffect } from 'react';
import { NoteTemplate } from '../types';

const STORAGE_KEY = 'daylo-templates';

const BUILTIN_TEMPLATES: NoteTemplate[] = [
  {
    id: 'builtin-journal',
    name: 'Daily Journal',
    icon: '📝',
    content: `# ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n## Today\n\n- \n\n## Notes\n\n`,
    format: 'markdown',
    isBuiltin: true,
  },
  {
    id: 'builtin-meeting',
    name: 'Meeting Notes',
    icon: '📋',
    content: `# Meeting: \n\n**Date**: ${new Date().toLocaleDateString()}\n**Attendees**: \n\n## Agenda\n\n## Discussion\n\n## Action Items\n\n- [ ] `,
    format: 'markdown',
    isBuiltin: true,
  },
  {
    id: 'builtin-weekly',
    name: 'Weekly Report',
    icon: '📊',
    content: `# Week ${Math.ceil((new Date().getDate()) / 7)}\n\n## Summary\n\n## Completed\n\n## In Progress\n\n## Next Week\n`,
    format: 'markdown',
    isBuiltin: true,
  },
  {
    id: 'builtin-reading',
    name: 'Reading Notes',
    icon: '📚',
    content: `# \n\n**Author**: \n**Date**: ${new Date().toLocaleDateString()}\n\n## Key Takeaways\n\n## Quotes\n\n## Thoughts\n`,
    format: 'markdown',
    isBuiltin: true,
  },
  {
    id: 'builtin-project',
    name: 'Project Plan',
    icon: '🎯',
    content: `# Project: \n\n## Overview\n\n## Goals\n\n## Timeline\n\n## Tasks\n\n- [ ] `,
    format: 'markdown',
    isBuiltin: true,
  },
];

const loadTemplates = (): NoteTemplate[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const custom = JSON.parse(stored) as NoteTemplate[];
      return [...BUILTIN_TEMPLATES, ...custom];
    }
  } catch (e) {
    console.error('Failed to load templates:', e);
  }
  return BUILTIN_TEMPLATES;
};

const saveCustomTemplates = (templates: NoteTemplate[]) => {
  const custom = templates.filter(t => !t.isBuiltin);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
};

export const useTemplates = () => {
  const [templates, setTemplates] = useState<NoteTemplate[]>(loadTemplates);

  useEffect(() => {
    saveCustomTemplates(templates);
  }, [templates]);

  const addTemplate = useCallback((template: Omit<NoteTemplate, 'id' | 'isBuiltin'>) => {
    const newTemplate: NoteTemplate = {
      ...template,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isBuiltin: false,
    };
    setTemplates(prev => [...prev, newTemplate]);
    return newTemplate;
  }, []);

  const updateTemplate = useCallback((id: string, updates: Partial<NoteTemplate>) => {
    setTemplates(prev => prev.map(t => 
      t.id === id && !t.isBuiltin ? { ...t, ...updates } : t
    ));
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id || t.isBuiltin));
  }, []);

  const getTemplate = useCallback((id: string) => {
    return templates.find(t => t.id === id);
  }, [templates]);

  const applyTemplate = useCallback((content: string): string => {
    return content
      .replace(/\{date\}/g, new Date().toLocaleDateString())
      .replace(/\{time\}/g, new Date().toLocaleTimeString())
      .replace(/\{datetime\}/g, new Date().toLocaleString())
      .replace(/\{week\}/g, String(Math.ceil(new Date().getDate() / 7)))
      .replace(/\{year\}/g, String(new Date().getFullYear()))
      .replace(/\{month\}/g, String(new Date().getMonth() + 1))
      .replace(/\{day\}/g, String(new Date().getDate()));
  }, []);

  return {
    templates,
    builtinTemplates: templates.filter(t => t.isBuiltin),
    customTemplates: templates.filter(t => !t.isBuiltin),
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    applyTemplate,
  };
};
