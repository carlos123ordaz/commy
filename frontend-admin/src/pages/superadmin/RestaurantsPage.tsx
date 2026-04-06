import React, { useEffect, useState } from 'react';
import { Plus, Building2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Restaurant } from '../../types';
import { api } from '../../config/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDate } from '../../utils/format';
import toast from 'react-hot-toast';

const restaurantSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  legalName: z.string().optional(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
  adminUsername: z.string().min(3).regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y guiones bajos'),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

type RestaurantForm = z.infer<typeof restaurantSchema>;

const planColors: Record<string, 'gray' | 'info' | 'success' | 'purple'> = {
  free: 'gray',
  starter: 'info',
  pro: 'success',
  enterprise: 'purple',
};

export const RestaurantsPage: React.FC = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RestaurantForm>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: { plan: 'starter' },
  });

  const fetchRestaurants = async () => {
    try {
      const res = await api.get('/restaurants', { params: { page, limit: 20, search } });
      setRestaurants(res.data.data);
      setTotal(res.data.meta.total);
    } catch { toast.error('Error al cargar restaurantes'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRestaurants(); }, [page, search]);

  const onSubmit = async (data: RestaurantForm) => {
    try {
      await api.post('/restaurants', data);
      toast.success('Restaurante creado');
      setModalOpen(false);
      reset();
      fetchRestaurants();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al crear restaurante');
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      await api.patch(`/restaurants/${id}/toggle-status`);
      fetchRestaurants();
    } catch { toast.error('Error'); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Restaurantes</h1>
          <p className="text-slate-500 text-sm">{total} restaurantes registrados</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => { reset(); setModalOpen(true); }}>
          Nuevo restaurante
        </Button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Buscar por nombre, email o slug..."
        className="w-full max-w-sm px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Restaurante</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Slug</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Plan</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Creado</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-3"><div className="skeleton h-4 rounded" /></td>
                  ))}
                </tr>
              ))
            ) : restaurants.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <Building2 size={40} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-400">Sin restaurantes</p>
                </td>
              </tr>
            ) : restaurants.map((r) => (
              <tr key={r._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-5 py-3">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.email}</p>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm font-mono text-slate-500">{r.slug}</td>
                <td className="px-5 py-3">
                  <Badge variant={planColors[r.plan] || 'gray'} className="capitalize">{r.plan}</Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={r.isActive ? 'success' : 'error'}>{r.isActive ? 'Activo' : 'Suspendido'}</Badge>
                </td>
                <td className="px-5 py-3 text-xs text-slate-400">{formatDate(r.createdAt)}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => toggleStatus(r._id)} className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50" title={r.isActive ? 'Suspender' : 'Activar'}>
                      {r.isActive ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal create */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo restaurante" size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>Crear restaurante</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre comercial" placeholder="La Terraza" {...register('name')} error={errors.name?.message} />
          <Input label="Slug (URL)" placeholder="la-terraza" {...register('slug')} error={errors.slug?.message} hint="Solo minúsculas y guiones" />
          <Input label="Email" type="email" placeholder="info@restaurante.com" {...register('email')} error={errors.email?.message} />
          <Input label="Teléfono" placeholder="+51 999 000 000" {...register('phone')} />
          <Input label="Razón social (opcional)" placeholder="La Terraza S.A.C." {...register('legalName')} />
          <Select label="Plan" {...register('plan')} error={errors.plan?.message} options={[
            { value: 'free', label: 'Free' },
            { value: 'starter', label: 'Starter' },
            { value: 'pro', label: 'Pro' },
            { value: 'enterprise', label: 'Enterprise' },
          ]} />

          <div className="col-span-2 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Usuario administrador</p>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Usuario admin" placeholder="admin_terraza" {...register('adminUsername')} error={errors.adminUsername?.message} />
              <Input label="Email admin" type="email" placeholder="admin@restaurante.com" {...register('adminEmail')} error={errors.adminEmail?.message} />
              <Input label="Contraseña" type="password" placeholder="••••••••" {...register('adminPassword')} error={errors.adminPassword?.message} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
