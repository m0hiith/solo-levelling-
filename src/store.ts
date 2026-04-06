import { UserProfile, Task, GymLog, FuelLog } from './types';

const KEYS = {
  profile: 'sl_profile',
  tasks: 'sl_tasks',
  gymLogs: 'sl_gym_logs',
  fuelLogs: 'sl_fuel_logs',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Profile ──────────────────────────────────────────────

const DEFAULT_PROFILE: UserProfile = {
  displayName: 'Player',
  level: 1,
  xp: 0,
  rank: 'E',
  streak: 0,
  lastActive: new Date().toISOString(),
  shadows: [],
};

export function getProfile(): UserProfile {
  return read<UserProfile>(KEYS.profile, DEFAULT_PROFILE);
}

export function saveProfile(profile: UserProfile): void {
  write(KEYS.profile, profile);
}

// ── Tasks ────────────────────────────────────────────────

export function getTasks(): Task[] {
  return read<Task[]>(KEYS.tasks, []);
}

function saveTasks(tasks: Task[]): void {
  write(KEYS.tasks, tasks);
}

export function addTask(task: Omit<Task, 'id'>): Task {
  const tasks = getTasks();
  const newTask: Task = { ...task, id: crypto.randomUUID() };
  tasks.push(newTask);
  saveTasks(tasks);
  return newTask;
}

export function updateTask(id: string, updates: Partial<Task>): void {
  const tasks = getTasks().map(t => (t.id === id ? { ...t, ...updates } : t));
  saveTasks(tasks);
}

export function deleteTask(id: string): void {
  saveTasks(getTasks().filter(t => t.id !== id));
}

// ── Gym Logs ─────────────────────────────────────────────

export function getGymLogs(): GymLog[] {
  return read<GymLog[]>(KEYS.gymLogs, []);
}

function saveGymLogs(logs: GymLog[]): void {
  write(KEYS.gymLogs, logs);
}

export function addGymLog(log: Omit<GymLog, 'id'>): GymLog {
  const logs = getGymLogs();
  const newLog: GymLog = { ...log, id: crypto.randomUUID() };
  logs.unshift(newLog);            // newest first
  saveGymLogs(logs);
  return newLog;
}

// ── Fuel Logs ────────────────────────────────────────────

export function getFuelLogs(): FuelLog[] {
  return read<FuelLog[]>(KEYS.fuelLogs, []);
}

function saveFuelLogs(logs: FuelLog[]): void {
  write(KEYS.fuelLogs, logs);
}

export function addFuelLog(log: Omit<FuelLog, 'id'>): FuelLog {
  const logs = getFuelLogs();
  const newLog: FuelLog = { ...log, id: crypto.randomUUID() };
  logs.unshift(newLog);            // newest first
  saveFuelLogs(logs);
  return newLog;
}
