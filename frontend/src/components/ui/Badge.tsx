import React from 'react';
import type { EmailStatus } from '../../types';

export interface BadgeProps {
  status?: EmailStatus;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
  children?: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  variant,
  size = 'md',
  children,
  className = '',
  dot = true,
}) => {
  // Determine variant from status if provided
  let resolvedVariant = variant || 'neutral';
  let label = children;

  if (status) {
    switch (status) {
      case 'scheduled':
        resolvedVariant = 'primary';
        label = label || 'Scheduled';
        break;
      case 'sent':
        resolvedVariant = 'success';
        label = label || 'Sent';
        break;
      case 'failed':
        resolvedVariant = 'danger';
        label = label || 'Failed';
        break;
      case 'cancelled':
        resolvedVariant = 'neutral';
        label = label || 'Cancelled';
        break;
    }
  }

  const variantStyles = {
    primary: {
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/60 ring-indigo-500/10',
      dot: 'bg-indigo-500',
    },
    success: {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 ring-emerald-500/10',
      dot: 'bg-emerald-500',
    },
    warning: {
      badge: 'bg-amber-50 text-amber-700 border-amber-200/60 ring-amber-500/10',
      dot: 'bg-amber-500',
    },
    danger: {
      badge: 'bg-rose-50 text-rose-700 border-rose-200/60 ring-rose-500/10',
      dot: 'bg-rose-500',
    },
    neutral: {
      badge: 'bg-slate-100 text-slate-700 border-slate-200 ring-slate-500/10',
      dot: 'bg-slate-400',
    },
  }[resolvedVariant];

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ring-1 ring-inset capitalize select-none ${sizeStyles} ${variantStyles.badge} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${variantStyles.dot}`} />}
      {label}
    </span>
  );
};
