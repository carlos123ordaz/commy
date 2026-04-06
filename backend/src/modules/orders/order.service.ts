import mongoose, { Types } from 'mongoose';
import { OrderModel, IOrder, IOrderItem } from './order.model';
import { TableModel } from '../tables/table.model';
import { ProductModel } from '../menu/product.model';
import { JoinTableInput, AddItemInput, UpdateItemInput } from './order.validators';
import { NotFoundError, ConflictError, ForbiddenError, AppError } from '../../common/errors/AppError';
import { EDITABLE_ORDER_STATUSES } from '../../config/constants';
import { getIO } from '../../sockets';
import { pushSubscriptionService } from '../push-subscriptions/pushSubscription.service';

/** Extract string ID from either a raw ObjectId or a populated Mongoose document */
function getDocId(ref: unknown): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  const r = ref as Record<string, unknown>;
  if (r._id) return String(r._id);
  return String(ref);
}

/**
 * Emit a customer event to the correct room.
 * Table orders → table:{tableId}, delivery/takeaway → order:{orderId}
 */
function emitToCustomer(
  io: ReturnType<typeof getIO>,
  order: IOrder,
  event: string,
  payload: unknown
) {
  const tableId = order.table ? order.table.toString() : null;
  if (tableId) {
    io.of('/customer').to(`table:${tableId}`).emit(event, payload);
  } else {
    io.of('/customer').to(`order:${order._id}`).emit(event, payload);
  }
}

async function getNextOrderNumber(restaurantId: string): Promise<number> {
  const last = await OrderModel.findOne({ restaurant: restaurantId })
    .sort({ orderNumber: -1 })
    .select('orderNumber');
  return (last?.orderNumber ?? 0) + 1;
}

function recalcTotals(order: IOrder): void {
  order.subtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
  order.total = order.subtotal + (order.surcharge ?? 0);
}

export class OrderService {
  async joinTable(data: JoinTableInput) {
    const table = await TableModel.findOne({ qrCode: data.tableToken, isActive: true });
    if (!table) throw new NotFoundError('Table');

    // Find existing active order — includes non-editable states so reload mid-order works
    const existingOrder = await OrderModel.findOne({
      table: table._id,
      status: { $nin: ['closed', 'cancelled', 'billed'] },
    }).populate('table', 'name zone').populate('restaurant', 'name logo settings');

    if (existingOrder) {
      // Join existing order if not already a participant
      const alreadyJoined = existingOrder.participants.some(
        (p) => p.sessionId === data.sessionId
      );
      if (!alreadyJoined) {
        existingOrder.participants.push({
          sessionId: data.sessionId,
          alias: data.alias,
          joinedAt: new Date(),
        });
        await existingOrder.save();
      }
      return { order: existingOrder, isNew: false, table };
    }

    // Create new order atomically
    const orderNumber = await getNextOrderNumber(table.restaurant.toString());

    const order = await OrderModel.create({
      restaurant: table.restaurant,
      table: table._id,
      orderNumber,
      status: 'draft',
      orderType: data.orderType ?? 'dine_in',
      participants: [
        {
          sessionId: data.sessionId,
          alias: data.alias,
          joinedAt: new Date(),
        },
      ],
      items: [],
      subtotal: 0,
      total: 0,
    });

    // Update table status
    await TableModel.findByIdAndUpdate(table._id, { status: 'with_order' });

    const populated = await order.populate([
      { path: 'table', select: 'name zone' },
      { path: 'restaurant', select: 'name logo settings' },
    ]);

    // Emit to restaurant
    const io = getIO();
    io.of('/staff').to(`restaurant:${table.restaurant}`).emit('order:created', populated);

    return { order: populated, isNew: true, table };
  }

  async getOrder(orderId: string) {
    const order = await OrderModel.findById(orderId)
      .populate('table', 'name zone number')
      .populate('restaurant', 'name logo')
      .populate('items.product', 'name imageUrl');
    if (!order) throw new NotFoundError('Order');
    return order;
  }

  async addItem(orderId: string, data: AddItemInput) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new NotFoundError('Order');

    if (!EDITABLE_ORDER_STATUSES.includes(order.status as typeof EDITABLE_ORDER_STATUSES[number])) {
      throw new ForbiddenError('Order is not editable');
    }

    const product = await ProductModel.findById(data.productId);
    if (!product) throw new NotFoundError('Product');
    if (!product.isAvailable) throw new AppError('Product is not available', 400);

