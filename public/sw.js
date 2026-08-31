/**
 * Notification host for Solo Leveling.
 *
 * It exists for two reasons: Android Chrome refuses `new Notification()` and demands
 * `registration.showNotification`, and a worker can raise an alert while the tab is
 * backgrounded. Clicking an alert focuses an open HUD tab rather than opening a
 * second one.
 *
 * Deliberately NOT a caching worker — a stale-cache bug on a 90-day tracker is far
 * more expensive than a few hundred milliseconds of load time.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'alert-click', url: target });
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
