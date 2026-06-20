import React, { useState } from 'react';
import { Bell, Clock } from 'lucide-react';
import { NoteReminder } from '../types';

interface ReminderPickerProps {
  reminder?: NoteReminder;
  onSet: (date: string) => void;
  onClear: () => void;
  onComplete: () => void;
}

export const ReminderPicker: React.FC<ReminderPickerProps> = ({
  reminder,
  onSet,
  onClear,
  onComplete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    reminder?.date || new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );

  const handleSet = () => {
    onSet(selectedDate);
    setIsOpen(false);
  };

  const isOverdue = reminder && !reminder.completed && new Date(reminder.date) < new Date();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-md transition-all ${
          reminder 
            ? reminder.completed 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-500'
              : isOverdue 
                ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-500'
            : 'hover:bg-[var(--interactive-hover)]'
        }`}
        style={{ color: reminder ? undefined : 'var(--text-muted)' }}
        title={reminder ? "Edit Reminder" : "Set Reminder"}
      >
        {reminder ? <Bell className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div 
            className="absolute top-full right-0 mt-2 w-64 p-3 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
          >
            {reminder ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Reminder Set</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    reminder.completed ? 'bg-green-100 text-green-600' : isOverdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {reminder.completed ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'}
                  </span>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(reminder.date).toLocaleString()}
                </div>
                <div className="flex gap-2">
                  {!reminder.completed && (
                    <button
                      onClick={() => { onComplete(); setIsOpen(false); }}
                      className="flex-1 px-3 py-1.5 text-sm rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors"
                    >
                      Complete
                    </button>
                  )}
                  <button
                    onClick={() => { onClear(); setIsOpen(false); }}
                    className="flex-1 px-3 py-1.5 text-sm rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Set Reminder</div>
                <input
                  type="datetime-local"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded-md border"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                />
                <button
                  onClick={handleSet}
                  className="w-full px-3 py-1.5 text-sm rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                >
                  Set Reminder
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
