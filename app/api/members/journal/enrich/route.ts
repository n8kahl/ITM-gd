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
 * POST /api/members/journal/enrich
 * Enriches a journal entry with Massive.com market context data.
 * Called after entry is saved.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { entryId } = await request.json()
    if (!entryId) {
      return NextResponse.json({ success: false, error: 'entryId is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Fetch the entry
    const { data: entry, error: entryError } = await supabase
      .from('trading_journal_entries')
      .select('*')
      .eq('id', entryId)
      .eq('user_id', userId)
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ success: false, error: 'Entry not found' }, { status: 404 })
    }

    const apiKey = process.env.MASSIVE_API_KEY
    const tradeDate = entry.trade_date?.split('T')[0]

    if (!apiKey || !tradeDate || !entry.symbol) {
      return NextResponse.json({ success: false, error: 'Missing API key or trade data' }, { status: 400 })
    }

    const ticker = entry.symbol
    const entryPrice = entry.entry_price || entry.profit_loss ? 0 : 0
    const exitPrice = entry.exit_price || 0

    // Fetch minute bars for the trade date
    const from = new Date(`${tradeDate}T04:00:00-05:00`).getTime()
    const to = new Date(`${tradeDate}T20:00:00-05:00`).getTime()

    const [minuteRes, dailyRes] = await Promise.all([
      fetch(`https://api.massive.com/v2/aggs/ticker/${ticker}/range/1/minute/${from}/${to}?apiKey=${apiKey}&limit=50000`),
      fetch(`https://api.massive.com/v2/aggs/ticker/${ticker}/range/1/day/${new Date(new Date(tradeDate).getTime() - 30 * 86400000).toISOString().split('T')[0]}/${tradeDate}?apiKey=${apiKey}`),
    ])

    let marketContext: Record<string, any> = {}
    let verification: Record<string, any> = {}

    if (minuteRes.ok && dailyRes.ok) {
      const minuteData = await minuteRes.json()
      const dailyData = await dailyRes.json()

      const minuteBars = minuteData.results || []
      const dailyBars = dailyData.results || []

      // Calculate VWAP at entry/exit times
      const entryTimestamp = entry.entry_timestamp
        ? new Date(entry.entry_timestamp).getTime()
        : new Date(`${tradeDate}T10:00:00-05:00`).getTime()
      const exitTimestamp = entry.exit_timestamp
        ? new Date(entry.exit_timestamp).getTime()
        : new Date(`${tradeDate}T15:00:00-05:00`).getTime()

      // Find bars at entry/exit
      const entryBar = minuteBars.find((b: any) => b.t >= entryTimestamp) || minuteBars[0]
      const exitBar = minuteBars.find((b: any) => b.t >= exitTimestamp) || minuteBars[minuteBars.length - 1]

      // Calculate VWAP up to entry time
      let cTPV = 0, cVol = 0
      for (const bar of minuteBars) {
        if (bar.t > entryTimestamp) break
        const tp = (bar.h + bar.l + bar.c) / 3
        cTPV += tp * bar.v
        cVol += bar.v
      }
      const entryVwap = cVol > 0 ? cTPV / cVol : entryBar?.c || 0

      // Continue for exit VWAP
      for (const bar of minuteBars) {
        if (bar.t <= entryTimestamp) continue
        if (bar.t > exitTimestamp) break
        const tp = (bar.h + bar.l + bar.c) / 3
        cTPV += tp * bar.v
        cVol += bar.v
      }
      const exitVwap = cVol > 0 ? cTPV / cVol : exitBar?.c || 0

      // Calculate ATR(14) from daily bars
      let atr14 = 0
      if (dailyBars.length >= 15) {
        const trs = dailyBars.slice(-15).map((d: any, i: number, arr: any[]) => {
          if (i === 0) return d.h - d.l
          const prevClose = arr[i - 1].c
          return Math.max(d.h - d.l, Math.abs(d.h - prevClose), Math.abs(d.l - prevClose))
        })
        atr14 = trs.slice(1).reduce((s: number, v: number) => s + v, 0) / 14
      }

      // Previous day data
      const prevDay = dailyBars.length >= 2 ? dailyBars[dailyBars.length - 2] : null
      const pdh = prevDay?.h || 0
      const pdl = prevDay?.l || 0
      const pdc = prevDay?.c || 0

      // Volume comparison (today vs 20-day avg)
      const recentDailyBars = dailyBars.slice(-21, -1)
      const avgVolume = recentDailyBars.length > 0
        ? recentDailyBars.reduce((s: number, d: any) => s + d.v, 0) / recentDailyBars.length
        : 1
      const todayVolume = dailyBars[dailyBars.length - 1]?.v || 0
      const volumeVsAvg = avgVolume > 0 ? todayVolume / avgVolume : 1

      // Nearest level at entry
      const ep = entry.entry_price || entryBar?.c || 0
      const pp = (pdh + pdl + pdc) / 3
      const r1 = 2 * pp - pdl
      const s1 = 2 * pp - pdh

      const levels = [
        { name: 'PDH', price: pdh },
        { name: 'PDL', price: pdl },
        { name: 'PDC', price: pdc },
        { name: 'VWAP', price: entryVwap },
        { name: 'Pivot PP', price: pp },
        { name: 'Pivot R1', price: r1 },
        { name: 'Pivot S1', price: s1 },
      ].filter(l => l.price > 0)

      const nearestEntry = levels.reduce<{ name: string; price: number; distance: number }>((best, l) => {
        const dist = Math.abs(ep - l.price)
        return dist < best.distance ? { ...l, distance: dist / (atr14 || 1) } : best
      }, { name: 'None', price: 0, distance: Infinity })

      const xp = entry.exit_price || exitBar?.c || 0
      const nearestExit = levels.reduce<{ name: string; price: number; distance: number }>((best, l) => {
        const dist = Math.abs(xp - l.price)
        return dist < best.distance ? { ...l, distance: dist / (atr14 || 1) } : best
      }, { name: 'None', price: 0, distance: Infinity })

      // Determine day context
      const dayHigh = dailyBars[dailyBars.length - 1]?.h || 0
      const dayLow = dailyBars[dailyBars.length - 1]?.l || 0
      const dayClose = dailyBars[dailyBars.length - 1]?.c || 0
      const atrUsed = atr14 > 0 ? (dayHigh - dayLow) / atr14 : 0
      const marketTrend = dayClose > entryVwap && dayClose > pp ? 'bullish' : dayClose < entryVwap && dayClose < pp ? 'bearish' : 'neutral'
      const sessionType = atrUsed > 1.2 ? 'trending' : atrUsed < 0.6 ? 'range-bound' : 'volatile'

      marketContext = {
        entryContext: {
          timestamp: new Date(entryTimestamp).toISOString(),
          price: ep,
          vwap: Math.round(entryVwap * 100) / 100,
          atr14: Math.round(atr14 * 100) / 100,
          volumeVsAvg: Math.round(volumeVsAvg * 100) / 100,
          distanceFromPDH: Math.round(Math.abs(ep - pdh) * 100) / 100,
          distanceFromPDL: Math.round(Math.abs(ep - pdl) * 100) / 100,
          nearestLevel: { name: nearestEntry.name, price: nearestEntry.price, distance: Math.round(nearestEntry.distance * 100) / 100 },
        },
        exitContext: {
          timestamp: new Date(exitTimestamp).toISOString(),
          price: xp,
          vwap: Math.round(exitVwap * 100) / 100,
          atr14: Math.round(atr14 * 100) / 100,
          volumeVsAvg: Math.round(volumeVsAvg * 100) / 100,
          distanceFromPDH: Math.round(Math.abs(xp - pdh) * 100) / 100,
          distanceFromPDL: Math.round(Math.abs(xp - pdl) * 100) / 100,
          nearestLevel: { name: nearestExit.name, price: nearestExit.price, distance: Math.round(nearestExit.distance * 100) / 100 },
        },
        dayContext: {
          marketTrend,
          atrUsed: Math.round(atrUsed * 100) / 100,
          sessionType,
          keyLevelsActive: {
            pdh, pdl, pdc,
            vwap: Math.round(entryVwap * 100) / 100,
            atr14: Math.round(atr14 * 100) / 100,
            pivotPP: Math.round(pp * 100) / 100,
            pivotR1: Math.round(r1 * 100) / 100,
            pivotS1: Math.round(s1 * 100) / 100,
          },
        },
      }

      // Trade verification
      if (entryBar && entry.entry_price != null) {
        const entryInRange = entry.entry_price >= entryBar.l && entry.entry_price <= entryBar.h
        let exitInRange = true
        if (exitBar && entry.exit_price != null) {
          exitInRange = entry.exit_price >= exitBar.l && entry.exit_price <= exitBar.h
        }
        verification = {
          isVerified: entryInRange && exitInRange,
          confidence: entryInRange && exitInRange ? 'exact' : 'close',
          entryPriceMatch: entryInRange,
          exitPriceMatch: exitInRange,
          priceSource: 'massive-1min',
          verifiedAt: new Date().toISOString(),
        }
      }
    }

    // Generate smart tags from market context
    const smartTags = generateSmartTags(marketContext, entry)

    // Update the entry
    const updateData: Record<string, any> = {
      enriched_at: new Date().toISOString(),
    }

    if (Object.keys(marketContext).length > 0) {
      updateData.market_context = marketContext
    }
    if (Object.keys(verification).length > 0) {
      updateData.verification = verification
    }
    if (smartTags.length > 0) {
      updateData.smart_tags = smartTags
    }

    const { error: updateError } = await supabase
      .from('trading_journal_entries')
      .update(updateData)
      .eq('id', entryId)
      .eq('user_id', userId)

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        market_context: marketContext,
        verification,
        smart_tags: smartTags,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate smart tags based on market context data
 */
