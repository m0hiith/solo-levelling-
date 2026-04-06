export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  level: number;
  xp: number;
  rank: Rank;
  streak: number;
  lastActive: string;
  shadows: string[];
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  type: 'daily' | 'weekly';
  xpReward: number;
  completed: boolean;
  createdAt: string;
}

export interface GymLog {
  id: string;
  userId: string;
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
  timestamp: string;
}

export interface FuelLog {
  id: string;
  userId: string;
  food: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  timestamp: string;
}
