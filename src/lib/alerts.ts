import { Reminder, ReminderIcon } from '../types';
import { formatClock, formatHHMM, minutesSinceMidnight, WEEKDAY_LABELS, ymd } from './time';

/**
 * Pure scheduling maths for the alert engine. Nothing here touches the DOM or
 * localStorage, so the rules can be reasoned about (and tested) on their own.
 */

/** How late a missed slot may still fire. Opening the app at noon must not dump the morning's alerts. */
export const GRACE_MINUTES = 50;

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Every minute-of-day this reminder wants to fire at, ignoring weekday filtering. */
export function slotMinutes(reminder: Reminder): number[] {
  const start = clampMinutes(reminder.startMinutes);
  if (reminder.everyMinutes <= 0) return [start];

  const end = Math.max(start, clampMinutes(reminder.endMinutes));
  const slots: number[] = [];
  // Hard cap keeps a 1-minute interval from generating a runaway list.
  for (let m = start; m <= end && slots.length < 96; m += reminder.everyMinutes) {
    slots.push(m);
  }
  return slots;
}

function clampMinutes(value: number): number {
  return Math.min(1439, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}

/** Slots per armed day — the denominator of a "5 / 8" tally. */
export function dailyTarget(reminder: Reminder): number {
  return slotMinutes(reminder).length;
}

/**
 * `2026-08-31#0480` — the identity of one firing. Minutes are zero-padded so slot ids
 * compare correctly as plain strings, which is what makes `lastFired` a usable
 * high-water mark (`#0060` must sort BELOW `#0480`, not above it).
 */
function slotId(date: string, minutes: number): string {
  return `${date}#${`${minutes}`.padStart(4, '0')}`;
}

export interface DueAlert {
  reminder: Reminder;
  /** Slot id to record as delivered. A high-water mark: it covers any skipped slots. */
  slot: string;
  minutes: number;
  /** False when the slot is too stale to show — record it, stay quiet. */
  fire: boolean;
}

/**
 * Finds which reminders are owed a notification right now.
 *
 * For each armed reminder it collects today's past-due, undelivered slots and returns
 * only the LATEST one. Because `lastFired` is a high-water mark, recording that single
 * slot also consumes the earlier ones — which is what stops the app from firing four
 * water alerts the moment a sleeping laptop wakes up.
 */
export function findDueAlerts(
  reminders: Reminder[],
  now = new Date(),
  grace = GRACE_MINUTES,
): DueAlert[] {
  const today = ymd(now);
  const nowMinutes = minutesSinceMidnight(now);
  const weekday = now.getDay();
  const due: DueAlert[] = [];

  for (const reminder of reminders) {
    if (!reminder.enabled || !reminder.days.includes(weekday)) continue;

    const pending = slotMinutes(reminder)
      .filter(minutes => minutes <= nowMinutes)
      .map(minutes => ({ minutes, id: slotId(today, minutes) }))
      .filter(({ id }) => !reminder.lastFired || id > reminder.lastFired);

    const latest = pending[pending.length - 1];
    if (!latest) continue;

    due.push({
      reminder,
      slot: latest.id,
      minutes: latest.minutes,
      fire: nowMinutes - latest.minutes <= grace,
    });
  }

  return due;
}

/** The next moment any reminder fires, so the engine can sleep until then. */
export function nextFireAt(reminders: Reminder[], now = new Date()): Date | null {
  let best: Date | null = null;

  for (let dayOffset = 0; dayOffset < 8 && !best; dayOffset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
    const weekday = day.getDay();
    const floor = dayOffset === 0 ? minutesSinceMidnight(now) : -1;

    for (const reminder of reminders) {
      if (!reminder.enabled || !reminder.days.includes(weekday)) continue;
      for (const minutes of slotMinutes(reminder)) {
        if (minutes <= floor) continue;
        const at = new Date(day);
        at.setMinutes(at.getMinutes() + minutes);
        if (!best || at < best) best = at;
      }
    }
  }

  return best;
}

/** Human-readable schedule for the alert cards — "EVERY 2H · 08:00–22:00 · DAILY". */
export function describeSchedule(reminder: Reminder): string {
  const parts: string[] = [];

  if (reminder.everyMinutes > 0) {
    const hours = reminder.everyMinutes / 60;
    const every = hours >= 1 && Number.isInteger(hours) ? `${hours}H` : `${reminder.everyMinutes}M`;
    parts.push(`EVERY ${every}`);
    parts.push(`${formatHHMM(reminder.startMinutes)}–${formatHHMM(reminder.endMinutes)}`);
  } else {
    parts.push(formatClock(reminder.startMinutes));
  }

  if (reminder.days.length === 7) parts.push('DAILY');
  else if (reminder.days.length === 0) parts.push('NEVER');
  else parts.push(reminder.days.map(d => WEEKDAY_LABELS[d]).join(' '));

  return parts.join(' · ');
}

// ── Seeded alerts ────────────────────────────────────────

type Seed = Omit<Reminder, 'id' | 'createdAt'>;

function seed(
  label: string,
  body: string,
  icon: ReminderIcon,
  start: string,
  options: { every?: number; end?: string; days?: number[]; count?: boolean } = {},
): Seed {
  const startMinutes = hhmm(start);
  return {
    label,
    body,
    icon,
    enabled: true,
    startMinutes,
    endMinutes: options.end ? hhmm(options.end) : startMinutes,
    everyMinutes: options.every ?? 0,
    days: options.days ?? ALL_DAYS,
    trackCount: options.count ?? false,
  };
}

function hhmm(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * What both players start with. Written in the System's voice so the notification
 * itself is part of the game rather than a generic phone buzz.
 */
export const DEFAULT_REMINDERS: Seed[] = [
  seed(
    'HYDRATION PROTOCOL',
    'Drink 250ml. Dehydration is a stat penalty you are choosing to accept.',
    'water',
    '08:00',
    { every: 120, end: '22:00', count: true },
  ),
  seed('MORNING SYSTEM CHECK', 'Open the HUD. Review the day’s quests before it reviews you.', 'brain', '07:30'),
  seed('FUEL — PROTEIN', 'Log your protein. The body you want is built from what you eat.', 'food', '13:00', {
    every: 420,
    end: '20:00',
    count: true,
  }),
  seed('TIME TO HIT THE GYM', 'The gate is open. Enter it, or explain to the System why you did not.', 'gym', '18:00', {
    days: [1, 2, 3, 4, 5, 6],
  }),
  seed('QUEST SWEEP', 'Unfinished daily quests detected. Clear them before the day resets.', 'quest', '21:30'),
  seed('PACT CHECK-IN', 'Compare progress with your partner. Neither of you falls alone.', 'heart', '22:00'),
  seed('SLEEP PROTOCOL', 'Shut it down. Recovery is when the level-up is actually written.', 'sleep', '23:00'),
];
