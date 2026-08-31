import React, { useMemo, useState } from 'react';
import { Account } from '../types';
import { AuthError, listAccounts, signIn } from '../lib/auth';
import { getProfileFor } from '../store';
import { Avatar } from './Avatar';
import { m } from 'motion/react';
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';

interface LoginProps {
  onSignedIn: (account: Account) => void;
}

/**
 * The gate. Both hunters live on the same device, so the accounts are shown as
 * pickable cards — one tap fills the username, then it is just a password.
 */
export function Login({ onSignedIn }: LoginProps) {
  const accounts = useMemo(listAccounts, []);
  const [username, setUsername] = useState(accounts[0]?.username ?? '');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      onSignedIn(await signIn(username, password, remember));
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'The gate would not open. Try again.');
      setPassword('');
      console.error('[auth] sign-in failed', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background scanline">
      <m.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <p className="text-secondary font-headline tracking-[0.4em] text-[10px] uppercase mb-3">
            Authentication Required
          </p>
          <h1 className="font-headline font-black text-4xl tracking-tighter uppercase text-primary glow-primary">
            SYSTEM HUD
          </h1>
          <p className="text-outline font-label text-[10px] tracking-widest uppercase mt-3">
            Identify yourself, hunter.
          </p>
        </div>

        {/* Account picker — one tap instead of typing a username on a phone. */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {accounts.map(account => {
              const selected = account.username === username.trim().toLowerCase();
              const profile = getProfileFor(account.id);
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    setUsername(account.username);
                    setPassword('');
                    setError(null);
                  }}
                  className="p-4 border transition-all text-left"
                  style={{
                    borderColor: selected ? account.accent : 'rgba(255,255,255,0.08)',
                    background: selected ? `${account.accent}14` : 'transparent',
                  }}
                >
                  <div className="w-12 h-12 border p-0.5 mb-3" style={{ borderColor: `${account.accent}55` }}>
                    <Avatar
                      avatar={profile.avatar}
                      displayName={profile.displayName}
                      className="text-sm"
                    />
                  </div>
                  <div className="font-headline font-bold text-sm uppercase tracking-tight truncate">
                    {profile.displayName}
                  </div>
                  <div className="text-outline text-[10px] font-label tracking-widest uppercase truncate">
                    @{account.username}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-surface border border-white/5 p-6 space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="login-username"
              className="text-outline font-label text-[10px] tracking-widest uppercase block"
            >
              Hunter ID
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-secondary transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="login-password"
              className="text-outline font-label text-[10px] tracking-widest uppercase block"
            >
              Access Key
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={reveal ? 'text' : 'password'}
                value={password}
                autoComplete="current-password"
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-background border border-white/10 pl-4 pr-12 py-3 text-sm font-headline tracking-widest outline-none focus:border-secondary transition-colors"
              />
              <button
                type="button"
                onClick={() => setReveal(v => !v)}
                aria-label={reveal ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-secondary transition-colors"
              >
                {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              className="w-4 h-4 accent-secondary"
            />
            <span className="text-outline font-label text-[10px] tracking-widest uppercase">
              Stay signed in for the whole pact
            </span>
          </label>

          {error && (
            <div className="flex items-start gap-2 border-l-2 border-error pl-3 py-1">
              <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
              <span className="text-error text-[10px] uppercase tracking-widest">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="w-full bg-secondary text-background py-4 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {busy ? 'Verifying' : 'Enter the Gate'}
          </button>
        </form>

        <p className="text-outline/60 text-[9px] uppercase tracking-widest text-center mt-6 leading-relaxed">
          Data is stored on this device only. Change your credentials in Settings.
        </p>
      </m.div>
    </div>
  );
}
