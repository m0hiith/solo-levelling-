import { useMemo } from 'react';
import { Account, Reminder, UserProfile } from '../types';
import {
  clearedDayCount,
  computeStreak,
  getPact,
  getPactHistory,
  getProfileFor,
  getTasks,
  getTasksFor,
  pactDayNumber,
  questProgress,
  tallyFor,
} from '../store';
import { partnerOf } from '../lib/auth';
import { getLevelProgress } from '../lib/leveling';
import { dailyTarget, nextFireAt } from '../lib/alerts';
import { addDays, formatClock, minutesSinceMidnight, ymd } from '../lib/time';
import { streakTaunt } from '../lib/phrases';
import { REMINDER_ICONS } from '../lib/icons';
import { Avatar } from './Avatar';
import { m } from 'motion/react';
import { BellRing, ChevronRight, Flame, Swords, Terminal, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface DashboardProps {
  profile: UserProfile;
  account: Account;
  reminders: Reminder[];
  onNavigate: (tab: string) => void;
}

/** Circumference of the r=110 progress ring, used to drive its stroke-dasharray. */
const RING_CIRCUMFERENCE = 2 * Math.PI * 110;

export function Dashboard({ profile, account, reminders, onNavigate }: DashboardProps) {
  const today = ymd();
  const tasks = useMemo(getTasks, []);
  const pact = useMemo(getPact, []);
  const history = useMemo(getPactHistory, []);
  const progress = useMemo(() => questProgress(tasks), [tasks]);
  const levels = getLevelProgress(profile.xp);
  const dayNumber = pactDayNumber(pact, today);

  const recentTasks = useMemo(
    () =>
      [...tasks]
        .sort((a, b) => Number(a.completed) - Number(b.completed))
        .slice(0, 4),
    [tasks],
  );

  const partner = useMemo(() => {
    const other = partnerOf(account.id);
    if (!other) return null;
    const partnerProfile = getProfileFor(other.id);
    const partnerHistory = getPactHistory(other.id);
    const partnerProgress = questProgress(getTasksFor(other.id));
    return {
      account: other,
      profile: partnerProfile,
      streak: computeStreak(partnerHistory, today),
      cleared: clearedDayCount(partnerHistory),
      done: partnerProgress.daily.completed,
      total: partnerProgress.daily.total,
    };
  }, [account.id, today]);

  const myCleared = useMemo(() => clearedDayCount(history), [history]);

  // The next alert due, plus any counted alert that is behind schedule right now.
  const alertStatus = useMemo(() => {
    const next = nextFireAt(reminders, new Date());
    const counted = reminders
      .filter(r => r.enabled && r.trackCount)
      .map(r => ({ reminder: r, count: tallyFor(r.id), target: dailyTarget(r) }));
    return { next, counted };
  }, [reminders]);

  return (
    <div className="space-y-8">
      {/* System Alert */}
      <m.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-surface border-l-4 border-primary p-6 relative overflow-hidden"
      >
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <Terminal className="w-48 h-48" />
        </div>
        <p className="text-primary font-headline tracking-[0.2em] text-[10px] uppercase mb-2">
          SYSTEM NOTIFICATION · DAY {dayNumber} OF {pact.totalDays}
        </p>
        <h1 className="text-on-surface font-headline font-bold text-xl md:text-2xl tracking-tighter max-w-2xl leading-none uppercase">
          {profile.displayName},{' '}
          {progress.daily.total === 0 ? (
            <>
              NO DAILY QUESTS REGISTERED.{' '}
              <span className="text-secondary">A DAY WITHOUT OBJECTIVES CANNOT BE CLEARED.</span>
            </>
          ) : progress.cleared ? (
            <>
              TODAY IS CLEARED. <span className="text-secondary">HOLD THE LINE.</span>
            </>
          ) : (
            <>
              {progress.daily.total - progress.daily.completed} QUEST
              {progress.daily.total - progress.daily.completed === 1 ? '' : 'S'} REMAIN
              {progress.daily.total - progress.daily.completed === 1 ? 'S' : ''}.{' '}
              <span className="text-secondary">DO NOT FAIL.</span>
            </>
          )}
        </h1>
        <p className="text-outline text-[10px] uppercase tracking-widest mt-3">
          {streakTaunt(profile.streak, pact.totalDays)}
        </p>
      </m.div>

      {/* Pact strip */}
      <button
        onClick={() => onNavigate('pact')}
        className="w-full bg-surface/40 border border-white/5 p-5 hover:border-primary/30 transition-colors text-left group"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-outline font-label text-[10px] tracking-widest uppercase">
            {pact.title} · {myCleared} cleared
            {partner && ` · ${partner.profile.displayName} ${partner.cleared}`}
          </span>
          <ChevronRight className="w-4 h-4 text-outline group-hover:text-primary transition-colors" />
        </div>
        <div className="flex gap-[3px]">
          {Array.from({ length: pact.totalDays }, (_, index) => {
            const date = addDays(pact.startDate, index);
            const record = history[date];
            return (
              <div
                key={date}
                className={cn(
                  'flex-1 h-6 min-w-[2px] transition-all',
                  date === today && 'ring-1 ring-secondary',
                )}
                style={{
                  background:
                    record?.cleared ? account.accent
                    : date > today ? 'rgba(255,255,255,0.04)'
                    : record && record.completed > 0 ? `${account.accent}33`
                    : 'rgba(255,107,129,0.15)',
                }}
              />
            );
          })}
        </div>
      </button>

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
                strokeDasharray={`${(progress.percent / 100) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                style={{ filter: 'drop-shadow(0 0 8px rgba(0, 241, 253, 0.4))' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-secondary font-headline text-5xl font-black">
                {progress.percent}%
              </span>
              <span className="text-outline font-label text-[10px] tracking-widest uppercase">
                DAILY SYNC
              </span>
              <span className="text-outline/60 font-label text-[9px] tracking-widest uppercase mt-1">
                {progress.daily.completed} / {progress.daily.total} quests
              </span>
            </div>
          </div>
          <div className="mt-8 text-center">
            <div className="flex items-center gap-2 text-secondary mb-1">
              <Flame className="w-6 h-6 fill-secondary" />
              <span className="font-headline font-bold text-2xl">{profile.streak} DAY STREAK</span>
            </div>
            <p className="text-outline text-[10px] uppercase tracking-widest">
              PERSONAL BEST · {profile.bestStreak} DAYS
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
                  LEVEL {levels.level}
                </h2>
              </div>
              <div className="bg-secondary/10 border border-secondary px-4 py-2">
                <span className="text-secondary font-headline font-black text-2xl tracking-tighter">
                  RANK {levels.rank}
                </span>
              </div>
            </div>
            <div className="mb-2 flex justify-between items-end">
              <span className="text-outline font-label text-[10px] tracking-widest uppercase">
                EXPERIENCE POINTS (XP)
              </span>
              <span className="text-secondary font-headline text-xs">
                {levels.xpIntoLevel} / {levels.xpForNext}
              </span>
            </div>
            <div className="h-2 bg-white/5 relative overflow-hidden">
              <m.div
                initial={{ width: 0 }}
                animate={{ width: `${levels.percent}%` }}
                className="absolute left-0 top-0 h-full bg-secondary shadow-[0_0_10px_rgba(0,241,253,0.5)]"
              />
            </div>
            <p className="text-outline font-label text-[10px] tracking-widest uppercase mt-2">
              {profile.xp.toLocaleString()} TOTAL XP EARNED
            </p>
          </div>

          {/* Head to head */}
          {partner && (
            <button
              onClick={() => onNavigate('pact')}
              className="bg-surface/50 p-5 border border-white/5 hover:border-primary/30 transition-colors text-left"
            >
              <div className="flex items-center gap-2 mb-4 text-primary">
                <Swords className="w-3.5 h-3.5" />
                <span className="font-headline font-bold text-[10px] tracking-[0.2em] uppercase">
                  Head to head
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Side
                  name={profile.displayName}
                  avatar={profile.avatar}
                  accent={account.accent}
                  streak={profile.streak}
                  done={progress.daily.completed}
                  total={progress.daily.total}
                />
                <span className="font-headline font-black text-outline text-xs shrink-0">VS</span>
                <Side
                  name={partner.profile.displayName}
                  avatar={partner.profile.avatar}
                  accent={partner.account.accent}
                  streak={partner.streak}
                  done={partner.done}
                  total={partner.total}
                  align="right"
                />
              </div>
            </button>
          )}

          {/* Alerts */}
          <button
            onClick={() => onNavigate('alerts')}
            className="bg-surface/30 p-5 border border-white/5 hover:border-secondary/30 transition-colors text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-secondary">
                <BellRing className="w-3.5 h-3.5" />
                <span className="font-headline font-bold text-[10px] tracking-[0.2em] uppercase">
                  Alert protocol
                </span>
              </div>
              <span className="text-outline text-[10px] font-label uppercase tracking-widest">
                {alertStatus.next
                  ? `NEXT ${formatClock(minutesSinceMidnight(alertStatus.next))}`
                  : 'NONE ARMED'}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {alertStatus.counted.map(({ reminder, count, target }) => {
                const Icon = REMINDER_ICONS[reminder.icon].icon;
                return (
                  <div
                    key={reminder.id}
                    className="flex items-center gap-2 bg-background/60 px-3 py-2 border border-white/5"
                  >
                    <Icon className="w-3.5 h-3.5 text-secondary" />
                    <span className="font-headline text-xs">
                      {count}
                      <span className="text-outline"> / {target}</span>
                    </span>
                    <span className="text-outline text-[9px] uppercase tracking-widest">
                      {reminder.label.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
              {alertStatus.counted.length === 0 && (
                <span className="text-outline text-[10px] uppercase tracking-widest">
                  No counted alerts. Add one to track water or protein.
                </span>
              )}
            </div>
          </button>

          {/* Recent Quests */}
          <div className="bg-surface/30 p-6 flex-1">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline font-bold text-xs tracking-[0.2em] text-primary uppercase">
                TODAY'S QUESTS
              </h3>
              <button
                onClick={() => onNavigate('tasks')}
                className="text-outline text-[10px] font-label uppercase hover:text-primary transition-colors"
              >
                MANAGE
              </button>
            </div>
            <div className="space-y-4">
              {recentTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-4 bg-surface/50 p-4 hover:bg-surface transition-colors"
                >
                  <div
                    className={cn(
                      'w-6 h-6 border-2 flex items-center justify-center shrink-0',
                      task.completed ? 'border-secondary' : 'border-outline',
                    )}
                  >
                    {task.completed && <Zap className="w-4 h-4 text-secondary fill-secondary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-on-surface font-medium text-sm truncate">{task.title}</p>
                    <p className="text-outline text-[10px] uppercase tracking-tighter">
                      REWARD: +{task.xpReward} XP
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-outline shrink-0" />
                </div>
              ))}
              {recentTasks.length === 0 && (
                <p className="text-center text-outline text-xs py-8 uppercase tracking-widest">
                  No quests registered. The pact needs objectives.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Side({
  name,
  avatar,
  accent,
  streak,
  done,
  total,
  align = 'left',
}: {
  name: string;
  avatar: string | null;
  accent: string;
  streak: number;
  done: number;
  total: number;
  align?: 'left' | 'right';
}) {
  return (
    <div
      className={cn(
        'flex-1 flex items-center gap-3 min-w-0',
        align === 'right' && 'flex-row-reverse text-right',
      )}
    >
      <div className="w-10 h-10 border p-0.5 shrink-0" style={{ borderColor: `${accent}66` }}>
        <Avatar avatar={avatar} displayName={name} className="text-[10px]" />
      </div>
      <div className="min-w-0">
        <p className="font-headline font-bold text-sm uppercase truncate">{name}</p>
        <p className="text-outline text-[10px] uppercase tracking-widest">
          {streak}d · {done}/{total} today
        </p>
      </div>
    </div>
  );
}
