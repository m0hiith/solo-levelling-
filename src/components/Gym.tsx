import React, { useState } from 'react';
import { GymLog } from '../types';
import { getGymLogs, addGymLog } from '../store';
import { TrendingUp, Plus, History } from 'lucide-react';
import { motion } from 'motion/react';

const RECENT_LIMIT = 10;
/** Lifetime volume target the "progressive overload" bar fills toward. */
const VOLUME_GOAL_KG = 20_000;

export function Gym() {
  const [logs, setLogs] = useState<GymLog[]>(getGymLogs);
  const [exercise, setExercise] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addLog = (e: React.FormEvent) => {
    e.preventDefault();

    const name = exercise.trim();
    const setsNum = Number.parseInt(sets, 10);
    const repsNum = Number.parseInt(reps, 10);
    const weightNum = Number.parseFloat(weight);

    if (!name) {
      setError('Enter an exercise name.');
      return;
    }
    // Guard the numbers explicitly: a blank or non-numeric field parses to NaN, which
    // would otherwise be stored and poison every volume total that reads it back.
    if (!Number.isFinite(setsNum) || setsNum <= 0 || !Number.isFinite(repsNum) || repsNum <= 0) {
      setError('Sets and reps must be positive numbers.');
      return;
    }
    if (!Number.isFinite(weightNum) || weightNum < 0) {
      setError('Weight must be zero or greater.');
      return;
    }

    addGymLog({
      exercise: name,
      sets: setsNum,
      reps: repsNum,
      weight: weightNum,
      timestamp: new Date().toISOString(),
    });

    setExercise('');
    setSets('');
    setReps('');
    setWeight('');
    setError(null);
    setLogs(getGymLogs());
  };

  // Every session counts toward lifetime volume, not just the ten shown below.
  const totalVolume = logs.reduce((acc, log) => acc + log.sets * log.reps * log.weight, 0);
  const recent = logs.slice(0, RECENT_LIMIT);

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h2 className="text-sm font-headline tracking-[0.3em] text-secondary mb-2 uppercase">
            Current Objective
          </h2>
          <h1 className="text-4xl md:text-5xl font-headline font-bold text-on-surface uppercase tracking-tighter italic">
            Strength Consolidation
          </h1>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Log Form */}
        <div className="lg:col-span-4 space-y-6">
          <form onSubmit={addLog} className="bg-surface p-6 border border-white/5 space-y-4">
            <h3 className="text-xs font-headline tracking-widest text-secondary uppercase mb-4">
              Record Session
            </h3>
            <input
              type="text"
              value={exercise}
              onChange={e => setExercise(e.target.value)}
              placeholder="EXERCISE NAME..."
              aria-label="Exercise name"
              className="w-full bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-secondary"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min="1"
                value={sets}
                onChange={e => setSets(e.target.value)}
                placeholder="SETS"
                aria-label="Sets"
                className="bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-secondary"
              />
              <input
                type="number"
                min="1"
                value={reps}
                onChange={e => setReps(e.target.value)}
                placeholder="REPS"
                aria-label="Reps"
                className="bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-secondary"
              />
              <input
                type="number"
                min="0"
                step="0.5"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="KG"
                aria-label="Weight in kilograms"
                className="bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-secondary"
              />
            </div>
            {error && (
              <p className="text-error text-[10px] uppercase tracking-widest border-l-2 border-error pl-3">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full bg-secondary text-background py-3 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
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
                <span className="text-[10px] text-outline uppercase tracking-widest">
                  Lifetime Volume
                </span>
                <span className="text-xl font-headline font-bold text-on-surface">
                  {Math.round(totalVolume).toLocaleString()} KG
                </span>
              </div>
              <div className="h-1 w-full bg-background relative">
                <div
                  className="absolute h-full bg-secondary shadow-[0_0_10px_#00f1fd] transition-all duration-700"
                  style={{ width: `${Math.min((totalVolume / VOLUME_GOAL_KG) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-outline uppercase tracking-widest text-right">
                Goal: {VOLUME_GOAL_KG.toLocaleString()} KG
              </p>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-headline tracking-widest text-secondary uppercase">
              Active Session Log
            </h3>
            <History className="w-4 h-4 text-outline" />
          </div>
          <div className="space-y-4">
            {recent.map(log => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-surface p-6 flex flex-col md:flex-row justify-between md:items-center gap-4 border-l-4 border-white/5 hover:border-secondary transition-all"
              >
                <div>
                  <h4 className="text-xl font-headline font-bold tracking-tight text-on-surface uppercase mb-1">
                    {log.exercise}
                  </h4>
                  <p className="text-[10px] font-label text-outline uppercase tracking-widest">
                    {new Date(log.timestamp).toLocaleDateString()} @{' '}
                    {new Date(log.timestamp).toLocaleTimeString()}
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
                    <p className="text-lg font-headline font-bold text-secondary">
                      {log.weight} KG
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
            {recent.length === 0 && (
              <div className="text-center py-12 border border-dashed border-white/10">
                <p className="text-outline text-xs uppercase tracking-[0.2em]">
                  No training data recorded in the system.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
