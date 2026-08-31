import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Account, UserProfile } from './types';
import {
  addReminder,
  commitEvents,
  getProfile,
  getReminders,
  runRollover,
  saveProfile,
} from './store';
import { ensureSeeded, getAccount, restoreSession, signOut } from './lib/auth';
import { DEFAULT_REMINDERS } from './lib/alerts';
import { useAlertEngine } from './hooks/useAlertEngine';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Toasts } from './components/Toasts';
import { Loader2 } from 'lucide-react';

/**
 * Everything past the dashboard is code-split. The Coach in particular drags in
 * react-markdown, so keeping it out of the first load is most of the difference
 * between a snappy open and a slow one on a phone.
 */
const Pact = lazy(() => import('./components/Pact').then(m => ({ default: m.Pact })));
const Tasks = lazy(() => import('./components/Tasks').then(m => ({ default: m.Tasks })));
const Alerts = lazy(() => import('./components/Alerts').then(m => ({ default: m.Alerts })));
const Gym = lazy(() => import('./components/Gym').then(m => ({ default: m.Gym })));
const Fuel = lazy(() => import('./components/Fuel').then(m => ({ default: m.Fuel })));
const Shadows = lazy(() => import('./components/Shadows').then(m => ({ default: m.Shadows })));
const Coach = lazy(() => import('./components/Coach').then(m => ({ default: m.Coach })));
const Logs = lazy(() => import('./components/Logs').then(m => ({ default: m.Logs })));
const ProfileSettings = lazy(() =>
  import('./components/ProfileSettings').then(m => ({ default: m.ProfileSettings })),
);

/** How long a burst of profile edits is coalesced before it hits localStorage. */
const SAVE_DEBOUNCE_MS = 250;

type Boot = 'loading' | 'login' | 'ready';

export default function App() {
  const [boot, setBoot] = useState<Boot>('loading');
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<UserProfile>(getProfile);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const engine = useAlertEngine(profile, account?.id ?? null);

  /**
   * Everything that has to happen once a player is active: arm their default alerts if
   * this is a fresh account, then roll the day over so stale ticks are cleared and the
   * streak is re-derived before the first render of real data. The alert engine picks
   * the reminders up on its own once `account` lands.
   */
  const enterSession = useCallback((next: Account) => {
    if (getReminders().length === 0) {
      for (const preset of DEFAULT_REMINDERS) addReminder(preset);
    }

    const { profile: rolled, events } = runRollover(getProfile());
    commitEvents(events);
    saveProfile(rolled);

    setProfile(rolled);
    setAccount(next);
    setBoot('ready');
  }, []);

  // ── Boot ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Seeding hashes two passwords, so it is awaited before the gate is shown.
      await ensureSeeded();
      if (cancelled) return;
      const restored = restoreSession();
      if (restored) enterSession(restored);
      else setBoot('login');
    })();
    return () => {
      cancelled = true;
    };
  }, [enterSession]);

  // ── Persist profile ────────────────────────────────────
  const pendingProfile = useRef<UserProfile | null>(null);

  useEffect(() => {
    if (boot !== 'ready') return;
    pendingProfile.current = profile;

    const timer = window.setTimeout(() => {
      if (pendingProfile.current) saveProfile(pendingProfile.current);
      pendingProfile.current = null;
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [profile, boot]);

  // A debounced write must not be lost to a backgrounded tab or a closed browser.
  useEffect(() => {
    const flush = () => {
      if (pendingProfile.current) {
        saveProfile(pendingProfile.current);
        pendingProfile.current = null;
      }
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);

  // ── Midnight rollover ──────────────────────────────────
  useEffect(() => {
    if (boot !== 'ready') return;
    let timer: number;

    const arm = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = window.setTimeout(() => {
        const { profile: rolled, events } = runRollover(getProfile());
        commitEvents(events);
        saveProfile(rolled);
        setProfile(rolled);
        arm();
      }, midnight.getTime() - now.getTime());
    };

    arm();
    return () => window.clearTimeout(timer);
  }, [boot]);

  // Clicking an OS notification focuses the tab; jump to the alerts screen with it.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'alert-click') setActiveTab('alerts');
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  }, []);

  const handleSignOut = useCallback(() => {
    signOut();
    setAccount(null);
    setSettingsOpen(false);
    setActiveTab('dashboard');
    setBoot('login');
  }, []);

  const refreshAccount = useCallback(() => {
    setAccount(prev => (prev ? (getAccount(prev.id) ?? prev) : prev));
  }, []);

  if (boot === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-outline font-headline text-[10px] tracking-[0.3em] uppercase">
          System booting
        </p>
      </div>
    );
  }

  if (boot === 'login' || !account) {
    return <Login onSignedIn={enterSession} />;
  }

  return (
    <>
      <Layout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        profile={profile}
        accent={account.accent}
        permission={engine.permission}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={handleSignOut}
      >
        <Suspense fallback={<TabFallback />}>
          {activeTab === 'dashboard' && (
            <Dashboard
              profile={profile}
              account={account}
              reminders={engine.reminders}
              onNavigate={setActiveTab}
            />
          )}
          {activeTab === 'pact' && <Pact profile={profile} account={account} />}
          {activeTab === 'tasks' && (
            <Tasks profile={profile} setProfile={setProfile} onRemindersChanged={engine.refresh} />
          )}
          {activeTab === 'alerts' && <Alerts engine={engine} />}
          {activeTab === 'gym' && <Gym />}
          {activeTab === 'fuel' && <Fuel />}
          {activeTab === 'shadows' && <Shadows profile={profile} setProfile={setProfile} />}
          {activeTab === 'coach' && <Coach profile={profile} userId={account.id} />}
          {activeTab === 'logs' && <Logs />}
        </Suspense>
      </Layout>

      <Toasts toasts={engine.toasts} onDismiss={engine.dismiss} onAcknowledge={engine.acknowledge} />

      {settingsOpen && (
        <Suspense fallback={null}>
          <ProfileSettings
            profile={profile}
            account={account}
            onSave={updateProfile}
            onAccountChanged={refreshAccount}
            onClose={() => setSettingsOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-5 h-5 text-primary animate-spin" />
    </div>
  );
}
