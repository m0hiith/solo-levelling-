import React, { useEffect, useRef, useState } from 'react';
import { Account, UserProfile } from '../types';
import { AvatarError, fileToAvatarDataUrl } from '../lib/avatar';
import { AuthError, changePassword, changeUsername, setAccent } from '../lib/auth';
import { exportSave, importSave, logActivity } from '../store';
import { Avatar } from './Avatar';
import { m } from 'motion/react';
import { Check, Download, Loader2, Trash2, Upload, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ProfileSettingsProps {
  profile: UserProfile;
  account: Account;
  onSave: (updates: Partial<UserProfile>) => void;
  onAccountChanged: () => void;
  onClose: () => void;
}

type Panel = 'profile' | 'account' | 'backup';

const ACCENTS = ['#00f1fd', '#edb1ff', '#86efac', '#fbbf24', '#f9a8d4', '#7dd3fc'];

export function ProfileSettings({
  profile,
  account,
  onSave,
  onAccountChanged,
  onClose,
}: ProfileSettingsProps) {
  const [panel, setPanel] = useState<Panel>('profile');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-surface border border-primary/20 my-8"
      >
        <div className="flex justify-between items-start p-6 pb-4">
          <div>
            <p className="text-primary font-headline tracking-[0.2em] text-[10px] uppercase mb-1">
              System Configuration
            </p>
            <h2 className="font-headline font-bold text-2xl uppercase tracking-tighter">
              Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-outline hover:text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-white/5 px-6">
          {(['profile', 'account', 'backup'] as Panel[]).map(id => (
            <button
              key={id}
              onClick={() => setPanel(id)}
              className={cn(
                'px-4 py-3 font-headline text-[10px] uppercase tracking-widest transition-colors border-b-2 -mb-px',
                panel === id
                  ? 'text-secondary border-secondary'
                  : 'text-outline border-transparent hover:text-on-surface',
              )}
            >
              {id}
            </button>
          ))}
        </div>

        <div className="p-6">
          {panel === 'profile' && (
            <ProfilePanel profile={profile} account={account} onSave={onSave} onClose={onClose} onAccountChanged={onAccountChanged} />
          )}
          {panel === 'account' && (
            <AccountPanel account={account} onAccountChanged={onAccountChanged} />
          )}
          {panel === 'backup' && <BackupPanel />}
        </div>
      </m.div>
    </div>
  );
}

// ── Profile ──────────────────────────────────────────────

function ProfilePanel({
  profile,
  account,
  onSave,
  onClose,
  onAccountChanged,
}: {
  profile: UserProfile;
  account: Account;
  onSave: (updates: Partial<UserProfile>) => void;
  onClose: () => void;
  onAccountChanged: () => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState<string | null>(profile.avatar);
  const [accent, setAccentValue] = useState(account.accent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so re-picking the same file fires change again.
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      setAvatar(await fileToAvatarDataUrl(file));
    } catch (err) {
      setError(err instanceof AvatarError ? err.message : 'Could not process that image.');
      console.error('[profile] avatar processing failed', err);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => {
    const name = displayName.trim() || 'Player';

    if (name !== profile.displayName) {
      logActivity('profile', `Player designation changed to "${name}".`);
    }
    if (avatar !== profile.avatar) {
      logActivity('profile', avatar ? 'Profile image updated.' : 'Profile image removed.');
    }
    if (accent !== account.accent) {
      setAccent(account.id, accent);
      onAccountChanged();
    }

    onSave({ displayName: name, avatar });
    onClose();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 border p-1 shrink-0" style={{ borderColor: `${accent}55` }}>
          <Avatar avatar={avatar} displayName={displayName || 'Player'} className="text-2xl" />
        </div>
        <div className="flex-1 space-y-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-primary text-background px-4 py-3 font-headline font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {avatar ? 'Replace Image' : 'Upload Image'}
          </button>
          {avatar && (
            <button
              type="button"
              onClick={() => setAvatar(null)}
              className="w-full flex items-center justify-center gap-2 border border-white/10 text-outline px-4 py-3 font-headline font-bold text-[10px] uppercase tracking-widest hover:text-error hover:border-error/40 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
      </div>

      {error && (
        <p className="text-error text-[10px] uppercase tracking-widest border-l-2 border-error pl-3">
          {error}
        </p>
      )}

      <Field label="Player designation" htmlFor="display-name">
        <input
          id="display-name"
          type="text"
          value={displayName}
          maxLength={24}
          onChange={e => setDisplayName(e.target.value)}
          className={INPUT}
        />
      </Field>

      <Field label="Accent — how you are marked on the pact grid">
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => setAccentValue(color)}
              aria-label={`Accent ${color}`}
              aria-pressed={accent === color}
              className={cn(
                'w-9 h-9 border-2 transition-all',
                accent === color ? 'border-on-surface scale-110' : 'border-transparent',
              )}
              style={{ background: color }}
            />
          ))}
        </div>
      </Field>

      <button
        onClick={handleSave}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-secondary text-background py-4 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
      >
        <Check className="w-4 h-4" />
        Save Configuration
      </button>
    </div>
  );
}

