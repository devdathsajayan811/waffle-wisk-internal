import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'availability' | 'payment' | 'order' | 'stock' | 'role' | 'generic';
}

const LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  UNAVAILABLE: 'Unavailable',
  OUT_OF_STOCK: 'Out of stock',
  LOW_STOCK: 'Low stock',
  PAID: 'Paid',
  PENDING: 'Pending',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  COMPLETED: 'Completed',
  ACTIVE: 'Active',
  HOLD: 'On hold',
  ADMIN: 'Admin',
  STAFF: 'Staff',
  DISABLED: 'Disabled',
};

const resolveClass = (normalized: string, type: StatusBadgeProps['type']): string => {
  switch (type) {
    case 'availability':
      if (normalized === 'AVAILABLE') return 'badge-success';
      if (normalized === 'OUT_OF_STOCK') return 'badge-danger';
      return 'badge-warning';
    case 'payment':
      if (normalized === 'PAID') return 'badge-success';
      if (normalized === 'PENDING') return 'badge-warning';
      if (normalized === 'FAILED') return 'badge-danger';
      return 'badge-neutral';
    case 'order':
      if (normalized === 'COMPLETED') return 'badge-success';
      if (normalized === 'ACTIVE') return 'badge-waffle';
      if (normalized === 'HOLD') return 'badge-info';
      if (normalized === 'REFUNDED') return 'badge-neutral';
      return 'badge-danger';
    case 'role':
      return normalized === 'ADMIN' ? 'badge-waffle' : 'badge-neutral';
    case 'stock':
      if (normalized === 'LOW_STOCK' || normalized === 'LOW STOCK') return 'badge-warning';
      if (normalized === 'OUT_OF_STOCK') return 'badge-danger';
      return 'badge-success';
    default:
      return 'badge-neutral';
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'generic' }) => {
  const normalized = status.toUpperCase();
  return (
    <span className={resolveClass(normalized, type)}>
      <span className="dot opacity-70" />
      {LABELS[normalized] ?? status}
    </span>
  );
};
