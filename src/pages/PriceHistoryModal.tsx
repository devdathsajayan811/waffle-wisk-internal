import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { History, TrendingUp, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { Product, PriceHistory } from '../types';
import { useAuth } from '../context/AuthContext';

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onUpdated: () => void;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  isOpen,
  onClose,
  product,
  onUpdated,
}) => {
  const { settings } = useAuth();
  const currency = settings?.currency_symbol || '₹';

  const [newPrice, setNewPrice] = useState<number | ''>(product.price);
  const [discountPrice, setDiscountPrice] = useState<number | ''>(product.discount_price || '');
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await api.getProduct(product.id);
      setHistory(res.priceHistory);
    } catch (err) {
      console.error('Failed to fetch price history:', err);
    }
  };

  useEffect(() => {
    if (product) {
      setNewPrice(product.price);
      setDiscountPrice(product.discount_price || '');
      fetchHistory();
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPrice === '' || Number(newPrice) < 0) {
      setError('Please provide a valid non-negative price');
      return;
    }

    if (Number(newPrice) === product.price && (discountPrice === (product.discount_price || ''))) {
      setError('Price has not been changed.');
      return;
    }

    setLoading(true);

    try {
      await api.updateProductPrice(
        product.id,
        Number(newPrice),
        discountPrice !== '' ? Number(discountPrice) : null
      );
      onUpdated();
      fetchHistory();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update price');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Price Management: ${product.name}`} maxWidth="lg">
      <div className="space-y-6">
        {/* Current Price Banner */}
        <div className="bg-cream-50/80 border border-cream-200 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-choco-500 uppercase tracking-wider block">Current Base Price</span>
            <span className="text-2xl font-extrabold text-choco-900">{currency}{product.price}</span>
            {product.discount_price && (
              <span className="ml-2 text-xs font-bold text-waffle-600 bg-waffle-50 px-2 py-0.5 rounded-md border border-waffle-200">
                Offer: {currency}{product.discount_price}
              </span>
            )}
          </div>
          <div className="w-10 h-10 rounded-2xl bg-waffle-100 text-waffle-700 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Update Price Form */}
        <form onSubmit={handleSubmit} className="p-4 bg-white rounded-2xl border border-cream-200 space-y-4">
          <h4 className="font-bold text-xs text-choco-900 uppercase tracking-wider">Update Price Record</h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">New Base Price ({currency}) *</label>
              <input
                type="number"
                min="0"
                required
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm font-bold rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">Discount Price ({currency})</label>
              <input
                type="number"
                min="0"
                value={discountPrice}
                onChange={(e) => setDiscountPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Optional offer price"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-waffle-500 hover:bg-waffle-600 text-white text-xs font-bold rounded-xl shadow-waffle transition-colors disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Update & Log Price Change'}
            </button>
          </div>
        </form>

        {/* Price History Timeline */}
        <div>
          <h4 className="font-bold text-xs text-choco-900 uppercase tracking-wider mb-3 flex items-center">
            <History className="w-4 h-4 mr-1.5 text-waffle-600" /> Audit Price History Log
          </h4>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.length > 0 ? (
              history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-cream-50/50 rounded-xl border border-cream-200 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-choco-900">
                      {currency}{item.old_price} → {currency}{item.new_price}
                    </span>
                    <p className="text-[10px] text-choco-500">Updated by {item.updated_by_name}</p>
                  </div>
                  <span className="text-[11px] text-choco-400 font-mono">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-choco-400 py-4 text-center">No price updates recorded for this item yet.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
