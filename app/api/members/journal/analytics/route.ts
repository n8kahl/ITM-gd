import { NextRequest, NextResponse } from 'next/server'
import { analyticsPeriodSchema } from '@/lib/validation/journal-api'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'

type Period = '7d' | '30d' | '90d' | '1y'

interface RawEntry {
  id: string
  trade_date: string
  created_at: string
  symbol: string | null
  direction: 'long' | 'short' | 'neutral' | null
  pnl: number | string | null
  stop_loss: number | string | null
  entry_price: number | string | null
  exit_price: number | string | null
  hold_duration_min: number | null
  mfe_percent: number | string | null
  mae_percent: number | string | null
  dte_at_entry: number | null
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getPeriodStart(period: Period): Date {
  const now = new Date()
  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case '1y':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    case '30d':
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

function computeRMultiple(entry: RawEntry): number | null {
  const entryPrice = toNumber(entry.entry_price)
  const exitPrice = toNumber(entry.exit_price)
  const stopLoss = toNumber(entry.stop_loss)

  if (entryPrice == null || exitPrice == null || stopLoss == null || !entry.direction) return null

  if (entry.direction === 'long') {
    const denominator = entryPrice - stopLoss
    if (denominator === 0) return null
    return (exitPrice - entryPrice) / denominator
  }

  if (entry.direction === 'short') {
    const denominator = stopLoss - entryPrice
    if (denominator === 0) return null
    return (entryPrice - exitPrice) / denominator
  }

  return null
}

function computeSharpe(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (values.length - 1)
  const stdDev = Math.sqrt(variance)
  if (stdDev === 0) return 0
  return mean / stdDev
}

function computeSortino(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const downside = values.filter((value) => value < 0)
  if (downside.length < 2) return 0
  const downsideMean = downside.reduce((sum, value) => sum + value, 0) / downside.length
  const downsideVariance = downside.reduce((sum, value) => sum + Math.pow(value - downsideMean, 2), 0) / (downside.length - 1)
  const downsideStdDev = Math.sqrt(downsideVariance)
  if (downsideStdDev === 0) return 0
  return mean / downsideStdDev
}

function buildFallbackAnalytics(entries: RawEntry[], period: Period) {
  const closedEntries = entries.filter((entry) => toNumber(entry.pnl) != null)
  const pnlValues = closedEntries.map((entry) => toNumber(entry.pnl) || 0)

  const totalTrades = closedEntries.length
  const winningTrades = closedEntries.filter((entry) => (toNumber(entry.pnl) || 0) > 0)
  const losingTrades = closedEntries.filter((entry) => (toNumber(entry.pnl) || 0) < 0)
  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0

  const totalPnl = pnlValues.reduce((sum, pnl) => sum + pnl, 0)
  const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, entry) => sum + (toNumber(entry.pnl) || 0), 0) / winningTrades.length
    : 0
  const avgLoss = losingTrades.length > 0
    ? Math.abs(losingTrades.reduce((sum, entry) => sum + (toNumber(entry.pnl) || 0), 0) / losingTrades.length)
    : 0
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss

