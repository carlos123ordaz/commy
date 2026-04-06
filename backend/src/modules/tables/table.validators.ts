import { z } from 'zod';

export const createTableSchema = z.object({
  name: z.string().min(1).max(50),
  number: z.number().int().positive().optional(),
  capacity: z.number().int().min(1).max(50).default(4),
  zone: z.string().max(50).optional(),
});

export const updateTableSchema = createTableSchema.partial();

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
