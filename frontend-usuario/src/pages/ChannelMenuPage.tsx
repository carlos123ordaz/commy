import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingBag, X, Plus, Minus, Loader2, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../config/api';
import { useSessionStore } from '../store/sessionStore';
import { useOrderSocket } from '../hooks/useOrderSocket';
import type {
  Category, Product, ModifierGroup, SelectedModifier, OrderItem,
  SelectionGroup, SelectedGroup, SelectedGroupOption,
  MenuGroup, MenuGroupProduct, SelectedAccompaniment,
} from '../types';
import { cn, formatCurrency } from '../utils/cn';
import toast from 'react-hot-toast';

const STATUS_INFO: Record<string, { label: string; icon: string; color: string }> = {
  pending_confirmation: { label: 'Esperando confirmación del restaurante...', icon: '⏳', color: 'bg-amber-50 text-amber-800' },
  confirmed: { label: 'Pedido confirmado — preparando...', icon: '✅', color: 'bg-blue-50 text-blue-800' },
  preparing: { label: 'Tu pedido está en preparación', icon: '👨‍🍳', color: 'bg-purple-50 text-purple-800' },
  ready: { label: '¡Tu pedido está listo!', icon: '🎉', color: 'bg-emerald-50 text-emerald-800' },
  served: { label: 'Pedido en camino / listo para recoger', icon: '🚀', color: 'bg-green-50 text-green-800' },
};

