/**
 * Browser plumbing for alerts: permission, the service worker, and actually showing a
 * notification.
 *
 * WHY A SERVICE WORKER: on Android Chrome `new Notification(...)` throws outright —
 * `registration.showNotification` is the only path that works. The worker also lets an
 * alert land while the tab is backgrounded, which is the whole point of a reminder.
 * A push subscription would additionally cover "browser fully closed", but that needs
 * a server with VAPID keys; this app has none, so alerts fire whenever the browser is
 * running with the HUD open in a tab.
 */

export type NotifyPermission = 'unsupported' | 'default' | 'granted' | 'denied';

let registration: ServiceWorkerRegistration | null = null;
let audioContext: AudioContext | null = null;

export function notifyPermission(): NotifyPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifyPermission;
}

export function notificationsUsable(): boolean {
  return notifyPermission() === 'granted';
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (notifyPermission() === 'unsupported') return 'unsupported';
  try {
    // Must be called from a user gesture on Safari, which is why this is button-driven.
    const result = await Notification.requestPermission();
    if (result === 'granted') void registerWorker();
    return result as NotifyPermission;
  } catch (error) {
    console.error('[alerts] permission request failed', error);
    return notifyPermission();
  }
}

/** Registers `/sw.js`. Safe to call repeatedly — the browser dedupes by scope. */
export async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (registration) return registration;
  try {
    registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch (error) {
    // Plain-HTTP LAN access has no service worker; alerts fall back to in-app toasts.
    console.warn('[alerts] service worker unavailable', error);
    return null;
  }
}

export interface NotifyOptions {
  title: string;
  body: string;
  /** Collapses repeats of the same alert instead of stacking them. */
  tag: string;
  /** Deep-links the click back into the HUD tab that matters. */
  url?: string;
  silent?: boolean;
}

/** Fires a system notification. Returns false when the OS-level path was unavailable. */
export async function showAlert(options: NotifyOptions): Promise<boolean> {
  if (!notificationsUsable()) return false;

  const payload: NotificationOptions & { renotify?: boolean } = {
    body: options.body,
    tag: options.tag,
    renotify: true,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    silent: options.silent ?? false,
    data: { url: options.url ?? '/' },
  };

  try {
    const worker = registration ?? (await registerWorker());
    if (worker) {
      await worker.showNotification(options.title, payload);
      return true;
    }
    new Notification(options.title, payload);
    return true;
  } catch (error) {
    console.error('[alerts] could not show notification', error);
    return false;
  }
}

/** Short haptic buzz on phones. No-op everywhere else. */
export function buzz(pattern: number[] = [40, 60, 40]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* vibration unsupported */
  }
}

/**
 * A two-tone System chime, synthesised rather than loaded, so alerts make a sound
 * without shipping an audio file or waiting on a network fetch.
 */
export function chime(): void {
  try {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioContext ??= new Ctor();
    if (audioContext.state === 'suspended') void audioContext.resume();

    const now = audioContext.currentTime;
    for (const [index, frequency] of [880, 1320].entries()) {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      const start = now + index * 0.11;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    }
  } catch {
    /* audio blocked until the first gesture — silence is an acceptable outcome */
  }
}
