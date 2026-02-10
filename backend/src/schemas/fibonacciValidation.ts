import { z } from 'zod';

export const fibonacciBodySchema = z.object({
  symbol: z.string().min(1).max(10).transform((value) => value.toUpperCase()),
  timeframe: z.enum(['daily', '1h', '15m', '5m']).optional().default('daily'),
  lookback: z.number().int().min(2).max(100).optional().default(20),
});

