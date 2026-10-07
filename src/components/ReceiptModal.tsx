import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, Download, X } from 'lucide-react';
import { ReceiptData } from '../types';
import { useAuth } from '../context/AuthContext';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptData;
}

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const money = (value: number | undefined) => `₹${Number(value ?? 0).toFixed(2)}`;

function paymentLine(data: ReceiptData): string {
  if (data.paymentMethod === 'NOT_RECORDED') return 'Payment: not recorded';
  let line = `Payment: ${data.paymentMethod} (${data.paymentStatus})`;
  if (data.paymentRef) line += ` Ref ${data.paymentRef}`;
  return line;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, receiptData }) => {
  const { settings } = useAuth();
  if (!isOpen || !receiptData) return null;

  const businessName = settings?.business_name || 'Waffle Wisk';
  const footer = settings?.receipt_footer || 'Thank you for visiting!';
  const date = new Date(receiptData.date);
  const showCash = receiptData.paymentMethod === 'CASH' && receiptData.amountReceived !== undefined;

  const totals: Array<[string, string]> = [['Subtotal', money(receiptData.subtotal)]];
  if (receiptData.discount > 0) totals.push(['Discount', `-${money(receiptData.discount)}`]);
  totals.push([`GST${receiptData.taxPercent !== undefined ? ` (${receiptData.taxPercent}%)` : ''}`, money(receiptData.tax)]);

  const handlePrint = () => {
    const win = window.open('', '', 'width=400,height=600');
    if (!win) {
      alert('Please allow popups to print receipt');
      return;
    }

    const rows = receiptData.items
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.name)}</td><td class="c">${escapeHtml(item.qty)}</td><td class="r">${escapeHtml(money(item.total))}</td></tr>`
      )
      .join('');
    const totalRows = totals.map(([label, value]) => `<div class="row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`).join('');

    win.document.write(`
      <html>
        <head>
          <title>Receipt ${escapeHtml(receiptData.receiptNumber)}</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 15px; color: #000; }
            .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            th, td { text-align: left; padding: 3px 0; }
          </style>
        </head>
        <body>
          <div class="c b" style="font-size: 16px;">${escapeHtml(businessName.toUpperCase())}</div>
          ${settings?.address ? `<div class="c" style="font-size: 10px;">${escapeHtml(settings.address)}</div>` : ''}
          ${settings?.gstin ? `<div class="c" style="font-size: 10px;">GSTIN: ${escapeHtml(settings.gstin)}</div>` : ''}
          <div class="line"></div>
          <div>Receipt #: ${escapeHtml(receiptData.receiptNumber)}</div>
          <div>Order #: ${escapeHtml(receiptData.orderNumber)}</div>
          <div>Date: ${escapeHtml(date.toLocaleString())}</div>
          <div>Customer: ${escapeHtml(receiptData.customerName)}</div>
          <div>Staff: ${escapeHtml(receiptData.staffName)}</div>
          <div class="line"></div>
          <table>
            <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Amount</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="line"></div>
          ${totalRows}
          <div class="row b" style="font-size: 14px;"><span>TOTAL</span><span>${escapeHtml(money(receiptData.grandTotal))}</span></div>
          ${showCash ? `<div class="row"><span>Cash received</span><span>${escapeHtml(money(receiptData.amountReceived))}</span></div><div class="row"><span>Change</span><span>${escapeHtml(money(receiptData.changeReturned))}</span></div>` : ''}
          <div class="line"></div>
          <div class="c b" style="font-size: 10px;">${escapeHtml(paymentLine(receiptData))}</div>
          <div class="c" style="font-size: 9px; margin-top: 5px;">${escapeHtml(footer)}</div>
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
    const lines = [
      '========================================',
      businessName.toUpperCase(),
      '========================================',
      `Receipt #: ${receiptData.receiptNumber}`,
      `Order #: ${receiptData.orderNumber}`,
      `Date: ${date.toLocaleString()}`,
      `Customer: ${receiptData.customerName}`,
      `Staff: ${receiptData.staffName}`,
      '----------------------------------------',
      ...receiptData.items.map((i) => `${i.name.slice(0, 20).padEnd(20)} ${String(i.qty).padStart(3)}  ${money(i.total).padStart(12)}`),
      '----------------------------------------',
      ...totals.map(([label, value]) => `${label.padEnd(26)}${value.padStart(14)}`),
      `${'TOTAL'.padEnd(26)}${money(receiptData.grandTotal).padStart(14)}`,
      ...(showCash
        ? [`${'Cash received'.padEnd(26)}${money(receiptData.amountReceived).padStart(14)}`, `${'Change'.padEnd(26)}${money(receiptData.changeReturned).padStart(14)}`]
        : []),
      '----------------------------------------',
      paymentLine(receiptData),
      footer,
      '========================================',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${receiptData.receiptNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Receipt">
      <div className="fixed inset-0 bg-choco-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
        <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-cream-300/70 bg-cream-100 shadow-soft-lg animate-scale-in sm:my-8 sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-cream-200 bg-white px-6 py-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-choco-900">Receipt</h3>
              <p className="text-sm text-choco-400">{receiptData.receiptNumber}</p>
            </div>
            <button onClick={onClose} className="icon-btn -mr-2" aria-label="Close receipt">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[calc(100dvh-220px)] overflow-y-auto px-5 py-6 sm:px-8">
            <div className="relative space-y-3 rounded-xl bg-white p-6 font-mono text-xs text-choco-900 shadow-card">
              <div className="space-y-1 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-waffle-300 to-waffle-500 text-xl">🧇</div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-choco-900">{businessName}</h2>
                {settings?.address && <p className="font-sans text-2xs text-choco-400">{settings.address}</p>}
                {settings?.gstin && <p className="text-2xs text-choco-400">GSTIN {settings.gstin}</p>}
              </div>

              <div className="space-y-1 border-y border-dashed border-choco-200 py-2">
                <div className="flex justify-between">
                  <span className="text-choco-600">Order #:</span>
                  <span className="font-bold">{receiptData.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-choco-600">Date:</span>
                  <span>{date.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-choco-600">Customer:</span>
                  <span>{receiptData.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-choco-600">Staff:</span>
                  <span className="font-bold">{receiptData.staffName}</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="grid grid-cols-6 border-b border-cream-200 pb-1 font-semibold text-choco-500">
                  <span className="col-span-3">Item</span>
                  <span className="col-span-1 text-center">Qty</span>
                  <span className="col-span-2 text-right">Amount</span>
                </div>
                {receiptData.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-6 py-0.5">
                    <span className="col-span-3 truncate">{item.name}</span>
                    <span className="col-span-1 text-center font-bold">{item.qty}</span>
                    <span className="col-span-2 text-right font-bold">{money(item.total)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-t border-dashed border-choco-200 pt-2">
                {totals.map(([label, value]) => (
                  <div key={label} className="flex justify-between text-choco-500">
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-y border-dashed border-choco-200 py-2.5 text-sm font-semibold">
                <span>Total</span>
                <span className="font-display text-lg text-choco-900">{money(receiptData.grandTotal)}</span>
              </div>

              {showCash && (
                <div className="space-y-1 text-choco-700">
                  <div className="flex justify-between">
                    <span>Cash received</span>
                    <span>{money(receiptData.amountReceived)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Change</span>
                    <span>{money(receiptData.changeReturned)}</span>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-waffle-200 bg-waffle-50 p-2 text-center text-2xs font-semibold text-choco-600">
                {paymentLine(receiptData)}
              </div>
              <p className="text-center font-sans text-2xs text-choco-400">{footer}</p>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-cream-200 bg-white px-6 py-4">
            <button onClick={handlePrint} className="btn-dark">
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button onClick={handleDownloadText} className="btn-secondary">
              <Download className="h-4 w-4" />
              Download
            </button>
            <button onClick={onClose} className="btn-primary px-5">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReceiptModal;
