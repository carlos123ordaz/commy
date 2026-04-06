import React from 'react';
import { cn } from '../../utils/cn';
import type { OrderStatus, TableStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'gray';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
}) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    error: 'bg-red-50 text-red-700',
    info: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    gray: 'bg-gray-100 text-gray-600',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { label: string; variant: BadgeProps['variant'] }> = {
    draft: { label: 'Borrador', variant: 'gray' },
    pending_confirmation: { label: 'Pendiente', variant: 'warning' },
    confirmed: { label: 'Confirmado', variant: 'info' },
    preparing: { label: 'En preparación', variant: 'purple' },
    ready: { label: 'Listo', variant: 'success' },
    served: { label: 'Servido', variant: 'success' },
    billed: { label: 'Cobrado', variant: 'default' },
    closed: { label: 'Cerrado', variant: 'gray' },
    cancelled: { label: 'Cancelado', variant: 'error' },
  };
  const { label, variant } = config[status] || { label: status, variant: 'default' };
  return (
    <Badge variant={variant}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}

export function TableStatusBadge({ status }: { status: TableStatus }) {
  const config: Record<TableStatus, { label: string; variant: BadgeProps['variant'] }> = {
    free: { label: 'Libre', variant: 'success' },
    occupied: { label: 'Ocupada', variant: 'info' },
    with_order: { label: 'Con pedido', variant: 'warning' },
    pending_payment: { label: 'Pago pendiente', variant: 'error' },
    cleaning: { label: 'Limpieza', variant: 'gray' },
  };
  const { label, variant } = config[status] || { label: status, variant: 'default' };
  return (
    <Badge variant={variant}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
