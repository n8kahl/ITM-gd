import { z } from 'zod'
import type { AITradeAnalysis, JournalEntry, JournalMood, MarketContextSnapshot } from '@/lib/types/journal'
import {
  aiTradeAnalysisSchema,
  contractTypeSchema,
  directionSchema,
  moodSchema,
  sanitizeString,
} from '@/lib/validation/journal-entry'
import { parseNumericInput } from '@/lib/journal/number-parsing'

const marketContextSnapshotSchema: z.ZodType<MarketContextSnapshot> = z.object({
  entryContext: z.object({
    timestamp: z.string(),
    price: z.number(),
    vwap: z.number(),
    atr14: z.number(),
    volumeVsAvg: z.number(),
    distanceFromPDH: z.number(),
    distanceFromPDL: z.number(),
    nearestLevel: z.object({
      name: z.string(),
      price: z.number(),
      distance: z.number(),
    }),
  }),
  exitContext: z.object({
    timestamp: z.string(),
    price: z.number(),
    vwap: z.number(),
    atr14: z.number(),
    volumeVsAvg: z.number(),
    distanceFromPDH: z.number(),
    distanceFromPDL: z.number(),
    nearestLevel: z.object({
      name: z.string(),
      price: z.number(),
      distance: z.number(),
    }),
  }),
  optionsContext: z.object({
    ivAtEntry: z.number(),
    ivAtExit: z.number(),
    ivRankAtEntry: z.number(),
    deltaAtEntry: z.number(),
    thetaAtEntry: z.number(),
    dteAtEntry: z.number(),
    dteAtExit: z.number(),
  }).optional(),
  dayContext: z.object({
    marketTrend: z.enum(['bullish', 'bearish', 'neutral']),
    atrUsed: z.number(),
    sessionType: z.enum(['trending', 'range-bound', 'volatile']),
    keyLevelsActive: z.object({
      pdh: z.number(),
      pdl: z.number(),
      pdc: z.number(),
      vwap: z.number(),
      atr14: z.number(),
      pivotPP: z.number(),
      pivotR1: z.number(),
      pivotS1: z.number(),
    }),
  }),
})

const textFieldMaxLengths = {
  symbol: 16,
  strategy: 120,
  setup_notes: 10_000,
  execution_notes: 10_000,
  lessons_learned: 10_000,
  deviation_notes: 5_000,
  screenshot_url: 2_048,
  screenshot_storage_path: 512,
  import_id: 64,
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const sanitized = sanitizeString(value, maxLength)
  return sanitized.length > 0 ? sanitized : null
}

function asNumber(value: unknown): number | null {
  const parsed = parseNumericInput(value)
  return parsed.valid ? parsed.value : null
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return null
}

function asDateTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString()
}

function asDateOnly(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString().split('T')[0]
}

function asDirection(value: unknown): 'long' | 'short' {
  const parsed = directionSchema.safeParse(typeof value === 'string' ? value.trim().toLowerCase() : value)
  return parsed.success ? parsed.data : 'long'
}

function asContractType(value: unknown): 'stock' | 'call' | 'put' {
  const parsed = contractTypeSchema.safeParse(typeof value === 'string' ? value.trim().toLowerCase() : value)
  return parsed.success ? parsed.data : 'stock'
}

function asMood(value: unknown): JournalMood | null {
  if (value == null) return null
  const parsed = moodSchema.safeParse(typeof value === 'string' ? value.trim().toLowerCase() : value)
  return parsed.success ? parsed.data : null
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((tag) => asString(tag, 50))
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, 20)
}

function asAIAnalysis(value: unknown): AITradeAnalysis | null {
  const parsed = aiTradeAnalysisSchema.safeParse(value)
  if (!parsed.success) return null

  return {
    ...parsed.data,
    entry_quality: sanitizeString(parsed.data.entry_quality, 500),
    exit_quality: sanitizeString(parsed.data.exit_quality, 500),
    risk_management: sanitizeString(parsed.data.risk_management, 500),
    lessons: parsed.data.lessons
      .map((lesson) => sanitizeString(lesson, 200))
      .filter((lesson) => lesson.length > 0)
      .slice(0, 5),
  }
}

