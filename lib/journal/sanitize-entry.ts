import type {
  AITradeAnalysis,
  JournalEntry,
  MarketContextSnapshot,
  TradeVerification,
} from '@/lib/types/journal'

const VALID_DIRECTIONS = new Set(['long', 'short', 'neutral'])
const VALID_CONTRACT_TYPES = new Set(['stock', 'call', 'put', 'spread'])
const VALID_MOODS = new Set(['confident', 'neutral', 'anxious', 'frustrated', 'excited', 'fearful'])
const VALID_DRAFT_STATUSES = new Set(['pending', 'confirmed', 'dismissed'])
const VALID_SYNC_STATUSES = new Set(['synced', 'pending_offline'])
const VALID_MARKET_TRENDS = new Set(['bullish', 'bearish', 'neutral'])
const VALID_SESSION_TYPES = new Set(['trending', 'range-bound', 'volatile'])
const VALID_VERIFICATION_CONFIDENCE = new Set(['exact', 'close', 'unverifiable'])

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeUpperString(value: unknown): string | null {
  const normalized = normalizeString(value)
  return normalized ? normalized.toUpperCase() : null
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeInteger(value: unknown): number | null {
  const parsed = normalizeNumber(value)
  if (parsed == null) return null
  return Number.isInteger(parsed) ? parsed : Math.round(parsed)
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return null
}

function normalizeIsoString(value: unknown, fallback: string): string {
  const normalized = normalizeString(value)
  if (!normalized) return fallback
  const parsed = Date.parse(normalized)
  if (Number.isNaN(parsed)) return fallback
  return new Date(parsed).toISOString()
}

function normalizeOptionalIsoString(value: unknown): string | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  const parsed = Date.parse(normalized)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString()
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => normalizeString(entry))
    .filter((entry): entry is string => Boolean(entry))
}

function normalizeDirection(value: unknown): 'long' | 'short' | 'neutral' | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return VALID_DIRECTIONS.has(normalized) ? (normalized as 'long' | 'short' | 'neutral') : null
}

function normalizeContractType(value: unknown): 'stock' | 'call' | 'put' | 'spread' | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return VALID_CONTRACT_TYPES.has(normalized) ? (normalized as 'stock' | 'call' | 'put' | 'spread') : null
}

function normalizeMood(value: unknown): JournalEntry['mood_before'] {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!VALID_MOODS.has(normalized)) return null
  return normalized as JournalEntry['mood_before']
}

function normalizeDraftStatus(value: unknown): JournalEntry['draft_status'] {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!VALID_DRAFT_STATUSES.has(normalized)) return null
  return normalized as JournalEntry['draft_status']
}

function normalizeGrade(value: unknown): string | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  const compact = normalized.toUpperCase()
  if (/^[ABCDF][+-]?$/.test(compact)) return compact
  return compact.slice(0, 6)
}

function normalizeTradeVerification(value: unknown, fallbackIso: string): TradeVerification | null {
  if (!isRecord(value)) return null

  const confidenceRaw = normalizeString(value.confidence)?.toLowerCase() || ''
  const confidence = VALID_VERIFICATION_CONFIDENCE.has(confidenceRaw)
    ? (confidenceRaw as TradeVerification['confidence'])
    : 'unverifiable'

  return {
    isVerified: normalizeBoolean(value.isVerified) ?? false,
    confidence,
    entryPriceMatch: normalizeBoolean(value.entryPriceMatch) ?? false,
    exitPriceMatch: normalizeBoolean(value.exitPriceMatch) ?? false,
    priceSource: normalizeString(value.priceSource) || 'unknown',
    verifiedAt: normalizeIsoString(value.verifiedAt, fallbackIso),
  }
}

function normalizeContextPoint(value: unknown, fallbackIso: string): MarketContextSnapshot['entryContext'] | null {
  if (!isRecord(value)) return null
  const nearestLevelRaw = isRecord(value.nearestLevel) ? value.nearestLevel : {}

  return {
    timestamp: normalizeIsoString(value.timestamp, fallbackIso),
    price: normalizeNumber(value.price) ?? 0,
    vwap: normalizeNumber(value.vwap) ?? 0,
    atr14: normalizeNumber(value.atr14) ?? 0,
    volumeVsAvg: normalizeNumber(value.volumeVsAvg) ?? 0,
    distanceFromPDH: normalizeNumber(value.distanceFromPDH) ?? 0,
    distanceFromPDL: normalizeNumber(value.distanceFromPDL) ?? 0,
    nearestLevel: {
      name: normalizeString(nearestLevelRaw.name) || 'N/A',
      price: normalizeNumber(nearestLevelRaw.price) ?? 0,
      distance: normalizeNumber(nearestLevelRaw.distance) ?? 0,
    },
  }
}

