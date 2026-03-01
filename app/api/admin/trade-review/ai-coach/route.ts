import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { isAdminUser } from '@/lib/supabase-server'
import type { CoachMarketDataSnapshot, CoachResponsePayload } from '@/lib/types/coach-review'
import { coachAIGenerateSchema, coachResponsePayloadSchema } from '@/lib/validation/coach-review'
import { getCurrentAdminUserId, getSupabaseAdmin } from '@/app/api/admin/trade-review/_shared'

interface MassiveAggregate {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
  vw?: number
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  usage?: {
    total_tokens?: number
  }
}

interface CoachEntryRow {
  id: string
  user_id: string
  symbol: string
  direction: 'long' | 'short'
  contract_type: 'stock' | 'call' | 'put'
  trade_date: string
  entry_price: number | null
  exit_price: number | null
  position_size: number | null
  pnl: number | null
  pnl_percentage: number | null
  stop_loss: number | null
  initial_target: number | null
  hold_duration_min: number | null
  entry_timestamp: string | null
  exit_timestamp: string | null
  strategy: string | null
  setup_type: string | null
  followed_plan: boolean | null
  discipline_score: number | null
  mood_before: string | null
  mood_after: string | null
  setup_notes: string | null
  execution_notes: string | null
  lessons_learned: string | null
  rating: number | null
  strike_price: number | null
  expiration_date: string | null
  dte_at_entry: number | null
  iv_at_entry: number | null
  delta_at_entry: number | null
  theta_at_entry: number | null
  gamma_at_entry: number | null
  vega_at_entry: number | null
}

interface HistoryRow {
  symbol: string
  pnl: number | null
  discipline_score: number | null
  followed_plan: boolean | null
  stop_loss: number | null
  trade_date: string
}

interface ReviewRequestRow {
  id: string
  status: 'pending' | 'in_review' | 'completed' | 'dismissed'
  assigned_to: string | null
}

interface ExistingNoteRow {
  id: string
  review_request_id: string | null
}

const OPENAI_MODEL = 'gpt-4o'
const OPENAI_TEMPERATURE = 0.3
const OPENAI_MAX_TOKENS = 2400
const MASSIVE_BASE_URL = 'https://api.massive.com'
const EPSILON = 0.000001

