import React, { useState, useEffect } from 'react';
import { PackageCheck, Clock, CheckCircle2, CheckSquare, PlusCircle, AlertCircle, ShoppingCart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { MaterialRequest, RequestStatus, Cart } from '../types';

export const MaterialRequests: React.FC = () => {
  const { isAdmin } = useAuth();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [activeCarts, setActiveCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
      setSuccessMsg('Raw material request sent to owner!');
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
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 mr-1" /> Pending
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-300">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approved
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckSquare className="w-3.5 h-3.5 mr-1" /> Completed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-cream-300 pb-4">
        <div>
          <h1 className="text-2xl font-black text-choco-900 flex items-center">
            <PackageCheck className="w-7 h-7 mr-2 text-waffle-500" />
            Raw Material Requests
          </h1>
          <p className="text-xs text-choco-600 font-medium">
            {isAdmin
              ? 'View and manage material requests submitted by staff members.'
              : 'Request required raw materials (flour, chocolate, toppings, cups, etc.) for your carts.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Staff Request Form */}
      <div className="bg-white rounded-3xl p-6 border border-cream-300 shadow-soft">
        <h2 className="text-base font-extrabold text-choco-900 mb-4 flex items-center">
          <PlusCircle className="w-5 h-5 mr-2 text-waffle-600" />
          Request Raw Material
        </h2>
        <form onSubmit={handleCreateRequest} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-choco-800 uppercase tracking-wider mb-1">
              Material Name *
            </label>
            <input
              type="text"
              required
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="e.g., Flour, Chocolate, Strawberries"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-choco-800 uppercase tracking-wider mb-1">
              Quantity *
            </label>
            <input
              type="number"
              step="any"
              min="0.1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g., 5"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-choco-800 uppercase tracking-wider mb-1">
              Unit *
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400 bg-white"
            >
              <option value="kg">kg</option>
              <option value="packets">packets</option>
              <option value="bottles">bottles</option>
              <option value="boxes">boxes</option>
              <option value="tubs">tubs</option>
              <option value="pcs">pcs</option>
              <option value="liters">liters</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-choco-800 uppercase tracking-wider mb-1">
              Link to Active Cart (Optional)
            </label>
            <select
              value={selectedCartId}
              onChange={(e) => setSelectedCartId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400 bg-white"
            >
              <option value="">General Request (No Cart)</option>
              {activeCarts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cart_number} ({c.staff_name})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-xs font-bold text-choco-800 uppercase tracking-wider mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Required for tomorrow morning"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="py-3 px-6 bg-waffle-500 hover:bg-waffle-600 text-white font-bold text-sm rounded-xl shadow-waffle transition-all disabled:opacity-60 flex items-center"
            >
              {submitting ? 'Sending...' : 'Send Request to Owner'}
            </button>
          </div>
        </form>
      </div>

      {/* Requests Table / Cards */}
      <div className="bg-white rounded-3xl p-6 border border-cream-300 shadow-soft">
        <h2 className="text-base font-extrabold text-choco-900 mb-4">
          {isAdmin ? 'All Staff Raw Material Requests' : 'My Requests Status'}
        </h2>

        {loading ? (
          <div className="py-12 text-center text-xs font-bold text-choco-500">
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center text-xs text-choco-500 font-medium">
            No material requests found.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl bg-cream-50/60 border border-cream-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-waffle-300 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-choco-900 text-base">
                      {req.material}
                    </span>
                    <span className="px-2 py-0.5 bg-waffle-100 text-waffle-800 text-xs font-bold rounded-md">
                      {req.quantity} {req.unit}
                    </span>
                    {req.cart_number && (
                      <span className="px-2 py-0.5 bg-cream-200 text-choco-800 text-xs font-bold rounded-md flex items-center">
                        <ShoppingCart className="w-3 h-3 mr-1 text-choco-600" /> #{req.cart_number}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-choco-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      <strong className="text-choco-800">Staff:</strong> {req.staff_name}
                    </span>
                    <span>
                      <strong className="text-choco-800">Date:</strong>{' '}
                      {new Date(req.created_at).toLocaleString()}
                    </span>
                  </div>

                  {req.note && (
                    <p className="text-xs italic text-choco-500 bg-white/80 p-2 rounded-lg border border-cream-200">
                      "{req.note}"
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-3 shrink-0 self-start sm:self-center">
                  <div>{getStatusBadge(req.status)}</div>

                  {/* Admin Status Actions */}
                  {isAdmin && (
                    <div className="flex items-center space-x-1">
                      {req.status !== 'Pending' && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'Pending')}
                          className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
                        >
                          Pending
                        </button>
                      )}
                      {req.status !== 'Approved' && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'Approved')}
                          className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                        >
                          Approve
                        </button>
                      )}
                      {req.status !== 'Completed' && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'Completed')}
                          className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MaterialRequests;
