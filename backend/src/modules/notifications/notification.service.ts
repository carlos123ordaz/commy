import { NotificationModel } from './notification.model';
import { TableModel } from '../tables/table.model';
import { NotFoundError } from '../../common/errors/AppError';
import { getIO } from '../../sockets';
import { NOTIFICATION_TYPES } from '../../config/constants';
import { pushSubscriptionService } from '../push-subscriptions/pushSubscription.service';

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export class NotificationService {
  async create(data: {
    tableToken: string;
    type: NotificationType;
    message?: string;
    alias?: string;
    orderId?: string;
  }) {
    const table = await TableModel.findOne({ qrCode: data.tableToken, isActive: true });
    if (!table) throw new NotFoundError('Table');

    const notification = await NotificationModel.create({
      restaurant: table.restaurant,
      table: table._id,
      order: data.orderId,
      type: data.type,
      message: data.message,
      alias: data.alias,
    });

    const populated = await notification.populate('table', 'name zone');

    const io = getIO();
    io.of('/staff').to(`restaurant:${table.restaurant}`).emit('notification:new', populated);

    // Web Push: enviar en background, sin bloquear la respuesta
    const pushTitles: Record<string, string> = {
      call_waiter: 'Llamada al mozo',
      request_bill: 'Solicitud de cuenta',
      assistance: 'Asistencia requerida',
    };
    const tableInfo = (populated.table as unknown as { name?: string })?.name ?? 'Mesa';
    const pushTitle = pushTitles[data.type] ?? 'Nueva notificación';
    const pushBody = data.alias
      ? `${tableInfo} — ${data.alias}`
      : tableInfo;

    pushSubscriptionService
      .sendToRestaurant(String(table.restaurant), {
        title: pushTitle,
        body: pushBody,
        data: { type: data.type, notificationId: String(notification._id) },
      })
      .catch(() => {/* ignorar errores de push para no interrumpir el flujo */});

    return populated;
  }

  async getUnresolved(restaurantId: string) {
    return NotificationModel.find({
      restaurant: restaurantId,
      isResolved: false,
    })
      .populate('table', 'name zone')
      .sort({ createdAt: -1 });
  }

  async getAll(restaurantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      NotificationModel.find({ restaurant: restaurantId })
        .populate('table', 'name zone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      NotificationModel.countDocuments({ restaurant: restaurantId }),
    ]);
    return { data, total };
  }

  async resolve(id: string, restaurantId: string, resolvedBy: string) {
    const notification = await NotificationModel.findOneAndUpdate(
      { _id: id, restaurant: restaurantId },
      { isResolved: true, resolvedAt: new Date(), resolvedBy },
      { new: true }
    );
    if (!notification) throw new NotFoundError('Notification');

    const io = getIO();
    io.of('/staff').to(`restaurant:${restaurantId}`).emit('notification:resolved', {
      notificationId: id,
    });

    return notification;
  }
}

export const notificationService = new NotificationService();
