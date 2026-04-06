import { Response, NextFunction } from 'express';
import { AuthRequest, Role } from '../common/types';
import { UnauthorizedError, ForbiddenError } from '../common/errors/AppError';
import { verifyAccessToken, verifyCustomerToken } from '../utils/jwt.utils';

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }
    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  }
}

export function authorize(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}

export function requireRestaurant(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (!req.user?.restaurantId) {
    return next(new ForbiddenError('Restaurant context required'));
  }
  next();
}

export function authenticateCustomer(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }
    const token = authHeader.split(' ')[1];
    req.customer = verifyCustomerToken(token);
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired customer token'));
  }
}
