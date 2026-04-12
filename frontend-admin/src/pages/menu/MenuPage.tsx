import React, { useEffect, useMemo, useState } from 'react';
import {
  AlignLeft,
  Check,
  CircleDollarSign,
  Clock3,
  FolderKanban,
  Grid2X2,
  Image,
  LayoutList,
  Package2,
  Pencil,
  Plus,
  Search,
  Shapes,
  SlidersHorizontal,
  Soup,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import type { Category, ModifierGroup, Product } from '../../types';
import { api } from '../../config/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { formatCurrency } from '../../utils/format';
import { cn } from '../../utils/cn';

type Tab = 'categories' | 'products' | 'modifiers';

const categorySchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  order: z.string().optional(),
});

const productSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  price: z.string().min(1, 'Precio requerido'),
  category: z.string().min(1, 'Categoria requerida'),
  estimatedTime: z.string().optional(),
  imageUrl: z.string().optional(),
});

type CategoryForm = z.infer<typeof categorySchema>;
type ProductForm = z.infer<typeof productSchema>;

const formFieldClassName =
  'w-full rounded-xl border border-slate-200 bg-white py-3 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500';

const tabConfig: Record<Tab, { label: string; icon: React.ReactNode }> = {
  categories: { label: 'Categorias', icon: <Grid2X2 size={16} /> },
  products: { label: 'Productos', icon: <Soup size={16} /> },
  modifiers: { label: 'Modificadores', icon: <LayoutList size={16} /> },
};

interface ProductSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const ProductSection: React.FC<ProductSectionProps> = ({ title, description, icon, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-[0.01em] text-slate-900">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
    <div className="px-5 py-4">{children}</div>
  </section>
);

interface SettingRowProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  tone?: 'default' | 'accent';
}