function normalizeMarketContext(value: unknown, fallbackIso: string): MarketContextSnapshot | null {
  if (!isRecord(value)) return null

  const entryContext = normalizeContextPoint(value.entryContext, fallbackIso)
  const exitContext = normalizeContextPoint(value.exitContext, fallbackIso)
  const dayContextRaw = isRecord(value.dayContext) ? value.dayContext : null
  const keyLevelsRaw = dayContextRaw && isRecord(dayContextRaw.keyLevelsActive)
    ? dayContextRaw.keyLevelsActive
    : {}

  if (!entryContext || !exitContext || !dayContextRaw) return null

  const marketTrendRaw = normalizeString(dayContextRaw.marketTrend)?.toLowerCase() || ''
  const sessionTypeRaw = normalizeString(dayContextRaw.sessionType)?.toLowerCase() || ''

  const optionsContextRaw = isRecord(value.optionsContext) ? value.optionsContext : null
  const optionsContext = optionsContextRaw
    ? {
        ivAtEntry: normalizeNumber(optionsContextRaw.ivAtEntry) ?? 0,
        ivAtExit: normalizeNumber(optionsContextRaw.ivAtExit) ?? 0,
        ivRankAtEntry: normalizeNumber(optionsContextRaw.ivRankAtEntry) ?? 0,
        deltaAtEntry: normalizeNumber(optionsContextRaw.deltaAtEntry) ?? 0,
        thetaAtEntry: normalizeNumber(optionsContextRaw.thetaAtEntry) ?? 0,
        dteAtEntry: normalizeNumber(optionsContextRaw.dteAtEntry) ?? 0,
        dteAtExit: normalizeNumber(optionsContextRaw.dteAtExit) ?? 0,
      }
    : undefined

  return {
    entryContext,
    exitContext,
    optionsContext,
    dayContext: {
      marketTrend: VALID_MARKET_TRENDS.has(marketTrendRaw)
        ? (marketTrendRaw as 'bullish' | 'bearish' | 'neutral')
        : 'neutral',
      atrUsed: normalizeNumber(dayContextRaw.atrUsed) ?? 0,
      sessionType: VALID_SESSION_TYPES.has(sessionTypeRaw)
        ? (sessionTypeRaw as 'trending' | 'range-bound' | 'volatile')
        : 'range-bound',
      keyLevelsActive: {
        pdh: normalizeNumber(keyLevelsRaw.pdh) ?? 0,
        pdl: normalizeNumber(keyLevelsRaw.pdl) ?? 0,
        pdc: normalizeNumber(keyLevelsRaw.pdc) ?? 0,
        vwap: normalizeNumber(keyLevelsRaw.vwap) ?? 0,
        atr14: normalizeNumber(keyLevelsRaw.atr14) ?? 0,
        pivotPP: normalizeNumber(keyLevelsRaw.pivotPP) ?? 0,
        pivotR1: normalizeNumber(keyLevelsRaw.pivotR1) ?? 0,
        pivotS1: normalizeNumber(keyLevelsRaw.pivotS1) ?? 0,
      },
    },
  }
}

function normalizeAiAnalysis(value: unknown): AITradeAnalysis | null {
  if (!isRecord(value)) return null

  const summary = normalizeString(value.summary) || normalizeString(value.analysis_summary)
  const grade = normalizeGrade(value.grade)

  const trendRaw = isRecord(value.trend_analysis) ? value.trend_analysis : null
  const trendAnalysis = trendRaw
    ? {
        direction: normalizeString(trendRaw.direction) || 'unknown',
        strength: normalizeString(trendRaw.strength) || 'unknown',
        notes: normalizeString(trendRaw.notes) || '',
      }
    : undefined

  const entryRaw = isRecord(value.entry_analysis) ? value.entry_analysis : null
  const entryAnalysis = entryRaw
    ? {
        quality: normalizeString(entryRaw.quality) || 'unknown',
        observations: normalizeStringArray(entryRaw.observations),
        improvements: normalizeStringArray(entryRaw.improvements),
      }
    : undefined

  const exitRaw = isRecord(value.exit_analysis) ? value.exit_analysis : null
  const exitAnalysis = exitRaw
    ? {
        quality: normalizeString(exitRaw.quality) || 'unknown',
        observations: normalizeStringArray(exitRaw.observations),
        improvements: normalizeStringArray(exitRaw.improvements),
      }
    : undefined

  const riskRaw = isRecord(value.risk_management) ? value.risk_management : null
  const riskManagement = riskRaw
    ? {
        score: normalizeNumber(riskRaw.score) ?? 0,
        observations: normalizeStringArray(riskRaw.observations),
        suggestions: normalizeStringArray(riskRaw.suggestions),
      }
    : undefined

  const hasStructuredData = Boolean(
    trendAnalysis
    || entryAnalysis
    || exitAnalysis
    || riskManagement
    || normalizeString(value.coaching_notes)
    || normalizeStringArray(value.tags).length > 0,
  )

  if (!summary && !grade && !hasStructuredData) return null

  return {
    summary: summary || 'AI analysis available.',
    grade: grade || 'B',
    trend_analysis: trendAnalysis,
    entry_analysis: entryAnalysis,
    exit_analysis: exitAnalysis,
    risk_management: riskManagement,
    coaching_notes: normalizeString(value.coaching_notes) || undefined,
    tags: normalizeStringArray(value.tags),
    analyzed_at: normalizeOptionalIsoString(value.analyzed_at) || undefined,
    model: normalizeString(value.model) || undefined,
  }
}

