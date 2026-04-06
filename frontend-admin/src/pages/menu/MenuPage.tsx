import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search, Tag, X } from 'lucide-react';
import type { Category, Product, ModifierGroup } from '../../types';
import { api } from '../../config/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatCurrency } from '../../utils/format';
import toast from 'react-hot-toast';
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
  category: z.string().min(1, 'Categoría requerida'),
  estimatedTime: z.string().optional(),
  imageUrl: z.string().optional(),
});

type CategoryForm = z.infer<typeof categorySchema>;
type ProductForm = z.infer<typeof productSchema>;

export const MenuPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  // Category modal
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const { register: regCat, handleSubmit: submitCat, reset: resetCat, formState: { errors: catErrors, isSubmitting: catSubmitting } } = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) });

  // Product modal
  const [prodModal, setProdModal] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [accompanimentCategoryIds, setAccompanimentCategoryIds] = useState<string[]>([]);
  const [isCompanion, setIsCompanion] = useState(false);
  const { register: regProd, handleSubmit: submitProd, reset: resetProd, formState: { errors: prodErrors, isSubmitting: prodSubmitting } } = useForm<ProductForm>({ resolver: zodResolver(productSchema) });

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
    } catch { toast.error('Error al cargar menú'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || (typeof p.category === 'string' ? p.category === catFilter : p.category._id === catFilter);
    return matchSearch && matchCat;
  });

  // Category CRUD
  const openCreateCat = () => { setEditingCat(null); resetCat({ name: '', description: '', order: '' }); setCatModal(true); };
  const openEditCat = (cat: Category) => { setEditingCat(cat); resetCat({ name: cat.name, description: cat.description || '', order: String(cat.order) }); setCatModal(true); };

  const onSaveCat = async (data: CategoryForm) => {
    try {
      const payload = { name: data.name, description: data.description, order: data.order ? parseInt(data.order) : 0 };
      if (editingCat) {
        await api.patch(`/menu/categories/${editingCat._id}`, payload);
        toast.success('Categoría actualizada');
      } else {
        await api.post('/menu/categories', payload);
        toast.success('Categoría creada');
      }
      setCatModal(false);
      fetchAll();
    } catch { toast.error('Error al guardar categoría'); }
  };

  const deleteCat = async (id: string) => {
    if (!confirm('¿Eliminar categoría?')) return;
    try { await api.delete(`/menu/categories/${id}`); toast.success('Categoría eliminada'); fetchAll(); }
    catch { toast.error('Error al eliminar'); }
  };

  // Product CRUD
  const openCreateProd = () => {
    setEditingProd(null);
    setAccompanimentCategoryIds([]);
    setIsCompanion(false);
    resetProd({ name: '', description: '', price: '', category: '', estimatedTime: '', imageUrl: '' });
    setProdModal(true);
  };

  const openEditProd = (p: Product) => {
    setEditingProd(p);
    resetProd({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      category: typeof p.category === 'string' ? p.category : p.category._id,
      estimatedTime: p.estimatedTime ? String(p.estimatedTime) : '',
      imageUrl: p.imageUrl || '',
    });
    setAccompanimentCategoryIds((p.accompanimentCategories || []).filter(Boolean));
    setIsCompanion(p.isCompanion ?? false);
    setProdModal(true);
  };

  const toggleAccompanimentCategory = (catId: string) => {
    setAccompanimentCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const onSaveProd = async (data: ProductForm) => {
    try {
      const payload = {
        name: data.name,
        description: data.description,
        price: parseFloat(data.price),
        category: data.category,
        estimatedTime: data.estimatedTime ? parseInt(data.estimatedTime) : undefined,
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
    } catch { toast.error('Error al guardar producto'); }
  };

  const toggleAvailability = async (id: string) => {
    try { await api.patch(`/menu/products/${id}/toggle-availability`); fetchAll(); }
    catch { toast.error('Error'); }
  };

  const deleteProd = async (id: string) => {
    if (!confirm('¿Eliminar producto?')) return;
    try { await api.delete(`/menu/products/${id}`); toast.success('Producto eliminado'); fetchAll(); }
    catch { toast.error('Error al eliminar'); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'categories', label: `Categorías (${categories.length})` },
    { key: 'products', label: `Productos (${products.length})` },
    { key: 'modifiers', label: `Modificadores (${modifierGroups.length})` },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Menú</h1>
        {tab === 'categories' && <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCreateCat}>Nueva categoría</Button>}
        {tab === 'products' && <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCreateProd}>Nuevo producto</Button>}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-100">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-all',
                tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products filters */}
      {tab === 'products' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* Categories tab */}
      {tab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />) :
            categories.length === 0 ? (
              <div className="col-span-full text-center py-16 text-slate-400">
                <Tag size={40} className="mx-auto mb-3 opacity-30" />
                <p>Sin categorías. Crea la primera.</p>
              </div>
            ) : categories.map((cat) => (
              <div key={cat._id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{cat.name}</p>
                  {cat.description && <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>}
                  <Badge variant={cat.isActive ? 'success' : 'gray'} size="sm" className="mt-1.5">
                    {cat.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditCat(cat)} className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => deleteCat(cat._id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Products tab */}
      {tab === 'products' && (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-100 p-4">
                  <div className="skeleton h-4 w-32 rounded mb-2" />
                  <div className="skeleton h-3 w-20 rounded" />
                </div>
              ))
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-10 text-slate-400">Sin productos</div>
            ) : filteredProducts.map((product) => (
              <div key={product._id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xl flex-shrink-0">🍽️</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-medium text-slate-900 text-sm truncate">{product.name}</p>
                    {product.isCompanion && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 text-amber-700">Acomp.</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {typeof product.category === 'string' ? product.category : product.category.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(product.price)}</span>
                    <Badge variant={product.isAvailable ? 'success' : 'error'} size="sm">
                      {product.isAvailable ? 'Disponible' : 'Agotado'}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => toggleAvailability(product._id)} className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50" title="Disponibilidad">
                    {product.isAvailable ? <ToggleRight size={17} className="text-emerald-500" /> : <ToggleLeft size={17} />}
                  </button>
                  <button onClick={() => openEditProd(product)} className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => deleteProd(product._id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Producto</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Categoría</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Precio</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-5 py-3"><div className="skeleton h-4 rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-slate-400">Sin productos</td></tr>
                ) : filteredProducts.map((product) => (
                  <tr key={product._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-lg">🍽️</div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-slate-900 text-sm">{product.name}</p>
                            {product.isCompanion && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 text-amber-700">Acompañante</span>
                            )}
                            {product.accompanimentCategories && product.accompanimentCategories.length > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-violet-100 text-violet-700">
                                +{product.accompanimentCategories.length} cat.
                              </span>
                            )}
                          </div>
                          {product.estimatedTime && <p className="text-xs text-slate-400">~{product.estimatedTime}min</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">
                      {typeof product.category === 'string' ? product.category : product.category.name}
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">{formatCurrency(product.price)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={product.isAvailable ? 'success' : 'error'} size="sm">
                        {product.isAvailable ? 'Disponible' : 'Agotado'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => toggleAvailability(product._id)} className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50" title="Cambiar disponibilidad">
                          {product.isAvailable ? <ToggleRight size={17} className="text-emerald-500" /> : <ToggleLeft size={17} />}
                        </button>
                        <button onClick={() => openEditProd(product)} className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => deleteProd(product._id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modifiers tab */}
      {tab === 'modifiers' && (
        <div className="space-y-3">
          {modifierGroups.length === 0 ? (
            <div className="text-center py-16 text-slate-400">Sin modificadores creados</div>
          ) : modifierGroups.map((group) => (
            <div key={group._id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-900">{group.name}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={group.required ? 'error' : 'gray'} size="sm">{group.required ? 'Obligatorio' : 'Opcional'}</Badge>
                    <Badge variant="info" size="sm">{group.multipleSelection ? 'Múltiple' : 'Único'}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.options.map((opt) => (
                  <div key={opt._id} className="flex items-center gap-1 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                    <span className="text-slate-700">{opt.name}</span>
                    {opt.priceAdd > 0 && <span className="text-emerald-600 font-medium">+{formatCurrency(opt.priceAdd)}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Modal */}
      <Modal isOpen={catModal} onClose={() => setCatModal(false)} title={editingCat ? 'Editar categoría' : 'Nueva categoría'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCatModal(false)}>Cancelar</Button>
            <Button variant="primary" loading={catSubmitting} onClick={submitCat(onSaveCat)}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nombre" placeholder="Ej: Entradas, Bebidas" {...regCat('name')} error={catErrors.name?.message} />
          <Input label="Descripción (opcional)" placeholder="Descripción de la categoría" {...regCat('description')} />
          <Input label="Orden" type="number" placeholder="1" {...regCat('order')} />
        </div>
      </Modal>

      {/* Product Modal */}
      <Modal isOpen={prodModal} onClose={() => setProdModal(false)} title={editingProd ? 'Editar producto' : 'Nuevo producto'} size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setProdModal(false)}>Cancelar</Button>
            <Button variant="primary" loading={prodSubmitting} onClick={submitProd(onSaveProd)}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nombre del producto" placeholder="Ej: Hamburguesa clásica" {...regProd('name')} error={prodErrors.name?.message} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Precio (S/)" type="number" step="0.01" placeholder="0.00" {...regProd('price')} error={prodErrors.price?.message} />
            <Select
              label="Categoría"
              {...regProd('category')}
              error={prodErrors.category?.message}
              options={[{ value: '', label: 'Seleccionar...' }, ...categories.map((c) => ({ value: c._id, label: c.name }))]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción (opcional)</label>
            <textarea {...regProd('description')} rows={2} placeholder="Describe el producto" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Tiempo estimado (min)" type="number" placeholder="10" {...regProd('estimatedTime')} />
            <Input label="URL imagen (opcional)" placeholder="https://..." {...regProd('imageUrl')} />
          </div>

          {/* Is companion toggle */}
          <div className="flex items-center justify-between px-4 py-3 border border-slate-200 rounded-xl bg-slate-50">
            <div>
              <p className="text-sm font-semibold text-slate-800">¿Es solo acompañante?</p>
              <p className="text-xs text-slate-500 mt-0.5">No aparecerá en la lista principal del menú</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer" onClick={() => setIsCompanion((v) => !v)}>
              <span className="text-xs text-slate-500">{isCompanion ? 'Sí' : 'No'}</span>
              <div className={cn('relative w-10 h-5 rounded-full transition-colors', isCompanion ? 'bg-amber-500' : 'bg-slate-300')}>
                <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', isCompanion ? 'translate-x-5' : 'translate-x-0.5')} />
              </div>
            </label>
          </div>

          {/* Accompaniment categories */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-800">¿Viene acompañado de otra categoría?</p>
                <p className="text-xs text-slate-500 mt-0.5">El cliente podrá elegir un plato de cada categoría seleccionada</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-slate-500">{accompanimentCategoryIds.length > 0 ? 'Sí' : 'No'}</span>
                <div
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors cursor-pointer',
                    accompanimentCategoryIds.length > 0 ? 'bg-primary-500' : 'bg-slate-300'
                  )}
                  onClick={() => {
                    if (accompanimentCategoryIds.length > 0) setAccompanimentCategoryIds([]);
                  }}
                >
                  <div className={cn(
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    accompanimentCategoryIds.length > 0 ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </div>
              </label>
            </div>

            <div className="px-4 py-3 space-y-3">
              <p className="text-xs text-slate-500">Selecciona las categorías que acompañan este plato:</p>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-44 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 text-center">No hay categorías disponibles</p>
                ) : categories.map((cat) => (
                  <label key={cat._id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={accompanimentCategoryIds.includes(cat._id)}
                      onChange={() => toggleAccompanimentCategory(cat._id)}
                      className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-800">{cat.name}</span>
                  </label>
                ))}
              </div>

              {accompanimentCategoryIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {accompanimentCategoryIds.map((id) => {
                    const cat = categories.find((c) => c._id === id);
                    return cat ? (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium border border-primary-100"
                      >
                        {cat.name}
                        <button
                          type="button"
                          onClick={() => toggleAccompanimentCategory(id)}
                          className="text-primary-400 hover:text-primary-700 ml-0.5"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
