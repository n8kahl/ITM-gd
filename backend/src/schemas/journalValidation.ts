import { z } from 'zod';

const journalPositionTypeSchema = z.enum(['call', 'put', 'stock']);

export const createTradeSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  position_type: journalPositionTypeSchema,
  strategy: z.string().max(100).optional().nullable(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entry_price: z.number().positive(),
  exit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  exit_price: z.number().positive().optional().nullable(),
  quantity: z.number().int().positive(),
  exit_reason: z.string().max(500).optional().nullable(),
  lessons_learned: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
});

export const updateTradeSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()).optional(),
  position_type: journalPositionTypeSchema.optional(),
  strategy: z.string().max(100).optional().nullable(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  entry_price: z.number().positive().optional(),
  exit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  exit_price: z.number().positive().optional().nullable(),
  quantity: z.number().int().positive().optional(),
  exit_reason: z.string().max(500).optional().nullable(),
  lessons_learned: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const tradeIdSchema = z.object({
  id: z.string().uuid(),
});

export const getTradesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  symbol: z.string().min(1).max(10).optional(),
  strategy: z.string().max(100).optional(),
  outcome: z.enum(['win', 'loss', 'breakeven']).optional(),
  draft_status: z.enum(['draft', 'reviewed', 'published']).optional(),
});

export const getDraftTradesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  status: z.enum(['draft', 'reviewed', 'published', 'all']).optional().default('draft'),
});

export const generateDraftsSchema = z.object({
  marketDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateDraftStatusSchema = z.object({
  draft_status: z.enum(['draft', 'reviewed', 'published']),
});

export const getJournalInsightsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('30d'),
  forceRefresh: z.preprocess((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }, z.boolean()).optional().default(false),
});

export const importTradesSchema = z.object({
  trades: z.array(z.object({
    symbol: z.string().min(1),
    position_type: z.string().optional(),
    type: z.string().optional(),
    strategy: z.string().optional().nullable(),
    entry_date: z.string().optional(),
    entryDate: z.string().optional(),
    entry_price: z.number().optional(),
    entryPrice: z.number().optional(),
    exit_date: z.string().optional().nullable(),
    exitDate: z.string().optional().nullable(),
    exit_price: z.number().optional().nullable(),
    exitPrice: z.number().optional().nullable(),
    quantity: z.number().optional(),
    pnl: z.number().optional().nullable(),
    pnl_pct: z.number().optional().nullable(),
    trade_outcome: z.string().optional().nullable(),
    hold_time_days: z.number().optional().nullable(),
    tags: z.array(z.string()).optional(),
  })).min(1).max(500),
});
