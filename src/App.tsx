import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { SystemStatusProvider } from './context/SystemStatusContext';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Products } from './pages/Products';
import { Inventory } from './pages/Inventory';
import { Orders } from './pages/Orders';
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
      <div className="min-h-screen bg-cream-100 flex items-center justify-center text-xs font-bold text-choco-600">
        Loading Waffle Wisk Portal...
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Main Layout Wrapper
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = (path: string): string => {
    switch (path) {
      case '/dashboard':
        return 'Dashboard Overview';
      case '/pos':
        return 'POS / New Order';
      case '/orders':
        return 'Order History';
      case '/products':
        return 'Items & Menu Management';
      case '/inventory':
        return 'Inventory & Storage';
      case '/receipts':
        return 'Receipts Archive';
      case '/reports':
        return 'Analytics & Reports';
      case '/users':
        return 'User & Staff Management';
      case '/audit-logs':
        return 'Admin Audit Logs';
      case '/connectivity':
        return 'Connectivity & Health';
      case '/settings':
        return 'Portal Settings';
      default:
        return 'Waffle Wisk Cart';
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 text-choco-900 flex overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={getPageTitle(location.pathname)} setMobileOpen={setMobileOpen} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SystemStatusProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/pos" element={<POS />} />
                        <Route path="/orders" element={<Orders />} />
                        <Route path="/products" element={<Products />} />
                        <Route path="/inventory" element={<Inventory />} />
                        <Route path="/receipts" element={<Receipts />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route
                          path="/users"
                          element={
                            <ProtectedRoute requireAdmin>
                              <Users />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/audit-logs"
                          element={
                            <ProtectedRoute requireAdmin>
                              <AuditLogs />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/connectivity" element={<Connectivity />} />
                        <Route
                          path="/settings"
                          element={
                            <ProtectedRoute requireAdmin>
                              <SettingsPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </SystemStatusProvider>
    </AuthProvider>
  );
};

export default App;
