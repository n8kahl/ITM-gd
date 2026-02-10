import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdminClient()
    const { data: entries, error } = await supabase
      .from('journal_entries')
      .select('symbol,direction,pnl,trade_date,strategy,mfe_percent,mae_percent')
      .eq('user_id', userId)
      .or('is_draft.is.null,is_draft.eq.false')
      .order('trade_date', { ascending: false })
      .limit(500)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const rows = entries || []
    const closed = rows.filter((row) => toNumber(row.pnl) != null)
    const wins = closed.filter((row) => (toNumber(row.pnl) || 0) > 0)
    const losses = closed.filter((row) => (toNumber(row.pnl) || 0) < 0)

    const bySymbol = new Map<string, { pnl: number; trades: number; wins: number }>()
    const byHour = new Map<number, { pnl: number; trades: number; wins: number }>()
    const byStrategy = new Map<string, { pnl: number; trades: number; wins: number }>()

    for (const row of closed) {
      const pnl = toNumber(row.pnl) || 0
      const symbol = row.symbol || 'UNKNOWN'
      const symbolStats = bySymbol.get(symbol) || { pnl: 0, trades: 0, wins: 0 }
      symbolStats.pnl += pnl
      symbolStats.trades += 1
      symbolStats.wins += pnl > 0 ? 1 : 0
      bySymbol.set(symbol, symbolStats)

      const hour = new Date(row.trade_date).getHours()
      const hourStats = byHour.get(hour) || { pnl: 0, trades: 0, wins: 0 }
      hourStats.pnl += pnl
      hourStats.trades += 1
      hourStats.wins += pnl > 0 ? 1 : 0
      byHour.set(hour, hourStats)

      if (row.strategy) {
        const strategyStats = byStrategy.get(row.strategy) || { pnl: 0, trades: 0, wins: 0 }
        strategyStats.pnl += pnl
        strategyStats.trades += 1
        strategyStats.wins += pnl > 0 ? 1 : 0
        byStrategy.set(row.strategy, strategyStats)
      }
    }

    const sortedSymbols = Array.from(bySymbol.entries())
      .map(([symbol, stats]) => ({
        symbol,
        pnl: stats.pnl,
        trade_count: stats.trades,
        win_rate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl)

    const sortedHours = Array.from(byHour.entries())
      .map(([hour, stats]) => ({
        hour,
        pnl: stats.pnl,
        trade_count: stats.trades,
        win_rate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl)

    const sortedStrategies = Array.from(byStrategy.entries())
      .map(([strategy, stats]) => ({
        strategy,
        pnl: stats.pnl,
        trade_count: stats.trades,
        win_rate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl)

    const commonMistakes: string[] = []
    const avgMae = closed
      .map((row) => toNumber(row.mae_percent))
      .filter((value): value is number => value != null)
    const avgMfe = closed
      .map((row) => toNumber(row.mfe_percent))
      .filter((value): value is number => value != null)

    if (avgMae.length > 0 && avgMfe.length > 0) {
      const maeAvg = avgMae.reduce((sum, value) => sum + value, 0) / avgMae.length
      const mfeAvg = avgMfe.reduce((sum, value) => sum + value, 0) / avgMfe.length
      if (maeAvg > mfeAvg) {
        commonMistakes.push('Average adverse excursion is larger than favorable excursion.')
      }
    }
    if (losses.length > wins.length) {
      commonMistakes.push('Recent loss count exceeds wins; consider reducing size until consistency improves.')
    }

    return NextResponse.json({
      success: true,
      data: {
        total_trades: closed.length,
        win_rate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
        current_streak: (() => {
          let streak = 0
          for (const row of closed) {
            const pnl = toNumber(row.pnl) || 0
            if (pnl > 0) streak += 1
            else break
          }
          return streak
        })(),
        best_symbols: sortedSymbols.slice(0, 5),
        worst_symbols: sortedSymbols.slice(-5).reverse(),
        best_time_of_day: sortedHours[0] || null,
        best_strategies: sortedStrategies.slice(0, 5),
        common_mistakes: commonMistakes,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
