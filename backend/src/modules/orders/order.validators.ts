import { z } from 'zod';
import { ORDER_STATUSES } from '../../config/constants';

export const joinTableSchema = z.object({
  tableToken: z.string().min(1),
  sessionId: z.string().uuid(),
  alias: z.string().max(50).optional(),
  orderType: z.enum(['dine_in', 'takeaway', 'manual']).optional().default('dine_in'),
});

export const addItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
  modifiers: z
    .array(
      z.object({
        groupId: z.string(),
        groupName: z.string(),
        optionId: z.string(),
        optionName: z.string(),
        priceAdd: z.number().min(0),
      })
    )
    .optional()
    .default([]),
  selectedGroups: z
    .array(
      z.object({
        groupId: z.string().min(1),
        groupName: z.string().min(1),
        selectedOptions: z.array(
          z.object({
            optionId: z.string().min(1),
            optionName: z.string().min(1),
            priceDelta: z.number().default(0),
          })
        ),
      })
    )
    .optional()
    .default([]),
  selectedMenuGroups: z
    .array(
      z.object({
        groupId: z.string().min(1),
        groupKey: z.string().min(1),
        groupName: z.string().min(1),
        omitted: z.boolean(),
        selectedProductId: z.string().optional(),
        selectedProductName: z.string().optional(),
        omitDiscount: z.number().min(0).default(0),
      })
    )
    .optional()
    .default([]),
  selectedAccompaniments: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        categoryName: z.string().min(1),
        productId: z.string().min(1),
        productName: z.string().min(1),
      })
    )
    .optional()
    .default([]),
  notes: z.string().max(300).optional(),
  sessionId: z.string().uuid(),
  alias: z.string().max(50).optional(),
});

export const updateItemSchema = z.object({
  quantity: z.number().int().min(1).max(50).optional(),
  notes: z.string().max(300).optional(),
  sessionId: z.string().uuid(),
});

export const changeStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES as unknown as [string, ...string[]]),
  notes: z.string().optional(),
});

export const createManualOrderSchema = z.object({
  tableId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export const createChannelOrderSchema = z.object({
  channelToken: z.string().min(1),
  orderType: z.enum(['delivery', 'takeaway']),
  sessionId: z.string().uuid(),
  customerInfo: z.object({
    name: z.string().min(1).max(100),
    phone: z.string().max(30).optional(),
    address: z.string().max(300).optional(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  }),
});

export type CreateManualOrderInput = z.infer<typeof createManualOrderSchema>;
export type CreateChannelOrderInput = z.infer<typeof createChannelOrderSchema>;

export type JoinTableInput = z.infer<typeof joinTableSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
