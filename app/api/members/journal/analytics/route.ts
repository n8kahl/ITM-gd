import { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { AdvancedAnalyticsResponse, JournalDirection } from '@/lib/types/journal'
import { analyticsPeriodSchema } from '@/lib/validation/journal-entry'

interface AnalyticsRow {
  id: string
  trade_date: string
  symbol: string
  direction: JournalDirection
  pnl: number | null
  hold_duration_min: number | null
  mfe_percent: number | null
  mae_percent: number | null
  entry_price: number | null
  exit_price: number | null
  stop_loss: number | null
  setup_type: string | null
  market_context: Record<string, unknown> | null
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  const value = numerator / denominator
  return Number.isFinite(value) ? value : null
}

function safeAverage(values: number[]): number | null {
  if (values.length === 0) return null
  const total = values.reduce((sum, value) => sum + value, 0)
  return safeDivide(total, values.length)
}

function sampleStdDev(values: number[]): number | null {
  if (values.length < 2) return null
  const mean = safeAverage(values)
  if (mean == null) return null

  const varianceNumerator = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0)
  const variance = safeDivide(varianceNumerator, values.length - 1)
  if (variance == null) return null

  const stdDev = Math.sqrt(variance)
  return Number.isFinite(stdDev) && stdDev > 0 ? stdDev : null
}

function getPeriodStart(period: '7d' | '30d' | '90d' | '1y' | 'all'): string {
  if (period === 'all') {
    return '1970-01-01T00:00:00.000Z'
  }

  const now = Date.now()
  const day = 24 * 60 * 60 * 1000

  switch (period) {
    case '7d':
      return new Date(now - (7 * day)).toISOString()
    case '90d':
      return new Date(now - (90 * day)).toISOString()
    case '1y':
      return new Date(now - (365 * day)).toISOString()
    case '30d':
    default:
      return new Date(now - (30 * day)).toISOString()
  }
}

function toNewYorkDate(dateIso: string): Date {
  return new Date(new Date(dateIso).toLocaleString('en-US', { timeZone: 'America/New_York' }))
}

function calculateRMultiple(row: AnalyticsRow): number | null {
  const entryPrice = toNumber(row.entry_price)
  const exitPrice = toNumber(row.exit_price)
  const stopLoss = toNumber(row.stop_loss)

  if (entryPrice == null || exitPrice == null || stopLoss == null) return null

  const risk = row.direction === 'short'
    ? stopLoss - entryPrice
    : entryPrice - stopLoss

  if (risk <= 0) return null

  const reward = row.direction === 'short'
    ? entryPrice - exitPrice
    : exitPrice - entryPrice

  return safeDivide(reward, risk)
}

