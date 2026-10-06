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
import { Orders } from './pages/Orders';
import { MaterialRequests } from './pages/MaterialRequests';

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
    return <Navigate to="/pos" replace />;
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
        return 'Create Cart';
      case '/orders':
        return 'Orders & Carts History';
      case '/products':
        return 'Items & Menu Management';
      case '/material-requests':
        return 'Raw Material Requests';
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

// Root Redirect based on user role
const RootRedirect: React.FC = () => {
  const { isAdmin } = useAuth();
  return <Navigate to={isAdmin ? '/dashboard' : '/pos'} replace />;
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
                        <Route path="/" element={<RootRedirect />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/pos" element={<POS />} />
                        <Route path="/orders" element={<Orders />} />
                        <Route
                          path="/products"
                          element={
                            <ProtectedRoute requireAdmin>
                              <Products />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/material-requests" element={<MaterialRequests />} />
                        <Route path="*" element={<RootRedirect />} />
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
