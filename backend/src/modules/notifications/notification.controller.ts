import { Response, NextFunction, Request } from 'express';
import { AuthRequest } from '../../common/types';
import { ApiResponse, paginationMeta } from '../../common/response/ApiResponse';
import { notificationService } from './notification.service';

export class NotificationController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notification = await notificationService.create(req.body);
      ApiResponse.created(res, notification, 'Notification sent');
    } catch (e) { next(e); }
  }

  async getUnresolved(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const notifications = await notificationService.getUnresolved(req.user!.restaurantId!);
      ApiResponse.success(res, notifications);
    } catch (e) { next(e); }
  }

  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(String(req.query.page || '1'));
      const limit = parseInt(String(req.query.limit || '20'));
      const { data, total } = await notificationService.getAll(req.user!.restaurantId!, page, limit);
      ApiResponse.paginated(res, data, paginationMeta(total, page, limit));
    } catch (e) { next(e); }
  }

  async resolve(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const notification = await notificationService.resolve(
        req.params.id,
        req.user!.restaurantId!,
        req.user!.userId
      );
      ApiResponse.success(res, notification, 'Notification resolved');
    } catch (e) { next(e); }
  }
}

export const notificationController = new NotificationController();
