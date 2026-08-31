import { useCallback, useEffect, useRef, useState } from 'react';
import { Reminder, ReminderIcon, UserProfile } from '../types';
import {
  bumpTally,
  getReminders,
  getTasks,
  logActivity,
  saveReminders,
  tallyFor,
  updateReminder,
} from '../store';
import { dailyTarget, findDueAlerts, nextFireAt } from '../lib/alerts';
import { phraseFor } from '../lib/phrases';
import {
  buzz,
  chime,
  notifyPermission,
  NotifyPermission,
  registerWorker,
  requestNotifyPermission,
  showAlert,
} from '../lib/notifications';
import { isAiConfigured } from '../lib/ai';
import { cachedAlertLines } from '../lib/alertCopy';
import { buildSystemContext } from '../lib/context';

/** Never sleep longer than this, so a laptop waking from suspend catches up quickly. */
const MAX_SLEEP_MS = 60_000;
/** Toasts stack, but only this many stay on screen. */
const MAX_TOASTS = 3;

export interface AlertToast {
  id: string;
  reminderId: string;
  icon: ReminderIcon;
  title: string;
  body: string;
  trackCount: boolean;
  count: number;
  target: number;
}

export interface AlertEngine {
  reminders: Reminder[];
  refresh: () => void;
  toasts: AlertToast[];
  dismiss: (id: string) => void;
  /** Marks one fire as acted on — the "5 / 8 glasses" counter. */
  acknowledge: (toast: AlertToast) => void;
  permission: NotifyPermission;
  enableNotifications: () => Promise<void>;
  /** Fires an alert immediately, so the player can prove notifications work. */
  test: (reminder: Reminder) => Promise<void>;
}

/**
 * The runtime behind every reminder.
 *
 * It sleeps until the next scheduled slot rather than polling on a fixed interval, so
 * an idle HUD does no work between alerts, and re-checks on tab focus because a
 * suspended machine's timers do not fire while it is asleep.
 */
