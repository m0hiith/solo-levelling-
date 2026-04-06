import React from 'react';
import { UserProfile } from '../types';
import { 
  LayoutDashboard, 
  CheckSquare, 
  TrendingUp, 
  Dumbbell, 
  Flame, 
  Users, 
  Bot, 
  LogOut, 
  Bell, 
  Settings 
} from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  profile: UserProfile | null;
  onLogout: () => void;
}

export function Layout({ children, activeTab, onTabChange, profile, onLogout }: LayoutProps) {
  const navItems = [
    { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'tasks', label: 'TASKS', icon: CheckSquare },
    { id: 'gym', label: 'GYM', icon: Dumbbell },
    { id: 'fuel', label: 'FUEL', icon: Flame },
    { id: 'shadows', label: 'SHADOWS', icon: Users },
    { id: 'coach', label: 'COACH', icon: Bot },
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans selection:bg-primary/30">
      {/* Top Bar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-neutral-950/70 backdrop-blur-xl border-b border-white/5">
        <div className="text-xl font-headline font-bold tracking-tighter text-primary glow-primary uppercase">
          SYSTEM HUD
        </div>
        <div className="flex items-center gap-6">
          <button className="text-outline hover:text-secondary transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <button className="text-outline hover:text-secondary transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] font-headline font-bold text-primary tracking-widest uppercase">RANK {profile?.rank}</div>
              <div className="text-xs font-bold">LVL {profile?.level}</div>
            </div>
            <button onClick={onLogout} className="w-10 h-10 border border-primary/20 p-0.5 hover:border-primary transition-all">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} 
                alt="Avatar" 
                className="w-full h-full object-cover bg-surface"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col h-full fixed left-0 top-0 pt-20 bg-neutral-950/80 backdrop-blur-2xl w-64 border-r border-white/5">
        <div className="px-8 py-6 mb-4">
          <div className="text-primary font-black font-headline tracking-widest text-[10px] uppercase opacity-60">MONARCH RANK PROFILE</div>
          <div className="text-secondary font-headline font-bold text-lg tracking-tight uppercase">{profile?.rank}-RANK PLAYER</div>
          <div className="text-outline font-label text-[10px] tracking-widest uppercase">SYSTEM ACTIVE</div>
        </div>
        <nav className="flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center px-8 py-4 font-headline tracking-widest text-xs transition-all",
                activeTab === item.id 
                  ? "text-secondary border-l-2 border-secondary bg-secondary/5" 
                  : "text-outline hover:bg-white/5 hover:text-primary"
              )}
            >
              <item.icon className="w-4 h-4 mr-3" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-6">
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 text-outline hover:text-error transition-colors text-xs font-headline tracking-widest"
          >
            <LogOut className="w-4 h-4" />
            LOGOUT
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-24 pb-24 px-6 md:px-12 max-w-7xl mx-auto">
        {children}
      </main>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-2 bg-neutral-950/90 backdrop-blur-lg border-t border-white/5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "flex flex-col items-center justify-center p-2 transition-all",
              activeTab === item.id ? "text-secondary glow-secondary scale-110" : "text-outline opacity-60"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-headline font-bold text-[8px] tracking-widest uppercase mt-1">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