const SettingRow: React.FC<SettingRowProps> = ({ title, description, enabled, onToggle, tone = 'default' }) => (
  <div
    className={cn(
      'flex items-start justify-between gap-4 rounded-2xl border px-4 py-3.5 transition-all',
      enabled
        ? tone === 'accent'
          ? 'border-primary-200 bg-primary-50/70'
          : 'border-slate-300 bg-slate-50'
        : 'border-slate-200 bg-white hover:border-slate-300'
    )}
  >
    <div className="min-w-0 pr-2">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
    <div className="flex items-center gap-3">
      <span className={cn('text-xs font-medium', enabled ? 'text-slate-700' : 'text-slate-400')}>
        {enabled ? 'Activo' : 'Inactivo'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={cn(
          'relative inline-flex h-7 w-12 items-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          enabled ? 'border-primary-600 bg-primary-600' : 'border-slate-300 bg-slate-200'
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            enabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  </div>
);

interface ActionIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'default' | 'primary' | 'warning' | 'danger';
}

const ActionIconButton: React.FC<ActionIconButtonProps> = ({ tone = 'default', className, children, ...props }) => {
  const tones = {
    default: 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700',
    primary: 'border-slate-200 bg-white text-slate-500 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700',
    warning: 'border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700',
    danger: 'border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600',
  };

  return (
    <button
      type="button"
      {...props}
      className={cn('flex h-10 w-10 items-center justify-center rounded-xl border transition-all', tones[tone], className)}
    >
      {children}
    </button>
  );
};

export const MenuPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('products');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const {
    register: regCat,
    handleSubmit: submitCat,
    reset: resetCat,
    formState: { errors: catErrors, isSubmitting: catSubmitting },
  } = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) });

  const [prodModal, setProdModal] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [accompanimentCategoryIds, setAccompanimentCategoryIds] = useState<string[]>([]);
  const [isCompanion, setIsCompanion] = useState(false);
  const {
    register: regProd,
    handleSubmit: submitProd,
    reset: resetProd,
    formState: { errors: prodErrors, isSubmitting: prodSubmitting },
  } = useForm<ProductForm>({ resolver: zodResolver(productSchema) });

  const fetchAll = async () => {
    try {
      const [catRes, prodRes, modRes] = await Promise.all([
        api.get('/menu/categories'),
        api.get('/menu/products'),
        api.get('/menu/modifier-groups'),
      ]);
      setCategories(catRes.data.data);
      setProducts(prodRes.data.data);
      setModifierGroups(modRes.data.data);
    } catch {
      toast.error('Error al cargar menu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filteredProducts = products.filter((product) => {
    const matchSearch = !search || product.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      !catFilter ||
      (typeof product.category === 'string' ? product.category === catFilter : product.category._id === catFilter);
    return matchSearch && matchCategory;
  });

  const tabItems = [
    { key: 'categories' as const, label: 'Categorias', count: categories.length, icon: tabConfig.categories.icon },
    { key: 'products' as const, label: 'Productos', count: products.length, icon: tabConfig.products.icon },
    { key: 'modifiers' as const, label: 'Modificadores', count: modifierGroups.length, icon: tabConfig.modifiers.icon },
  ];

  const selectedAccompanimentCategories = useMemo(
    () => categories.filter((category) => accompanimentCategoryIds.includes(category._id)),
    [accompanimentCategoryIds, categories]
  );

  const filteredAvailableProducts = useMemo(
    () => filteredProducts.filter((product) => product.isAvailable).length,
    [filteredProducts]
  );
  const activeFilterCount = Number(Boolean(search)) + Number(Boolean(catFilter));
  const hasAccompanimentConfig = accompanimentCategoryIds.length > 0;

  const getCategoryName = (product: Product) =>
    typeof product.category === 'string'
      ? categories.find((category) => category._id === product.category)?.name || product.category
      : product.category.name;

  const toolbarSummary =
    search || catFilter
      ? `${filteredProducts.length} de ${products.length} productos visibles`
      : `${products.length} productos registrados`;

  const emptyProductState =
    search || catFilter
      ? 'No hay productos que coincidan con los filtros aplicados.'
      : 'Todavia no hay productos creados en este menu.';

  const openCreateCat = () => {
    setEditingCat(null);
    resetCat({ name: '', description: '', order: '' });
    setCatModal(true);
  };

  const openEditCat = (category: Category) => {
    setEditingCat(category);
    resetCat({ name: category.name, description: category.description || '', order: String(category.order) });
    setCatModal(true);
  };

  const onSaveCat = async (data: CategoryForm) => {
    try {
      const payload = { name: data.name, description: data.description, order: data.order ? parseInt(data.order, 10) : 0 };
      if (editingCat) {
        await api.patch(`/menu/categories/${editingCat._id}`, payload);
        toast.success('Categoria actualizada');
      } else {
        await api.post('/menu/categories', payload);
        toast.success('Categoria creada');
      }
      setCatModal(false);
      fetchAll();
    } catch {
      toast.error('Error al guardar categoria');
    }
  };

  const deleteCat = async (id: string) => {
    if (!confirm('Eliminar categoria?')) return;
    try {
      await api.delete(`/menu/categories/${id}`);
      toast.success('Categoria eliminada');
      fetchAll();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const openCreateProd = () => {
    setEditingProd(null);
    setAccompanimentCategoryIds([]);
    setIsCompanion(false);
    resetProd({ name: '', description: '', price: '', category: '', estimatedTime: '', imageUrl: '' });
    setProdModal(true);
  };

  const openEditProd = (product: Product) => {
    setEditingProd(product);
    resetProd({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      category: typeof product.category === 'string' ? product.category : product.category._id,
      estimatedTime: product.estimatedTime ? String(product.estimatedTime) : '',
      imageUrl: product.imageUrl || '',
    });
    setAccompanimentCategoryIds((product.accompanimentCategories || []).filter(Boolean));
    setIsCompanion(product.isCompanion ?? false);
    setProdModal(true);
  };

  const toggleAccompanimentCategory = (catId: string) => {
    setAccompanimentCategoryIds((prev) => (prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]));
  };

  const onSaveProd = async (data: ProductForm) => {
    try {
      const payload = {
        name: data.name,
        description: data.description,
        price: parseFloat(data.price),
        category: data.category,
        estimatedTime: data.estimatedTime ? parseInt(data.estimatedTime, 10) : undefined,
        imageUrl: data.imageUrl || undefined,
        productType: 'simple',
        accompanimentCategories: accompanimentCategoryIds,
        isCompanion,
      };
      if (editingProd) {
        await api.patch(`/menu/products/${editingProd._id}`, payload);
        toast.success('Producto actualizado');
      } else {
        await api.post('/menu/products', payload);
        toast.success('Producto creado');
      }
      setProdModal(false);
      fetchAll();
    } catch {
      toast.error('Error al guardar producto');
    }
  };

  const toggleAvailability = async (id: string) => {
    try {
      await api.patch(`/menu/products/${id}/toggle-availability`);
      fetchAll();
    } catch {
      toast.error('Error al cambiar disponibilidad');
    }
  };

  const deleteProd = async (id: string) => {
    if (!confirm('Eliminar producto?')) return;
    try {
      await api.delete(`/menu/products/${id}`);
      toast.success('Producto eliminado');
      fetchAll();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Menu</h1>
          <p className="mt-1 text-sm text-slate-500">Gestiona productos, categorias y modificadores.</p>
        </div>
        <div className="flex items-center gap-3">
          {tab === 'categories' && <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={openCreateCat} className="h-11 rounded-xl px-5">Nueva categoria</Button>}
          {tab === 'products' && <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={openCreateProd} className="h-11 rounded-xl px-5">Nuevo producto</Button>}
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-200/80 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap gap-2">
            {tabItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cn('inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm font-medium transition-all', tab === item.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900')}
              >
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl border', tab === item.key ? 'border-white/10 bg-white/10 text-white' : 'border-slate-200 bg-white text-slate-500')}>{item.icon}</span>
                <span>{item.label}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', tab === item.key ? 'bg-white/12 text-white' : 'bg-slate-200 text-slate-600')}>{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        {tab === 'products' && (
          <>
            <div className="border-b border-slate-200/80 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Explorador de productos</p>
                  <p className="mt-1 text-sm text-slate-500">{toolbarSummary}</p>
                </div>
                <div className="flex flex-col gap-3 lg:flex-row xl:min-w-[720px] xl:justify-end">
                  <div className="relative min-w-0 flex-1 xl:max-w-[340px]">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre del producto" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 shadow-inner shadow-slate-100/60 transition-all placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-100" />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 shadow-inner shadow-slate-100/60">
                      <SlidersHorizontal size={15} className="text-slate-400" />
                      <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="h-full min-w-[220px] bg-transparent pr-7 text-sm text-slate-700 focus:outline-none">
                        <option value="">Todas las categorias</option>
                        {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                      </select>
                    </div>
                    <Button variant="outline" size="md" onClick={() => { setSearch(''); setCatFilter(''); }} className="h-11 rounded-xl border-slate-200 px-4">
                      Limpiar
                      {activeFilterCount > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{activeFilterCount}</span>}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />{filteredProducts.length} productos</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{filteredAvailableProducts} disponibles</span>
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Vista operativa</p>
            </div>

            <div className="space-y-3 p-4 sm:hidden">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="skeleton mb-2 h-4 w-32 rounded" /><div className="skeleton h-3 w-20 rounded" /></div>
              )) : filteredProducts.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 py-12 text-center text-slate-400">{emptyProductState}</div>
              ) : filteredProducts.map((product) => (
                <div key={product._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start gap-3">
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-14 w-14 flex-shrink-0 rounded-xl object-cover ring-1 ring-slate-200" /> : <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400"><Image size={18} /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-slate-950">{product.name}</p>
                        {product.isCompanion && <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">Acomp.</span>}
                        {product.accompanimentCategories?.length > 0 && <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-700">+{product.accompanimentCategories.length} cat.</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"><FolderKanban size={12} />{getCategoryName(product)}</span>
                        {product.estimatedTime && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"><Clock3 size={12} />~{product.estimatedTime} min</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Precio</p><p className="mt-1 text-base font-semibold text-slate-950">{formatCurrency(product.price)}</p></div>
                    <span className={cn('inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold', product.isAvailable ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600')}><span className="h-1.5 w-1.5 rounded-full bg-current" />{product.isAvailable ? 'Disponible' : 'Agotado'}</span>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <ActionIconButton tone="warning" title="Cambiar disponibilidad" onClick={() => toggleAvailability(product._id)}>{product.isAvailable ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}</ActionIconButton>
                    <ActionIconButton tone="primary" title="Editar" onClick={() => openEditProd(product)}><Pencil size={15} /></ActionIconButton>
                    <ActionIconButton tone="danger" title="Eliminar" onClick={() => deleteProd(product._id)}><Trash2 size={15} /></ActionIconButton>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden p-4 sm:block sm:p-5">
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="grid grid-cols-[minmax(0,2.7fr)_1.15fr_0.9fr_1fr_auto] items-center gap-4 border-b border-slate-200 bg-slate-50/90 px-6 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Producto</p><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Categoria</p><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Precio</p><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Estado</p><p className="text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Acciones</p>
                </div>
                {loading ? <div className="space-y-3 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="grid grid-cols-[minmax(0,2.7fr)_1.15fr_0.9fr_1fr_auto] gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4">{Array.from({ length: 5 }).map((__, j) => <div key={j} className="skeleton h-12 rounded-xl" />)}</div>)}</div> : filteredProducts.length === 0 ? <div className="px-6 py-16 text-center"><div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-8 py-10 text-slate-400"><Package2 size={34} className="mb-3 opacity-40" /><p className="text-sm">{emptyProductState}</p></div></div> : <div className="divide-y divide-slate-100">{filteredProducts.map((product) => (
                  <div key={product._id} className="grid grid-cols-[minmax(0,2.7fr)_1.15fr_0.9fr_1fr_auto] items-center gap-4 px-6 py-4 transition-all hover:bg-slate-50/60">
                    <div className="min-w-0"><div className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner shadow-slate-100">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <Image size={18} className="text-slate-400" />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-950">{product.name}</p>{product.isCompanion && <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">Acompanante</span>}{product.accompanimentCategories?.length > 0 && <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-700">+{product.accompanimentCategories.length} cat.</span>}</div><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">{product.estimatedTime && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"><Clock3 size={12} />~{product.estimatedTime} min</span>}{product.description && <span className="max-w-[340px] truncate text-slate-400">{product.description}</span>}</div></div></div></div>
                    <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Principal</p><p className="mt-1 truncate text-sm font-medium text-slate-700">{getCategoryName(product)}</p></div>
                    <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Venta</p><p className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-950">{formatCurrency(product.price)}</p></div>
                    <div><span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold', product.isAvailable ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600')}><span className="h-1.5 w-1.5 rounded-full bg-current" />{product.isAvailable ? 'Disponible' : 'Agotado'}</span></div>
                    <div className="flex justify-end gap-2"><ActionIconButton tone="warning" title="Cambiar disponibilidad" onClick={() => toggleAvailability(product._id)}>{product.isAvailable ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}</ActionIconButton><ActionIconButton tone="primary" title="Editar" onClick={() => openEditProd(product)}><Pencil size={15} /></ActionIconButton><ActionIconButton tone="danger" title="Eliminar" onClick={() => deleteProd(product._id)}><Trash2 size={15} /></ActionIconButton></div>
                  </div>
                ))}</div>}
              </div>
            </div>
          </>
        )}

        {tab === 'categories' && <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3 sm:p-5">{loading ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />) : categories.length === 0 ? <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 py-16 text-center text-slate-400"><Tag size={40} className="mx-auto mb-3 opacity-30" /><p>Sin categorias. Crea la primera.</p></div> : categories.map((cat) => <div key={cat._id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"><div><p className="font-semibold text-slate-900">{cat.name}</p>{cat.description && <p className="mt-0.5 text-xs text-slate-500">{cat.description}</p>}<Badge variant={cat.isActive ? 'success' : 'gray'} size="sm" className="mt-1.5">{cat.isActive ? 'Activa' : 'Inactiva'}</Badge></div><div className="flex gap-2"><ActionIconButton tone="primary" title="Editar" onClick={() => openEditCat(cat)}><Pencil size={15} /></ActionIconButton><ActionIconButton tone="danger" title="Eliminar" onClick={() => deleteCat(cat._id)}><Trash2 size={15} /></ActionIconButton></div></div>)}</div>}

        {tab === 'modifiers' && <div className="space-y-3 p-4 sm:p-5">{modifierGroups.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 py-16 text-center text-slate-400">Sin modificadores creados</div> : modifierGroups.map((group) => <div key={group._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"><div className="mb-3 flex items-start justify-between"><div><p className="font-semibold text-slate-900">{group.name}</p><div className="mt-1 flex gap-2"><Badge variant={group.required ? 'error' : 'gray'} size="sm">{group.required ? 'Obligatorio' : 'Opcional'}</Badge><Badge variant="info" size="sm">{group.multipleSelection ? 'Multiple' : 'Unico'}</Badge></div></div></div><div className="flex flex-wrap gap-2">{group.options.map((opt) => <div key={opt._id} className="flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-1 text-sm"><span className="text-slate-700">{opt.name}</span>{opt.priceAdd > 0 && <span className="font-medium text-emerald-600">+{formatCurrency(opt.priceAdd)}</span>}</div>)}</div></div>)}</div>}
      </section>

      <Modal
        isOpen={catModal}
        onClose={() => setCatModal(false)}
        title={editingCat ? 'Editar categoria' : 'Nueva categoria'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCatModal(false)}>Cancelar</Button>
            <Button variant="primary" loading={catSubmitting} onClick={submitCat(onSaveCat)}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nombre" placeholder="Ej: Entradas, Bebidas" {...regCat('name')} error={catErrors.name?.message} />
          <Input label="Descripcion (opcional)" placeholder="Descripcion de la categoria" {...regCat('description')} />
          <Input label="Orden" type="number" placeholder="1" {...regCat('order')} />
        </div>
      </Modal>

      <Modal
        isOpen={prodModal}
        onClose={() => setProdModal(false)}
        title={<div><p className="text-[1.05rem] font-semibold tracking-[0.01em] text-slate-950">{editingProd ? 'Editar producto' : 'Nuevo producto'}</p><p className="mt-1 text-sm text-slate-500">Registra la informacion esencial y activa ajustes avanzados solo cuando realmente apliquen.</p></div>}
        size="xl"
        className="border border-slate-200 bg-slate-50/80"
        headerClassName="border-b border-slate-200 bg-white/90 px-6 py-5"
        contentClassName="bg-[linear-gradient(180deg,rgba(248,250,252,0.94)_0%,rgba(255,255,255,0.98)_100%)] px-4 py-4 sm:px-6 sm:py-5"
        footerClassName="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6"
        footer={
          <>
            <Button variant="secondary" className="min-w-28" onClick={() => setProdModal(false)}>Cancelar</Button>
            <Button variant="primary" className="min-w-32 shadow-[0_10px_24px_rgba(59,130,246,0.22)]" loading={prodSubmitting} onClick={submitProd(onSaveProd)}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <ProductSection title="Informacion basica" description="Los datos clave para registrar el producto con rapidez y dejarlo listo para venta." icon={<Package2 size={17} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Nombre del producto" placeholder="Ej: Hamburguesa clasica" hint="Usa el nombre tal como aparecera en caja y cocina." {...regProd('name')} error={prodErrors.name?.message} className={formFieldClassName} />
              <Input label="Precio" type="number" step="0.01" placeholder="0.00" hint="Valor final de venta." leftIcon={<CircleDollarSign size={16} />} {...regProd('price')} error={prodErrors.price?.message} className={formFieldClassName} />
              <Select label="Categoria" {...regProd('category')} error={prodErrors.category?.message} className={formFieldClassName} options={[{ value: '', label: 'Seleccionar categoria' }, ...categories.map((category) => ({ value: category._id, label: category.name }))]} />
              <div className="sm:col-span-2">
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"><AlignLeft size={14} className="text-slate-400" />Descripcion <span className="text-slate-400">(opcional)</span></label>
                <textarea {...regProd('description')} rows={3} placeholder="Ej: Pan brioche, carne angus, queso cheddar y salsa de la casa." className={`${formFieldClassName} min-h-[104px] resize-none px-3.5`} />
                <p className="mt-1.5 text-xs text-slate-500">Agrega contexto solo si ayuda a diferenciar el producto.</p>
              </div>
            </div>
          </ProductSection>

          <ProductSection title="Configuracion operativa" description="Ajustes secundarios para operacion interna y presentacion del producto." icon={<Clock3 size={17} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Tiempo estimado" type="number" placeholder="10" hint="Minutos aproximados de preparacion." leftIcon={<Clock3 size={15} />} {...regProd('estimatedTime')} className={formFieldClassName} />
              <Input label="URL de imagen" placeholder="https://..." hint="Opcional para menu digital o catalogo." leftIcon={<Image size={15} />} {...regProd('imageUrl')} className={formFieldClassName} />
            </div>
          </ProductSection>

          <ProductSection title="Configuracion del producto" description="Opciones que definen como se comporta el producto dentro del menu." icon={<Shapes size={17} />}>
            <div className="space-y-3">
              <SettingRow title="Solo acompanante" description="Oculta este producto del listado principal y mantenlo disponible unicamente como complemento." enabled={isCompanion} onToggle={() => setIsCompanion((value) => !value)} />
              <SettingRow
                title="Incluye categorias complementarias"
                description="Permite elegir productos adicionales desde categorias relacionadas a este plato."
                enabled={hasAccompanimentConfig}
                onToggle={() => {
                  if (hasAccompanimentConfig) {
                    setAccompanimentCategoryIds([]);
                    return;
                  }
                  const firstAvailable = categories[0]?._id;
                  if (firstAvailable) setAccompanimentCategoryIds([firstAvailable]);
                }}
                tone="accent"
              />

              {hasAccompanimentConfig && (
                <div className="rounded-2xl border border-primary-100 bg-white p-4 shadow-[0_12px_30px_rgba(37,99,235,0.06)]">
                  <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Categorias que acompanan</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Selecciona las categorias que el sistema ofrecera como complemento de este producto.</p>
                    </div>
                    <div className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-right">
                      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary-700">Seleccionadas</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{selectedAccompanimentCategories.length}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {categories.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">No hay categorias disponibles para configurar.</div> : categories.map((category) => {
                      const selected = accompanimentCategoryIds.includes(category._id);
                      return (
                        <button
                          key={category._id}
                          type="button"
                          onClick={() => toggleAccompanimentCategory(category._id)}
                          className={cn('flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary-500', selected ? 'border-primary-200 bg-primary-50 text-slate-900 shadow-sm' : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300 hover:bg-white')}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{category.name}</p>
                            {category.description && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{category.description}</p>}
                          </div>
                          <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all', selected ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-300 bg-white text-transparent')}><Check size={12} /></span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedAccompanimentCategories.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{selectedAccompanimentCategories.map((category) => <span key={category._id} className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-800">{category.name}<button type="button" onClick={() => toggleAccompanimentCategory(category._id)} className="rounded-full text-primary-500 transition-colors hover:text-primary-800" aria-label={`Quitar ${category.name}`}><X size={12} /></button></span>)}</div>}
                </div>
              )}
            </div>
          </ProductSection>
        </div>
      </Modal>
    </div>
  );
};
