import { Account, Session } from '../types';
import { derivePasswordHash, randomSalt, timingSafeEqual, uuid } from './crypto';
import { keyFor, read, remove, setActiveUser, write } from './storage';

const ACCOUNTS_KEY = 'sl:accounts';
const SESSION_KEY = 'sl:session';

/** A session outlives the whole pact, so nobody gets logged out mid-challenge. */
const SESSION_DAYS = 120;

/** Legacy single-player keys, moved into the first account the first time this runs. */
const LEGACY_KEYS: Record<string, string> = {
  sl_profile: 'profile',
  sl_tasks: 'tasks',
  sl_gym_logs: 'gymLogs',
  sl_fuel_logs: 'fuelLogs',
  sl_activity: 'activity',
};

/**
 * Seeded on first run so both hunters can sign in immediately. Passwords are hashed
 * on seed — these plaintext values exist only to create the accounts, and either
 * player can change username and password from Settings.
 */
export const SEED_ACCOUNTS = [
  { username: 'mohith', password: 'shadow90', displayName: 'Mohith', accent: '#00f1fd' },
  { username: 'hunter', password: 'arise90', displayName: 'Hunter', accent: '#edb1ff' },
] as const;

export class AuthError extends Error {}

// ── Account records ──────────────────────────────────────

export function listAccounts(): Account[] {
  return read<Account[]>(ACCOUNTS_KEY, []);
}

function saveAccounts(accounts: Account[]): void {
  write(ACCOUNTS_KEY, accounts);
}

export function getAccount(userId: string): Account | undefined {
  return listAccounts().find(a => a.id === userId);
}

function findByUsername(username: string): Account | undefined {
  const needle = username.trim().toLowerCase();
  return listAccounts().find(a => a.username === needle);
}

/** The other player, for the shared pact views. Undefined until both accounts exist. */
export function partnerOf(userId: string): Account | undefined {
  return listAccounts().find(a => a.id !== userId);
}

// ── Bootstrap ────────────────────────────────────────────

/**
 * Creates the two seeded accounts on a fresh install and lifts any pre-accounts save
 * into the first one, so upgrading does not look like the progress was wiped.
 * Idempotent: a second call with accounts already present does nothing.
 */
export async function ensureSeeded(): Promise<Account[]> {
  const existing = listAccounts();
  if (existing.length > 0) return existing;

  const accounts: Account[] = [];
  for (const seed of SEED_ACCOUNTS) {
    const salt = randomSalt();
    accounts.push({
      id: uuid(),
      username: seed.username,
      passwordHash: await derivePasswordHash(seed.password, salt),
      salt,
      accent: seed.accent,
      createdAt: new Date().toISOString(),
    });
  }
  saveAccounts(accounts);

  // Give each account a starting profile carrying its seeded display name.
  for (const [index, account] of accounts.entries()) {
    write(keyFor(account.id, 'profile'), {
      displayName: SEED_ACCOUNTS[index].displayName,
      avatar: null,
      level: 1,
      xp: 0,
      rank: 'E',
      streak: 0,
      bestStreak: 0,
      lastActive: new Date().toISOString(),
      shadows: [],
    });
  }

  migrateLegacyData(accounts[0].id);
  return accounts;
}

/** Moves the pre-accounts `sl_*` records under the first account, then clears them. */
function migrateLegacyData(userId: string): void {
  for (const [legacyKey, name] of Object.entries(LEGACY_KEYS)) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(legacyKey);
    } catch {
      return;
    }
    if (!raw) continue;

    try {
      const value = JSON.parse(raw);
      if (value == null) continue;
      // The migrated profile keeps its old display name rather than the seeded one.
      write(keyFor(userId, name), value);
    } catch {
      /* unreadable legacy record — drop it rather than block the migration */
    }
    remove(legacyKey);
  }
}

// ── Session ──────────────────────────────────────────────

export function getSession(): Session | null {
  const session = read<Session | null>(SESSION_KEY, null);
  if (!session?.userId) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    remove(SESSION_KEY);
    return null;
  }
  // A session pointing at a deleted account is stale.
  return getAccount(session.userId) ? session : null;
}

/** Restores the signed-in player on page load. Returns null when nobody is signed in. */
export function restoreSession(): Account | null {
  const session = getSession();
  if (!session) {
    setActiveUser(null);
    return null;
  }
  setActiveUser(session.userId);
  return getAccount(session.userId) ?? null;
}

function startSession(userId: string, remember: boolean): void {
  const expires = new Date();
  expires.setDate(expires.getDate() + (remember ? SESSION_DAYS : 1));
  write<Session>(SESSION_KEY, { userId, expiresAt: expires.toISOString() });
  setActiveUser(userId);
}

export function signOut(): void {
  remove(SESSION_KEY);
  setActiveUser(null);
}

// ── Credentials ──────────────────────────────────────────

export async function signIn(
  username: string,
  password: string,
  remember = true,
): Promise<Account> {
  const account = findByUsername(username);
  if (!account) {
    // Spend the same time as a real check so a missing user is not detectable.
    await derivePasswordHash(password, randomSalt());
    throw new AuthError('Unknown hunter. Check the username.');
  }

  const hash = await derivePasswordHash(password, account.salt);
  if (!timingSafeEqual(hash, account.passwordHash)) {
    throw new AuthError('Access denied. Wrong password.');
  }

  startSession(account.id, remember);
  return account;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  const account = getAccount(userId);
  if (!account) throw new AuthError('That account no longer exists.');
  if (nextPassword.length < 4) throw new AuthError('Use at least 4 characters.');

  const current = await derivePasswordHash(currentPassword, account.salt);
  if (!timingSafeEqual(current, account.passwordHash)) {
    throw new AuthError('Current password is wrong.');
  }

  // A fresh salt on every change keeps two identical passwords from sharing a hash.
  const salt = randomSalt();
  const passwordHash = await derivePasswordHash(nextPassword, salt);
  saveAccounts(listAccounts().map(a => (a.id === userId ? { ...a, salt, passwordHash } : a)));
}

export function changeUsername(userId: string, nextUsername: string): void {
  const username = nextUsername.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,20}$/.test(username)) {
    throw new AuthError('3–20 characters: letters, numbers, dot, dash or underscore.');
  }
  const clash = findByUsername(username);
  if (clash && clash.id !== userId) throw new AuthError('That username is already taken.');

  saveAccounts(listAccounts().map(a => (a.id === userId ? { ...a, username } : a)));
}

export function setAccent(userId: string, accent: string): void {
  saveAccounts(listAccounts().map(a => (a.id === userId ? { ...a, accent } : a)));
}