function asMarketContext(value: unknown): MarketContextSnapshot | null {
  const parsed = marketContextSnapshotSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function sanitizeJournalWriteInput(input: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  if (input.trade_date !== undefined) {
    sanitized.trade_date = asDateTime(input.trade_date) ?? new Date().toISOString()
  }

  if (input.symbol !== undefined) {
    const next = asString(input.symbol, textFieldMaxLengths.symbol)
    sanitized.symbol = next ? next.toUpperCase() : null
  }

  if (input.direction !== undefined) {
    sanitized.direction = asDirection(input.direction)
  }

  if (input.contract_type !== undefined) {
    sanitized.contract_type = asContractType(input.contract_type)
  }

  if (input.entry_price !== undefined) sanitized.entry_price = asNumber(input.entry_price)
  if (input.exit_price !== undefined) sanitized.exit_price = asNumber(input.exit_price)
  if (input.position_size !== undefined) sanitized.position_size = asNumber(input.position_size)
  if (input.pnl !== undefined) sanitized.pnl = asNumber(input.pnl)
  if (input.pnl_percentage !== undefined) sanitized.pnl_percentage = asNumber(input.pnl_percentage)
  if (input.is_open !== undefined) sanitized.is_open = asBoolean(input.is_open) ?? false

  if (input.entry_timestamp !== undefined) sanitized.entry_timestamp = asDateTime(input.entry_timestamp)
  if (input.exit_timestamp !== undefined) sanitized.exit_timestamp = asDateTime(input.exit_timestamp)

  if (input.stop_loss !== undefined) sanitized.stop_loss = asNumber(input.stop_loss)
  if (input.initial_target !== undefined) sanitized.initial_target = asNumber(input.initial_target)
  if (input.hold_duration_min !== undefined) sanitized.hold_duration_min = asNumber(input.hold_duration_min)
  if (input.mfe_percent !== undefined) sanitized.mfe_percent = asNumber(input.mfe_percent)
  if (input.mae_percent !== undefined) sanitized.mae_percent = asNumber(input.mae_percent)

  if (input.strike_price !== undefined) sanitized.strike_price = asNumber(input.strike_price)
  if (input.expiration_date !== undefined) sanitized.expiration_date = asDateOnly(input.expiration_date)
  if (input.dte_at_entry !== undefined) sanitized.dte_at_entry = asNumber(input.dte_at_entry)
  if (input.iv_at_entry !== undefined) sanitized.iv_at_entry = asNumber(input.iv_at_entry)
  if (input.delta_at_entry !== undefined) sanitized.delta_at_entry = asNumber(input.delta_at_entry)
  if (input.theta_at_entry !== undefined) sanitized.theta_at_entry = asNumber(input.theta_at_entry)
  if (input.gamma_at_entry !== undefined) sanitized.gamma_at_entry = asNumber(input.gamma_at_entry)
  if (input.vega_at_entry !== undefined) sanitized.vega_at_entry = asNumber(input.vega_at_entry)
  if (input.underlying_at_entry !== undefined) sanitized.underlying_at_entry = asNumber(input.underlying_at_entry)
  if (input.underlying_at_exit !== undefined) sanitized.underlying_at_exit = asNumber(input.underlying_at_exit)

  if (input.mood_before !== undefined) sanitized.mood_before = asMood(input.mood_before)
  if (input.mood_after !== undefined) sanitized.mood_after = asMood(input.mood_after)
  if (input.discipline_score !== undefined) sanitized.discipline_score = asNumber(input.discipline_score)
  if (input.followed_plan !== undefined) sanitized.followed_plan = asBoolean(input.followed_plan)

  if (input.deviation_notes !== undefined) sanitized.deviation_notes = asString(input.deviation_notes, textFieldMaxLengths.deviation_notes)
  if (input.strategy !== undefined) sanitized.strategy = asString(input.strategy, textFieldMaxLengths.strategy)
  if (input.setup_notes !== undefined) sanitized.setup_notes = asString(input.setup_notes, textFieldMaxLengths.setup_notes)
  if (input.execution_notes !== undefined) sanitized.execution_notes = asString(input.execution_notes, textFieldMaxLengths.execution_notes)
  if (input.lessons_learned !== undefined) sanitized.lessons_learned = asString(input.lessons_learned, textFieldMaxLengths.lessons_learned)

  if (input.tags !== undefined) sanitized.tags = asTags(input.tags)

  if (input.rating !== undefined) sanitized.rating = asNumber(input.rating)

  if (input.screenshot_url !== undefined) sanitized.screenshot_url = asString(input.screenshot_url, textFieldMaxLengths.screenshot_url)
  if (input.screenshot_storage_path !== undefined) {
    sanitized.screenshot_storage_path = asString(input.screenshot_storage_path, textFieldMaxLengths.screenshot_storage_path)
  }

  if (input.ai_analysis !== undefined) sanitized.ai_analysis = asAIAnalysis(input.ai_analysis)
  if (input.market_context !== undefined) sanitized.market_context = asMarketContext(input.market_context)
  if (input.import_id !== undefined) sanitized.import_id = asString(input.import_id, textFieldMaxLengths.import_id)
  if (input.is_favorite !== undefined) sanitized.is_favorite = asBoolean(input.is_favorite) ?? false

  return sanitized
}

export function sanitizeJournalEntry(raw: unknown, fallbackId = 'entry-0'): JournalEntry {
  const nowIso = new Date().toISOString()
  const value = isRecord(raw) ? raw : {}

  const symbol = asString(value.symbol, textFieldMaxLengths.symbol)

  return {
    id: asString(value.id, 64) ?? fallbackId,
    user_id: asString(value.user_id, 64) ?? 'unknown',

    trade_date: asDateTime(value.trade_date) ?? nowIso,
    symbol: symbol ? symbol.toUpperCase() : 'UNKNOWN',
    direction: asDirection(value.direction),
    contract_type: asContractType(value.contract_type),
    entry_price: asNumber(value.entry_price),
    exit_price: asNumber(value.exit_price),
    position_size: asNumber(value.position_size),
    pnl: asNumber(value.pnl),
    pnl_percentage: asNumber(value.pnl_percentage),
    is_winner: asBoolean(value.is_winner),
    is_open: asBoolean(value.is_open) ?? false,

    entry_timestamp: asDateTime(value.entry_timestamp),
    exit_timestamp: asDateTime(value.exit_timestamp),

    stop_loss: asNumber(value.stop_loss),
    initial_target: asNumber(value.initial_target),
    hold_duration_min: asNumber(value.hold_duration_min),
    mfe_percent: asNumber(value.mfe_percent),
    mae_percent: asNumber(value.mae_percent),

    strike_price: asNumber(value.strike_price),
    expiration_date: asDateOnly(value.expiration_date),
    dte_at_entry: asNumber(value.dte_at_entry),
    iv_at_entry: asNumber(value.iv_at_entry),
    delta_at_entry: asNumber(value.delta_at_entry),
    theta_at_entry: asNumber(value.theta_at_entry),
    gamma_at_entry: asNumber(value.gamma_at_entry),
    vega_at_entry: asNumber(value.vega_at_entry),
    underlying_at_entry: asNumber(value.underlying_at_entry),
    underlying_at_exit: asNumber(value.underlying_at_exit),

    mood_before: asMood(value.mood_before),
    mood_after: asMood(value.mood_after),
    discipline_score: asNumber(value.discipline_score),
    followed_plan: asBoolean(value.followed_plan),
    deviation_notes: asString(value.deviation_notes, textFieldMaxLengths.deviation_notes),

    strategy: asString(value.strategy, textFieldMaxLengths.strategy),
    setup_notes: asString(value.setup_notes, textFieldMaxLengths.setup_notes),
    execution_notes: asString(value.execution_notes, textFieldMaxLengths.execution_notes),
    lessons_learned: asString(value.lessons_learned, textFieldMaxLengths.lessons_learned),
    tags: asTags(value.tags),
    rating: asNumber(value.rating),

    screenshot_url: asString(value.screenshot_url, textFieldMaxLengths.screenshot_url),
    screenshot_storage_path: asString(value.screenshot_storage_path, textFieldMaxLengths.screenshot_storage_path),

    ai_analysis: asAIAnalysis(value.ai_analysis),

    market_context: asMarketContext(value.market_context),

    import_id: asString(value.import_id, textFieldMaxLengths.import_id),

    is_favorite: asBoolean(value.is_favorite) ?? false,

    created_at: asDateTime(value.created_at) ?? nowIso,
    updated_at: asDateTime(value.updated_at) ?? nowIso,
  }
}

export function sanitizeJournalEntries(raw: unknown): JournalEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry, index) => sanitizeJournalEntry(entry, `entry-${index + 1}`))
}
