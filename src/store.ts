import { UserProfile, Task, GymLog, FuelLog, ActivityLog, ActivityKind } from './types';
import { getLevelProgress } from './lib/leveling';

const KEYS = {
  profile: 'sl_profile',
  tasks: 'sl_tasks',
  gymLogs: 'sl_gym_logs',
  fuelLogs: 'sl_fuel_logs',
  activity: 'sl_activity',
} as const;

/** Newest-first activity feed is capped so localStorage can't grow without bound. */
const MAX_ACTIVITY_ENTRIES = 200;

/**
 * `crypto.randomUUID` only exists in secure contexts, and `npm run dev` serves on
 * 0.0.0.0 over plain HTTP — so it is absent when the app is opened from another device.
 */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    // Quota exceeded (large avatar), private-mode Safari, or storage disabled.
    console.error(`[store] failed to persist "${key}"`, error);
    return false;
  }
}

// ── Profile ──────────────────────────────────────────────

const DEFAULT_PROFILE: UserProfile = {
  displayName: 'Player',
  avatar: null,
  level: 1,
  xp: 0,
  rank: 'E',
  streak: 0,
  lastActive: new Date().toISOString(),
  shadows: [],
};

/** Midnight-local day key, so streaks compare calendar days rather than 24h windows. */
function dayKey(date: Date): number {
  return Math.floor(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000,
  );
}

/**
 * Fills in fields added after a profile was first written, and re-derives level and
 * rank from XP so a hand-edited or stale record can't disagree with itself.
 */
function normalizeProfile(raw: Partial<UserProfile> | null): UserProfile {
  const merged: UserProfile = { ...DEFAULT_PROFILE, ...(raw ?? {}) };
  const progress = getLevelProgress(merged.xp);

  return {
    ...merged,
    xp: Number.isFinite(merged.xp) ? Math.max(0, Math.floor(merged.xp)) : 0,
    level: progress.level,
    rank: progress.rank,
    streak: Number.isFinite(merged.streak) ? Math.max(0, Math.floor(merged.streak)) : 0,
    shadows: Array.isArray(merged.shadows) ? merged.shadows : [],
  };
}

export function getProfile(): UserProfile {
  return normalizeProfile(read<Partial<UserProfile> | null>(KEYS.profile, null));
}

export function saveProfile(profile: UserProfile): void {
  write(KEYS.profile, normalizeProfile(profile));
}

/** An activity entry a profile change wants written, once the caller commits it. */
export interface PendingEvent {
  kind: ActivityKind;
  message: string;
  xpDelta?: number;
}

export interface ProfileMutation {
  profile: UserProfile;
  events: PendingEvent[];
}

/**
 * These `apply*` helpers are deliberately PURE — they return the events they want
 * logged instead of writing them. React double-invokes state updater functions under
 * StrictMode, so a `logActivity` call inside one lands in the feed twice. Callers run
 * the helper outside the updater and pass the result to `commitEvents`.
 */
export function commitEvents(events: PendingEvent[]): void {
  for (const e of events) {
    logActivity(e.kind, e.message, e.xpDelta);
  }
}

/**
 * Advances the daily streak on first visit of a new day: +1 when the last visit was
 * yesterday, reset to 1 when a day was skipped. Returns the same profile reference
 * and no events when the streak did not move, so callers can skip a re-render.
 */
export function applyDailyStreak(profile: UserProfile, now = new Date()): ProfileMutation {
  const last = new Date(profile.lastActive);
  const lastDay = Number.isNaN(last.getTime()) ? null : dayKey(last);
  const today = dayKey(now);

  if (lastDay === today && profile.streak > 0) {
    return { profile, events: [] };
  }

  const streak =
    lastDay === today ? Math.max(1, profile.streak)
    : lastDay === today - 1 ? profile.streak + 1
    : 1;

  const events: PendingEvent[] =
    streak === profile.streak
      ? []
      : [
          {
            kind: 'streak',
            message:
              streak === 1 && lastDay !== null && lastDay < today - 1
                ? 'Streak broken — counter reset to 1 day.'
                : `Daily check-in recorded. Streak at ${streak} ${streak === 1 ? 'day' : 'days'}.`,
          },
        ];

  return { profile: { ...profile, streak, lastActive: now.toISOString() }, events };
}

