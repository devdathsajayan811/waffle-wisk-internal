import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SystemStatusProvider } from './context/SystemStatusContext';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Products } from './pages/Products';
import { Orders } from './pages/Orders';
import { MaterialRequests } from './pages/MaterialRequests';
import { Inventory } from './pages/Inventory';
import { Receipts } from './pages/Receipts';
import { Reports } from './pages/Reports';
import { Users } from './pages/Users';
import { SettingsPage } from './pages/Settings';
import { AuditLogs } from './pages/AuditLogs';
import { Connectivity } from './pages/Connectivity';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAdmin?: boolean }> = ({
  children,
  requireAdmin = false,
}) => {
  const { user, token, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app">
        <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-waffle-300 to-waffle-500 text-2xl shadow-waffle">
          🧇
        </div>
        <p className="text-sm font-medium text-choco-400">Loading your workspace…</p>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/pos" replace />;
  }

  return <>{children}</>;
};

const PAGE_META: Record<string, { section: string; title: string }> = {
  '/dashboard': { section: 'Operations', title: 'Dashboard' },
  '/pos': { section: 'Operations', title: 'Point of sale' },
  '/orders': { section: 'Operations', title: 'Orders' },
  '/receipts': { section: 'Operations', title: 'Receipts' },
  '/products': { section: 'Catalog & stock', title: 'Menu items' },
  '/inventory': { section: 'Catalog & stock', title: 'Inventory' },
  '/material-requests': { section: 'Catalog & stock', title: 'Material requests' },
  '/reports': { section: 'Insights', title: 'Reports' },
  '/audit-logs': { section: 'Insights', title: 'Audit logs' },
  '/users': { section: 'Administration', title: 'Team' },
  '/settings': { section: 'Administration', title: 'Settings' },
  '/connectivity': { section: 'Administration', title: 'System status' },
};

// Main Layout Wrapper
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? { section: 'Workspace', title: 'Waffle Wisk' };

  return (
    <div className="flex h-dvh overflow-hidden bg-app text-choco-900">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header section={meta.section} title={meta.title} setMobileOpen={setMobileOpen} />
        <main id="main-content" className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
};

// Root Redirect based on user role
const RootRedirect: React.FC = () => {
  const { isAdmin } = useAuth();
  return <Navigate to={isAdmin ? '/dashboard' : '/pos'} replace />;
};

const adminOnly = (element: React.ReactNode) => <ProtectedRoute requireAdmin>{element}</ProtectedRoute>;

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SystemStatusProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<RootRedirect />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/pos" element={<POS />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route path="/material-requests" element={<MaterialRequests />} />
                      <Route path="/products" element={adminOnly(<Products />)} />
                      <Route path="/inventory" element={adminOnly(<Inventory />)} />
                      <Route path="/receipts" element={adminOnly(<Receipts />)} />
                      <Route path="/reports" element={adminOnly(<Reports />)} />
                      <Route path="/users" element={adminOnly(<Users />)} />
                      <Route path="/settings" element={adminOnly(<SettingsPage />)} />
                      <Route path="/audit-logs" element={adminOnly(<AuditLogs />)} />
                      <Route path="/connectivity" element={adminOnly(<Connectivity />)} />
                      <Route path="*" element={<RootRedirect />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </SystemStatusProvider>
    </AuthProvider>
  );
};

export default App;
