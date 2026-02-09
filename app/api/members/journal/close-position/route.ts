import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'
import { closePositionSchema } from '@/lib/validation/journal-api'

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function fetchLastPrice(symbol: string, apiKey?: string): Promise<number | null> {
  if (!apiKey) return null
  const candidates = [symbol, `I:${symbol}`, `O:${symbol}`]
  for (const candidate of candidates) {
    try {
      const response = await fetch(
        `https://api.massive.com/v2/last/trade/${encodeURIComponent(candidate)}?apiKey=${apiKey}`,
      )
      if (!response.ok) continue
      const payload = await response.json()
      const price = toNumber(payload?.results?.p ?? payload?.results?.price ?? payload?.last?.price)
      if (price != null) return price
    } catch {
      // no-op
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const payload = closePositionSchema.parse(await request.json())
    const supabase = getSupabaseAdminClient()

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', payload.entryId)
      .eq('user_id', userId)
      .eq('is_open', true)
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ success: false, error: 'Open position not found' }, { status: 404 })
    }

    const entryPrice = toNumber(entry.entry_price)
    if (entryPrice == null) {
      return NextResponse.json({ success: false, error: 'Entry price missing for open position' }, { status: 400 })
    }

    const marketExit = await fetchLastPrice(entry.symbol, process.env.MASSIVE_API_KEY)
    const exitPrice = payload.exit_price ?? marketExit
    if (exitPrice == null) {
      return NextResponse.json({ success: false, error: 'Unable to determine exit price' }, { status: 400 })
    }

    const size = toNumber(entry.position_size) ?? 1
    const multiplier = entry.contract_type && entry.contract_type !== 'stock' ? 100 : 1
    const perUnit = entry.direction === 'short'
      ? entryPrice - exitPrice
      : exitPrice - entryPrice
    const pnl = perUnit * size * multiplier
    const pnlPercentage = entryPrice !== 0 ? (perUnit / entryPrice) * 100 : null

    const exitTimestamp = payload.exit_timestamp || new Date().toISOString()
    const holdDurationMin = entry.entry_timestamp
      ? Math.max(0, Math.round((new Date(exitTimestamp).getTime() - new Date(entry.entry_timestamp).getTime()) / (1000 * 60)))
      : null

    const { data: updated, error: updateError } = await supabase
      .from('journal_entries')
      .update({
        is_open: false,
        exit_price: exitPrice,
        exit_timestamp: exitTimestamp,
        pnl,
        pnl_percentage: pnlPercentage,
        is_winner: pnl > 0 ? true : pnl < 0 ? false : null,
        hold_duration_min: holdDurationMin,
      })
      .eq('id', payload.entryId)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ success: false, error: updateError?.message || 'Failed to close position' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid close position payload' }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
