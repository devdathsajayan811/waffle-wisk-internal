import React, { useState, useEffect } from 'react';
import { PackageCheck, Clock, CheckCircle2, CheckSquare, Send, ShoppingCart, MessageSquareText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { MaterialRequest, RequestStatus, Cart } from '../types';
import { Alert, EmptyState, PageHeader } from '../components/ui';

const STATUS_META: Record<RequestStatus, { className: string; icon: React.FC<{ className?: string }> }> = {
  Pending: { className: 'badge-warning', icon: Clock },
  Approved: { className: 'badge-info', icon: CheckCircle2 },
  Completed: { className: 'badge-success', icon: CheckSquare },
};

export const MaterialRequests: React.FC = () => {
  const { isAdmin } = useAuth();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [activeCarts, setActiveCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('all');

  // New Request Form State
  const [material, setMaterial] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [note, setNote] = useState('');
  const [selectedCartId, setSelectedCartId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const [reqData, cartsData] = await Promise.all([
        api.getMaterialRequests(),
        api.getCarts({ status: 'ACTIVE' }),
      ]);
      setRequests(reqData);
      setActiveCarts(cartsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load material requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!material || !quantity || !unit) {
      setError('Material name, quantity, and unit are required.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedCart = activeCarts.find((c) => c.id === Number(selectedCartId));
      await api.createMaterialRequest({
        material,
        quantity: Number(quantity),
        unit,
        note,
        cart_id: selectedCart ? selectedCart.id : undefined,
        cart_number: selectedCart ? selectedCart.cart_number : undefined,
      });
      setSuccessMsg('Request sent to the owner.');
      setMaterial('');
      setQuantity('');
      setNote('');
      setSelectedCartId('');
      fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: RequestStatus) => {
    try {
      await api.updateMaterialRequestStatus(id, newStatus);
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };

  const counts = {
    all: requests.length,
    Pending: requests.filter((r) => r.status === 'Pending').length,
    Approved: requests.filter((r) => r.status === 'Approved').length,
    Completed: requests.filter((r) => r.status === 'Completed').length,
  };
  const visible = statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Catalog & stock"
        title="Material requests"
        description={
          isAdmin
            ? 'Requests from staff for flour, chocolate, toppings, cups and other supplies.'
            : 'Running low on something? Ask the owner and track the request here.'
        }
      />

      {error && <Alert tone="error">{error}</Alert>}
      {successMsg && <Alert tone="success">{successMsg}</Alert>}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* Request form */}
        <section className="card lg:sticky lg:top-4">
          <div className="card-header">
            <div>
              <h2 className="card-title">New request</h2>
              <p className="card-subtitle">The owner is notified straight away.</p>
            </div>
          </div>
          <form onSubmit={handleCreateRequest} className="card-body space-y-4">
            <div>
              <label className="label" htmlFor="req-material">Material</label>
              <input
                id="req-material"
                type="text"
                required
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="e.g. Dark chocolate"
                className="input"
              />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
              <div>
                <label className="label" htmlFor="req-qty">Quantity</label>
                <input
                  id="req-qty"
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="5"
                  className="input tabular-nums"
                />
              </div>
              <div>
                <label className="label" htmlFor="req-unit">Unit</label>
                <select id="req-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="select">
                  {['kg', 'packets', 'bottles', 'boxes', 'tubs', 'pcs', 'liters'].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="req-cart">For cart</label>
              <select id="req-cart" value={selectedCartId} onChange={(e) => setSelectedCartId(e.target.value)} className="select">
                <option value="">General stock</option>
                {activeCarts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cart_number} ({c.staff_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="req-note">Note</label>
              <textarea
                id="req-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Needed before the evening rush"
                className="input resize-none"
              />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              <Send className="h-4 w-4" />
              {submitting ? 'Sending…' : 'Send request'}
            </button>
          </form>
        </section>

        {/* Request list */}
        <section className="card overflow-hidden">
          <div className="card-header">
            <div>
              <h2 className="card-title">{isAdmin ? 'All requests' : 'My requests'}</h2>
              <p className="card-subtitle">Newest first</p>
            </div>
            <div className="segmented">
              {(['all', 'Pending', 'Approved', 'Completed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`segmented-item ${statusFilter === s ? 'segmented-item-active' : ''}`}
                >
                  {s === 'all' ? 'All' : s}
                  <span className="rounded bg-cream-200/80 px-1.5 text-2xs tabular-nums text-choco-500">{counts[s]}</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={PackageCheck}
              title={statusFilter === 'all' ? 'No requests yet' : `No ${statusFilter.toLowerCase()} requests`}
              description={statusFilter === 'all' ? 'Requests you send will be tracked here.' : 'Switch the filter to see others.'}
            />
          ) : (
            <ul className="divide-y divide-cream-200/70">
              {visible.map((req) => {
                const meta = STATUS_META[req.status];
                const StatusIcon = meta?.icon ?? Clock;
                return (
                  <li key={req.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-cream-50/60 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-choco-900">{req.material}</span>
                        <span className="badge-neutral tabular-nums">
                          {req.quantity} {req.unit}
                        </span>
                        {req.cart_number && (
                          <span className="badge-waffle">
                            <ShoppingCart className="h-3 w-3" /> {req.cart_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-choco-400">
                        {req.staff_name} ·{' '}
                        {new Date(req.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      </p>
                      {req.note && (
                        <p className="flex items-start gap-1.5 text-sm text-choco-500">
                          <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-choco-300" />
                          {req.note}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                      <span className={meta?.className ?? 'badge-neutral'}>
                        <StatusIcon className="h-3 w-3" /> {req.status}
                      </span>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          {req.status === 'Pending' && (
                            <button onClick={() => handleUpdateStatus(req.id, 'Approved')} className="btn-secondary btn-sm">
                              Approve
                            </button>
                          )}
                          {req.status !== 'Completed' && (
                            <button onClick={() => handleUpdateStatus(req.id, 'Completed')} className="btn-success btn-sm">
                              Mark delivered
                            </button>
                          )}
                          {req.status !== 'Pending' && (
                            <button onClick={() => handleUpdateStatus(req.id, 'Pending')} className="btn-ghost btn-sm">
                              Reopen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default MaterialRequests;
