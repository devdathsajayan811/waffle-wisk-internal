import React, { useState } from 'react';
import { Menu, Wifi, WifiOff, Key, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSystemStatus } from '../context/SystemStatusContext';
import { ChangePasswordModal } from './ChangePasswordModal';

interface HeaderProps {
  title: string;
  setMobileOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ title, setMobileOpen }) => {
  const { user, isAdmin } = useAuth();
  const { isOnline, status, showBanner, bannerMessage } = useSystemStatus();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 bg-cream-50/90 backdrop-blur-md border-b border-cream-300/60 px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-xs">
        {/* Left Title & Mobile Menu Trigger */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-xl text-choco-700 hover:bg-cream-200 transition-colors"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-choco-900 font-sans tracking-tight">{title}</h1>
            <p className="text-xs text-choco-500 hidden sm:block">Waffle Cart Management & POS System</p>
          </div>
        </div>

        {/* Right System Indicators & Profile */}
        <div className="flex items-center space-x-3">
          {/* Online/Offline Status Indicator */}
          <div
            className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium border shadow-2xs ${
              isOnline && status.databaseStatus === 'Connected'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 mr-1.5 text-emerald-600 animate-pulse" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
            )}
            <span className="font-semibold">{isOnline ? 'Online' : 'Offline Mode'}</span>
          </div>

          {/* Change Password Quick Button */}
          <button
            onClick={() => setChangePasswordOpen(true)}
            className="hidden sm:flex items-center px-3 py-1.5 rounded-xl text-xs font-medium text-choco-700 bg-cream-200/80 hover:bg-cream-300 border border-cream-300 transition-colors"
            title="Change Password"
          >
            <Key className="w-3.5 h-3.5 mr-1.5 text-waffle-600" />
            Password
          </button>

          {/* User Profile Avatar */}
          <div className="flex items-center space-x-2 pl-2 border-l border-cream-300">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-choco-600 to-choco-800 text-cream-50 flex items-center justify-center font-bold text-xs shadow-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
            </div>
            <div className="hidden md:block text-left leading-tight">
              <span className="block text-xs font-semibold text-choco-900">{user?.name}</span>
              <span className="block text-[10px] text-choco-500 font-mono">
                {isAdmin ? 'Administrator' : 'Staff Member'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Non-blocking Offline Banner */}
      {showBanner && (
        <div
          className={`px-4 py-2 text-xs font-medium text-center flex items-center justify-center space-x-2 transition-all duration-300 ${
            isOnline
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-600 text-white shadow-md'
          }`}
        >
          {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          <span>{bannerMessage}</span>
        </div>
      )}

      {/* Change Password Modal */}
      {changePasswordOpen && (
        <ChangePasswordModal isOpen={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      )}
    </>
  );
};
