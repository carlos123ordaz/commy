import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Grid, List, Pencil, Trash2, QrCode, Search, X } from 'lucide-react';
import type { Table } from '../../types';
import { api } from '../../config/api';
import { Button } from '../../components/ui/Button';
import { TableStatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { useNavigate } from 'react-router-dom';

const tableSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  number: z.string().optional(),
  capacity: z.string().default('4'),
  zone: z.string().optional(),
});

type TableForm = z.infer<typeof tableSchema>;

export const TablesPage: React.FC = () => {
  const navigate = useNavigate();
  const [tables, setTables] = useState<Table[]>([]);
  const [filtered, setFiltered] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Zone selector state
  const [floorPlanZones, setFloorPlanZones] = useState<string[]>([]);
  const [customZoneMode, setCustomZoneMode] = useState(false);
  const [customZoneValue, setCustomZoneValue] = useState('');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<TableForm>({
    resolver: zodResolver(tableSchema),
    defaultValues: { capacity: '4' },
  });

  const zoneValue = watch('zone');

  // All known zones: from floor plan + from existing tables (deduped)
  const allZones = React.useMemo(() => {
    const fromTables = tables.map((t) => t.zone).filter(Boolean) as string[];
    return [...new Set([...floorPlanZones, ...fromTables])].sort();
  }, [floorPlanZones, tables]);

  const fetchTables = async () => {
    try {
      const res = await api.get('/tables');
      setTables(res.data.data);
    } catch { toast.error('Error al cargar mesas'); }
    finally { setLoading(false); }
  };

  // Fetch zone names from floor plan
  const fetchFloorZones = useCallback(async () => {
    try {
      const res = await api.get('/floor-plan');
      const zoneLayouts: { zoneName: string }[] = res.data.data?.layout?.zoneLayouts ?? [];
      setFloorPlanZones(zoneLayouts.map((z) => z.zoneName));
    } catch {
      // non-critical, fall back to table zones only
    }
  }, []);

  useEffect(() => {
    fetchTables();
    fetchFloorZones();
  }, [fetchFloorZones]);

  useEffect(() => {
    let result = tables;
    if (search) result = result.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
    if (zoneFilter) result = result.filter((t) => t.zone === zoneFilter);
    setFiltered(result);
  }, [tables, search, zoneFilter]);

  const zones = [...new Set(tables.map((t) => t.zone).filter(Boolean))] as string[];

  const openCreate = () => {
    setEditingTable(null);
    reset({ name: '', capacity: '4', zone: '', number: '' });
    setCustomZoneMode(false);
    setCustomZoneValue('');
    setModalOpen(true);
  };

  const openEdit = (table: Table) => {
    setEditingTable(table);
    const isKnownZone = !table.zone || allZones.includes(table.zone);
    reset({
      name: table.name,
      capacity: String(table.capacity),
      zone: table.zone || '',
      number: table.number ? String(table.number) : '',
    });
    // If the table has a zone not in the known list, open in custom mode
    setCustomZoneMode(!isKnownZone);
    setCustomZoneValue(!isKnownZone ? (table.zone ?? '') : '');
    setModalOpen(true);
  };

  const onSubmit = async (data: TableForm) => {
    setSubmitting(true);
    try {
      const payload = {
        name: data.name,
        capacity: parseInt(data.capacity),
        zone: data.zone || undefined,
        number: data.number ? parseInt(data.number) : undefined,
      };
      if (editingTable) {
        await api.patch(`/tables/${editingTable._id}`, payload);
        toast.success('Mesa actualizada');
      } else {
        await api.post('/tables', payload);
        toast.success('Mesa creada');
      }
      setModalOpen(false);
      fetchTables();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta mesa?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/tables/${id}`);
      toast.success('Mesa eliminada');
      fetchTables();
    } catch { toast.error('Error al eliminar'); }
    finally { setDeletingId(null); }
  };

  const statusColors: Record<string, string> = {
    free: 'bg-emerald-50 border-emerald-200',
    occupied: 'bg-blue-50 border-blue-200',
    with_order: 'bg-amber-50 border-amber-200',
    pending_payment: 'bg-red-50 border-red-200',
    cleaning: 'bg-slate-50 border-slate-200',
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Mesas</h1>
          <p className="text-slate-500 text-sm">{tables.length} mesas registradas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<QrCode size={16} />} onClick={() => navigate('/qr')}>
            Gestionar QRs
          </Button>
          <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCreate}>
            Nueva mesa
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar mesa..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todas las zonas</option>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setView('grid')}
            className={cn('p-2', view === 'grid' ? 'bg-primary-50 text-primary-600' : 'text-slate-500 hover:bg-slate-50')}
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setView('list')}
            className={cn('p-2', view === 'list' ? 'bg-primary-50 text-primary-600' : 'text-slate-500 hover:bg-slate-50')}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-36 rounded-xl" />
          ))}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((table) => (
            <div
              key={table._id}
              className={cn(
                'relative border-2 rounded-xl p-4 transition-all hover:shadow-md',
                statusColors[table.status] || 'bg-slate-50 border-slate-200'
              )}
            >
              <div className="mb-3">
                <p className="font-bold text-slate-900 text-base">{table.name}</p>
                {table.zone && <p className="text-xs text-slate-500">{table.zone}</p>}
                <p className="text-xs text-slate-400 mt-1">Cap. {table.capacity} personas</p>
              </div>
              <TableStatusBadge status={table.status} />
              <div className="absolute top-3 right-3 flex gap-1">
                <button onClick={() => openEdit(table)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-white/80">
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(table._id)}
                  disabled={deletingId === table._id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white/80"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-400">Sin mesas</div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Nombre</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Zona</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Capacidad</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((table) => (
                <tr key={table._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-900 text-sm">{table.name}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{table.zone || '-'}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{table.capacity}</td>
                  <td className="px-5 py-3"><TableStatusBadge status={table.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(table)} className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(table._id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTable ? 'Editar mesa' : 'Nueva mesa'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={submitting} onClick={handleSubmit(onSubmit)}>
              {editingTable ? 'Guardar cambios' : 'Crear mesa'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre de la mesa"
            placeholder="Ej: Mesa 1, Terraza 3"
            {...register('name')}
            error={errors.name?.message}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Número (opcional)"
              type="number"
              placeholder="1"
              {...register('number')}
            />
            <Input
              label="Capacidad"
              type="number"
              placeholder="4"
              {...register('capacity')}
            />
          </div>
          {/* Zone selector */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Zona / Ambiente
              <span className="ml-1 text-slate-400 font-normal text-xs">(opcional)</span>
            </label>

            {customZoneMode ? (
              /* Custom zone text input */
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={customZoneValue}
                  onChange={(e) => {
                    setCustomZoneValue(e.target.value);
                    setValue('zone', e.target.value);
                  }}
                  placeholder="Nombre de la nueva zona"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomZoneMode(false);
                    setCustomZoneValue('');
                    setValue('zone', '');
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg"
                  title="Cancelar"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              /* Zone dropdown */
              <select
                value={zoneValue ?? ''}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setCustomZoneMode(true);
                    setCustomZoneValue('');
                    setValue('zone', '');
                  } else {
                    setValue('zone', e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">Sin zona</option>
                {allZones.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
                <option disabled>──────────</option>
                <option value="__new__">+ Nueva zona…</option>
              </select>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
