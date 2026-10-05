import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Store, Receipt, AlertCircle, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettingsState } = useAuth();

  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [defaultGstPercent, setDefaultGstPercent] = useState<number>(5.0);
  const [lowStockThresholdDefault, setLowStockThresholdDefault] = useState<number>(5);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setBusinessName(settings.business_name || '');
      setLogoUrl(settings.logo_url || '');
      setAddress(settings.address || '');
      setPhone(settings.phone || '');
      setEmail(settings.email || '');
      setGstin(settings.gstin || '');
      setCurrencySymbol(settings.currency_symbol || '₹');
      setReceiptFooter(settings.receipt_footer || '');
      setDefaultGstPercent(settings.default_gst_percent !== undefined ? settings.default_gst_percent : 5.0);
      setLowStockThresholdDefault(settings.low_stock_threshold_default || 5);
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const updated = await api.updateSettings({
        business_name: businessName,
        logo_url: logoUrl,
        address,
        phone,
        email,
        gstin,
        currency_symbol: currencySymbol,
        receipt_footer: receiptFooter,
        default_gst_percent: defaultGstPercent,
        low_stock_threshold_default: lowStockThresholdDefault,
      });

      updateSettingsState(updated);
      setSuccess('Business settings updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-choco-900">Admin Portal Settings</h2>
        <p className="text-xs text-choco-500">Configure cart business identity, receipt format, tax rules, and POS defaults</p>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-2xl flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Business Identity */}
        <div className="bg-white p-6 rounded-2xl border border-cream-200 shadow-soft space-y-4">
          <h3 className="font-bold text-sm text-choco-900 flex items-center border-b border-cream-200 pb-3">
            <Store className="w-4 h-4 mr-2 text-waffle-600" /> Business Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">Business Name *</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">Logo Image URL</label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="/waffle_logo.png"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-choco-700 mb-1">Cart Address / Stall Location</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Stall #14, Food Street, City Center"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">GSTIN Number</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="27AABCT3518Q1ZB"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Tax & Receipt Settings */}
        <div className="bg-white p-6 rounded-2xl border border-cream-200 shadow-soft space-y-4">
          <h3 className="font-bold text-sm text-choco-900 flex items-center border-b border-cream-200 pb-3">
            <Receipt className="w-4 h-4 mr-2 text-waffle-600" /> Tax & Receipt Layout
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">Default GST Tax (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={defaultGstPercent}
                onChange={(e) => setDefaultGstPercent(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">Default Low-Stock Threshold</label>
              <input
                type="number"
                min="1"
                value={lowStockThresholdDefault}
                onChange={(e) => setLowStockThresholdDefault(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-choco-700 mb-1">Receipt Footer Message</label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              placeholder="Thank you for enjoying our freshly baked waffles! Visit us again soon."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-waffle-500 to-waffle-600 hover:from-waffle-600 hover:to-waffle-700 text-white font-bold text-xs rounded-xl shadow-waffle transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving Changes...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
