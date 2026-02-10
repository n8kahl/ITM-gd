import { z } from 'zod'

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const SYMBOL_REGEX = /^[A-Z0-9./]{1,16}$/

const dateLikeSchema = z.string().trim().refine((value) => {
  if (ISO_DATE_REGEX.test(value)) {
    return true
  }
  return z.string().datetime({ offset: true }).safeParse(value).success
}, {
  message: 'Expected ISO date format (YYYY-MM-DD or ISO 8601 datetime)',
})

const isoDateTimeSchema = z.string().trim().datetime({ offset: true })

const nullableBoundedNumber = (min: number, max: number) => z.preprocess((value) => {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    return Number(trimmed)
  }
  return value
}, z.union([z.number().min(min).max(max), z.null()]))

const nullableBoundedInteger = (min: number, max: number) => z.preprocess((value) => {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    return Number(trimmed)
  }
  return value
}, z.union([z.number().int().min(min).max(max), z.null()]))

const nullableTrimmedString = (max: number) => z.union([z.string().trim().max(max), z.null()])

const moodSchema = z.enum(['confident', 'neutral', 'anxious', 'frustrated', 'excited', 'fearful'])

const directionSchema = z.enum(['long', 'short', 'neutral'])

export const importBrokerNameSchema = z.enum([
  'Interactive Brokers',
  'Schwab / TD Ameritrade',
  'Robinhood',
  'E*Trade',
  'Fidelity',
  'Webull',
])

export const journalEntrySchema = z.object({
  symbol: z.string().trim().min(1).max(16).transform((value) => value.toUpperCase()).refine((value) => SYMBOL_REGEX.test(value), {
    message: 'Symbol must match [A-Z0-9./]{1,16}',
  }),
  direction: directionSchema.optional(),
  trade_date: dateLikeSchema.optional(),
  tradeDate: dateLikeSchema.optional(),
  entry_timestamp: z.union([isoDateTimeSchema, z.null()]).optional(),
  entryTimestamp: z.union([isoDateTimeSchema, z.null()]).optional(),
  exit_timestamp: z.union([isoDateTimeSchema, z.null()]).optional(),
  exitTimestamp: z.union([isoDateTimeSchema, z.null()]).optional(),

  entry_price: nullableBoundedNumber(0, 999_999).optional(),
  exit_price: nullableBoundedNumber(0, 999_999).optional(),
  position_size: nullableBoundedNumber(0, 999_999).optional(),
  pnl: nullableBoundedNumber(-999_999, 999_999).optional(),
  pnl_percentage: nullableBoundedNumber(-100_000, 100_000).optional(),
  profit_loss: nullableBoundedNumber(-999_999, 999_999).optional(),
  profit_loss_percent: nullableBoundedNumber(-100_000, 100_000).optional(),

  notes: nullableTrimmedString(10_000).optional(),
  setup_notes: nullableTrimmedString(10_000).optional(),
  execution_notes: nullableTrimmedString(10_000).optional(),
  lessons_learned: nullableTrimmedString(10_000).optional(),
  deviation_notes: nullableTrimmedString(10_000).optional(),

  tags: z.array(z.string().trim().min(1).max(50)).max(20).nullable().optional(),
  strategy: nullableTrimmedString(120).optional(),
  trade_type: z.string().trim().min(1).max(32).optional(),
  contract_type: z.enum(['stock', 'call', 'put', 'spread']).nullable().optional(),

  stop_loss: nullableBoundedNumber(0, 999_999).optional(),
  initial_target: nullableBoundedNumber(0, 999_999).optional(),
  hold_duration_min: nullableBoundedInteger(0, 525_600).optional(),
  mfe_percent: nullableBoundedNumber(-100_000, 100_000).optional(),
  mae_percent: nullableBoundedNumber(-100_000, 100_000).optional(),
  strike_price: nullableBoundedNumber(0, 999_999).optional(),
  expiration_date: z.union([dateLikeSchema, z.null()]).optional(),
  dte_at_entry: nullableBoundedInteger(0, 3_650).optional(),
  dte_at_exit: nullableBoundedInteger(0, 3_650).optional(),
  iv_at_entry: nullableBoundedNumber(0, 1_000).optional(),
  iv_at_exit: nullableBoundedNumber(0, 1_000).optional(),
  delta_at_entry: nullableBoundedNumber(-1_000, 1_000).optional(),
  theta_at_entry: nullableBoundedNumber(-1_000, 1_000).optional(),
  gamma_at_entry: nullableBoundedNumber(-1_000, 1_000).optional(),
  vega_at_entry: nullableBoundedNumber(-1_000, 1_000).optional(),
  underlying_at_entry: nullableBoundedNumber(0, 999_999).optional(),
  underlying_at_exit: nullableBoundedNumber(0, 999_999).optional(),

  mood_before: moodSchema.nullable().optional(),
  mood_after: moodSchema.nullable().optional(),
  discipline_score: nullableBoundedInteger(1, 5).optional(),
  followed_plan: z.boolean().nullable().optional(),

  session_id: z.union([z.string().uuid(), z.null()]).optional(),
  screenshot_url: nullableTrimmedString(2_048).optional(),
  screenshot_thumbnail_url: nullableTrimmedString(2_048).optional(),
  rating: nullableBoundedInteger(1, 5).optional(),
  ai_analysis: z.unknown().optional(),
  is_winner: z.boolean().nullable().optional(),
  is_favorite: z.boolean().optional(),
})

export const journalEntryUpdateSchema = journalEntrySchema.partial()