function generateSmartTags(context: any, entry: any): string[] {
  if (!context?.entryContext) return []
  const tags: string[] = []
  const ec = context.entryContext
  const dc = context.dayContext

  // Price-level based
  if (ec.atr14 > 0) {
    if (ec.distanceFromPDH < ec.atr14 * 0.3) tags.push('PDH Break')
    if (ec.distanceFromPDL < ec.atr14 * 0.3) tags.push('PDL Bounce')
    if (Math.abs(ec.price - ec.vwap) < ec.atr14 * 0.2) tags.push('VWAP Play')
    if (ec.nearestLevel?.name?.includes('Pivot') && ec.nearestLevel.distance < 0.3) tags.push('Pivot Bounce')
  }

  // Volume based
  if (ec.volumeVsAvg >= 2.0) tags.push('Volume Surge')
  else if (ec.volumeVsAvg >= 1.5) tags.push('High Volume')
  else if (ec.volumeVsAvg < 0.7) tags.push('Low Volume')

  // Session context
  if (ec.timestamp) {
    const hours = new Date(ec.timestamp).getUTCHours()
    const mins = new Date(ec.timestamp).getUTCMinutes()
    const totalMins = hours * 60 + mins
    if (totalMins >= 570 && totalMins <= 600) tags.push('Opening Range')
    if (totalMins >= 930 && totalMins <= 960) tags.push('Power Hour')
  }

  // Day type
  if (dc?.sessionType === 'trending') tags.push('Trend Day')
  if (dc?.sessionType === 'range-bound') tags.push('Range Day')

  // Options context
  if (context.optionsContext) {
    if (context.optionsContext.ivRankAtEntry >= 70) tags.push('High IV Entry')
    if (context.optionsContext.ivRankAtEntry <= 20) tags.push('Low IV Entry')
    if (context.optionsContext.dteAtEntry === 0) tags.push('0-DTE')
    if (context.optionsContext.dteAtEntry <= 1) tags.push('Same-Day Exp')
    if (context.optionsContext.ivAtExit < context.optionsContext.ivAtEntry * 0.8) tags.push('IV Crush')
  }

  return tags
}
