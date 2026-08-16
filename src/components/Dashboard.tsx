import { useMemo } from 'react';
import { UserProfile } from '../types';
import { getTasks } from '../store';
import { getLevelProgress } from '../lib/leveling';
import { motion } from 'motion/react';
import { Flame, Zap, ChevronRight, Terminal } from 'lucide-react';

interface DashboardProps {
  profile: UserProfile;
}

/** Circumference of the r=110 progress ring, used to drive its stroke-dasharray. */
const RING_CIRCUMFERENCE = 2 * Math.PI * 110;

export function Dashboard({ profile }: DashboardProps) {
  const tasks = useMemo(getTasks, []);

  const recentTasks = useMemo(
    () =>
      [...tasks]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4),
    [tasks],
  );

  // "Daily sync" is how much of today's daily quest list is cleared.
  const dailyTasks = tasks.filter(t => t.type === 'daily');
  const dailyPercent = dailyTasks.length
    ? Math.round((dailyTasks.filter(t => t.completed).length / dailyTasks.length) * 100)
    : 0;

  const progress = getLevelProgress(profile.xp);

  return (
    <div className="space-y-12">
      {/* System Alert */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-surface border-l-4 border-primary p-6 relative overflow-hidden"
      >
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <Terminal className="w-48 h-48" />
        </div>
        <p className="text-primary font-headline tracking-[0.2em] text-[10px] uppercase mb-2">
          SYSTEM NOTIFICATION
        </p>
        <h1 className="text-on-surface font-headline font-bold text-xl md:text-2xl tracking-tighter max-w-2xl leading-none uppercase">
          {profile.displayName}, THE SYSTEM HAS NEW MISSIONS FOR YOU.{' '}
          <span className="text-secondary">DO NOT FAIL.</span>
        </h1>
      </motion.div>

      <div className="grid grid-cols-12 gap-6">
        {/* Progress Ring Card */}
        <div className="col-span-12 lg:col-span-5 bg-surface/50 p-8 flex flex-col items-center justify-center relative border border-white/5">
          <div className="relative w-64 h-64 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" aria-hidden="true">
              <circle cx="50%" cy="50%" r="110" className="fill-none stroke-white/5 stroke-[8]" />
              <circle
                cx="50%"
                cy="50%"
                r="110"
                className="fill-none stroke-secondary stroke-[8] transition-all duration-1000"
                strokeDasharray={`${(dailyPercent / 100) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                style={{ filter: 'drop-shadow(0 0 8px rgba(0, 241, 253, 0.4))' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-secondary font-headline text-5xl font-black">
                {dailyPercent}%
              </span>
              <span className="text-outline font-label text-[10px] tracking-widest uppercase">
                DAILY SYNC
              </span>
            </div>
          </div>
          <div className="mt-8 text-center">
            <div className="flex items-center gap-2 text-secondary mb-1">
              <Flame className="w-6 h-6 fill-secondary" />
              <span className="font-headline font-bold text-2xl">
                {profile.streak} DAY STREAK
              </span>
            </div>
            <p className="text-outline text-[10px] uppercase tracking-widest">
              CONTINUE YOUR ASCENSION
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
          <div className="bg-surface p-6 border-l-2 border-secondary">
            <div className="flex justify-between items-start mb-8">
              <div>
                <span className="text-outline font-label text-[10px] tracking-widest uppercase block mb-1">
                  CURRENT STATUS
                </span>
                <h2 className="text-on-surface font-headline font-bold text-4xl italic">
                  LEVEL {progress.level}
                </h2>
              </div>
              <div className="bg-secondary/10 border border-secondary px-4 py-2">
                <span className="text-secondary font-headline font-black text-2xl tracking-tighter">
                  RANK {progress.rank}
                </span>
              </div>
            </div>
            <div className="mb-2 flex justify-between items-end">
              <span className="text-outline font-label text-[10px] tracking-widest uppercase">
                EXPERIENCE POINTS (XP)
              </span>
              <span className="text-secondary font-headline text-xs">
                {progress.xpIntoLevel} / {progress.xpForNext}
              </span>
            </div>
            <div className="h-2 bg-white/5 relative overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress.percent}%` }}
                className="absolute left-0 top-0 h-full bg-secondary shadow-[0_0_10px_rgba(0,241,253,0.5)]"
              />
            </div>
            <p className="text-outline font-label text-[10px] tracking-widest uppercase mt-2">
              {profile.xp.toLocaleString()} TOTAL XP EARNED
            </p>
          </div>

          {/* Recent Quests */}
          <div className="bg-surface/30 p-6 flex-1">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline font-bold text-xs tracking-[0.2em] text-primary uppercase">
                RECENT QUESTS
              </h3>
              <span className="text-outline text-[10px] font-label uppercase">LATEST ACTIVITY</span>
            </div>
            <div className="space-y-4">
              {recentTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-4 bg-surface/50 p-4 hover:bg-surface transition-colors"
                >
                  <div
                    className={`w-6 h-6 border-2 flex items-center justify-center ${task.completed ? 'border-secondary' : 'border-outline'}`}
                  >
                    {task.completed && <Zap className="w-4 h-4 text-secondary fill-secondary" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-on-surface font-medium text-sm">{task.title}</p>
                    <p className="text-outline text-[10px] uppercase tracking-tighter">
                      REWARD: +{task.xpReward} XP
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-outline" />
                </div>
              ))}
              {recentTasks.length === 0 && (
                <p className="text-center text-outline text-xs py-8 uppercase tracking-widest">
                  No recent quests detected.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
