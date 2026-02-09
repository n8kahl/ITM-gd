import { z } from 'zod';

export const earningsSymbolParamSchema = z.object({
  symbol: z.string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9._:-]{1,10}$/),
});

const watchlistSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : String(entry || '')))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}, z.array(z.string().min(1).max(10)).max(25).optional().default([]));

export const earningsCalendarQuerySchema = z.object({
  watchlist: watchlistSchema,
  days: z.coerce.number().int().min(1).max(60).optional().default(14),
});
