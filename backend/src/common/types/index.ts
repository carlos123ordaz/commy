import { Request } from 'express';
import { Types } from 'mongoose';
import { ROLES } from '../../config/constants';

export type Role = (typeof ROLES)[number];

export interface AuthPayload {
  userId: string;
  role: Role;
  restaurantId?: string;
}

export interface CustomerPayload {
  customerId: string;
  type: 'customer';
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
  customer?: CustomerPayload;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export type MongoId = Types.ObjectId | string;
