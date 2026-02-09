import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

function round(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

async function buildFallbackCalendar(
  supabase: any,
  userId: string,
  months: number,
): Promise<Array<{ date: string; pnl: number; trade_count: number }>> {
  const start = new Date()
  start.setMonth(start.getMonth() - Math.max(1, months))

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('trade_date, pnl')
    .eq('user_id', userId)
    .gte('trade_date', start.toISOString())
    .order('trade_date', { ascending: true })

  if (error) throw error

  const byDate = new Map<string, { pnl: number; trade_count: number }>()
  for (const row of entries ?? []) {
    const date = new Date(row.trade_date).toISOString().slice(0, 10)
    const current = byDate.get(date) ?? { pnl: 0, trade_count: 0 }
    current.pnl += Number(row.pnl || 0)
    current.trade_count += 1
    byDate.set(date, current)
  }

  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, stats]) => ({
      date,
      pnl: round(stats.pnl),
      trade_count: stats.trade_count,
    }))
}

/**
 * GET /api/members/dashboard/calendar — Trading calendar heatmap data
 * Calls get_trading_calendar RPC function.
 * Query params: months=3|6|12
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
    const months = parseInt(searchParams.get('months') || '6', 10)

    const { data, error } = await supabase.rpc('get_trading_calendar', {
      p_user_id: user.id,
      p_months: months,
    })

    if (!error && Array.isArray(data)) {
      const normalized = data.map((row: any) => ({
        date: row.date ?? row.trade_date,
        pnl: Number(row.pnl ?? row.total_pnl ?? 0),
        trade_count: Number(row.trade_count ?? 0),
      }))
      return NextResponse.json({ success: true, data: normalized })
    }

    const fallbackData = await buildFallbackCalendar(supabase, user.id, months)
    return NextResponse.json({ success: true, data: fallbackData, fallback: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    )
  }
}
