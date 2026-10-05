import React, { useState, useEffect } from 'react';
import { Search, Printer, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Receipt, ReceiptData } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { ReceiptModal } from '../components/ReceiptModal';

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-choco-900">Receipts Archive</h2>
        <p className="text-xs text-choco-500">Search and reprint issued customer tickets and tax receipts</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-cream-200 shadow-soft flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-choco-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Receipt #, Order # or customer phone..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400 bg-cream-50/30"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden bg-white text-choco-800"
          >
            <option value="all">All Payment Methods</option>
            <option value="CASH">CASH</option>
            <option value="UPI">UPI</option>
            <option value="CARD">CARD</option>
          </select>
        </div>
      </div>

      {/* Receipts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-choco-400">
            Loading receipts...
          </div>
        ) : receipts.length > 0 ? (
          receipts.map((r) => (
            <div
              key={r.id}
              onClick={() => handleOpenReceipt(r)}
              className="bg-white p-5 rounded-2xl border border-cream-200 shadow-soft hover:shadow-md hover:border-waffle-300 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs font-mono text-waffle-700 bg-waffle-50 px-2.5 py-1 rounded-lg border border-waffle-200">
                    {r.receipt_number}
                  </span>
                  <StatusBadge status={r.payment_status} type="payment" />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-choco-500">Order ID:</span>
                    <span className="font-bold text-choco-900">{r.order_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-choco-500">Customer:</span>
                    <span className="font-medium text-choco-900">{r.customer_name || 'Walk-in Guest'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-choco-500">Date:</span>
                    <span className="text-choco-500 text-[11px]">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-cream-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-choco-400 uppercase tracking-wider block font-bold">Total</span>
                  <span className="text-base font-extrabold text-choco-900">
                    {currency}{r.grand_total}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenReceipt(r);
                  }}
                  className="px-3 py-1.5 bg-waffle-500 hover:bg-waffle-600 text-white text-xs font-bold rounded-xl flex items-center space-x-1 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  <span>Reprint</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-xs text-choco-400">
            No receipts found matching search.
          </div>
        )}
      </div>

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
