import { z } from 'zod';

export const symbolParamSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
});

export const optionsChainQuerySchema = z.object({
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  strikeRange: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const optionsMatrixQuerySchema = z.object({
  expirations: z.coerce.number().int().min(1).max(10).optional().default(5),
  strikes: z.coerce.number().int().min(10).max(80).optional().default(50),
});

const booleanQuerySchema = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return value;
}, z.boolean());

export const gexQuerySchema = z.object({
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  strikeRange: z.coerce.number().int().min(5).max(50).optional().default(30),
  maxExpirations: z.coerce.number().int().min(1).max(12).optional().default(6),
  forceRefresh: booleanQuerySchema.optional().default(false),
});

export const zeroDTEQuerySchema = z.object({
  strike: z.coerce.number().positive().optional(),
  type: z.enum(['call', 'put']).optional(),
});

export const ivAnalysisQuerySchema = z.object({
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  strikeRange: z.coerce.number().int().min(5).max(50).optional().default(20),
  maxExpirations: z.coerce.number().int().min(1).max(12).optional().default(6),
  forceRefresh: booleanQuerySchema.optional().default(false),
});

export const positionAdviceQuerySchema = z.object({
  positionId: z.string().uuid().optional(),
  position_id: z.string().uuid().optional(),
});

export const analyzePositionSchema = z.object({
  position: z.object({
    symbol: z.string().min(1).max(10),
    type: z.enum(['call', 'put', 'call_spread', 'put_spread', 'iron_condor', 'stock']),
    strike: z.number().positive().optional(),
    expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    quantity: z.number().int().refine(n => n !== 0),
    entryPrice: z.number().positive(),
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).optional(),
  positions: z.array(z.object({
    symbol: z.string().min(1).max(10),
    type: z.enum(['call', 'put', 'call_spread', 'put_spread', 'iron_condor', 'stock']),
    strike: z.number().positive().optional(),
    expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    quantity: z.number().int().refine(n => n !== 0),
    entryPrice: z.number().positive(),
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })).min(1).optional(),
}).refine(data => (data.position && !data.positions) || (!data.position && data.positions), {
  message: 'Must provide either "position" or "positions", not both',
});
