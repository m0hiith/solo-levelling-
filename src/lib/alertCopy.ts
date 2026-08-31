import { read, userKey, write } from './storage';
import { ymd } from './time';

/**
 * Storage for the AI-written alert lines. Split out from the Gemini service so the
 * alert engine can READ today's copy without loading the model SDK — the write side
 * is the only part that needs it.
 */

export interface AlertLineCache {
  date: string;
  lines: Record<string, string[]>;
}

const ALERT_LINES_KEY = 'alertLines';

/** Today's AI-written lines for one alert, or an empty list before they arrive. */
export function cachedAlertLines(reminderId: string): string[] {
  const cache = read<AlertLineCache | null>(userKey(ALERT_LINES_KEY), null);
  return cache?.date === ymd() ? (cache.lines[reminderId] ?? []) : [];
}

export function hasAlertLinesForToday(): boolean {
  return read<AlertLineCache | null>(userKey(ALERT_LINES_KEY), null)?.date === ymd();
}

export function writeAlertLines(lines: Record<string, string[]>): void {
  write<AlertLineCache>(userKey(ALERT_LINES_KEY), { date: ymd(), lines });
}
