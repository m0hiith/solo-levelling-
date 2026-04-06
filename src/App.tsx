import { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { getProfile, saveProfile } from './store';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Tasks } from './components/Tasks';
import { Gym } from './components/Gym';
import { Fuel } from './components/Fuel';
import { Shadows } from './components/Shadows';
import { Coach } from './components/Coach';

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(getProfile);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Persist profile changes to localStorage
  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab} profile={profile}>
      {activeTab === 'dashboard' && <Dashboard profile={profile} />}
      {activeTab === 'tasks' && <Tasks profile={profile} setProfile={setProfile} />}
      {activeTab === 'gym' && <Gym profile={profile} />}
      {activeTab === 'fuel' && <Fuel profile={profile} />}
      {activeTab === 'shadows' && <Shadows profile={profile} />}
      {activeTab === 'coach' && <Coach profile={profile} />}
    </Layout>
  );
}
