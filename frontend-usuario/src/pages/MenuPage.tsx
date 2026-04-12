import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Bell, X, Plus, Minus, Loader2,
  Clock, AlertCircle, Star, ChefHat, Check, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../config/api';
import { useSessionStore } from '../store/sessionStore';
import { useTableSocket } from '../hooks/useTableSocket';
import type { Category, Product, ModifierGroup, SelectedModifier, OrderItem, SelectionGroup, SelectedGroup, SelectedGroupOption, MenuGroup, MenuGroupProduct, SelectedAccompaniment } from '../types';
import { cn, formatCurrency } from '../utils/cn';
import toast from 'react-hot-toast';

export const MenuPage: React.FC = () => {
  const { tableToken } = useParams<{ tableToken: string }>();
  const navigate = useNavigate();
  const { sessionId, alias, tableInfo, orderId, order, setOrder, clearOrder } = useSessionStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<SelectedGroup[]>([]);
  const [notes, setNotes] = useState('');
  // selectedMenuGroups: groupId → { productId: string | null (null = omitted) }
  const [selectedMenuGroups, setSelectedMenuGroups] = useState<Record<string, string | null>>({});
  // selectedAccompaniments: categoryId → productId
  const [selectedAccompaniments, setSelectedAccompaniments] = useState<Record<string, string>>({});
  const [loadingMenuProduct, setLoadingMenuProduct] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cartBounce, setCartBounce] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [showOrderComplete, setShowOrderComplete] = useState(false);

  const categoryBarRef = useRef<HTMLDivElement>(null);

  useTableSocket(tableInfo?._id);

  // Redirect if no session
  useEffect(() => {
    if (!tableToken || !sessionId || !tableInfo) {
      navigate(`/mesa/${tableToken}`);
    }
  }, [tableToken, sessionId, tableInfo]);

  // Fetch menu
  useEffect(() => {
    if (!tableInfo?.restaurant?._id) return;
    const restaurantId = tableInfo.restaurant._id;
    Promise.all([
      api.get(`/menu/public/${restaurantId}/categories`),
      api.get(`/menu/public/${restaurantId}/products`),
    ]).then(([catRes, prodRes]) => {
      setCategories(catRes.data.data);
      setProducts(prodRes.data.data);
    }).catch(() => toast.error('Error al cargar el menú'))
      .finally(() => setLoading(false));
  }, [tableInfo]);

  // Sync order
  const refreshOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await api.get(`/orders/${orderId}`);
      setOrder(res.data.data);
    } catch { /* ignore */ }
  }, [orderId]);

  useEffect(() => { refreshOrder(); }, [refreshOrder]);

  const filteredProducts = activeCategory === 'all'
    ? products
    : products.filter((p) => {
        const catId = typeof p.category === 'string' ? p.category : p.category._id;
        return catId === activeCategory;
      });

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    const el = categoryBarRef.current?.querySelector(`[data-cat="${catId}"]`) as HTMLElement;
    el?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
  };

  const openProduct = async (product: Product) => {
    if (!product.isAvailable) return;
    if (order && !isEditable) return;
    setQuantity(1);
    setSelectedModifiers([]);
    setSelectedGroups([]);
    setSelectedMenuGroups({});
    setSelectedAccompaniments({});
    setNotes('');

    const needsDetail = product.productType === 'menu' || (product.accompanimentCategories?.length ?? 0) > 0;
    if (needsDetail && tableInfo?.restaurant?._id) {
      setLoadingMenuProduct(true);
      try {
        const res = await api.get(`/menu/public/${tableInfo.restaurant._id}/products/${product._id}`);
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
        // Single selection: replace entire group selection
        if (isSelected) {
          // Deselect: remove group entirely
          return prev.filter((sg) => sg.groupId !== group._id);
        }
        const updated = prev.filter((sg) => sg.groupId !== group._id);
        return [...updated, { groupId: group._id, groupName: group.name, selectedOptions: [{ optionId: option._id, optionName: option.name, priceDelta: option.priceDelta }] }];
      }

      // Multiple selection
      if (isSelected) {
        // Remove this option
        if (existingGroupIdx === -1) return prev;
        const updatedOptions = prev[existingGroupIdx].selectedOptions.filter((o) => o.optionId !== option._id);
        if (updatedOptions.length === 0) return prev.filter((sg) => sg.groupId !== group._id);
        return prev.map((sg, i) => i === existingGroupIdx ? { ...sg, selectedOptions: updatedOptions } : sg);
      }

      // Add option
      const currentCount = existingGroupIdx >= 0 ? prev[existingGroupIdx].selectedOptions.length : 0;
      if (currentCount >= group.maxSelections) return prev; // already at max

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
      if (isSelected) {
        return prev.filter((m) => m.optionId !== optionId);
      }
      if (!group.multipleSelection) {
        // Single selection: replace existing selection for this group
        const withoutGroup = prev.filter((m) => m.groupId !== group._id);
        return [...withoutGroup, { groupId: group._id, groupName: group.name, optionId: option._id, optionName: option.name, priceAdd: option.priceAdd }];
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
    if (!selectedProduct || !selectedProduct.selectionGroups) return [];
    const errors: string[] = [];
    for (const group of selectedProduct.selectionGroups) {
      const sent = selectedGroups.find((sg) => sg.groupId === group._id);
      const count = sent?.selectedOptions.length ?? 0;
      if (group.required && count < group.minSelections) {
        errors.push(group._id);
      }
    }
    return errors;
  };

  const getMenuGroupErrors = (): string[] => {
    if (!selectedProduct || selectedProduct.productType !== 'menu') return [];
    const errors: string[] = [];
    for (const group of (selectedProduct.menuGroups || [])) {
      const val = selectedMenuGroups[group._id];
      // undefined = not touched, null = explicitly omitted
      if (val === undefined && group.required) errors.push(group._id);
      if (val === null && group.required) errors.push(group._id);
    }
    return errors;
  };

  const getAccompanimentErrors = (): string[] => {
    if (!selectedProduct || !selectedProduct.accompanimentCategories?.length) return [];
    return selectedProduct.accompanimentCategories.filter((catId) => !selectedAccompaniments[catId]);
  };

  const isEditable = order?.status === 'draft';
  const isCurrentUserReady = order ? (order.readyParticipants ?? []).includes(sessionId) : false;
  const isConfigurableProduct = selectedProduct && (selectedProduct.productType === 'configurable' || selectedProduct.productType === 'combo');
  const isMenuProduct = selectedProduct?.productType === 'menu';
  const groupErrors = isConfigurableProduct ? getSelectionGroupErrors() : [];
  const menuGroupErrors = isMenuProduct ? getMenuGroupErrors() : [];
  const accompanimentErrors = getAccompanimentErrors();
  const canAdd = isEditable && groupErrors.length === 0 && menuGroupErrors.length === 0 && accompanimentErrors.length === 0;

  const addToOrder = async () => {
    if (!selectedProduct || !orderId) return;

    // Check required modifiers (legacy system)
    const requiredGroups = selectedProduct.modifierGroups.filter((g) => g.required);
    for (const group of requiredGroups) {
      const hasSelection = selectedModifiers.some((m) => m.groupId === group._id);
      if (!hasSelection) {
        toast.error(`Selecciona una opción en "${group.name}"`);
        return;
      }
    }

    // Check required selection groups (configurable/combo)
    if (groupErrors.length > 0) {
      const missingGroup = selectedProduct.selectionGroups.find((g) => groupErrors.includes(g._id));
      toast.error(`Selecciona al menos ${missingGroup?.minSelections} opción en "${missingGroup?.name}"`);
      return;
    }

    // Check required menu groups (menu type)
    if (menuGroupErrors.length > 0) {
      const missingGroup = (selectedProduct.menuGroups || []).find((g) => menuGroupErrors.includes(g._id));
      toast.error(`Debes elegir una opción en "${missingGroup?.name}"`);
      return;
    }

    // Check accompaniment categories
    if (accompanimentErrors.length > 0) {
      const missingCat = categories.find((c) => c._id === accompanimentErrors[0]);
      toast.error(`Debes elegir un acompañamiento de "${missingCat?.name ?? 'la categoría'}"`);
      return;
    }

    setAddingItem(true);
    try {
      // Build selectedMenuGroups payload for menu-type products
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

      await api.post(`/orders/${orderId}/items`, {
        productId: selectedProduct._id,
        quantity,
        modifiers: isMenuProduct ? [] : selectedModifiers,
        selectedGroups: isMenuProduct ? [] : selectedGroups,
        selectedMenuGroups: menuGroupsPayload,
        selectedAccompaniments: accompanimentsPayload,
        notes: notes.trim() || undefined,
        sessionId,
        alias,
      });
      setSelectedProduct(null);
      setCartBounce(true);
      setTimeout(() => setCartBounce(false), 300);
      toast.success(`${selectedProduct.name} agregado`);
      refreshOrder();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al agregar');
    } finally {
      setAddingItem(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!orderId) return;
    setRemovingId(itemId);
    try {
      await api.delete(`/orders/${orderId}/items/${itemId}`, { data: { sessionId } });
      refreshOrder();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al eliminar');
    } finally {
      setRemovingId(null);
    }
  };

  const markReady = async () => {
    if (!orderId || !sessionId) return;
    setMarkingReady(true);
    try {
      const res = await api.post(`/orders/${orderId}/ready`, { sessionId });
      setOrder(res.data.data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al marcar como listo');
    } finally {
      setMarkingReady(false);
    }
  };

  // Detect when order is closed/cancelled to show completion screen
  useEffect(() => {
    if (order?.status === 'closed' || order?.status === 'cancelled' || order?.status === 'billed') {
      setShowOrderComplete(true);
    }
  }, [order?.status]);

  const handleStartNewOrder = async () => {
    clearOrder();
    navigate(`/mesa/${tableToken}`);
  };

  const sendAssistance = async (type: 'call_waiter' | 'request_bill' | 'assistance') => {
    if (!tableInfo?.qrCode) return;
    const labels = { call_waiter: 'Mozo llamado', request_bill: 'Cuenta solicitada', assistance: 'Ayuda solicitada' };
    try {
      await api.post('/notifications', { tableToken: tableInfo.qrCode, type, alias, orderId });
      toast.success(labels[type]);
    } catch { toast.error('Error al enviar'); }
  };

  const itemCount = order?.items.length ?? 0;
  const orderTotal = order?.total ?? 0;
  const restaurantName = tableInfo?.restaurant?.name || 'Restaurante';
  const tableName = tableInfo?.name || 'Mesa';

  return (
    <div className="app-container">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-slate-500">{restaurantName}</p>
            <p className="font-bold text-slate-900 text-sm">{tableName}</p>
          </div>
          <div className="flex items-center gap-2">
            {order && (
              <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                order.status === 'pending_confirmation' ? 'bg-amber-100 text-amber-700' :
                order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                order.status === 'preparing' ? 'bg-purple-100 text-purple-700' :
                order.status === 'ready' ? 'bg-emerald-100 text-emerald-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {order.status === 'draft' ? 'Abierto' :
                 order.status === 'pending_confirmation' ? 'Pendiente' :
                 order.status === 'confirmed' ? 'Confirmado' :
                 order.status === 'preparing' ? 'Preparando' :
                 order.status === 'ready' ? '¡Listo!' :
                 order.status === 'served' ? 'Servido' : order.status}
              </div>
            )}
          </div>
        </div>

        {/* Active order status banner */}
        {order && order.status !== 'draft' && order.status !== 'closed' && order.status !== 'cancelled' && (
          <div className={cn(
            'mx-4 mb-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-center',
            order.status === 'pending_confirmation' ? 'bg-amber-50 text-amber-700' :
            order.status === 'confirmed' ? 'bg-blue-50 text-blue-700' :
            order.status === 'preparing' ? 'bg-purple-50 text-purple-700' :
            order.status === 'ready' ? 'bg-emerald-50 text-emerald-700' :
            order.status === 'billed' ? 'bg-slate-50 text-slate-600' :
            order.status === 'served' ? 'bg-slate-50 text-slate-600' : 'bg-slate-50 text-slate-600'
          )}>
            {order.status === 'pending_confirmation' && '⏳ Pedido enviado — esperando confirmación del restaurante'}
            {order.status === 'confirmed' && '✅ Pedido confirmado — pronto comenzará la preparación'}
            {order.status === 'preparing' && '👨‍🍳 Tu pedido está siendo preparado...'}
            {order.status === 'ready' && '🎉 ¡Tu pedido está listo! El mozo lo traerá pronto'}
            {order.status === 'served' && '✅ ¡Buen provecho!'}
            {order.status === 'billed' && '🧾 Cuenta solicitada'}
          </div>
        )}

        {/* Category bar */}
        <div ref={categoryBarRef} className="flex overflow-x-auto gap-2 px-4 pb-3 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          <button
            data-cat="all"
            onClick={() => scrollToCategory('all')}
            className={cn(
              'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all',
              activeCategory === 'all' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'
            )}
          >
            Todo
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              data-cat={cat._id}
              onClick={() => scrollToCategory(cat._id)}
              className={cn(
                'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                activeCategory === cat._id ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      <div className="flex-1 overflow-y-auto pb-32">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <ChefHat size={48} className="mb-3 opacity-30" />
            <p>Sin productos en esta categoría</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredProducts.map((product) => {
              const inOrder = order?.items.filter(
                (i) => (typeof i.product === 'string' ? i.product : i.product?._id ?? '') === product._id
              ).reduce((s, i) => s + i.quantity, 0) ?? 0;

              return (
                <motion.button
                  key={product._id}
                  layout
                  onClick={() => openProduct(product)}
                  disabled={!product.isAvailable}
                  className={cn(
                    'w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 text-left transition-all',
                    product.isAvailable ? 'active:scale-[0.98] active:shadow-none' : 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0 text-3xl">
                      🍽️
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900 text-sm leading-tight">{product.name}</p>
                      {inOrder > 0 && (
                        <span className="flex-shrink-0 bg-primary-100 text-primary-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          {inOrder} en orden
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="font-bold text-primary-600 text-base">{formatCurrency(product.price)}</p>
                      <div className="flex items-center gap-3">
                        {product.estimatedTime && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock size={11} />
                            ~{product.estimatedTime}min
                          </div>
                        )}
                        {!product.isAvailable && (
                          <span className="text-xs text-red-500 font-medium">Agotado</span>
                        )}
                        {product.isAvailable && (
                          <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center">
                            <Plus size={16} className="text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Assistance buttons */}
        <div className="px-4 pb-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">¿Necesitas ayuda?</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => sendAssistance('call_waiter')}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Bell size={20} />
                <span className="text-xs font-medium">Llamar mozo</span>
              </button>
              <button
                onClick={() => sendAssistance('request_bill')}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <Star size={20} />
                <span className="text-xs font-medium">Pedir cuenta</span>
              </button>
              <button
                onClick={() => sendAssistance('assistance')}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <AlertCircle size={20} />
                <span className="text-xs font-medium">Ayuda</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cart bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pb-6 z-30">
          <motion.button
            className={cn('w-full bg-primary-600 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-primary-200', cartBounce && 'animate-bounce-scale')}
            onClick={() => setOrderSheetOpen(true)}
            whileTap={{ scale: 0.98 }}
          >
            <div className="bg-primary-500 rounded-xl px-2.5 py-1 text-white font-bold text-sm">
              {itemCount}
            </div>
            <span className="text-white font-semibold">Ver mi pedido</span>
            <span className="text-white font-bold">{formatCurrency(orderTotal)}</span>
          </motion.button>
        </div>
      )}

      {/* Product Detail Sheet */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setSelectedProduct(null)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
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
                  <div className="flex-shrink-0 ml-4 text-right">
                    <p className="text-2xl font-bold text-primary-600">{formatCurrency(getItemTotal() / quantity)}</p>
                    {selectedProduct.productType === 'menu' && (() => {
                      const discount = (selectedProduct.menuGroups || []).reduce((sum, g) => {
                        const val = selectedMenuGroups[g._id];
                        if (val === null && !g.required) return sum + g.omitDiscount;
                        return sum;
                      }, 0);
                      return discount > 0 ? (
                        <p className="text-xs text-emerald-600 font-medium">-{formatCurrency(discount)} descuento</p>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Menu groups (menu type) */}
                {isMenuProduct && loadingMenuProduct && (
                  <div className="flex justify-center py-6">
                    <Loader2 size={24} className="animate-spin text-primary-500" />
                  </div>
                )}
                {isMenuProduct && !loadingMenuProduct && (selectedProduct.menuGroups || []).map((group: MenuGroup) => {
                  const val = selectedMenuGroups[group._id]; // undefined=unset, null=omitted, string=productId
                  const hasError = menuGroupErrors.includes(group._id);
                  const availableProducts = (group.allowedProducts as MenuGroupProduct[]).filter((p) => p.isAvailable);
                  const allUnavailable = availableProducts.length === 0;

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
                        {allUnavailable && !group.required && (
                          <span className="text-xs text-slate-400 italic">Sin opciones disponibles</span>
                        )}
                      </div>
                      {hasError && (
                        <p className="text-xs text-red-500 mb-2">Debes elegir una opción</p>
                      )}
                      <div className="space-y-2">
                        {availableProducts.map((product) => {
                          const isSelected = val === product._id;
                          return (
                            <button
                              key={product._id}
                              onClick={() => setSelectedMenuGroups((prev) => ({ ...prev, [group._id]: isSelected ? undefined as unknown as string : product._id }))}
                              className={cn(
                                'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                                isSelected ? 'border-primary-500 bg-primary-50' : 'border-slate-100 bg-slate-50 active:scale-[0.98]'
                              )}
                            >
                              <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all', isSelected ? 'border-primary-500 bg-primary-500' : 'border-slate-300')}>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                              </div>
                              <span className="text-sm font-medium text-slate-800">{product.name}</span>
                            </button>
                          );
                        })}
                        {/* "Sin X" option for optional groups */}
                        {!group.required && group.allowNoneOption && (
                          <button
                            onClick={() => setSelectedMenuGroups((prev) => ({ ...prev, [group._id]: val === null ? undefined as unknown as string : null }))}
                            className={cn(
                              'w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left',
                              val === null ? 'border-slate-400 bg-slate-100' : 'border-slate-100 bg-slate-50 active:scale-[0.98]'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all', val === null ? 'border-slate-500 bg-slate-500' : 'border-slate-300')}>
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

                {/* Selection groups (configurable / combo) */}
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
                          {isMulti && (
                            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                              Máx. {group.maxSelections}
                            </span>
                          )}
                        </div>
                        {isMulti && selectedCount > 0 && (
                          <span className="text-xs text-primary-600 font-medium">{selectedCount}/{group.maxSelections}</span>
                        )}
                      </div>
                      {hasError && (
                        <p className="text-xs text-red-500 mb-2">Selecciona al menos {group.minSelections} opción</p>
                      )}
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
                                <div className={cn(
                                  'w-5 h-5 flex items-center justify-center flex-shrink-0 transition-all border-2',
                                  isMulti ? 'rounded-md' : 'rounded-full',
                                  isSelected ? 'border-primary-500 bg-primary-500' : 'border-slate-300'
                                )}>
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
                        {catProducts.length === 0 && (
                          <span className="text-xs text-slate-400 italic">Sin productos disponibles</span>
                        )}
                      </div>
                      {hasError && (
                        <p className="text-xs text-red-500 mb-2">Debes elegir una opción</p>
                      )}
                      <div className="space-y-2">
                        {catProducts.map((p) => {
                          const isSelected = selectedProductId === p._id;
                          return (
                            <button
                              key={p._id}
                              onClick={() => setSelectedAccompaniments((prev) => ({ ...prev, [catId]: isSelected ? '' : p._id }))}
                              className={cn(
                                'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                                isSelected ? 'border-primary-500 bg-primary-50' : 'border-slate-100 bg-slate-50 active:scale-[0.98]'
                              )}
                            >
                              <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all', isSelected ? 'border-primary-500 bg-primary-500' : 'border-slate-300')}>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                              </div>
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
                      {group.options.filter(o => o.isAvailable).map((option) => {
                        const isSelected = selectedModifiers.some((m) => m.optionId === option._id);
                        return (
                          <button
                            key={option._id}
                            onClick={() => toggleModifier(group, option._id)}
                            className={cn(
                              'w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left',
                              isSelected ? 'border-primary-500 bg-primary-50' : 'border-slate-100 bg-slate-50'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all', isSelected ? 'border-primary-500 bg-primary-500' : 'border-slate-300')}>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                              </div>
                              <span className="text-sm font-medium text-slate-800">{option.name}</span>
                            </div>
                            {option.priceAdd > 0 && (
                              <span className="text-sm font-semibold text-primary-600">+{formatCurrency(option.priceAdd)}</span>
                            )}
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
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 transition-colors">
                      <Minus size={16} />
                    </button>
                    <span className="w-6 text-center font-bold text-slate-900">{quantity}</span>
                    <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-primary-600 hover:bg-primary-100 transition-colors">
                      <Plus size={16} />
                    </button>
                  </div>
                  <button
                    onClick={addToOrder}
                    disabled={addingItem || !canAdd}
                    className="flex-1 bg-primary-600 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-60"
                  >
                    {addingItem ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />}
                    Agregar • {formatCurrency(getItemTotal())}
                  </button>
                </div>

                {!isEditable && order && (
                  <p className="text-center text-amber-600 text-xs mt-3 font-medium">
                    ⚠️ El pedido ya está confirmado y no se puede editar
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Complete Overlay */}
      <AnimatePresence>
        {showOrderComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="w-full max-w-xs bg-white rounded-3xl p-8 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Check size={40} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {order?.status === 'cancelled' ? 'Pedido cancelado' : '¡Gracias!'}
              </h2>
              <p className="text-slate-500 text-sm mb-8">
                {order?.status === 'cancelled'
                  ? 'El pedido fue cancelado. Puedes hacer un nuevo pedido.'
                  : 'Tu pedido ha sido completado. ¡Esperamos verte pronto!'}
              </p>
              <button
                onClick={handleStartNewOrder}
                className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
              >
                Hacer nuevo pedido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Sheet */}
      <AnimatePresence>
        {orderSheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setOrderSheetOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-[430px] bg-white rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900">Mi pedido</h2>
                  <p className="text-xs text-slate-500">{tableName}</p>
                </div>
                <button onClick={() => setOrderSheetOpen(false)} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center">
                  <X size={18} className="text-slate-600" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {order?.items.length === 0 && (
                  <p className="text-center text-slate-400 py-8">Tu pedido está vacío</p>
                )}
                {order?.items.map((item: OrderItem) => {
                  const isOwn = item.addedBySessionId === sessionId;
                  return (
                    <div key={item._id} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
                      <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center font-bold text-slate-700 text-sm shadow-sm flex-shrink-0">
                        {item.quantity}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{item.productSnapshot.name}</p>
                        {/* Menu type breakdown */}
                        {item.selectedMenuGroups?.length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {item.selectedMenuGroups.map((mg) => (
                              <p key={mg.groupId} className="text-xs text-slate-500">
                                <span className="font-medium text-slate-600">{mg.groupName}:</span>{' '}
                                {mg.omitted
                                  ? <span className="italic text-slate-400">Sin {mg.groupName.toLowerCase()}</span>
                                  : mg.selectedProductName}
                              </p>
                            ))}
                          </div>
                        )}
                        {/* Accompaniment selections */}
                        {item.selectedAccompaniments?.length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {item.selectedAccompaniments.map((a) => (
                              <p key={a.categoryId} className="text-xs text-slate-500">
                                <span className="font-medium text-slate-600">{a.categoryName}:</span>{' '}
                                {a.productName}
                              </p>
                            ))}
                          </div>
                        )}
                        {/* configurable/combo breakdown */}
                        {(!item.selectedMenuGroups?.length) && item.selectedGroups?.length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {item.selectedGroups.map((sg) => (
                              <p key={sg.groupId} className="text-xs text-slate-500">
                                <span className="font-medium text-slate-600">{sg.groupName}:</span>{' '}
                                {sg.selectedOptions.map((o) => o.optionName).join(', ')}
                              </p>
                            ))}
                          </div>
                        )}
                        {item.modifiers.length > 0 && (
                          <p className="text-xs text-slate-500">+ {item.modifiers.map((m) => m.optionName).join(', ')}</p>
                        )}
                        {item.notes && <p className="text-xs text-slate-400 italic">"{item.notes}"</p>}
                        {item.addedByAlias && (
                          <span className="text-xs bg-white px-1.5 py-0.5 rounded-md text-slate-500 border border-slate-100 mt-1 inline-block">
                            👤 {item.addedByAlias}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <p className="font-bold text-slate-900 text-sm">{formatCurrency(item.totalPrice)}</p>
                        {isOwn && isEditable && (
                          <button
                            onClick={() => removeItem(item._id)}
                            disabled={removingId === item._id}
                            className="text-xs text-red-500 hover:text-red-600"
                          >
                            {removingId === item._id ? '...' : 'Eliminar'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-5 py-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="text-xl font-bold text-primary-600">{formatCurrency(order?.total ?? 0)}</span>
                </div>

                {/* Ready-to-order system (draft state) */}
                {order?.status === 'draft' && itemCount > 0 && (
                  <div>
                    {/* Participant ready status */}
                    {order.participants.length > 1 && (
                      <div className="mb-3 bg-slate-50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Users size={13} className="text-slate-500" />
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Confirmaciones ({(order.readyParticipants ?? []).length}/{order.participants.length})
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          {order.participants.map((p) => {
                            const isReady = (order.readyParticipants ?? []).includes(p.sessionId);
                            const isMe = p.sessionId === sessionId;
                            return (
                              <div key={p.sessionId} className="flex items-center gap-2">
                                <div className={cn(
                                  'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                                  isReady ? 'bg-emerald-500' : 'bg-slate-200'
                                )}>
                                  {isReady && <Check size={11} className="text-white" />}
                                </div>
                                <span className={cn('text-sm', isReady ? 'text-slate-700 font-medium' : 'text-slate-400')}>
                                  {p.alias || 'Anónimo'}{isMe ? ' (tú)' : ''}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Ready button */}
                    {!isCurrentUserReady ? (
                      <button
                        onClick={markReady}
                        disabled={markingReady}
                        className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-60"
                      >
                        {markingReady ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                        {order.participants.length > 1 ? 'Listo para pedir' : 'Enviar pedido al restaurante'}
                      </button>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
                        <p className="text-sm font-semibold text-emerald-700">
                          ✅ Ya estás listo — esperando a los demás...
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {order?.status === 'pending_confirmation' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-amber-700">
                      ⏳ Esperando confirmación del restaurante...
                    </p>
                  </div>
                )}
                {order?.status && !isEditable && order.status !== 'pending_confirmation' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-slate-600">
                      {order.status === 'confirmed' ? '✅ Pedido confirmado por el restaurante' :
                       order.status === 'preparing' ? '👨‍🍳 Tu pedido está en preparación' :
                       order.status === 'ready' ? '🎉 ¡Tu pedido está listo!' :
                       order.status === 'served' ? '✅ ¡Buen provecho!' : `Estado: ${order.status}`}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
