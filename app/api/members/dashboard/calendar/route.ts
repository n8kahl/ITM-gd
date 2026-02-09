import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

type CalendarView = 'month' | 'quarter' | 'year'
type MoodValue = 'confident' | 'neutral' | 'anxious' | 'frustrated' | 'excited' | 'fearful'

interface CalendarDayStats {
  date: string
  pnl: number
  trade_count: number
  win_rate: number
  best_trade: number | null
  worst_trade: number | null
  mood: MoodValue | null
}

function round(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function parseView(raw: string | null): CalendarView | null {
  if (!raw) return null
  if (raw === 'month' || raw === 'quarter' || raw === 'year') return raw
  return null
}

function resolveMonths(searchParams: URLSearchParams): number {
  const view = parseView(searchParams.get('view'))
  if (view === 'month') return 1
  if (view === 'quarter') return 3
  if (view === 'year') return 12

  const parsed = Number.parseInt(searchParams.get('months') || '6', 10)
  if (!Number.isFinite(parsed)) return 6
  return Math.min(24, Math.max(1, parsed))
}

function pickDominantMood(moods: Map<MoodValue, number>): MoodValue | null {
  let selected: MoodValue | null = null
  let maxCount = 0

  for (const [mood, count] of moods.entries()) {
    if (count > maxCount) {
      selected = mood
      maxCount = count
    }
  }

  return selected
}

async function buildCalendarData(
  supabase: any,
  userId: string,
  months: number,
): Promise<CalendarDayStats[]> {
  const start = new Date()
  start.setMonth(start.getMonth() - Math.max(1, months))
  start.setHours(0, 0, 0, 0)

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('trade_date, pnl, is_winner, mood_after')
    .eq('user_id', userId)
    .gte('trade_date', start.toISOString())
    .order('trade_date', { ascending: true })

  if (error) throw error

  const byDate = new Map<string, {
    pnl: number
    trade_count: number
    wins: number
    best_trade: number | null
    worst_trade: number | null
    moods: Map<MoodValue, number>
  }>()

  for (const row of entries ?? []) {
    const date = new Date(row.trade_date).toISOString().slice(0, 10)
    const pnl = Number(row.pnl || 0)

    const current = byDate.get(date) ?? {
      pnl: 0,
      trade_count: 0,
      wins: 0,
      best_trade: null as number | null,
      worst_trade: null as number | null,
      moods: new Map<MoodValue, number>(),
    }

    current.pnl += pnl
    current.trade_count += 1

    const winner = row.is_winner === true || (row.is_winner == null && pnl > 0)
    if (winner) current.wins += 1

    current.best_trade = current.best_trade == null ? pnl : Math.max(current.best_trade, pnl)
    current.worst_trade = current.worst_trade == null ? pnl : Math.min(current.worst_trade, pnl)

    const mood = typeof row.mood_after === 'string' ? row.mood_after.toLowerCase() : null
    if (mood && ['confident', 'neutral', 'anxious', 'frustrated', 'excited', 'fearful'].includes(mood)) {
      const typedMood = mood as MoodValue
      current.moods.set(typedMood, (current.moods.get(typedMood) || 0) + 1)
    }

    byDate.set(date, current)
  }

  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, stats]) => ({
      date,
      pnl: round(stats.pnl),
      trade_count: stats.trade_count,
      win_rate: stats.trade_count > 0 ? round((stats.wins / stats.trade_count) * 100, 2) : 0,
      best_trade: stats.best_trade == null ? null : round(stats.best_trade),
      worst_trade: stats.worst_trade == null ? null : round(stats.worst_trade),
      mood: pickDominantMood(stats.moods),
    }))
}

/**
 * GET /api/members/dashboard/calendar
 * Query:
 * - view=month|quarter|year (preferred)
 * - months=1..24 (fallback/custom)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    const user = auth?.user
    const supabase = auth?.supabase

    if (!user || !supabase) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in' } },
        { status: 401 },
      )
    }

    const { searchParams } = new URL(request.url)
    const months = resolveMonths(searchParams)
    const data = await buildCalendarData(supabase, user.id, months)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 },
    )
  }
}

