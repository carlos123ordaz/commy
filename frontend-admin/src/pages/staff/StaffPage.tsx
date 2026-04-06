import React, { useEffect, useState } from 'react';
import { Plus, ToggleLeft, ToggleRight, Pencil, Users } from 'lucide-react';
import type { User, Role } from '../../types';
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

const staffSchema = z.object({
  username: z.string().min(3, 'Mínimo 3 caracteres').max(30).regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y guiones bajos'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres').optional().or(z.literal('')),
  role: z.enum(['owner', 'cashier', 'kitchen', 'waiter']),
});

type StaffForm = z.infer<typeof staffSchema>;

const roleLabels: Record<Role, string> = {
  superadmin: 'Super Admin',
  owner: 'Administrador',
  cashier: 'Cajero',
  kitchen: 'Cocina',
  waiter: 'Mozo',
};

const roleVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  owner: 'purple',
  cashier: 'info',
  kitchen: 'warning',
  waiter: 'success',
};

export const StaffPage: React.FC = () => {
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
  });

  const fetchStaff = async () => {
    try {
      const res = await api.get('/users');
      setStaff(res.data.data);
    } catch { toast.error('Error al cargar staff'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStaff(); }, []);

  const openCreate = () => {
    setEditing(null);
    reset({ username: '', email: '', password: '', role: 'cashier' });
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    reset({ username: user.username, email: user.email, password: '', role: user.role as 'owner' | 'cashier' | 'kitchen' | 'waiter' });
    setModalOpen(true);
  };

  const onSubmit = async (data: StaffForm) => {
    try {
      const payload: Partial<StaffForm> = { ...data };
      if (!data.password) delete payload.password;

      if (editing) {
        await api.patch(`/users/${editing._id}`, payload);
        toast.success('Usuario actualizado');
      } else {
        await api.post('/users', payload);
        toast.success('Usuario creado');
      }
      setModalOpen(false);
      fetchStaff();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al guardar');
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      await api.patch(`/users/${id}/toggle-status`);
      fetchStaff();
    } catch { toast.error('Error'); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Staff</h1>
          <p className="text-slate-500 text-sm">{staff.length} usuarios</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCreate}>
          Nuevo usuario
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Usuario</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Rol</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Creado</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-3"><div className="skeleton h-4 rounded" /></td>
                  ))}
                </tr>
              ))
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <Users size={40} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-400">Sin usuarios de staff</p>
                </td>
              </tr>
            ) : staff.map((user) => (
              <tr key={user._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-700 text-xs font-bold">{user.username.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="font-medium text-slate-900 text-sm">{user.username}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-slate-500">{user.email}</td>
                <td className="px-5 py-3">
                  <Badge variant={roleVariant[user.role] || 'default'}>
                    {roleLabels[user.role] || user.role}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={user.isActive ? 'success' : 'gray'}>
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-sm text-slate-400">{formatDate(user.createdAt)}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(user)} className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => toggleStatus(user._id)} className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50" title={user.isActive ? 'Desactivar' : 'Activar'}>
                      {user.isActive ? <ToggleRight size={17} className="text-emerald-500" /> : <ToggleLeft size={17} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar usuario' : 'Nuevo usuario de staff'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
              {editing ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Usuario" placeholder="cajero1" {...register('username')} error={errors.username?.message} />
          <Input label="Email" type="email" placeholder="usuario@restaurante.com" {...register('email')} error={errors.email?.message} />
          <Input
            label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            type="password"
            placeholder="••••••••"
            {...register('password')}
            error={errors.password?.message}
          />
          <Select
            label="Rol"
            {...register('role')}
            error={errors.role?.message}
            options={[
              { value: 'owner', label: 'Administrador' },
              { value: 'cashier', label: 'Cajero' },
              { value: 'kitchen', label: 'Cocina' },
              { value: 'waiter', label: 'Mozo' },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
};
