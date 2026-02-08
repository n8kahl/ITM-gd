import { z } from 'zod';

export const levelsParamSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
});

export const levelsQuerySchema = z.object({
  timeframe: z.enum(['intraday', 'daily', 'weekly']).optional().default('intraday'),
});
