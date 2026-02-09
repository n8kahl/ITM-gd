import { z } from 'zod';

export const symbolsSearchQuerySchema = z.object({
  q: z.string().trim().max(30).optional().default(''),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
