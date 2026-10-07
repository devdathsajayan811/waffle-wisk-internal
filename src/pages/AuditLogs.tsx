import React, { useState, useEffect } from 'react';
import { ScrollText } from 'lucide-react';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, PageHeader, SkeletonRows } from '../components/ui';

const ACTIONS = [
  'LOGIN',
  'CREATE_PRODUCT',
  'UPDATE_PRODUCT',
  'PRICE_CHANGE',
  'STOCK_MOVEMENT',
  'CREATE_ORDER',
  'REFUND_ORDER',
  'CREATE_USER',
  'UPDATE_SETTINGS',
];

const actionLabel = (action: string) =>
  action
    .toLowerCase()
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');

const actionTone = (action: string) => {
  if (action.includes('REFUND')) return 'badge-danger';
  if (action.includes('PRICE') || action.includes('SETTINGS')) return 'badge-warning';
  if (action.includes('CREATE')) return 'badge-success';
  if (action === 'LOGIN') return 'badge-info';
  return 'badge-neutral';
};

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs({ action: actionFilter, limit: 100 });
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Insights"
        title="Audit logs"
        description="Who changed what and when: sign-ins, price edits, stock movements and settings changes."
        actions={
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="select w-auto min-w-[12rem]"
            aria-label="Filter by action"
          >
            <option value="all">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        }
      />

      <div className="card overflow-hidden">
        {!loading && logs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No activity recorded"
            description={actionFilter === 'all' ? 'Actions will appear here as the team uses the portal.' : 'Nothing logged for this action yet.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Details</th>
                  <th className="hidden md:table-cell">By</th>
                  <th className="text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={4} rows={8} />
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap">
                        <span className={actionTone(log.action)}>{actionLabel(log.action)}</span>
                      </td>
                      <td className="min-w-[16rem] text-choco-700">{log.description}</td>
                      <td className="hidden whitespace-nowrap md:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-choco-900">{log.user_name}</span>
                          <StatusBadge status={log.user_role} type="role" />
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-right text-xs tabular-nums text-choco-400">
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
