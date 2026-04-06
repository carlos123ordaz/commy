import React, { useEffect, useState, useCallback } from 'react';
import { Users, RefreshCw, UserCircle2, ChevronLeft, ChevronRight, Phone, MapPin } from 'lucide-react';
import { api } from '../../config/api';
import { Button } from '../../components/ui/Button';
import { formatRelative, formatDate } from '../../utils/format';

interface Customer {
  _id: string;
  googleId: string;
  name: string;
  email: string;
  picture?: string;
  phone?: string;
  address?: string;
  lastSeenAt: string;
  createdAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; totalPages: number };
}

const PAGE_SIZE = 30;

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCustomers = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Customer>>('/customers', {
        params: { page: p, limit: PAGE_SIZE },
      });
      setCustomers(res.data.data);
      setTotal(res.data.meta.total);
      setTotalPages(res.data.meta.totalPages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(page); }, [fetchCustomers, page]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm">{total} cliente{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''} con Google</p>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => fetchCustomers(page)} loading={loading}>
          Actualizar
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Cliente</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Contacto</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Dirección</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Última visita</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Registrado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="skeleton h-4 rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-16">
                  <Users size={40} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-400">Sin clientes registrados aún</p>
                  <p className="text-xs text-slate-400 mt-1">Los clientes aparecen cuando inician sesión con Google</p>
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {customer.picture ? (
                        <img
                          src={customer.picture}
                          alt={customer.name}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <UserCircle2 size={18} className="text-primary-500" />
                        </div>
                      )}
                      <span className="font-medium text-slate-900 text-sm">{customer.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">
                    <p>{customer.email}</p>
                    {customer.phone && (
                      <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <Phone size={11} />{customer.phone}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">
                    {customer.address ? (
                      <p className="flex items-start gap-1 text-xs text-slate-500">
                        <MapPin size={11} className="mt-0.5 shrink-0" />{customer.address}
                      </p>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">
                    <span title={formatDate(customer.lastSeenAt)}>
                      {formatRelative(customer.lastSeenAt)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-400">
                    {formatDate(customer.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
