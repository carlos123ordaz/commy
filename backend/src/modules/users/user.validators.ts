import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and underscores only'),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['owner', 'cashier', 'kitchen', 'waiter']),
});

export const updateUserSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['owner', 'cashier', 'kitchen', 'waiter']).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
