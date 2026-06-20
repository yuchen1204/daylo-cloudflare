import React, { useState, useEffect } from 'react';
import { X, User, Copy, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { updatePassword, getApiKey, generateApiKey, revokeApiKey } from '../services/cloudflare-sync';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; email: string } | null;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [fullApiKey, setFullApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadApiKey();
    }
  }, [isOpen, user]);

  const loadApiKey = async () => {
    try {
      const result = await getApiKey();
      setApiKey(result.key);
    } catch (err) {
      console.error('Failed to load API key:', err);
    }
  };

  const handlePasswordUpdate = async () => {
    setError('');
    setSuccess('');
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateApiKey = async () => {
    setLoading(true);
    try {
      const newKey = await generateApiKey();
      setFullApiKey(newKey);
      setApiKey(newKey.substring(0, 8) + '••••••••••••');
      setSuccess('API key generated. Copy it now - it won\'t be shown again.');
    } catch (err: any) {
      setError(err.message || 'Failed to generate API key');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = async () => {
    if (fullApiKey) {
      await navigator.clipboard.writeText(fullApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevokeKey = async () => {
    setLoading(true);
    try {
      await revokeApiKey();
      setApiKey(null);
      setFullApiKey(null);
      setSuccess('API key revoked');
    } catch (err: any) {
      setError(err.message || 'Failed to revoke API key');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=6366f1&color=fff&size=80`;

  return (
    <div className="fixed inset-0 z-[10003] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
           style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Profile</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--interactive-hover)] transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Avatar Section */}
          <div className="flex items-center gap-3">
            <img 
              src={avatarUrl} 
              alt="Avatar" 
              className="w-12 h-12 rounded-full"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden w-12 h-12 rounded-full bg-[var(--text-primary)] items-center justify-center">
              <User className="w-6 h-6" style={{ color: 'var(--bg-primary)' }} />
            </div>
            <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{user.email}</p>
          </div>

          {/* Password Update Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Password</h3>
            <input
              type="password"
              placeholder="Current"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:border-transparent"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            />
            <input
              type="password"
              placeholder="New"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:border-transparent"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            />
            <input
              type="password"
              placeholder="Confirm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:border-transparent"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={handlePasswordUpdate}
              disabled={loading}
              className="w-full px-3 py-1.5 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
            >
              {loading ? 'Updating...' : 'Update'}
            </button>
          </div>

          {/* API Key Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>MCP API Key</h3>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={apiKey || 'No key configured'}
                readOnly
                className="flex-1 px-2.5 py-1.5 text-xs border rounded-lg font-mono"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              />
              {apiKey && (
                <button
                  onClick={handleCopyKey}
                  className="p-1.5 hover:bg-[var(--interactive-hover)] rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  title="Copy"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={handleGenerateApiKey}
                disabled={loading}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {apiKey ? 'Regenerate' : 'Generate'}
              </button>
              {apiKey && (
                <button
                  onClick={handleRevokeKey}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Revoke
                </button>
              )}
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center gap-1.5 p-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-1.5 p-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Check className="w-3.5 h-3.5 shrink-0" />
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
