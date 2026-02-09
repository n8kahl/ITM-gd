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
    return typeof grade === 'string' ? grade : null
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed.grade === 'string') return parsed.grade
      return null
    } catch {
      return null
    }
  }
  return null
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

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('trade_date, pnl, is_winner, ai_analysis, created_at')
    .eq('user_id', userId)
    .gte('trade_date', fetchStart.toISOString())
    .order('trade_date', { ascending: false })

  if (error) throw error

  const rows = entries ?? []
  const monthRows = rows.filter((row: any) => new Date(row.trade_date) >= monthStart)
  const prevMonthRows = rows.filter((row: any) => {
    const d = new Date(row.trade_date)
    return d >= prevMonthStart && d <= prevMonthEnd
  })

  const pnlMtd = monthRows.reduce((sum: number, row: any) => sum + Number(row.pnl || 0), 0)
  const prevMonthPnl = prevMonthRows.reduce((sum: number, row: any) => sum + Number(row.pnl || 0), 0)
  const pnlChangePct = prevMonthPnl === 0
    ? (pnlMtd === 0 ? 0 : 100)
    : ((pnlMtd - prevMonthPnl) / Math.abs(prevMonthPnl)) * 100

  const winners = monthRows.filter((row: any) => row.is_winner === true).length
  const winRate = monthRows.length > 0 ? (winners / monthRows.length) * 100 : 0

  const firstWithGrade = rows.find((row: any) => parseAIGrade(row.ai_analysis))
  const avgAiGrade = firstWithGrade ? parseAIGrade(firstWithGrade.ai_analysis) : null

  const { data: streakRow } = await supabase
    .from('journal_streaks')
    .select('current_streak, longest_streak, total_winners, total_losers')
    .eq('user_id', userId)
    .single()

  const totalWinners = Number(streakRow?.total_winners || 0)
  const totalLosers = Number(streakRow?.total_losers || 0)

  return {
    win_rate: round(winRate, 1),
    pnl_mtd: round(pnlMtd),
    pnl_change_pct: round(pnlChangePct, 1),
    current_streak: Number(streakRow?.current_streak || 0),
    streak_type: totalWinners >= totalLosers ? 'win' : 'loss',
    best_streak: Number(streakRow?.longest_streak || 0),
    avg_ai_grade: avgAiGrade,
    trades_mtd: monthRows.length,
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

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_user_id: user.id,
      p_period: period,
    })

    if (!error && data) {
      return NextResponse.json({ success: true, data })
    }

    // Fallback path for environments where RPC migrations are missing.
    const fallbackData = await buildFallbackStats(supabase, user.id, period)
    return NextResponse.json({ success: true, data: fallbackData, fallback: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    )
  }
}