export const ChannelMenuPage: React.FC = () => {
  const { channelType, token } = useParams<{ channelType: string; token: string }>();
  const navigate = useNavigate();

  const {
    sessionId,
    channelToken,
    channelRestaurantId,
    channelCustomerInfo,
    orderId,
    order,
    setOrder,
    clearOrder,
  } = useSessionStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);

  // Product detail modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<SelectedGroup[]>([]);
  const [selectedMenuGroups, setSelectedMenuGroups] = useState<Record<string, string | null>>({});
  const [selectedAccompaniments, setSelectedAccompaniments] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [loadingMenuProduct, setLoadingMenuProduct] = useState(false);
  const [addingItem, setAddingItem] = useState(false);

  const categoryBarRef = useRef<HTMLDivElement>(null);

  // Guard: redirect if no valid channel session
  useEffect(() => {
    if (!channelToken || channelToken !== token || !channelCustomerInfo || !channelRestaurantId) {
      navigate(`/channel/${channelType}/${token}`, { replace: true });
    }
  }, [channelToken, token, channelCustomerInfo, channelRestaurantId]);

  // Subscribe to order socket for status updates
  useOrderSocket(orderId);

  // Fetch menu
  useEffect(() => {
    if (!channelRestaurantId) return;
    Promise.all([
      api.get(`/menu/public/${channelRestaurantId}/categories`),
      api.get(`/menu/public/${channelRestaurantId}/products`),
    ])
      .then(([catRes, prodRes]) => {
        setCategories(catRes.data.data);
        setProducts(prodRes.data.data);
      })
      .catch(() => toast.error('Error al cargar el menú'))
      .finally(() => setLoading(false));
  }, [channelRestaurantId]);

  // Refresh order if we already have one (e.g. page reload)
  const refreshOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await api.get(`/orders/${orderId}`);
      setOrder(res.data.data);
    } catch { /* ignore */ }
  }, [orderId]);

  useEffect(() => { refreshOrder(); }, [refreshOrder]);

  const isEditable = !order || order.status === 'draft';
  const orderStatus = order?.status;
  const statusInfo = orderStatus ? STATUS_INFO[orderStatus] : null;
  const isTerminal = orderStatus === 'closed' || orderStatus === 'billed' || orderStatus === 'cancelled';

  const filteredProducts = activeCategory === 'all'
    ? products
    : products.filter((p) => {
        const catId = typeof p.category === 'string' ? p.category : p.category._id;
        return catId === activeCategory;
      });

  // ── Product modal helpers ────────────────────────────────────────────────

  const openProduct = async (product: Product) => {
    if (!product.isAvailable || !isEditable) return;
    setQuantity(1);
    setSelectedModifiers([]);
    setSelectedGroups([]);
    setSelectedMenuGroups({});
    setSelectedAccompaniments({});
    setNotes('');

    const needsDetail = product.productType === 'menu' || (product.accompanimentCategories?.length ?? 0) > 0;
    if (needsDetail && channelRestaurantId) {
      setLoadingMenuProduct(true);
      try {
        const res = await api.get(`/menu/public/${channelRestaurantId}/products/${product._id}`);
        setSelectedProduct(res.data.data);
      } catch {
        setSelectedProduct(product);
      } finally {
        setLoadingMenuProduct(false);
      }
    } else {
      setSelectedProduct(product);
    }
  };

  const toggleSelectionOption = (group: SelectionGroup, option: { _id: string; name: string; priceDelta: number }) => {
    setSelectedGroups((prev) => {
      const existingGroupIdx = prev.findIndex((sg) => sg.groupId === group._id);
      const isSelected = prev.some((sg) => sg.groupId === group._id && sg.selectedOptions.some((o) => o.optionId === option._id));

      if (group.maxSelections === 1) {
        if (isSelected) return prev.filter((sg) => sg.groupId !== group._id);
        const updated = prev.filter((sg) => sg.groupId !== group._id);
        return [...updated, { groupId: group._id, groupName: group.name, selectedOptions: [{ optionId: option._id, optionName: option.name, priceDelta: option.priceDelta }] }];
      }

      if (isSelected) {
        if (existingGroupIdx === -1) return prev;
        const updatedOptions = prev[existingGroupIdx].selectedOptions.filter((o) => o.optionId !== option._id);
        if (updatedOptions.length === 0) return prev.filter((sg) => sg.groupId !== group._id);
        return prev.map((sg, i) => i === existingGroupIdx ? { ...sg, selectedOptions: updatedOptions } : sg);
      }

      const currentCount = existingGroupIdx >= 0 ? prev[existingGroupIdx].selectedOptions.length : 0;
      if (currentCount >= group.maxSelections) return prev;

      const newOption: SelectedGroupOption = { optionId: option._id, optionName: option.name, priceDelta: option.priceDelta };
      if (existingGroupIdx >= 0) {
        return prev.map((sg, i) => i === existingGroupIdx ? { ...sg, selectedOptions: [...sg.selectedOptions, newOption] } : sg);
      }
      return [...prev, { groupId: group._id, groupName: group.name, selectedOptions: [newOption] }];
    });
  };

  const toggleModifier = (group: ModifierGroup, optionId: string) => {
    const option = group.options.find((o) => o._id === optionId);
    if (!option) return;
    setSelectedModifiers((prev) => {
      const isSelected = prev.some((m) => m.optionId === optionId);
      if (isSelected) return prev.filter((m) => m.optionId !== optionId);
      if (!group.multipleSelection) {
        return [...prev.filter((m) => m.groupId !== group._id), { groupId: group._id, groupName: group.name, optionId: option._id, optionName: option.name, priceAdd: option.priceAdd }];
      }
      return [...prev, { groupId: group._id, groupName: group.name, optionId: option._id, optionName: option.name, priceAdd: option.priceAdd }];
    });
  };

  const getItemTotal = () => {
    if (!selectedProduct) return 0;
    if (selectedProduct.productType === 'menu') {
      const omitDiscount = (selectedProduct.menuGroups || []).reduce((sum, g) => {
        const val = selectedMenuGroups[g._id];
        if (val === null && !g.required) return sum + g.omitDiscount;
        return sum;
      }, 0);
      return Math.max(0, selectedProduct.price - omitDiscount) * quantity;
    }
    const modTotal = selectedModifiers.reduce((s, m) => s + m.priceAdd, 0);
    const selectionTotal = selectedGroups.reduce((s, sg) => s + sg.selectedOptions.reduce((ss, o) => ss + o.priceDelta, 0), 0);
    return (selectedProduct.price + modTotal + selectionTotal) * quantity;
  };

  const getSelectionGroupErrors = (): string[] => {
    if (!selectedProduct?.selectionGroups) return [];
    return selectedProduct.selectionGroups
      .filter((group) => {
        const sent = selectedGroups.find((sg) => sg.groupId === group._id);
        return group.required && (sent?.selectedOptions.length ?? 0) < group.minSelections;
      })
      .map((g) => g._id);
  };

  const getMenuGroupErrors = (): string[] => {
    if (!selectedProduct || selectedProduct.productType !== 'menu') return [];
    return (selectedProduct.menuGroups || [])
      .filter((g) => {
        const val = selectedMenuGroups[g._id];
        return g.required && (val === undefined || val === null);
      })
      .map((g) => g._id);
  };

  const getAccompanimentErrors = (): string[] => {
    if (!selectedProduct?.accompanimentCategories?.length) return [];
    return selectedProduct.accompanimentCategories.filter((catId) => !selectedAccompaniments[catId]);
  };

  const isMenuProduct = selectedProduct?.productType === 'menu';
  const isConfigurableProduct = selectedProduct && (selectedProduct.productType === 'configurable' || selectedProduct.productType === 'combo');
  const groupErrors = isConfigurableProduct ? getSelectionGroupErrors() : [];
  const menuGroupErrors = isMenuProduct ? getMenuGroupErrors() : [];
  const accompanimentErrors = getAccompanimentErrors();
  const canAdd = isEditable && groupErrors.length === 0 && menuGroupErrors.length === 0 && accompanimentErrors.length === 0;

  const addToOrder = async () => {
    if (!selectedProduct) return;

    // Validate required modifiers
    for (const group of selectedProduct.modifierGroups.filter((g) => g.required)) {
      if (!selectedModifiers.some((m) => m.groupId === group._id)) {
        toast.error(`Selecciona una opción en "${group.name}"`);
        return;
      }
    }
    if (groupErrors.length > 0) {
      const missing = selectedProduct.selectionGroups.find((g) => groupErrors.includes(g._id));
      toast.error(`Selecciona al menos ${missing?.minSelections} opción en "${missing?.name}"`);
      return;
    }
    if (menuGroupErrors.length > 0) {
      const missing = (selectedProduct.menuGroups || []).find((g) => menuGroupErrors.includes(g._id));
      toast.error(`Debes elegir una opción en "${missing?.name}"`);
      return;
    }
    if (accompanimentErrors.length > 0) {
      const missingCat = categories.find((c) => c._id === accompanimentErrors[0]);
      toast.error(`Debes elegir un acompañamiento de "${missingCat?.name ?? 'la categoría'}"`);
      return;
    }

    setAddingItem(true);
    try {
      // Lazy order creation on first item
      let currentOrderId = orderId;
      if (!currentOrderId) {
        const res = await api.post('/orders/channel', {
          channelToken: token,
          orderType: channelType,
          sessionId,
          customerInfo: channelCustomerInfo,
        });
        const newOrder = res.data.data;
        setOrder(newOrder);
        currentOrderId = newOrder._id;
      }

      // Build menu groups payload
      const menuGroupsPayload = isMenuProduct && selectedProduct
        ? (selectedProduct.menuGroups || []).map((g) => {
            const val = selectedMenuGroups[g._id];
            const omitted = val === null;
            const chosenProduct = !omitted && val
              ? (g.allowedProducts as MenuGroupProduct[]).find((p) => p._id === val)
              : undefined;
            return {
              groupId: g._id,
              groupKey: g.key,
              groupName: g.name,
              omitted,
              selectedProductId: omitted ? undefined : val ?? undefined,
              selectedProductName: chosenProduct?.name,
              omitDiscount: omitted ? g.omitDiscount : 0,
            };
          })
        : [];

      // Build accompaniments payload
      const accompanimentsPayload: SelectedAccompaniment[] = (selectedProduct.accompanimentCategories || [])
        .map((catId) => {
          const productId = selectedAccompaniments[catId];
          if (!productId) return null;
          const cat = categories.find((c) => c._id === catId);
          const allProds = selectedProduct.accompanimentProducts ?? products;
          const prod = allProds.find((p) => p._id === productId);
          if (!cat || !prod) return null;
          return { categoryId: catId, categoryName: cat.name, productId, productName: prod.name };
        })
        .filter((a): a is SelectedAccompaniment => a !== null);

      const res = await api.post(`/orders/${currentOrderId}/items`, {
        productId: selectedProduct._id,
        quantity,
        modifiers: isMenuProduct ? [] : selectedModifiers,
        selectedGroups: isMenuProduct ? [] : selectedGroups,
        selectedMenuGroups: menuGroupsPayload,
        selectedAccompaniments: accompanimentsPayload,
        notes: notes.trim() || undefined,
        sessionId,
        alias: channelCustomerInfo?.name,
      });
      // addItem returns { order, item } inside data.data
      setOrder(res.data.data?.order ?? res.data.data);
      setSelectedProduct(null);
      setCartBounce(true);
      setTimeout(() => setCartBounce(false), 400);
      toast.success(`${selectedProduct.name} agregado`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Error al agregar');
    } finally {
      setAddingItem(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!orderId) return;
    try {
      await api.delete(`/orders/${orderId}/items/${itemId}`, { data: { sessionId } });
      const res = await api.get(`/orders/${orderId}`);
      setOrder(res.data.data);
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const submitOrder = async () => {
    if (!orderId || !order || !order.items?.length) return;
    setSubmittingOrder(true);
    try {
      const res = await api.post(`/orders/${orderId}/submit`, { sessionId });
      setOrder(res.data.data);
      setOrderSheetOpen(false);
      toast.success('¡Pedido enviado!');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Error al enviar');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const totalItems = order?.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={28} className="text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="app-container bg-slate-50" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="bg-white sticky top-0 z-20 shadow-sm px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">
            {channelType === 'delivery' ? '🛵 Delivery' : '🥡 Para llevar'} · {channelCustomerInfo?.name}
          </p>
          <p className="text-sm font-semibold text-slate-800">Elige tus productos</p>
        </div>
        {isEditable && (
          <button
            className="relative p-2 text-slate-600"
            onClick={() => setOrderSheetOpen(true)}
          >
            <motion.div animate={cartBounce ? { scale: [1, 1.25, 1] } : {}}>
              <ShoppingBag size={22} />
            </motion.div>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {totalItems}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Status banner */}
      {statusInfo && (
        <div className={cn('mx-4 mt-4 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-medium', statusInfo.color)}>
          <span className="text-xl">{statusInfo.icon}</span>
          <span>{statusInfo.label}</span>
        </div>
      )}

      {/* Category bar */}
      <div
        ref={categoryBarRef}
        className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide bg-white mt-0 sticky top-[57px] z-10 border-b border-slate-100"
      >
        <button
          onClick={() => setActiveCategory('all')}
          className={cn(
            'flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all',
            activeCategory === 'all' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'
          )}
        >
          Todo
        </button>
        {categories.map((cat) => (
          <button
            key={cat._id}
            onClick={() => setActiveCategory(cat._id)}
            className={cn(
              'flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all',
              activeCategory === cat._id ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Products */}
      <div className="px-4 py-4 grid grid-cols-2 gap-3 pb-28">
          {filteredProducts.map((product) => {
            const qty = order?.items
              ?.filter((i) => {
                const pid = typeof i.product === 'string' ? i.product : i.product._id;
                return pid === product._id;
              })
              .reduce((s, i) => s + i.quantity, 0) ?? 0;

            return (
              <button
                key={product._id}
                onClick={() => openProduct(product)}
                disabled={!product.isAvailable}
                className={cn(
                  'bg-white rounded-2xl border border-slate-100 shadow-sm text-left p-3 transition-all active:scale-95',
                  !product.isAvailable && 'opacity-40 cursor-not-allowed'
                )}
              >
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-24 object-cover rounded-xl mb-2"
                  />
                )}
                <p className="text-sm font-semibold text-slate-800 leading-tight">{product.name}</p>
                {product.description && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{product.description}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-primary-600">{formatCurrency(product.price)}</span>
                  {qty > 0 && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-semibold">
                      ×{qty}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

      {/* Floating cart button */}
      {isEditable && totalItems > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-30 px-4">
          <button
            onClick={() => setOrderSheetOpen(true)}
            className="bg-primary-600 text-white px-6 py-3.5 rounded-2xl shadow-lg font-semibold text-sm flex items-center gap-2"
          >
            <ShoppingBag size={16} />
            Ver carrito ({totalItems})
            <span className="ml-2 font-bold">{formatCurrency(order?.total ?? 0)}</span>
          </button>
        </div>
      )}

      {/* Product Detail Sheet */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setSelectedProduct(null)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-[430px] bg-white rounded-t-3xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              {/* Image */}
              {selectedProduct.imageUrl ? (
                <div className="relative h-56">
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <X size={18} className="text-slate-700" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-5 pt-6 pb-2">
                  <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto" />
                  <button onClick={() => setSelectedProduct(null)} className="absolute right-4 top-4 w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center">
                    <X size={18} className="text-slate-600" />
                  </button>
                </div>
              )}

              <div className="px-5 pt-5 pb-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-900">{selectedProduct.name}</h2>
                    {selectedProduct.description && (
                      <p className="text-sm text-slate-500 mt-1">{selectedProduct.description}</p>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-primary-600 flex-shrink-0 ml-4">{formatCurrency(getItemTotal() / quantity)}</p>
                </div>

                {/* Menu groups */}
                {isMenuProduct && loadingMenuProduct && (
                  <div className="flex justify-center py-6">
                    <Loader2 size={24} className="animate-spin text-primary-500" />
                  </div>
                )}
                {isMenuProduct && !loadingMenuProduct && (selectedProduct.menuGroups || []).map((group: MenuGroup) => {
                  const val = selectedMenuGroups[group._id];
                  const hasError = menuGroupErrors.includes(group._id);
                  const availableProducts = (group.allowedProducts as MenuGroupProduct[]).filter((p) => p.isAvailable);

                  return (
                    <div key={group._id} className="mb-5">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <p className="font-semibold text-slate-900 text-sm">{group.name}</p>
                        {group.required ? (
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', hasError ? 'bg-red-100 text-red-600' : 'bg-red-50 text-red-500')}>
                            Obligatorio
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Opcional</span>
                        )}
                      </div>
                      {hasError && <p className="text-xs text-red-500 mb-2">Debes elegir una opción</p>}
                      <div className="space-y-2">
                        {availableProducts.map((p) => {
                          const isSelected = val === p._id;
                          return (
                            <button
                              key={p._id}
                              onClick={() => setSelectedMenuGroups((prev) => ({ ...prev, [group._id]: isSelected ? undefined as unknown as string : p._id }))}
                              className={cn('w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left', isSelected ? 'border-primary-500 bg-primary-50' : 'border-slate-100 bg-slate-50 active:scale-[0.98]')}
                            >
                              <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0', isSelected ? 'border-primary-500 bg-primary-500' : 'border-slate-300')}>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                              </div>
                              <span className="text-sm font-medium text-slate-800">{p.name}</span>
                            </button>
                          );
                        })}
                        {!group.required && group.allowNoneOption && (
                          <button
                            onClick={() => setSelectedMenuGroups((prev) => ({ ...prev, [group._id]: val === null ? undefined as unknown as string : null }))}
                            className={cn('w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left', val === null ? 'border-slate-400 bg-slate-100' : 'border-slate-100 bg-slate-50 active:scale-[0.98]')}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0', val === null ? 'border-slate-500 bg-slate-500' : 'border-slate-300')}>
                                {val === null && <div className="w-2 h-2 bg-white rounded-full" />}
                              </div>
                              <span className="text-sm font-medium text-slate-600 italic">Sin {group.name.toLowerCase()}</span>
                            </div>
                            {group.omitDiscount > 0 && (
                              <span className="text-sm font-semibold text-emerald-600">-{formatCurrency(group.omitDiscount)}</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Selection groups (configurable/combo) */}
                {(selectedProduct.selectionGroups || []).map((group) => {
                  const sentGroup = selectedGroups.find((sg) => sg.groupId === group._id);
                  const selectedCount = sentGroup?.selectedOptions.length ?? 0;
                  const hasError = groupErrors.includes(group._id);
                  const isMulti = group.maxSelections > 1;

                  return (
                    <div key={group._id} className="mb-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">{group.name}</p>
                          {group.required && (
                            <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', hasError ? 'bg-red-100 text-red-600' : 'bg-red-50 text-red-500')}>
                              Obligatorio
                            </span>
                          )}
                          {isMulti && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Máx. {group.maxSelections}</span>}
                        </div>
                        {isMulti && selectedCount > 0 && (
                          <span className="text-xs text-primary-600 font-medium">{selectedCount}/{group.maxSelections}</span>
                        )}
                      </div>
                      {hasError && <p className="text-xs text-red-500 mb-2">Selecciona al menos {group.minSelections} opción</p>}
                      <div className="space-y-2">
                        {group.options.filter((o) => o.isAvailable).map((option) => {
                          const isSelected = sentGroup?.selectedOptions.some((o) => o.optionId === option._id) ?? false;
                          const atMax = !isSelected && selectedCount >= group.maxSelections;
                          return (
                            <button
                              key={option._id}
                              onClick={() => toggleSelectionOption(group, { _id: option._id, name: option.name, priceDelta: option.priceDelta })}
                              disabled={atMax}
                              className={cn(
                                'w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left',
                                isSelected ? 'border-primary-500 bg-primary-50' : atMax ? 'border-slate-100 bg-slate-50 opacity-40' : 'border-slate-100 bg-slate-50 active:scale-[0.98]'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn('w-5 h-5 flex items-center justify-center flex-shrink-0 border-2', isMulti ? 'rounded-md' : 'rounded-full', isSelected ? 'border-primary-500 bg-primary-500' : 'border-slate-300')}>
                                  {isSelected && (
                                    isMulti
                                      ? <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                      : <div className="w-2 h-2 bg-white rounded-full" />
                                  )}
                                </div>
                                <span className="text-sm font-medium text-slate-800">{option.name}</span>
                              </div>
                              {option.priceDelta > 0 && (
                                <span className="text-sm font-semibold text-primary-600">+{formatCurrency(option.priceDelta)}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Accompaniment categories */}
                {(selectedProduct.accompanimentCategories || []).map((catId) => {
                  const cat = categories.find((c) => c._id === catId);
                  if (!cat) return null;
                  const catProducts = (selectedProduct.accompanimentProducts ?? products).filter((p) => {
                    const pCatId = typeof p.category === 'string' ? p.category : p.category._id;
                    return pCatId === catId && p.isAvailable;
                  });
                  const hasError = accompanimentErrors.includes(catId);
                  const selectedProductId = selectedAccompaniments[catId];

                  return (
                    <div key={catId} className="mb-5">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <p className="font-semibold text-slate-900 text-sm">{cat.name}</p>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', hasError ? 'bg-red-100 text-red-600' : 'bg-red-50 text-red-500')}>
                          Obligatorio
                        </span>
                        {catProducts.length === 0 && <span className="text-xs text-slate-400 italic">Sin productos disponibles</span>}
                      </div>
                      {hasError && <p className="text-xs text-red-500 mb-2">Debes elegir una opción</p>}
                      <div className="space-y-2">
                        {catProducts.map((p) => {
                          const isSelected = selectedProductId === p._id;
                          return (
                            <button
                              key={p._id}
                              onClick={() => setSelectedAccompaniments((prev) => ({ ...prev, [catId]: isSelected ? '' : p._id }))}
                              className={cn('w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left', isSelected ? 'border-primary-500 bg-primary-50' : 'border-slate-100 bg-slate-50 active:scale-[0.98]')}
                            >
                              <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0', isSelected ? 'border-primary-500 bg-primary-500' : 'border-slate-300')}>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                              </div>
                              <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Legacy modifiers */}
                {selectedProduct.modifierGroups.map((group) => (
                  <div key={group._id} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-semibold text-slate-900 text-sm">{group.name}</p>
                      {group.required && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Obligatorio</span>}
                    </div>
                    <div className="space-y-2">
                      {group.options.filter((o) => o.isAvailable).map((option) => {
                        const isSelected = selectedModifiers.some((m) => m.optionId === option._id);
                        return (
                          <button
                            key={option._id}
                            onClick={() => toggleModifier(group, option._id)}
                            className={cn('w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left', isSelected ? 'border-primary-500 bg-primary-50' : 'border-slate-100 bg-slate-50')}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0', isSelected ? 'border-primary-500 bg-primary-500' : 'border-slate-300')}>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                              </div>
                              <span className="text-sm font-medium text-slate-800">{option.name}</span>
                            </div>
                            {option.priceAdd > 0 && <span className="text-sm font-semibold text-primary-600">+{formatCurrency(option.priceAdd)}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Notes */}
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Observaciones (opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Sin cebolla, picante aparte..."
                    rows={2}
                    maxLength={200}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>

                {/* Quantity + Add */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 bg-slate-100 rounded-xl px-2 py-1">
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200">
                      <Minus size={16} />
                    </button>
                    <span className="w-6 text-center font-bold text-slate-900">{quantity}</span>
                    <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-primary-600 hover:bg-primary-100">
                      <Plus size={16} />
                    </button>
                  </div>
                  <button
                    onClick={addToOrder}
                    disabled={addingItem || !canAdd}
                    className="flex-1 bg-primary-600 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-60"
                  >
                    {addingItem ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />}
                    Agregar · {formatCurrency(getItemTotal())}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Completion overlay for terminal order states */}
      <AnimatePresence>
        {isTerminal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-xl"
            >
              <div className="text-5xl mb-4">
                {orderStatus === 'cancelled' ? '❌' : '🎉'}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                {orderStatus === 'cancelled' ? 'Pedido cancelado' : '¡Pedido completado!'}
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                {orderStatus === 'cancelled'
                  ? 'Tu pedido fue cancelado. Puedes hacer uno nuevo cuando quieras.'
                  : '¡Gracias por tu pedido! Esperamos que lo disfrutes.'}
              </p>
              <button
                onClick={clearOrder}
                className="w-full bg-primary-600 text-white py-3.5 rounded-2xl font-semibold text-sm hover:bg-primary-700 transition-colors"
              >
                Hacer nuevo pedido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order sheet */}
      <AnimatePresence>
        {orderSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setOrderSheetOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Tu pedido</h2>
                <button onClick={() => setOrderSheetOpen(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                  <X size={16} className="text-slate-600" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                {(!order || order.items.length === 0) ? (
                  <p className="text-slate-400 text-sm text-center py-6">Tu carrito está vacío</p>
                ) : (
                  order.items.map((item: OrderItem) => (
                    <div key={item._id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{item.productSnapshot.name}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(item.unitPrice)} × {item.quantity}</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{formatCurrency(item.totalPrice)}</span>
                      <button onClick={() => removeItem(item._id)} className="p-1.5 text-slate-300 hover:text-red-400">
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {order && order.items.length > 0 && (
                <div className="px-5 pb-6 border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.surcharge > 0 && (
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Cargo adicional ({channelType})</span>
                      <span>+{formatCurrency(order.surcharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-slate-900 pt-1">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                  <button
                    onClick={submitOrder}
                    disabled={submittingOrder}
                    className="w-full py-4 bg-primary-600 text-white font-semibold rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submittingOrder ? <Loader2 size={16} className="animate-spin" /> : <ChefHat size={16} />}
                    Enviar pedido al restaurante
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
