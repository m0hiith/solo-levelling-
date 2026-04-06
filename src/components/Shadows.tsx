import React from 'react';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { Shield, Sword, Ghost, Lock } from 'lucide-react';

interface ShadowsProps {
  profile: UserProfile | null;
}

export function Shadows({ profile }: ShadowsProps) {
  if (!profile) return null;

  const shadowArmy = [
    { id: 'igris', name: 'IGRIS', rank: 'COMMANDER', milestone: '365 Day Workout Streak', icon: Shield, color: 'text-primary', unlocked: profile.streak >= 365 },
    { id: 'tusk', name: 'TUSK', rank: 'ELITE KNIGHT', milestone: '1000 Total Focus Hours', icon: Ghost, color: 'text-secondary', unlocked: profile.level >= 20 },
    { id: 'iron', name: 'IRON', rank: 'KNIGHT', milestone: 'Deadlift Milestone Reached', icon: Sword, color: 'text-primary', unlocked: profile.level >= 10 },
    { id: 'tank', name: 'TANK', rank: 'SOLDIER', milestone: '50 Day Habit Streak', icon: Ghost, color: 'text-outline', unlocked: profile.streak >= 50 },
  ];

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-5xl font-extrabold text-on-surface tracking-tighter leading-none mb-2 uppercase">SHADOW ARMY</h1>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-outline">Legion Size: {profile.shadows.length} / 500</span>
            <div className="h-[2px] w-48 bg-surface overflow-hidden">
              <div className="h-full bg-primary w-[25.6%] shadow-[0_0_8px_rgba(237,177,255,1)]" />
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {shadowArmy.map((shadow) => (
          <motion.div
            key={shadow.id}
            whileHover={{ scale: 1.02 }}
            className={`group relative bg-surface border p-1 transition-all duration-500 overflow-hidden ${shadow.unlocked ? 'border-primary/50' : 'border-white/5 grayscale opacity-50'}`}
          >
            <div className="relative aspect-square bg-background overflow-hidden flex items-center justify-center">
              {!shadow.unlocked && <Lock className="w-12 h-12 text-outline/20 absolute z-10" />}
              <shadow.icon className={`w-32 h-32 opacity-20 group-hover:opacity-40 transition-all ${shadow.color}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
              {shadow.unlocked && (
                <div className="absolute top-2 left-2 bg-primary/90 text-background text-[9px] font-bold px-2 py-1 tracking-widest uppercase">
                  {shadow.rank}
                </div>
              )}
            </div>
            <div className="p-4 bg-surface">
              <h4 className={`font-headline font-bold tracking-widest uppercase ${shadow.unlocked ? shadow.color : 'text-outline'}`}>
                {shadow.unlocked ? shadow.name : 'LOCKED'}
              </h4>
              <p className="text-[10px] text-outline uppercase tracking-widest mt-1">{shadow.milestone}</p>
            </div>
            {shadow.unlocked && <div className="absolute bottom-0 left-0 h-1 bg-primary w-full shadow-[0_0_15px_rgba(237,177,255,1)]" />}
          </motion.div>
        ))}
      </div>

      {/* Rare Unlock Section */}
      <section className="bg-surface border border-primary/20 p-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <span className="text-[10px] text-secondary font-bold tracking-[0.3em] uppercase mb-4 block">Rare Evolution Pending</span>
            <h2 className="font-headline text-3xl font-extrabold text-on-surface uppercase tracking-tight mb-4 leading-tight">THE SOVEREIGN'S CALL:<br/><span className="text-secondary">SHADOW DRAGON</span></h2>
            <p className="text-sm text-outline max-w-lg mb-8 leading-relaxed">Complete the 100-Day Productivity Sprint to unlock the ultimate airborne shadow. This milestone provides a +15% Focus Multiplier and global EXP boost.</p>
            <div className="flex items-center gap-6">
              <button className="bg-secondary text-background px-8 py-4 font-headline font-bold text-xs tracking-widest uppercase hover:brightness-110 transition-all">Accept Quest</button>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-widest text-outline">Progress</span>
                <span className="font-headline text-lg text-on-surface">{profile.streak} / 100 DAYS</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
