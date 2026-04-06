export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface UserProfile {
  displayName: string;
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
