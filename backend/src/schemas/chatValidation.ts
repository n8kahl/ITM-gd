import { z } from 'zod';

/**
 * Zod schemas for chat endpoint validation.
 * Enforces strict input types and bounds.
 */

export const sendMessageSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID'),
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message cannot exceed 5000 characters')
    .trim(),
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
