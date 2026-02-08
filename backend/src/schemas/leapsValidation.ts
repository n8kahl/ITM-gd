import { z } from 'zod';

export const leapsIdSchema = z.object({
  id: z.string().uuid(),
});

export const createLeapsSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  option_type: z.enum(['CALL', 'PUT']).or(z.enum(['call', 'put']).transform(s => s.toUpperCase() as 'CALL' | 'PUT')),
  strike: z.number().positive(),
  entry_price: z.number().positive(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.number().int().positive(),
  notes: z.string().max(2000).optional().nullable(),
  entry_delta: z.number().optional().nullable(),
  entry_gamma: z.number().optional().nullable(),
  entry_vega: z.number().optional().nullable(),
  entry_theta: z.number().optional().nullable(),
});

export const updateLeapsSchema = z.object({
  current_value: z.number().optional(),
  current_underlying: z.number().optional(),
  current_iv: z.number().min(0).max(5).optional(),
  current_delta: z.number().optional(),
  current_gamma: z.number().optional(),
  current_vega: z.number().optional(),
  current_theta: z.number().optional(),
  notes: z.string().max(2000).optional().nullable(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

export const rollCalculationSchema = z.object({
  newStrike: z.number().positive(),
  newExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
