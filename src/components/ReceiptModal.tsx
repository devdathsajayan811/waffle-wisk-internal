import React, { useRef } from 'react';
import { Modal } from './Modal';
import { Printer, Download, CheckCircle2, RotateCcw, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ReceiptData } from '../types';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptData;
  onNewOrder?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData,
  onNewOrder,
}) => {
  const { settings } = useAuth();
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt - ${receiptData.receiptNumber}</title>
            <style>
              body {
                font-family: 'Courier New', Courier, monospace;
                padding: 15px;
                max-width: 320px;
                margin: 0 auto;
                color: #000;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .bold { font-weight: bold; }
              .divider { border-top: 1px dashed #000; margin: 8px 0; }
              table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
              th, td { text-align: left; padding: 2px 0; }
              .footer { text-align: center; margin-top: 15px; font-size: 11px; }
            </style>
          </head>
          <body>
            ${content.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const currency = settings?.currency_symbol || '₹';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Order Receipt" maxWidth="md">
      <div className="space-y-6">
        {/* Success Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center space-x-3 text-emerald-800">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <h4 className="font-bold text-sm">Payment Confirmed & Order Created!</h4>
            <p className="text-xs text-emerald-600">Inventory automatically updated & receipt generated.</p>
          </div>
        </div>

        {/* Thermal Receipt Visual Preview Container */}
        <div
          ref={receiptRef}
          className="bg-white p-6 rounded-2xl border border-cream-300 shadow-inner font-mono text-xs text-choco-900 max-w-xs mx-auto"
        >
          {/* Header */}
          <div className="text-center space-y-1 mb-4">
            <div className="text-2xl mb-1">🧇</div>
            <h2 className="font-extrabold text-sm uppercase tracking-wider">{settings?.business_name || 'Waffle Wisk Cart'}</h2>
            <p className="text-[11px] text-gray-600">{settings?.address || 'Stall #14, Food Street'}</p>
            <p className="text-[11px] text-gray-600">Phone: {settings?.phone || '+91 98765 43210'}</p>
            {settings?.gstin && <p className="text-[11px] text-gray-600">GSTIN: {settings.gstin}</p>}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Order Details Meta */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span className="font-bold">{receiptData.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Order #:</span>
              <span>{receiptData.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date/Time:</span>
              <span>{new Date(receiptData.date).toLocaleString()}</span>
            </div>
            {receiptData.customerName && (
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{receiptData.customerName}</span>
              </div>
            )}
            {receiptData.customerPhone && (
              <div className="flex justify-between">
                <span>Phone:</span>
                <span>{receiptData.customerPhone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Staff:</span>
              <span>{receiptData.staffName}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Line Items Table */}
          <table className="w-full text-left text-[11px] my-2">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="py-1">Item</th>
                <th className="py-1 text-center">Qty</th>
                <th className="py-1 text-right">Price</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {receiptData.items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1 max-w-[110px] truncate">{item.name}</td>
                  <td className="py-1 text-center">{item.qty}</td>
                  <td className="py-1 text-right">{currency}{item.price}</td>
                  <td className="py-1 text-right font-semibold">{currency}{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Totals Breakdown */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{currency}{receiptData.subtotal.toFixed(2)}</span>
            </div>
            {receiptData.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span>-{currency}{receiptData.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tax (GST):</span>
              <span>{currency}{receiptData.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-choco-900 border-t border-b border-gray-800 py-1 my-1">
              <span>GRAND TOTAL:</span>
              <span>{currency}{receiptData.grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span>Payment Mode:</span>
              <span className="font-bold">{receiptData.paymentMethod} ({receiptData.paymentStatus})</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 my-3" />

          {/* Footer Thank-you message */}
          <div className="text-center text-[10px] text-gray-600 space-y-1">
            <p className="font-semibold text-choco-800">
              {settings?.receipt_footer || 'Thank you for enjoying our waffles! Visit us again.'}
            </p>
            <p>*** Have a delicious day! ***</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-cream-200">
          <div className="flex space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center px-4 py-2.5 bg-choco-700 hover:bg-choco-800 text-cream-50 text-xs font-semibold rounded-xl shadow-soft transition-colors"
            >
              <Printer className="w-4 h-4 mr-2 text-waffle-400" />
              Print Receipt
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center px-4 py-2.5 bg-cream-200 hover:bg-cream-300 text-choco-800 text-xs font-semibold rounded-xl border border-cream-300 transition-colors"
            >
              <Download className="w-4 h-4 mr-2 text-choco-600" />
              Save PDF
            </button>
          </div>

          <div className="flex space-x-2">
            {onNewOrder ? (
              <button
                onClick={() => {
                  onClose();
                  onNewOrder();
                }}
                className="flex items-center px-5 py-2.5 bg-waffle-500 hover:bg-waffle-600 text-white text-xs font-bold rounded-xl shadow-waffle transition-all"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Order
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-cream-200 hover:bg-cream-300 text-choco-800 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
