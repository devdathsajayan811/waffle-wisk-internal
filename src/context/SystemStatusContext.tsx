import React, { createContext, useContext, useState, useEffect } from 'react';
import { SystemStatus } from '../types';
import { api } from '../services/api';

interface SystemStatusContextType {
  status: SystemStatus;
  isOnline: boolean;
  refreshStatus: () => Promise<void>;
  showBanner: boolean;
  bannerMessage: string;
}

const SystemStatusContext = createContext<SystemStatusContextType | undefined>(undefined);

export const SystemStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [showBanner, setShowBanner] = useState<boolean>(!navigator.onLine);
  const [bannerMessage, setBannerMessage] = useState<string>(
    !navigator.onLine ? 'Internet connection lost. Some online features may be unavailable.' : ''
  );

  const [status, setStatus] = useState<SystemStatus>({
    internetStatus: navigator.onLine ? 'Connected' : 'Offline',
    databaseStatus: 'Connected',
    serverStatus: 'Online',
    lastSyncTime: new Date().toISOString(),
    applicationHealth: 'Healthy',
    uptimeSeconds: 0,
  });

  const refreshStatus = async () => {
    try {
      const data = await api.getSystemStatus();
      setStatus({
        ...data,
        internetStatus: navigator.onLine ? 'Connected' : 'Offline',
      });
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        serverStatus: 'Offline',
        databaseStatus: 'Disconnected',
        applicationHealth: 'Error',
      }));
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      setBannerMessage('Back Online — System synchronized.');
      setTimeout(() => setShowBanner(false), 4000);
      refreshStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      setBannerMessage('Internet connection lost. Operational in local offline mode.');
      refreshStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial status poll
    refreshStatus();

    const interval = setInterval(refreshStatus, 30000); // Poll every 30s

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <SystemStatusContext.Provider
      value={{
        status,
        isOnline,
        refreshStatus,
        showBanner,
        bannerMessage,
      }}
    >
      {children}
    </SystemStatusContext.Provider>
  );
};

export const useSystemStatus = () => {
  const context = useContext(SystemStatusContext);
  if (!context) throw new Error('useSystemStatus must be used within a SystemStatusProvider');
  return context;
};
