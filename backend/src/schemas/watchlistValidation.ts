import { z } from 'zod';

const symbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(10)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9._:-]{1,10}$/.test(value), {
    message: 'Symbol must be 1-10 characters (A-Z, 0-9, ., _, :, -)',
  });

export const createWatchlistSchema = z.object({
  name: z.string().trim().min(1).max(80).default('Default'),
  symbols: z.array(symbolSchema).min(1).max(50),
  isDefault: z.boolean().optional().default(false),
});

export const updateWatchlistSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  symbols: z.array(symbolSchema).min(1).max(50).optional(),
  isDefault: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' });

export const watchlistIdSchema = z.object({
  id: z.string().uuid(),
});
