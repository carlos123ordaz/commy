import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  imageUrl: z.string().optional(),
  order: z.number().int().optional(),
});

const selectionOptionSchema = z.object({
  name: z.string().min(1).max(150),
  priceDelta: z.number().default(0),
  isAvailable: z.boolean().default(true),
});

const selectionGroupSchema = z.object({
  name: z.string().min(1).max(100),
  required: z.boolean().default(false),
  minSelections: z.number().int().min(0).default(1),
  maxSelections: z.number().int().min(1).default(1),
  options: z.array(selectionOptionSchema).min(1, 'El grupo debe tener al menos una opción'),
});

const menuGroupSchema = z.object({
  key: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  required: z.boolean().default(true),
  maxSelections: z.number().int().min(1).default(1),
  allowNoneOption: z.boolean().default(false),
  omitDiscount: z.number().min(0).default(0),
  allowedProducts: z.array(z.string().min(1)).min(1, 'El grupo debe tener al menos un producto'),
});

export const createProductSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  price: z.number().min(0),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().optional(),
  estimatedTime: z.number().int().min(1).optional(),
  modifierGroups: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  order: z.number().int().optional(),
  productType: z.enum(['simple', 'configurable', 'combo', 'menu']).default('simple'),
  selectionGroups: z.array(selectionGroupSchema).optional().default([]),
  menuGroups: z.array(menuGroupSchema).optional().default([]),
  isCompanion: z.boolean().optional().default(false),
});

export const createModifierGroupSchema = z.object({
  name: z.string().min(1).max(100),
  required: z.boolean().default(false),
  multipleSelection: z.boolean().default(false),
  minSelections: z.number().int().min(0).default(0),
  maxSelections: z.number().int().min(1).default(1),
  options: z.array(
    z.object({
      name: z.string().min(1),
      priceAdd: z.number().min(0).default(0),
      isAvailable: z.boolean().default(true),
    })
  ).min(1),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type CreateModifierGroupInput = z.infer<typeof createModifierGroupSchema>;
