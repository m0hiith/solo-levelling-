export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

// ── Accounts ─────────────────────────────────────────────

/**
 * A player login. Two of these are seeded on first run so the pact has both hunters
 * from the start; either can be renamed and re-passworded from Settings.
 */
export interface Account {
  id: string;
  /** Lowercased, unique. What gets typed at the login gate. */
  username: string;
  passwordHash: string;
  salt: string;
  /** Accent colour used to tell the two players apart in shared views. */
  accent: string;
  createdAt: string;
}

export interface Session {
  userId: string;
  /** ISO timestamp the session lapses at. */
  expiresAt: string;
}

// ── Profile ──────────────────────────────────────────────

export interface UserProfile {
  displayName: string;
  /** Data URL of the player's picture, or null to use the generated fallback. */
  avatar: string | null;
  level: number;
  xp: number;
  rank: Rank;
  streak: number;
  /** Longest streak ever reached, kept so a broken streak still shows the peak. */
  bestStreak: number;
  lastActive: string;
  shadows: string[];
}

// ── Quests ───────────────────────────────────────────────

export type TaskType = 'daily' | 'weekly';

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  xpReward: number;
  completed: boolean;
  /** When it was last cleared — drives the daily/weekly reset at rollover. */
  completedAt: string | null;
  createdAt: string;
  /** Reminder attached to this quest, if the player asked to be nagged about it. */
  reminderId?: string;
}

// ── Reminders ────────────────────────────────────────────

export type ReminderIcon =
  | 'water'
  | 'gym'
  | 'food'
  | 'sleep'
  | 'quest'
  | 'heart'
  | 'bell'
  | 'brain';

/**
 * One alert rule. A single-shot alert has `everyMinutes: 0` and fires at `startMinutes`;
 * a drumbeat like "water every 2h from 08:00 to 22:00" repeats across the window.
 */
export interface Reminder {
  id: string;
  label: string;
  /** Body text of the notification. Empty means "let the System write one". */
  body: string;
  icon: ReminderIcon;
  enabled: boolean;
  /** Minutes past local midnight. */
  startMinutes: number;
  endMinutes: number;
  /** 0 = fire once at `startMinutes`; otherwise the gap between repeats. */
  everyMinutes: number;
  /** Local weekday numbers (0 = Sunday) the rule is armed on. */
  days: number[];
  /** Quest this alert chases. Fires are skipped once that quest is cleared. */
  taskId?: string;
  /** Shows a tally like "5 / 8" and a DONE button on the alert. */
  trackCount: boolean;
  /** Last delivered slot as `YYYY-MM-DD#minutes`, so a reload cannot re-fire it. */
  lastFired?: string;
  createdAt: string;
}

/** Acknowledged fires per day: `{ '2026-08-31': { <reminderId>: 5 } }`. */
export type ReminderTally = Record<string, Record<string, number>>;

// ── 90-day pact ──────────────────────────────────────────

/** The shared challenge both players run. Stored once, outside either account. */
export interface Pact {
  title: string;
  /** `YYYY-MM-DD` of day 1. */
  startDate: string;
  totalDays: number;
}

/** A frozen record of how one player's day went, written at rollover. */
export interface PactDay {
  date: string;
  /** Every daily quest cleared. */
  cleared: boolean;
  completed: number;
  total: number;
  xp: number;
}

export type PactHistory = Record<string, PactDay>;

// ── Logs ─────────────────────────────────────────────────

export interface GymLog {
  id: string;
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
  timestamp: string;
}

export interface FuelLog {
  id: string;
  food: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  timestamp: string;
}

export type ActivityKind =
  | 'quest'
  | 'xp'
  | 'level'
  | 'rank'
  | 'gym'
  | 'fuel'
  | 'streak'
  | 'profile'
  | 'alert'
  | 'system';

export interface ActivityLog {
  id: string;
  kind: ActivityKind;
  message: string;
  /** XP gained or lost by the event, when it moved XP at all. */
  xpDelta?: number;
  timestamp: string;
}
