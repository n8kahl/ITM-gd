import { NextRequest } from 'next/server'
import { z, ZodError } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/members/journal/context?symbol=SPX
 *
 * Pre-trade context endpoint. Returns the user's recent trade history for a given symbol
 * to display before entering a new position. Includes:
 *   - Last 5 trades for the symbol (with outcomes)
 *   - Win rate for the symbol
 *   - Average P&L for the symbol
 *   - Common mistakes (entries where followed_plan=false)
 *   - Best-performing setup types and time buckets
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 4, Slice 4A
 */

const contextQuerySchema = z.object({
  symbol: z.string().min(1).max(16).transform((s) => s.toUpperCase().trim()),
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

interface ContextTrade {
  id: string
  trade_date: string
  direction: string
  pnl: number | null
  is_winner: boolean | null
  setup_type: string | null
  followed_plan: boolean | null
  hold_duration_min: number | null
}

interface PreTradeContext {
  symbol: string
  recentTrades: ContextTrade[]
  stats: {
    totalTrades: number
    winRate: number | null
    avgPnl: number | null
    avgHoldMinutes: number | null
    followedPlanRate: number | null
  }
  bestSetupType: string | null
  bestTimeBucket: string | null
  commonMistake: string | null
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)

  try {
    const { searchParams } = new URL(request.url)
    const parsed = contextQuerySchema.parse({
      symbol: searchParams.get('symbol') ?? '',
      limit: searchParams.get('limit') ?? undefined,
    })

    // Fetch recent trades for this symbol
    const { data: trades, error: tradesError } = await supabase
      .from('journal_entries')
      .select('id,trade_date,direction,pnl,is_winner,setup_type,followed_plan,hold_duration_min,market_context')
      .eq('user_id', user.id)
      .ilike('symbol', parsed.symbol)
      .eq('is_draft', false)
      .order('trade_date', { ascending: false })
      .limit(50)

    if (tradesError) {
      console.error('Failed to load context trades:', tradesError)
      return errorResponse('Failed to load trade context', 500)
    }

    const rows = (trades ?? []) as Array<Record<string, unknown>>
    const closedRows = rows.filter((r) => r.pnl != null)

    // Stats
    const totalTrades = closedRows.length
    const winners = closedRows.filter((r) => typeof r.pnl === 'number' && r.pnl > 0)
    const winRate = totalTrades > 0 ? Math.round((winners.length / totalTrades) * 10000) / 100 : null

    const pnls = closedRows
      .map((r) => (typeof r.pnl === 'number' ? r.pnl : null))
      .filter((p): p is number => p != null)
    const avgPnl = pnls.length > 0 ? Math.round((pnls.reduce((s, p) => s + p, 0) / pnls.length) * 100) / 100 : null

    const holdMinutes = closedRows
      .map((r) => (typeof r.hold_duration_min === 'number' ? r.hold_duration_min : null))
      .filter((h): h is number => h != null)
    const avgHoldMinutes = holdMinutes.length > 0 ? Math.round(holdMinutes.reduce((s, h) => s + h, 0) / holdMinutes.length) : null

    const planEntries = closedRows.filter((r) => typeof r.followed_plan === 'boolean')
    const followedPlanRate = planEntries.length > 0
      ? Math.round((planEntries.filter((r) => r.followed_plan === true).length / planEntries.length) * 10000) / 100
      : null

    // Best setup type (by win rate, minimum 2 trades)
    const setupCounts = new Map<string, { wins: number; total: number }>()
    for (const row of closedRows) {
      const setup = typeof row.setup_type === 'string' ? row.setup_type : null
      if (!setup) continue
      const entry = setupCounts.get(setup) ?? { wins: 0, total: 0 }
      entry.total++
      if (typeof row.pnl === 'number' && row.pnl > 0) entry.wins++
      setupCounts.set(setup, entry)
    }

    let bestSetupType: string | null = null
    let bestSetupWinRate = 0
    for (const [setup, counts] of setupCounts) {
      if (counts.total >= 2) {
        const wr = counts.wins / counts.total
        if (wr > bestSetupWinRate) {
          bestSetupWinRate = wr
          bestSetupType = setup
        }
      }
    }

    // Best time bucket (from market_context regime tags)
    const timeBucketCounts = new Map<string, { wins: number; total: number }>()
    for (const row of closedRows) {
      const mc = row.market_context as Record<string, unknown> | null
      const bucket = typeof mc?.time_bucket === 'string' ? mc.time_bucket : null
      if (!bucket) continue
      const entry = timeBucketCounts.get(bucket) ?? { wins: 0, total: 0 }
      entry.total++
      if (typeof row.pnl === 'number' && row.pnl > 0) entry.wins++
      timeBucketCounts.set(bucket, entry)
    }

    let bestTimeBucket: string | null = null
    let bestTimeWinRate = 0
    for (const [bucket, counts] of timeBucketCounts) {
      if (counts.total >= 2) {
        const wr = counts.wins / counts.total
        if (wr > bestTimeWinRate) {
          bestTimeWinRate = wr
          bestTimeBucket = bucket
        }
      }
    }

    // Common mistake: most frequent deviation (followed_plan=false)
    const deviations = closedRows.filter((r) => r.followed_plan === false)
    const commonMistake = deviations.length >= 2
      ? `${deviations.length} of ${totalTrades} trades deviated from plan (${Math.round((deviations.length / totalTrades) * 100)}%)`
      : null

    const recentTrades: ContextTrade[] = rows.slice(0, parsed.limit).map((r) => ({
      id: r.id as string,
      trade_date: r.trade_date as string,
      direction: r.direction as string,
      pnl: typeof r.pnl === 'number' ? r.pnl : null,
      is_winner: typeof r.is_winner === 'boolean' ? r.is_winner : null,
      setup_type: typeof r.setup_type === 'string' ? r.setup_type : null,
      followed_plan: typeof r.followed_plan === 'boolean' ? r.followed_plan : null,
      hold_duration_min: typeof r.hold_duration_min === 'number' ? r.hold_duration_min : null,
    }))

    const context: PreTradeContext = {
      symbol: parsed.symbol,
      recentTrades,
      stats: {
        totalTrades,
        winRate,
        avgPnl,
        avgHoldMinutes,
        followedPlanRate,
      },
      bestSetupType,
      bestTimeBucket: bestTimeBucket?.replace(/_/g, ' ') ?? null,
      commonMistake,
    }

    return successResponse(context)
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse('Invalid request', 400, err.flatten())
    }

    console.error('Journal context failed:', err)
    return errorResponse('Internal server error', 500)
  }
}