export function useAlertEngine(profile: UserProfile, userId: string | null): AlertEngine {
  const [reminders, setReminders] = useState<Reminder[]>(() => (userId ? getReminders() : []));
  const [toasts, setToasts] = useState<AlertToast[]>([]);
  const [permission, setPermission] = useState<NotifyPermission>(notifyPermission);

  // The engine reads these inside a timer callback, so they are held in refs rather
  // than closed over — otherwise every profile change would restart the schedule.
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const refresh = useCallback(() => {
    setReminders(userIdRef.current ? getReminders() : []);
  }, []);

  useEffect(() => {
    refresh();
  }, [userId, refresh]);

  useEffect(() => {
    if (permission === 'granted') void registerWorker();
  }, [permission]);

  const buildBody = useCallback((reminder: Reminder, slot: string): string => {
    // AI copy when today's batch has landed, the player's own text next, bank last.
    const aiLines = cachedAlertLines(reminder.id);
    if (aiLines.length) {
      let hash = 0;
      for (let i = 0; i < slot.length; i++) hash = (hash * 31 + slot.charCodeAt(i)) | 0;
      return aiLines[Math.abs(hash) % aiLines.length];
    }
    return reminder.body.trim() || phraseFor(reminder.icon, slot);
  }, []);

  const pushToast = useCallback((toast: AlertToast) => {
    setToasts(prev => [...prev.filter(t => t.reminderId !== toast.reminderId), toast].slice(-MAX_TOASTS));
  }, []);

  /** Runs one scheduling pass: fire what is due, record what was consumed. */
  const tick = useCallback(() => {
    if (!userIdRef.current) return;

    const current = getReminders();
    const tasks = getTasks();
    const due = findDueAlerts(current, new Date());
    if (due.length === 0) return;

    let changed = false;
    const next = [...current];

    for (const alert of due) {
      const index = next.findIndex(r => r.id === alert.reminder.id);
      if (index >= 0) {
        next[index] = { ...next[index], lastFired: alert.slot };
        changed = true;
      }
      if (!alert.fire) continue;

      // An alert chasing a quest goes quiet once that quest is cleared.
      const linked = alert.reminder.taskId
        ? tasks.find(t => t.id === alert.reminder.taskId)
        : undefined;
      if (linked?.completed) continue;

      const body = buildBody(alert.reminder, alert.slot);
      void showAlert({
        title: alert.reminder.label,
        body,
        tag: alert.reminder.id,
      });
      chime();
      buzz();

      pushToast({
        id: alert.slot,
        reminderId: alert.reminder.id,
        icon: alert.reminder.icon,
        title: alert.reminder.label,
        body,
        trackCount: alert.reminder.trackCount,
        count: tallyFor(alert.reminder.id),
        target: dailyTarget(alert.reminder),
      });
      logActivity('alert', `Alert delivered: "${alert.reminder.label}".`);
    }

    if (changed) {
      saveReminders(next);
      setReminders(next);
    }
  }, [buildBody, pushToast]);

  // Sleep exactly until the next slot (capped), rather than polling every few seconds.
  useEffect(() => {
    if (!userId) return;
    let timer: number | undefined;
    let cancelled = false;

    const loop = () => {
      if (cancelled) return;
      tick();
      const next = nextFireAt(getReminders(), new Date());
      const delay = next
        ? Math.min(MAX_SLEEP_MS, Math.max(1_000, next.getTime() - Date.now()))
        : MAX_SLEEP_MS;
      timer = window.setTimeout(loop, delay);
    };

    loop();

    // Timers do not fire while the machine sleeps, so re-check whenever it comes back.
    const onWake = () => {
      if (document.visibilityState === 'visible') loop();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [userId, tick]);

  // Once a day, in the background, have the Architect rewrite today's alert copy.
  // The Gemini SDK is imported HERE rather than at module scope so it stays out of the
  // initial bundle — the alert engine loads on every screen, the model does not.
  useEffect(() => {
    if (!userId || !isAiConfigured()) return;
    const id = window.setTimeout(async () => {
      try {
        const { refreshAlertLines } = await import('../services/gemini');
        await refreshAlertLines(buildSystemContext(profileRef.current, userId), getReminders());
      } catch (error) {
        console.warn('[alerts] copy refresh failed', error);
      }
    }, 4_000); // after first paint — this must never compete with the initial render
    return () => window.clearTimeout(id);
  }, [userId]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const acknowledge = useCallback(
    (toast: AlertToast) => {
      const count = bumpTally(toast.reminderId);
      setToasts(prev => prev.map(t => (t.id === toast.id ? { ...t, count } : t)));
      window.setTimeout(() => dismiss(toast.id), 700);
    },
    [dismiss],
  );

  const enableNotifications = useCallback(async () => {
    const result = await requestNotifyPermission();
    setPermission(result);
    if (result === 'granted') {
      // A gesture already happened, so this is the moment audio is allowed to unlock.
      chime();
      await showAlert({
        title: 'SYSTEM LINK ESTABLISHED',
        body: 'Alerts are armed. The System will now contact you directly.',
        tag: 'system-link',
      });
    }
  }, []);

  const test = useCallback(
    async (reminder: Reminder) => {
      const body = buildBody(reminder, `test-${Date.now()}`);
      chime();
      buzz();
      await showAlert({ title: reminder.label, body, tag: `${reminder.id}-test` });
      pushToast({
        id: `test-${Date.now()}`,
        reminderId: reminder.id,
        icon: reminder.icon,
        title: reminder.label,
        body,
        trackCount: reminder.trackCount,
        count: tallyFor(reminder.id),
        target: dailyTarget(reminder),
      });
    },
    [buildBody, pushToast],
  );

  return {
    reminders,
    refresh,
    toasts,
    dismiss,
    acknowledge,
    permission,
    enableNotifications,
    test,
  };
}

export { updateReminder };
