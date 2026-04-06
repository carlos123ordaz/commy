import React, { memo } from 'react';
import { Bell, CreditCard, Users } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { TableStatus, NotificationType, OrderStatus } from '../../types';

// ─── Status config ──────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<
  TableStatus,
  { bg: string; border: string; text: string; label: string; dot: string }
> = {
  free: {
    bg: 'bg-emerald-900/40',
    border: 'border-emerald-500/60',
    text: 'text-emerald-300',
    label: 'Libre',
    dot: 'bg-emerald-400',
  },
  occupied: {
    bg: 'bg-blue-900/40',
    border: 'border-blue-500/60',
    text: 'text-blue-300',
    label: 'Ocupada',
    dot: 'bg-blue-400',
  },
  with_order: {
    bg: 'bg-amber-900/40',
    border: 'border-amber-500/60',
    text: 'text-amber-300',
    label: 'Con pedido',
    dot: 'bg-amber-400',
  },
  pending_payment: {
    bg: 'bg-red-900/40',
    border: 'border-red-500/60',
    text: 'text-red-300',
    label: 'Cobrar',
    dot: 'bg-red-400',
  },
  cleaning: {
    bg: 'bg-slate-800/60',
    border: 'border-slate-500/40',
    text: 'text-slate-400',
    label: 'Limpieza',
    dot: 'bg-slate-500',
  },
};

export const ORDER_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  draft: 'Borrador',
  pending_confirmation: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'En cocina',
  ready: 'Listo',
  served: 'Servido',
  billed: 'Cobrar',
};

// ─── Alert icon ─────────────────────────────────────────────────────────────

function AlertBadge({ type }: { type: NotificationType }) {
  const icons = {
    call_waiter: <Bell size={10} />,
    request_bill: <CreditCard size={10} />,
    assistance: <Users size={10} />,
  };
  return (
    <span className="absolute -top-2 -right-2 z-10 flex items-center justify-center w-5 h-5 bg-orange-500 rounded-full text-white animate-pulse shadow-lg shadow-orange-500/50">
      {icons[type]}
    </span>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface TableNodeProps {
  name: string;
  zone?: string;
  capacity: number;
  shape: 'rect' | 'rounded' | 'circle';
  status: TableStatus;
  hasAlert: boolean;
  alertType?: NotificationType;
  orderStatus?: OrderStatus;
  orderTotal?: number;
  selected: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  className?: string;
  // editor mode: no click-to-select UX
  editorMode?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const TableNode = memo(function TableNode({
  name,
  zone,
  capacity,
  shape,
  status,
  hasAlert,
  alertType,
  orderStatus,
  orderTotal,
  selected,
  onClick,
  style,
  className,
  editorMode = false,
}: TableNodeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.free;

  const borderRadius =
    shape === 'circle' ? '50%' : shape === 'rounded' ? '12px' : '6px';

  return (
    <div
      onClick={editorMode ? undefined : onClick}
      style={{ borderRadius, ...style }}
      className={cn(
        'relative flex flex-col items-center justify-center border-2 transition-all duration-200 cursor-pointer select-none overflow-visible',
        'w-full h-full',
        cfg.bg,
        cfg.border,
        selected && !editorMode && 'ring-2 ring-white/60 ring-offset-1 ring-offset-slate-900 scale-105',
        hasAlert && 'ring-2 ring-orange-500/80 ring-offset-1 ring-offset-slate-900',
        !editorMode && 'hover:brightness-125 hover:scale-105',
        editorMode && 'cursor-grab active:cursor-grabbing',
        className
      )}
    >
      {/* Alert badge */}
      {hasAlert && alertType && <AlertBadge type={alertType} />}

      {/* Status dot */}
      <span className={cn('absolute top-2 right-2 w-2 h-2 rounded-full', cfg.dot)} />

      {/* Table name */}
      <p className={cn('font-bold text-sm leading-tight text-center px-1 truncate max-w-full', cfg.text)}>
        {name}
      </p>

      {/* Zone */}
      {zone && (
        <p className="text-slate-500 text-[10px] leading-none mt-0.5 truncate max-w-full px-1">
          {zone}
        </p>
      )}

      {/* Order status or free status */}
      {orderStatus && ORDER_STATUS_LABEL[orderStatus] ? (
        <p className="text-[10px] leading-none mt-1 font-medium text-slate-300">
          {ORDER_STATUS_LABEL[orderStatus]}
        </p>
      ) : (
        <p className={cn('text-[10px] leading-none mt-1', cfg.text, 'opacity-70')}>
          {cfg.label}
        </p>
      )}

      {/* Total */}
      {orderTotal !== undefined && orderTotal > 0 && (
        <p className="text-[11px] font-semibold text-white mt-1">
          ${orderTotal.toFixed(0)}
        </p>
      )}

      {/* Capacity hint */}
      <p className="absolute bottom-1.5 left-2 text-[9px] text-slate-600 flex items-center gap-0.5">
        <Users size={8} />
        {capacity}
      </p>
    </div>
  );
});
