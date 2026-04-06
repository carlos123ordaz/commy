import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/types';
import { ApiResponse } from '../../common/response/ApiResponse';
import { userService } from './user.service';

export class UserController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.create(req.user!.restaurantId!, req.body);
      ApiResponse.created(res, user, 'User created');
    } catch (e) { next(e); }
  }

  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.findAll(req.user!.restaurantId!);
      ApiResponse.success(res, users);
    } catch (e) { next(e); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.update(req.params.id, req.user!.restaurantId!, req.body);
      ApiResponse.success(res, user, 'User updated');
    } catch (e) { next(e); }
  }

  async toggleStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.toggleStatus(req.params.id, req.user!.restaurantId!);
      ApiResponse.success(res, user, `User ${user.isActive ? 'activated' : 'deactivated'}`);
    } catch (e) { next(e); }
  }
}

export const userController = new UserController();
