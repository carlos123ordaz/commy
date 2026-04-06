import { Response, NextFunction, Request } from 'express';
import { AuthRequest } from '../../common/types';
import { ApiResponse, paginationMeta } from '../../common/response/ApiResponse';
import { restaurantService } from './restaurant.service';
import { CreateRestaurantInput, UpdateRestaurantInput, UpdateChannelConfigInput } from './restaurant.validators';
import { generateQRDataURL } from '../../utils/qrcode.utils';

export class RestaurantController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurant = await restaurantService.create(req.body as CreateRestaurantInput);
      ApiResponse.created(res, restaurant, 'Restaurant created');
    } catch (e) { next(e); }
  }

  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(String(req.query.page || '1'));
      const limit = parseInt(String(req.query.limit || '20'));
      const search = req.query.search as string | undefined;
      const { data, total } = await restaurantService.findAll(page, limit, search);
      ApiResponse.paginated(res, data, paginationMeta(total, page, limit));
    } catch (e) { next(e); }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurant = await restaurantService.findById(req.params.id);
      ApiResponse.success(res, restaurant);
    } catch (e) { next(e); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurant = await restaurantService.update(req.params.id, req.body as UpdateRestaurantInput);
      ApiResponse.success(res, restaurant, 'Restaurant updated');
    } catch (e) { next(e); }
  }

  async toggleStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurant = await restaurantService.toggleStatus(req.params.id);
      ApiResponse.success(res, restaurant, `Restaurant ${restaurant.isActive ? 'activated' : 'suspended'}`);
    } catch (e) { next(e); }
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurant = await restaurantService.findById(req.user!.restaurantId!);
      ApiResponse.success(res, restaurant);
    } catch (e) { next(e); }
  }

  async updateMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurant = await restaurantService.update(req.user!.restaurantId!, req.body as UpdateRestaurantInput);
      ApiResponse.success(res, restaurant, 'Settings updated');
    } catch (e) { next(e); }
  }

  async updateChannelConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurant = await restaurantService.updateChannelConfig(req.user!.restaurantId!, req.body as UpdateChannelConfigInput);
      ApiResponse.success(res, restaurant, 'Channel config updated');
    } catch (e) { next(e); }
  }

  async generateChannelQR(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const channel = req.params.channel as 'delivery' | 'takeaway';
      const result = await restaurantService.generateChannelQR(req.user!.restaurantId!, channel);
      const qrDataUrl = await generateQRDataURL(result.qrUrl);
      ApiResponse.success(res, { ...result, qrDataUrl });
    } catch (e) { next(e); }
  }

  /** Public: get restaurant + channel config by QR token */
  async getChannelInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const channel = req.params.channel as 'delivery' | 'takeaway';
      const restaurant = await restaurantService.findByChannelToken(req.params.token, channel);
      ApiResponse.success(res, restaurant);
    } catch (e) { next(e); }
  }
}

export const restaurantController = new RestaurantController();
