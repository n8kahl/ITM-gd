import { z } from 'zod'

const symbolRegex = /^[A-Z0-9./]{1,16}$/

export const moodSchema = z.enum(['confident', 'neutral', 'anxious', 'frustrated', 'excited', 'fearful'])

export const directionSchema = z.enum(['long', 'short'])

export const contractTypeSchema = z.enum(['stock', 'call', 'put'])

export const aiTradeAnalysisSchema = z.object({
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  entry_quality: z.string().max(500),
  exit_quality: z.string().max(500),
  risk_management: z.string().max(500),
  lessons: z.array(z.string().max(200)).max(5),
  scored_at: z.string().datetime(),
})

const journalEntryBaseSchema = z.object({
  symbol: z.string().min(1).max(16).transform((s) => s.toUpperCase().trim())
    .refine((s) => symbolRegex.test(s), 'Invalid symbol format'),
  direction: directionSchema.default('long'),
  contract_type: contractTypeSchema.default('stock'),
  trade_date: z.string().datetime().optional(),
  entry_price: z.number().positive().max(999_999).nullable().optional(),
  exit_price: z.number().positive().max(999_999).nullable().optional(),
  position_size: z.number().positive().max(999_999).nullable().optional(),
  pnl: z.number().min(-999_999).max(999_999).nullable().optional(),
  pnl_percentage: z.number().min(-100_000).max(100_000).nullable().optional(),
  is_open: z.boolean().default(false),
  entry_timestamp: z.string().datetime().nullable().optional(),
  exit_timestamp: z.string().datetime().nullable().optional(),
  stop_loss: z.number().nonnegative().max(999_999).nullable().optional(),
  initial_target: z.number().nonnegative().max(999_999).nullable().optional(),
  hold_duration_min: z.number().int().nonnegative().max(525_600).nullable().optional(),
  mfe_percent: z.number().min(-100_000).max(100_000).nullable().optional(),
  mae_percent: z.number().min(-100_000).max(100_000).nullable().optional(),
  strike_price: z.number().positive().max(999_999).nullable().optional(),
  expiration_date: z.string().date().nullable().optional(),
  dte_at_entry: z.number().int().nonnegative().max(3_650).nullable().optional(),
  iv_at_entry: z.number().nonnegative().max(1_000).nullable().optional(),
  delta_at_entry: z.number().min(-10).max(10).nullable().optional(),
  theta_at_entry: z.number().min(-1_000).max(1_000).nullable().optional(),
  gamma_at_entry: z.number().min(-1_000).max(1_000).nullable().optional(),
  vega_at_entry: z.number().min(-1_000).max(1_000).nullable().optional(),
  underlying_at_entry: z.number().positive().max(999_999).nullable().optional(),
  underlying_at_exit: z.number().positive().max(999_999).nullable().optional(),
  mood_before: moodSchema.nullable().optional(),
  mood_after: moodSchema.nullable().optional(),
  discipline_score: z.number().int().min(1).max(5).nullable().optional(),
  followed_plan: z.boolean().nullable().optional(),
  deviation_notes: z.string().max(5_000).nullable().optional(),
  strategy: z.string().max(120).nullable().optional(),
  setup_notes: z.string().max(10_000).nullable().optional(),
  execution_notes: z.string().max(10_000).nullable().optional(),
  lessons_learned: z.string().max(10_000).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  screenshot_url: z.string().url().max(2_048).nullable().optional(),
  screenshot_storage_path: z.string().max(512).nullable().optional(),
  is_favorite: z.boolean().default(false),
})

export const journalEntryCreateSchema = journalEntryBaseSchema
  .refine((data) => {
  if (data.entry_timestamp && data.exit_timestamp) {
    return new Date(data.exit_timestamp) >= new Date(data.entry_timestamp)
  }
  return true
}, { message: 'exit_timestamp must be >= entry_timestamp' })
  .refine((data) => {
    if (data.is_open && data.exit_price != null) {
      return false
    }
    return true
  }, { message: 'Open positions cannot have an exit price' })
  .refine((data) => {
    if (data.contract_type === 'stock') {
      return data.strike_price == null && data.expiration_date == null
    }
    return true
  }, { message: 'Stock entries cannot have strike price or expiration date' })

/**
 * Backward-compatible schema export used by older tests and imports.
 */
export const journalEntrySchema = journalEntryCreateSchema

export const journalEntryUpdateSchema = journalEntryBaseSchema
  .partial()
  .extend({ id: z.string().uuid() })

export const importTradeRowSchema = z.object({
  symbol: z.string().min(1).max(64).optional(),
  trade_date: z.string().optional(),
  entry_date: z.string().optional(),
  date: z.string().optional(),
  direction: z.string().optional(),
  side: z.string().optional(),
  action: z.string().optional(),
  type: z.string().optional(),
  contract_type: z.string().optional(),
  entry_price: z.union([z.number(), z.string()]).optional(),
  exit_price: z.union([z.number(), z.string()]).optional(),
  position_size: z.union([z.number(), z.string()]).optional(),
  quantity: z.union([z.number(), z.string()]).optional(),
  pnl: z.union([z.number(), z.string()]).optional(),
  pnl_percentage: z.union([z.number(), z.string()]).optional(),
  strategy: z.string().optional(),
  strike_price: z.union([z.number(), z.string()]).optional(),
  expiration_date: z.string().optional(),
}).passthrough().superRefine((row, ctx) => {
  const symbolCandidates = [
    row.symbol,
    row.Symbol,
    row.Ticker,
    row.underlying,
    row.Name,
    row.name,
  ]
  const hasSymbolSignal = symbolCandidates.some((value) => typeof value === 'string' && value.trim().length > 0)
  if (!hasSymbolSignal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Missing symbol field (symbol/Symbol/Ticker/Name)',
      path: ['symbol'],
    })
  }
})

export const importBrokerSchema = z.enum([
  'interactive_brokers',
  'schwab',
  'robinhood',
  'etrade',
  'fidelity',
  'webull',
])

export const importRequestSchema = z.object({
  broker: importBrokerSchema,
  fileName: z.string().min(1).max(255),
  rows: z.array(importTradeRowSchema).min(1).max(500),
})

export const analyticsPeriodSchema = z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d')

export const screenshotUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
})

export const gradeEntriesSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1).max(10),
})

export const dashboardLayoutSchema = z.object({
  layout: z.record(z.unknown()),
})

export const behavioralQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const dismissBehavioralSchema = z.object({
  insightId: z.string().uuid(),
})

export function sanitizeString(input: string, maxLength: number): string {
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, maxLength)
}
