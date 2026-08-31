import { useMemo, useState } from 'react';
import { ActivityKind, ActivityLog } from '../types';
import { clearActivityLogs, getActivityLogs } from '../store';
import { m } from 'motion/react';
import {
  Activity,
  ArrowUpRight,
  BellRing,
  CheckSquare,
  Dumbbell,
  Flame,
  ShieldCheck,
  Trash2,
  User,
  Zap,
  Terminal,
} from 'lucide-react';
import { cn } from '../lib/utils';

const KIND_META: Record<ActivityKind, { label: string; icon: typeof Zap; color: string }> = {
  quest: { label: 'QUEST', icon: CheckSquare, color: 'text-secondary' },
  xp: { label: 'XP', icon: Zap, color: 'text-secondary' },
  level: { label: 'LEVEL', icon: ArrowUpRight, color: 'text-primary' },
  rank: { label: 'RANK', icon: ShieldCheck, color: 'text-primary' },
  gym: { label: 'GYM', icon: Dumbbell, color: 'text-secondary' },
  fuel: { label: 'FUEL', icon: Flame, color: 'text-primary' },
  streak: { label: 'STREAK', icon: Activity, color: 'text-secondary' },
  profile: { label: 'PROFILE', icon: User, color: 'text-outline' },
  alert: { label: 'ALERT', icon: BellRing, color: 'text-primary' },
  system: { label: 'SYSTEM', icon: Terminal, color: 'text-outline' },
};

const FILTERS: { id: 'all' | ActivityKind; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'quest', label: 'QUESTS' },
  { id: 'xp', label: 'XP' },
  { id: 'level', label: 'PROGRESSION' },
  { id: 'gym', label: 'GYM' },
  { id: 'fuel', label: 'FUEL' },
  { id: 'alert', label: 'ALERTS' },
];

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'UNKNOWN';

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
}

/** Progression entries cover both level and rank changes under one filter chip. */
function matchesFilter(log: ActivityLog, filter: 'all' | ActivityKind): boolean {
  if (filter === 'all') return true;
  if (filter === 'level') return log.kind === 'level' || log.kind === 'rank';
  return log.kind === filter;
}

export function Logs() {
  const [logs, setLogs] = useState<ActivityLog[]>(getActivityLogs);
  const [filter, setFilter] = useState<'all' | ActivityKind>('all');

  const visible = useMemo(() => logs.filter(l => matchesFilter(l, filter)), [logs, filter]);

  const groups = useMemo(() => {
    const byDay = new Map<string, ActivityLog[]>();
    for (const log of visible) {
      const label = dayLabel(log.timestamp);
      const bucket = byDay.get(label);
      if (bucket) bucket.push(log);
      else byDay.set(label, [log]);
    }
    return [...byDay.entries()];
  }, [visible]);

  const xpToday = useMemo(
    () =>
      logs
        .filter(l => l.xpDelta !== undefined && dayLabel(l.timestamp) === 'TODAY')
        .reduce((sum, l) => sum + (l.xpDelta ?? 0), 0),
    [logs],
  );

  const handleClear = () => {
    if (!window.confirm('Purge the entire system log? This cannot be undone.')) return;
    clearActivityLogs();
    setLogs(getActivityLogs());
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <span className="text-secondary uppercase tracking-[0.3em] text-[10px] block mb-2">
            Activity Record
          </span>
          <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tighter uppercase">
            System <span className="text-primary">Log</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-outline font-label text-[10px] tracking-widest uppercase block">
              XP Today
            </span>
            <span
              className={cn(
                'font-headline font-bold text-2xl',
                xpToday >= 0 ? 'text-secondary' : 'text-error',
              )}
            >
              {xpToday >= 0 ? '+' : ''}
              {xpToday}
            </span>
          </div>
          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="flex items-center gap-2 border border-white/10 text-outline px-4 py-3 font-headline font-bold text-[10px] uppercase tracking-widest hover:text-error hover:border-error/40 transition-all disabled:opacity-30 disabled:hover:text-outline disabled:hover:border-white/10"
          >
            <Trash2 className="w-4 h-4" />
            Purge
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'px-4 py-2 font-headline font-bold text-[10px] uppercase tracking-widest border transition-all',
              filter === f.id
                ? 'border-secondary text-secondary bg-secondary/10'
                : 'border-white/10 text-outline hover:text-primary hover:border-primary/30',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="space-y-10">
        {groups.map(([label, entries]) => (
          <section key={label} className="space-y-3">
            <div className="flex items-center gap-4">
              <h2 className="font-headline font-bold text-[10px] tracking-[0.3em] text-primary uppercase">
                {label}
              </h2>
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-outline font-label text-[10px] tracking-widest uppercase">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            <div className="space-y-px">
              {entries.map((log, i) => {
                const meta = KIND_META[log.kind] ?? KIND_META.system;
                const Icon = meta.icon;
                return (
                  <m.div
                    key={log.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.3) }}
                    className="bg-surface/60 hover:bg-surface transition-colors flex items-center gap-4 px-5 py-4 border-l-2 border-white/5 hover:border-primary/40"
                  >
                    <Icon className={cn('w-4 h-4 shrink-0', meta.color)} />
                    <span
                      className={cn(
                        'font-headline font-bold text-[9px] tracking-widest uppercase w-20 shrink-0 hidden sm:block',
                        meta.color,
                      )}
                    >
                      {meta.label}
                    </span>
                    <p className="flex-1 text-sm text-on-surface">{log.message}</p>
                    {log.xpDelta !== undefined && log.xpDelta !== 0 && (
                      <span
                        className={cn(
                          'font-headline font-bold text-xs shrink-0',
                          log.xpDelta > 0 ? 'text-secondary' : 'text-error',
                        )}
                      >
                        {log.xpDelta > 0 ? '+' : ''}
                        {log.xpDelta} XP
                      </span>
                    )}
                    <time
                      dateTime={log.timestamp}
                      className="text-outline font-label text-[10px] tracking-widest uppercase shrink-0 w-16 text-right"
                    >
                      {new Date(log.timestamp).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </m.div>
                );
              })}
            </div>
          </section>
        ))}

        {visible.length === 0 && (
          <div className="text-center py-20 border border-dashed border-white/10">
            <Terminal className="w-10 h-10 text-outline/30 mx-auto mb-4" />
            <p className="text-outline text-xs uppercase tracking-[0.2em]">
              {logs.length === 0
                ? 'No activity recorded. The System is waiting.'
                : 'No entries match this filter.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