  const grossProfit = winningTrades.reduce((sum, entry) => sum + (toNumber(entry.pnl) || 0), 0)
  const grossLoss = Math.abs(losingTrades.reduce((sum, entry) => sum + (toNumber(entry.pnl) || 0), 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : 0

  const rMultiples = closedEntries.map(computeRMultiple).filter((value): value is number => value != null)
  const avgRMultiple = rMultiples.length > 0 ? rMultiples.reduce((sum, value) => sum + value, 0) / rMultiples.length : 0

  let equity = 0
  let runningPeak = 0
  let maxDrawdown = 0
  let currentDrawdownLength = 0
  let maxDrawdownDuration = 0

  const sortedForEquity = [...closedEntries].sort((a, b) => {
    const tradeCompare = a.trade_date.localeCompare(b.trade_date)
    if (tradeCompare !== 0) return tradeCompare
    return a.created_at.localeCompare(b.created_at)
  })

  const equityCurve = sortedForEquity.map((entry) => {
    equity += toNumber(entry.pnl) || 0
    runningPeak = Math.max(runningPeak, equity)
    const drawdown = equity - runningPeak
    maxDrawdown = Math.min(maxDrawdown, drawdown)

    if (drawdown < 0) {
      currentDrawdownLength += 1
      maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownLength)
    } else {
      currentDrawdownLength = 0
    }

    return {
      trade_date: entry.trade_date,
      equity,
      drawdown,
    }
  })

  const hourlyMap = new Map<number, { hour_of_day: number; pnl: number; trade_count: number }>()
  const weekdayMap = new Map<number, { day_of_week: number; pnl: number; trade_count: number }>()
  const monthMap = new Map<string, { month: string; pnl: number; trade_count: number }>()
  const symbolMap = new Map<string, { symbol: string; pnl: number; trade_count: number; wins: number }>()
  const directionMap = new Map<string, { direction: string; pnl: number; trade_count: number; wins: number }>()
  const dteMap = new Map<string, { bucket: string; pnl: number; trade_count: number; wins: number }>()
  const rDistribution = new Map<string, number>()
  const mfeMaeScatter: Array<{ id: string; mfe: number; mae: number; pnl: number }> = []

  for (const entry of closedEntries) {
    const pnl = toNumber(entry.pnl) || 0
    const tradeDate = new Date(entry.trade_date)
    const etDate = new Date(tradeDate.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const hour = etDate.getHours()
    const weekday = etDate.getDay()
    const month = `${etDate.getFullYear()}-${String(etDate.getMonth() + 1).padStart(2, '0')}`

    const hourly = hourlyMap.get(hour) || { hour_of_day: hour, pnl: 0, trade_count: 0 }
    hourly.pnl += pnl
    hourly.trade_count += 1
    hourlyMap.set(hour, hourly)

    const weekdayEntry = weekdayMap.get(weekday) || { day_of_week: weekday, pnl: 0, trade_count: 0 }
    weekdayEntry.pnl += pnl
    weekdayEntry.trade_count += 1
    weekdayMap.set(weekday, weekdayEntry)

    const monthly = monthMap.get(month) || { month, pnl: 0, trade_count: 0 }
    monthly.pnl += pnl
    monthly.trade_count += 1
    monthMap.set(month, monthly)

    if (entry.symbol) {
      const symbolEntry = symbolMap.get(entry.symbol) || { symbol: entry.symbol, pnl: 0, trade_count: 0, wins: 0 }
      symbolEntry.pnl += pnl
      symbolEntry.trade_count += 1
      symbolEntry.wins += pnl > 0 ? 1 : 0
      symbolMap.set(entry.symbol, symbolEntry)
    }

    if (entry.direction) {
      const directionEntry = directionMap.get(entry.direction) || { direction: entry.direction, pnl: 0, trade_count: 0, wins: 0 }
      directionEntry.pnl += pnl
      directionEntry.trade_count += 1
      directionEntry.wins += pnl > 0 ? 1 : 0
      directionMap.set(entry.direction, directionEntry)
    }

    const dte = entry.dte_at_entry
    const dteBucket = dte == null ? 'unknown' : dte <= 7 ? '0-7' : dte <= 30 ? '8-30' : '31+'
    const dteEntry = dteMap.get(dteBucket) || { bucket: dteBucket, pnl: 0, trade_count: 0, wins: 0 }
    dteEntry.pnl += pnl
    dteEntry.trade_count += 1
    dteEntry.wins += pnl > 0 ? 1 : 0
    dteMap.set(dteBucket, dteEntry)

    const rMultiple = computeRMultiple(entry)
    if (rMultiple != null) {
      const bucket = `${Math.floor(rMultiple)}`
      rDistribution.set(bucket, (rDistribution.get(bucket) || 0) + 1)
    }

    const mfe = toNumber(entry.mfe_percent)
    const mae = toNumber(entry.mae_percent)
    if (mfe != null && mae != null) {
      mfeMaeScatter.push({ id: entry.id, mfe, mae, pnl })
    }
  }

  const symbolStats = Array.from(symbolMap.values())
    .map((item) => ({
      symbol: item.symbol,
      pnl: item.pnl,
      trade_count: item.trade_count,
      win_rate: item.trade_count > 0 ? (item.wins / item.trade_count) * 100 : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 25)

  const directionStats = Array.from(directionMap.values()).map((item) => ({
    direction: item.direction,
    pnl: item.pnl,
    trade_count: item.trade_count,
    win_rate: item.trade_count > 0 ? (item.wins / item.trade_count) * 100 : 0,
  }))

  const dteBuckets = Array.from(dteMap.values()).map((item) => ({
    bucket: item.bucket,
    pnl: item.pnl,
    trade_count: item.trade_count,
    win_rate: item.trade_count > 0 ? (item.wins / item.trade_count) * 100 : 0,
  }))

  return {
    period,
    period_start: getPeriodStart(period).toISOString(),
    total_trades: totalTrades,
    closed_trades: totalTrades,
    winning_trades: winningTrades.length,
    losing_trades: losingTrades.length,
    win_rate: winRate,
    total_pnl: totalPnl,
    avg_pnl: avgPnl,
    expectancy,
    profit_factor: Number.isFinite(profitFactor) ? profitFactor : null,
    avg_r_multiple: avgRMultiple,
    sharpe_ratio: computeSharpe(pnlValues),
    sortino_ratio: computeSortino(pnlValues),
    max_drawdown: maxDrawdown,
    max_drawdown_duration_days: maxDrawdownDuration,
    avg_hold_minutes: (() => {
      const values = closedEntries
        .map((entry) => entry.hold_duration_min)
        .filter((value): value is number => Number.isFinite(value))
      if (values.length === 0) return 0
      return values.reduce((sum, value) => sum + value, 0) / values.length
    })(),
    avg_mfe_percent: (() => {
      const values = closedEntries
        .map((entry) => toNumber(entry.mfe_percent))
        .filter((value): value is number => value != null)
      if (values.length === 0) return 0
      return values.reduce((sum, value) => sum + value, 0) / values.length
    })(),
    avg_mae_percent: (() => {
      const values = closedEntries
        .map((entry) => toNumber(entry.mae_percent))
        .filter((value): value is number => value != null)
      if (values.length === 0) return 0
      return values.reduce((sum, value) => sum + value, 0) / values.length
    })(),
    hourly_pnl: Array.from(hourlyMap.values()).sort((a, b) => a.hour_of_day - b.hour_of_day),
    day_of_week_pnl: Array.from(weekdayMap.values()).sort((a, b) => a.day_of_week - b.day_of_week),
    monthly_pnl: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
    symbol_stats: symbolStats,
    direction_stats: directionStats,
    dte_buckets: dteBuckets,
    equity_curve: equityCurve,
    r_multiple_distribution: Array.from(rDistribution.entries()).map(([bucket, count]) => ({ bucket, count })),
    mfe_mae_scatter: mfeMaeScatter,
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = analyticsPeriodSchema.parse(searchParams.get('period') ?? '30d')

    const supabase = getSupabaseAdminClient()

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_advanced_analytics', {
      target_user_id: userId,
      period,
    })

    if (!rpcError && rpcData) {
      return NextResponse.json({ success: true, data: rpcData })
    }

    const periodStart = getPeriodStart(period as Period).toISOString()
    const { data: entries, error: entriesError } = await supabase
      .from('journal_entries')
      .select('id,trade_date,created_at,symbol,direction,pnl,stop_loss,entry_price,exit_price,hold_duration_min,mfe_percent,mae_percent,dte_at_entry')
      .eq('user_id', userId)
      .gte('trade_date', periodStart)
      .order('trade_date', { ascending: true })

    if (entriesError) {
      return NextResponse.json({ success: false, error: entriesError.message }, { status: 500 })
    }

    const fallback = buildFallbackAnalytics((entries || []) as RawEntry[], period as Period)
    return NextResponse.json({ success: true, data: fallback, fallback: true })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid analytics query' }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