    // ── Branch: "menu" type product ─────────────────────────────────────────
    let resolvedMenuGroups: {
      groupId: string; groupKey: string; groupName: string;
      omitted: boolean; selectedProductId?: string; selectedProductName?: string; omitDiscount: number;
    }[] = [];

    if (product.productType === 'menu') {
      const sentGroups = data.selectedMenuGroups ?? [];

      // Every group defined on the product must appear exactly once in the request
      const sentGroupIds = new Set(sentGroups.map((sg) => sg.groupId));
      for (const group of product.menuGroups) {
        if (!sentGroupIds.has(group._id.toString())) {
          throw new AppError(`Falta la selección para el grupo "${group.name}"`, 400);
        }
      }

      // Reject any groups sent that don't exist in the product
      const productGroupIds = new Set(product.menuGroups.map((g) => g._id.toString()));
      for (const sg of sentGroups) {
        if (!productGroupIds.has(sg.groupId)) {
          throw new AppError(`Grupo de menú inválido: ${sg.groupId}`, 400);
        }
      }

      // Load all potentially needed products in one query
      const allProductIds = product.menuGroups.flatMap((g) => g.allowedProducts.map((id) => id.toString()));
      const allowedProductDocs = await ProductModel.find({ _id: { $in: allProductIds } }).select('_id name isAvailable');
      const productMap = new Map(allowedProductDocs.map((p) => [p._id.toString(), p]));

      for (const group of product.menuGroups) {
        const groupId = group._id.toString();
        const sentGroup = sentGroups.find((sg) => sg.groupId === groupId)!;

        if (sentGroup.omitted) {
          // Omission is only valid for optional groups with allowNoneOption
          if (group.required) {
            throw new AppError(`El grupo "${group.name}" es obligatorio y no puede omitirse`, 400);
          }
          if (!group.allowNoneOption) {
            throw new AppError(`El grupo "${group.name}" no permite la opción "sin selección"`, 400);
          }
          resolvedMenuGroups.push({
            groupId,
            groupKey: group.key,
            groupName: group.name,
            omitted: true,
            omitDiscount: group.omitDiscount,
          });
          continue;
        }

        // Must have exactly one product selected (maxSelections = 1 for now)
        if (!sentGroup.selectedProductId) {
          throw new AppError(`Debes seleccionar una opción en "${group.name}"`, 400);
        }

        // Validate the product belongs to this group
        const allowedIds = group.allowedProducts.map((id) => id.toString());
        if (!allowedIds.includes(sentGroup.selectedProductId)) {
          throw new AppError(`El producto elegido no es válido para el grupo "${group.name}"`, 400);
        }

        // Validate availability
        const chosenProduct = productMap.get(sentGroup.selectedProductId);
        if (!chosenProduct || !chosenProduct.isAvailable) {
          throw new AppError(`El producto elegido en "${group.name}" no está disponible`, 400);
        }

        resolvedMenuGroups.push({
          groupId,
          groupKey: group.key,
          groupName: group.name,
          omitted: false,
          selectedProductId: sentGroup.selectedProductId,
          selectedProductName: chosenProduct.name,
          omitDiscount: 0,
        });
      }

      // Price: basePrice minus discounts for omitted optional groups
      const totalOmitDiscount = resolvedMenuGroups
        .filter((g) => g.omitted)
        .reduce((sum, g) => sum + g.omitDiscount, 0);

      const unitPrice = Math.max(0, product.price - totalOmitDiscount);
      const totalPrice = unitPrice * data.quantity;

      const item = {
        product: product._id,
        productSnapshot: {
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
          productType: 'menu',
        },
        quantity: data.quantity,
        unitPrice,
        totalPrice,
        modifiers: [],
        selectedGroups: [],
        selectedMenuGroups: resolvedMenuGroups,
        notes: data.notes,
        addedBySessionId: data.sessionId,
        addedByAlias: data.alias,
        status: 'pending' as const,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      order.items.push(item as any);
      recalcTotals(order);
      await order.save();

      const addedItem = order.items[order.items.length - 1];
      const io = getIO();
      emitToCustomer(io, order, 'order:itemAdded', { orderId: order._id, item: addedItem, addedByAlias: data.alias });
      io.of('/staff').to(`restaurant:${order.restaurant}`).emit('order:itemAdded', { orderId: order._id, item: addedItem, tableId: order.table });
      return { order, item: addedItem };
    }

    // ── Branch: simple / configurable / combo ────────────────────────────────
    const resolvedSelectedGroups: { groupId: string; groupName: string; selectedOptions: { optionId: string; optionName: string; priceDelta: number }[] }[] = [];
    let selectionPriceDelta = 0;

    if (product.productType === 'configurable' || product.productType === 'combo') {
      for (const group of product.selectionGroups) {
        const groupId = group._id.toString();
        const sentGroup = (data.selectedGroups || []).find((sg) => sg.groupId === groupId);
        const sentCount = sentGroup?.selectedOptions.length ?? 0;

        if (group.required && sentCount < group.minSelections) {
          throw new AppError(`Debes seleccionar al menos ${group.minSelections} opción(es) en "${group.name}"`, 400);
        }
        if (sentCount > group.maxSelections) {
          throw new AppError(`Puedes seleccionar máximo ${group.maxSelections} opción(es) en "${group.name}"`, 400);
        }

        if (!sentGroup || sentGroup.selectedOptions.length === 0) continue;

        // Verify each optionId exists in the group and is available
        const resolvedOptions: { optionId: string; optionName: string; priceDelta: number }[] = [];
        for (const sent of sentGroup.selectedOptions) {
          const option = group.options.find((o) => o._id.toString() === sent.optionId && o.isAvailable);
          if (!option) throw new AppError(`Opción inválida en grupo "${group.name}"`, 400);
          resolvedOptions.push({ optionId: sent.optionId, optionName: option.name, priceDelta: option.priceDelta });
          selectionPriceDelta += option.priceDelta;
        }

        resolvedSelectedGroups.push({ groupId, groupName: group.name, selectedOptions: resolvedOptions });
      }

      // Reject any groups sent that don't exist in the product
      for (const sg of (data.selectedGroups || [])) {
        const exists = product.selectionGroups.some((g) => g._id.toString() === sg.groupId);
        if (!exists) throw new AppError(`Grupo de selección inválido: ${sg.groupId}`, 400);
      }
    }

    // ── Accompaniment categories validation ──────────────────────────────────
    const resolvedAccompaniments: { categoryId: string; categoryName: string; productId: string; productName: string }[] = [];

    if (product.accompanimentCategories && product.accompanimentCategories.length > 0) {
      const sentAccompaniments = data.selectedAccompaniments ?? [];
      const sentCategoryIds = new Set(sentAccompaniments.map((a) => a.categoryId));

      // Every accompaniment category must have a selection
      for (const catId of product.accompanimentCategories) {
        if (!sentCategoryIds.has(catId.toString())) {
          throw new AppError('Debes elegir una opción para cada acompañamiento', 400);
        }
      }

      // Validate each sent accompaniment
      const accompanimentCatIds = new Set(product.accompanimentCategories.map((id) => id.toString()));
      for (const sent of sentAccompaniments) {
        if (!accompanimentCatIds.has(sent.categoryId)) continue; // ignore extras

        // Validate the chosen product exists, belongs to the category, and is available
        const chosenProduct = await ProductModel.findById(sent.productId).select('_id name isAvailable category');
        if (!chosenProduct) throw new AppError(`El producto acompañante no existe`, 400);
        if (!chosenProduct.isAvailable) throw new AppError(`"${chosenProduct.name}" no está disponible`, 400);
        if (chosenProduct.category.toString() !== sent.categoryId) {
          throw new AppError(`El producto "${chosenProduct.name}" no pertenece a la categoría indicada`, 400);
        }

        resolvedAccompaniments.push({
          categoryId: sent.categoryId,
          categoryName: sent.categoryName,
          productId: sent.productId,
          productName: chosenProduct.name,
        });
      }
    }

    const modifierTotal = (data.modifiers || []).reduce((sum, m) => sum + m.priceAdd, 0);
    const unitPrice = product.price + modifierTotal + selectionPriceDelta;
    const totalPrice = unitPrice * data.quantity;

    const item = {
      product: product._id,
      productSnapshot: {
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        productType: product.productType,
      },
      quantity: data.quantity,
      unitPrice,
      totalPrice,
      modifiers: (data.modifiers || []).map((m) => ({
        groupId: new mongoose.Types.ObjectId(m.groupId),
        groupName: m.groupName,
        optionId: new mongoose.Types.ObjectId(m.optionId),
        optionName: m.optionName,
        priceAdd: m.priceAdd,
      })),
      selectedGroups: resolvedSelectedGroups,
      selectedMenuGroups: [],
      selectedAccompaniments: resolvedAccompaniments,
      notes: data.notes,
      addedBySessionId: data.sessionId,
      addedByAlias: data.alias,
      status: 'pending' as const,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    order.items.push(item as any);
    recalcTotals(order);
    await order.save();

    const addedItem = order.items[order.items.length - 1];

    const io = getIO();
    emitToCustomer(io, order, 'order:itemAdded', {
      orderId: order._id,
      item: addedItem,
      addedByAlias: data.alias,
    });
    io.of('/staff').to(`restaurant:${order.restaurant}`).emit('order:itemAdded', {
      orderId: order._id,
      item: addedItem,
      tableId: order.table,
    });

    return { order, item: addedItem };
  }

  async updateItem(orderId: string, itemId: string, data: UpdateItemInput) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new NotFoundError('Order');

    if (!EDITABLE_ORDER_STATUSES.includes(order.status as typeof EDITABLE_ORDER_STATUSES[number])) {
      throw new ForbiddenError('Order is not editable');
    }

    const items = order.items as unknown as Types.DocumentArray<IOrderItem>;
    const item = items.id(itemId);
    if (!item) throw new NotFoundError('Item');

    if (item.addedBySessionId !== data.sessionId) {
      throw new ForbiddenError('You can only edit your own items');
    }

    if (data.quantity !== undefined) {
      item.quantity = data.quantity;
      item.totalPrice = item.unitPrice * data.quantity;
    }
    if (data.notes !== undefined) item.notes = data.notes;

    recalcTotals(order);
    await order.save();

    const io = getIO();
    emitToCustomer(io, order, 'order:itemUpdated', { orderId: order._id, item });

    return { order, item };
  }

