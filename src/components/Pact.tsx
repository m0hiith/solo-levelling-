import { useMemo, useState } from 'react';
import { Account, PactHistory, UserProfile } from '../types';
import {
  clearedDayCount,
  computeStreak,
  getPact,
  getPactHistory,
  getProfileFor,
  getTasksFor,
  pactDayNumber,
  questProgress,
  savePact,
} from '../store';
import { partnerOf } from '../lib/auth';
import { addDays, ymd } from '../lib/time';
import { streakTaunt } from '../lib/phrases';
import { Avatar } from './Avatar';
import { m } from 'motion/react';
import { CalendarDays, Check, Flame, Pencil, Target, Trophy, Users } from 'lucide-react';
import { cn } from '../lib/utils';

interface PactProps {
  profile: UserProfile;
  account: Account;
}

interface PlayerView {
  id: string;
  name: string;
  accent: string;
  avatar: string | null;
  history: PactHistory;
  cleared: number;
  streak: number;
  best: number;
  level: number;
  todayDone: number;
  todayTotal: number;
}

/**
 * The 90-day pact: one grid per hunter, side by side.
 *
 * Both players' data is read straight out of their namespaced records, so on the
 * shared device this is live for both. Across two devices each save is local — the
 * backup export in Settings is what reconciles them.
 */
export function Pact({ profile, account }: PactProps) {
  const [pact, setPact] = useState(getPact);
  const [editing, setEditing] = useState(false);
  const today = ymd();
  const dayNumber = pactDayNumber(pact, today);

  const players = useMemo<PlayerView[]>(() => {
    const partner = partnerOf(account.id);
    const build = (id: string, accent: string, self: boolean): PlayerView => {
      const p = self ? profile : getProfileFor(id);
      const history = getPactHistory(self ? undefined : id);
      const progress = questProgress(getTasksFor(id));
      return {
        id,
        name: p.displayName,
        accent,
        avatar: p.avatar,
        history,
        cleared: clearedDayCount(history),
        streak: computeStreak(history, today),
        best: p.bestStreak,
        level: p.level,
        todayDone: progress.daily.completed,
        todayTotal: progress.daily.total,
      };
    };

    const list = [build(account.id, account.accent, true)];
    if (partner) list.push(build(partner.id, partner.accent, false));
    return list;
  }, [account, profile, today]);

  // A day only counts toward the pact when BOTH hunters cleared it.
  const bothCleared = useMemo(() => {
    if (players.length < 2) return players[0]?.cleared ?? 0;
    let count = 0;
    for (let i = 0; i < pact.totalDays; i++) {
      const date = addDays(pact.startDate, i);
      if (players.every(p => p.history[date]?.cleared)) count++;
    }
    return count;
  }, [players, pact]);

  const endDate = addDays(pact.startDate, pact.totalDays - 1);
  const remaining = Math.max(0, pact.totalDays - dayNumber);

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row justify-between md:items-end gap-6">
        <div>
          <span className="text-secondary uppercase tracking-[0.3em] text-[10px] block mb-2">
            Binding Contract
          </span>
          <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tight uppercase">
            {pact.title.split(' ')[0]}{' '}
            <span className="text-primary">{pact.title.split(' ').slice(1).join(' ')}</span>
          </h1>
          <p className="text-outline text-[10px] uppercase tracking-widest mt-2">
            {pact.startDate} → {endDate} · {remaining} days remaining
          </p>
        </div>
        <button
          onClick={() => setEditing(v => !v)}
          className="flex items-center gap-2 border border-white/10 text-outline px-4 py-3 font-headline font-bold text-[10px] uppercase tracking-widest hover:text-secondary hover:border-secondary/40 transition-all self-start md:self-auto"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit Pact
        </button>
      </header>

      {editing && (
        <form
          onSubmit={e => {
            e.preventDefault();
            savePact(pact);
            setEditing(false);
          }}
          className="bg-surface border border-primary/20 p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
        >
          <label className="space-y-2 block">
            <span className="text-outline font-label text-[10px] tracking-widest uppercase block">
              Pact name
            </span>
            <input
              type="text"
              value={pact.title}
              maxLength={30}
              onChange={e => setPact({ ...pact, title: e.target.value })}
              className={INPUT}
            />
          </label>
          <label className="space-y-2 block">
            <span className="text-outline font-label text-[10px] tracking-widest uppercase block">
              Day 1
            </span>
            <input
              type="date"
              value={pact.startDate}
              onChange={e => setPact({ ...pact, startDate: e.target.value || pact.startDate })}
              className={INPUT}
            />
          </label>
          <label className="space-y-2 block">
            <span className="text-outline font-label text-[10px] tracking-widest uppercase block">
              Length (days)
            </span>
            <input
              type="number"
              min={1}
              max={365}
              value={pact.totalDays}
              onChange={e =>
                setPact({ ...pact, totalDays: Math.max(1, Number(e.target.value) || 90) })
              }
              className={INPUT}
            />
          </label>
          <button
            type="submit"
            className="sm:col-span-3 bg-secondary text-background py-3 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all"
          >
            Seal the Pact
          </button>
        </form>
      )}

      {/* Headline counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={CalendarDays} label="Current day" value={`${dayNumber}`} suffix={`/ ${pact.totalDays}`} />
        <Stat icon={Users} label="Both cleared" value={`${bothCleared}`} suffix="days" />
        <Stat
          icon={Flame}
          label="Your streak"
          value={`${players[0]?.streak ?? 0}`}
          suffix="days"
          accent
        />
        <Stat icon={Trophy} label="Best ever" value={`${players[0]?.best ?? 0}`} suffix="days" accent />
      </div>

      <div className="bg-surface/50 border-l-2 border-primary p-5">
        <p className="font-headline text-sm tracking-widest uppercase text-primary">
          {streakTaunt(players[0]?.streak ?? 0, pact.totalDays)}
        </p>
      </div>

      {/* One grid per hunter */}
      <div className={cn('grid gap-8', players.length > 1 ? 'lg:grid-cols-2' : 'grid-cols-1')}>
        {players.map(player => (
          <PlayerGrid key={player.id} player={player} pact={pact} today={today} />
        ))}
      </div>

      {players.length < 2 && (
        <p className="text-outline text-[10px] uppercase tracking-widest text-center border border-dashed border-white/10 py-6">
          Only one account exists on this device. The second hunter's grid appears once they sign in here.
        </p>
      )}
    </div>
  );
}

