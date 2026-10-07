import React, { useState, useEffect } from 'react';
import { Store, Receipt, Save, Globe2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Alert, PageHeader } from '../components/ui';

const Section: React.FC<{
  icon: React.FC<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, description, children }) => (
  <section className="grid grid-cols-1 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
    <div className="lg:pt-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-waffle-50 text-waffle-600 ring-1 ring-inset ring-waffle-200/70">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="font-display text-base font-semibold text-choco-900">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-choco-400">{description}</p>
    </div>
    <div className="card card-body space-y-4">{children}</div>
  </section>
);

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
  const [timezone, setTimezone] = useState('Asia/Kolkata');

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
      setTimezone(settings.timezone || 'Asia/Kolkata');
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
        timezone: timezone.trim(),
      });

      updateSettingsState(updated);
      setSuccess('Settings saved.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 animate-fade-up">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Your business identity, receipt layout, tax rules and POS defaults."
      />

      {success && <Alert tone="success">{success}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-8">
        <Section icon={Store} title="Business" description="Printed at the top of every receipt and shown in the sidebar.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="set-name">Business name</label>
              <input id="set-name" type="text" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="set-logo">Logo URL</label>
              <input
                id="set-logo"
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="/waffle_logo.png"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="set-address">Cart address</label>
            <input
              id="set-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Stall 14, Food Street, Bandra West"
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="set-phone">Phone</label>
              <input id="set-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="set-email">Email</label>
              <input id="set-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="set-gstin">GSTIN</label>
              <input
                id="set-gstin"
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="27AABCT3518Q1ZB"
                className="input font-mono text-[0.8125rem] uppercase"
              />
            </div>
          </div>
        </Section>

        <div className="h-px bg-cream-300/70" />

        <Section icon={Receipt} title="Tax & receipts" description="Applied at checkout. Changes affect new orders only.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="set-currency">Currency symbol</label>
              <input id="set-currency" type="text" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="set-gst">Default GST</label>
              <div className="relative">
                <input
                  id="set-gst"
                  type="number"
                  step="0.1"
                  min="0"
                  value={defaultGstPercent}
                  onChange={(e) => setDefaultGstPercent(Number(e.target.value))}
                  className="input pr-9 tabular-nums"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-choco-400">%</span>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="set-lowstock">Low-stock alert</label>
              <input
                id="set-lowstock"
                type="number"
                min="1"
                value={lowStockThresholdDefault}
                onChange={(e) => setLowStockThresholdDefault(Number(e.target.value))}
                className="input tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="set-footer">Receipt footer</label>
            <textarea
              id="set-footer"
              rows={2}
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              placeholder="Thanks for stopping by. See you again soon."
              className="input resize-none"
            />
          </div>
        </Section>

        <div className="h-px bg-cream-300/70" />

        <Section icon={Globe2} title="Region" description="Decides when “today” starts for sales totals and daily charts.">
          <div>
            <label className="label" htmlFor="set-timezone">Timezone</label>
            <input
              id="set-timezone"
              type="text"
              list="timezone-options"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Asia/Kolkata"
              className="input font-mono text-[0.8125rem] sm:max-w-xs"
            />
            <datalist id="timezone-options">
              {['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'].map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
            <p className="field-hint">IANA timezone name, for example Asia/Kolkata.</p>
          </div>
        </Section>

        <div className="sticky bottom-0 z-10 -mx-4 border-t border-cream-300/70 bg-cream-50/85 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <p className="hidden text-sm text-choco-400 sm:block">Changes apply to everyone as soon as you save.</p>
            <button type="submit" disabled={loading} className="btn-primary ml-auto">
              <Save className="h-4 w-4" />
              {loading ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
