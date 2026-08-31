import React, { useMemo, useState } from 'react';
import { Reminder, Task, UserProfile } from '../types';
import {
  addReminder,
  addTask,
  applyXp,
  commitEvents,
  deleteReminder,
  deleteTask,
  getReminders,
  getTasks,
  logActivity,
  syncStreak,
  updateReminder,
  updateTask,
} from '../store';
import { ALL_DAYS, describeSchedule } from '../lib/alerts';
import { formatHHMM, parseHHMM } from '../lib/time';
import { Bell, BellRing, Plus, Trash2, X } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { cn } from '../lib/utils';

interface TasksProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  /** Lets the alert engine pick up reminders created from a quest card. */
  onRemindersChanged: () => void;
}

const XP_REWARD = { daily: 100, weekly: 500 } as const;
const REPEAT_OPTIONS = [
  { value: 0, label: 'ONCE' },
  { value: 60, label: 'EVERY 1H' },
  { value: 120, label: 'EVERY 2H' },
  { value: 180, label: 'EVERY 3H' },
];

export function Tasks({ profile, setProfile, onRemindersChanged }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>(getTasks);
  const [reminders, setReminders] = useState<Reminder[]>(getReminders);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<'daily' | 'weekly'>('daily');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [editingAlertFor, setEditingAlertFor] = useState<string | null>(null);

  const reminderByTask = useMemo(() => {
    const map = new Map<string, Reminder>();
    for (const reminder of reminders) {
      if (reminder.taskId) map.set(reminder.taskId, reminder);
    }
    return map;
  }, [reminders]);

  const refreshTasks = () => setTasks(getTasks());
  const refreshReminders = () => {
    setReminders(getReminders());
    onRemindersChanged();
  };

  /**
   * Resolves the XP change and its log entries here rather than inside the `setProfile`
   * updater — StrictMode double-invokes updaters, which would duplicate every entry.
   */
  const awardXp = (delta: number, reason: string, nextTasks: Task[]) => {
    const { profile: next, events } = applyXp(profile, delta, reason);
    commitEvents(events);
    // Recording the day and re-deriving the streak has to happen after the XP lands,
    // so the pact grid stores the XP total the day actually ended on.
    setProfile(syncStreak(next, nextTasks));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;

    const task = addTask({
      title,
      type: newTaskType,
      xpReward: XP_REWARD[newTaskType],
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
    });

    // Optional reminder set straight from the add form.
    const minutes = newTaskTime ? parseHHMM(newTaskTime) : null;
    if (minutes !== null) {
      const reminder = addReminder({
        label: title.toUpperCase(),
        body: '',
        icon: 'quest',
        enabled: true,
        startMinutes: minutes,
        endMinutes: minutes,
        everyMinutes: 0,
        days: [...ALL_DAYS],
        trackCount: false,
        taskId: task.id,
      });
      updateTask(task.id, { reminderId: reminder.id });
      refreshReminders();
    }

    setNewTaskTitle('');
    setNewTaskTime('');
    refreshTasks();
  };

  const toggleTask = (task: Task) => {
    const nowCompleted = !task.completed;
    updateTask(task.id, {
      completed: nowCompleted,
      completedAt: nowCompleted ? new Date().toISOString() : null,
    });

    logActivity(
      'quest',
      nowCompleted ? `Quest cleared: "${task.title}".` : `Quest re-opened: "${task.title}".`,
    );

    const nextTasks = getTasks();
    awardXp(
      nowCompleted ? task.xpReward : -task.xpReward,
      nowCompleted ? `Reward claimed for "${task.title}".` : `Reward revoked for "${task.title}".`,
      nextTasks,
    );
    setTasks(nextTasks);
  };

  const handleDelete = (task: Task) => {
    deleteTask(task.id);
    const nextTasks = getTasks();
    // A completed quest already paid out, so abandoning it has to take the XP back.
    if (task.completed) {
      awardXp(-task.xpReward, `Reward reclaimed from "${task.title}".`, nextTasks);
    } else {
      setProfile(syncStreak(profile, nextTasks));
    }
    setTasks(nextTasks);
    refreshReminders();
  };

  const saveAlert = (task: Task, time: string, everyMinutes: number) => {
    const minutes = parseHHMM(time);
    if (minutes === null) return;

    const existing = reminderByTask.get(task.id);
    // A repeating quest alert runs from its time until the end of the evening.
    const endMinutes = everyMinutes > 0 ? Math.max(minutes, 22 * 60) : minutes;

    if (existing) {
      updateReminder(existing.id, {
        startMinutes: minutes,
        endMinutes,
        everyMinutes,
        enabled: true,
      });
    } else {
      const reminder = addReminder({
        label: task.title.toUpperCase(),
        body: '',
        icon: 'quest',
        enabled: true,
        startMinutes: minutes,
        endMinutes,
        everyMinutes,
        days: [...ALL_DAYS],
        trackCount: false,
        taskId: task.id,
      });
      updateTask(task.id, { reminderId: reminder.id });
    }

    setEditingAlertFor(null);
    refreshTasks();
    refreshReminders();
  };

  const removeAlert = (task: Task) => {
    const existing = reminderByTask.get(task.id);
    if (existing) deleteReminder(existing.id);
    setEditingAlertFor(null);
    refreshTasks();
    refreshReminders();
  };

  const renderTask = (task: Task, variant: 'daily' | 'weekly') => {
    const reminder = reminderByTask.get(task.id);
    const armed = Boolean(reminder?.enabled);

    return (
      <m.div
        key={task.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          'bg-surface p-5 transition-all',
          variant === 'daily' ? 'border-l-2' : 'border-r-2',
          task.completed
            ? 'border-outline opacity-60'
            : variant === 'daily'
              ? 'border-secondary shadow-[0_0_10px_rgba(0,241,253,0.1)]'
              : 'border-primary shadow-[0_0_10px_rgba(237,177,255,0.1)]',
        )}
      >
        <div className="flex justify-between items-start mb-4">
          <button
            type="button"
            onClick={() => toggleTask(task)}
            aria-pressed={task.completed}
            className="text-left flex-1 cursor-pointer"
          >
            <h3
              className={cn(
                'font-headline text-lg',
                task.completed ? 'text-outline line-through' : 'text-on-surface',
              )}
            >
              {task.title}
            </h3>
            <p className="text-[10px] text-outline mt-1 uppercase tracking-widest">
              REWARD: +{task.xpReward} XP
              {reminder && ` · ${describeSchedule(reminder)}`}
            </p>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditingAlertFor(editingAlertFor === task.id ? null : task.id)}
              aria-label={armed ? `Edit alert for ${task.title}` : `Add alert for ${task.title}`}
              title={armed ? 'Edit alert' : 'Add alert'}
              className={cn(
                'p-1.5 transition-colors',
                armed ? 'text-secondary' : 'text-outline hover:text-secondary',
              )}
            >
              {armed ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </button>
            <button
              onClick={() => handleDelete(task)}
              aria-label={`Delete quest ${task.title}`}
              className="p-1.5 text-outline hover:text-error transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {editingAlertFor === task.id && (
            <AlertRow
              key="alert-row"
              reminder={reminder}
              onSave={(time, every) => saveAlert(task, time, every)}
              onRemove={reminder ? () => removeAlert(task) : undefined}
              onCancel={() => setEditingAlertFor(null)}
            />
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-1 bg-background">
            <div
              className={cn(
                'h-full transition-all duration-500',
                task.completed
                  ? 'bg-outline w-full'
                  : variant === 'daily'
                    ? 'bg-secondary w-0'
                    : 'bg-primary w-0 animate-pulse',
              )}
            />
          </div>
          <span className="text-[10px] font-bold text-outline uppercase">
            {task.completed ? 'COMPLETED' : 'PENDING'}
          </span>
        </div>
      </m.div>
    );
  };

  const dailyTasks = tasks.filter(t => t.type === 'daily');
  const weeklyTasks = tasks.filter(t => t.type === 'weekly');

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <span className="text-secondary uppercase tracking-[0.3em] text-[10px] block mb-2">
            Current Objective
          </span>
          <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tight text-on-surface uppercase">
            Quest <span className="text-primary">Management</span>
          </h1>
          <p className="text-outline text-[10px] uppercase tracking-widest mt-2">
            Daily quests reset at midnight · weekly raids reset Monday
          </p>
        </div>
      </header>

      {/* Add Task Form */}
      <form
        onSubmit={handleAddTask}
        className="bg-surface p-6 border border-white/5 grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-4"
      >
        <input
          type="text"
          value={newTaskTitle}
          onChange={e => setNewTaskTitle(e.target.value)}
          placeholder="ENTER NEW QUEST TITLE..."
          aria-label="New quest title"
          className={INPUT}
        />
        <select
          value={newTaskType}
          onChange={e => setNewTaskType(e.target.value as 'daily' | 'weekly')}
          aria-label="Quest type"
          className={INPUT}
        >
          <option value="daily">DAILY</option>
          <option value="weekly">WEEKLY</option>
        </select>
        <input
          type="time"
          value={newTaskTime}
          onChange={e => setNewTaskTime(e.target.value)}
          aria-label="Optional reminder time for this quest"
          title="Optional — remind me at this time"
          className={cn(INPUT, 'md:w-36')}
        />
        <button
          type="submit"
          disabled={!newTaskTitle.trim()}
          className="bg-primary text-background px-8 py-3 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          ADD
        </button>
      </form>

      {/* Tasks List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-6">
          <div className="flex items-center justify-between border-l-4 border-secondary pl-4">
            <h2 className="font-headline text-xl tracking-widest uppercase italic">Daily Quests</h2>
            <span className="text-[10px] text-outline uppercase tracking-widest">
              {dailyTasks.filter(t => t.completed).length}/{dailyTasks.length}
            </span>
          </div>
          <div className="space-y-4">
            <AnimatePresence>{dailyTasks.map(t => renderTask(t, 'daily'))}</AnimatePresence>
            {dailyTasks.length === 0 && (
              <p className="text-outline text-[10px] uppercase tracking-widest py-6 text-center border border-dashed border-white/10">
                No daily quests assigned.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between border-l-4 border-primary pl-4">
            <h2 className="font-headline text-xl tracking-widest uppercase italic">Weekly Raids</h2>
            <span className="text-[10px] text-outline uppercase tracking-widest">
              {weeklyTasks.filter(t => t.completed).length}/{weeklyTasks.length}
            </span>
          </div>
          <div className="space-y-4">
            <AnimatePresence>{weeklyTasks.map(t => renderTask(t, 'weekly'))}</AnimatePresence>
            {weeklyTasks.length === 0 && (
              <p className="text-outline text-[10px] uppercase tracking-widest py-6 text-center border border-dashed border-white/10">
                No weekly raids assigned.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const INPUT =
  'bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-primary transition-colors';

/** Inline alert editor attached to a single quest — time, repeat, and nothing else. */
function AlertRow({
  reminder,
  onSave,
  onRemove,
  onCancel,
}: {
  reminder?: Reminder;
  onSave: (time: string, everyMinutes: number) => void;
  onRemove?: () => void;
  onCancel: () => void;
}) {
  const [time, setTime] = useState(reminder ? formatHHMM(reminder.startMinutes) : '18:00');
  const [every, setEvery] = useState(reminder?.everyMinutes ?? 0);

  return (
    <m.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden mb-4"
    >
      <div className="bg-background border border-secondary/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-secondary font-headline text-[10px] tracking-widest uppercase">
            Quest Alert
          </span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close alert editor"
            className="text-outline hover:text-on-surface transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            aria-label="Alert time"
            className={cn(INPUT, 'flex-1 min-w-28')}
          />
          <select
            value={every}
            onChange={e => setEvery(Number(e.target.value))}
            aria-label="Repeat"
            className={cn(INPUT, 'flex-1 min-w-28')}
          >
            {REPEAT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSave(time, every)}
            className="flex-1 bg-secondary text-background py-2.5 font-headline font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all"
          >
            {reminder ? 'Update Alert' : 'Arm Alert'}
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="px-4 border border-white/10 text-outline font-headline font-bold text-[10px] uppercase tracking-widest hover:text-error hover:border-error/40 transition-all"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </m.div>
  );
}
