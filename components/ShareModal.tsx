import React, { useState, useEffect } from 'react';
import { Note } from '../types';
import { cloudSyncService } from '../services/cloudflare-sync';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, note }) => {
  const [isPublic, setIsPublic] = useState(false);
  const [publicLink, setPublicLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (note?.accessInfo) {
      setIsPublic(note.accessInfo.isPublic);
      if (note.accessInfo.isPublic && note.accessInfo.publicLinkId) {
        setPublicLink(`${window.location.origin}/share/${note.accessInfo.publicLinkId}`);
      }
    }
  }, [note]);

  if (!isOpen || !note) return null;

  const handleShareToggle = async () => {
    if (!cloudSyncService.isAuthenticated || !note) return;

    setIsLoading(true);
    const newIsPublic = !isPublic;

    try {
        const linkId = await cloudSyncService.shareNote(note, newIsPublic);
        setIsPublic(newIsPublic);

        if (newIsPublic && linkId) {
            const link = `${window.location.origin}/share/${linkId}`;
            setPublicLink(link);
        } else {
            setPublicLink('');
        }

    } catch (error) {
        console.error("Failed to update share settings:", error);
    } finally {
        setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicLink);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Share "{note.title}"</h2>

        <div className="flex items-center justify-between py-4">
          <span className="text-slate-700 dark:text-slate-300">Public Link</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={handleShareToggle} className="sr-only peer" disabled={isLoading} />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {isPublic && (
          <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-700 rounded-md">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">Anyone with the link can view this note.</p>
            <div className="flex items-center gap-2">
              <input type="text" readOnly value={publicLink} className="w-full bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-md p-2 text-sm" />
              <button onClick={copyToClipboard} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm">Copy</button>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md">Done</button>
        </div>
      </div>
    </div>
  );
};
