import { z } from 'zod';

export const alertTypeEnum = z.enum([
  'price_above',
  'price_below',
  'level_approach',
  'level_break',
  'volume_spike',
]);

export const alertStatusEnum = z.enum(['active', 'triggered', 'cancelled']);

export const createAlertSchema = z.object({
  symbol: z.string().min(1).max(10).transform(v => v.toUpperCase()),
  alert_type: alertTypeEnum,
  target_value: z.number().positive(),
  notification_channels: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
  expires_at: z.string().datetime().optional(),
});

export const updateAlertSchema = z.object({
  target_value: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
  expires_at: z.string().datetime().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export const alertsQuerySchema = z.object({
  status: alertStatusEnum.optional(),
  symbol: z.string().max(10).optional(),
});
