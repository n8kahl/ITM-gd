import { z } from 'zod';

export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long (max 5000 characters)'),
  sessionId: z.string().uuid().optional(),
});
