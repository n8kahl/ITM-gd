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
}, z.array(z.string().min(1).max(10)).max(50).default([]));

export const swingSniperUniverseQuerySchema = z.object({
  symbols: symbolListSchema,
});

export const swingSniperWatchlistBodySchema = z.object({
  symbols: z.array(z.string().min(1).max(10)).max(50).optional(),
  selectedSymbol: z.string().min(1).max(10).nullable().optional(),
  filters: z.object({
    preset: z.enum(['all', 'long_vol', 'short_vol', 'catalyst_dense']).optional(),
    minScore: z.number().int().min(0).max(100).optional(),
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
