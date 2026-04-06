import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthPayload, CustomerPayload } from '../common/types';

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  } as SignOptions);
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload;
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AuthPayload;
}

export function verifyCustomerToken(token: string): CustomerPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as Record<string, unknown>;
  if (payload.type !== 'customer' || !payload.customerId) {
    throw new Error('Not a customer token');
  }
  return payload as unknown as CustomerPayload;
}