function normalizeSyncStatus(value: unknown): JournalEntry['sync_status'] {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  if (!VALID_SYNC_STATUSES.has(normalized)) return undefined
  return normalized as JournalEntry['sync_status']
}

function normalizeRating(value: unknown): number | null {
  const parsed = normalizeNumber(value)
  if (parsed == null || parsed <= 0) return null
  return Math.max(1, Math.min(5, Math.round(parsed)))
}

export function sanitizeJournalEntry(raw: unknown, fallbackId: string): JournalEntry {
  const nowIso = new Date().toISOString()
  const value = isRecord(raw) ? raw : {}

  const id = normalizeString(value.id) || fallbackId
  const tradeDate = normalizeIsoString(value.trade_date, nowIso)

  return {
    id,
    user_id: normalizeString(value.user_id) || 'unknown',
    trade_date: tradeDate,
    symbol: normalizeUpperString(value.symbol) || 'UNKNOWN',
    direction: normalizeDirection(value.direction),
    entry_price: normalizeNumber(value.entry_price),
    exit_price: normalizeNumber(value.exit_price),
    position_size: normalizeNumber(value.position_size),
    pnl: normalizeNumber(value.pnl),
    pnl_percentage: normalizeNumber(value.pnl_percentage),
    is_winner: normalizeBoolean(value.is_winner),
    screenshot_url: normalizeString(value.screenshot_url),
    screenshot_storage_path: normalizeString(value.screenshot_storage_path),
    ai_analysis: normalizeAiAnalysis(value.ai_analysis),
    setup_notes: normalizeString(value.setup_notes),
    execution_notes: normalizeString(value.execution_notes),
    lessons_learned: normalizeString(value.lessons_learned),
    tags: normalizeStringArray(value.tags),
    smart_tags: normalizeStringArray(value.smart_tags),
    rating: normalizeRating(value.rating),
    market_context: normalizeMarketContext(value.market_context, tradeDate),
    verification: normalizeTradeVerification(value.verification, tradeDate),
    entry_timestamp: normalizeOptionalIsoString(value.entry_timestamp),
    exit_timestamp: normalizeOptionalIsoString(value.exit_timestamp),
    stop_loss: normalizeNumber(value.stop_loss),
    initial_target: normalizeNumber(value.initial_target),
    strategy: normalizeString(value.strategy),
    hold_duration_min: normalizeInteger(value.hold_duration_min),
    mfe_percent: normalizeNumber(value.mfe_percent),
    mae_percent: normalizeNumber(value.mae_percent),
    contract_type: normalizeContractType(value.contract_type),
    strike_price: normalizeNumber(value.strike_price),
    expiration_date: normalizeString(value.expiration_date),
    dte_at_entry: normalizeInteger(value.dte_at_entry),
    dte_at_exit: normalizeInteger(value.dte_at_exit),
    iv_at_entry: normalizeNumber(value.iv_at_entry),
    iv_at_exit: normalizeNumber(value.iv_at_exit),
    delta_at_entry: normalizeNumber(value.delta_at_entry),
    theta_at_entry: normalizeNumber(value.theta_at_entry),
    gamma_at_entry: normalizeNumber(value.gamma_at_entry),
    vega_at_entry: normalizeNumber(value.vega_at_entry),
    underlying_at_entry: normalizeNumber(value.underlying_at_entry),
    underlying_at_exit: normalizeNumber(value.underlying_at_exit),
    mood_before: normalizeMood(value.mood_before),
    mood_after: normalizeMood(value.mood_after),
    discipline_score: normalizeInteger(value.discipline_score),
    followed_plan: normalizeBoolean(value.followed_plan),
    deviation_notes: normalizeString(value.deviation_notes),
    session_id: normalizeString(value.session_id),
    draft_status: normalizeDraftStatus(value.draft_status),
    is_draft: normalizeBoolean(value.is_draft) ?? false,
    draft_expires_at: normalizeOptionalIsoString(value.draft_expires_at),
    is_open: normalizeBoolean(value.is_open) ?? false,
    enriched_at: normalizeOptionalIsoString(value.enriched_at),
    share_count: Math.max(0, normalizeInteger(value.share_count) ?? 0),
    is_favorite: normalizeBoolean(value.is_favorite) ?? false,
    created_at: normalizeIsoString(value.created_at, nowIso),
    updated_at: normalizeIsoString(value.updated_at, nowIso),
    sync_status: normalizeSyncStatus(value.sync_status),
    offline_queue_id: normalizeString(value.offline_queue_id),
  }
}

export function sanitizeJournalEntries(raw: unknown): JournalEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry, index) => sanitizeJournalEntry(entry, `entry-${index + 1}`))
}

