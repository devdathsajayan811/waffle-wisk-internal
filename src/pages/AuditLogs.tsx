import React, { useState, useEffect } from 'react';
import { ShieldCheck, Filter } from 'lucide-react';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { StatusBadge } from '../components/StatusBadge';

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-choco-900">Admin Audit Logs</h2>
          <p className="text-xs text-choco-500">Security audit history tracking price edits, stock updates, logins, and system changes</p>
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-choco-500" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden bg-white text-choco-800"
          >
            <option value="all">All Actions</option>
            <option value="LOGIN">LOGIN</option>
            <option value="CREATE_PRODUCT">CREATE_PRODUCT</option>
            <option value="UPDATE_PRODUCT">UPDATE_PRODUCT</option>
            <option value="PRICE_CHANGE">PRICE_CHANGE</option>
            <option value="STOCK_MOVEMENT">STOCK_MOVEMENT</option>
            <option value="CREATE_ORDER">CREATE_ORDER</option>
            <option value="REFUND_ORDER">REFUND_ORDER</option>
            <option value="CREATE_USER">CREATE_USER</option>
            <option value="UPDATE_SETTINGS">UPDATE_SETTINGS</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cream-100/60 text-choco-700 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Performed By</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 text-choco-900">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-choco-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-cream-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className="font-extrabold text-[11px] font-mono text-waffle-700 bg-waffle-50 px-2 py-0.5 rounded-md border border-waffle-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-choco-900">{log.description}</td>
                    <td className="px-6 py-3.5 font-semibold text-choco-800">{log.user_name}</td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={log.user_role} type="role" />
                    </td>
                    <td className="px-6 py-3.5 text-choco-500 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-choco-400">
                    No audit records found matching filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
