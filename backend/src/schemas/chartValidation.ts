import { z } from 'zod';
import { SYMBOL_REGEX } from '../lib/symbols';

export const chartParamSchema = z.object({
  symbol: z.string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => SYMBOL_REGEX.test(s), {
      message: 'Symbol must be 1-10 chars and may include letters, numbers, dot, underscore, colon, or hyphen',
    }),
});

const queryBooleanSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
}, z.boolean());

export const chartQuerySchema = z.object({
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1D', '1W', '1M']).optional().default('1D'),
  bars: z.coerce.number().int().min(1).max(500).optional(),
  includeIndicators: queryBooleanSchema.optional().default(false),
});
