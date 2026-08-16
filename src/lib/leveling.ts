import { Rank } from '../types';

/** XP required to advance FROM `level` to `level + 1`. Levels get progressively longer. */
export function xpForLevel(level: number): number {
  return level * 1000;
}

/** Highest level first — `rankForLevel` returns the first threshold the level clears. */
const RANK_THRESHOLDS: { min: number; rank: Rank }[] = [
  { min: 50, rank: 'S' },
  { min: 35, rank: 'A' },
  { min: 20, rank: 'B' },
  { min: 10, rank: 'C' },
  { min: 5, rank: 'D' },
  { min: 1, rank: 'E' },
];

export function rankForLevel(level: number): Rank {
  return RANK_THRESHOLDS.find(t => level >= t.min)?.rank ?? 'E';
}

export interface LevelProgress {
  level: number;
  rank: Rank;
  /** XP earned inside the current level, i.e. total XP minus every level already cleared. */
  xpIntoLevel: number;
  /** XP the current level costs to clear. */
  xpForNext: number;
  /** 0–100, for progress bars and rings. */
  percent: number;
}

/**
 * Single source of truth for level and rank: both are derived from total XP so they
 * can never drift out of sync with it.
 */
export function getLevelProgress(totalXp: number): LevelProgress {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;

  let level = 1;
  let remaining = xp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }

  const xpForNext = xpForLevel(level);
  return {
    level,
    rank: rankForLevel(level),
    xpIntoLevel: remaining,
    xpForNext,
    percent: Math.min(100, (remaining / xpForNext) * 100),
  };
}
