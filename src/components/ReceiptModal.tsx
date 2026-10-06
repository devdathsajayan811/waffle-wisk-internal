import React, { useRef } from 'react';
import { Printer, Download, Plus, X } from 'lucide-react';
import { ReceiptData } from '../types';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptData;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, receiptData }) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !receiptData) return null;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const win = window.open('', '', 'width=400,height=600');
    if (!win) {
      alert('Please allow popups to print receipt');
      return;
    }

    win.document.write(`
      <html>
        <head>
          <title>Waffle Wisk Receipt - ${receiptData.receiptNumber}</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 15px; color: #000; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            th, td { text-align: left; padding: 3px 0; }
          </style>
        </head>
        <body>
          <div class="text-center bold" style="font-size: 16px;">WAFFLE WISK</div>
          <div class="text-center" style="font-size: 10px;">CART ORDER RECEIPT</div>
          <div class="line"></div>
          <div>Receipt #: ${receiptData.receiptNumber}</div>
          <div>Order #: ${receiptData.orderNumber}</div>
          <div>Date: ${new Date(receiptData.date).toLocaleDateString()}</div>
          <div>Time: ${new Date(receiptData.date).toLocaleTimeString()}</div>
          <div>Staff: ${receiptData.staffName}</div>
          <div class="line"></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              ${receiptData.items
                .map(
                  (item) => `
                <tr>
                  <td>${item.name}</td>
                  <td class="text-center">${item.qty}</td>
                  <td class="text-right">₹${item.total}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <div class="line"></div>
          <div class="text-right bold" style="font-size: 14px;">TOTAL: ₹${receiptData.grandTotal}</div>
          <div class="line"></div>
          <div class="text-center bold" style="font-size: 10px; margin-top: 10px;">Payment: NOT REQUIRED / NOT RECORDED</div>
          <div class="text-center" style="font-size: 9px; margin-top: 5px;">Thank you for visiting Waffle Wisk!</div>
        </body>
      </html>
    `);

    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 250);
  };

  const handleDownloadText = () => {
    const text = `
========================================
             WAFFLE WISK
         CART ORDER RECEIPT
========================================
Receipt #: ${receiptData.receiptNumber}
Order #: ${receiptData.orderNumber}
Date: ${new Date(receiptData.date).toLocaleDateString()}
Time: ${new Date(receiptData.date).toLocaleTimeString()}
Staff: ${receiptData.staffName}
----------------------------------------
Item                 Qty      Price
----------------------------------------
${receiptData.items.map((i) => `${i.name.padEnd(20)} ${i.qty.toString().padStart(3)}     ₹${i.total}`).join('\n')}
----------------------------------------
TOTAL:                        ₹${receiptData.grandTotal}
----------------------------------------
Payment: NOT REQUIRED / NOT RECORDED
Thank you for visiting Waffle Wisk!
========================================
    `;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${receiptData.receiptNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-choco-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative border border-cream-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-choco-400 hover:text-choco-700 p-1 rounded-xl hover:bg-cream-100"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Printable Paper View */}
        <div
          ref={printRef}
          className="bg-cream-50 p-6 rounded-2xl border border-cream-200 font-mono text-xs text-choco-900 space-y-3"
        >
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black font-sans tracking-wide text-choco-900">
              WAFFLE WISK
            </h2>
            <p className="text-[10px] font-bold text-choco-500 uppercase tracking-widest">
              Cart Order Receipt
            </p>
          </div>

          <div className="border-t border-b border-dashed border-choco-300 py-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-choco-600">Receipt #:</span>
              <span className="font-bold">{receiptData.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-choco-600">Date:</span>
              <span>{new Date(receiptData.date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-choco-600">Time:</span>
              <span>{new Date(receiptData.date).toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-choco-600">Staff:</span>
              <span className="font-bold">{receiptData.staffName}</span>
            </div>
          </div>

          {/* Items Breakdown */}
          <div className="space-y-1.5 pt-1">
            <div className="grid grid-cols-6 font-bold border-b border-cream-300 pb-1 text-choco-700">
              <span className="col-span-3">Item</span>
              <span className="col-span-1 text-center">Qty</span>
              <span className="col-span-2 text-right">Price</span>
            </div>
            {receiptData.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-6 py-0.5">
                <span className="col-span-3 truncate">{item.name}</span>
                <span className="col-span-1 text-center font-bold">{item.qty}</span>
                <span className="col-span-2 text-right font-bold">₹{item.total}</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t border-b border-dashed border-choco-300 py-2.5 flex items-center justify-between text-sm font-black">
            <span>TOTAL:</span>
            <span className="text-emerald-700 text-base">₹{receiptData.grandTotal}</span>
          </div>

          {/* Payment Notice */}
          <div className="text-center text-[11px] font-bold text-choco-600 bg-amber-50 p-2 rounded-xl border border-amber-200">
            Payment: NOT REQUIRED / NOT RECORDED
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <button
            onClick={handlePrint}
            className="py-3 px-3 bg-choco-800 hover:bg-choco-900 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>

          <button
            onClick={handleDownloadText}
            className="py-3 px-3 bg-cream-200 hover:bg-cream-300 text-choco-900 font-bold text-xs rounded-xl flex items-center justify-center space-x-1 transition-colors border border-cream-300"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>

          <button
            onClick={onClose}
            className="py-3 px-3 bg-waffle-500 hover:bg-waffle-600 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1 transition-colors shadow-waffle"
          >
            <Plus className="w-4 h-4" />
            <span>New Cart</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
