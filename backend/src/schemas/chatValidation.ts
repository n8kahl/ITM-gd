import { z } from 'zod';

/**
 * Zod schemas for chat endpoint validation.
 * Enforces strict input types and bounds.
 */

const chartSymbolSchema = z.string()
  .trim()
  .regex(/^[A-Za-z0-9._:-]{1,10}$/, 'activeChartSymbol must be a valid ticker symbol')
  .transform((value) => value.toUpperCase());

export const sendMessageSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID').optional(),
  message: z.string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message cannot exceed 5000 characters'),
  image: z.string().min(1).optional(),
  imageMimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']).optional(),
  context: z.object({
    activeChartSymbol: chartSymbolSchema.optional(),
  }).optional(),
});

export const getSessionMessagesSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID'),
});

export const deleteSessionSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID'),
});

export const getSessionsQuerySchema = z.object({
  limit: z.string().optional().transform(val => {
    const num = val ? parseInt(val, 10) : 10;
    return Math.min(Math.max(num, 1), 50);
  }),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetSessionMessagesInput = z.infer<typeof getSessionMessagesSchema>;
