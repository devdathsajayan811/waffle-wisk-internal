import React from 'react';
import { Wifi, WifiOff, Database, Server, Activity, Clock, RefreshCw, LucideIcon } from 'lucide-react';
import { useSystemStatus } from '../context/SystemStatusContext';
import { Alert, PageHeader } from '../components/ui';

const formatUptime = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
};

interface ServiceCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  ok: boolean;
  status: string;
  detail: React.ReactNode;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ icon: Icon, title, subtitle, ok, status, detail }) => (
  <div className="card flex flex-col p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${
            ok ? 'bg-emerald-50 text-emerald-600 ring-emerald-200/70' : 'bg-amber-50 text-amber-600 ring-amber-200/70'
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="font-sans text-sm font-semibold text-choco-900">{title}</h3>
          <p className="text-xs text-choco-400">{subtitle}</p>
        </div>
      </div>
      <span className={ok ? 'badge-success' : 'badge-warning'}>
        <span className="dot" />
        {status}
      </span>
    </div>
    <p className="mt-4 border-t border-cream-200 pt-3 text-xs text-choco-500">{detail}</p>
  </div>
);

export const Connectivity: React.FC = () => {
  const { status, isOnline, refreshStatus } = useSystemStatus();
  const healthy = status.applicationHealth === 'Healthy';

  return (
    <div className="page-narrow">
      <PageHeader
        eyebrow="Administration"
        title="System status"
        description="Live health of the cart network, database and API server."
        actions={
          <button onClick={refreshStatus} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Check again
          </button>
        }
      />

      {status.databaseDurable === false && (
        <Alert tone="warning">
          The database is on temporary disk and will be wiped when the server restarts. Set TURSO_DATABASE_URL and
          TURSO_AUTH_TOKEN before using this deployment for real sales.
        </Alert>
      )}

      <section
        className={`relative overflow-hidden rounded-2xl border p-6 shadow-card ${
          healthy ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white' : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'
        }`}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-soft ${healthy ? 'bg-emerald-600' : 'bg-amber-600'}`}>
              <Activity className="h-6 w-6" />
              <span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full ring-2 ring-white ${healthy ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
            </div>
            <div>
              <p className={`text-xs font-medium ${healthy ? 'text-emerald-700' : 'text-amber-700'}`}>Overall health</p>
              <h2 className="font-display text-2xl font-semibold text-choco-900">
                {healthy ? 'All systems operational' : 'Running in degraded mode'}
              </h2>
              <p className="text-sm text-choco-500">
                {healthy ? 'Orders, payments and sync are working normally.' : 'Offline mode is active or the connection is unstable.'}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/70 px-4 py-3 text-right backdrop-blur sm:min-w-[9rem]">
            <p className="text-2xs font-medium text-choco-400">Server uptime</p>
            <p className="font-display text-xl font-semibold tabular-nums text-choco-900">{formatUptime(status.uptimeSeconds)}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ServiceCard
          icon={isOnline ? Wifi : WifiOff}
          title="Internet"
          subtitle="Cart network connection"
          ok={isOnline}
          status={isOnline ? 'Connected' : 'Offline'}
          detail={isOnline ? 'Connected over Wi-Fi or mobile hotspot.' : 'Working from local cache until the connection returns.'}
        />
        <ServiceCard
          icon={Database}
          title="Database"
          subtitle="Order and stock storage"
          ok={status.databaseStatus === 'Connected'}
          status={status.databaseStatus}
          detail={status.databaseDurable === false ? 'Temporary storage. Data will not survive a restart.' : 'Persistent storage is active.'}
        />
        <ServiceCard
          icon={Server}
          title="API server"
          subtitle="Backend service"
          ok={status.serverStatus === 'Online'}
          status={status.serverStatus}
          detail="Handles carts, checkout, receipts and reports."
        />
        <ServiceCard
          icon={Clock}
          title="Last sync"
          subtitle="Refreshes every 30 seconds"
          ok
          status="Synced"
          detail={<span className="tabular-nums">{new Date(status.lastSyncTime).toLocaleTimeString('en-IN')}</span>}
        />
      </section>
    </div>
  );
};
