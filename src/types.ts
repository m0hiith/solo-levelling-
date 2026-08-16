export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface UserProfile {
  displayName: string;
  /** Data URL of the player's picture, or null to use the generated fallback. */
  avatar: string | null;
  level: number;
  xp: number;
  rank: Rank;
  streak: number;
  lastActive: string;
  shadows: string[];
}

export interface Task {
  id: string;
  title: string;
  type: 'daily' | 'weekly';
  xpReward: number;
  completed: boolean;
  createdAt: string;
}

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
  | 'system';

export interface ActivityLog {
  id: string;
  kind: ActivityKind;
  message: string;
  /** XP gained or lost by the event, when it moved XP at all. */
  xpDelta?: number;
  timestamp: string;
}
