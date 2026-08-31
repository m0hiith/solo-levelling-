import { ReminderIcon } from '../types';

/**
 * The System's offline voice.
 *
 * Every alert renders from this bank FIRST and never waits on the network — a water
 * reminder that arrives four seconds late because a model was thinking is a broken
 * reminder. The Gemini layer writes sharper lines in the background and caches them
 * for the next fire; this is the floor, not the fallback of last resort.
 */
const BANK: Record<ReminderIcon, string[]> = {
  water: [
    'Hydration low. Drink 250ml. This is not a request.',
    'Water. Now. Your recovery stat is bleeding out.',
    'The body is 60% water and yours is running a deficit.',
    'Refill. A dehydrated hunter fails easy gates.',
  ],
  gym: [
    'The gate is open. Enter it.',
    'Iron does not move itself. Report to the dungeon.',
    'Today’s raid is waiting. Skipping it is a choice you will feel in 30 days.',
    'Strength is a decision made at this exact hour.',
  ],
  food: [
    'Fuel intake due. Log it or the System will assume zero.',
    'Protein. The level-up is written from what you eat.',
    'Eat. Starving is not discipline, it is sabotage.',
  ],
  sleep: [
    'Shut it down. Recovery is when the level-up is written.',
    'Sleep protocol engaged. Tomorrow is built tonight.',
    'Screen off. The System closes for maintenance.',
  ],
  quest: [
    'Unfinished quests detected. The day resets soon.',
    'Your quest log is not clear. Clear it.',
    'Pending objectives remain. Failure is logged permanently.',
  ],
  heart: [
    'Check in with your partner. Neither of you falls alone.',
    'Compare progress. A pact is only as strong as the weaker day.',
    'Two hunters, one pact. Report in.',
  ],
  brain: [
    'Open the HUD. Review the day before it reviews you.',
    'System check. Know your objectives before you move.',
    'Plan the day, or the day plans you.',
  ],
  bell: [
    'Scheduled objective is due.',
    'The System has an instruction for you.',
    'Alert. Act on it.',
  ],
};

/**
 * Rotates through the bank by slot so two alerts an hour apart do not read identically.
 * Deterministic, so the same slot always shows the same line even across a reload.
 */
export function phraseFor(icon: ReminderIcon, slotSeed: string): string {
  const lines = BANK[icon] ?? BANK.bell;
  let hash = 0;
  for (let i = 0; i < slotSeed.length; i++) hash = (hash * 31 + slotSeed.charCodeAt(i)) | 0;
  return lines[Math.abs(hash) % lines.length];
}

/** Rank-flavoured line for the streak counter on the dashboard. */
export function streakTaunt(streak: number, totalDays: number): string {
  if (streak === 0) return 'NO STREAK. START ONE TODAY.';
  if (streak < 3) return 'THE SYSTEM IS WATCHING. DO NOT STOP NOW.';
  if (streak < 7) return 'A PATTERN IS FORMING. HOLD IT.';
  if (streak < 21) return 'HABIT DETECTED. THIS IS WHERE MOST HUNTERS QUIT.';
  if (streak < 60) return 'YOU ARE NO LONGER THE SAME PLAYER.';
  if (streak < totalDays) return 'THE END OF THE PACT IS IN SIGHT. FINISH IT.';
  return 'PACT COMPLETE. THE SYSTEM ACKNOWLEDGES YOU.';
}
