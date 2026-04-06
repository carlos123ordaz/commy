import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/types';
import { ApiResponse } from '../../common/response/ApiResponse';
import { NotFoundError } from '../../common/errors/AppError';
import { CustomerModel } from './customer.model';

export class CustomerController {
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user!.restaurantId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;
      const skip = (page - 1) * limit;

      const [customers, total] = await Promise.all([
        CustomerModel.find({ restaurants: restaurantId })
          .sort({ lastSeenAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CustomerModel.countDocuments({ restaurants: restaurantId }),
      ]);

      ApiResponse.paginated(res, customers, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      });
    } catch (error) {
      next(error);
    }
  }
  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, address, coordinates } = req.body as { phone?: string; address?: string; coordinates?: { lat: number; lng: number } };
      const update: Record<string, unknown> = {};
      if (phone !== undefined) update.phone = phone.trim();
      if (address !== undefined) update.address = address.trim();
      if (coordinates !== undefined) update.coordinates = coordinates;

      const customer = await CustomerModel.findByIdAndUpdate(
        req.customer!.customerId,
        { $set: update },
        { new: true }
      );
      if (!customer) throw new NotFoundError('Customer');

      ApiResponse.success(res, {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        picture: customer.picture,
        phone: customer.phone,
        address: customer.address,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const customerController = new CustomerController();
