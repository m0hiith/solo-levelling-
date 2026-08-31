/**
 * Calendar helpers shared by the streak counter, the 90-day pact grid and the
 * reminder scheduler. Everything here works in LOCAL time on purpose: a day ends at
 * the player's midnight, not UTC's.
 */

/** Midnight-local day index, so day comparisons follow calendar days, not 24h windows. */
export function dayKey(date: Date = new Date()): number {
  return Math.floor(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000,
  );
}

/** Local calendar date as `YYYY-MM-DD`. Used as the stable key for a pact day. */
export function ymd(date: Date = new Date()): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Parses `YYYY-MM-DD` at local midnight. `new Date(str)` would parse it as UTC. */
export function parseYmd(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export function addDays(value: string, days: number): string {
  const date = parseYmd(value);
  date.setDate(date.getDate() + days);
  return ymd(date);
}

/** Whole calendar days from `from` to `to`. Rounded, so a DST shift can't offset it. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseYmd(to).getTime() - parseYmd(from).getTime()) / 86_400_000);
}

/** ISO-8601 week key (`2026-W09`), so weekly raids reset on Monday rather than 7d later. */
export function isoWeekKey(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Shift to the Thursday of this week — ISO weeks are numbered by the Thursday they contain.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${d.getFullYear()}-W${`${week}`.padStart(2, '0')}`;
}

/** `"07:30"` → 450 minutes past local midnight. Returns null when unparseable. */
export function parseHHMM(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatHHMM(totalMinutes: number): string {
  const wrapped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = `${Math.floor(wrapped / 60)}`.padStart(2, '0');
  const m = `${wrapped % 60}`.padStart(2, '0');
  return `${h}:${m}`;
}

/** 12-hour label for display — `"18:30"` → `"6:30 PM"`. */
export function formatClock(totalMinutes: number): string {
  const wrapped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(wrapped / 60);
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${`${wrapped % 60}`.padStart(2, '0')} ${suffix}`;
}

export function minutesSinceMidnight(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Local midnight of `date`, plus `minutes`. The anchor every reminder fire time is built from. */
export function atMinutes(date: Date, minutes: number): Date {
  const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  out.setMinutes(out.getMinutes() + minutes);
  return out;
}

export const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
