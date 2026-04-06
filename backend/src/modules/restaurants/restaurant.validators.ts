import { z } from 'zod';

export const createRestaurantSchema = z.object({
  name: z.string().min(2).max(100),
  legalName: z.string().max(150).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens'),
  email: z.string().email(),
  phone: z.string().optional(),
  logo: z.string().url().optional(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
  adminUsername: z.string().min(3).max(30),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

export const updateRestaurantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  legalName: z.string().max(150).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  logo: z.string().optional(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
  settings: z
    .object({
      currency: z.string().optional(),
      timezone: z.string().optional(),
      acceptingOrders: z.boolean().optional(),
      primaryColor: z.string().optional(),
    })
    .optional(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;

const deliveryHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
});

export const updateChannelConfigSchema = z.object({
  delivery: z.object({
    enabled: z.boolean().optional(),
    fee: z.number().min(0).optional(),
    hours: z.array(deliveryHourSchema).optional(),
    estimatedMinutes: z.number().int().min(0).optional(),
  }).optional(),
  takeaway: z.object({
    enabled: z.boolean().optional(),
    fee: z.number().min(0).optional(),
  }).optional(),
});

export type UpdateChannelConfigInput = z.infer<typeof updateChannelConfigSchema>;
