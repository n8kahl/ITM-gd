import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

function round(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

async function buildFallbackEquityCurve(
  supabase: any,
  userId: string,
  days: number,
): Promise<Array<{ date: string; daily_pnl: number; cumulative_pnl: number }>> {
  const start = new Date()
  start.setDate(start.getDate() - Math.max(1, days))

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('trade_date, pnl')
    .eq('user_id', userId)
    .gte('trade_date', start.toISOString())
    .order('trade_date', { ascending: true })

  if (error) throw error

  const byDate = new Map<string, number>()
  for (const row of entries ?? []) {
    const date = new Date(row.trade_date).toISOString().slice(0, 10)
    byDate.set(date, (byDate.get(date) ?? 0) + Number(row.pnl || 0))
  }

  let cumulative = 0
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, pnl]) => {
      cumulative += pnl
      return {
        date,
        daily_pnl: round(pnl),
        cumulative_pnl: round(cumulative),
      }
    })
}

/**
 * GET /api/members/dashboard/equity-curve — P&L equity curve data
 * Calls get_equity_curve RPC function.
 * Query params: days=7|30|90|365
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
    const days = parseInt(searchParams.get('days') || '30', 10)

    const { data, error } = await supabase.rpc('get_equity_curve', {
      p_user_id: user.id,
      p_days: days,
    })

    if (!error && Array.isArray(data)) {
      const normalized = data.map((row: any) => ({
        date: row.date ?? row.trade_date,
        daily_pnl: Number(row.daily_pnl ?? 0),
        cumulative_pnl: Number(row.cumulative_pnl ?? 0),
      }))
      return NextResponse.json({ success: true, data: normalized })
    }

    const fallbackData = await buildFallbackEquityCurve(supabase, user.id, days)
    return NextResponse.json({ success: true, data: fallbackData, fallback: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    )
  }
}
