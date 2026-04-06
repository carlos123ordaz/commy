import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Minus, Search, X, ChevronLeft } from 'lucide-react';
import type { Order, Table, Category, Product } from '../../types';
import { api } from '../../config/api';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/format';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// A stable staff session UUID for the lifetime of the admin session
const STAFF_SESSION_ID = crypto.randomUUID
  ? crypto.randomUUID()
  : '00000000-0000-4000-8000-000000000001';

// ─── Component ────────────────────────────────────────────────────────────────

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

  // Accompaniment picker state
  const [pickingProduct, setPickingProduct] = useState<Product | null>(null);
  const [pendingAccompaniments, setPendingAccompaniments] = useState<Record<string, AccompanimentSelection>>({});
  const [accompanimentProducts, setAccompanimentProducts] = useState<Product[]>([]);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setStep('table');
    setSelectedTableId('');
    setCart([]);
    setNotes('');
    setSearch('');
    setPickingProduct(null);
    setPendingAccompaniments({});
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
      setCategories(catRes.data.data);
      setProducts(prodRes.data.data);
      setActiveCat(catRes.data.data[0]?._id ?? '');
    } catch {
      toast.error('Error al cargar el menú');
    } finally {
      setLoadingMenu(false);
    }
  }, []);

  const handleContinue = () => {
    if (!selectedTableId) return toast.error('Selecciona una mesa');
    setStep('menu');
    if (restaurantId) loadMenu(restaurantId);
  };

  // ── Product click: if it has accompaniment categories, open picker ──────────

  const handleProductClick = async (product: Product) => {
    if (!product.isAvailable) return;
    if (product.productType === 'configurable' || product.productType === 'combo') {
      toast.error('Los productos configurables/combo no están disponibles en órdenes manuales');
      return;
    }
    if (product.productType === 'menu') {
      toast.error('Los productos tipo menú no están disponibles en órdenes manuales');
      return;
    }
    // simple product — may or may not have accompaniment categories
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
    } else {
      // Add directly to cart
      addSimpleToCart(product, []);
    }
  };

  const addSimpleToCart = (product: Product, accompaniments: AccompanimentSelection[]) => {
    setCart((prev) => {
      // If already in cart with same accompaniments, increment qty
      const key = cartKey(product._id, accompaniments);
      const existing = prev.find((c) => cartKey(c.product._id, c.selectedAccompaniments) === key);
      if (existing) {
        return prev.map((c) =>
          cartKey(c.product._id, c.selectedAccompaniments) === key
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { product, quantity: 1, notes: '', selectedAccompaniments: accompaniments }];
    });
  };

  /** Stable key for a cart item (product + accompaniment combination) */
  const cartKey = (productId: string, acc: AccompanimentSelection[]) =>
    productId + '|' + acc.map((a) => a.categoryId + ':' + a.productId).sort().join(',');

  // ── Accompaniment picker helpers ─────────────────────────────────────────────

  const accompanimentCategoryName = (catId: string) =>
    categories.find((c) => c._id === catId)?.name ?? catId;

  const productsForAccompanimentCat = (catId: string) =>
    accompanimentProducts.filter((p) => {
      const pCatId = typeof p.category === 'string' ? p.category : (p.category as Category)._id;
      return pCatId === catId && p.isAvailable;
    });

  const allAccompanimentsFilled = pickingProduct
    ? (pickingProduct.accompanimentCategories ?? []).every(
        (catId) => !!pendingAccompaniments[catId]
      )
    : false;

  const confirmAccompaniments = () => {
    if (!pickingProduct || !allAccompanimentsFilled) return;
    addSimpleToCart(pickingProduct, Object.values(pendingAccompaniments));
    setPickingProduct(null);
    setPendingAccompaniments({});
    setAccompanimentProducts([]);
  };

  // ── Cart helpers ─────────────────────────────────────────────────────────────

  const changeQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          cartKey(c.product._id, c.selectedAccompaniments) === key
            ? { ...c, quantity: c.quantity + delta }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((s, c) => s + c.product.price * c.quantity, 0);

  const filteredProducts = products.filter((p) => {
    const catId = typeof p.category === 'string' ? p.category : (p.category as Category)._id;
    const matchesCat = !activeCat || catId === activeCat;
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedTableId || cart.length === 0) return;
    setSubmitting(true);
    try {
      // 1. Create the order (manual, starts as pending_confirmation)
      const orderRes = await api.post('/orders/manual', {
        tableId: selectedTableId,
        notes: notes || undefined,
      });
      const order: Order = orderRes.data.data;

      // 2. Add each cart item
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

      // 3. Return the fully populated order
      const finalRes = await api.get(`/orders/${order._id}`);
      onCreated(finalRes.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Error al crear pedido');
    } finally {
      setSubmitting(false);
    }
  };

  const freeTables = tables.filter((t) => t.status === 'free');

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        pickingProduct
          ? `Acompañamientos — ${pickingProduct.name}`
          : step === 'table'
            ? 'Nueva Orden Manual'
            : 'Nueva Orden Manual'
      }
      size={step === 'menu' ? 'xl' : 'sm'}
      footer={
        pickingProduct ? (
          <>
            <Button variant="secondary" onClick={() => { setPickingProduct(null); setAccompanimentProducts([]); }}>
              <ChevronLeft size={14} className="mr-1" />Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={!allAccompanimentsFilled}
              onClick={confirmAccompaniments}
            >
              Agregar al carrito
            </Button>
          </>
        ) : step === 'table' ? (
          <>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={handleContinue} disabled={!selectedTableId}>
              Continuar
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep('table')}>← Atrás</Button>
            <Button
              variant="primary"
              loading={submitting}
              disabled={cart.length === 0}
              onClick={handleSubmit}
            >
              Crear pedido ({formatCurrency(cartTotal)})
            </Button>
          </>
        )
      }
    >
      {/* ── Accompaniment picker overlay ── */}
      {pickingProduct && (
        <div className="space-y-5">
          {(pickingProduct.accompanimentCategories ?? []).map((catId) => {
            const catName = accompanimentCategoryName(catId);
            const catProducts = productsForAccompanimentCat(catId);
            const selected = pendingAccompaniments[catId];
            return (
              <div key={catId}>
                <p className="text-sm font-semibold text-slate-800 mb-2">
                  {catName}
                  <span className="ml-2 text-xs font-normal text-red-500">*requerido</span>
                </p>
                {catProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3">
                    No hay productos disponibles en esta categoría
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {catProducts.map((p) => (
                      <button
                        key={p._id}
                        onClick={() =>
                          setPendingAccompaniments((prev) => ({
                            ...prev,
                            [catId]: {
                              categoryId: catId,
                              categoryName: catName,
                              productId: p._id,
                              productName: p.name,
                            },
                          }))
                        }
                        className={cn(
                          'p-3 rounded-xl border-2 text-left text-sm transition-all',
                          selected?.productId === p._id
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300'
                        )}
                      >
                        <p className="font-medium leading-tight">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{p.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Step: table selection ── */}
      {!pickingProduct && step === 'table' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Selecciona la mesa para la orden manual:</p>
          {freeTables.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No hay mesas libres disponibles</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {freeTables.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setSelectedTableId(t._id)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    selectedTableId === t._id
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {t.name}
                  {t.zone && <span className="block text-xs text-slate-400 font-normal">{t.zone}</span>}
                </button>
              ))}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas del pedido (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Instrucciones especiales..."
            />
          </div>
        </div>
      )}

      {/* ── Step: menu ── */}
      {!pickingProduct && step === 'menu' && (
        <div className="flex flex-col sm:flex-row gap-4 sm:h-[60vh]">

          {/* ── Menu panel ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Search */}
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setActiveCat(''); }}
                placeholder="Buscar producto..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Categories - horizontal scroll on mobile */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => { setActiveCat(cat._id); setSearch(''); }}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeCat === cat._id
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Products - bounded height on mobile, flex-1 on desktop */}
            {loadingMenu ? (
              <div className="grid grid-cols-2 gap-2 max-h-52 sm:max-h-none sm:flex-1 sm:overflow-y-auto">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-20 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 content-start max-h-52 sm:max-h-none overflow-y-auto sm:flex-1">
                {filteredProducts.map((p) => {
                  const isUnsupported =
                    p.productType === 'configurable' ||
                    p.productType === 'combo' ||
                    p.productType === 'menu';
                  const inCart = cart.filter((c) => c.product._id === p._id);
                  const totalQty = inCart.reduce((s, c) => s + c.quantity, 0);
                  const hasAccompaniments =
                    p.accompanimentCategories && p.accompanimentCategories.length > 0;

                  return (
                    <button
                      key={p._id}
                      onClick={() => handleProductClick(p)}
                      disabled={!p.isAvailable || isUnsupported}
                      title={isUnsupported ? 'Tipo no soportado en órdenes manuales' : undefined}
                      className={cn(
                        'p-3 text-left rounded-xl border transition-all',
                        !p.isAvailable || isUnsupported
                          ? 'opacity-40 cursor-not-allowed border-slate-100'
                          : totalQty > 0
                            ? 'border-primary-300 bg-primary-50'
                            : 'border-slate-100 hover:border-slate-300 hover:shadow-sm'
                      )}
                    >
                      <p className="text-sm font-medium text-slate-800 leading-tight">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(p.price)}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {hasAccompaniments && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-medium">
                            + acomp.
                          </span>
                        )}
                        {totalQty > 0 && (
                          <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-md font-semibold">
                            ×{totalQty}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Cart panel - desktop sidebar ── */}
          <div className="hidden sm:flex w-56 flex-col border-l border-slate-100 pl-4">
            <p className="text-sm font-semibold text-slate-800 mb-3">
              Carrito {cart.length > 0 && `(${cart.length})`}
            </p>
            {cart.length === 0 ? (
              <p className="text-xs text-slate-400 text-center mt-8">Sin productos</p>
            ) : (
              <div className="flex-1 space-y-2 overflow-y-auto">
                {cart.map((item) => {
                  const key = cartKey(item.product._id, item.selectedAccompaniments);
                  return (
                    <div key={key} className="bg-slate-50 rounded-lg p-2">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-medium text-slate-800 flex-1 leading-tight">
                          {item.product.name}
                        </p>
                        <button
                          onClick={() => setCart((prev) => prev.filter((c) => cartKey(c.product._id, c.selectedAccompaniments) !== key))}
                          className="text-slate-300 hover:text-red-400 flex-shrink-0"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      {item.selectedAccompaniments.length > 0 && (
                        <div className="mt-0.5 space-y-0.5">
                          {item.selectedAccompaniments.map((a) => (
                            <p key={a.categoryId} className="text-xs text-slate-500">
                              {a.categoryName}: <span className="font-medium">{a.productName}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatCurrency(item.product.price * item.quantity)}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button onClick={() => changeQty(key, -1)} className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-300">
                          <Minus size={10} />
                        </button>
                        <span className="text-xs font-medium text-slate-700 w-4 text-center">{item.quantity}</span>
                        <button onClick={() => changeQty(key, 1)} className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-300">
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {cart.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex justify-between text-sm font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Cart panel - mobile (below products) ── */}
          {cart.length > 0 && (
            <div className="sm:hidden border-t border-slate-100 pt-3">
              <p className="text-sm font-semibold text-slate-800 mb-2">
                Carrito ({cart.reduce((s, c) => s + c.quantity, 0)} ítem{cart.reduce((s, c) => s + c.quantity, 0) !== 1 ? 's' : ''})
              </p>
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {cart.map((item) => {
                  const key = cartKey(item.product._id, item.selectedAccompaniments);
                  return (
                    <div key={key} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{item.product.name}</p>
                        {item.selectedAccompaniments.length > 0 && (
                          <p className="text-xs text-slate-400 truncate">
                            {item.selectedAccompaniments.map((a) => a.productName).join(', ')}
                          </p>
                        )}
                        <p className="text-xs text-slate-500">{formatCurrency(item.product.price * item.quantity)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => changeQty(key, -1)} className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-300">
                          <Minus size={11} />
                        </button>
                        <span className="text-sm font-semibold text-slate-700 w-5 text-center">{item.quantity}</span>
                        <button onClick={() => changeQty(key, 1)} className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-300">
                          <Plus size={11} />
                        </button>
                        <button
                          onClick={() => setCart((prev) => prev.filter((c) => cartKey(c.product._id, c.selectedAccompaniments) !== key))}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </Modal>
  );
};
