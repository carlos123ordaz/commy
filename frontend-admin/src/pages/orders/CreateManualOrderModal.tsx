import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ClipboardList,
  LayoutGrid,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import type { Category, Order, Product, Table } from '../../types';
import { api } from '../../config/api';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/format';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';

interface AccompanimentSelection {
  categoryId: string;
  categoryName: string;
  productId: string;
  productName: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
  selectedAccompaniments: AccompanimentSelection[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (order: Order) => void;
}

const STAFF_SESSION_ID = crypto.randomUUID
  ? crypto.randomUUID()
  : '00000000-0000-4000-8000-000000000001';

export const CreateManualOrderModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('');
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<'table' | 'menu'>('table');
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [pickingProduct, setPickingProduct] = useState<Product | null>(null);
  const [pendingAccompaniments, setPendingAccompaniments] = useState<Record<string, AccompanimentSelection>>({});
  const [accompanimentProducts, setAccompanimentProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    setStep('table');
    setSelectedTableId('');
    setCategories([]);
    setProducts([]);
    setCart([]);
    setNotes('');
    setSearch('');
    setActiveCat('');
    setPickingProduct(null);
    setPendingAccompaniments({});
    setAccompanimentProducts([]);

    api.get('/tables').then((res) => setTables(res.data.data)).catch(() => {});
    api.get('/restaurants/me/info').then((res) => setRestaurantId(res.data.data._id)).catch(() => {});
  }, [isOpen]);

  const loadMenu = useCallback(async (rId: string) => {
    setLoadingMenu(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get(`/menu/public/${rId}/categories`),
        api.get(`/menu/public/${rId}/products`),
      ]);

      const nextCategories = catRes.data.data;
      setCategories(nextCategories);
      setProducts(prodRes.data.data);
      setActiveCat(nextCategories[0]?._id ?? '');
    } catch {
      toast.error('Error al cargar el menu');
    } finally {
      setLoadingMenu(false);
    }
  }, []);

  const cartKey = (productId: string, acc: AccompanimentSelection[]) =>
    `${productId}|${acc.map((a) => `${a.categoryId}:${a.productId}`).sort().join(',')}`;

  const addSimpleToCart = (product: Product, accompaniments: AccompanimentSelection[]) => {
    setCart((prev) => {
      const key = cartKey(product._id, accompaniments);
      const existing = prev.find((item) => cartKey(item.product._id, item.selectedAccompaniments) === key);

      if (existing) {
        return prev.map((item) =>
          cartKey(item.product._id, item.selectedAccompaniments) === key
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prev, { product, quantity: 1, notes: '', selectedAccompaniments: accompaniments }];
    });
  };

  const handleContinue = () => {
    if (!selectedTableId) {
      toast.error('Selecciona una mesa');
      return;
    }

    setStep('menu');
    if (restaurantId) loadMenu(restaurantId);
  };

  const handleProductClick = async (product: Product) => {
    if (!product.isAvailable) return;

    if (product.productType === 'configurable' || product.productType === 'combo') {
      toast.error('Los productos configurables o combo no estan disponibles en ordenes manuales');
      return;
    }

    if (product.productType === 'menu') {
      toast.error('Los productos tipo menu no estan disponibles en ordenes manuales');
      return;
    }

    if (product.accompanimentCategories && product.accompanimentCategories.length > 0) {
      try {
        const res = await api.get(`/menu/public/${restaurantId}/products/${product._id}`);
        const companions: Product[] = res.data.data.accompanimentProducts ?? [];
        setAccompanimentProducts(companions);
      } catch {
        setAccompanimentProducts([]);
      }

      setPickingProduct(product);
      setPendingAccompaniments({});
      return;
    }

    addSimpleToCart(product, []);
  };

  const accompanimentCategoryName = (catId: string) =>
    categories.find((category) => category._id === catId)?.name ?? catId;

  const productsForAccompanimentCat = (catId: string) =>
    accompanimentProducts.filter((product) => {
      const productCategoryId =
        typeof product.category === 'string' ? product.category : (product.category as Category)._id;

      return productCategoryId === catId && product.isAvailable;
    });

  const allAccompanimentsFilled = pickingProduct
    ? (pickingProduct.accompanimentCategories ?? []).every((catId) => !!pendingAccompaniments[catId])
    : false;

  const confirmAccompaniments = () => {
    if (!pickingProduct || !allAccompanimentsFilled) return;

    addSimpleToCart(pickingProduct, Object.values(pendingAccompaniments));
    setPickingProduct(null);
    setPendingAccompaniments({});
    setAccompanimentProducts([]);
  };

  const removeCartItem = (key: string) => {
    setCart((prev) =>
      prev.filter((item) => cartKey(item.product._id, item.selectedAccompaniments) !== key)
    );
  };

  const changeQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          cartKey(item.product._id, item.selectedAccompaniments) === key
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart]
  );

  const cartUnits = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const categoryId =
          typeof product.category === 'string' ? product.category : (product.category as Category)._id;

        const matchesCategory = !activeCat || categoryId === activeCat;
        const matchesSearch = !search || product.name.toLowerCase().includes(search.toLowerCase());

        return matchesCategory && matchesSearch;
      }),
    [products, activeCat, search]
  );

  const selectedTable = useMemo(
    () => tables.find((table) => table._id === selectedTableId),
    [tables, selectedTableId]
  );

  const handleSubmit = async () => {
    if (!selectedTableId || cart.length === 0) return;

    setSubmitting(true);
    try {
      const orderRes = await api.post('/orders/manual', {
        tableId: selectedTableId,
        notes: notes || undefined,
      });
      const order: Order = orderRes.data.data;

      for (const item of cart) {
        await api.post(`/orders/${order._id}/items`, {
          productId: item.product._id,
          quantity: item.quantity,
          notes: item.notes || undefined,
          sessionId: STAFF_SESSION_ID,
          alias: 'Staff',
          selectedAccompaniments: item.selectedAccompaniments,
        });
      }

      const finalRes = await api.get(`/orders/${order._id}`);
      onCreated(finalRes.data.data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al crear pedido');
    } finally {
      setSubmitting(false);
    }
  };

  const freeTables = tables.filter((table) => table.status === 'free');

  const modalTitle = pickingProduct ? (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600">
        Configurar producto
      </p>
      <h2 className="text-lg font-semibold text-slate-950">{pickingProduct.name}</h2>
      <p className="text-sm text-slate-500">
        Selecciona los acompanamientos requeridos antes de agregarlo al carrito.
      </p>
    </div>
  ) : step === 'table' ? (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600">
        Pedido manual
      </p>
      <h2 className="text-lg font-semibold text-slate-950">Nueva orden manual</h2>
      <p className="text-sm text-slate-500">
        Define la mesa y arma el pedido con una interfaz pensada para caja y atencion.
      </p>
    </div>
  ) : (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600">
        Pedido manual
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-950">Nueva orden manual</h2>
        {selectedTable && (
          <span className="inline-flex items-center rounded-md border border-primary-200 bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">
            Mesa {selectedTable.name}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-500">
        Busca, agrega y confirma sin salir del flujo operativo.
      </p>
    </div>
  );

  const footer = pickingProduct ? (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-500">
        {Object.keys(pendingAccompaniments).length}
        {' / '}
        {pickingProduct.accompanimentCategories?.length ?? 0}
        {' '}selecciones completas
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setPickingProduct(null);
            setAccompanimentProducts([]);
          }}
        >
          <ChevronLeft size={14} className="mr-1" />
          Cancelar
        </Button>
        <Button variant="primary" disabled={!allAccompanimentsFilled} onClick={confirmAccompaniments}>
          Agregar al carrito
        </Button>
      </div>
    </div>
  ) : step === 'table' ? (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        {selectedTable ? `Mesa lista: ${selectedTable.name}` : 'Selecciona una mesa para continuar'}
      </p>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleContinue} disabled={!selectedTableId}>
          Continuar
          <ArrowRight size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total actual</p>
        <div className="mt-1 flex items-end gap-3">
          <span className="text-2xl font-semibold text-slate-950">{formatCurrency(cartTotal)}</span>
          <span className="pb-1 text-sm text-slate-500">
            {cartUnits} item{cartUnits !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => setStep('table')}>
          <ChevronLeft size={14} className="mr-1" />
          Atras
        </Button>
        <Button
          variant="primary"
          loading={submitting}
          disabled={cart.length === 0}
          onClick={handleSubmit}
          className="min-w-[180px]"
        >
          Crear pedido
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size={step === 'menu' ? '4xl' : 'lg'}
      footer={footer}
      headerClassName="border-slate-200 bg-gradient-to-r from-white via-white to-slate-50"
      contentClassName={cn('px-4 py-4 sm:px-6 sm:py-5', step === 'menu' && !pickingProduct && 'overflow-hidden')}
      footerClassName="border-slate-200 bg-gradient-to-r from-slate-50 to-white"
      className="border border-slate-200/80"
    >
      {pickingProduct && (
        <div className="space-y-5">
          {(pickingProduct.accompanimentCategories ?? []).map((catId) => {
            const catName = accompanimentCategoryName(catId);
            const catProducts = productsForAccompanimentCat(catId);
            const selected = pendingAccompaniments[catId];

            return (
              <section key={catId} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{catName}</p>
                    <p className="text-xs text-slate-500">Seleccion obligatoria</p>
                  </div>
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500">
                    1 opcion
                  </span>
                </div>

                {catProducts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-400">
                    No hay productos disponibles en esta categoria.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {catProducts.map((product) => (
                      <button
                        key={product._id}
                        onClick={() =>
                          setPendingAccompaniments((prev) => ({
                            ...prev,
                            [catId]: {
                              categoryId: catId,
                              categoryName: catName,
                              productId: product._id,
                              productName: product.name,
                            },
                          }))
                        }
                        className={cn(
                          'group rounded-2xl border bg-white px-4 py-3 text-left transition-all duration-150',
                          selected?.productId === product._id
                            ? 'border-primary-300 bg-primary-50/70 shadow-sm ring-1 ring-primary-100'
                            : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                            {product.description && (
                              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{product.description}</p>
                            )}
                          </div>
                          <span
                            className={cn(
                              'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border',
                              selected?.productId === product._id
                                ? 'border-primary-500 bg-primary-600 text-white'
                                : 'border-slate-300 bg-white text-transparent group-hover:text-slate-300'
                            )}
                          >
                            <Check size={12} />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {!pickingProduct && step === 'table' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                <ClipboardList size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">Seleccion de mesa</p>
                <p className="text-sm text-slate-500">
                  Elige una mesa libre y deja notas operativas si hacen falta.
                </p>
              </div>
            </div>

            {freeTables.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
                No hay mesas libres disponibles.
              </div>
            ) : (
              <div className="grid max-h-[320px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3">
                {freeTables.map((table) => {
                  const isSelected = selectedTableId === table._id;

                  return (
                    <button
                      key={table._id}
                      onClick={() => setSelectedTableId(table._id)}
                      className={cn(
                        'group rounded-2xl border bg-white px-4 py-3 text-left transition-all duration-150',
                        isSelected
                          ? 'border-primary-300 bg-primary-50/70 shadow-sm ring-1 ring-primary-100'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{table.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{table.zone || 'Salon principal'}</p>
                        </div>
                        <span
                          className={cn(
                            'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border',
                            isSelected
                              ? 'border-primary-500 bg-primary-600 text-white'
                              : 'border-slate-300 bg-white text-transparent group-hover:text-slate-300'
                          )}
                        >
                          <Check size={12} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <label className="mb-2 block text-sm font-medium text-slate-800">Notas del pedido</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100"
              placeholder="Ejemplo: sin cebolla, salida prioritaria, cliente espera acompanamiento."
            />
          </section>
        </div>
      )}

      {!pickingProduct && step === 'menu' && (
        <div className="flex h-[72vh] min-h-[560px] min-w-0 min-h-0 flex-col gap-4 lg:flex-row">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Catalogo</p>
                    <p className="text-sm text-slate-500">
                      {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} disponibles
                    </p>
                  </div>
                  <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 sm:flex">
                    <LayoutGrid size={14} />
                    Flujo rapido
                  </div>
                </div>

                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setActiveCat('');
                    }}
                    placeholder="Buscar producto por nombre"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100"
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    onClick={() => {
                      setActiveCat('');
                      setSearch('');
                    }}
                    className={cn(
                      'whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                      !activeCat && !search
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    )}
                  >
                    Todo
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category._id}
                      onClick={() => {
                        setActiveCat(category._id);
                        setSearch('');
                      }}
                      className={cn(
                        'whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                        activeCat === category._id
                          ? 'border-primary-300 bg-primary-50 text-primary-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      )}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {loadingMenu ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className="skeleton h-36 rounded-2xl" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                  <div>
                    <p className="text-sm font-medium text-slate-700">No se encontraron productos</p>
                    <p className="mt-1 text-sm text-slate-500">Ajusta la busqueda o cambia la categoria.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredProducts.map((product) => {
                    const isUnsupported =
                      product.productType === 'configurable' ||
                      product.productType === 'combo' ||
                      product.productType === 'menu';
                    const productEntries = cart.filter((item) => item.product._id === product._id);
                    const totalQty = productEntries.reduce((sum, item) => sum + item.quantity, 0);
                    const hasAccompaniments = (product.accompanimentCategories ?? []).length > 0;
                    const disabled = !product.isAvailable || isUnsupported;

                    return (
                      <button
                        key={product._id}
                        onClick={() => handleProductClick(product)}
                        disabled={disabled}
                        title={isUnsupported ? 'Tipo no soportado en ordenes manuales' : undefined}
                        className={cn(
                          'group relative flex min-h-[152px] flex-col rounded-2xl border px-4 py-3 text-left transition-all duration-150',
                          disabled
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-50'
                            : totalQty > 0
                              ? 'border-primary-300 bg-gradient-to-br from-primary-50 via-white to-primary-50/60 shadow-sm ring-1 ring-primary-100'
                              : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'
                        )}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
                              {product.name}
                            </p>
                            {product.description && (
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                {product.description}
                              </p>
                            )}
                          </div>

                          {totalQty > 0 && (
                            <span className="inline-flex min-w-[34px] justify-center rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white shadow-sm">
                              x{totalQty}
                            </span>
                          )}
                        </div>

                        <div className="mt-auto space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-950">
                              {formatCurrency(product.price)}
                            </span>
                            {hasAccompaniments && (
                              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                                Requiere seleccion
                              </span>
                            )}
                            {disabled && (
                              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500">
                                No disponible
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 rounded-full',
                                  totalQty > 0 ? 'bg-primary-500' : 'bg-slate-300'
                                )}
                              />
                              {totalQty > 0 ? 'Ya agregado' : 'Listo para agregar'}
                            </div>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all',
                                disabled
                                  ? 'border border-slate-200 bg-white text-slate-400'
                                  : totalQty > 0
                                    ? 'bg-primary-600 text-white'
                                    : 'border border-slate-200 bg-slate-50 text-slate-700 group-hover:border-slate-300 group-hover:bg-white'
                              )}
                            >
                              <Plus size={12} />
                              Agregar
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 via-white to-white lg:w-[360px]">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={16} className="text-slate-700" />
                    <p className="text-sm font-semibold text-slate-950">Carrito</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {cartUnits} item{cartUnits !== 1 ? 's' : ''} preparados para confirmar
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(cartTotal)}</p>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {cart.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
                  <div>
                    <p className="text-sm font-medium text-slate-700">El carrito esta vacio</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Agrega productos desde el catalogo para construir el pedido.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => {
                    const key = cartKey(item.product._id, item.selectedAccompaniments);

                    return (
                      <div
                        key={key}
                        className="animate-fade-in rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-5 text-slate-900">
                              {item.product.name}
                            </p>
                            {item.selectedAccompaniments.length > 0 && (
                              <div className="mt-1 space-y-1">
                                {item.selectedAccompaniments.map((selection) => (
                                  <p key={selection.categoryId} className="text-xs leading-4 text-slate-500">
                                    {selection.categoryName}: {selection.productName}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => removeCartItem(key)}
                            className="rounded-lg p-1.5 text-slate-300 transition-all hover:bg-red-50 hover:text-red-500"
                            aria-label={`Eliminar ${item.product.name}`}
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                            <button
                              onClick={() => changeQty(key, -1)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-all hover:bg-white hover:shadow-sm"
                              aria-label={`Restar ${item.product.name}`}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-8 text-center text-sm font-semibold text-slate-900">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => changeQty(key, 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-all hover:bg-white hover:shadow-sm"
                              aria-label={`Sumar ${item.product.name}`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-slate-500">
                              {item.quantity} x {formatCurrency(item.product.price)}
                            </p>
                            <p className="text-sm font-semibold text-slate-950">
                              {formatCurrency(item.product.price * item.quantity)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white/90 px-4 py-4 sm:px-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-700">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Total a confirmar
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">{formatCurrency(cartTotal)}</p>
                  </div>
                  <span className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white">
                    {cartUnits} item{cartUnits !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </Modal>
  );
};