const INPUT =
  'w-full bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-primary transition-colors';

function Stat({
  icon: Icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface p-5 border border-white/5">
      <Icon className={cn('w-4 h-4 mb-3', accent ? 'text-secondary' : 'text-primary')} />
      <div className="font-headline font-black text-3xl leading-none tracking-tighter">
        {value}
        {suffix && <span className="text-outline text-sm font-bold ml-1.5">{suffix}</span>}
      </div>
      <div className="text-outline text-[9px] uppercase tracking-widest mt-2">{label}</div>
    </div>
  );
}

function PlayerGrid({
  player,
  pact,
  today,
}: {
  player: PlayerView;
  pact: { startDate: string; totalDays: number };
  today: string;
}) {
  const cells = useMemo(() => {
    return Array.from({ length: pact.totalDays }, (_, index) => {
      const date = addDays(pact.startDate, index);
      const record = player.history[date];
      const state =
        date > today ? 'future'
        : record?.cleared ? 'cleared'
        : date === today ? 'today'
        : record && record.completed > 0 ? 'partial'
        : 'missed';
      return { date, index, state, record };
    });
  }, [player.history, pact, today]);

  const percent = Math.round((player.cleared / pact.totalDays) * 100);

  return (
    <section className="bg-surface/40 border border-white/5 p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 border p-0.5 shrink-0" style={{ borderColor: `${player.accent}66` }}>
          <Avatar avatar={player.avatar} displayName={player.name} className="text-sm" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-headline font-bold text-lg uppercase tracking-tight truncate">
            {player.name}
          </h2>
          <p className="text-outline text-[10px] uppercase tracking-widest">
            LVL {player.level} · {player.streak} day streak · {player.todayDone}/{player.todayTotal} today
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-headline font-black text-2xl leading-none" style={{ color: player.accent }}>
            {player.cleared}
          </div>
          <div className="text-outline text-[9px] uppercase tracking-widest mt-1">cleared</div>
        </div>
      </div>

      <div className="h-1.5 bg-white/5">
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className="h-full"
          style={{ background: player.accent, boxShadow: `0 0 10px ${player.accent}80` }}
        />
      </div>

      <div className="grid grid-cols-10 gap-1.5">
        {cells.map(cell => (
          <div
            key={cell.date}
            title={`Day ${cell.index + 1} · ${cell.date}${
              cell.record ? ` · ${cell.record.completed}/${cell.record.total} quests` : ''
            }`}
            className={cn(
              'aspect-square flex items-center justify-center transition-all',
              cell.state === 'today' && 'animate-pulse',
            )}
            style={{
              background:
                cell.state === 'cleared' ? player.accent
                : cell.state === 'partial' ? `${player.accent}33`
                : cell.state === 'missed' ? 'rgba(255,107,129,0.18)'
                : 'rgba(255,255,255,0.04)',
              border:
                cell.state === 'today' ? `1px solid ${player.accent}`
                : cell.state === 'missed' ? '1px solid rgba(255,107,129,0.35)'
                : '1px solid transparent',
            }}
          >
            {cell.state === 'cleared' && <Check className="w-2.5 h-2.5 text-background" strokeWidth={4} />}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] uppercase tracking-widest text-outline">
        <Legend color={player.accent} label="cleared" />
        <Legend color={`${player.accent}33`} label="partial" />
        <Legend color="rgba(255,107,129,0.18)" label="missed" />
        <Legend color="rgba(255,255,255,0.04)" label="ahead" />
        <span className="ml-auto flex items-center gap-1.5">
          <Target className="w-3 h-3" />
          {percent}% of pact
        </span>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 inline-block" style={{ background: color }} />
      {label}
    </span>
  );
}

