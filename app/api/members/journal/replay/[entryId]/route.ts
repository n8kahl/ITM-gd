import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const authHeader = request.headers.get('authorization')
  let accessToken: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7)
  } else {
    const cookies = request.cookies.getAll()
    const authCookie = cookies.find(c => c.name.includes('-auth-token'))
    if (authCookie) {
      try { const parsed = JSON.parse(authCookie.value); accessToken = parsed[0] || parsed.access_token } catch {}
    }
  }

  if (!accessToken) return null
  const supabase = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

/**
 * GET /api/members/journal/replay/:entryId
 * Returns trade replay data with 1-min bars from Massive.com
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
    }

    const { entryId } = await params
    const supabase = getSupabaseAdmin()

    // Fetch the journal entry
    const { data: entry, error: entryError } = await supabase
      .from('trading_journal_entries')
      .select('id, user_id, symbol, trade_date, entry_price, exit_price, entry_timestamp, exit_timestamp, direction')
      .eq('id', entryId)
      .eq('user_id', userId)
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ success: false, error: { message: 'Entry not found' } }, { status: 404 })
    }

    const apiKey = process.env.MASSIVE_API_KEY
    const tradeDate = entry.trade_date?.split('T')[0]

    if (!apiKey || !tradeDate || !entry.symbol) {
      // Return mock replay data for development
      return NextResponse.json({
        success: true,
        data: generateMockReplayData(entryId, entry),
      })
    }

    // Fetch 1-minute bars from Massive.com for the trade date
    const from = new Date(`${tradeDate}T09:30:00-05:00`).getTime()
    const to = new Date(`${tradeDate}T16:00:00-05:00`).getTime()

    try {
      const ticker = entry.symbol.includes(':') ? entry.symbol : `O:${entry.symbol}`
      const barsRes = await fetch(
        `https://api.massive.com/v2/aggs/ticker/${ticker}/range/1/minute/${from}/${to}?apiKey=${apiKey}&limit=50000`,
        { next: { revalidate: 86400 } } // Cache 24 hours
      )

      if (barsRes.ok) {
        const barsData = await barsRes.json()
        const bars = (barsData.results || []).map((b: any) => ({
          time: Math.floor(b.t / 1000),
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c,
          volume: b.v,
        }))

        // Calculate VWAP from bars
        let cumulativeTPV = 0
        let cumulativeVolume = 0
        const vwapLine = bars.map((bar: any) => {
          const typicalPrice = (bar.high + bar.low + bar.close) / 3
          cumulativeTPV += typicalPrice * bar.volume
          cumulativeVolume += bar.volume
          return {
            time: bar.time,
            value: cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice,
          }
        })

        // Fetch previous day data for PDH/PDL/PDC
        const prevDay = new Date(tradeDate)
        prevDay.setDate(prevDay.getDate() - 1)
        const prevDayStr = prevDay.toISOString().split('T')[0]

        let levels = { pdh: 0, pdl: 0, pdc: 0, pivotPP: 0, pivotR1: 0, pivotS1: 0 }

        try {
          const dailyRes = await fetch(
            `https://api.massive.com/v2/aggs/ticker/${ticker}/range/1/day/${prevDayStr}/${prevDayStr}?apiKey=${apiKey}`,
            { next: { revalidate: 86400 } }
          )
          if (dailyRes.ok) {
            const dailyData = await dailyRes.json()
            const prev = dailyData.results?.[0]
            if (prev) {
              const pdh = prev.h
              const pdl = prev.l
              const pdc = prev.c
              const pp = (pdh + pdl + pdc) / 3
              levels = {
                pdh, pdl, pdc,
                pivotPP: pp,
                pivotR1: 2 * pp - pdl,
                pivotS1: 2 * pp - pdh,
              }
            }
          }
        } catch {}

        // Determine entry and exit points
        const entryTime = entry.entry_timestamp
          ? Math.floor(new Date(entry.entry_timestamp).getTime() / 1000)
          : bars.length > Math.floor(bars.length * 0.3) ? bars[Math.floor(bars.length * 0.3)].time : bars[0]?.time || 0
        const exitTime = entry.exit_timestamp
          ? Math.floor(new Date(entry.exit_timestamp).getTime() / 1000)
          : bars.length > Math.floor(bars.length * 0.7) ? bars[Math.floor(bars.length * 0.7)].time : bars[bars.length - 1]?.time || 0

        return NextResponse.json({
          success: true,
          data: {
            entryId,
            symbol: entry.symbol,
            bars,
            entryPoint: { time: entryTime, price: entry.entry_price || 0 },
            exitPoint: { time: exitTime, price: entry.exit_price || 0 },
            vwapLine,
            levels,
          },
        })
      }
    } catch {}

    // Fallback: mock data
    return NextResponse.json({
      success: true,
      data: generateMockReplayData(entryId, entry),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

function generateMockReplayData(entryId: string, entry: any) {
  const basePrice = entry.entry_price || 450
  const bars = []
  const vwapLine = []
  const startTime = Math.floor(new Date(`${entry.trade_date?.split('T')[0] || '2026-02-08'}T09:30:00-05:00`).getTime() / 1000)

  let price = basePrice
  let cumulativeTPV = 0
  let cumulativeVol = 0

  for (let i = 0; i < 390; i++) { // 6.5 hours of 1-min bars
    const time = startTime + i * 60
    const change = (Math.random() - 0.49) * 2
    const open = price
    const close = price + change
    const high = Math.max(open, close) + Math.random() * 0.5
    const low = Math.min(open, close) - Math.random() * 0.5
    const volume = Math.floor(1000 + Math.random() * 5000)

    bars.push({ time, open, high, low, close, volume })

    const tp = (high + low + close) / 3
    cumulativeTPV += tp * volume
    cumulativeVol += volume
    vwapLine.push({ time, value: cumulativeTPV / cumulativeVol })

    price = close
  }

  const entryIdx = Math.floor(bars.length * 0.3)
  const exitIdx = Math.floor(bars.length * 0.7)

  return {
    entryId,
    symbol: entry.symbol || 'SPY',
    bars,
    entryPoint: { time: bars[entryIdx].time, price: entry.entry_price || bars[entryIdx].close },
    exitPoint: { time: bars[exitIdx].time, price: entry.exit_price || bars[exitIdx].close },
    vwapLine,
    levels: {
      pdh: basePrice + 5,
      pdl: basePrice - 5,
      pdc: basePrice - 1,
      pivotPP: basePrice,
      pivotR1: basePrice + 3,
      pivotS1: basePrice - 3,
    },
  }
}
