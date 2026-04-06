import React, { useEffect, useState, useCallback } from 'react';
import { Clock, CheckCircle2, ChefHat, Flame } from 'lucide-react';
import type { Order } from '../../types';
import { api } from '../../config/api';
import { useSocketStore } from '../../store/socketStore';
import { Button } from '../../components/ui/Button';
import { differenceInMinutes } from 'date-fns';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';

export const KitchenPage: React.FC = () => {
  const { socket } = useSocketStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/orders/live/all');
      const kitchenOrders = (res.data.data as Order[]).filter(
        (o) => ['confirmed', 'preparing'].includes(o.status)
      );
      setOrders(kitchenOrders);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchOrders();
    socket.on('connect', refresh);
    socket.on('order:created', refresh);
    socket.on('order:statusChanged', refresh);
    socket.on('order:itemAdded', refresh);
    return () => {
      socket.off('connect', refresh);
      socket.off('order:created', refresh);
      socket.off('order:statusChanged', refresh);
      socket.off('order:itemAdded', refresh);
    };
  }, [socket, fetchOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success('Estado actualizado');
      fetchOrders();
    } catch {
      toast.error('Error al actualizar');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-orange-100 rounded-xl">
          <ChefHat size={24} className="text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Panel de Cocina</h1>
          <p className="text-slate-500 text-sm">{orders.length} pedido{orders.length !== 1 ? 's' : ''} activo{orders.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <ChefHat size={48} className="mb-4 opacity-30" />
          <p className="text-lg font-medium">Sin pedidos en cocina</p>
          <p className="text-sm mt-1">Los pedidos confirmados aparecerán aquí</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {orders.map((order) => {
            const minutes = differenceInMinutes(new Date(), new Date(order.createdAt));
            const isUrgent = minutes > 15;
            const isWarning = minutes > 10 && !isUrgent;
            const tableName = (order.table as { name: string })?.name;

            return (
              <div
                key={order._id}
                className={cn(
                  'bg-white rounded-2xl border-2 shadow-sm overflow-hidden',
                  order.status === 'confirmed' ? 'border-blue-400' : 'border-purple-400',
                  isUrgent && 'animate-pulse-ring border-red-400'
                )}
              >
                {/* Card header */}
                <div
                  className={cn(
                    'px-5 py-4',
                    order.status === 'confirmed' ? 'bg-blue-50' : 'bg-purple-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-bold text-slate-900">{tableName}</p>
                      <p className="text-sm text-slate-500 font-mono">Pedido #{order.orderNumber}</p>
                    </div>
                    <div className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold',
                      isUrgent ? 'bg-red-100 text-red-700' :
                      isWarning ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    )}>
                      {isUrgent && <Flame size={12} />}
                      <Clock size={12} />
                      {minutes}m
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="px-5 py-4 space-y-3">
                  {order.items.map((item) => (
                    <div key={item._id} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-slate-700 text-sm">
                        {item.quantity}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{item.productSnapshot.name}</p>
                        {/* Menu type: show group breakdown */}
                        {item.selectedMenuGroups?.length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {item.selectedMenuGroups.map((mg) => (
                              <p key={mg.groupId} className="text-xs text-slate-600">
                                <span className="font-medium">{mg.groupName}:</span>{' '}
                                {mg.omitted
                                  ? <span className="text-slate-400 italic">Sin {mg.groupName.toLowerCase()}</span>
                                  : mg.selectedProductName}
                              </p>
                            ))}
                          </div>
                        )}
                        {/* configurable/combo type: show selection groups */}
                        {(!item.selectedMenuGroups?.length) && item.selectedGroups?.length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {item.selectedGroups.map((sg) => (
                              <p key={sg.groupId} className="text-xs text-slate-600">
                                <span className="font-medium">{sg.groupName}:</span>{' '}
                                {sg.selectedOptions.map((o) => o.optionName).join(', ')}
                              </p>
                            ))}
                          </div>
                        )}
                        {item.modifiers.length > 0 && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            + {item.modifiers.map((m) => m.optionName).join(', ')}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-amber-600 mt-0.5 font-medium">💬 {item.notes}</p>
                        )}
                        {item.addedByAlias && (
                          <p className="text-xs text-slate-400 mt-0.5">👤 {item.addedByAlias}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="px-5 pb-5 flex gap-2">
                  {order.status === 'confirmed' && (
                    <Button
                      variant="primary"
                      className="flex-1"
                      icon={<ChefHat size={14} />}
                      loading={updatingId === order._id}
                      onClick={() => updateStatus(order._id, 'preparing')}
                    >
                      Iniciar
                    </Button>
                  )}
                  {order.status === 'preparing' && (
                    <Button
                      variant="primary"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      icon={<CheckCircle2 size={14} />}
                      loading={updatingId === order._id}
                      onClick={() => updateStatus(order._id, 'ready')}
                    >
                      Listo
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
