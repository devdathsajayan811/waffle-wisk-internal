import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, BusinessSettings } from '../types';
import { api, getAuthToken, removeAuthToken, setAuthToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  settings: BusinessSettings | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  login: (token: string, user: User, settings: BusinessSettings) => void;
  logout: () => void;
  updateSettingsState: (settings: BusinessSettings) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setUser(null);
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.getCurrentUser();
      setUser(res.user);
      setSettings(res.settings);
    } catch (err) {
      console.error('Failed to fetch current user:', err);
      removeAuthToken();
      setUser(null);
      setTokenState(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = (newToken: string, newUser: User, newSettings: BusinessSettings) => {
    setAuthToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
    setSettings(newSettings);
  };

  const logout = () => {
    removeAuthToken();
    setTokenState(null);
    setUser(null);
  };

  const updateSettingsState = (newSettings: BusinessSettings) => {
    setSettings(newSettings);
  };

  const isAdmin = user?.role === 'ADMIN';
  const isStaff = user?.role === 'STAFF';

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        token,
        loading,
        isAdmin,
        isStaff,
        login,
        logout,
        updateSettingsState,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
