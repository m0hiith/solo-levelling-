import React, { useEffect, useMemo, useRef } from 'react';
import { UserProfile } from '../types';
import { logActivity } from '../store';
import { motion } from 'motion/react';
import { Shield, Sword, Ghost, Lock } from 'lucide-react';

interface ShadowsProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
}

/** Flavour cap from the source material — the bar reads against a full legion. */
const LEGION_CAP = 500;

const SHADOW_ROSTER = [
  {
    id: 'igris',
    name: 'IGRIS',
    rank: 'COMMANDER',
    milestone: '365 Day Workout Streak',
    icon: Shield,
    color: 'text-primary',
    isUnlocked: (p: UserProfile) => p.streak >= 365,
  },
  {
    id: 'tusk',
    name: 'TUSK',
    rank: 'ELITE KNIGHT',
    milestone: 'Reach Level 20',
    icon: Ghost,
    color: 'text-secondary',
    isUnlocked: (p: UserProfile) => p.level >= 20,
  },
  {
    id: 'iron',
    name: 'IRON',
    rank: 'KNIGHT',
    milestone: 'Reach Level 10',
    icon: Sword,
    color: 'text-primary',
    isUnlocked: (p: UserProfile) => p.level >= 10,
  },
  {
    id: 'tank',
    name: 'TANK',
    rank: 'SOLDIER',
    milestone: '50 Day Habit Streak',
    icon: Ghost,
    color: 'text-outline',
    isUnlocked: (p: UserProfile) => p.streak >= 50,
  },
];

export function Shadows({ profile, setProfile }: ShadowsProps) {
  const unlockedIds = useMemo(
    () => SHADOW_ROSTER.filter(s => s.isUnlocked(profile)).map(s => s.id),
    [profile],
  );

  // Tracks what this mount has already announced, so StrictMode's double-invoked
  // effect can't write the same unlock into the activity log twice.
  const announced = useRef(new Set<string>());

  // Persist unlocks onto the profile — until now `profile.shadows` was never written to.
  useEffect(() => {
    const fresh = unlockedIds.filter(
      id => !profile.shadows.includes(id) && !announced.current.has(id),
    );
    if (fresh.length === 0) return;

    for (const id of fresh) {
      announced.current.add(id);
      const shadow = SHADOW_ROSTER.find(s => s.id === id);
      logActivity('system', `Shadow extracted: ${shadow?.name ?? id.toUpperCase()} joins the army.`);
    }
    setProfile(prev => ({
      ...prev,
      shadows: [...new Set([...prev.shadows, ...fresh])],
    }));
  }, [unlockedIds, profile.shadows, setProfile]);

  const legionSize = unlockedIds.length;

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-5xl font-extrabold text-on-surface tracking-tighter leading-none mb-2 uppercase">
            SHADOW ARMY
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-outline">
              Legion Size: {legionSize} / {LEGION_CAP}
            </span>
            <div className="h-[2px] w-48 bg-surface overflow-hidden">
              <div
                className="h-full bg-primary shadow-[0_0_8px_rgba(237,177,255,1)] transition-all duration-700"
                style={{ width: `${Math.min((legionSize / LEGION_CAP) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SHADOW_ROSTER.map(shadow => {
          const unlocked = unlockedIds.includes(shadow.id);
          return (
            <motion.div
              key={shadow.id}
              whileHover={{ scale: 1.02 }}
              className={`group relative bg-surface border p-1 transition-all duration-500 overflow-hidden ${
                unlocked ? 'border-primary/50' : 'border-white/5 grayscale opacity-50'
              }`}
            >
              <div className="relative aspect-square bg-background overflow-hidden flex items-center justify-center">
                {!unlocked && <Lock className="w-12 h-12 text-outline/20 absolute z-10" />}
                <shadow.icon
                  className={`w-32 h-32 opacity-20 group-hover:opacity-40 transition-all ${shadow.color}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                {unlocked && (
                  <div className="absolute top-2 left-2 bg-primary/90 text-background text-[9px] font-bold px-2 py-1 tracking-widest uppercase">
                    {shadow.rank}
                  </div>
                )}
              </div>
              <div className="p-4 bg-surface">
                <h4
                  className={`font-headline font-bold tracking-widest uppercase ${unlocked ? shadow.color : 'text-outline'}`}
                >
                  {unlocked ? shadow.name : 'LOCKED'}
                </h4>
                <p className="text-[10px] text-outline uppercase tracking-widest mt-1">
                  {shadow.milestone}
                </p>
              </div>
              {unlocked && (
                <div className="absolute bottom-0 left-0 h-1 bg-primary w-full shadow-[0_0_15px_rgba(237,177,255,1)]" />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Rare Unlock Section */}
      <section className="bg-surface border border-primary/20 p-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <span className="text-[10px] text-secondary font-bold tracking-[0.3em] uppercase mb-4 block">
              Rare Evolution Pending
            </span>
            <h2 className="font-headline text-3xl font-extrabold text-on-surface uppercase tracking-tight mb-4 leading-tight">
              THE SOVEREIGN'S CALL:
              <br />
              <span className="text-secondary">SHADOW DRAGON</span>
            </h2>
            <p className="text-sm text-outline max-w-lg mb-8 leading-relaxed">
              Complete the 100-Day Productivity Sprint to unlock the ultimate airborne shadow. This
              milestone provides a +15% Focus Multiplier and global EXP boost.
            </p>
            <div className="flex items-center gap-6">
              <div className="flex-1 max-w-xs">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-outline">
                    Progress
                  </span>
                  <span className="font-headline text-lg text-on-surface">
                    {Math.min(profile.streak, 100)} / 100 DAYS
                  </span>
                </div>
                <div className="h-1 bg-background">
                  <div
                    className="h-full bg-secondary shadow-[0_0_10px_rgba(0,241,253,0.6)] transition-all duration-700"
                    style={{ width: `${Math.min((profile.streak / 100) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
