import React, { useState } from 'react';
import { UserProfile, Task } from '../types';
import {
  getTasks,
  addTask,
  updateTask,
  deleteTask,
  applyXp,
  logActivity,
  commitEvents,
} from '../store';
import { Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TasksProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
}

const XP_REWARD = { daily: 100, weekly: 500 } as const;

export function Tasks({ profile, setProfile }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>(getTasks);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<'daily' | 'weekly'>('daily');

  const refreshTasks = () => setTasks(getTasks());

  /**
   * Resolves the XP change and its log entries here rather than inside the `setProfile`
   * updater — StrictMode double-invokes updaters, which would duplicate every entry.
   */
  const awardXp = (delta: number, reason: string) => {
    const { profile: next, events } = applyXp(profile, delta, reason);
    commitEvents(events);
    setProfile(next);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;

    addTask({
      title,
      type: newTaskType,
      xpReward: XP_REWARD[newTaskType],
      completed: false,
      createdAt: new Date().toISOString(),
    });
    setNewTaskTitle('');
    refreshTasks();
  };

  const toggleTask = (task: Task) => {
    const nowCompleted = !task.completed;
    updateTask(task.id, { completed: nowCompleted });

    logActivity(
      'quest',
      nowCompleted
        ? `Quest cleared: "${task.title}".`
        : `Quest re-opened: "${task.title}".`,
    );

    awardXp(
      nowCompleted ? task.xpReward : -task.xpReward,
      nowCompleted ? `Reward claimed for "${task.title}".` : `Reward revoked for "${task.title}".`,
    );
    refreshTasks();
  };

  const handleDelete = (task: Task) => {
    deleteTask(task.id);
    // A completed quest already paid out, so abandoning it has to take the XP back.
    if (task.completed) {
      awardXp(-task.xpReward, `Reward reclaimed from "${task.title}".`);
    }
    refreshTasks();
  };

  const renderTask = (task: Task, variant: 'daily' | 'weekly') => (
    <motion.div
      key={task.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={
        variant === 'daily'
          ? `bg-surface border-l-2 p-5 transition-all ${task.completed ? 'border-outline opacity-60' : 'border-secondary shadow-[0_0_10px_rgba(0,241,253,0.1)]'}`
          : `bg-surface border-r-2 p-5 transition-all ${task.completed ? 'border-outline opacity-60' : 'border-primary shadow-[0_0_10px_rgba(237,177,255,0.1)]'}`
      }
    >
      <div className="flex justify-between items-start mb-4">
        <button
          type="button"
          onClick={() => toggleTask(task)}
          aria-pressed={task.completed}
          className="text-left flex-1 cursor-pointer"
        >
          <h3
            className={`font-headline text-lg ${task.completed ? 'text-outline line-through' : 'text-on-surface'}`}
          >
            {task.title}
          </h3>
          <p className="text-[10px] text-outline mt-1 uppercase tracking-widest">
            REWARD: +{task.xpReward} XP
          </p>
        </button>
        <button
          onClick={() => handleDelete(task)}
          aria-label={`Delete quest ${task.title}`}
          className="text-outline hover:text-error transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1 h-1 bg-background">
          <div
            className={`h-full transition-all duration-500 ${
              task.completed
                ? 'bg-outline w-full'
                : variant === 'daily'
                  ? 'bg-secondary w-0'
                  : 'bg-primary w-0 animate-pulse'
            }`}
          />
        </div>
        <span className="text-[10px] font-bold text-outline uppercase">
          {task.completed ? 'COMPLETED' : 'PENDING'}
        </span>
      </div>
    </motion.div>
  );

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
        </div>
      </header>

      {/* Add Task Form */}
      <form
        onSubmit={handleAddTask}
        className="bg-surface p-6 border border-white/5 flex flex-col md:flex-row gap-4"
      >
        <input
          type="text"
          value={newTaskTitle}
          onChange={e => setNewTaskTitle(e.target.value)}
          placeholder="ENTER NEW QUEST TITLE..."
          aria-label="New quest title"
          className="flex-1 bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest focus:border-primary outline-none transition-all"
        />
        <select
          value={newTaskType}
          onChange={e => setNewTaskType(e.target.value as 'daily' | 'weekly')}
          aria-label="Quest type"
          className="bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest focus:border-primary outline-none"
        >
          <option value="daily">DAILY</option>
          <option value="weekly">WEEKLY</option>
        </select>
        <button
          type="submit"
          disabled={!newTaskTitle.trim()}
          className="bg-primary text-background px-8 py-3 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          ADD QUEST
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
