import React, { useEffect, useState } from 'react';
import {
  ShoppingBag, DollarSign, TrendingUp, Clock, CheckCircle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard } from '../../components/shared/StatCard';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { api } from '../../config/api';
import { useAuthStore } from '../../store/authStore';
import { useSocketStore } from '../../store/socketStore';
import type { DashboardStats, Order, Table } from '../../types';
import { formatCurrency, formatTime } from '../../utils/format';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { socket } = useSocketStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [chartData, setChartData] = useState<{ hour: string; pedidos: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, ordersRes, tablesRes, hourlyRes] = await Promise.all([
        api.get('/orders/stats/today'),
        api.get('/orders/live/all'),
        api.get('/tables'),
        api.get('/orders/stats/hourly'),
      ]);
      setStats(statsRes.data.data);
      setLiveOrders(ordersRes.data.data.slice(0, 8));
      setTables(tablesRes.data.data);
      setChartData(hourlyRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('order:statusChanged', fetchData);
    socket.on('order:created', fetchData);
    return () => {
      socket.off('order:statusChanged', fetchData);
      socket.off('order:created', fetchData);
    };
  }, [socket]);

  const today = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          ¡Buen día, {user?.username}! 👋
        </h1>
        <p className="text-slate-500 mt-1 capitalize text-sm">{today}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pedidos hoy"
          value={stats?.ordersToday ?? '-'}
          icon={<ShoppingBag size={20} />}
          iconBg="bg-blue-50 text-blue-600"
          loading={loading}
        />
        <StatCard
          title="Ventas hoy"
          value={stats ? formatCurrency(stats.revenueToday) : '-'}
          icon={<DollarSign size={20} />}
          iconBg="bg-emerald-50 text-emerald-600"
          loading={loading}
        />
        <StatCard
          title="Pedidos activos"
          value={stats?.activeOrders ?? '-'}
          icon={<Clock size={20} />}
          iconBg="bg-amber-50 text-amber-600"
          loading={loading}
        />
        <StatCard
          title="Ticket promedio"
          value={stats ? formatCurrency(stats.avgTicket) : '-'}
          icon={<TrendingUp size={20} />}
          iconBg="bg-purple-50 text-purple-600"
          loading={loading}
        />
      </div>

      {/* Charts + Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Pedidos por hora</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                cursor={{ fill: '#F8FAFC' }}
              />
              <Bar dataKey="pedidos" fill="#6366F1" radius={[4, 4, 0, 0]} name="Pedidos" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tables grid */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">
            Estado de mesas
            <span className="ml-2 text-xs text-slate-400 font-normal">{tables.length} mesas</span>
          </h2>
          <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
            {tables.map((table) => {
              const colors: Record<string, string> = {
                free: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                occupied: 'bg-blue-50 border-blue-200 text-blue-700',
                with_order: 'bg-amber-50 border-amber-200 text-amber-700',
                pending_payment: 'bg-red-50 border-red-200 text-red-700',
                cleaning: 'bg-slate-50 border-slate-200 text-slate-500',
              };
              return (
                <div
                  key={table._id}
                  className={`border rounded-lg p-2 text-center text-xs font-medium ${colors[table.status] || colors.free}`}
                >
                  <p className="font-semibold truncate">{table.name}</p>
                  <p className="text-xs opacity-70 mt-0.5 capitalize">{table.status.replace('_', ' ')}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Pedidos recientes</h2>
          <span className="text-xs text-slate-400">Tiempo real</span>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-slate-50">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="skeleton h-4 w-24 rounded" />
                  <div className="skeleton h-3 w-16 rounded" />
                </div>
                <div className="skeleton h-5 w-14 rounded" />
              </div>
            ))
          ) : liveOrders.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">
              <CheckCircle size={28} className="mx-auto mb-2 opacity-30" />
              Sin pedidos activos
            </div>
          ) : (
            liveOrders.map((order) => (
              <div key={order._id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {(order.table as { name: string })?.name || '-'}
                    <span className="ml-1.5 text-xs font-mono text-slate-400">#{order.orderNumber}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatTime(order.createdAt)} · {order.items.length} ítem{order.items.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(order.total)}</p>
                  <div className="mt-1"><OrderStatusBadge status={order.status} /></div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mesa</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hora</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ítems</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-6 py-3">
                        <div className="skeleton h-4 w-16 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : liveOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400 text-sm">
                    <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
                    Sin pedidos activos
                  </td>
                </tr>
              ) : (
                liveOrders.map((order) => (
                  <tr key={order._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3 text-sm font-mono text-slate-500">#{order.orderNumber}</td>
                    <td className="px-6 py-3 text-sm font-medium text-slate-900">
                      {(order.table as { name: string })?.name || '-'}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-500">{formatTime(order.createdAt)}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">
                      {order.items.length} ítem{order.items.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold text-slate-900">{formatCurrency(order.total)}</td>
                    <td className="px-6 py-3"><OrderStatusBadge status={order.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
