import { z } from 'zod';

export const createTradeSchema = z.object({
  symbol: z.string().min(1).max(10).transform(v => v.toUpperCase()),
  position_type: z.enum(['call', 'put', 'stock']),
  strategy: z.string().max(100).optional(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  entry_price: z.number().positive(),
  exit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  exit_price: z.number().positive().optional(),
  quantity: z.number().int().positive(),
  strike: z.number().positive().optional(),
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  exit_reason: z.string().max(200).optional(),
  lessons: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateTradeSchema = z.object({
  exit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  exit_price: z.number().positive().optional(),
  exit_reason: z.string().max(200).optional(),
  lessons: z.string().max(1000).optional(),
  strategy: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(2000).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export const tradesQuerySchema = z.object({
  symbol: z.string().max(10).optional(),
  outcome: z.enum(['win', 'loss', 'breakeven']).optional(),
  page: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const importTradesSchema = z.object({
  trades: z.array(z.object({
    symbol: z.string().min(1),
    position_type: z.enum(['call', 'put', 'stock']),
    entry_date: z.string(),
    entryPrice: z.number().optional(),
    entry_price: z.number().optional(),
    quantity: z.number().int().positive().optional(),
  })).min(1, 'At least one trade is required'),
  broker: z.string().optional(),
});
