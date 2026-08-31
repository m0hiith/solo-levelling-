import { Bell, Brain, CheckSquare, Droplets, Dumbbell, Heart, Moon, Utensils } from 'lucide-react';
import { ReminderIcon } from '../types';

/** Icon and accent for each alert flavour, shared by the toast, the list and the editor. */
export const REMINDER_ICONS: Record<ReminderIcon, { icon: typeof Bell; label: string; color: string }> = {
  water: { icon: Droplets, label: 'WATER', color: 'text-secondary' },
  gym: { icon: Dumbbell, label: 'TRAINING', color: 'text-primary' },
  food: { icon: Utensils, label: 'FUEL', color: 'text-primary' },
  sleep: { icon: Moon, label: 'RECOVERY', color: 'text-secondary' },
  quest: { icon: CheckSquare, label: 'QUEST', color: 'text-secondary' },
  heart: { icon: Heart, label: 'PACT', color: 'text-primary' },
  brain: { icon: Brain, label: 'FOCUS', color: 'text-secondary' },
  bell: { icon: Bell, label: 'ALERT', color: 'text-outline' },
};

export const REMINDER_ICON_KEYS = Object.keys(REMINDER_ICONS) as ReminderIcon[];
