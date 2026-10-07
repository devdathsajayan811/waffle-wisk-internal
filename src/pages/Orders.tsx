import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Eye, Plus, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Cart, ReceiptData } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';
import { StatusBadge } from '../components/StatusBadge';
import { Alert, EmptyState, PageHeader, SearchInput, SkeletonRows, formatMoney } from '../components/ui';

export const Orders: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'COMPLETED'>('all');

  // Selected Receipt Modal
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
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
        // Legacy carts completed before receipts were linked to orders
        const items = data.items || [];
        const receiptData: ReceiptData = {
          receiptNumber: 'NOT ISSUED',
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
      setError('Could not load the receipt: ' + err.message);
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

  const filters: Array<{ id: typeof statusFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'ACTIVE', label: 'Active' },
    { id: 'COMPLETED', label: 'Completed' },
  ];

  const formatDate = (value: string) =>
    new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations"
        title={isAdmin ? 'Orders' : 'My carts'}
        description={
          isAdmin
            ? 'Every active and completed cart across the team.'
            : 'Carts you have opened, in progress and completed.'
        }
        actions={
          <button onClick={() => navigate('/pos')} className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New order
          </button>
        }
      />

      <div className="toolbar">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search cart number, staff or item" className="md:w-80" />
        <div className="segmented">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`segmented-item ${statusFilter === f.id ? 'segmented-item-active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="card overflow-hidden">
        {!loading && filteredCarts.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={searchTerm ? 'No carts match your search' : 'No carts yet'}
            description={searchTerm ? 'Try a different cart number, staff name or item.' : 'Carts appear here as soon as someone starts an order.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cart</th>
                  <th className="hidden md:table-cell">Staff</th>
                  <th>Status</th>
                  <th className="hidden lg:table-cell">Created</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={6} />
                ) : (
                  filteredCarts.map((cart) => {
                    const isActive = cart.status === 'ACTIVE';
                    const itemSummary = cart.items?.map((i) => `${i.item_name_snapshot} × ${i.quantity}`).join(', ');
                    return (
                      <tr key={cart.id}>
                        <td className="max-w-xs">
                          <p className="font-semibold text-choco-900">{cart.cart_number}</p>
                          <p className="truncate text-xs text-choco-400" title={itemSummary}>
                            {itemSummary || `${cart.itemCount || 0} items`}
                          </p>
                        </td>
                        <td className="hidden md:table-cell">{cart.staff_name}</td>
                        <td>
                          <StatusBadge status={cart.status} type="order" />
                        </td>
                        <td className="hidden whitespace-nowrap text-xs text-choco-400 lg:table-cell">
                          {formatDate(cart.created_at)}
                          {cart.completed_at && <span className="block">Closed {formatDate(cart.completed_at)}</span>}
                        </td>
                        <td className="text-right font-semibold tabular-nums text-choco-900">
                          {formatMoney(cart.total)}
                        </td>
                        <td className="text-right">
                          {isActive ? (
                            <button onClick={() => navigate(`/pos?cartId=${cart.id}`)} className="btn-soft btn-sm">
                              Open <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button onClick={() => handleViewReceipt(cart.id)} className="btn-secondary btn-sm">
                              <Eye className="h-3.5 w-3.5" /> Receipt
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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
