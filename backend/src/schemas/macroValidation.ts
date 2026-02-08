import { z } from 'zod';

export const macroImpactParamSchema = z.object({
  symbol: z.enum(['SPX', 'NDX']).or(z.string().transform(s => s.toUpperCase()).pipe(z.enum(['SPX', 'NDX']))),
});
