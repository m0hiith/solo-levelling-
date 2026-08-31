import {
  ActivityKind,
  ActivityLog,
  FuelLog,
  GymLog,
  Pact,
  PactDay,
  PactHistory,
  Reminder,
  ReminderTally,
  Task,
  UserProfile,
} from './types';
import { getLevelProgress } from './lib/leveling';
import { uuid } from './lib/crypto';
import { invalidate, keyFor, read, userKey, write } from './lib/storage';
import { addDays, dayKey, daysBetween, isoWeekKey, ymd } from './lib/time';

/** Per-player record names. The active player's id is prefixed by `userKey`. */
const NAMES = {
  profile: 'profile',
  tasks: 'tasks',
  gymLogs: 'gymLogs',
  fuelLogs: 'fuelLogs',
  activity: 'activity',
  reminders: 'reminders',
  tally: 'tally',
  days: 'days',
} as const;

/** The pact is shared, so it lives outside either account. */
const PACT_KEY = 'sl:pact';

/** Newest-first activity feed is capped so localStorage can't grow without bound. */
const MAX_ACTIVITY_ENTRIES = 200;
/** Ninety days of history plus a margin — old tallies are dropped rather than kept forever. */
const MAX_TALLY_DAYS = 120;

// ── Profile ──────────────────────────────────────────────

const DEFAULT_PROFILE: UserProfile = {
  displayName: 'Player',
  avatar: null,
  level: 1,
  xp: 0,
  rank: 'E',
  streak: 0,
  bestStreak: 0,
  lastActive: new Date().toISOString(),
  shadows: [],
};

/**
 * Fills in fields added after a profile was first written, and re-derives level and
 * rank from XP so a hand-edited or stale record can't disagree with itself.
 */
function normalizeProfile(raw: Partial<UserProfile> | null): UserProfile {
  const merged: UserProfile = { ...DEFAULT_PROFILE, ...(raw ?? {}) };
  const progress = getLevelProgress(merged.xp);
  const streak = Number.isFinite(merged.streak) ? Math.max(0, Math.floor(merged.streak)) : 0;

  return {
    ...merged,
    xp: Number.isFinite(merged.xp) ? Math.max(0, Math.floor(merged.xp)) : 0,
    level: progress.level,
    rank: progress.rank,
    streak,
    bestStreak: Math.max(streak, Number.isFinite(merged.bestStreak) ? merged.bestStreak : 0),
    shadows: Array.isArray(merged.shadows) ? merged.shadows : [],
  };
}

export function getProfile(): UserProfile {
  return normalizeProfile(read<Partial<UserProfile> | null>(userKey(NAMES.profile), null));
}

export function getProfileFor(userId: string): UserProfile {
  return normalizeProfile(read<Partial<UserProfile> | null>(keyFor(userId, NAMES.profile), null));
}

export function saveProfile(profile: UserProfile): void {
  write(userKey(NAMES.profile), normalizeProfile(profile));
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
  return read<ActivityLog[]>(userKey(NAMES.activity), []);
}

export function logActivity(kind: ActivityKind, message: string, xpDelta?: number): ActivityLog {
  const entry: ActivityLog = {
    id: uuid(),
    kind,
    message,
    timestamp: new Date().toISOString(),
    ...(xpDelta === undefined ? {} : { xpDelta }),
  };

  write(userKey(NAMES.activity), [entry, ...getActivityLogs()].slice(0, MAX_ACTIVITY_ENTRIES));
  return entry;
}

export function clearActivityLogs(): void {
  write(userKey(NAMES.activity), []);
}

// ── Tasks ────────────────────────────────────────────────

/** Older saves predate `completedAt`. A null date means "unknown", which rolls over. */
function normalizeTask(task: Task): Task {
  return { ...task, completedAt: task.completedAt ?? null };
}

export function getTasks(): Task[] {
  return read<Task[]>(userKey(NAMES.tasks), []).map(normalizeTask);
}

export function getTasksFor(userId: string): Task[] {
  return read<Task[]>(keyFor(userId, NAMES.tasks), []).map(normalizeTask);
}

function saveTasks(tasks: Task[]): void {
  write(userKey(NAMES.tasks), tasks);
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
    // Drop the alert that was chasing it, so no orphan keeps firing.
    if (removed.reminderId) deleteReminder(removed.reminderId, { silent: true });
  }
  return removed;
}

export interface QuestProgress {
  daily: { completed: number; total: number };
  weekly: { completed: number; total: number };
  /** Every daily quest cleared, and there was at least one to clear. */
  cleared: boolean;
  percent: number;
}

export function questProgress(tasks: Task[]): QuestProgress {
  const daily = tasks.filter(t => t.type === 'daily');
  const weekly = tasks.filter(t => t.type === 'weekly');
  const done = daily.filter(t => t.completed).length;

  return {
    daily: { completed: done, total: daily.length },
    weekly: { completed: weekly.filter(t => t.completed).length, total: weekly.length },
    cleared: daily.length > 0 && done === daily.length,
    percent: daily.length ? Math.round((done / daily.length) * 100) : 0,
  };
}

