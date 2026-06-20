import React, { useCallback } from 'react';

interface TaskListItemProps {
  checked: boolean;
  children: React.ReactNode;
  onToggle: (checked: boolean) => void;
}

export const TaskListItem: React.FC<TaskListItemProps> = ({ checked, children, onToggle }) => {
  const handleChange = useCallback(() => {
    onToggle(!checked);
  }, [checked, onToggle]);

  return (
    <li className="flex items-start gap-2 list-none" style={{ marginLeft: '-1.5em' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        className="mt-1.5 h-4 w-4 rounded cursor-pointer"
        style={{ accentColor: 'var(--text-primary)' }}
      />
      <span 
        className={`flex-1 ${checked ? 'line-through' : ''}`}
        style={{ color: checked ? 'var(--text-muted)' : 'var(--text-primary)' }}
      >
        {children}
      </span>
    </li>
  );
};
