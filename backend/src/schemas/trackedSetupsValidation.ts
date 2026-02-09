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

const statusSchema = z.enum(['active', 'triggered', 'invalidated', 'archived']);

export const createTrackedSetupSchema = z.object({
  source_opportunity_id: z.string().trim().min(1).max(255).optional(),
  symbol: symbolSchema,
  setup_type: z.string().trim().min(1).max(100),
  direction: z.enum(['bullish', 'bearish', 'neutral']),
  opportunity_data: z.record(z.unknown()),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const updateTrackedSetupSchema = z.object({
  status: statusSchema.optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' });

export const trackedSetupIdSchema = z.object({
  id: z.string().uuid(),
});

export const getTrackedSetupsQuerySchema = z.object({
  status: statusSchema.optional(),
});
