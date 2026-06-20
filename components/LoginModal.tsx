import React, { useState } from 'react';
import { X, Mail } from 'lucide-react';
import { cloudSyncService } from '../services/cloudflare-sync';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { id: string; email: string }) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let user;
      if (isRegistering) {
        user = await cloudSyncService.register(email, password);
      } else {
        user = await cloudSyncService.login(email, password);
      }
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
           style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
        
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {isRegistering ? "Create Account" : "Sign In"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--interactive-hover)] transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm p-3 rounded-md border border-red-100 dark:border-red-800/50">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)]"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Password</label>
              <input 
                type="password" 
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)]"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
            >
              {loading ? 'Processing...' : (isRegistering ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            {isRegistering ? "Already have an account? " : "Don't have an account? "}
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setError(null); }}
              className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
            >
              {isRegistering ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