function toDateKey(input: string | null | undefined): string {
  if (!input) return new Date().toISOString().slice(0, 10)
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

function toIso(input: string | null | undefined): string | null {
  if (!input) return null
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function daysBefore(dateKey: string, days: number): string {
  const base = new Date(`${dateKey}T00:00:00.000Z`)
  if (Number.isNaN(base.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  base.setUTCDate(base.getUTCDate() - days)
  return base.toISOString().slice(0, 10)
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asBars(input: unknown): MassiveAggregate[] {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => {
      if (typeof row !== 'object' || row === null) return null
      const bar = row as Record<string, unknown>
      const t = asNumber(bar.t)
      const o = asNumber(bar.o)
      const h = asNumber(bar.h)
      const l = asNumber(bar.l)
      const c = asNumber(bar.c)
      const v = asNumber(bar.v)
      const vw = asNumber(bar.vw)
      if (t == null || o == null || h == null || l == null || c == null || v == null) return null
      return {
        t,
        o,
        h,
        l,
        c,
        v,
        ...(vw == null ? {} : { vw }),
      }
    })
    .filter((bar): bar is MassiveAggregate => Boolean(bar))
}

function normalizeTicker(symbol: string): string {
  const upper = symbol.trim().toUpperCase()
  if (upper.startsWith('I:')) return upper
  if (['SPX', 'VIX', 'NDX', 'RUT', 'DXY', 'TNX', 'DJI'].includes(upper)) {
    return `I:${upper}`
  }
  return upper
}

function normalizeUnderlying(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/^I:/, '')
}

async function massiveFetch(path: string, params: Record<string, string | number | boolean | undefined>) {
  const apiKey = process.env.MASSIVE_API_KEY
  if (!apiKey) {
    throw new Error('MASSIVE_API_KEY is not configured')
  }

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }
  query.set('apiKey', apiKey)

  const response = await fetch(`${MASSIVE_BASE_URL}${path}?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    const payload = await response.text().catch(() => '')
    throw new Error(`Massive request failed (${response.status}) ${path}: ${payload.slice(0, 300)}`)
  }

  return response.json() as Promise<{ results?: unknown }>
}

async function fetchMinuteBars(symbol: string, tradeDate: string): Promise<MassiveAggregate[]> {
  const ticker = normalizeTicker(symbol)
  const payload = await massiveFetch(
    `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/minute/${tradeDate}/${tradeDate}`,
    { adjusted: 'true', sort: 'asc', limit: 50000 },
  )
  return asBars(payload.results)
}

async function fetchDailyBars(symbol: string, from: string, to: string): Promise<MassiveAggregate[]> {
  const ticker = normalizeTicker(symbol)
  const payload = await massiveFetch(
    `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}`,
    { adjusted: 'true', sort: 'asc', limit: 50000 },
  )
  return asBars(payload.results)
}

async function fetchIndexClose(symbol: 'I:SPX' | 'I:VIX', tradeDate: string): Promise<MassiveAggregate | null> {
  try {
    const payload = await massiveFetch(
      `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${tradeDate}/${tradeDate}`,
      { adjusted: 'true', sort: 'desc', limit: 1 },
    )
    const bars = asBars(payload.results)
    if (bars.length > 0) return bars[0]
  } catch {
    // fall through to /prev
  }

  try {
    const payload = await massiveFetch(`/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev`, {})
    const bars = asBars(payload.results)
    return bars[0] ?? null
  } catch {
    return null
  }
}

function toNearestBar(
  minuteBars: MassiveAggregate[],
  timestampIso: string | null,
): MassiveAggregate | null {
  if (minuteBars.length === 0 || !timestampIso) return null
  const target = Date.parse(timestampIso)
  if (Number.isNaN(target)) return null
  let nearest = minuteBars[0]
  let bestDistance = Math.abs(minuteBars[0].t - target)
  for (let index = 1; index < minuteBars.length; index += 1) {
    const distance = Math.abs(minuteBars[index].t - target)
    if (distance < bestDistance) {
      bestDistance = distance
      nearest = minuteBars[index]
    }
  }
  return nearest
}

function deriveRegime(dailyBars: MassiveAggregate[], vixLevel: number): {
  regime: 'trending' | 'ranging' | 'compression' | 'breakout'
  regimeDirection: 'bullish' | 'bearish' | 'neutral'
  gexRegime: 'positive_gamma' | 'negative_gamma' | 'near_flip'
  gexFlipPoint: number | null
} {
  if (dailyBars.length === 0) {
    return {
      regime: 'ranging',
      regimeDirection: 'neutral',
      gexRegime: 'near_flip',
      gexFlipPoint: null,
    }
  }

  const latest = dailyBars[dailyBars.length - 1]
  const start = dailyBars[Math.max(0, dailyBars.length - 20)]
  const trendMovePct = start.c !== 0 ? ((latest.c - start.c) / Math.abs(start.c)) * 100 : 0

  const trailing = dailyBars.slice(-10)
  const avgRangePct = trailing.length > 0
    ? trailing.reduce((sum, bar) => {
        const pct = bar.c !== 0 ? ((bar.h - bar.l) / Math.abs(bar.c)) * 100 : 0
        return sum + pct
      }, 0) / trailing.length
    : 0
  const latestRangePct = latest.c !== 0 ? ((latest.h - latest.l) / Math.abs(latest.c)) * 100 : 0

  let regime: 'trending' | 'ranging' | 'compression' | 'breakout' = 'ranging'
  if (Math.abs(trendMovePct) >= 3) {
    regime = 'trending'
  }
  if (avgRangePct < 1.2 && vixLevel < 18) {
    regime = 'compression'
  }
  if (latestRangePct > Math.max(avgRangePct * 1.4, 2.2)) {
    regime = 'breakout'
  }

  const regimeDirection: 'bullish' | 'bearish' | 'neutral' = trendMovePct > 1
    ? 'bullish'
    : trendMovePct < -1
      ? 'bearish'
      : 'neutral'

  const gexRegime: 'positive_gamma' | 'negative_gamma' | 'near_flip' = vixLevel <= 16
    ? 'positive_gamma'
    : vixLevel >= 22
      ? 'negative_gamma'
      : 'near_flip'

  return {
    regime,
    regimeDirection,
    gexRegime,
    gexFlipPoint: gexRegime === 'near_flip' ? round(latest.c, 2) : null,
  }
}

function deriveSessionPhase(entryTimestampIso: string | null): 'open' | 'mid_morning' | 'lunch' | 'power_hour' | 'close' {
  if (!entryTimestampIso) return 'mid_morning'
  const parsed = new Date(entryTimestampIso)
  if (Number.isNaN(parsed.getTime())) return 'mid_morning'
  const minutesUtc = parsed.getUTCHours() * 60 + parsed.getUTCMinutes()
  const nyOpenUtc = 13 * 60 + 30
  const nyCloseUtc = 20 * 60
  if (minutesUtc < nyOpenUtc + 30) return 'open'
  if (minutesUtc < nyOpenUtc + 120) return 'mid_morning'
  if (minutesUtc < nyOpenUtc + 300) return 'lunch'
  if (minutesUtc < nyCloseUtc - 30) return 'power_hour'
  return 'close'
}

function derivePriceVsVwap(entryBar: MassiveAggregate | null): 'above' | 'below' | 'at' {
  if (!entryBar || entryBar.vw == null) return 'at'
  if (entryBar.c > entryBar.vw + EPSILON) return 'above'
  if (entryBar.c < entryBar.vw - EPSILON) return 'below'
  return 'at'
}

function deriveCommonMistakes(historyRows: HistoryRow[]): string[] {
  if (historyRows.length === 0) {
    return ['Insufficient recent history for recurring mistake detection.']
  }

  const mistakes: string[] = []
  const withPlanFlag = historyRows.filter((row) => row.followed_plan != null)
  const planBreaks = withPlanFlag.filter((row) => row.followed_plan === false).length
  if (withPlanFlag.length > 0 && planBreaks / withPlanFlag.length >= 0.25) {
    mistakes.push('Frequent plan deviations on entries or exits.')
  }

  const missingStops = historyRows.filter((row) => row.stop_loss == null).length
  if (missingStops / historyRows.length >= 0.3) {
    mistakes.push('Risk-defined stops are often missing before entry.')
  }

  const lowDisciplineRows = historyRows.filter((row) => (row.discipline_score ?? 5) <= 2)
  if (lowDisciplineRows.length / historyRows.length >= 0.25) {
    mistakes.push('Discipline scores are often low during execution.')
  }

  if (mistakes.length === 0) {
    mistakes.push('No dominant recurring mistake pattern in recent sample.')
  }

  return mistakes.slice(0, 3)
}

function deriveRecentStreak(pnls: number[]): 'winning' | 'losing' | 'mixed' {
  if (pnls.length === 0) return 'mixed'
  const sample = pnls.slice(0, 4)
  if (sample.length >= 2 && sample.every((value) => value > 0)) return 'winning'
  if (sample.length >= 2 && sample.every((value) => value < 0)) return 'losing'
  return 'mixed'
}

function getPromptSystemMessage(): string {
  return `You are an expert options and equities trading coach performing a detailed review
of a student's trade. Your role is to provide actionable, specific, and encouraging
feedback that helps the trader improve their process and decision-making.

You must return a JSON object with this exact structure:
{
  "what_went_well": string[],
  "areas_to_improve": [
    { "point": string, "instruction": string }
  ],
  "specific_drills": [
    { "title": string, "description": string }
  ],
  "overall_assessment": string,
  "grade": "A"|"B"|"C"|"D"|"F",
  "grade_reasoning": string,
  "confidence": "high"|"medium"|"low"
}

Grading rubric:
- A: Excellent process AND outcome. Trade plan followed. Risk managed. Entry/exit disciplined.
- B: Good process with minor execution gaps. Plan mostly followed. Positive risk management.
- C: Average execution. Some plan deviation OR missing risk framework. Mixed signals.
- D: Poor process. Significant plan deviation, poor risk management, or emotional trading.
- F: Reckless. No plan, no stops, position sizing violation, or revenge trading.

Factor in: plan adherence, risk management quality, entry/exit timing relative to levels,
position sizing appropriateness, emotional discipline, and pattern recognition from history.

For "instruction" fields, be specific: reference exact price levels, timeframes, and actions.
If coach notes are provided, incorporate them.
Always be encouraging where warranted and acknowledge good habits even in losing trades.`
}

async function callOpenAICoach(promptPayload: Record<string, unknown>): Promise<{
  draft: CoachResponsePayload
  tokensUsed: number
}> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: OPENAI_TEMPERATURE,
      max_tokens: OPENAI_MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: getPromptSystemMessage() },
        { role: 'user', content: JSON.stringify(promptPayload) },
      ],
    }),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`OpenAI request failed (${response.status}): ${details.slice(0, 300)}`)
  }

  const payload = await response.json() as OpenAIChatCompletionResponse
  const content = payload.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('OpenAI returned an empty response payload')
  }

  const parsed = coachResponsePayloadSchema.safeParse(JSON.parse(content) as unknown)
  if (!parsed.success) {
    throw new Error('OpenAI response did not satisfy coach response schema')
  }

  return {
    draft: parsed.data,
    tokensUsed: payload.usage?.total_tokens ?? 0,
  }
}

async function fetchOptionSnapshot(
  entry: CoachEntryRow,
  tradeDate: string,
): Promise<CoachMarketDataSnapshot['options'] | undefined> {
  if (entry.contract_type === 'stock') return undefined

  const underlying = normalizeUnderlying(entry.symbol)
  const strike = entry.strike_price
  const expirationDate = entry.expiration_date
  const contractType = entry.contract_type
  if (!strike || !expirationDate) return undefined

  try {
    const payload = await massiveFetch(
      `/v3/snapshot/options/${encodeURIComponent(underlying)}`,
      {
        as_of: tradeDate,
        contract_type: contractType,
        expiration_date: expirationDate,
        strike_price: strike,
        limit: 10,
      },
    )

    const snapshots = Array.isArray(payload.results) ? payload.results : []
    const row = snapshots[0] as Record<string, unknown> | undefined
    if (!row) return undefined

    const details = (row.details as Record<string, unknown> | undefined) ?? {}
    const greeks = (row.greeks as Record<string, unknown> | undefined) ?? {}
    const quote = (row.last_quote as Record<string, unknown> | undefined) ?? {}
    const day = (row.day as Record<string, unknown> | undefined) ?? {}

    const bid = asNumber(quote.bid)
    const ask = asNumber(quote.ask)
    const openInterest = asNumber(day.open_interest) ?? asNumber(details.open_interest)

    return {
      contractTicker: String(details.ticker ?? ''),
      strikePrice: asNumber(details.strike_price) ?? strike,
      expirationDate: String(details.expiration_date ?? expirationDate),
      contractType,
      greeksAtEntry: {
        delta: asNumber(greeks.delta) ?? entry.delta_at_entry ?? 0,
        gamma: asNumber(greeks.gamma) ?? entry.gamma_at_entry ?? 0,
        theta: asNumber(greeks.theta) ?? entry.theta_at_entry ?? 0,
        vega: asNumber(greeks.vega) ?? entry.vega_at_entry ?? 0,
      },
      ivAtEntry: asNumber(row.implied_volatility) ?? entry.iv_at_entry ?? 0,
      openInterest,
      bidAskSpread: bid != null && ask != null ? { bid, ask } : null,
    }
  } catch (error) {
    console.warn('[TradeReview][AICoach] Option snapshot unavailable:', error)
    return undefined
  }
}

async function fetchMarketSnapshot(entry: CoachEntryRow): Promise<CoachMarketDataSnapshot> {
  const tradeDate = toDateKey(entry.trade_date)
  const from30 = daysBefore(tradeDate, 30)
  const entryTimestampIso = toIso(entry.entry_timestamp)
  const exitTimestampIso = toIso(entry.exit_timestamp)

  const [minuteBars, dailyBars, spxBar, vixBar, optionSnapshot] = await Promise.all([
    fetchMinuteBars(entry.symbol, tradeDate).catch(() => []),
    fetchDailyBars(entry.symbol, from30, tradeDate).catch(() => []),
    fetchIndexClose('I:SPX', tradeDate),
    fetchIndexClose('I:VIX', tradeDate),
    fetchOptionSnapshot(entry, tradeDate),
  ])

  const sortedMinuteBars = minuteBars.slice().sort((a, b) => a.t - b.t)
  const sortedDailyBars = dailyBars.slice().sort((a, b) => a.t - b.t)

  const entryBar = toNearestBar(sortedMinuteBars, entryTimestampIso)
  const exitBar = toNearestBar(sortedMinuteBars, exitTimestampIso)
  const latestDaily = sortedDailyBars[sortedDailyBars.length - 1] ?? null

  const spxPrice = spxBar?.c ?? 0
  const spxChange = spxBar?.o ? round(((spxBar.c - spxBar.o) / Math.abs(spxBar.o)) * 100, 3) : 0
  const vixLevel = vixBar?.c ?? 0
  const regime = deriveRegime(sortedDailyBars, vixLevel)

  const avgDailyVolume = sortedDailyBars.length > 0
    ? sortedDailyBars
      .slice(-20)
      .reduce((sum, bar) => sum + bar.v, 0) / Math.min(sortedDailyBars.length, 20)
    : 0
  const baselineMinuteVolume = avgDailyVolume > 0 ? avgDailyVolume / 390 : 0
  const tradeTimeVolume = entryBar?.v ?? sortedMinuteBars[0]?.v ?? 0
  const relativeVolume = baselineMinuteVolume > 0 ? round(tradeTimeVolume / baselineMinuteVolume, 3) : 0

  const hasCoreData = sortedMinuteBars.length > 0 && sortedDailyBars.length > 0 && spxBar != null && vixBar != null
  const requiresOptionsData = entry.contract_type !== 'stock'
  const hasOptionsData = optionSnapshot != null
  const dataQuality: CoachMarketDataSnapshot['dataQuality'] = hasCoreData
    ? (requiresOptionsData && !hasOptionsData ? 'partial' : 'full')
    : sortedMinuteBars.length > 0 || sortedDailyBars.length > 0
      ? 'partial'
      : 'stale'

  return {
    chart: {
      symbol: entry.symbol,
      date: tradeDate,
      minuteBars: sortedMinuteBars,
      dailyBars: sortedDailyBars,
      ...(entryTimestampIso && entry.entry_price != null
        ? {
            entryMarker: {
              timestamp: Date.parse(entryTimestampIso),
              price: entry.entry_price,
            },
          }
        : {}),
      ...(exitTimestampIso && entry.exit_price != null
        ? {
            exitMarker: {
              timestamp: Date.parse(exitTimestampIso),
              price: entry.exit_price,
            },
          }
        : {}),
    },
    ...(optionSnapshot ? { options: optionSnapshot } : {}),
    spxContext: {
      spxPrice: round(spxPrice, 2),
      spxChange,
      vixLevel: round(vixLevel, 2),
      regime: regime.regime,
      regimeDirection: regime.regimeDirection,
      gexRegime: regime.gexRegime,
      gexFlipPoint: regime.gexFlipPoint,
    },
    volumeContext: {
      tradeTimeVolume: round(tradeTimeVolume, 2),
      avgVolume: round(avgDailyVolume, 2),
      relativeVolume: round(relativeVolume, 3),
      vwapAtEntry: entryBar?.vw ?? null,
      vwapAtExit: exitBar?.vw ?? null,
    },
    fetchedAt: new Date().toISOString(),
    dataQuality,
  }
}

function buildPromptPayload(input: {
  entry: CoachEntryRow
  snapshot: CoachMarketDataSnapshot
  historyRows: HistoryRow[]
  coachNotes: string | undefined
}): Record<string, unknown> {
  const { entry, snapshot, historyRows, coachNotes } = input

  const resolvedPnls = historyRows
    .map((row) => row.pnl)
    .filter((value): value is number => value != null)
  const wins = resolvedPnls.filter((value) => value > 0).length
  const symbolRows = historyRows.filter((row) => row.symbol.toUpperCase() === entry.symbol.toUpperCase())
  const symbolPnls = symbolRows.map((row) => row.pnl).filter((value): value is number => value != null)
  const symbolWins = symbolPnls.filter((value) => value > 0).length
  const disciplineRows = historyRows.map((row) => row.discipline_score).filter((value): value is number => value != null)

  const entryTimestampIso = toIso(entry.entry_timestamp)
  const entryBar = toNearestBar(snapshot.chart.minuteBars, entryTimestampIso)
  const latestDay = snapshot.chart.dailyBars[snapshot.chart.dailyBars.length - 1] ?? null

  const pdh = snapshot.chart.dailyBars.length > 1
    ? snapshot.chart.dailyBars[snapshot.chart.dailyBars.length - 2].h
    : null
  const pdl = snapshot.chart.dailyBars.length > 1
    ? snapshot.chart.dailyBars[snapshot.chart.dailyBars.length - 2].l
    : null

  const distanceFromPdhPct = pdh && entry.entry_price
    ? ((entry.entry_price - pdh) / pdh) * 100
    : 0
  const distanceFromPdlPct = pdl && entry.entry_price
    ? ((entry.entry_price - pdl) / pdl) * 100
    : 0

  return {
    trade: {
      symbol: entry.symbol,
      direction: entry.direction,
      contract_type: entry.contract_type,
      trade_date: entry.trade_date,
      entry_price: entry.entry_price,
      exit_price: entry.exit_price,
      position_size: entry.position_size,
      pnl: entry.pnl,
      pnl_percentage: entry.pnl_percentage,
      stop_loss: entry.stop_loss,
      initial_target: entry.initial_target,
      hold_duration_min: entry.hold_duration_min,
      entry_timestamp: entry.entry_timestamp,
      exit_timestamp: entry.exit_timestamp,
      strategy: entry.strategy,
      setup_type: entry.setup_type,
      followed_plan: entry.followed_plan,
      discipline_score: entry.discipline_score,
      mood_before: entry.mood_before,
      mood_after: entry.mood_after,
      setup_notes: entry.setup_notes,
      execution_notes: entry.execution_notes,
      lessons_learned: entry.lessons_learned,
      rating: entry.rating,
      options_data: {
        strike_price: entry.strike_price,
        expiration_date: entry.expiration_date,
        dte_at_entry: entry.dte_at_entry,
        iv_at_entry: entry.iv_at_entry,
        delta_at_entry: entry.delta_at_entry,
        theta_at_entry: entry.theta_at_entry,
        gamma_at_entry: entry.gamma_at_entry,
        vega_at_entry: entry.vega_at_entry,
      },
    },
    market_context: {
      spx_price_at_trade: snapshot.spxContext.spxPrice,
      vix_level: snapshot.spxContext.vixLevel,
      market_regime: snapshot.spxContext.regime,
      regime_direction: snapshot.spxContext.regimeDirection,
      gex_regime: snapshot.spxContext.gexRegime,
      price_vs_vwap: derivePriceVsVwap(entryBar),
      distance_from_pdh_pct: round(distanceFromPdhPct, 4),
      distance_from_pdl_pct: round(distanceFromPdlPct, 4),
      relative_volume: snapshot.volumeContext.relativeVolume,
      session_phase: deriveSessionPhase(entryTimestampIso),
      latest_daily_close: latestDay?.c ?? null,
    },
    member_history: {
      total_trades: historyRows.length,
      win_rate: resolvedPnls.length > 0 ? round((wins / resolvedPnls.length) * 100, 2) : null,
      symbol_win_rate: symbolPnls.length > 0 ? round((symbolWins / symbolPnls.length) * 100, 2) : null,
      symbol_avg_pnl: symbolPnls.length > 0
        ? round(symbolPnls.reduce((sum, value) => sum + value, 0) / symbolPnls.length, 2)
        : null,
      symbol_trade_count: symbolRows.length,
      recent_streak: deriveRecentStreak(resolvedPnls),
      avg_discipline_score: disciplineRows.length > 0
        ? round(disciplineRows.reduce((sum, value) => sum + value, 0) / disciplineRows.length, 2)
        : null,
      common_mistakes: deriveCommonMistakes(historyRows),
    },
    coach_notes: coachNotes ?? '',
  }
}

export async function POST(request: NextRequest) {
  if (!await isAdminUser()) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const parsedBody = coachAIGenerateSchema.parse(await request.json())
    const supabase = getSupabaseAdmin()
    const actorId = await getCurrentAdminUserId()
    if (!actorId) {
      return errorResponse('Unauthorized', 401)
    }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .select(`
        id,user_id,symbol,direction,contract_type,trade_date,entry_price,exit_price,
        position_size,pnl,pnl_percentage,stop_loss,initial_target,hold_duration_min,
        entry_timestamp,exit_timestamp,strategy,setup_type,followed_plan,discipline_score,
        mood_before,mood_after,setup_notes,execution_notes,lessons_learned,rating,
        strike_price,expiration_date,dte_at_entry,iv_at_entry,delta_at_entry,theta_at_entry,gamma_at_entry,vega_at_entry
      `)
      .eq('id', parsedBody.journal_entry_id)
      .maybeSingle()

    if (entryError) {
      console.error('[TradeReview][AICoach] Failed to load journal entry:', entryError.message)
      return errorResponse('Failed to load trade entry', 500)
    }
    if (!entry) {
      return errorResponse('Trade entry not found', 404)
    }

    const typedEntry = entry as unknown as CoachEntryRow

    const [historyResult, latestRequestResult, existingNoteResult] = await Promise.all([
      supabase
        .from('journal_entries')
        .select('symbol,pnl,discipline_score,followed_plan,stop_loss,trade_date')
        .eq('user_id', typedEntry.user_id)
        .order('trade_date', { ascending: false })
        .limit(120),
      supabase
        .from('coach_review_requests')
        .select('id,status,assigned_to')
        .eq('journal_entry_id', typedEntry.id)
        .in('status', ['pending', 'in_review', 'completed', 'dismissed'])
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('coach_trade_notes')
        .select('id,review_request_id')
        .eq('journal_entry_id', typedEntry.id)
        .maybeSingle(),
    ])

    const historyRows = (historyResult.data ?? []) as HistoryRow[]
    const latestRequest = (latestRequestResult.data ?? null) as ReviewRequestRow | null
    const existingNote = (existingNoteResult.data ?? null) as ExistingNoteRow | null

    if (
      latestRequest?.status === 'in_review'
      && latestRequest.assigned_to
      && latestRequest.assigned_to !== actorId
    ) {
      return errorResponse('This review is already claimed by another coach.', 409)
    }

    const nowIso = new Date().toISOString()
    let resolvedRequestId = latestRequest?.id ?? existingNote?.review_request_id ?? null
    let claimedNow = false

    if (latestRequest?.status === 'pending') {
      const { data: claimedRow, error: claimError } = await supabase
        .from('coach_review_requests')
        .update({
          status: 'in_review',
          assigned_to: actorId,
          claimed_at: nowIso,
        })
        .eq('id', latestRequest.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (claimError) {
        console.error('[TradeReview][AICoach] Failed to claim review request:', claimError.message)
      }

      claimedNow = Boolean(claimedRow?.id)
      if (!claimedNow) {
        const { data: freshRequest } = await supabase
          .from('coach_review_requests')
          .select('status,assigned_to')
          .eq('id', latestRequest.id)
          .maybeSingle()

        if (
          freshRequest?.status === 'in_review'
          && freshRequest.assigned_to
          && freshRequest.assigned_to !== actorId
        ) {
          return errorResponse('This review was just claimed by another coach.', 409)
        }
      }
    }

    const snapshot = await fetchMarketSnapshot(typedEntry)
    const promptPayload = buildPromptPayload({
      entry: typedEntry,
      snapshot,
      historyRows,
      coachNotes: parsedBody.coach_preliminary_notes,
    })

    let aiResult: { draft: CoachResponsePayload; tokensUsed: number }
    try {
      aiResult = await callOpenAICoach(promptPayload)
    } catch (openAiError) {
      console.error('[TradeReview][AICoach] OpenAI unavailable:', openAiError)
      return errorResponse('AI coach generation service is currently unavailable', 503)
    }

    if (resolvedRequestId) {
      const { data: markInReviewRow, error: markInReviewError } = await supabase
        .from('coach_review_requests')
        .update({
          status: 'in_review',
          assigned_to: actorId,
          claimed_at: nowIso,
        })
        .eq('id', resolvedRequestId)
        .in('status', ['pending', 'in_review'])
        .or(`assigned_to.is.null,assigned_to.eq.${actorId}`)
        .select('id')
        .maybeSingle()
      if (markInReviewError) {
        console.error('[TradeReview][AICoach] Failed to mark request in_review:', markInReviewError.message)
      } else if (!markInReviewRow) {
        const { data: currentRequest } = await supabase
          .from('coach_review_requests')
          .select('status,assigned_to')
          .eq('id', resolvedRequestId)
          .maybeSingle()

        if (
          currentRequest?.status === 'in_review'
          && currentRequest.assigned_to
          && currentRequest.assigned_to !== actorId
        ) {
          return errorResponse('This review is currently claimed by another coach.', 409)
        }
      }
    }

    const { error: journalStatusError } = await supabase
      .from('journal_entries')
      .update({
        coach_review_status: 'in_review',
      })
      .eq('id', typedEntry.id)
      .in('coach_review_status', ['pending', 'in_review'])

    if (journalStatusError) {
      console.error('[TradeReview][AICoach] Failed to update journal coach status:', journalStatusError.message)
    }

    if (existingNote) {
      const { error: updateError } = await supabase
        .from('coach_trade_notes')
        .update({
          review_request_id: existingNote.review_request_id ?? resolvedRequestId,
          coach_user_id: actorId,
          ai_draft: aiResult.draft,
          market_data_snapshot: snapshot,
        })
        .eq('id', existingNote.id)
      if (updateError) {
        console.error('[TradeReview][AICoach] Failed to update coach note:', updateError.message)
        return errorResponse('Failed to persist AI draft', 500)
      }
    } else {
      const { error: insertError } = await supabase
        .from('coach_trade_notes')
        .insert({
          journal_entry_id: typedEntry.id,
          review_request_id: resolvedRequestId,
          coach_user_id: actorId,
          ai_draft: aiResult.draft,
          market_data_snapshot: snapshot,
          is_published: false,
        })
      if (insertError) {
        console.error('[TradeReview][AICoach] Failed to insert coach note:', insertError.message)
        return errorResponse('Failed to persist AI draft', 500)
      }
    }

    const logsToInsert: Array<{
      review_request_id: string | null
      journal_entry_id: string
      actor_id: string
      action: 'claimed' | 'ai_generated'
      details: Record<string, unknown>
    }> = []

    if (claimedNow) {
      logsToInsert.push({
        review_request_id: resolvedRequestId,
        journal_entry_id: typedEntry.id,
        actor_id: actorId,
        action: 'claimed',
        details: {
          claimed_at: nowIso,
        },
      })
    }

    logsToInsert.push({
      review_request_id: resolvedRequestId,
      journal_entry_id: typedEntry.id,
      actor_id: actorId,
      action: 'ai_generated',
      details: {
        model: OPENAI_MODEL,
        temperature: OPENAI_TEMPERATURE,
        tokens_used: aiResult.tokensUsed,
        data_quality: snapshot.dataQuality,
        generated_at: nowIso,
      },
    })

    const { error: logError } = await supabase
      .from('coach_review_activity_log')
      .insert(logsToInsert)
    if (logError) {
      console.error('[TradeReview][AICoach] Failed to write activity log:', logError.message)
    }

    return successResponse({
      draft: aiResult.draft,
      market_data_snapshot: snapshot,
      tokens_used: aiResult.tokensUsed,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }

    console.error('[TradeReview][AICoach] Route failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