/**
 * Applies an XP change, emitting extra events when it crosses a level or rank
 * boundary. XP is floored at 0 so undoing a quest can't push it negative.
 */
export function applyXp(profile: UserProfile, delta: number, reason: string): ProfileMutation {
  const xp = Math.max(0, profile.xp + delta);
  const before = getLevelProgress(profile.xp);
  const after = getLevelProgress(xp);
  const events: PendingEvent[] = [];

  if (delta !== 0) {
    events.push({ kind: 'xp', message: reason, xpDelta: delta });
  }
  if (after.level > before.level) {
    events.push({ kind: 'level', message: `LEVEL UP — you have reached Level ${after.level}.` });
  } else if (after.level < before.level) {
    events.push({ kind: 'level', message: `Level lost — back to Level ${after.level}.` });
  }
  if (after.rank !== before.rank) {
    events.push({ kind: 'rank', message: `Rank re-evaluated: ${before.rank} → ${after.rank}.` });
  }

  return { profile: { ...profile, xp, level: after.level, rank: after.rank }, events };
}

// ── Activity Log ─────────────────────────────────────────

export function getActivityLogs(): ActivityLog[] {
  return read<ActivityLog[]>(KEYS.activity, []);
}

export function logActivity(kind: ActivityKind, message: string, xpDelta?: number): ActivityLog {
  const entry: ActivityLog = {
    id: uuid(),
    kind,
    message,
    timestamp: new Date().toISOString(),
    ...(xpDelta === undefined ? {} : { xpDelta }),
  };

  const logs = [entry, ...getActivityLogs()].slice(0, MAX_ACTIVITY_ENTRIES);
  write(KEYS.activity, logs);
  return entry;
}

export function clearActivityLogs(): void {
  write(KEYS.activity, []);
}

// ── Tasks ────────────────────────────────────────────────

export function getTasks(): Task[] {
  return read<Task[]>(KEYS.tasks, []);
}

function saveTasks(tasks: Task[]): void {
  write(KEYS.tasks, tasks);
}

export function addTask(task: Omit<Task, 'id'>): Task {
  const newTask: Task = { ...task, id: uuid() };
  saveTasks([...getTasks(), newTask]);
  logActivity('quest', `New ${task.type} quest registered: "${task.title}".`);
  return newTask;
}

export function updateTask(id: string, updates: Partial<Task>): void {
  saveTasks(getTasks().map(t => (t.id === id ? { ...t, ...updates } : t)));
}

/** Returns the removed task so the caller can refund XP if it had been completed. */
export function deleteTask(id: string): Task | undefined {
  const tasks = getTasks();
  const removed = tasks.find(t => t.id === id);
  saveTasks(tasks.filter(t => t.id !== id));
  if (removed) {
    logActivity('quest', `Quest abandoned: "${removed.title}".`);
  }
  return removed;
}

// ── Gym Logs ─────────────────────────────────────────────

export function getGymLogs(): GymLog[] {
  return read<GymLog[]>(KEYS.gymLogs, []);
}

export function addGymLog(log: Omit<GymLog, 'id'>): GymLog {
  const newLog: GymLog = { ...log, id: uuid() };
  write(KEYS.gymLogs, [newLog, ...getGymLogs()]); // newest first
  logActivity(
    'gym',
    `${log.exercise} — ${log.sets}×${log.reps} @ ${log.weight}kg (${log.sets * log.reps * log.weight}kg volume).`,
  );
  return newLog;
}

// ── Fuel Logs ────────────────────────────────────────────

export function getFuelLogs(): FuelLog[] {
  return read<FuelLog[]>(KEYS.fuelLogs, []);
}

export function addFuelLog(log: Omit<FuelLog, 'id'>): FuelLog {
  const newLog: FuelLog = { ...log, id: uuid() };
  write(KEYS.fuelLogs, [newLog, ...getFuelLogs()]); // newest first
  logActivity('fuel', `${log.food} logged — ${log.calories} kcal.`);
  return newLog;
}

/** Entries whose timestamp falls on the given calendar day (local time). */
export function filterToday<T extends { timestamp: string }>(entries: T[], now = new Date()): T[] {
  const today = dayKey(now);
  return entries.filter(e => {
    const d = new Date(e.timestamp);
    return !Number.isNaN(d.getTime()) && dayKey(d) === today;
  });
}
