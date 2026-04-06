import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Task, GymLog, FuelLog } from './types';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Tasks } from './components/Tasks';
import { Gym } from './components/Gym';
import { Fuel } from './components/Fuel';
import { Shadows } from './components/Shadows';
import { Coach } from './components/Coach';
import { LogIn, Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userDoc);

        if (!docSnap.exists()) {
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Player',
            email: currentUser.email || '',
            level: 1,
            xp: 0,
            rank: 'E',
            streak: 0,
            lastActive: new Date().toISOString(),
            shadows: []
          };
          await setDoc(userDoc, newProfile);
          setProfile(newProfile);
        } else {
          setProfile(docSnap.data() as UserProfile);
        }

        // Real-time updates for profile
        onSnapshot(userDoc, (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
          }
        });
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mb-8 space-y-2">
          <h1 className="text-5xl font-headline font-bold text-primary glow-primary tracking-tighter uppercase">SYSTEM HUD</h1>
          <p className="text-outline uppercase tracking-widest text-sm">Awaiting Player Authentication...</p>
        </div>
        <button
          onClick={handleLogin}
          className="flex items-center gap-3 bg-primary-container text-on-primary-container px-8 py-4 font-headline font-bold uppercase tracking-widest hover:shadow-[0_0_20px_rgba(237,177,255,0.4)] transition-all"
        >
          <LogIn className="w-5 h-5" />
          Initialize System
        </button>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab} profile={profile} onLogout={handleLogout}>
      {activeTab === 'dashboard' && <Dashboard profile={profile} />}
      {activeTab === 'tasks' && <Tasks profile={profile} />}
      {activeTab === 'gym' && <Gym profile={profile} />}
      {activeTab === 'fuel' && <Fuel profile={profile} />}
      {activeTab === 'shadows' && <Shadows profile={profile} />}
      {activeTab === 'coach' && <Coach profile={profile} />}
    </Layout>
  );
}
