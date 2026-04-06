import React, { useState } from 'react';
import { UserProfile, GymLog } from '../types';
import { getGymLogs, addGymLog } from '../store';
import { Dumbbell, TrendingUp, Plus, History } from 'lucide-react';
import { motion } from 'motion/react';

interface GymProps {
  profile: UserProfile | null;
}

export function Gym({ profile }: GymProps) {
  const [logs, setLogs] = useState<GymLog[]>(() => getGymLogs().slice(0, 10));
  const [exercise, setExercise] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');

  const addLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !exercise || !sets || !reps || !weight) return;

    addGymLog({
      exercise,
      sets: parseInt(sets),
      reps: parseInt(reps),
      weight: parseFloat(weight),
      timestamp: new Date().toISOString(),
    });

    setExercise('');
    setSets('');
    setReps('');
    setWeight('');
    setLogs(getGymLogs().slice(0, 10));
  };

  const totalVolume = logs.reduce((acc, log) => acc + log.sets * log.reps * log.weight, 0);

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h2 className="text-sm font-headline tracking-[0.3em] text-secondary mb-2 uppercase">Current Objective</h2>
          <h1 className="text-4xl md:text-5xl font-headline font-bold text-on-surface uppercase tracking-tighter italic">Strength Consolidation</h1>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Log Form */}
        <div className="lg:col-span-4 space-y-6">
          <form onSubmit={addLog} className="bg-surface p-6 border border-white/5 space-y-4">
            <h3 className="text-xs font-headline tracking-widest text-secondary uppercase mb-4">Record Session</h3>
            <input
              type="text"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              placeholder="EXERCISE NAME..."
              className="w-full bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-secondary"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                placeholder="SETS"
                className="bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-secondary"
              />
              <input
                type="number"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="REPS"
                className="bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-secondary"
              />
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="KG"
                className="bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-secondary"
              />
            </div>
            <button type="submit" className="w-full bg-secondary text-background py-3 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              LOG DATA
            </button>
          </form>

          <div className="bg-surface p-6 border-t-2 border-primary">
            <h3 className="text-xs font-headline tracking-[0.2em] text-primary mb-6 uppercase flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Progressive Overload
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-outline uppercase tracking-widest">Total Volume</span>
                <span className="text-xl font-headline font-bold text-on-surface">{totalVolume.toLocaleString()} KG</span>
              </div>
              <div className="h-1 w-full bg-background relative">
                <div className="absolute h-full bg-secondary shadow-[0_0_10px_#00f1fd]" style={{ width: `${Math.min((totalVolume / 20000) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-headline tracking-widest text-secondary uppercase">Active Session Log</h3>
            <History className="w-4 h-4 text-outline" />
          </div>
          <div className="space-y-4">
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-surface p-6 flex flex-col md:flex-row justify-between md:items-center gap-4 border-l-4 border-white/5 hover:border-secondary transition-all"
              >
                <div>
                  <h4 className="text-xl font-headline font-bold tracking-tight text-on-surface uppercase mb-1">{log.exercise}</h4>
                  <p className="text-[10px] font-label text-outline uppercase tracking-widest">
                    {new Date(log.timestamp).toLocaleDateString()} @ {new Date(log.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="text-center bg-background px-4 py-2">
                    <p className="text-[10px] text-outline uppercase font-label">SETS</p>
                    <p className="text-lg font-headline font-bold text-on-surface">{log.sets}</p>
                  </div>
                  <div className="text-center bg-background px-4 py-2">
                    <p className="text-[10px] text-outline uppercase font-label">REPS</p>
                    <p className="text-lg font-headline font-bold text-on-surface">{log.reps}</p>
                  </div>
                  <div className="text-center bg-secondary/10 px-4 py-2 border-b-2 border-secondary">
                    <p className="text-[10px] text-secondary uppercase font-label">WEIGHT</p>
                    <p className="text-lg font-headline font-bold text-secondary">{log.weight} KG</p>
                  </div>
                </div>
              </motion.div>
            ))}
            {logs.length === 0 && (
              <div className="text-center py-12 border border-dashed border-white/10">
                <p className="text-outline text-xs uppercase tracking-[0.2em]">No training data recorded in the system.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
