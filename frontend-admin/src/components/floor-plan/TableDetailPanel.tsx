import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, MapPin, Users, Clock, ShoppingBag, CreditCard,
  Bell, AlertTriangle, QrCode, ArrowRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../../utils/cn';
import { STATUS_CONFIG, ORDER_STATUS_LABEL } from './TableNode';
import type { EnrichedTable } from '../../hooks/useFloorPlan';

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(date: string) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
  } catch {
    return '—';
  }
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface TableDetailPanelProps {
  table: EnrichedTable;
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TableDetailPanel({ table, onClose }: TableDetailPanelProps) {
  const navigate = useNavigate();
  const cfg = STATUS_CONFIG[table.liveStatus] ?? STATUS_CONFIG.free;
  const order = table.activeOrder;

  const alertLabels = {
    call_waiter: { label: 'Llamó al mozo', icon: <Bell size={14} /> },
    request_bill: { label: 'Pide la cuenta', icon: <CreditCard size={14} /> },
    assistance: { label: 'Necesita asistencia', icon: <AlertTriangle size={14} /> },
  };

  return (
    <aside className="flex flex-col h-full w-full bg-slate-900 border-l border-slate-700/60 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-slate-700/50">
        <div>
          <h2 className="text-white font-bold text-lg leading-tight">{table.name}</h2>
          {table.zone && (
            <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
              <MapPin size={11} /> {table.zone}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 px-4 py-3 space-y-4">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', cfg.bg, cfg.border, cfg.text)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
            {cfg.label}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Users size={12} /> {table.capacity} personas
          </span>
        </div>

        {/* Alert */}
        {table.hasAlert && table.alertType && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-500/15 border border-orange-500/40 rounded-lg">
            <span className="text-orange-400">{alertLabels[table.alertType]?.icon}</span>
            <span className="text-orange-300 text-sm font-medium">
              {alertLabels[table.alertType]?.label}
            </span>
            <span className="ml-auto w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          </div>
        )}

        {/* Active Order */}
        {order ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pedido activo</p>
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-white font-bold text-sm">#{order.orderNumber}</span>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  order.status === 'preparing' ? 'bg-amber-900/50 text-amber-300' :
                  order.status === 'ready' ? 'bg-emerald-900/50 text-emerald-300' :
                  order.status === 'pending_confirmation' ? 'bg-blue-900/50 text-blue-300' :
                  'bg-slate-700/50 text-slate-300'
                )}>
                  {ORDER_STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>
              <Row icon={<ShoppingBag size={13} />} label="Ítems" value={`${order.itemCount} productos`} />
              <Row icon={<CreditCard size={13} />} label="Total" value={`$${order.total.toFixed(2)}`} bold />
              <Row icon={<Clock size={13} />} label="Hace" value={timeAgo(order.createdAt)} />
            </div>
          </div>
        ) : (
          table.liveStatus === 'free' && (
            <p className="text-slate-600 text-sm text-center py-4">Mesa libre · sin pedido activo</p>
          )
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 pt-2 space-y-2 border-t border-slate-700/50">
        {order && (
          <ActionButton
            onClick={() => navigate('/pedidos')}
            icon={<ShoppingBag size={14} />}
            label="Ver pedidos live"
            variant="primary"
          />
        )}
        <ActionButton
          onClick={() => navigate('/mesas')}
          icon={<ArrowRight size={14} />}
          label="Gestionar mesa"
          variant="secondary"
        />
        <ActionButton
          onClick={() => navigate('/qr')}
          icon={<QrCode size={14} />}
          label="Ver códigos QR"
          variant="ghost"
        />
      </div>
    </aside>
  );
}

// ─── sub components ──────────────────────────────────────────────────────────

function Row({ icon, label, value, bold }: { icon: React.ReactNode; label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-slate-400">
        {icon} {label}
      </span>
      <span className={bold ? 'font-bold text-white' : 'text-slate-300'}>{value}</span>
    </div>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  variant,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant: 'primary' | 'secondary' | 'ghost';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        variant === 'primary' && 'bg-primary-600 text-white hover:bg-primary-700',
        variant === 'secondary' && 'bg-slate-700/60 text-slate-200 hover:bg-slate-700',
        variant === 'ghost' && 'text-slate-400 hover:text-white hover:bg-slate-800'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
