import { Response, NextFunction, Request } from 'express';
import { AuthRequest } from '../../common/types';
import { ApiResponse, paginationMeta } from '../../common/response/ApiResponse';
import { orderService } from './order.service';
import { restaurantService } from '../restaurants/restaurant.service';

export class OrderController {
  async joinTable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await orderService.joinTable(req.body);
      ApiResponse.success(res, result);
    } catch (e) { next(e); }
  }

  async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await orderService.getOrder(req.params.id);
      ApiResponse.success(res, order);
    } catch (e) { next(e); }
  }

  async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await orderService.addItem(req.params.id, req.body);
      ApiResponse.success(res, result);
    } catch (e) { next(e); }
  }

  async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await orderService.updateItem(req.params.id, req.params.itemId, req.body);
      ApiResponse.success(res, result);
    } catch (e) { next(e); }
  }

  async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.body as { sessionId: string };
      const order = await orderService.removeItem(req.params.id, req.params.itemId, sessionId);
      ApiResponse.success(res, order, 'Item removed');
    } catch (e) { next(e); }
  }

  async markReady(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.body as { sessionId: string };
      const order = await orderService.markReady(req.params.id, sessionId);
      ApiResponse.success(res, order, 'Listo');
    } catch (e) { next(e); }
  }

  async submitOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.body as { sessionId: string };
      const order = await orderService.submitOrder(req.params.id, sessionId);
      ApiResponse.success(res, order, 'Pedido enviado');
    } catch (e) { next(e); }
  }

  async changeStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await orderService.changeStatus(req.params.id, req.user!.restaurantId!, req.body.status);
      ApiResponse.success(res, order, 'Status updated');
    } catch (e) { next(e); }
  }

  async getLiveOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const orders = await orderService.getLiveOrders(req.user!.restaurantId!);
      ApiResponse.success(res, orders);
    } catch (e) { next(e); }
  }

  async getOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(String(req.query.page || '1'));
      const limit = parseInt(String(req.query.limit || '20'));
      const { data, total } = await orderService.getOrders(
        req.user!.restaurantId!,
        page,
        limit,
        req.query.status as string,
        req.query.dateFrom as string,
        req.query.dateTo as string,
      );
      ApiResponse.paginated(res, data, paginationMeta(total, page, limit));
    } catch (e) { next(e); }
  }

  async getTodayStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await orderService.getTodayStats(req.user!.restaurantId!);
      ApiResponse.success(res, stats);
    } catch (e) { next(e); }
  }

  async getHourlyStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await orderService.getHourlyStats(req.user!.restaurantId!);
      ApiResponse.success(res, data);
    } catch (e) { next(e); }
  }

  async createManualOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await orderService.createManualOrder(req.user!.restaurantId!, req.body);
      ApiResponse.created(res, order, 'Orden manual creada');
    } catch (e) { next(e); }
  }

  async createChannelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { channelToken, orderType, sessionId, customerInfo } = req.body as {
        channelToken: string;
        orderType: 'delivery' | 'takeaway';
        sessionId: string;
        customerInfo: { name: string; phone?: string; address?: string; coordinates?: { lat: number; lng: number } };
      };

      // Validate token → get restaurant
      const restaurant = await restaurantService.findByChannelToken(channelToken, orderType);
      const restaurantId = restaurant._id.toString();

      // Check channel is enabled + delivery hours if applicable
      if (orderType === 'delivery') {
        if (!restaurant.settings.delivery.enabled) {
          res.status(400).json({ success: false, message: 'Delivery no disponible' });
          return;
        }
        // Check business hours in the restaurant's configured timezone
        const hours = restaurant.settings.delivery.hours;
        if (hours && hours.length > 0) {
          const tz = restaurant.settings.timezone || 'America/Lima';
          const now = new Date();
          // sv-SE locale reliably produces "YYYY-MM-DD HH:MM:SS" in any Node.js/OS environment
          const localStr = now.toLocaleString('sv-SE', { timeZone: tz });
          const [datePart, timePart] = localStr.split(' ');
          // Use UTC noon to safely extract day-of-week from the local date string
          const dow = new Date(`${datePart}T12:00:00Z`).getUTCDay();
          const hhmm = timePart.slice(0, 5); // "HH:MM"
          const todaySlot = hours.find((h) => h.dayOfWeek === dow);
          if (!todaySlot || hhmm < todaySlot.openTime || hhmm > todaySlot.closeTime) {
            res.status(400).json({ success: false, message: 'Delivery cerrado en este horario' });
            return;
          }
        }
      } else {
        if (!restaurant.settings.takeaway.enabled) {
          res.status(400).json({ success: false, message: 'Para llevar no disponible' });
          return;
        }
      }

      const surcharge = orderType === 'delivery'
        ? restaurant.settings.delivery.fee
        : restaurant.settings.takeaway.fee;

      const order = await orderService.createChannelOrder({
        restaurantId,
        orderType,
        sessionId,
        customerInfo,
        surcharge,
      });

      ApiResponse.created(res, order, 'Pedido creado');
    } catch (e) { next(e); }
  }
}

export const orderController = new OrderController();
