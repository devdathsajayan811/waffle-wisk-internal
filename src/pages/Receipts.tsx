import React, { useState, useEffect } from 'react';
import { Printer, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Receipt, ReceiptData } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { ReceiptModal } from '../components/ReceiptModal';
import { EmptyState, PageHeader, SearchInput, SkeletonCards, formatMoney } from '../components/ui';

export const Receipts: React.FC = () => {
  const { settings } = useAuth();
  const currency = settings?.currency_symbol || '₹';

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Active Receipt Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [activeReceiptData, setActiveReceiptData] = useState<ReceiptData | null>(null);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const data = await api.getReceipts({
        search: searchTerm,
        payment_method: paymentMethodFilter,
      });
      setReceipts(data);
    } catch (err) {
      console.error('Failed to fetch receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [searchTerm, paymentMethodFilter]);

  const handleOpenReceipt = (r: Receipt) => {
    if (r.receipt_data) {
      setActiveReceiptData(r.receipt_data);
      setModalOpen(true);
    }
  };

  const methods = [
    { id: 'all', label: 'All' },
    { id: 'CASH', label: 'Cash' },
    { id: 'UPI', label: 'UPI' },
    { id: 'CARD', label: 'Card' },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations"
        title="Receipts"
        description="Find any issued receipt by number, order or customer, and reprint it."
      />

      <div className="toolbar">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Receipt #, order # or customer phone"
          className="md:w-80"
        />
        <div className="segmented">
          {methods.map((m) => (
            <button
              key={m.id}
              onClick={() => setPaymentMethodFilter(m.id)}
              className={`segmented-item ${paymentMethodFilter === m.id ? 'segmented-item-active' : ''}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={6} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" itemClassName="h-48" />
      ) : receipts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileText}
            title={searchTerm ? 'No receipts match your search' : 'No receipts issued yet'}
            description={searchTerm ? 'Check the number and try again.' : 'Receipts are created when a cart is checked out.'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {receipts.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleOpenReceipt(r)}
              className="card-interactive group flex flex-col overflow-hidden text-left"
            >
              <div className="flex items-start justify-between gap-3 p-5 pb-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-medium text-waffle-700">{r.receipt_number}</p>
                  <p className="mt-1 truncate font-display text-base font-semibold text-choco-900">
                    {r.customer_name || 'Walk-in customer'}
                  </p>
                  <p className="text-xs text-choco-400">Order {r.order_number}</p>
                </div>
                <StatusBadge status={r.payment_status} type="payment" />
              </div>

              <div className="relative mx-5 border-t border-dashed border-cream-300">
                <span className="absolute -left-7 -top-2 h-4 w-4 rounded-full border border-cream-300/70 bg-cream-100" />
                <span className="absolute -right-7 -top-2 h-4 w-4 rounded-full border border-cream-300/70 bg-cream-100" />
              </div>

              <div className="mt-auto flex items-end justify-between gap-3 p-5 pt-4">
                <div>
                  <p className="text-2xs text-choco-400">
                    {new Date(r.created_at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="font-display text-xl font-semibold tabular-nums text-choco-900">
                    {currency}
                    {formatMoney(r.grand_total, '')}
                  </p>
                </div>
                <span className="btn-secondary btn-sm group-hover:border-waffle-300 group-hover:text-waffle-700">
                  <Printer className="h-3.5 w-3.5" />
                  Reprint
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* RECEIPT MODAL */}
      {modalOpen && activeReceiptData && (
        <ReceiptModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          receiptData={activeReceiptData}
        />
      )}
    </div>
  );
};
