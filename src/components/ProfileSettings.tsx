import React, { useEffect, useRef, useState } from 'react';
import { UserProfile } from '../types';
import { AvatarError, fileToAvatarDataUrl } from '../lib/avatar';
import { logActivity } from '../store';
import { Avatar } from './Avatar';
import { motion } from 'motion/react';
import { Upload, Trash2, X, Loader2, Check } from 'lucide-react';

interface ProfileSettingsProps {
  profile: UserProfile;
  onSave: (updates: Partial<UserProfile>) => void;
  onClose: () => void;
}

export function ProfileSettings({ profile, onSave, onClose }: ProfileSettingsProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState<string | null>(profile.avatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

    onSave({ displayName: name, avatar });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Player profile settings"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-surface border border-primary/20 p-8 space-y-8"
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-primary font-headline tracking-[0.2em] text-[10px] uppercase mb-1">
              System Configuration
            </p>
            <h2 className="font-headline font-bold text-2xl uppercase tracking-tighter">
              Player Profile
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

        {/* Avatar */}
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 border border-primary/30 p-1 shrink-0">
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
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
          </div>
        </div>

        {error && (
          <p className="text-error text-[10px] uppercase tracking-widest border-l-2 border-error pl-3">
            {error}
          </p>
        )}

        {/* Display name */}
        <div className="space-y-2">
          <label
            htmlFor="display-name"
            className="text-outline font-label text-[10px] tracking-widest uppercase block"
          >
            Player Designation
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            maxLength={24}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-primary transition-colors"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-secondary text-background py-4 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          Save Configuration
        </button>
      </motion.div>
    </div>
  );
}
