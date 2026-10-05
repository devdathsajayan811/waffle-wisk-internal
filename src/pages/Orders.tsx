import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Printer,
  RotateCcw,
  Eye,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Order, ReceiptData } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { ReceiptModal } from '../components/ReceiptModal';
import { Modal } from '../components/Modal';

export const Orders: React.FC = () => {
  const { isAdmin, settings } = useAuth();
  const currency = settings?.currency_symbol || '₹';

  const [orders, setOrders] = useState<Order[]>([]);
  const [dateRange, setDateRange] = useState<string>('7days');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Selected Order Detail Modal
  const [detailOrder, setDetailOrder] = useState<any | null>(null);

  // Active Receipt Modal
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);
  const [activeReceiptData, setActiveReceiptData] = useState<ReceiptData | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await api.getOrders({
        date_range: dateRange,
        start_date: startDate,
        end_date: endDate,
        payment_method: paymentMethod,
        status: statusFilter,
        search: searchTerm,
      });
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch order history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [dateRange, startDate, endDate, paymentMethod, statusFilter, searchTerm]);

  const handleViewOrder = async (id: number) => {
    try {
      const res = await api.getOrder(id);
      setDetailOrder(res);
    } catch (err) {
      console.error('Failed to get order details:', err);
    }
  };

  const handleReprintReceipt = async (orderId: number) => {
    try {
      const res = await api.getOrder(orderId);
      if (res.receipt) {
        const parsed = JSON.parse(res.receipt.receipt_data_json);
        setActiveReceiptData(parsed);
        setReceiptModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to reprint receipt:', err);
    }
  };

  const handleRefund = async (orderId: number) => {
    if (!isAdmin) return;
    try {
      await api.refundOrder(orderId);
      fetchOrders();
      if (detailOrder && detailOrder.order.id === orderId) {
        setDetailOrder(null);
      }
    } catch (err) {
      console.error('Refund failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-choco-900">Order History</h2>
        <p className="text-xs text-choco-500">Filter, reprint receipts, inspect sales tickets, and issue refunds</p>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-cream-200 shadow-soft space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-choco-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Order #, guest name or phone..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400 bg-cream-50/30"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Range Presets */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden bg-white text-choco-800"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Date</option>
            </select>

            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden bg-white text-choco-800"
            >
              <option value="all">All Payment Methods</option>
              <option value="CASH">CASH</option>
              <option value="UPI">UPI</option>
              <option value="CARD">CARD</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden bg-white text-choco-800"
            >
              <option value="all">All Statuses</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="REFUNDED">REFUNDED</option>
            </select>
          </div>
        </div>

        {dateRange === 'custom' && (
          <div className="flex items-center space-x-2 pt-2 border-t border-cream-100 text-xs text-choco-700">
            <Calendar className="w-4 h-4 text-waffle-600" />
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 border border-cream-300 rounded-lg text-xs"
            />
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 border border-cream-300 rounded-lg text-xs"
            />
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cream-100/60 text-choco-700 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-3">Order ID</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Grand Total</th>
                <th className="px-6 py-3">Payment</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Staff</th>
                <th className="px-6 py-3">Date/Time</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 text-choco-900">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-choco-400">
                    Loading order history...
                  </td>
                </tr>
              ) : orders.length > 0 ? (
                orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-cream-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-bold font-mono text-waffle-700">{ord.order_number}</td>
                    <td className="px-6 py-3.5 font-medium">
                      <span className="block">{ord.customer_name}</span>
                      {ord.customer_phone && (
                        <span className="block text-[10px] text-choco-400">{ord.customer_phone}</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 font-extrabold text-choco-900">
                      {currency}{ord.grand_total}
                    </td>
                    <td className="px-6 py-3.5 font-medium">{ord.payment_method}</td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={ord.status} type="order" />
                    </td>
                    <td className="px-6 py-3.5 text-choco-600">{ord.staff_name}</td>
                    <td className="px-6 py-3.5 text-choco-500 text-[11px]">
                      {new Date(ord.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleViewOrder(ord.id)}
                          className="p-1.5 text-choco-600 hover:bg-cream-200 rounded-lg"
                          title="View Ticket"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReprintReceipt(ord.id)}
                          className="p-1.5 text-waffle-600 hover:bg-waffle-50 rounded-lg"
                          title="Reprint Receipt"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {isAdmin && ord.status !== 'REFUNDED' && (
                          <button
                            onClick={() => handleRefund(ord.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                            title="Refund Order"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-choco-400">
                    No orders match selected filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ORDER DETAILS MODAL */}
      {detailOrder && (
        <Modal isOpen={!!detailOrder} onClose={() => setDetailOrder(null)} title={`Order #${detailOrder.order.order_number}`} maxWidth="lg">
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-cream-50/70 rounded-xl border border-cream-200">
              <div>
                <span className="text-[10px] text-choco-400 uppercase tracking-wider block font-bold">Customer</span>
                <span className="font-bold text-choco-900">{detailOrder.order.customer_name}</span>
                {detailOrder.order.customer_phone && <span className="block text-[10px] text-choco-500">{detailOrder.order.customer_phone}</span>}
              </div>
              <div>
                <span className="text-[10px] text-choco-400 uppercase tracking-wider block font-bold">Staff / Cashier</span>
                <span className="font-bold text-choco-900">{detailOrder.order.staff_name}</span>
                <span className="block text-[10px] text-choco-500">{new Date(detailOrder.order.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="font-bold text-xs text-choco-900 uppercase tracking-wider mb-2">Order Line Items</h4>
              <div className="border border-cream-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-cream-100 text-choco-700 font-bold">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100">
                    {detailOrder.items.map((it: any) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 font-medium">{it.product_name}</td>
                        <td className="px-3 py-2 text-center">{it.quantity}</td>
                        <td className="px-3 py-2 text-right">{currency}{it.unit_price}</td>
                        <td className="px-3 py-2 text-right font-bold">{currency}{it.total_price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="p-3 bg-white rounded-xl border border-cream-200 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{currency}{detailOrder.order.subtotal}</span>
              </div>
              {detailOrder.order.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>-{currency}{detailOrder.order.discount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax (GST):</span>
                <span>{currency}{detailOrder.order.tax}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-choco-900 pt-1 border-t border-cream-200">
                <span>Grand Total:</span>
                <span>{currency}{detailOrder.order.grand_total}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => handleReprintReceipt(detailOrder.order.id)}
                className="px-4 py-2 bg-waffle-500 hover:bg-waffle-600 text-white font-bold rounded-xl flex items-center space-x-1"
              >
                <Printer className="w-4 h-4" />
                <span>Reprint Receipt</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* REPRINT RECEIPT MODAL */}
      {receiptModalOpen && activeReceiptData && (
        <ReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          receiptData={activeReceiptData}
        />
      )}
    </div>
  );
};
