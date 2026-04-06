import React, { useState } from 'react';
import { UserProfile, FuelLog } from '../types';
import { getFuelLogs, addFuelLog } from '../store';
import { detectCalories } from '../services/gemini';
import { Camera, Plus, Loader2, History } from 'lucide-react';
import { motion } from 'motion/react';

interface FuelProps {
  profile: UserProfile | null;
}

export function Fuel({ profile }: FuelProps) {
  const [logs, setLogs] = useState<FuelLog[]>(() => getFuelLogs().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [food, setFood] = useState('');
  const [calories, setCalories] = useState('');

  const refreshLogs = () => setLogs(getFuelLogs().slice(0, 10));

  const addLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !food || !calories) return;

    addFuelLog({
      food,
      calories: parseInt(calories),
      timestamp: new Date().toISOString(),
    });

    setFood('');
    setCalories('');
    refreshLogs();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const result = await detectCalories(base64);
        if (result.food) {
          addFuelLog({
            food: result.food,
            calories: result.calories,
            protein: result.protein,
            carbs: result.carbs,
            fat: result.fat,
            timestamp: new Date().toISOString(),
          });
          refreshLogs();
        }
      } catch (error) {
        console.error("AI detection failed:", error);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const totalCalories = logs.reduce((acc, log) => acc + log.calories, 0);

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calorie Counter */}
        <div className="lg:col-span-7 bg-surface/40 backdrop-blur-md border-l-4 border-primary p-8 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-headline text-xs tracking-[0.3em] text-primary uppercase mb-2">Energy Balance Consumed</h3>
            <div className="flex items-baseline gap-4">
              <span className="text-7xl md:text-8xl font-headline font-bold text-on-surface glow-primary tracking-tighter">{totalCalories}</span>
              <span className="text-2xl font-headline text-outline tracking-widest uppercase">kcal</span>
            </div>
            <div className="mt-8 flex gap-2 w-full h-1 bg-background">
              <div className="h-full bg-secondary shadow-[0_0_12px_rgba(0,241,253,0.5)]" style={{ width: `${Math.min((totalCalories / 2500) * 100, 100)}%` }} />
            </div>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-4 bg-primary text-background px-8 py-4 font-headline text-sm tracking-widest uppercase hover:brightness-110 transition-all cursor-pointer">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              UPLOAD FOOD SCAN
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={loading} />
            </label>
          </div>
        </div>

        {/* Manual Entry */}
        <div className="lg:col-span-5">
          <form onSubmit={addLog} className="bg-surface p-6 border border-white/5 space-y-4">
            <h3 className="text-xs font-headline tracking-widest text-outline uppercase mb-4">Manual Fuel Entry</h3>
            <input
              type="text"
              value={food}
              onChange={(e) => setFood(e.target.value)}
              placeholder="FOOD NAME..."
              className="w-full bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-primary"
            />
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="CALORIES (KCAL)"
              className="w-full bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-primary"
            />
            <button type="submit" className="w-full bg-surface-container-highest text-on-surface py-3 font-headline font-bold uppercase tracking-widest hover:bg-primary hover:text-background transition-all flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              LOG FUEL
            </button>
          </form>
        </div>
      </div>

      {/* Fuel History */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-headline tracking-widest text-outline uppercase">Fuel Intake History</h3>
          <History className="w-4 h-4 text-outline" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface p-4 border-l-2 border-primary/30 flex justify-between items-center"
            >
              <div>
                <p className="font-headline font-bold text-on-surface uppercase">{log.food}</p>
                <p className="text-[10px] text-outline uppercase tracking-widest">{new Date(log.timestamp).toLocaleTimeString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-headline font-bold text-primary">{log.calories} KCAL</p>
                {log.protein && <p className="text-[8px] text-outline uppercase">P: {log.protein}g | C: {log.carbs}g | F: {log.fat}g</p>}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