// ── Reminders ────────────────────────────────────────────

export function getReminders(): Reminder[] {
  return read<Reminder[]>(userKey(NAMES.reminders), []);
}

export function saveReminders(reminders: Reminder[]): void {
  write(userKey(NAMES.reminders), reminders);
}

export function addReminder(reminder: Omit<Reminder, 'id' | 'createdAt'>): Reminder {
  const created: Reminder = { ...reminder, id: uuid(), createdAt: new Date().toISOString() };
  saveReminders([...getReminders(), created]);
  logActivity('alert', `Alert armed: "${created.label}".`);
  return created;
}

export function updateReminder(id: string, updates: Partial<Reminder>): void {
  saveReminders(getReminders().map(r => (r.id === id ? { ...r, ...updates } : r)));
}

export function deleteReminder(id: string, options: { silent?: boolean } = {}): void {
  const reminder = getReminders().find(r => r.id === id);
  saveReminders(getReminders().filter(r => r.id !== id));
  // Unlink the quest so its toggle stops offering to edit a reminder that is gone.
  saveTasks(getTasks().map(t => (t.reminderId === id ? { ...t, reminderId: undefined } : t)));
  if (reminder && !options.silent) {
    logActivity('alert', `Alert disarmed: "${reminder.label}".`);
  }
}

// ── Reminder tallies ─────────────────────────────────────

function getTally(): ReminderTally {
  return read<ReminderTally>(userKey(NAMES.tally), {});
}

/** Today's acknowledged count for one alert — the "5 / 8 glasses" number. */
export function tallyFor(reminderId: string, date = ymd()): number {
  return getTally()[date]?.[reminderId] ?? 0;
}

export function bumpTally(reminderId: string, delta = 1): number {
  const date = ymd();
  const tally = getTally();
  const today = { ...(tally[date] ?? {}) };
  const next = Math.max(0, (today[reminderId] ?? 0) + delta);
  today[reminderId] = next;

  // Trim history so the record cannot grow past the length of the pact.
  const trimmed: ReminderTally = { ...tally, [date]: today };
  const cutoff = addDays(date, -MAX_TALLY_DAYS);
  for (const key of Object.keys(trimmed)) {
    if (key < cutoff) delete trimmed[key];
  }

  write(userKey(NAMES.tally), trimmed);
  return next;
}

// ── 90-day pact ──────────────────────────────────────────

const DEFAULT_PACT: Pact = { title: '90 DAY ASCENSION', startDate: ymd(), totalDays: 90 };

export function getPact(): Pact {
  const pact = read<Partial<Pact> | null>(PACT_KEY, null);
  return {
    title: pact?.title || DEFAULT_PACT.title,
    startDate: pact?.startDate || DEFAULT_PACT.startDate,
    totalDays:
      Number.isFinite(pact?.totalDays) && (pact?.totalDays ?? 0) > 0
        ? Math.floor(pact!.totalDays!)
        : DEFAULT_PACT.totalDays,
  };
}

export function savePact(pact: Pact): void {
  write(PACT_KEY, pact);
  logActivity('system', `Pact updated: ${pact.totalDays} days from ${pact.startDate}.`);
}

/** 1-based day number, clamped to the pact. 0 means the pact has not started yet. */
export function pactDayNumber(pact = getPact(), today = ymd()): number {
  const elapsed = daysBetween(pact.startDate, today);
  if (elapsed < 0) return 0;
  return Math.min(pact.totalDays, elapsed + 1);
}

export function getPactHistory(userId?: string): PactHistory {
  const key = userId ? keyFor(userId, NAMES.days) : userKey(NAMES.days);
  return read<PactHistory>(key, {});
}

function savePactHistory(history: PactHistory): void {
  write(userKey(NAMES.days), history);
}

/**
 * Writes today's row of the pact grid from the live quest list. Called after any quest
 * toggle so the grid, the streak and the partner view all move together.
 */
export function recordToday(tasks = getTasks(), profile = getProfile()): PactDay {
  const progress = questProgress(tasks);
  const today = ymd();
  const entry: PactDay = {
    date: today,
    cleared: progress.cleared,
    completed: progress.daily.completed,
    total: progress.daily.total,
    xp: profile.xp,
  };
  savePactHistory({ ...getPactHistory(), [today]: entry });
  return entry;
}

/**
 * Consecutive cleared days ending today. Today only counts once it is actually
 * cleared, so the counter does not drop to zero every morning.
 */
