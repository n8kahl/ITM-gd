import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

interface DashboardStats {
  win_rate: number
  pnl_mtd: number
  pnl_change_pct: number
  current_streak: number
  streak_type: 'win' | 'loss'
  best_streak: number
  avg_ai_grade: string | null
  trades_mtd: number
  trades_last_month: number
}

interface DashboardEntryRow {
  trade_date: string
  pnl: number | null
  is_winner: boolean | null
  ai_analysis: unknown
  created_at: string | null
}

function round(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function getPeriodStart(period: string): Date {
  const now = new Date()
  const start = new Date(now)

  switch (period) {
    case 'week':
      start.setDate(start.getDate() - 7)
      break
    case 'quarter': {
      const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3
      start.setMonth(quarterStartMonth, 1)
      start.setHours(0, 0, 0, 0)
      break
    }
    case 'year':
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      break
    case 'all':
      start.setFullYear(1970, 0, 1)
      start.setHours(0, 0, 0, 0)
      break
    case 'month':
    default:
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      break
  }

  return start
}

function parseAIGrade(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const grade = obj.grade
    if (typeof grade === 'string') return grade
    const letter = obj.letter_grade
    return typeof letter === 'string' ? letter : null
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed.grade === 'string') return parsed.grade
      if (parsed && typeof parsed.letter_grade === 'string') return parsed.letter_grade
      return null
    } catch {
      return null
    }
  }
  return null
}

function normalizeAiGrade(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim().toUpperCase()
  if (trimmed.length === 0) return null
  const first = trimmed[0]
  if (!['A', 'B', 'C', 'D', 'F'].includes(first)) return null
  return first
}

function aiGradeToPoints(grade: string): number {
  switch (grade) {
    case 'A':
      return 4
    case 'B':
      return 3
    case 'C':
      return 2
    case 'D':
      return 1
    default:
      return 0
  }
}

function pointsToAiGrade(points: number): string {
  if (points >= 3.5) return 'A'
  if (points >= 2.5) return 'B'
  if (points >= 1.5) return 'C'
  if (points >= 0.5) return 'D'
  return 'F'
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function deriveWinner(row: DashboardEntryRow): boolean | null {
  if (row.is_winner === true) return true
  if (row.is_winner === false) return false
  if (row.pnl == null) return null
  return row.pnl > 0
}

function calculateTradeStreak(rows: DashboardEntryRow[]): {
  current: number
  currentType: 'win' | 'loss'
  best: number
} {
  const outcomes = rows
    .map((row) => deriveWinner(row))
    .filter((value): value is boolean => value != null)

  if (outcomes.length === 0) {
    return { current: 0, currentType: 'win', best: 0 }
  }

  const first = outcomes[0]
  let current = 0
  for (const outcome of outcomes) {
    if (outcome === first) current += 1
    else break
  }

  let best = 1
  let run = 1
  for (let index = 1; index < outcomes.length; index += 1) {
    if (outcomes[index] === outcomes[index - 1]) {
      run += 1
    } else {
      run = 1
    }
    best = Math.max(best, run)
  }

  return {
    current,
    currentType: first ? 'win' : 'loss',
    best,
  }
}

function calculateAverageAiGrade(rows: DashboardEntryRow[]): string | null {
  const grades = rows
    .map((row) => normalizeAiGrade(parseAIGrade(row.ai_analysis)))
    .filter((grade): grade is string => grade != null)

  if (grades.length === 0) return null

  const averagePoints = grades.reduce((sum, grade) => sum + aiGradeToPoints(grade), 0) / grades.length
  return pointsToAiGrade(averagePoints)
}

async function buildFallbackStats(
  supabase: any,
  userId: string,
  period: string,
): Promise<DashboardStats> {
  const now = new Date()
  const periodStart = getPeriodStart(period)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd = new Date(monthStart.getTime() - 1)
  const fetchStart = periodStart < prevMonthStart ? periodStart : prevMonthStart

  let { data: entries, error } = await supabase
    .from('journal_entries')
    .select('trade_date, pnl, is_winner, ai_analysis, created_at')
    .eq('user_id', userId)
    .not('is_draft', 'is', true)
    .neq('symbol', 'PENDING')
    .gte('trade_date', fetchStart.toISOString())
    .lte('trade_date', now.toISOString())
    .order('trade_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error && typeof error.message === 'string' && error.message.includes('is_draft')) {
    const retry = await supabase
      .from('journal_entries')
      .select('trade_date, pnl, is_winner, ai_analysis, created_at')
      .eq('user_id', userId)
      .neq('symbol', 'PENDING')
      .gte('trade_date', fetchStart.toISOString())
      .lte('trade_date', now.toISOString())
      .order('trade_date', { ascending: false })
      .order('created_at', { ascending: false })

    entries = retry.data
    error = retry.error
  }

  if (error) throw error

  const rows: DashboardEntryRow[] = (entries ?? []).map((row: any) => ({
    trade_date: String(row.trade_date),
    pnl: typeof row.pnl === 'number' ? row.pnl : (typeof row.pnl === 'string' ? Number(row.pnl) : null),
    is_winner: row.is_winner === true ? true : row.is_winner === false ? false : null,
    ai_analysis: row.ai_analysis ?? null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
  }))

  const monthRows = rows.filter((row) => {
    const tradeDate = toDate(row.trade_date)
    return tradeDate != null && tradeDate >= monthStart && tradeDate <= now
  })

  const monthClosedRows = monthRows.filter((row) => {
    const tradeDate = toDate(row.trade_date)
    return tradeDate != null && tradeDate >= monthStart && tradeDate <= now && row.pnl != null
  })

  const prevMonthRows = rows.filter((row) => {
    const tradeDate = toDate(row.trade_date)
    return tradeDate != null
      && tradeDate >= prevMonthStart
      && tradeDate <= prevMonthEnd
      && row.pnl != null
  })

  const pnlMtd = monthClosedRows.reduce((sum, row) => sum + (row.pnl ?? 0), 0)
  const prevMonthPnl = prevMonthRows.reduce((sum, row) => sum + (row.pnl ?? 0), 0)
  const pnlChangePct = prevMonthPnl === 0
    ? (pnlMtd === 0 ? 0 : 100)
    : ((pnlMtd - prevMonthPnl) / Math.abs(prevMonthPnl)) * 100

  const winners = monthClosedRows.filter((row) => deriveWinner(row) === true).length
  const winRate = monthClosedRows.length > 0 ? (winners / monthClosedRows.length) * 100 : 0

  const avgAiGrade = calculateAverageAiGrade(monthRows)

  const streak = calculateTradeStreak(rows)

  return {
    win_rate: round(winRate, 1),
    pnl_mtd: round(pnlMtd),
    pnl_change_pct: round(pnlChangePct, 1),
    current_streak: streak.current,
    streak_type: streak.currentType,
    best_streak: streak.best,
    avg_ai_grade: avgAiGrade,
    trades_mtd: monthClosedRows.length,
    trades_last_month: prevMonthRows.length,
  }
}

/**
 * GET /api/members/dashboard/stats — Dashboard statistics
 * Calls get_dashboard_stats RPC function.
 * Query params: period=week|month|quarter|year|all
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    const user = auth?.user
    const supabase = auth?.supabase

    if (!user || !supabase) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'

    // App-side aggregation keeps dashboard metrics accurate across schema drift
    // (for example nullable is_winner or legacy RPC payloads).
    const fallbackData = await buildFallbackStats(supabase, user.id, period)
    return NextResponse.json({ success: true, data: fallbackData, fallback: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    )
  }
}
