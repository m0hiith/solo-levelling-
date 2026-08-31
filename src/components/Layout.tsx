import React, { memo, useState } from 'react';
import { UserProfile } from '../types';
import {
  BellRing,
  Bot,
  CalendarCheck,
  CheckSquare,
  Dumbbell,
  Flame,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  ScrollText,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Avatar } from './Avatar';
import { NotifyPermission } from '../lib/notifications';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  profile: UserProfile;
  accent: string;
  permission: NotifyPermission;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { id: 'pact', label: '90 DAY PACT', icon: CalendarCheck },
  { id: 'tasks', label: 'TASKS', icon: CheckSquare },
  { id: 'alerts', label: 'ALERTS', icon: BellRing },
  { id: 'gym', label: 'GYM', icon: Dumbbell },
  { id: 'fuel', label: 'FUEL', icon: Flame },
  { id: 'coach', label: 'COACH', icon: Bot },
  { id: 'shadows', label: 'SHADOWS', icon: Users },
  { id: 'logs', label: 'LOGS', icon: ScrollText },
];

/** Nine tabs will not fit a phone's bottom bar, so the rest live behind MORE. */
const MOBILE_PRIMARY = ['dashboard', 'pact', 'tasks', 'alerts'];

export const Layout = memo(function Layout({
  children,
  activeTab,
  onTabChange,
  profile,
  accent,
  permission,
  onOpenSettings,
  onSignOut,
}: LayoutProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = NAV_ITEMS.filter(item => MOBILE_PRIMARY.includes(item.id));
  const secondary = NAV_ITEMS.filter(item => !MOBILE_PRIMARY.includes(item.id));

  const select = (tab: string) => {
    onTabChange(tab);
    setMoreOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans selection:bg-primary/30">
      {/* Top Bar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-neutral-950/70 backdrop-blur-xl border-b border-white/5">
        <div className="text-xl font-headline font-bold tracking-tighter uppercase">
          <span className="text-on-surface">SOLO</span>{' '}
          <span className="text-primary glow-primary">LEVELING</span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            onClick={() => select('alerts')}
            aria-label="Alert protocol"
            title={permission === 'granted' ? 'Alerts armed' : 'Alerts not armed'}
            className={cn(
              'transition-colors relative',
              permission === 'granted' ? 'text-secondary' : 'text-outline hover:text-secondary',
            )}
          >
            <BellRing className="w-5 h-5" />
            {permission !== 'granted' && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-error rounded-full" />
            )}
          </button>
          <button
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="text-outline hover:text-secondary transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenSettings}
            aria-label="Edit profile"
            className="flex items-center gap-3 group"
          >
            <div className="text-right hidden sm:block">
              <div className="text-[10px] font-headline font-bold text-primary tracking-widest uppercase">
                RANK {profile.rank}
              </div>
              <div className="text-xs font-bold">LVL {profile.level}</div>
            </div>
            <div
              className="w-10 h-10 border p-0.5 transition-colors"
              style={{ borderColor: `${accent}55` }}
            >
              <Avatar
                avatar={profile.avatar}
                displayName={profile.displayName}
                className="text-xs"
              />
            </div>
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col h-full fixed left-0 top-0 pt-20 bg-neutral-950/80 backdrop-blur-2xl w-64 border-r border-white/5">
        <div className="px-8 py-6 mb-2">
          <div className="text-primary font-black font-headline tracking-widest text-[10px] uppercase opacity-60">
            MONARCH RANK PROFILE
          </div>
          <div
            className="font-headline font-bold text-lg tracking-tight uppercase truncate"
            style={{ color: accent }}
          >
            {profile.displayName}
          </div>
          <div className="text-outline font-label text-[10px] tracking-widest uppercase">
            {profile.rank}-RANK · {profile.streak} DAY STREAK
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <NavButton
              key={item.id}
              item={item}
              active={activeTab === item.id}
              onSelect={select}
            />
          ))}
        </nav>
        <button
          onClick={onSignOut}
          className="flex items-center px-8 py-5 font-headline tracking-widest text-[10px] text-outline hover:text-error transition-colors border-t border-white/5"
        >
          <LogOut className="w-4 h-4 mr-3" />
          SIGN OUT
        </button>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-24 pb-28 px-6 md:px-12 max-w-7xl mx-auto">{children}</main>

      {/* Mobile "more" sheet */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end"
          onClick={() => setMoreOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="More sections"
        >
          <div
            className="w-full bg-surface border-t border-primary/20 pb-8 pt-2"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-3">
              <span className="font-headline text-[10px] tracking-widest uppercase text-outline">
                More
              </span>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="text-outline hover:text-on-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {secondary.map(item => (
              <NavButton key={item.id} item={item} active={activeTab === item.id} onSelect={select} />
            ))}
            <button
              onClick={onSignOut}
              className="w-full flex items-center px-8 py-4 font-headline tracking-widest text-xs text-outline hover:text-error transition-colors"
            >
              <LogOut className="w-4 h-4 mr-3" />
              SIGN OUT
            </button>
          </div>
        </div>
      )}

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-1 pb-6 pt-2 bg-neutral-950/90 backdrop-blur-lg border-t border-white/5">
        {primary.map(item => (
          <MobileTab
            key={item.id}
            label={item.label}
            icon={item.icon}
            active={activeTab === item.id}
            onClick={() => select(item.id)}
          />
        ))}
        <MobileTab
          label="MORE"
          icon={MoreHorizontal}
          active={secondary.some(item => item.id === activeTab)}
          onClick={() => setMoreOpen(true)}
        />
      </nav>
    </div>
  );
});

function NavButton({
  item,
  active,
  onSelect,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  onSelect: (tab: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(item.id)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'w-full flex items-center px-8 py-4 font-headline tracking-widest text-xs transition-all',
        active
          ? 'text-secondary border-l-2 border-secondary bg-secondary/5'
          : 'text-outline hover:bg-white/5 hover:text-primary',
      )}
    >
      <item.icon className="w-4 h-4 mr-3" />
      {item.label}
    </button>
  );
}

function MobileTab({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center justify-center p-1.5 transition-all flex-1',
        active ? 'text-secondary glow-secondary scale-110' : 'text-outline opacity-60',
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="font-headline font-bold text-[7px] tracking-widest uppercase mt-1 text-center leading-tight">
        {label}
      </span>
    </button>
  );
}