export function computeStreak(history: PactHistory, today = ymd()): number {
  let streak = history[today]?.cleared ? 1 : 0;
  let cursor = addDays(today, -1);
  while (history[cursor]?.cleared) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function clearedDayCount(history: PactHistory): number {
  return Object.values(history).filter(d => d.cleared).length;
}

// ── Rollover ─────────────────────────────────────────────

export interface RolloverResult {
  profile: UserProfile;
  events: PendingEvent[];
  /** True when quests were reset, so the caller knows to re-read them. */
  tasksChanged: boolean;
}

/**
 * Runs once per app load and again when the clock crosses midnight with the tab open.
 *
 * Daily quests used to stay ticked forever, which made a 90-day streak impossible to
 * run — this is what resets them. It also freezes yesterday's row of the pact grid
 * before wiping the ticks, and re-derives the streak from that frozen history.
 */
export function runRollover(profile: UserProfile, now = new Date()): RolloverResult {
  const today = ymd(now);
  const week = isoWeekKey(now);
  const tasks = getTasks();
  const events: PendingEvent[] = [];

  // Freeze whatever the day before ended on, if it was never written.
  const history = getPactHistory();
  const lastActive = new Date(profile.lastActive);
  const lastDay = Number.isNaN(lastActive.getTime()) ? today : ymd(lastActive);

  if (lastDay !== today && !history[lastDay]) {
    const progress = questProgress(tasks);
    history[lastDay] = {
      date: lastDay,
      cleared: progress.cleared,
      completed: progress.daily.completed,
      total: progress.daily.total,
      xp: profile.xp,
    };
  }

  // Reset quests whose period has turned over.
  let tasksChanged = false;
  const rolled = tasks.map(task => {
    if (!task.completed) return task;
    // A completed quest with no date came from a pre-rollover save: reset it too.
    const stale =
      !task.completedAt ||
      (task.type === 'daily'
        ? ymd(new Date(task.completedAt)) !== today
        : isoWeekKey(new Date(task.completedAt)) !== week);
    if (!stale) return task;
    tasksChanged = true;
    return { ...task, completed: false, completedAt: null };
  });
  if (tasksChanged) saveTasks(rolled);

  // Record today's (now reset) row, then derive the streak from the full history.
  const progress = questProgress(rolled);
  history[today] = {
    date: today,
    cleared: progress.cleared,
    completed: progress.daily.completed,
    total: progress.daily.total,
    xp: profile.xp,
  };
  savePactHistory(history);

  const streak = computeStreak(history, today);
  const bestStreak = Math.max(profile.bestStreak, streak);

  if (lastDay !== today) {
    const missed = history[lastDay] && !history[lastDay].cleared;
    events.push({
      kind: 'streak',
      message: missed
        ? `Day ${lastDay} was not cleared. Streak reset — ${streak} ${streak === 1 ? 'day' : 'days'} standing.`
        : `New day registered. Streak at ${streak} ${streak === 1 ? 'day' : 'days'}.`,
    });
  }

  return {
    profile: { ...profile, streak, bestStreak, lastActive: now.toISOString() },
    events,
    tasksChanged,
  };
}

/** Re-derives the streak after a quest toggle, without the full rollover pass. */
export function syncStreak(profile: UserProfile, tasks = getTasks()): UserProfile {
  recordToday(tasks, profile);
  const streak = computeStreak(getPactHistory());
  if (streak === profile.streak && streak <= profile.bestStreak) return profile;
  return { ...profile, streak, bestStreak: Math.max(profile.bestStreak, streak) };
}

// ── Gym Logs ─────────────────────────────────────────────

export function getGymLogs(): GymLog[] {
  return read<GymLog[]>(userKey(NAMES.gymLogs), []);
}

export function addGymLog(log: Omit<GymLog, 'id'>): GymLog {
  const newLog: GymLog = { ...log, id: uuid() };
  write(userKey(NAMES.gymLogs), [newLog, ...getGymLogs()]); // newest first
  logActivity(
    'gym',
    `${log.exercise} — ${log.sets}×${log.reps} @ ${log.weight}kg (${log.sets * log.reps * log.weight}kg volume).`,
  );
  return newLog;
}

// ── Fuel Logs ────────────────────────────────────────────

export function getFuelLogs(): FuelLog[] {
  return read<FuelLog[]>(userKey(NAMES.fuelLogs), []);
}

export function addFuelLog(log: Omit<FuelLog, 'id'>): FuelLog {
  const newLog: FuelLog = { ...log, id: uuid() };
  write(userKey(NAMES.fuelLogs), [newLog, ...getFuelLogs()]); // newest first
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

// ── Backup ───────────────────────────────────────────────

/**
 * There is no server, so a phone and a laptop hold separate saves. Export/import is
 * how the two devices are reconciled: everything under the `sl:` namespace, as JSON.
 */
export function exportSave(): string {
  const bundle: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('sl:')) continue;
    try {
      bundle[key] = JSON.parse(localStorage.getItem(key) ?? 'null');
    } catch {
      /* skip unreadable record */
    }
  }
  return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), data: bundle });
}

export function importSave(json: string): void {
  const parsed = JSON.parse(json) as { data?: Record<string, unknown> };
  if (!parsed?.data || typeof parsed.data !== 'object') {
    throw new Error('That file is not a System backup.');
  }
  for (const [key, value] of Object.entries(parsed.data)) {
    if (!key.startsWith('sl:')) continue;
    localStorage.setItem(key, JSON.stringify(value));
  }
  invalidate();
}