function toAnalyticsRow(value: Record<string, unknown>): AnalyticsRow | null {
  if (
    typeof value.id !== 'string'
    || typeof value.trade_date !== 'string'
    || typeof value.symbol !== 'string'
    || (value.direction !== 'long' && value.direction !== 'short')
  ) {
    return null
  }

  return {
    id: value.id,
    trade_date: value.trade_date,
    symbol: value.symbol,
    direction: value.direction,
    pnl: toNumber(value.pnl),
    hold_duration_min: toNumber(value.hold_duration_min),
    mfe_percent: toNumber(value.mfe_percent),
    mae_percent: toNumber(value.mae_percent),
    entry_price: toNumber(value.entry_price),
    exit_price: toNumber(value.exit_price),
    stop_loss: toNumber(value.stop_loss),
    setup_type: typeof value.setup_type === 'string' ? value.setup_type : null,
    market_context: typeof value.market_context === 'object' && value.market_context !== null
      ? value.market_context as Record<string, unknown>
      : null,
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)

  try {
    const { searchParams } = new URL(request.url)
    const period = analyticsPeriodSchema.parse(searchParams.get('period') ?? '30d')
    const periodStart = getPeriodStart(period)

    const fullSelect = 'id,trade_date,symbol,direction,pnl,hold_duration_min,mfe_percent,mae_percent,entry_price,exit_price,stop_loss,setup_type,market_context'
    const coreSelect = 'id,trade_date,symbol,direction,pnl,hold_duration_min,mfe_percent,mae_percent,entry_price,exit_price,stop_loss,market_context'

    let query = supabase
      .from('journal_entries')
      .select(fullSelect)
      .eq('user_id', user.id)
      .order('trade_date', { ascending: true })

    if (period !== 'all') {
      query = query.gte('trade_date', periodStart)
    }

    let { data, error } = await query

    // Retry without setup_type if the column doesn't exist yet (migration pending)
    if (error && error.message?.includes('setup_type')) {
      let retryQuery = supabase
        .from('journal_entries')
        .select(coreSelect)
        .eq('user_id', user.id)
        .order('trade_date', { ascending: true })

      if (period !== 'all') {
        retryQuery = retryQuery.gte('trade_date', periodStart)
      }

      const retryResult = await retryQuery
      data = retryResult.data as typeof data
      error = retryResult.error
    }

    if (error) {
      console.error('Failed to load analytics rows:', error)
      return errorResponse('Failed to load analytics', 500)
    }

    const rows = (data ?? [])
      .map((item) => toAnalyticsRow(item as Record<string, unknown>))
      .filter((item): item is AnalyticsRow => Boolean(item))

    const closed = rows.filter((row) => row.pnl != null)
    const pnlSeries = closed.map((row) => row.pnl ?? 0)

    const winning = closed.filter((row) => (row.pnl ?? 0) > 0)
    const losing = closed.filter((row) => (row.pnl ?? 0) < 0)

    const totalTrades = closed.length
    const totalPnl = pnlSeries.reduce((sum, pnl) => sum + pnl, 0)

    const winRate = totalTrades > 0
      ? safeDivide(winning.length * 100, totalTrades)
      : null

    const avgPnl = totalTrades > 0
      ? safeDivide(totalPnl, totalTrades)
      : null

    const avgWin = safeAverage(winning.map((row) => row.pnl ?? 0))
    const avgLoss = safeAverage(losing.map((row) => row.pnl ?? 0))

    const winProb = winRate == null ? null : winRate / 100
    const lossProb = winProb == null ? null : 1 - winProb

    const expectancy = (
      winProb == null
      || lossProb == null
      || avgWin == null
      || avgLoss == null
    )
      ? null
      : ((winProb * avgWin) + (lossProb * avgLoss))

    const grossProfit = winning.reduce((sum, row) => sum + (row.pnl ?? 0), 0)
    const grossLossAbs = Math.abs(losing.reduce((sum, row) => sum + (row.pnl ?? 0), 0))
    const profitFactor = grossLossAbs === 0 ? null : safeDivide(grossProfit, grossLossAbs)

    const sharpeRatio = pnlSeries.length < 2
      ? null
      : (() => {
          const mean = safeAverage(pnlSeries)
          const stdDev = sampleStdDev(pnlSeries)
          if (mean == null || stdDev == null) return null
          return safeDivide(mean, stdDev)
        })()

    const downside = pnlSeries.filter((value) => value < 0)
    const sortinoRatio = pnlSeries.length < 2
      ? null
      : (() => {
          const mean = safeAverage(pnlSeries)
          const downsideStdDev = sampleStdDev(downside)
          if (mean == null || downsideStdDev == null) return null
          return safeDivide(mean, downsideStdDev)
        })()

    let equity = 0
    let peak = 0
    let maxDrawdown = 0
    let drawdownStart: Date | null = null
    let maxDrawdownDurationDays = 0

    const equityCurve: { date: string, equity: number, drawdown: number }[] = []

    for (const row of closed) {
      equity += row.pnl ?? 0
      peak = Math.max(peak, equity)
      const drawdown = equity - peak
      maxDrawdown = Math.min(maxDrawdown, drawdown)

      const tradeDate = new Date(row.trade_date)
      if (drawdown < 0 && drawdownStart == null) {
        drawdownStart = tradeDate
      }

      if (drawdown === 0 && drawdownStart != null) {
        const days = Math.ceil((tradeDate.getTime() - drawdownStart.getTime()) / (24 * 60 * 60 * 1000))
        maxDrawdownDurationDays = Math.max(maxDrawdownDurationDays, Math.max(0, days))
        drawdownStart = null
      }

      equityCurve.push({
        date: row.trade_date,
        equity,
        drawdown,
      })
    }

    if (drawdownStart && closed.length > 0) {
      const lastTradeDate = new Date(closed[closed.length - 1].trade_date)
      const days = Math.ceil((lastTradeDate.getTime() - drawdownStart.getTime()) / (24 * 60 * 60 * 1000))
      maxDrawdownDurationDays = Math.max(maxDrawdownDurationDays, Math.max(0, days))
    }

    const holdMinutes = closed
      .map((row) => row.hold_duration_min)
      .filter((value): value is number => value != null)

    const avgHoldMinutes = holdMinutes.length > 0
      ? safeAverage(holdMinutes)
      : null

    const hourlyMap = new Map<number, { pnl: number, count: number }>()
    const weekdayMap = new Map<number, { pnl: number, count: number }>()
    const monthMap = new Map<string, { pnl: number, count: number }>()
    const symbolMap = new Map<string, { pnl: number, count: number, wins: number }>()
    const directionMap = new Map<JournalDirection, { pnl: number, count: number, wins: number }>()

    const rDistributionMap = new Map<string, number>()
    const mfeMaeScatter: { id: string, mfe: number, mae: number, pnl: number }[] = []

    for (const row of closed) {
      const pnl = row.pnl ?? 0
      const nyDate = toNewYorkDate(row.trade_date)

      const hour = nyDate.getHours()
      const day = nyDate.getDay()
      const month = `${nyDate.getFullYear()}-${String(nyDate.getMonth() + 1).padStart(2, '0')}`

      const hourBucket = hourlyMap.get(hour) ?? { pnl: 0, count: 0 }
      hourBucket.pnl += pnl
      hourBucket.count += 1
      hourlyMap.set(hour, hourBucket)

      const dayBucket = weekdayMap.get(day) ?? { pnl: 0, count: 0 }
      dayBucket.pnl += pnl
      dayBucket.count += 1
      weekdayMap.set(day, dayBucket)

      const monthBucket = monthMap.get(month) ?? { pnl: 0, count: 0 }
      monthBucket.pnl += pnl
      monthBucket.count += 1
      monthMap.set(month, monthBucket)

      const symbolBucket = symbolMap.get(row.symbol) ?? { pnl: 0, count: 0, wins: 0 }
      symbolBucket.pnl += pnl
      symbolBucket.count += 1
      symbolBucket.wins += pnl > 0 ? 1 : 0
      symbolMap.set(row.symbol, symbolBucket)

      const directionBucket = directionMap.get(row.direction) ?? { pnl: 0, count: 0, wins: 0 }
      directionBucket.pnl += pnl
      directionBucket.count += 1
      directionBucket.wins += pnl > 0 ? 1 : 0
      directionMap.set(row.direction, directionBucket)

      const rMultiple = calculateRMultiple(row)
      if (rMultiple != null) {
        const bucket = `${Math.floor(rMultiple)}`
        rDistributionMap.set(bucket, (rDistributionMap.get(bucket) ?? 0) + 1)
      }

      if (row.mfe_percent != null && row.mae_percent != null) {
        mfeMaeScatter.push({
          id: row.id,
          mfe: row.mfe_percent,
          mae: row.mae_percent,
          pnl,
        })
      }
    }

    const hourlyPnl = Array.from(hourlyMap.entries())
      .map(([hour, aggregate]) => ({ hour, pnl: aggregate.pnl, count: aggregate.count }))
      .sort((a, b) => a.hour - b.hour)

    const dayOfWeekPnl = Array.from(weekdayMap.entries())
      .map(([day, aggregate]) => ({ day, pnl: aggregate.pnl, count: aggregate.count }))
      .sort((a, b) => a.day - b.day)

    const monthlyPnl = Array.from(monthMap.entries())
      .map(([month, aggregate]) => ({ month, pnl: aggregate.pnl, count: aggregate.count }))
      .sort((a, b) => a.month.localeCompare(b.month))

    const symbolStats = Array.from(symbolMap.entries())
      .map(([symbol, aggregate]) => ({
        symbol,
        pnl: aggregate.pnl,
        count: aggregate.count,
        win_rate: safeDivide(aggregate.wins * 100, aggregate.count) ?? 0,
      }))
      .sort((a, b) => b.pnl - a.pnl)

    const directionStats = Array.from(directionMap.entries())
      .map(([direction, aggregate]) => ({
        direction,
        pnl: aggregate.pnl,
        count: aggregate.count,
        win_rate: safeDivide(aggregate.wins * 100, aggregate.count) ?? 0,
      }))

    const rMultipleDistribution = Array.from(rDistributionMap.entries())
      .map(([bucket, count]) => ({ bucket, count }))
      .sort((a, b) => Number(a.bucket) - Number(b.bucket))

    // --- Phase 3 Enhancement: Regime and Setup breakdowns ---
    const setupMap = new Map<string, { pnl: number; count: number; wins: number }>()
    const regimeMap = new Map<string, Map<string, { pnl: number; count: number; wins: number }>>()

    for (const row of closed) {
      const pnl = row.pnl ?? 0

      // Setup type breakdown
      if (row.setup_type) {
        const bucket = setupMap.get(row.setup_type) ?? { pnl: 0, count: 0, wins: 0 }
        bucket.pnl += pnl
        bucket.count += 1
        bucket.wins += pnl > 0 ? 1 : 0
        setupMap.set(row.setup_type, bucket)
      }

      // Regime tag breakdowns
      if (row.market_context) {
        for (const key of ['vix_bucket', 'trend_state', 'gex_regime', 'time_bucket']) {
          const value = row.market_context[key]
          if (typeof value !== 'string') continue

          if (!regimeMap.has(key)) regimeMap.set(key, new Map())
          const inner = regimeMap.get(key)!
          const bucket = inner.get(value) ?? { pnl: 0, count: 0, wins: 0 }
          bucket.pnl += pnl
          bucket.count += 1
          bucket.wins += pnl > 0 ? 1 : 0
          inner.set(value, bucket)
        }
      }
    }

    const setupStats = Array.from(setupMap.entries())
      .map(([setup, agg]) => ({
        setup_type: setup,
        pnl: Math.round(agg.pnl * 100) / 100,
        count: agg.count,
        win_rate: agg.count > 0 ? Math.round((agg.wins / agg.count) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl)

    const regimeStats: Record<string, Array<{ value: string; pnl: number; count: number; win_rate: number }>> = {}
    for (const [key, inner] of regimeMap.entries()) {
      regimeStats[key] = Array.from(inner.entries())
        .map(([value, agg]) => ({
          value,
          pnl: Math.round(agg.pnl * 100) / 100,
          count: agg.count,
          win_rate: agg.count > 0 ? Math.round((agg.wins / agg.count) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
    }

    const response: AdvancedAnalyticsResponse & {
      setup_stats: typeof setupStats
      regime_stats: typeof regimeStats
    } = {
      period,
      period_start: periodStart,
      total_trades: totalTrades,
      winning_trades: winning.length,
      losing_trades: losing.length,
      win_rate: winRate,
      total_pnl: totalPnl,
      avg_pnl: avgPnl,
      expectancy: expectancy != null && Number.isFinite(expectancy) ? expectancy : null,
      profit_factor: profitFactor,
      sharpe_ratio: sharpeRatio,
      sortino_ratio: sortinoRatio,
      max_drawdown: maxDrawdown,
      max_drawdown_duration_days: maxDrawdownDurationDays,
      avg_hold_minutes: avgHoldMinutes,
      hourly_pnl: hourlyPnl,
      day_of_week_pnl: dayOfWeekPnl,
      monthly_pnl: monthlyPnl,
      symbol_stats: symbolStats,
      direction_stats: directionStats,
      equity_curve: equityCurve,
      r_multiple_distribution: rMultipleDistribution,
      mfe_mae_scatter: mfeMaeScatter,
      setup_stats: setupStats,
      regime_stats: regimeStats,
    }

    return successResponse(response)
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }

    console.error('Journal analytics failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
