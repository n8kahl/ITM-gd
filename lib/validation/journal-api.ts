import { z } from 'zod'

export const analyticsPeriodSchema = z.enum(['7d', '30d', '90d', '1y']).default('30d')

export const gradeTradeRequestSchema = z.object({
  entryId: z.string().uuid(),
})

export const playbookSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  entry_criteria: z.string().max(3000).optional().nullable(),
  exit_criteria: z.string().max(3000).optional().nullable(),
  risk_rules: z.string().max(3000).optional().nullable(),
  rules: z.record(z.unknown()).optional().nullable(),
  tags: z.array(z.string().min(1).max(50)).max(30).optional().default([]),
  is_active: z.boolean().optional().default(true),
})

export const playbookUpdateSchema = playbookSchema.partial()

export const closePositionSchema = z.object({
  entryId: z.string().uuid(),
  exit_price: z.number().positive().optional(),
  exit_timestamp: z.string().datetime().optional(),
})

export const importTradeRowSchema = z.object({
  symbol: z.string().min(1).max(16),
  trade_date: z.string().optional(),
  entry_date: z.string().optional(),
  direction: z.string().optional(),
  type: z.string().optional(),
  position_type: z.string().optional(),
  entry_price: z.union([z.number(), z.string()]).optional(),
  exit_price: z.union([z.number(), z.string()]).optional(),
  position_size: z.union([z.number(), z.string()]).optional(),
  pnl: z.union([z.number(), z.string()]).optional(),
  pnl_percentage: z.union([z.number(), z.string()]).optional(),
  strategy: z.string().optional(),
  contract_type: z.string().optional(),
  strike_price: z.union([z.number(), z.string()]).optional(),
  expiration_date: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const importTradesSchema = z.object({
  broker: z.string().min(1).max(100),
  fileName: z.string().min(1).max(255),
  rows: z.array(importTradeRowSchema).min(1).max(2000),
})

export const behavioralQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const dismissBehavioralSchema = z.object({
  insightId: z.string().uuid(),
})

export const draftFromSessionSchema = z.object({
  sessionId: z.string().uuid(),
  marketDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const autoJournalSchema = z.object({
  marketDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const listDraftsSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'dismissed']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const confirmDraftSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['confirm', 'dismiss']).default('confirm'),
})

export const dashboardLayoutSchema = z.object({
  layout: z.record(z.unknown()),
})

export const pushSubscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }).partial().optional(),
  }).passthrough(),
})

export const deletePushSubscriptionSchema = z.object({
  endpoint: z.string().url().optional(),
})
