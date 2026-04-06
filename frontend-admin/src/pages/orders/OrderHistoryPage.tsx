import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, XCircle, Download, Phone, MapPin,
} from 'lucide-react';
import type { Order, OrderType } from '../../types';
import type { PaginatedResponse } from '../../types';
import { api } from '../../config/api';
import { Button } from '../../components/ui/Button';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { formatCurrency } from '../../utils/format';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../../utils/cn';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'billed', label: 'Cobrado' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'served', label: 'Servido' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'preparing', label: 'En preparación' },
  { value: 'pending_confirmation', label: 'Pendiente' },
];

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: 'Mesa',
  takeaway: 'Llevar',
  delivery: 'Delivery',
  manual: 'Manual',
};

const PAGE_SIZE = 20;

// Formats a Date to YYYY-MM-DD using LOCAL timezone (not UTC)
function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Converts a YYYY-MM-DD string to the start of that day in LOCAL timezone
function toLocalDayStart(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

// Converts a YYYY-MM-DD string to the end of that day in LOCAL timezone
function toLocalDayEnd(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  billed: 'Cobrado',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
  served: 'Servido',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  pending_confirmation: 'Pendiente',
  draft: 'Borrador',
  ready: 'Listo',
};

export const OrderHistoryPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(() => toDateInputValue(subDays(new Date(), 30)));
  const [dateTo, setDateTo] = useState(() => toDateInputValue(new Date()));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchOrders = useCallback(async (p: number, status: string, from: string, to: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: PAGE_SIZE };
      if (status) params.status = status;
      if (from) params.dateFrom = toLocalDayStart(from);
      if (to) params.dateTo = toLocalDayEnd(to);
      const res = await api.get<PaginatedResponse<Order>>('/orders', { params });
      setOrders(res.data.data);
      setTotal(res.data.meta.total);
      setTotalPages(res.data.meta.totalPages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(page, statusFilter, dateFrom, dateTo);
  }, [fetchOrders, page, statusFilter, dateFrom, dateTo]);

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
  };

  const handleRefresh = () => fetchOrders(page, statusFilter, dateFrom, dateTo);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string | number> = { page: 1, limit: 5000 };
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.dateFrom = toLocalDayStart(dateFrom);
      if (dateTo) params.dateTo = toLocalDayEnd(dateTo);
      const res = await api.get<PaginatedResponse<Order>>('/orders', { params });
      const rows = res.data.data;

      const header = ['#Pedido', 'Tipo', 'Mesa/Canal', 'Cliente', 'Estado', 'Ítems', 'Subtotal', 'Cargo adicional', 'Total', 'Fecha'];
      const lines = [header.join(';')];

      for (const order of rows) {
        const tableName = typeof order.table === 'object' && order.table
          ? (order.table as { name: string }).name
          : '';
        const typeLabel = ORDER_TYPE_LABEL[order.orderType] ?? order.orderType;
        const statusLabel = ORDER_STATUS_LABEL[order.status] ?? order.status;
        const customerName = order.customerInfo?.name ?? '';
        const itemsSummary = order.items
          .map((i) => `${i.quantity}x ${i.productSnapshot.name}`)
          .join(' | ');
        const dateLabel = format(new Date(order.createdAt), "d/MM/yyyy HH:mm", { locale: es });
        lines.push([
          `#${order.orderNumber}`,
          typeLabel,
          tableName || typeLabel,
          customerName,
          statusLabel,
          itemsSummary,
          order.subtotal?.toFixed(2) ?? '',
          order.surcharge?.toFixed(2) ?? '0.00',
          order.total.toFixed(2),
          dateLabel,
        ].join(';'));
      }

      const bom = '\uFEFF';
      const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedidos_${dateFrom}_${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  };

  const handleReject = async (orderId: string) => {
    setRejectLoading(true);
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'cancelled' });
      setRejectingId(null);
      fetchOrders(page, statusFilter, dateFrom, dateTo);
    } catch {
      // ignore
    } finally {
      setRejectLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Historial de Pedidos</h1>
          <p className="text-slate-500 text-sm">{total} pedido{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<Download size={14} />}
            onClick={handleExport}
            loading={exporting}
          >
            Exportar Excel
          </Button>
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={handleRefresh} loading={loading}>
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        {/* Status */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            className="pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">Desde</label>
          <input
            type="date"
            className="py-2 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => handleDateChange(e.target.value, dateTo)}
          />
          <label className="text-xs text-slate-500 whitespace-nowrap">Hasta</label>
          <input
            type="date"
            className="py-2 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => handleDateChange(dateFrom, e.target.value)}
          />
        </div>

        <span className="text-xs text-slate-400 ml-auto">
          Página {page} de {totalPages}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Cargando...</div>
        ) : orders.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Sin pedidos</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Mesa / Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Ítems</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.map((order) => {
                const isExpanded = expandedId === order._id;
                const tableName = typeof order.table === 'object' && order.table
                  ? (order.table as { name: string }).name
                  : null;
                const typeLabel = ORDER_TYPE_LABEL[order.orderType];
                const dateLabel = format(new Date(order.createdAt), "d MMM yyyy, HH:mm", { locale: es });

                return (
                  <React.Fragment key={order._id}>
                    <tr
                      className={cn(
                        'cursor-pointer transition-colors',
                        isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/60'
                      )}
                      onClick={() => setExpandedId(isExpanded ? null : order._id)}
                    >
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">#{order.orderNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{tableName ?? typeLabel}</p>
                        {tableName && (
                          <p className="text-xs text-slate-400">{typeLabel}</p>
                        )}
                        {order.customerInfo?.name && (
                          <p className="text-xs text-slate-400">{order.customerInfo.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{dateLabel}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{order.items.length}</td>
                      <td className="px-4 py-3 text-slate-400">
                        <div className="flex items-center justify-end gap-2">
                          {!['cancelled', 'closed', 'billed'].includes(order.status) && (
                            <button
                              title="Rechazar pedido"
                              onClick={(e) => { e.stopPropagation(); setRejectingId(order._id); }}
                              className="text-red-400 hover:text-red-600 transition-colors"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="px-6 pb-4 pt-2">
                          <div className="space-y-1.5">
                            {(order.customerInfo?.phone || order.customerInfo?.address) && (
                              <div className="flex flex-wrap gap-3 pb-2 mb-1 border-b border-slate-100 text-xs text-slate-500">
                                {order.customerInfo.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone size={11} />{order.customerInfo.phone}
                                  </span>
                                )}
                                {order.customerInfo.address && (
                                  <span className="flex items-center gap-1">
                                    <MapPin size={11} />{order.customerInfo.address}
                                    {order.customerInfo.coordinates && (
                                      <a
                                        href={`https://www.google.com/maps?q=${order.customerInfo.coordinates.lat},${order.customerInfo.coordinates.lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="ml-1 text-primary-600 hover:text-primary-700 underline font-medium"
                                      >
                                        Ver mapa
                                      </a>
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                            {order.items.map((item) => (
                              <div key={item._id} className="flex items-start justify-between text-xs">
                                <div className="flex-1">
                                  <span className="font-medium text-slate-700">
                                    {item.quantity}x {item.productSnapshot.name}
                                  </span>
                                  {item.addedByAlias && (
                                    <span className="ml-1 text-slate-400">({item.addedByAlias})</span>
                                  )}
                                  {item.selectedMenuGroups?.length > 0 && (
                                    <div className="mt-0.5 space-y-0.5">
                                      {item.selectedMenuGroups.map((mg) => (
                                        <p key={mg.groupId} className="text-slate-500">
                                          <span className="font-medium">{mg.groupName}:</span>{' '}
                                          {mg.omitted
                                            ? <span className="italic text-slate-400">Sin {mg.groupName.toLowerCase()}</span>
                                            : mg.selectedProductName}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {(!item.selectedMenuGroups?.length) && item.selectedGroups?.length > 0 && (
                                    <div className="mt-0.5 space-y-0.5">
                                      {item.selectedGroups.map((sg) => (
                                        <p key={sg.groupId} className="text-slate-500">
                                          <span className="font-medium">{sg.groupName}:</span>{' '}
                                          {sg.selectedOptions.map((o) => o.optionName).join(', ')}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {item.selectedAccompaniments?.length > 0 && (
                                    <div className="mt-0.5 space-y-0.5">
                                      {item.selectedAccompaniments.map((a) => (
                                        <p key={a.categoryId} className="text-slate-500">
                                          <span className="font-medium">{a.categoryName}:</span>{' '}
                                          {a.productName}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {item.modifiers.length > 0 && (
                                    <p className="text-slate-400">
                                      + {item.modifiers.map((m) => m.optionName).join(', ')}
                                    </p>
                                  )}
                                  {item.notes && (
                                    <p className="text-slate-400 italic">💬 {item.notes}</p>
                                  )}
                                </div>
                                <span className="text-slate-600 font-medium ml-4">
                                  {formatCurrency(item.totalPrice)}
                                </span>
                              </div>
                            ))}
                            {order.surcharge > 0 && (
                              <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                                <span>Cargo adicional</span>
                                <span>+{formatCurrency(order.surcharge)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs font-semibold text-slate-800 pt-1 border-t border-slate-200">
                              <span>Total</span>
                              <span>{formatCurrency(order.total)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject confirmation modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <XCircle size={22} className="text-red-500 shrink-0" />
              <h2 className="font-semibold text-slate-900">Rechazar pedido</h2>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              ¿Estás seguro de que querés rechazar este pedido? El estado cambiará a <span className="font-medium text-red-600">Cancelado</span> y no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRejectingId(null)} disabled={rejectLoading}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={rejectLoading}
                onClick={() => handleReject(rejectingId)}
              >
                Rechazar pedido
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<ChevronLeft size={14} />}
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
            >
              Siguiente
              <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
