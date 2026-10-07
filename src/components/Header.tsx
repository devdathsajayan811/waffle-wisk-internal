import React, { useState } from 'react';
import { Menu, Wifi, WifiOff, KeyRound, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSystemStatus } from '../context/SystemStatusContext';
import { ChangePasswordModal } from './ChangePasswordModal';

interface HeaderProps {
  section: string;
  title: string;
  setMobileOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ section, title, setMobileOpen }) => {
  const { user } = useAuth();
  const { isOnline, status, showBanner, bannerMessage } = useSystemStatus();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const healthy = isOnline && status.databaseStatus === 'Connected';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <>
      <header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-cream-300/60 bg-cream-50/80 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="icon-btn -ml-1 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="hidden text-choco-400 sm:inline">{section}</span>
            <ChevronRight className="hidden h-3.5 w-3.5 text-choco-300 sm:inline" />
            <span className="truncate font-semibold text-choco-900">{title}</span>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden text-xs font-medium text-choco-400 md:inline">{today}</span>

          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              healthy
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
            title={healthy ? 'Connected to server and database' : 'Connection degraded'}
          >
            <span className="relative flex h-2 w-2">
              {healthy && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${healthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <div className="mx-1 hidden h-6 w-px bg-cream-300 sm:block" />

          <button
            onClick={() => setChangePasswordOpen(true)}
            className="group flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-cream-200/70"
            title="Change password"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-choco-500 to-choco-700 font-display text-xs font-semibold text-cream-50 shadow-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="hidden text-left leading-tight md:block">
              <span className="block text-xs font-semibold text-choco-900">{user?.name}</span>
              <span className="flex items-center gap-1 text-2xs text-choco-400 group-hover:text-waffle-600">
                <KeyRound className="h-3 w-3" /> Change password
              </span>
            </div>
          </button>
        </div>
      </header>

      {showBanner && (
        <div
          className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white animate-fade-in ${
            isOnline ? 'bg-emerald-600' : 'bg-amber-600'
          }`}
        >
          {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          <span>{bannerMessage}</span>
        </div>
      )}

      {changePasswordOpen && (
        <ChangePasswordModal isOpen={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      )}
    </>
  );
};
