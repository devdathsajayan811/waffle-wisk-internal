import React from 'react';
import { Wifi, WifiOff, Database, Server, Activity, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { useSystemStatus } from '../context/SystemStatusContext';

export const Connectivity: React.FC = () => {
  const { status, isOnline, refreshStatus } = useSystemStatus();

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-choco-900">Connectivity & System Status</h2>
          <p className="text-xs text-choco-500">Live operational diagnostics for cart network, SQLite database, and server uptime</p>
        </div>

        <button
          onClick={refreshStatus}
          className="px-4 py-2 bg-white hover:bg-cream-100 text-choco-700 text-xs font-bold rounded-xl border border-cream-300 shadow-2xs flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-waffle-600" />
          <span>Run Diagnostic</span>
        </button>
      </div>

      {/* Main Overall Health Card */}
      <div
        className={`p-6 rounded-3xl border shadow-soft flex items-center justify-between ${
          status.applicationHealth === 'Healthy'
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/80 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center space-x-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-xs ${
              status.applicationHealth === 'Healthy'
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-600 text-white'
            }`}
          >
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block opacity-75">Application Health</span>
            <h3 className="text-2xl font-extrabold">{status.applicationHealth} Status</h3>
            <p className="text-xs opacity-80">
              {status.applicationHealth === 'Healthy'
                ? 'All cart subsystems operational. Offline queue active.'
                : 'Local offline mode active or internet connection degraded.'}
            </p>
          </div>
        </div>

        <div className="hidden sm:block text-right">
          <span className="text-xs block opacity-75 font-mono">Server Uptime</span>
          <span className="text-lg font-extrabold font-mono">{status.uptimeSeconds}s</span>
        </div>
      </div>

      {/* Grid of 4 System Component Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Component 1: Internet */}
        <div className="bg-white p-5 rounded-2xl border border-cream-200 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-bold text-sm text-choco-900">Internet Connection</h4>
                <p className="text-xs text-choco-500">Cart Network Connection</p>
              </div>
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold ${isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              ● {isOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
          <p className="text-xs text-choco-600 pt-2 border-t border-cream-100">
            {isOnline ? 'Connected to local Wi-Fi / cellular hotspot.' : 'Operating seamlessly in local cached offline mode.'}
          </p>
        </div>

        {/* Component 2: Database */}
        <div className="bg-white p-5 rounded-2xl border border-cream-200 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-choco-900">SQLite Database</h4>
                <p className="text-xs text-choco-500">Local POS Storage Engine</p>
              </div>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
              ● {status.databaseStatus}
            </span>
          </div>
          <p className="text-xs text-choco-600 pt-2 border-t border-cream-100">
            SQLite database active with WAL journal & file persistence.
          </p>
        </div>

        {/* Component 3: Server Status */}
        <div className="bg-white p-5 rounded-2xl border border-cream-200 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-choco-900">Backend API Server</h4>
                <p className="text-xs text-choco-500">Node.js Express Host</p>
              </div>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
              ● {status.serverStatus}
            </span>
          </div>
          <p className="text-xs text-choco-600 pt-2 border-t border-cream-100">
            Local Express server listening on http://localhost:5000.
          </p>
        </div>

        {/* Component 4: Sync Time */}
        <div className="bg-white p-5 rounded-2xl border border-cream-200 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-waffle-100 text-waffle-700 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-choco-900">Last Synchronization</h4>
                <p className="text-xs text-choco-500">Auto-sync frequency: 30s</p>
              </div>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-waffle-100 text-waffle-800">
              ● Synced
            </span>
          </div>
          <p className="text-xs text-choco-600 pt-2 border-t border-cream-100 font-mono">
            {new Date(status.lastSyncTime).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};
