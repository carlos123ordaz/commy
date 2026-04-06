import React from 'react';
import { AlertTriangle, CheckCircle, Users, ShoppingBag } from 'lucide-react';
import { STATUS_CONFIG } from './TableNode';
import type { TableStatus } from '../../types';

interface FloorLegendProps {
  stats: { free: number; occupied: number; alerts: number; total: number };
}

const STATUS_ORDER: TableStatus[] = [
  'free',
  'occupied',
  'with_order',
  'pending_payment',
  'cleaning',
];

export function FloorLegend({ stats }: FloorLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 bg-slate-900/80 border-t border-slate-700/50 backdrop-blur-sm">
      {/* Stats */}
      <div className="flex items-center gap-4 mr-2">
        <Stat icon={<CheckCircle size={13} className="text-emerald-400" />} label="Libres" value={stats.free} color="text-emerald-400" />
        <Stat icon={<ShoppingBag size={13} className="text-amber-400" />} label="Ocupadas" value={stats.occupied} color="text-amber-400" />
        <Stat icon={<Users size={13} className="text-slate-400" />} label="Total" value={stats.total} color="text-slate-400" />
        {stats.alerts > 0 && (
          <Stat icon={<AlertTriangle size={13} className="text-orange-400 animate-pulse" />} label="Alertas" value={stats.alerts} color="text-orange-400" />
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-slate-700 hidden sm:block" />

      {/* Legend dots */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {STATUS_ORDER.map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              <span className="text-xs text-slate-400">{cfg.label}</span>
            </span>
          );
        })}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-xs text-slate-400">Alerta</span>
        </span>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {icon}
      <span className="text-xs text-slate-500">{label}:</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </span>
  );
}
