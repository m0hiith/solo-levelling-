/**
 * The localStorage layer everything else sits on.
 *
 * Two jobs beyond raw get/set:
 *
 *  1. NAMESPACING. Every player's data lives under `sl:u:<userId>:<name>`, so the two
 *     hunters sharing a device never see or overwrite each other's quests.
 *  2. CACHING. `getTasks()` used to `JSON.parse` the whole list on every call, and the
 *     components call it on every render. Values are memoised here and invalidated on
 *     write, which turns those repeat reads into a map lookup.
 */

const cache = new Map<string, unknown>();

let activeUserId: string | null = null;

/** Called by the auth layer on sign-in/out. Swapping players drops the cache. */
export function setActiveUser(userId: string | null): void {
  if (activeUserId === userId) return;
  activeUserId = userId;
  cache.clear();
}

export function getActiveUserId(): string | null {
  return activeUserId;
}

/** Namespaced key for the signed-in player. */
export function userKey(name: string): string {
  return `sl:u:${activeUserId ?? 'anon'}:${name}`;
}

/** Namespaced key for a specific player — how the pact view reads a partner's data. */
export function keyFor(userId: string, name: string): string {
  return `sl:u:${userId}:${name}`;
}

export function read<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? (JSON.parse(raw) as T | null) : null;
    const resolved = value == null ? fallback : value;
    cache.set(key, resolved);
    return resolved;
  } catch {
    cache.set(key, fallback);
    return fallback;
  }
}

export function write<T>(key: string, value: T): boolean {
  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    // Quota exceeded (large avatar), private-mode Safari, or storage disabled.
    console.error(`[storage] failed to persist "${key}"`, error);
    return false;
  }
}

export function remove(key: string): void {
  cache.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage disabled — nothing to clean up */
  }
}

/** Drops a cached entry so the next read hits localStorage. Used after cross-tab edits. */
export function invalidate(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

/**
 * Another tab writing to localStorage leaves this tab's cache holding a stale value,
 * which on a shared device shows up as one window silently undoing the other's edits.
 * The `storage` event only fires in OTHER tabs, so this is exactly the invalidation
 * signal we need.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key) cache.delete(event.key);
    else cache.clear();
  });
}

/** Every `sl:`-prefixed key, for export and for migrating the pre-accounts layout. */
export function allKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sl:') || key.startsWith('sl_'))) keys.push(key);
    }
  } catch {
    /* storage disabled */
  }
  return keys;
}
