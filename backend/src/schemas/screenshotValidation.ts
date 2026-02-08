import { z } from 'zod';

export const analyzeScreenshotSchema = z.object({
  image: z.string().min(1),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']).optional().default('image/png'),
});
