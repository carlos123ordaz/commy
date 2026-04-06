import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/types';
import { ApiResponse } from '../../common/response/ApiResponse';
import { authService } from './auth.service';
import { LoginInput, RefreshTokenInput } from './auth.validators';

export class AuthController {
  async login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { login, password } = req.body as LoginInput;
      const result = await authService.login(login, password);
      ApiResponse.success(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;
      const result = await authService.refresh(refreshToken);
      ApiResponse.success(res, result, 'Token refreshed');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logout(req.user!.userId);
      ApiResponse.success(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.me(req.user!.userId);
      ApiResponse.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  async googleCustomerLogin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { credential, restaurantId } = req.body as { credential: string; restaurantId?: string };
      const result = await authService.googleCustomerLogin(credential, restaurantId);
      ApiResponse.success(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
