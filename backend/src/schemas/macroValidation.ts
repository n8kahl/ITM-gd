import { z } from 'zod';
import { normalizeSymbol, SYMBOL_REGEX } from '../lib/symbols';

export const macroImpactParamSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(10)
    .transform((symbol) => normalizeSymbol(symbol))
    .refine((symbol) => SYMBOL_REGEX.test(symbol), { message: 'Invalid symbol format' }),
});