// ── Account ──────────────────────────────────────────────

function AccountPanel({
  account,
  onAccountChanged,
}: {
  account: Account;
  onAccountChanged: () => void;
}) {
  const [username, setUsername] = useState(account.username);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const saveUsername = () => {
    try {
      changeUsername(account.id, username);
      onAccountChanged();
      setStatus({ ok: true, text: 'Hunter ID updated.' });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof AuthError ? err.message : 'Could not update.' });
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setStatus({ ok: false, text: 'The two new passwords do not match.' });
      return;
    }

    setBusy(true);
    try {
      await changePassword(account.id, current, next);
      onAccountChanged();
      setCurrent('');
      setNext('');
      setConfirm('');
      setStatus({ ok: true, text: 'Access key changed.' });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof AuthError ? err.message : 'Could not update.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Field label="Hunter ID" htmlFor="account-username">
        <div className="flex gap-2">
          <input
            id="account-username"
            type="text"
            value={username}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={e => setUsername(e.target.value)}
            className={INPUT}
          />
          <button
            type="button"
            onClick={saveUsername}
            disabled={username.trim().toLowerCase() === account.username}
            className="px-4 bg-primary text-background font-headline font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-40"
          >
            Set
          </button>
        </div>
      </Field>

      <form onSubmit={savePassword} className="space-y-4 pt-2 border-t border-white/5">
        <p className="text-outline font-label text-[10px] tracking-widest uppercase pt-4">
          Change access key
        </p>
        <input
          type="password"
          value={current}
          autoComplete="current-password"
          placeholder="CURRENT PASSWORD"
          onChange={e => setCurrent(e.target.value)}
          className={INPUT}
        />
        <input
          type="password"
          value={next}
          autoComplete="new-password"
          placeholder="NEW PASSWORD"
          onChange={e => setNext(e.target.value)}
          className={INPUT}
        />
        <input
          type="password"
          value={confirm}
          autoComplete="new-password"
          placeholder="CONFIRM NEW PASSWORD"
          onChange={e => setConfirm(e.target.value)}
          className={INPUT}
        />
        <button
          type="submit"
          disabled={busy || !current || !next}
          className="w-full flex items-center justify-center gap-2 bg-secondary text-background py-3 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-40"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Update Access Key
        </button>
      </form>

      {status && (
        <p
          className={cn(
            'text-[10px] uppercase tracking-widest border-l-2 pl-3',
            status.ok ? 'text-secondary border-secondary' : 'text-error border-error',
          )}
        >
          {status.text}
        </p>
      )}

      <p className="text-outline/60 text-[9px] uppercase tracking-widest leading-relaxed">
        Passwords are salted and hashed on this device. They keep the two of you out of each
        other's HUD — they are not encryption, and anyone with this unlocked device can read the
        stored data.
      </p>
    </div>
  );
}

// ── Backup ───────────────────────────────────────────────

function BackupPanel() {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportSave()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `solo-leveling-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus({ ok: true, text: 'Backup downloaded.' });
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      importSave(await file.text());
      setStatus({ ok: true, text: 'Save restored. Reloading…' });
      // A full reload is the honest way to re-hydrate every screen at once.
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Could not read that file.' });
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-outline leading-relaxed">
        Everything is stored on this device — there is no server. A phone and a laptop keep
        separate saves. Export from one, import on the other to bring them back in line.
      </p>

      <button
        onClick={download}
        className="w-full flex items-center justify-center gap-2 bg-secondary text-background py-4 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all"
      >
        <Download className="w-4 h-4" />
        Export Save
      </button>

      <button
        onClick={() => fileRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 border border-white/10 text-outline py-4 font-headline font-bold uppercase tracking-widest hover:text-primary hover:border-primary/40 transition-all"
      >
        <Upload className="w-4 h-4" />
        Import Save
      </button>
      <input ref={fileRef} type="file" accept="application/json" onChange={upload} className="hidden" />

      {status && (
        <p
          className={cn(
            'text-[10px] uppercase tracking-widest border-l-2 pl-3',
            status.ok ? 'text-secondary border-secondary' : 'text-error border-error',
          )}
        >
          {status.text}
        </p>
      )}

      <p className="text-error/70 text-[9px] uppercase tracking-widest leading-relaxed">
        Importing overwrites both hunters' progress on this device with the file's contents.
      </p>
    </div>
  );
}

const INPUT =
  'w-full bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-primary transition-colors';

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="text-outline font-label text-[10px] tracking-widest uppercase block"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
