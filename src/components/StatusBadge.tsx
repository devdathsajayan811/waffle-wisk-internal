import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'availability' | 'payment' | 'order' | 'stock' | 'role' | 'generic';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'generic' }) => {
  let badgeStyle = 'bg-gray-100 text-gray-700 border-gray-200';

  const normalized = status.toUpperCase();

  if (type === 'availability') {
    if (normalized === 'AVAILABLE') {
      badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (normalized === 'OUT_OF_STOCK') {
      badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
    } else {
      badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
    }
  } else if (type === 'payment') {
    if (normalized === 'PAID') {
      badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (normalized === 'PENDING') {
      badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (normalized === 'FAILED') {
      badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (normalized === 'REFUNDED') {
      badgeStyle = 'bg-purple-50 text-purple-700 border-purple-200';
    }
  } else if (type === 'order') {
    if (normalized === 'COMPLETED') {
      badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (normalized === 'HOLD') {
      badgeStyle = 'bg-sky-50 text-sky-700 border-sky-200';
    } else if (normalized === 'REFUNDED') {
      badgeStyle = 'bg-purple-50 text-purple-700 border-purple-200';
    } else {
      badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
    }
  } else if (type === 'role') {
    if (normalized === 'ADMIN') {
      badgeStyle = 'bg-waffle-100 text-waffle-800 border-waffle-300 font-bold';
    } else {
      badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
    }
  } else if (type === 'stock') {
    if (normalized === 'LOW_STOCK' || normalized === 'LOW STOCK') {
      badgeStyle = 'bg-amber-100 text-amber-800 border-amber-300 font-bold animate-pulse';
    } else if (normalized === 'OUT_OF_STOCK') {
      badgeStyle = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
    } else {
      badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeStyle}`}
    >
      {status}
    </span>
  );
};
