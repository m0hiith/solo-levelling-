import React, { useState } from 'react';
import { FuelLog } from '../types';
import { getFuelLogs, addFuelLog, filterToday } from '../store';
import { detectCalories } from '../services/gemini';
import { Camera, Plus, Loader2, History } from 'lucide-react';
import { motion } from 'motion/react';

const RECENT_LIMIT = 12;
const DAILY_CALORIE_GOAL = 2500;

export function Fuel() {
  const [logs, setLogs] = useState<FuelLog[]>(getFuelLogs);
  const [loading, setLoading] = useState(false);
  const [food, setFood] = useState('');
  const [calories, setCalories] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addLog = (e: React.FormEvent) => {
    e.preventDefault();

    const name = food.trim();
    const kcal = Number.parseInt(calories, 10);
    if (!name) {
      setError('Enter a food name.');
      return;
    }
    if (!Number.isFinite(kcal) || kcal < 0) {
      setError('Calories must be a number of zero or more.');
      return;
    }

    addFuelLog({ food: name, calories: kcal, timestamp: new Date().toISOString() });
    setFood('');
    setCalories('');
    setError(null);
    setLogs(getFuelLogs());
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same photo twice still fires a change event.
    e.target.value = '';
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const result = await detectCalories(file);
      if (!result?.food) {
        setError('The scan returned no recognisable food. Log it manually.');
        return;
      }
      addFuelLog({
        food: result.food,
        calories: result.calories ?? 0,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        timestamp: new Date().toISOString(),
      });
      setLogs(getFuelLogs());
    } catch (err) {
      console.error('[fuel] AI detection failed', err);
      setError(err instanceof Error ? err.message : 'Food scan failed. Try again or log manually.');
    } finally {
      setLoading(false);
    }
  };

  // The headline number is today's intake — a running lifetime total would be meaningless here.
  const todayCalories = filterToday(logs).reduce((acc, log) => acc + log.calories, 0);
  const recent = logs.slice(0, RECENT_LIMIT);

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calorie Counter */}
        <div className="lg:col-span-7 bg-surface/40 backdrop-blur-md border-l-4 border-primary p-8 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-headline text-xs tracking-[0.3em] text-primary uppercase mb-2">
              Energy Consumed Today
            </h3>
            <div className="flex items-baseline gap-4">
              <span className="text-7xl md:text-8xl font-headline font-bold text-on-surface glow-primary tracking-tighter">
                {todayCalories}
              </span>
              <span className="text-2xl font-headline text-outline tracking-widest uppercase">
                kcal
              </span>
            </div>
            <div className="mt-8 flex gap-2 w-full h-1 bg-background">
              <div
                className="h-full bg-secondary shadow-[0_0_12px_rgba(0,241,253,0.5)] transition-all duration-700"
                style={{ width: `${Math.min((todayCalories / DAILY_CALORIE_GOAL) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-outline uppercase tracking-widest mt-2">
              Target: {DAILY_CALORIE_GOAL.toLocaleString()} kcal
            </p>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-4 bg-primary text-background px-8 py-4 font-headline text-sm tracking-widest uppercase hover:brightness-110 transition-all cursor-pointer">
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
              {loading ? 'SCANNING...' : 'UPLOAD FOOD SCAN'}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>
        </div>

        {/* Manual Entry */}
        <div className="lg:col-span-5">
          <form onSubmit={addLog} className="bg-surface p-6 border border-white/5 space-y-4">
            <h3 className="text-xs font-headline tracking-widest text-outline uppercase mb-4">
              Manual Fuel Entry
            </h3>
            <input
              type="text"
              value={food}
              onChange={e => setFood(e.target.value)}
              placeholder="FOOD NAME..."
              aria-label="Food name"
              className="w-full bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-primary"
            />
            <input
              type="number"
              min="0"
              value={calories}
              onChange={e => setCalories(e.target.value)}
              placeholder="CALORIES (KCAL)"
              aria-label="Calories"
              className="w-full bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="w-full bg-surface-variant text-on-surface py-3 font-headline font-bold uppercase tracking-widest hover:bg-primary hover:text-background transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              LOG FUEL
            </button>
          </form>
        </div>
      </div>

      {error && (
        <p className="text-error text-[10px] uppercase tracking-widest border-l-2 border-error pl-4 py-2">
          {error}
        </p>
      )}

      {/* Fuel History */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-headline tracking-widest text-outline uppercase">
            Fuel Intake History
          </h3>
          <History className="w-4 h-4 text-outline" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recent.map(log => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface p-4 border-l-2 border-primary/30 flex justify-between items-center gap-4"
            >
              <div className="min-w-0">
                <p className="font-headline font-bold text-on-surface uppercase truncate">
                  {log.food}
                </p>
                <p className="text-[10px] text-outline uppercase tracking-widest">
                  {new Date(log.timestamp).toLocaleDateString()} ·{' '}
                  {new Date(log.timestamp).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-headline font-bold text-primary">{log.calories} KCAL</p>
                {/* Compare against undefined: a genuine 0g macro must still render. */}
                {log.protein !== undefined && (
                  <p className="text-[8px] text-outline uppercase">
                    P: {log.protein}g | C: {log.carbs ?? 0}g | F: {log.fat ?? 0}g
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        {recent.length === 0 && (
          <div className="text-center py-12 border border-dashed border-white/10">
            <p className="text-outline text-xs uppercase tracking-[0.2em]">
              No fuel intake recorded.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
