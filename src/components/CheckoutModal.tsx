import React, { useEffect, useState } from 'react';
import { Banknote, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { Modal } from './Modal';
import { Alert } from './ui';
import { useAuth } from '../context/AuthContext';
import { CheckoutPayload, PaymentMethod } from '../types';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  submitting: boolean;
  error: string | null;
  onConfirm: (payload: CheckoutPayload) => void;
}

const METHODS: Array<{ id: PaymentMethod; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'UPI', label: 'UPI', icon: Smartphone },
  { id: 'CARD', label: 'Card', icon: CreditCard },
  { id: 'OTHER', label: 'Other', icon: Wallet },
];

const round = (value: number) => Math.round(value * 100) / 100;

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, subtotal, submitting, error, onConfirm }) => {
  const { settings } = useAuth();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [discount, setDiscount] = useState('');
  const [received, setReceived] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMethod('CASH');
      setDiscount('');
      setReceived('');
      setPaymentRef('');
      setCustomerName('');
      setCustomerPhone('');
    }
  }, [isOpen]);

  const gstPercent = Number(settings?.default_gst_percent ?? 5);
  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const tax = round(((subtotal - discountValue) * gstPercent) / 100);
  const total = round(subtotal - discountValue + tax);
  const receivedValue = received === '' ? total : Number(received);
  const change = method === 'CASH' ? round(receivedValue - total) : 0;
  const cashShort = method === 'CASH' && receivedValue < total;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cashShort) return;
    onConfirm({
      payment_method: method,
      discount: discountValue || undefined,
      amount_received: method === 'CASH' ? receivedValue : undefined,
      payment_ref: paymentRef.trim() || undefined,
      customer_name: customerName.trim() || undefined,
      customer_phone: customerPhone.trim() || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Collect payment" description="Choose how the customer is paying." maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="text-center">
          <p className="text-xs font-medium text-choco-400">Amount due</p>
          <p className="font-display text-4xl font-semibold tabular-nums tracking-tight text-choco-900">₹{total.toFixed(2)}</p>
        </div>

        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Payment method">
          {METHODS.map(({ id, label, icon: Icon }) => {
            const selected = method === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMethod(id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-semibold transition-all duration-200 ${
                  selected
                    ? 'border-choco-800 bg-choco-800 text-cream-50 shadow-soft'
                    : 'border-cream-300 bg-white text-choco-600 hover:border-cream-400 hover:bg-cream-50'
                }`}
              >
                <Icon className={`h-5 w-5 ${selected ? 'text-waffle-300' : 'text-choco-400'}`} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="co-discount">Discount (₹)</label>
            <input
              id="co-discount"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              placeholder="0"
              onChange={(e) => setDiscount(e.target.value)}
              className="input tabular-nums"
            />
          </div>
          {method === 'CASH' ? (
            <div>
              <label className="label" htmlFor="co-received">Cash received (₹)</label>
              <input
                id="co-received"
                type="number"
                min="0"
                step="0.01"
                value={received}
                placeholder={total.toFixed(2)}
                onChange={(e) => setReceived(e.target.value)}
                className="input tabular-nums"
              />
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="co-ref">Transaction ref</label>
              <input
                id="co-ref"
                type="text"
                maxLength={100}
                value={paymentRef}
                placeholder="Optional"
                onChange={(e) => setPaymentRef(e.target.value)}
                className="input"
              />
            </div>
          )}
          <div>
            <label className="label" htmlFor="co-name">Customer name</label>
            <input
              id="co-name"
              type="text"
              maxLength={100}
              value={customerName}
              placeholder="Walk-in customer"
              onChange={(e) => setCustomerName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="co-phone">Customer phone</label>
            <input
              id="co-phone"
              type="tel"
              maxLength={20}
              value={customerPhone}
              placeholder="Optional"
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <dl className="surface-muted space-y-2 p-4 text-sm tabular-nums">
          <div className="flex justify-between text-choco-500">
            <dt>Subtotal</dt>
            <dd>₹{subtotal.toFixed(2)}</dd>
          </div>
          {discountValue > 0 && (
            <div className="flex justify-between text-choco-500">
              <dt>Discount</dt>
              <dd>−₹{discountValue.toFixed(2)}</dd>
            </div>
          )}
          <div className="flex justify-between text-choco-500">
            <dt>GST ({gstPercent}%)</dt>
            <dd>₹{tax.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between border-t border-cream-300 pt-2 font-semibold text-choco-900">
            <dt>Total</dt>
            <dd>₹{total.toFixed(2)}</dd>
          </div>
          {method === 'CASH' && (
            <div className={`flex justify-between font-semibold ${cashShort ? 'text-rose-600' : 'text-emerald-700'}`}>
              <dt>{cashShort ? 'Short by' : 'Change to return'}</dt>
              <dd>₹{Math.abs(change).toFixed(2)}</dd>
            </div>
          )}
        </dl>

        {error && <Alert tone="error">{error}</Alert>}

        <button type="submit" disabled={submitting || cashShort} className="btn-primary btn-lg w-full">
          {submitting ? 'Completing…' : `Confirm ₹${total.toFixed(2)} and print receipt`}
        </button>
      </form>
    </Modal>
  );
};

export default CheckoutModal;
