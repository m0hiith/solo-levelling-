import { UserProfile } from '../types';
import { SystemContext } from './ai';
import { getProfileFor } from '../store';
import {
  clearedDayCount,
  filterToday,
  getFuelLogs,
  getGymLogs,
  getPact,
  getPactHistory,
  getTasks,
  getTasksFor,
  pactDayNumber,
  questProgress,
} from '../store';
import { partnerOf } from './auth';

/**
 * Assembles the full pact picture the AI and the alert engine both run on. Kept in one
 * place so a broadcast and a notification can never describe two different states.
 */
export function buildSystemContext(profile: UserProfile, userId: string): SystemContext {
  const tasks = getTasks();
  const progress = questProgress(tasks);
  const pact = getPact();
  const history = getPactHistory();

  const context: SystemContext = {
    playerName: profile.displayName,
    level: profile.level,
    rank: profile.rank,
    streak: profile.streak,
    bestStreak: profile.bestStreak,
    pactDay: pactDayNumber(pact),
    pactTotal: pact.totalDays,
    clearedDays: clearedDayCount(history),
    dailyDone: progress.daily.completed,
    dailyTotal: progress.daily.total,
    openQuests: tasks.filter(t => !t.completed).map(t => t.title).slice(0, 10),
    caloriesToday: filterToday(getFuelLogs()).reduce((sum, log) => sum + log.calories, 0),
    volumeToday: filterToday(getGymLogs()).reduce(
      (sum, log) => sum + log.sets * log.reps * log.weight,
      0,
    ),
  };

  const partner = partnerOf(userId);
  if (partner) {
    const partnerTasks = getTasksFor(partner.id);
    const partnerProgress = questProgress(partnerTasks);
    context.partnerName = getProfileFor(partner.id).displayName;
    context.partnerStreak = getProfileFor(partner.id).streak;
    context.partnerClearedDays = clearedDayCount(getPactHistory(partner.id));
    context.partnerDailyDone = partnerProgress.daily.completed;
    context.partnerDailyTotal = partnerProgress.daily.total;
  }

  return context;
}
