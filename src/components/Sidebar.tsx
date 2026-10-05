import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Boxes,
  BarChart3,
  Users,
  Settings as SettingsIcon,
  Activity,
  ShieldCheck,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const { user, isAdmin, logout, settings } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, role: 'ALL' },
    { name: 'POS / New Order', path: '/pos', icon: ShoppingCart, role: 'ALL' },
    { name: 'Orders', path: '/orders', icon: Receipt, role: 'ALL' },
    { name: 'Items / Products', path: '/products', icon: Package, role: 'ALL' },
    { name: 'Inventory / Storage', path: '/inventory', icon: Boxes, role: 'ALL' },
    { name: 'Receipts', path: '/receipts', icon: Receipt, role: 'ALL' },
    { name: 'Reports', path: '/reports', icon: BarChart3, role: 'ALL' },
    { name: 'Users', path: '/users', icon: Users, role: 'ADMIN' },
    { name: 'Audit Logs', path: '/audit-logs', icon: ShieldCheck, role: 'ADMIN' },
    { name: 'Connectivity', path: '/connectivity', icon: Activity, role: 'ALL' },
    { name: 'Settings', path: '/settings', icon: SettingsIcon, role: 'ADMIN' },
  ];

  const filteredNav = navItems.filter((item) => item.role === 'ALL' || (item.role === 'ADMIN' && isAdmin));

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-choco-900/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-64 bg-choco-800 text-cream-100 z-50 transform transition-transform duration-300 ease-in-out flex flex-col justify-between shadow-2xl lg:translate-x-0 lg:static lg:z-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="flex items-center justify-between p-5 border-b border-choco-700/60 bg-choco-900/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-waffle-500 to-waffle-400 flex items-center justify-center text-2xl shadow-waffle">
                🧇
              </div>
              <div>
                <h1 className="font-extrabold text-lg text-cream-50 tracking-wide font-sans leading-tight">
                  {settings?.business_name || 'Waffle Wisk'}
                </h1>
                <p className="text-xs text-waffle-300 font-medium">Cart POS & Inventory</p>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden text-cream-300 hover:text-white p-1 rounded-lg hover:bg-choco-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Info Card */}
          <div className="mx-4 my-4 p-3 rounded-xl bg-choco-700/50 border border-choco-600/40 flex items-center justify-between">
            <div className="overflow-hidden pr-2">
              <p className="text-sm font-semibold text-cream-50 truncate">{user?.name}</p>
              <p className="text-xs text-cream-300 font-mono">@{user?.username}</p>
            </div>
            <span
              className={`px-2 py-0.5 text-[10px] font-extrabold tracking-wider rounded-md uppercase ${
                isAdmin
                  ? 'bg-waffle-500/20 text-waffle-300 border border-waffle-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {user?.role}
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-220px)]">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                      isActive
                        ? 'bg-gradient-to-r from-waffle-500 to-waffle-600 text-white shadow-soft font-semibold'
                        : 'text-cream-200 hover:bg-choco-700/60 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 mr-3 transition-transform group-hover:scale-110 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-choco-700/60 bg-choco-900/30">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium text-rose-300 bg-rose-900/20 hover:bg-rose-900/40 border border-rose-800/40 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};
