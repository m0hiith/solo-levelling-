import { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile } from './types';
import { getProfile, saveProfile, applyDailyStreak, commitEvents } from './store';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Tasks } from './components/Tasks';
import { Gym } from './components/Gym';
import { Fuel } from './components/Fuel';
import { Shadows } from './components/Shadows';
import { Coach } from './components/Coach';
import { Logs } from './components/Logs';
import { ProfileSettings } from './components/ProfileSettings';

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(getProfile);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const streakChecked = useRef(false);

  // Roll the daily streak forward once per session. The ref guard keeps StrictMode's
  // double-invoked effect from logging the check-in twice, and the mutation is
  // resolved out here rather than inside the updater for the same reason.
  useEffect(() => {
    if (streakChecked.current) return;
    streakChecked.current = true;
    const { profile: next, events } = applyDailyStreak(getProfile());
    commitEvents(events);
    setProfile(next);
  }, []);

  // Persist profile changes to localStorage.
  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  }, []);

  return (
    <>
      <Layout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        profile={profile}
        onOpenSettings={() => setSettingsOpen(true)}
      >
        {activeTab === 'dashboard' && <Dashboard profile={profile} />}
        {activeTab === 'tasks' && <Tasks profile={profile} setProfile={setProfile} />}
        {activeTab === 'gym' && <Gym />}
        {activeTab === 'fuel' && <Fuel />}
        {activeTab === 'shadows' && <Shadows profile={profile} setProfile={setProfile} />}
        {activeTab === 'coach' && <Coach profile={profile} />}
        {activeTab === 'logs' && <Logs />}
      </Layout>

      {settingsOpen && (
        <ProfileSettings
          profile={profile}
          onSave={updateProfile}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
