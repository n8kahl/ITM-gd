import { z } from 'zod';

const symbolListSchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((symbol) => symbol.trim())
      .filter(Boolean);
  }
  return [];
}, z.array(z.string().min(1).max(10)).max(150).default([]));

const scanLimitSchema = z.preprocess((value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 150;
}, z.number().int().min(25).max(150).default(150));

const refreshSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return false;
}, z.boolean().default(false));

export const swingSniperUniverseQuerySchema = z.object({
  symbols: symbolListSchema,
  limit: scanLimitSchema,
  refresh: refreshSchema,
});

export const swingSniperWatchlistBodySchema = z.object({
  symbols: z.array(z.string().min(1).max(10)).max(50).optional(),
  selectedSymbol: z.string().min(1).max(10).nullable().optional(),
  filters: z.object({
    preset: z.enum(['all', 'long_vol', 'short_vol', 'catalyst_dense', 'seven_day']).optional(),
    minScore: z.number().int().min(0).max(100).optional(),
    riskMode: z.enum(['defined_risk_only', 'naked_allowed']).optional(),
    swingWindow: z.enum(['seven_to_fourteen', 'fourteen_to_thirty', 'all']).optional(),
    preferredSetups: z.array(z.enum([
      'long_call',
      'long_put',
      'long_straddle',
      'long_strangle',
      'call_debit_spread',
      'put_debit_spread',
      'call_calendar',
      'put_calendar',
      'call_diagonal',
      'put_diagonal',
      'call_butterfly',
      'put_butterfly',
    ])).max(12).optional(),
  }).partial().optional(),
  thesis: z.object({
    symbol: z.string().min(1).max(10),
    score: z.number().int().min(0).max(100).nullable(),
    setupLabel: z.string().min(1).max(160),
    direction: z.enum(['long_vol', 'short_vol', 'neutral']),
    thesis: z.string().min(1).max(1000),
    ivRankAtSave: z.number().min(0).max(100).nullable(),
    catalystLabel: z.string().max(200).nullable().optional(),
    catalystDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    monitorNote: z.string().max(300).nullable().optional(),
  }).optional(),
});

export const swingSniperStructureRecommendBodySchema = z.object({
  symbol: z.string().min(1).max(10),
  direction: z.enum(['long_vol', 'short_vol', 'neutral']).optional(),
  maxRecommendations: z.number().int().min(2).max(8).optional(),
});
