import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  PackageCheck,
  LogOut,
  X,
  FileText,
  Boxes,
  BarChart3,
  Users,
  Settings,
  ScrollText,
  Activity,
  LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Point of sale', path: '/pos', icon: ShoppingCart },
      { name: 'Orders', path: '/orders', icon: Receipt },
      { name: 'Receipts', path: '/receipts', icon: FileText },
    ],
  },
  {
    label: 'Catalog & stock',
    items: [
      { name: 'Menu items', path: '/products', icon: Package },
      { name: 'Inventory', path: '/inventory', icon: Boxes },
      { name: 'Material requests', path: '/material-requests', icon: PackageCheck },
    ],
  },
  {
    label: 'Insights',
    items: [
      { name: 'Reports', path: '/reports', icon: BarChart3 },
      { name: 'Audit logs', path: '/audit-logs', icon: ScrollText },
    ],
  },
  {
    label: 'Administration',
    items: [
      { name: 'Team', path: '/users', icon: Users },
      { name: 'Settings', path: '/settings', icon: Settings },
      { name: 'System status', path: '/connectivity', icon: Activity },
    ],
  },
];

const STAFF_NAV: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { name: 'Point of sale', path: '/pos', icon: ShoppingCart },
      { name: 'My carts', path: '/orders', icon: Receipt },
      { name: 'Material requests', path: '/material-requests', icon: PackageCheck },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const { user, isAdmin, logout, settings } = useAuth();
  const groups = isAdmin ? ADMIN_NAV : STAFF_NAV;
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?';

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-choco-900/50 backdrop-blur-sm animate-fade-in lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col bg-choco-800 text-cream-100 transition-transform duration-300 ease-out-expo lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Ambient texture */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-16 -top-24 h-64 w-64 rounded-full bg-waffle-500/10 blur-3xl" />
          <div className="absolute inset-0 bg-grain opacity-[0.04] mix-blend-overlay" />
        </div>

        {/* Brand */}
        <div className="relative flex items-center justify-between px-5 pb-5 pt-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-waffle-300 to-waffle-500 text-xl shadow-waffle ring-1 ring-inset ring-white/20">
              🧇
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-[1.0625rem] font-semibold leading-tight tracking-tight text-cream-50">
                {settings?.business_name || 'Waffle Wisk'}
              </p>
              <p className="text-2xs font-medium text-cream-400/70">Cart management portal</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-cream-400 transition-colors hover:bg-white/5 hover:text-cream-50 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mx-5 h-px bg-gradient-to-r from-transparent via-choco-600 to-transparent" />

        {/* Navigation */}
        <nav className="no-scrollbar relative flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-[0.14em] text-cream-400/50">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-white/[0.09] to-white/[0.03] text-cream-50 ring-1 ring-inset ring-white/[0.06]'
                            : 'text-cream-300/75 hover:bg-white/[0.04] hover:text-cream-50'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-waffle-400 shadow-[0_0_12px_rgba(232,157,37,0.7)]" />
                          )}
                          <Icon
                            className={`h-[1.125rem] w-[1.125rem] shrink-0 transition-colors ${
                              isActive ? 'text-waffle-300' : 'text-cream-400/60 group-hover:text-cream-200'
                            }`}
                            strokeWidth={1.85}
                          />
                          <span className="truncate">{item.name}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Account */}
        <div className="relative border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-choco-500 to-choco-600 font-display text-sm font-semibold text-cream-50 ring-1 ring-inset ring-white/10">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-cream-50">{user?.name}</p>
              <p className="truncate text-2xs text-cream-400/70">
                {isAdmin ? 'Owner · Admin' : 'Staff'} · @{user?.username}
              </p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-cream-400/70 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
