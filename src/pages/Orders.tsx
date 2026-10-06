import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Search, Eye, PlayCircle, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Cart } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';

export const Orders: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'COMPLETED'>('all');

  // Selected Receipt Modal
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const fetchCarts = async () => {
    try {
      setLoading(true);
      const data = await api.getCarts({
        status: statusFilter === 'all' ? undefined : statusFilter,
        own_carts_only: !isAdmin,
      });
      setCarts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load carts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarts();
  }, [isAdmin, statusFilter]);

  const handleViewReceipt = async (cartId: number) => {
    try {
      const data = await api.getCart(cartId);
      if (data.receipt?.receipt_data_json) {
        setSelectedReceipt(JSON.parse(data.receipt.receipt_data_json));
        setReceiptModalOpen(true);
      } else {
        // Fallback receipt construction if completed without separate receipt object
        const items = data.items || [];
        const receiptData = {
          receiptNumber: `RCP-${data.id}`,
          orderNumber: data.cart_number,
          date: data.completed_at || data.created_at,
          customerName: data.customer_name || 'Walk-in Customer',
          items: items.map((i) => ({
            name: i.item_name_snapshot,
            qty: i.quantity,
            price: i.price_snapshot,
            total: i.subtotal,
          })),
          subtotal: data.total,
          discount: 0,
          tax: 0,
          grandTotal: data.total,
          paymentMethod: 'NOT_RECORDED',
          paymentStatus: 'COMPLETED',
          staffName: data.staff_name,
        };
        setSelectedReceipt(receiptData);
        setReceiptModalOpen(true);
      }
    } catch (err: any) {
      alert('Failed to load receipt: ' + err.message);
    }
  };

  const filteredCarts = carts.filter((c) => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;
    return (
      c.cart_number.toLowerCase().includes(query) ||
      c.staff_name.toLowerCase().includes(query) ||
      (c.items && c.items.some((i) => i.item_name_snapshot.toLowerCase().includes(query)))
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-cream-300 pb-4">
        <div>
          <h1 className="text-2xl font-black text-choco-900 flex items-center">
            <Receipt className="w-7 h-7 mr-2 text-waffle-500" />
            {isAdmin ? 'All Carts & Orders' : 'My Carts'}
          </h1>
          <p className="text-xs text-choco-600 font-medium">
            {isAdmin ? 'View and manage all active & completed carts across all staff.' : 'View your assigned active and completed carts.'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-cream-300 bg-white focus:ring-2 focus:ring-waffle-400"
          >
            <option value="all">All Carts</option>
            <option value="ACTIVE">Active Only</option>
            <option value="COMPLETED">Completed Only</option>
          </select>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-choco-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search cart # or item..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400 bg-white"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Carts List */}
      <div className="bg-white rounded-3xl p-6 border border-cream-300 shadow-soft">
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-choco-500">
            Loading carts list...
          </div>
        ) : filteredCarts.length === 0 ? (
          <div className="py-16 text-center text-xs text-choco-500 font-medium">
            No carts found.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCarts.map((cart) => {
              const isActive = cart.status === 'ACTIVE';

              return (
                <div
                  key={cart.id}
                  className="p-4 rounded-2xl bg-cream-50/60 border border-cream-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-waffle-300 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-choco-900 text-base">
                        {cart.cart_number}
                      </span>
                      <span
                        className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                          isActive
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {cart.status}
                      </span>
                      <span className="text-xs font-black text-emerald-600 ml-2">
                        Total: ₹{cart.total}
                      </span>
                    </div>

                    <div className="text-xs text-choco-600 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        <strong className="text-choco-800">Staff:</strong> {cart.staff_name}
                      </span>
                      <span>
                        <strong className="text-choco-800">Created:</strong>{' '}
                        {new Date(cart.created_at).toLocaleString()}
                      </span>
                      {cart.completed_at && (
                        <span>
                          <strong className="text-choco-800">Completed:</strong>{' '}
                          {new Date(cart.completed_at).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {cart.items && cart.items.length > 0 && (
                      <div className="text-xs text-choco-500 font-medium pt-1">
                        <strong>Items ({cart.itemCount || cart.items.length}):</strong>{' '}
                        {cart.items.map((i) => `${i.item_name_snapshot} (${i.quantity} × ₹${i.price_snapshot})`).join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 self-start sm:self-center flex items-center space-x-2">
                    {isActive ? (
                      <button
                        onClick={() => navigate(`/pos?cartId=${cart.id}`)}
                        className="px-3.5 py-2 bg-waffle-500 hover:bg-waffle-600 text-white font-extrabold text-xs rounded-xl shadow-waffle flex items-center space-x-1 transition-colors"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>OPEN CART</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleViewReceipt(cart.id)}
                        className="px-3.5 py-2 bg-waffle-50 hover:bg-waffle-100 text-waffle-800 font-extrabold text-xs rounded-xl border border-waffle-300 flex items-center space-x-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Receipt</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {receiptModalOpen && selectedReceipt && (
        <ReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          receiptData={selectedReceipt}
        />
      )}
    </div>
  );
};

export default Orders;