  async removeItem(orderId: string, itemId: string, sessionId: string) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new NotFoundError('Order');

    if (!EDITABLE_ORDER_STATUSES.includes(order.status as typeof EDITABLE_ORDER_STATUSES[number])) {
      throw new ForbiddenError('Order is not editable');
    }

    const items2 = order.items as unknown as Types.DocumentArray<IOrderItem>;
    const item = items2.id(itemId);
    if (!item) throw new NotFoundError('Item');

    if (item.addedBySessionId !== sessionId) {
      throw new ForbiddenError('You can only remove your own items');
    }

    items2.pull(itemId);
    recalcTotals(order);
    await order.save();

    const io = getIO();
    emitToCustomer(io, order, 'order:itemRemoved', { orderId: order._id, itemId });

    return order;
  }

  async markReady(orderId: string, sessionId: string) {
    const order = await OrderModel.findById(orderId)
      .populate('table', 'name zone')
      .populate('restaurant', 'name logo settings');
    if (!order) throw new NotFoundError('Order');

    if (order.status !== 'draft') {
      throw new AppError('El pedido ya fue enviado', 400);
    }

    const isParticipant = order.participants.some((p) => p.sessionId === sessionId);
    if (!isParticipant) {
      throw new ForbiddenError('No eres parte de este pedido');
    }

    if (order.items.length === 0) {
      throw new AppError('El pedido no tiene productos', 400);
    }

    if (!order.readyParticipants.includes(sessionId)) {
      order.readyParticipants.push(sessionId);
    }
    await order.save();

    // Use explicit _id when docs are populated to avoid toString() ambiguity
    const tableId = getDocId(order.table);
    const restaurantId = getDocId(order.restaurant);

    const io = getIO();
    io.of('/customer').to(`table:${tableId}`).emit('order:participantReady', {
      orderId: order._id,
      sessionId,
      readyParticipants: order.readyParticipants,
    });
    // Also notify staff so Live Orders / floor plan can reflect readiness
    io.of('/staff').to(`restaurant:${restaurantId}`).emit('order:participantReady', {
      orderId: order._id,
      tableId,
      sessionId,
      readyParticipants: order.readyParticipants,
    });

    // Auto-submit when all participants are ready
    const allReady = order.participants.every((p) =>
      order.readyParticipants.includes(p.sessionId)
    );

    if (allReady) {
      order.status = 'pending_confirmation';
      await order.save();

      io.of('/customer').to(`table:${tableId}`).emit('order:statusChanged', {
        orderId: order._id,
        status: 'pending_confirmation',
        previousStatus: 'draft',
      });
      io.of('/staff').to(`restaurant:${restaurantId}`).emit('order:statusChanged', {
        orderId: order._id,
        tableId,
        status: 'pending_confirmation',
        previousStatus: 'draft',
      });

      const tableObj = order.table as unknown as { name?: string } | null;
      const tableName = tableObj?.name ?? 'Mesa';
      pushSubscriptionService
        .sendToRestaurant(restaurantId, {
          title: 'Nuevo pedido',
          body: `${tableName} — Pedido #${order.orderNumber}`,
          data: { orderId: String(order._id) },
        })
        .catch(() => {});
    }

    return order;
  }

  async submitOrder(orderId: string, sessionId: string) {
    const order = await OrderModel.findById(orderId)
      .populate('table', 'name zone')
      .populate('restaurant', 'name logo settings');
    if (!order) throw new NotFoundError('Order');

    if (order.status !== 'draft') {
      throw new AppError('El pedido ya fue enviado', 400);
    }

    const isParticipant = order.participants.some((p) => p.sessionId === sessionId);
    if (!isParticipant) {
      throw new ForbiddenError('No eres parte de este pedido');
    }

    if (order.items.length === 0) {
      throw new AppError('El pedido no tiene productos', 400);
    }

    order.status = 'pending_confirmation';
    await order.save();

    const tableId = getDocId(order.table);
    const restaurantId = getDocId(order.restaurant);

    const io = getIO();
    // For table orders emit to table room; for channel orders emit to order room
    if (tableId) {
      io.of('/customer').to(`table:${tableId}`).emit('order:statusChanged', {
        orderId: order._id,
        status: 'pending_confirmation',
        previousStatus: 'draft',
      });
    } else {
      io.of('/customer').to(`order:${order._id}`).emit('order:statusChanged', {
        orderId: order._id,
        status: 'pending_confirmation',
        previousStatus: 'draft',
      });
    }
    io.of('/staff').to(`restaurant:${restaurantId}`).emit('order:statusChanged', {
      orderId: order._id,
      tableId: tableId || undefined,
      status: 'pending_confirmation',
      previousStatus: 'draft',
    });

    const tableObj = order.table as unknown as { name?: string } | null;
    const tableName = tableObj?.name ?? (order.orderType === 'delivery' ? 'Delivery' : 'Takeaway');
    pushSubscriptionService
      .sendToRestaurant(restaurantId, {
        title: 'Nuevo pedido',
        body: `${tableName} — Pedido #${order.orderNumber}`,
        data: { orderId: String(order._id) },
      })
      .catch(() => {});

    return order;
  }

  async changeStatus(orderId: string, restaurantId: string, status: string) {
    const order = await OrderModel.findOne({ _id: orderId, restaurant: restaurantId });
    if (!order) throw new NotFoundError('Order');

    const previousStatus = order.status;
    order.status = status as IOrder['status'];

    if (status === 'confirmed') order.confirmedAt = new Date();

    let newTableStatus: string | null = null;
    if (status === 'closed' || status === 'cancelled' || status === 'billed') {
      order.closedAt = new Date();
      await TableModel.findByIdAndUpdate(order.table, { status: 'free' });
      newTableStatus = 'free';
    }

    await order.save();

    const tableIdStr = order.table ? order.table.toString() : null;

    const io = getIO();
    if (tableIdStr) {
      io.of('/customer').to(`table:${tableIdStr}`).emit('order:statusChanged', {
        orderId: order._id,
        status,
        previousStatus,
      });
    } else {
      // delivery/takeaway: emit to order room
      io.of('/customer').to(`order:${order._id}`).emit('order:statusChanged', {
        orderId: order._id,
        status,
        previousStatus,
      });
    }
    io.of('/staff').to(`restaurant:${restaurantId}`).emit('order:statusChanged', {
      orderId: order._id,
      tableId: tableIdStr || undefined,
      status,
      previousStatus,
    });
    io.of('/staff').to(`kitchen:${restaurantId}`).emit('order:statusChanged', {
      orderId: order._id,
      status,
    });

    // Emit table status change so floor plan updates in real time
    if (newTableStatus && tableIdStr) {
      io.of('/staff').to(`restaurant:${restaurantId}`).emit('table:statusChanged', {
        tableId: tableIdStr,
        status: newTableStatus,
      });
    }

    return order;
  }

  async getLiveOrders(restaurantId: string) {
    return OrderModel.find({
      restaurant: restaurantId,
      status: { $nin: ['draft', 'closed', 'cancelled', 'billed'] },
    })
      .populate('table', 'name zone number')
      .sort({ createdAt: -1 });
  }

  async getOrders(
    restaurantId: string,
    page: number,
    limit: number,
    status?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const query: Record<string, unknown> = { restaurant: restaurantId };
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      const dateRange: Record<string, Date> = {};
      if (dateFrom) dateRange.$gte = new Date(dateFrom);
      if (dateTo) dateRange.$lte = new Date(dateTo);
      query.createdAt = dateRange;
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      OrderModel.find(query)
        .populate('table', 'name zone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      OrderModel.countDocuments(query),
    ]);
    return { data, total };
  }

  async getTodayStats(restaurantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [orders, activeOrders] = await Promise.all([
      OrderModel.find({
        restaurant: restaurantId,
        createdAt: { $gte: today, $lt: tomorrow },
        status: { $nin: ['cancelled'] },
      }),
      OrderModel.countDocuments({
        restaurant: restaurantId,
        status: { $in: ['draft', 'pending_confirmation', 'confirmed', 'preparing', 'ready', 'served'] },
      }),
    ]);

    const totalRevenue = orders
      .filter((o) => !['cancelled', 'draft'].includes(o.status))
      .reduce((sum, o) => sum + o.total, 0);

    const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

    return {
      ordersToday: orders.length,
      revenueToday: totalRevenue,
      activeOrders,
      avgTicket: Math.round(avgTicket * 100) / 100,
    };
  }

  async getHourlyStats(restaurantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const rows = await OrderModel.aggregate([
      {
        $match: {
          restaurant: new mongoose.Types.ObjectId(restaurantId),
          createdAt: { $gte: today, $lt: tomorrow },
          status: { $nin: ['cancelled'] },
        },
      },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          pedidos: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return rows.map((r) => ({
      hour: `${String(r._id).padStart(2, '0')}:00`,
      pedidos: r.pedidos,
    }));
  }

  /** Create a manual order directly from the admin panel (no customer QR flow) */
  async createManualOrder(restaurantId: string, data: { tableId: string; notes?: string }) {
    const table = await TableModel.findOne({ _id: data.tableId, restaurant: restaurantId, isActive: true });
    if (!table) throw new NotFoundError('Table');

    const existingOrder = await OrderModel.findOne({
      table: table._id,
      status: { $nin: ['closed', 'cancelled', 'billed'] },
    });
    if (existingOrder) throw new ConflictError('La mesa ya tiene un pedido activo');

    const orderNumber = await getNextOrderNumber(restaurantId);
    const staffSessionId = `staff:${restaurantId}`;

    const order = await OrderModel.create({
      restaurant: restaurantId,
      table: table._id,
      orderNumber,
      status: 'pending_confirmation',
      orderType: 'manual',
      participants: [{ sessionId: staffSessionId, alias: 'Staff', joinedAt: new Date() }],
      readyParticipants: [],
      items: [],
      subtotal: 0,
      total: 0,
      notes: data.notes,
    });

    await TableModel.findByIdAndUpdate(table._id, { status: 'with_order' });

    const populated = await order.populate([
      { path: 'table', select: 'name zone' },
      { path: 'restaurant', select: 'name logo settings' },
    ]);

    const io = getIO();
    io.of('/staff').to(`restaurant:${restaurantId}`).emit('order:created', populated);
    io.of('/staff').to(`restaurant:${restaurantId}`).emit('order:statusChanged', {
      orderId: order._id,
      tableId: table._id,
      status: 'pending_confirmation',
      previousStatus: null,
    });

    return populated;
  }

  /** Create a delivery or takeaway channel order */
  async createChannelOrder(data: {
    restaurantId: string;
    orderType: 'delivery' | 'takeaway';
    sessionId: string;
    customerInfo: { name: string; phone?: string; address?: string; coordinates?: { lat: number; lng: number } };
    surcharge: number;
  }) {
    const orderNumber = await getNextOrderNumber(data.restaurantId);

    const order = await OrderModel.create({
      restaurant: data.restaurantId,
      table: undefined,
      orderNumber,
      status: 'draft',
      orderType: data.orderType,
      participants: [{
        sessionId: data.sessionId,
        alias: data.customerInfo.name,
        joinedAt: new Date(),
      }],
      readyParticipants: [],
      items: [],
      subtotal: 0,
      total: data.surcharge,
      surcharge: data.surcharge,
      customerInfo: data.customerInfo,
    });

    const populated = await order.populate([
      { path: 'restaurant', select: 'name logo settings' },
    ]);

    return populated;
  }
}

export const orderService = new OrderService();
