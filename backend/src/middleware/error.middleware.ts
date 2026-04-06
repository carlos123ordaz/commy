import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../common/errors/AppError';
import { env } from '../config/env';

export function errorMiddleware(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ValidationError) {
    res.status(400).json({
      success: false,
      message: error.message,
      code: error.code,
      errors: error.errors,
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
    });
    return;
  }

  // Mongoose duplicate key
  if ((error as NodeJS.ErrnoException).code === '11000') {
    res.status(409).json({
      success: false,
      message: 'Duplicate entry',
      code: 'CONFLICT',
    });
    return;
  }

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: error.message,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  console.error('Unhandled error:', error);

  res.status(500).json({
    success: false,
    message: env.isDev ? error.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(env.isDev && { stack: error.stack }),
  });
}

export function notFoundMiddleware(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 'NOT_FOUND',
  });
}
