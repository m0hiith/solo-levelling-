import React, { useState } from 'react';
import { Reminder, ReminderIcon } from '../types';
import {
  addReminder,
  deleteReminder,
  getTasks,
  tallyFor,
  updateReminder,
  updateTask,
} from '../store';
import { ALL_DAYS, DEFAULT_REMINDERS, dailyTarget, describeSchedule } from '../lib/alerts';
import { formatHHMM, parseHHMM, WEEKDAY_LABELS } from '../lib/time';
import { REMINDER_ICON_KEYS, REMINDER_ICONS } from '../lib/icons';
import { AlertEngine } from '../hooks/useAlertEngine';
import { AnimatePresence, m } from 'motion/react';
import { BellOff, BellRing, Pencil, Plus, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface AlertsProps {
  engine: AlertEngine;
}

/** Repeat presets. Anything finer than 30 minutes is nagging, not reminding. */
const REPEAT_OPTIONS = [
  { value: 0, label: 'ONCE' },
  { value: 30, label: 'EVERY 30M' },
  { value: 60, label: 'EVERY 1H' },
  { value: 90, label: 'EVERY 90M' },
  { value: 120, label: 'EVERY 2H' },
  { value: 180, label: 'EVERY 3H' },
  { value: 240, label: 'EVERY 4H' },
  { value: 360, label: 'EVERY 6H' },
];

interface Draft {
  id?: string;
  label: string;
  body: string;
  icon: ReminderIcon;
  start: string;
  end: string;
  everyMinutes: number;
  days: number[];
  trackCount: boolean;
  taskId: string;
}

function emptyDraft(): Draft {
  return {
    label: '',
    body: '',
    icon: 'bell',
    start: '09:00',
    end: '21:00',
    everyMinutes: 0,
    days: [...ALL_DAYS],
    trackCount: false,
    taskId: '',
  };
}

function toDraft(reminder: Reminder): Draft {
  return {
    id: reminder.id,
    label: reminder.label,
    body: reminder.body,
    icon: reminder.icon,
    start: formatHHMM(reminder.startMinutes),
    end: formatHHMM(reminder.endMinutes),
    everyMinutes: reminder.everyMinutes,
    days: [...reminder.days],
    trackCount: reminder.trackCount,
    taskId: reminder.taskId ?? '',
  };
}

export function Alerts({ engine }: AlertsProps) {
  const { reminders, refresh, permission, enableNotifications, test } = engine;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Read straight through: the storage layer memoises it, and this must not go
  // stale when a quest is added on another tab.
  const tasks = getTasks();

  const armedCount = reminders.filter(r => r.enabled).length;

  const toggle = (reminder: Reminder) => {
    updateReminder(reminder.id, { enabled: !reminder.enabled });
    refresh();
  };

  const remove = (reminder: Reminder) => {
    deleteReminder(reminder.id);
    refresh();
  };

  const restoreDefaults = () => {
    // Re-arm only the presets that are actually gone, so custom edits survive.
    const existing = new Set(reminders.map(r => r.label));
    for (const preset of DEFAULT_REMINDERS) {
      if (!existing.has(preset.label)) addReminder(preset);
    }
    refresh();
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;

    const label = draft.label.trim();
    const startMinutes = parseHHMM(draft.start);
    const endMinutes = parseHHMM(draft.end);

    if (!label) return setError('Give the alert a name.');
    if (startMinutes === null) return setError('Start time is not a valid time.');
    if (draft.everyMinutes > 0 && endMinutes === null) return setError('End time is not valid.');
    if (draft.everyMinutes > 0 && (endMinutes ?? 0) <= startMinutes) {
      return setError('The window has to end after it starts.');
    }
    if (draft.days.length === 0) return setError('Pick at least one day.');

    const payload = {
      label,
      body: draft.body.trim(),
      icon: draft.icon,
      enabled: true,
      startMinutes,
      endMinutes: draft.everyMinutes > 0 ? (endMinutes ?? startMinutes) : startMinutes,
      everyMinutes: draft.everyMinutes,
      days: [...draft.days].sort(),
      trackCount: draft.trackCount,
      ...(draft.taskId ? { taskId: draft.taskId } : { taskId: undefined }),
    };

    const reminderId = draft.id ?? addReminder(payload).id;
    if (draft.id) updateReminder(draft.id, payload);

    // Keep the quest → alert link in step, so deleting the quest disarms its alert
    // and re-pointing an alert does not leave the old quest holding a dead id.
    for (const task of getTasks()) {
      if (task.id === draft.taskId && task.reminderId !== reminderId) {
        updateTask(task.id, { reminderId });
      } else if (task.reminderId === reminderId && task.id !== draft.taskId) {
        updateTask(task.id, { reminderId: undefined });
      }
    }

    setDraft(null);
    setError(null);
    refresh();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row justify-between md:items-end gap-6">
        <div>
          <span className="text-secondary uppercase tracking-[0.3em] text-[10px] block mb-2">
            System Alerts
          </span>
          <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tight uppercase">
            Alert <span className="text-primary">Protocol</span>
          </h1>
          <p className="text-outline text-[10px] uppercase tracking-widest mt-2">
            {armedCount} of {reminders.length} armed
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={restoreDefaults}
            className="flex items-center gap-2 border border-white/10 text-outline px-4 py-3 font-headline font-bold text-[10px] uppercase tracking-widest hover:text-secondary hover:border-secondary/40 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Presets
          </button>
          <button
            onClick={() => {
              setDraft(emptyDraft());
              setError(null);
            }}
            className="flex items-center gap-2 bg-primary text-background px-6 py-3 font-headline font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Alert
          </button>
        </div>
      </header>

      {/* Permission gate — nothing else on this page matters until this is granted. */}
      {permission !== 'granted' && (
        <div
          className={cn(
            'p-6 border-l-2 flex flex-col sm:flex-row sm:items-center gap-4',
            permission === 'denied' ? 'bg-surface border-error' : 'bg-surface border-secondary',
          )}
        >
          <BellOff
            className={cn('w-5 h-5 shrink-0', permission === 'denied' ? 'text-error' : 'text-secondary')}
          />
          <div className="flex-1">
            <p className="font-headline font-bold text-[10px] uppercase tracking-widest mb-1">
              {permission === 'denied'
                ? 'Notifications blocked'
                : permission === 'unsupported'
                  ? 'Notifications unsupported'
                  : 'Notifications not armed'}
            </p>
            <p className="text-sm text-outline leading-snug">
              {permission === 'denied'
                ? 'This browser is blocking alerts. Re-allow notifications for this site in your browser settings — in-app alerts still work in the meantime.'
                : permission === 'unsupported'
                  ? 'This browser has no notification API. Alerts will appear in-app while the HUD is open.'
                  : 'Turn on notifications so the System can reach you when the HUD is not in front of you.'}
            </p>
          </div>
          {permission === 'default' && (
            <button
              onClick={() => void enableNotifications()}
              className="flex items-center justify-center gap-2 bg-secondary text-background px-6 py-3 font-headline font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all shrink-0"
            >
              <BellRing className="w-4 h-4" />
              Arm Alerts
            </button>
          )}
        </div>
      )}

      {/* Editor */}
      <AnimatePresence>
        {draft && (
          <m.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={save}
            className="bg-surface border border-primary/20 p-6 space-y-6 overflow-hidden"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-primary">
                {draft.id ? 'Edit Alert' : 'New Alert'}
              </h2>
              <button
                type="button"
                onClick={() => setDraft(null)}
                aria-label="Cancel"
                className="text-outline hover:text-on-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <Field label="Alert name">
              <input
                type="text"
                value={draft.label}
                maxLength={40}
                placeholder="DRINK WATER"
                onChange={e => setDraft({ ...draft, label: e.target.value })}
                className={INPUT}
              />
            </Field>

            <Field label="Message — leave blank to let the System write it">
              <textarea
                value={draft.body}
                maxLength={160}
                rows={2}
                placeholder="The System will pick a line for you."
                onChange={e => setDraft({ ...draft, body: e.target.value })}
                className={cn(INPUT, 'resize-none font-sans tracking-normal')}
              />
            </Field>

            <Field label="Type">
              <div className="flex flex-wrap gap-2">
                {REMINDER_ICON_KEYS.map(key => {
                  const Icon = REMINDER_ICONS[key].icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDraft({ ...draft, icon: key })}
                      aria-pressed={draft.icon === key}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 border font-headline text-[9px] uppercase tracking-widest transition-all',
                        draft.icon === key
                          ? 'border-secondary text-secondary bg-secondary/10'
                          : 'border-white/10 text-outline hover:text-on-surface',
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {REMINDER_ICONS[key].label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label={draft.everyMinutes > 0 ? 'Window opens' : 'Fires at'}>
                <input
                  type="time"
                  value={draft.start}
                  onChange={e => setDraft({ ...draft, start: e.target.value })}
                  className={INPUT}
                />
              </Field>
              <Field label="Repeat">
                <select
                  value={draft.everyMinutes}
                  onChange={e => setDraft({ ...draft, everyMinutes: Number(e.target.value) })}
                  className={INPUT}
                >
                  {REPEAT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Window closes">
                <input
                  type="time"
                  value={draft.end}
                  disabled={draft.everyMinutes === 0}
                  onChange={e => setDraft({ ...draft, end: e.target.value })}
                  className={cn(INPUT, 'disabled:opacity-30')}
                />
              </Field>
            </div>

            <Field label="Days">
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((label, index) => {
                  const on = draft.days.includes(index);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          days: on
                            ? draft.days.filter(d => d !== index)
                            : [...draft.days, index].sort(),
                        })
                      }
                      className={cn(
                        'w-12 py-2 border font-headline text-[9px] uppercase tracking-widest transition-all',
                        on
                          ? 'border-primary text-primary bg-primary/10'
                          : 'border-white/10 text-outline hover:text-on-surface',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Chase a quest — the alert goes quiet once it is cleared">
              <select
                value={draft.taskId}
                onChange={e => setDraft({ ...draft, taskId: e.target.value })}
                className={INPUT}
              >
                <option value="">NOT LINKED</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>
                    {task.title.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draft.trackCount}
                onChange={e => setDraft({ ...draft, trackCount: e.target.checked })}
                className="w-4 h-4 accent-secondary"
              />
              <span className="text-outline font-label text-[10px] tracking-widest uppercase">
                Count it — show a daily tally and a LOG IT button
              </span>
            </label>

            {error && (
              <p className="text-error text-[10px] uppercase tracking-widest border-l-2 border-error pl-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-secondary text-background py-4 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all"
            >
              {draft.id ? 'Update Alert' : 'Arm Alert'}
            </button>
          </m.form>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="space-y-3">
        {reminders.map(reminder => {
          const meta = REMINDER_ICONS[reminder.icon];
          const Icon = meta.icon;
          const target = dailyTarget(reminder);
          const count = tallyFor(reminder.id);

          return (
            <div
              key={reminder.id}
              className={cn(
                'bg-surface border-l-2 p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all',
                reminder.enabled ? 'border-secondary' : 'border-outline/40 opacity-50',
              )}
            >
              <Icon className={cn('w-5 h-5 shrink-0', meta.color)} />

              <div className="flex-1 min-w-0">
                <h3 className="font-headline text-base uppercase tracking-tight truncate">
                  {reminder.label}
                </h3>
                <p className="text-outline text-[10px] uppercase tracking-widest mt-0.5">
                  {describeSchedule(reminder)}
                </p>
                {reminder.body && (
                  <p className="text-outline/80 text-xs mt-1.5 line-clamp-2">{reminder.body}</p>
                )}
              </div>

              {reminder.trackCount && (
                <div className="text-right shrink-0">
                  <div className="font-headline font-black text-xl text-secondary leading-none">
                    {count}
                    <span className="text-outline text-xs"> / {target}</span>
                  </div>
                  <div className="text-outline text-[9px] uppercase tracking-widest mt-1">today</div>
                </div>
              )}

              <div className="flex items-center gap-1 shrink-0">
                <IconButton label="Send a test alert" onClick={() => void test(reminder)}>
                  <Send className="w-4 h-4" />
                </IconButton>
                <IconButton
                  label={`Edit ${reminder.label}`}
                  onClick={() => {
                    setDraft(toDraft(reminder));
                    setError(null);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </IconButton>
                <IconButton
                  label={reminder.enabled ? 'Disarm' : 'Arm'}
                  onClick={() => toggle(reminder)}
                >
                  {reminder.enabled ? (
                    <BellRing className="w-4 h-4 text-secondary" />
                  ) : (
                    <BellOff className="w-4 h-4" />
                  )}
                </IconButton>
                <IconButton label={`Delete ${reminder.label}`} danger onClick={() => remove(reminder)}>
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </div>
            </div>
          );
        })}

        {reminders.length === 0 && (
          <p className="text-outline text-[10px] uppercase tracking-widest py-12 text-center border border-dashed border-white/10">
            No alerts armed. Load the presets or write your own.
          </p>
        )}
      </div>
    </div>
  );
}

const INPUT =
  'w-full bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-primary transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-outline font-label text-[10px] tracking-widest uppercase block">
        {label}
      </span>
      {children}
    </label>
  );
}

function IconButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'p-2 text-outline transition-colors',
        danger ? 'hover:text-error' : 'hover:text-primary',
      )}
    >
      {children}
    </button>
  );
}
