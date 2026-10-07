import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Search, LucideIcon } from 'lucide-react';

export const formatMoney = (value: number | string, currency = '₹') => {
  const n = Number(value) || 0;
  const digits = Number.isInteger(n) ? 0 : 2;
  return `${currency}${n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`;
};

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, description, actions }) => (
  <div className="page-header">
    <div className="min-w-0">
      {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
      <h1 className="page-title">{title}</h1>
      {description && <p className="page-subtitle">{description}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

type Tone = 'waffle' | 'choco' | 'emerald' | 'rose' | 'amber' | 'sky';

const toneStyles: Record<Tone, { icon: string; value: string }> = {
  waffle: { icon: 'bg-waffle-50 text-waffle-600 ring-waffle-200/70', value: 'text-choco-900' },
  choco: { icon: 'bg-cream-200 text-choco-600 ring-cream-300', value: 'text-choco-900' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600 ring-emerald-200/70', value: 'text-choco-900' },
  rose: { icon: 'bg-rose-50 text-rose-600 ring-rose-200/70', value: 'text-rose-700' },
  amber: { icon: 'bg-amber-50 text-amber-600 ring-amber-200/70', value: 'text-choco-900' },
  sky: { icon: 'bg-sky-50 text-sky-600 ring-sky-200/70', value: 'text-choco-900' },
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  hint?: React.ReactNode;
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, tone = 'waffle', hint, loading }) => {
  const styles = toneStyles[tone];
  return (
    <div className="card relative overflow-hidden p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-choco-400">{label}</p>
          {loading ? (
            <div className="skeleton mt-2.5 h-8 w-24" />
          ) : (
            <p className={`mt-1.5 truncate font-display text-2xl font-semibold leading-none tracking-tight tabular-nums sm:text-[1.875rem] ${styles.value}`}>
              {value}
            </p>
          )}
          {hint && <p className="mt-2 truncate text-2xs text-choco-400">{hint}</p>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset sm:h-10 sm:w-10 ${styles.icon}`}>
          <Icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
};

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, compact }) => (
  <div className={`flex flex-col items-center justify-center text-center ${compact ? 'px-6 py-10' : 'px-6 py-16'}`}>
    <div className="relative mb-4">
      <div className="absolute inset-0 -m-3 rounded-full bg-waffle-200/30 blur-xl" />
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-cream-300 bg-white text-waffle-500 shadow-soft">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
    </div>
    <p className="font-display text-base font-semibold text-choco-900">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-choco-400">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

interface AlertProps {
  tone: 'error' | 'success' | 'warning';
  children: React.ReactNode;
  className?: string;
}

const alertIcons = { error: AlertCircle, success: CheckCircle2, warning: AlertTriangle };

export const Alert: React.FC<AlertProps> = ({ tone, children, className = '' }) => {
  const Icon = alertIcons[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`alert-${tone} ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
};

export const SkeletonRows: React.FC<{ rows?: number; cols: number }> = ({ rows = 5, cols }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r} className="hover:bg-transparent">
        {Array.from({ length: cols }).map((__, c) => (
          <td key={c}>
            <div className="skeleton h-4" style={{ width: `${c === 0 ? 70 : 40 + ((r * 7 + c * 13) % 45)}%` }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const SkeletonCards: React.FC<{ count?: number; className?: string; itemClassName?: string }> = ({
  count = 6,
  className = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
  itemClassName = 'h-40',
}) => (
  <div className={className}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`skeleton rounded-2xl ${itemClassName}`} />
    ))}
  </div>
);

export const SearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}> = ({ value, onChange, placeholder, className = '' }) => (
  <div className={`relative ${className}`}>
    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-choco-300" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input input-sm pl-10"
    />
  </div>
);
