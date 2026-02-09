import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'

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
        { next: { revalidate: 10 } },
      )
      if (!response.ok) continue
      const payload = await response.json()
      const lastPrice = toNumber(payload?.results?.p ?? payload?.results?.price ?? payload?.last?.price)
      if (lastPrice != null) return lastPrice
    } catch {
      // no-op
    }
  }

  return null
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
      .select('*')
      .eq('user_id', userId)
      .eq('is_open', true)
      .order('trade_date', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const openEntries = entries || []
    const symbols = Array.from(new Set(openEntries.map((entry) => entry.symbol).filter(Boolean)))
    const apiKey = process.env.MASSIVE_API_KEY

    const prices = new Map<string, number | null>()
    await Promise.all(symbols.map(async (symbol) => {
      prices.set(symbol, await fetchLastPrice(symbol, apiKey))
    }))

    const data = openEntries.map((entry) => {
      const entryPrice = toNumber(entry.entry_price)
      const currentPrice = prices.get(entry.symbol) ?? entryPrice
      const size = toNumber(entry.position_size) ?? 1
      const multiplier = entry.contract_type && entry.contract_type !== 'stock' ? 100 : 1

      let livePnl: number | null = null
      let livePnlPercentage: number | null = null

      if (entryPrice != null && currentPrice != null && entry.direction) {
        const perUnit = entry.direction === 'short'
          ? entryPrice - currentPrice
          : currentPrice - entryPrice
        livePnl = perUnit * size * multiplier
        livePnlPercentage = entryPrice !== 0 ? (perUnit / entryPrice) * 100 : null
      }

      return {
        ...entry,
        current_price: currentPrice,
        live_pnl: livePnl,
        live_pnl_percentage: livePnlPercentage,
        updated_at: new Date().toISOString(),
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
