import { z } from 'zod';

export const createAlertSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  alert_type: z.enum(['price_above', 'price_below', 'level_approach', 'level_break', 'volume_spike']),
  target_value: z.number().positive(),
  notification_channels: z.array(z.string()).optional().default(['in-app']),
  notes: z.string().max(500).optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
});

export const updateAlertSchema = z.object({
  target_value: z.number().positive().optional(),
  notification_channels: z.array(z.string()).optional(),
  notes: z.string().max(500).optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  status: z.enum(['active', 'triggered', 'cancelled', 'expired']).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

export const alertIdSchema = z.object({
  id: z.string().uuid(),
});

export const getAlertsQuerySchema = z.object({
  status: z.enum(['active', 'triggered', 'cancelled', 'expired']).optional(),
  symbol: z.string().min(1).max(10).optional(),
});
