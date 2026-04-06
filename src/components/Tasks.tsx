import React, { useState } from 'react';
import { UserProfile, Task } from '../types';
import { getTasks, addTask, updateTask, deleteTask as removeTask, saveProfile } from '../store';
import { Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TasksProps {
  profile: UserProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
}

export function Tasks({ profile, setProfile }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>(getTasks);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<'daily' | 'weekly'>('daily');

  const refreshTasks = () => setTasks(getTasks());

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newTaskTitle.trim()) return;

    const xpReward = newTaskType === 'daily' ? 100 : 500;
    addTask({
      title: newTaskTitle,
      type: newTaskType,
      xpReward,
      completed: false,
      createdAt: new Date().toISOString(),
    });
    setNewTaskTitle('');
    refreshTasks();
  };

  const toggleTask = (task: Task) => {
    if (!profile) return;
    const wasCompleted = task.completed;
    updateTask(task.id, { completed: !wasCompleted });

    const xpDelta = wasCompleted ? -task.xpReward : task.xpReward;
    setProfile(prev => {
      const updated = { ...prev, xp: Math.max(0, prev.xp + xpDelta) };
      saveProfile(updated);
      return updated;
    });
    refreshTasks();
  };

  const handleDelete = (taskId: string) => {
    removeTask(taskId);
    refreshTasks();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <span className="text-secondary uppercase tracking-[0.3em] text-[10px] block mb-2">Current Objective</span>
          <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tight text-on-surface uppercase">Quest <span className="text-primary">Management</span></h1>
        </div>
      </header>

      {/* Add Task Form */}
      <form onSubmit={handleAddTask} className="bg-surface p-6 border border-white/5 flex flex-col md:flex-row gap-4">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="ENTER NEW QUEST TITLE..."
          className="flex-1 bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest focus:border-primary outline-none transition-all"
        />
        <select
          value={newTaskType}
          onChange={(e) => setNewTaskType(e.target.value as 'daily' | 'weekly')}
          className="bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest focus:border-primary outline-none"
        >
          <option value="daily">DAILY</option>
          <option value="weekly">WEEKLY</option>
        </select>
        <button type="submit" className="bg-primary text-background px-8 py-3 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />
          ADD QUEST
        </button>
      </form>

      {/* Tasks List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-6">
          <div className="flex items-center justify-between border-l-4 border-secondary pl-4">
            <h2 className="font-headline text-xl tracking-widest uppercase italic">Daily Quests</h2>
          </div>
          <div className="space-y-4">
            <AnimatePresence>
              {tasks.filter(t => t.type === 'daily').map(task => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-surface border-l-2 p-5 group transition-all ${task.completed ? 'border-outline opacity-60' : 'border-secondary shadow-[0_0_10px_rgba(0,241,253,0.1)]'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div onClick={() => toggleTask(task)} className="cursor-pointer flex-1">
                      <h3 className={`font-headline text-lg ${task.completed ? 'text-outline line-through' : 'text-on-surface'}`}>{task.title}</h3>
                      <p className="text-[10px] text-outline mt-1 uppercase tracking-widest">REWARD: +{task.xpReward} XP</p>
                    </div>
                    <button onClick={() => handleDelete(task.id)} className="text-outline hover:text-error transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-1 bg-background">
                      <div className={`h-full transition-all duration-500 ${task.completed ? 'bg-outline w-full' : 'bg-secondary w-0'}`} />
                    </div>
                    <span className="text-[10px] font-bold text-outline uppercase">{task.completed ? 'COMPLETED' : 'PENDING'}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between border-l-4 border-primary pl-4">
            <h2 className="font-headline text-xl tracking-widest uppercase italic">Weekly Raids</h2>
          </div>
          <div className="space-y-4">
            {tasks.filter(t => t.type === 'weekly').map(task => (
              <div key={task.id} className={`bg-surface border-r-2 p-5 group transition-all ${task.completed ? 'border-outline opacity-60' : 'border-primary shadow-[0_0_10px_rgba(237,177,255,0.1)]'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div onClick={() => toggleTask(task)} className="cursor-pointer flex-1">
                    <h3 className={`font-headline text-lg ${task.completed ? 'text-outline line-through' : 'text-on-surface'}`}>{task.title}</h3>
                    <p className="text-[10px] text-outline mt-1 uppercase tracking-widest">REWARD: +{task.xpReward} XP</p>
                  </div>
                  <button onClick={() => handleDelete(task.id)} className="text-outline hover:text-error transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="h-1.5 bg-background relative overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${task.completed ? 'bg-outline w-full' : 'bg-primary w-0 animate-pulse'}`} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
