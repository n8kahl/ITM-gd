import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { fetchWithRetry } from '@/lib/api/fetch-with-retry'
import { MassiveAggsResponseSchema, type MassiveBar } from '@/lib/types/massive-api'

type TradeDirection = 'long' | 'short' | 'neutral'

interface JournalEntryForEnrich {
  id: string
  user_id: string
  symbol: string | null
  trade_date: string | null
  entry_price: number | null
  exit_price: number | null
  direction: TradeDirection | null
  entry_timestamp: string | null
  exit_timestamp: string | null
  contract_type: 'call' | 'put' | null
  strike_price: number | null
  expiration_date: string | null
  dte_at_entry: number | null
  dte_at_exit: number | null
}

interface LevelDistance {
  name: string
  price: number
  distance: number
}

interface TradeContextPoint {
  timestamp: string
  price: number
  vwap: number
  atr14: number
  volumeVsAvg: number
  distanceFromPDH: number
  distanceFromPDL: number
  nearestLevel: LevelDistance
}

type MarketTrend = 'bullish' | 'bearish' | 'neutral'
type SessionType = 'trending' | 'range-bound' | 'volatile'

interface DayContext {
  marketTrend: MarketTrend
  atrUsed: number
  sessionType: SessionType
  keyLevelsActive: {
    pdh: number
    pdl: number
    pdc: number
    vwap: number
    atr14: number
    pivotPP: number
    pivotR1: number
    pivotS1: number
  }
}

interface OptionsContext {
  ivRankAtEntry: number
  dteAtEntry: number
  ivAtExit: number
  ivAtEntry: number
}

interface MarketContext {
  entryContext?: TradeContextPoint
  exitContext?: TradeContextPoint
  dayContext?: DayContext
  optionsContext?: OptionsContext
}

interface TradeVerification {
  isVerified: boolean
  confidence: 'exact' | 'close'
  entryPriceMatch: boolean
  exitPriceMatch: boolean
  priceSource: 'massive-1min'
  verifiedAt: string
}

interface EnrichmentUpdateData {
  enriched_at: string
  market_context?: MarketContext
  verification?: TradeVerification
  smart_tags?: string[]
  mfe_percent?: number
  mae_percent?: number
  hold_duration_min?: number
  contract_type?: 'call' | 'put'
  strike_price?: number | null
  expiration_date?: string | null
  dte_at_entry?: number
  dte_at_exit?: number
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

function resolveTradeTimestamp({
  entryId,
  userId,
  fieldName,
  value,
  fallbackIso,
}: {
  entryId: string
  userId: string
  fieldName: 'entry_timestamp' | 'exit_timestamp'
  value: unknown
  fallbackIso: string
}): number {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value).getTime()
    if (Number.isFinite(parsed)) {
      return parsed
    }
    console.warn(`[journal-enrich] Invalid ${fieldName}; using fallback time`, {
      entryId,
      userId,
      fieldName,
      received: value,
      fallbackIso,
    })
    return new Date(fallbackIso).getTime()
  }

  console.warn(`[journal-enrich] Missing ${fieldName}; using fallback time`, {
    entryId,
    userId,
    fieldName,
    fallbackIso,
  })
  return new Date(fallbackIso).getTime()
}

/**
 * POST /api/members/journal/enrich
 * Enriches a journal entry with Massive.com market context data.
 * Called after entry is saved.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    const userId = auth?.user.id ?? null
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { entryId } = await request.json()
    if (!entryId) {
      return NextResponse.json({ success: false, error: 'entryId is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Fetch the entry
    const { data: entryData, error: entryError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', entryId)
      .eq('user_id', userId)
      .single()

    const entry = entryData as JournalEntryForEnrich | null

    if (entryError || !entry) {
      return NextResponse.json({ success: false, error: 'Entry not found' }, { status: 404 })
    }

    const apiKey = process.env.MASSIVE_API_KEY
    const tradeDate = entry.trade_date?.split('T')[0]

    if (!apiKey || !tradeDate || !entry.symbol) {
      return NextResponse.json({ success: false, error: 'Missing API key or trade data' }, { status: 400 })
    }

    const ticker = entry.symbol

    // Fetch minute bars for the trade date
    const from = new Date(`${tradeDate}T04:00:00-05:00`).getTime()
    const to = new Date(`${tradeDate}T20:00:00-05:00`).getTime()

    let marketContext: MarketContext = {}
    let verification: TradeVerification | null = null
    let mfePercent: number | null = null
    let maePercent: number | null = null
    let holdDurationMin: number | null = null
    const warnings: string[] = []

    const [minuteRes, dailyRes] = await Promise.all([
      fetchWithRetry(
        `https://api.massive.com/v2/aggs/ticker/${ticker}/range/1/minute/${from}/${to}?apiKey=${apiKey}&limit=50000`,
      ).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown minute-bars error'
        warnings.push(`Minute bars request failed: ${message}`)
        return null
      }),
      fetchWithRetry(
        `https://api.massive.com/v2/aggs/ticker/${ticker}/range/1/day/${new Date(new Date(tradeDate).getTime() - 30 * 86400000).toISOString().split('T')[0]}/${tradeDate}?apiKey=${apiKey}`,
      ).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown daily-bars error'
        warnings.push(`Daily bars request failed: ${message}`)
        return null
      }),
    ])

    let minuteBars: MassiveBar[] = []
    let dailyBars: MassiveBar[] = []

    if (minuteRes) {
      if (!minuteRes.ok) {
        warnings.push(`Minute bars request returned ${minuteRes.status}`)
      } else {
        minuteBars = MassiveAggsResponseSchema.parse(await minuteRes.json()).results
      }
    }

    if (dailyRes) {
      if (!dailyRes.ok) {
        warnings.push(`Daily bars request returned ${dailyRes.status}`)
      } else {
        dailyBars = MassiveAggsResponseSchema.parse(await dailyRes.json()).results
      }
    }

    // Calculate VWAP and intraday metrics from minute bars.
    if (minuteBars.length > 0) {
      const entryTimestamp = resolveTradeTimestamp({
        entryId,
        userId,
        fieldName: 'entry_timestamp',
        value: entry.entry_timestamp,
        fallbackIso: `${tradeDate}T10:00:00-05:00`,
      })
      const exitTimestamp = resolveTradeTimestamp({
        entryId,
        userId,
        fieldName: 'exit_timestamp',
        value: entry.exit_timestamp,
        fallbackIso: `${tradeDate}T15:00:00-05:00`,
      })

      const entryBar = minuteBars.find((b: MassiveBar) => b.t >= entryTimestamp) || minuteBars[0]
      const exitBar = minuteBars.find((b: MassiveBar) => b.t >= exitTimestamp) || minuteBars[minuteBars.length - 1]

      let cTPV = 0
      let cVol = 0
      for (const bar of minuteBars) {
        if (bar.t > entryTimestamp) break
        const tp = (bar.h + bar.l + bar.c) / 3
        cTPV += tp * bar.v
        cVol += bar.v
      }
      const entryVwap = cVol > 0 ? cTPV / cVol : entryBar?.c || 0

      for (const bar of minuteBars) {
        if (bar.t <= entryTimestamp) continue
        if (bar.t > exitTimestamp) break
        const tp = (bar.h + bar.l + bar.c) / 3
        cTPV += tp * bar.v
        cVol += bar.v
      }
      const exitVwap = cVol > 0 ? cTPV / cVol : exitBar?.c || 0

      const ep = entry.entry_price || entryBar?.c || 0
      const xp = entry.exit_price || exitBar?.c || 0

      const activeBars = minuteBars.filter((bar: MassiveBar) => bar.t >= entryTimestamp && bar.t <= exitTimestamp)
      if (activeBars.length > 0 && ep > 0) {
        const highestHigh = activeBars.reduce((max: number, bar: MassiveBar) => Math.max(max, bar.h), activeBars[0].h)
        const lowestLow = activeBars.reduce((min: number, bar: MassiveBar) => Math.min(min, bar.l), activeBars[0].l)
        if (entry.direction === 'short') {
          mfePercent = ((ep - lowestLow) / ep) * 100
          maePercent = ((highestHigh - ep) / ep) * 100
        } else {
          mfePercent = ((highestHigh - ep) / ep) * 100
          maePercent = ((ep - lowestLow) / ep) * 100
        }
      }

      if (exitTimestamp >= entryTimestamp) {
        holdDurationMin = Math.max(0, Math.round((exitTimestamp - entryTimestamp) / (1000 * 60)))
      }

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

      if (dailyBars.length > 0) {
        let atr14 = 0
        if (dailyBars.length >= 15) {
          const trs = dailyBars.slice(-15).map((d: MassiveBar, i: number, arr: MassiveBar[]) => {
            if (i === 0) return d.h - d.l
            const prevClose = arr[i - 1].c
            return Math.max(d.h - d.l, Math.abs(d.h - prevClose), Math.abs(d.l - prevClose))
          })
          atr14 = trs.slice(1).reduce((s: number, v: number) => s + v, 0) / 14
        }

        const prevDay = dailyBars.length >= 2 ? dailyBars[dailyBars.length - 2] : null
        const pdh = prevDay?.h || 0
        const pdl = prevDay?.l || 0
        const pdc = prevDay?.c || 0

        const recentDailyBars = dailyBars.slice(-21, -1)
        const avgVolume = recentDailyBars.length > 0
          ? recentDailyBars.reduce((s: number, d: MassiveBar) => s + d.v, 0) / recentDailyBars.length
          : 1
        const todayVolume = dailyBars[dailyBars.length - 1]?.v || 0
        const volumeVsAvg = avgVolume > 0 ? todayVolume / avgVolume : 1

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
        ].filter(level => level.price > 0)

        const nearestEntry = levels.reduce<LevelDistance>((best, level) => {
          const dist = Math.abs(ep - level.price)
          return dist < best.distance ? { ...level, distance: dist / (atr14 || 1) } : best
        }, { name: 'None', price: 0, distance: Infinity })

        const nearestExit = levels.reduce<LevelDistance>((best, level) => {
          const dist = Math.abs(xp - level.price)
          return dist < best.distance ? { ...level, distance: dist / (atr14 || 1) } : best
        }, { name: 'None', price: 0, distance: Infinity })

        const dayHigh = dailyBars[dailyBars.length - 1]?.h || 0
        const dayLow = dailyBars[dailyBars.length - 1]?.l || 0
        const dayClose = dailyBars[dailyBars.length - 1]?.c || 0
        const atrUsed = atr14 > 0 ? (dayHigh - dayLow) / atr14 : 0
        const marketTrend: MarketTrend = dayClose > entryVwap && dayClose > pp
          ? 'bullish'
          : dayClose < entryVwap && dayClose < pp
            ? 'bearish'
            : 'neutral'
        const sessionType: SessionType = atrUsed > 1.2 ? 'trending' : atrUsed < 0.6 ? 'range-bound' : 'volatile'

        marketContext = {
          entryContext: {
            timestamp: new Date(entryTimestamp).toISOString(),
            price: ep,
            vwap: Math.round(entryVwap * 100) / 100,
            atr14: Math.round(atr14 * 100) / 100,
            volumeVsAvg: Math.round(volumeVsAvg * 100) / 100,
            distanceFromPDH: Math.round(Math.abs(ep - pdh) * 100) / 100,
            distanceFromPDL: Math.round(Math.abs(ep - pdl) * 100) / 100,
            nearestLevel: {
              name: nearestEntry.name,
              price: nearestEntry.price,
              distance: Math.round(nearestEntry.distance * 100) / 100,
            },
          },
          exitContext: {
            timestamp: new Date(exitTimestamp).toISOString(),
            price: xp,
            vwap: Math.round(exitVwap * 100) / 100,
            atr14: Math.round(atr14 * 100) / 100,
            volumeVsAvg: Math.round(volumeVsAvg * 100) / 100,
            distanceFromPDH: Math.round(Math.abs(xp - pdh) * 100) / 100,
            distanceFromPDL: Math.round(Math.abs(xp - pdl) * 100) / 100,
            nearestLevel: {
              name: nearestExit.name,
              price: nearestExit.price,
              distance: Math.round(nearestExit.distance * 100) / 100,
            },
          },
          dayContext: {
            marketTrend,
            atrUsed: Math.round(atrUsed * 100) / 100,
            sessionType,
            keyLevelsActive: {
              pdh,
              pdl,
              pdc,
              vwap: Math.round(entryVwap * 100) / 100,
              atr14: Math.round(atr14 * 100) / 100,
              pivotPP: Math.round(pp * 100) / 100,
              pivotR1: Math.round(r1 * 100) / 100,
              pivotS1: Math.round(s1 * 100) / 100,
            },
          },
        }
      } else {
        warnings.push('Daily bars unavailable; returning minute-only enrichment.')
        marketContext = {
          entryContext: {
            timestamp: new Date(entryTimestamp).toISOString(),
            price: ep,
            vwap: Math.round(entryVwap * 100) / 100,
            atr14: 0,
            volumeVsAvg: 0,
            distanceFromPDH: 0,
            distanceFromPDL: 0,
            nearestLevel: { name: 'None', price: 0, distance: 0 },
          },
          exitContext: {
            timestamp: new Date(exitTimestamp).toISOString(),
            price: xp,
            vwap: Math.round(exitVwap * 100) / 100,
            atr14: 0,
            volumeVsAvg: 0,
            distanceFromPDH: 0,
            distanceFromPDL: 0,
            nearestLevel: { name: 'None', price: 0, distance: 0 },
          },
        }
      }
    } else if (dailyBars.length > 0) {
      warnings.push('Minute bars unavailable; skipping intraday verification metrics.')
    } else {
      warnings.push('Massive minute and daily bars unavailable for enrichment.')
    }

    // Generate smart tags from market context
    const smartTags = generateSmartTags(marketContext, entry)

    // Update the entry
    const updateData: EnrichmentUpdateData = {
      enriched_at: new Date().toISOString(),
    }

    if (marketContext.entryContext || marketContext.exitContext || marketContext.dayContext || marketContext.optionsContext) {
      updateData.market_context = marketContext
    }
    if (verification) {
      updateData.verification = verification
    }
    if (smartTags.length > 0) {
      updateData.smart_tags = smartTags
    }
    if (mfePercent != null) {
      updateData.mfe_percent = Math.round(mfePercent * 100) / 100
    }
    if (maePercent != null) {
      updateData.mae_percent = Math.round(maePercent * 100) / 100
    }
    if (holdDurationMin != null) {
      updateData.hold_duration_min = holdDurationMin
    }

    const detectedContract = parseOptionContract(entry.symbol)
    if (detectedContract) {
      if (!entry.contract_type) updateData.contract_type = detectedContract.contractType
      if (!entry.strike_price) updateData.strike_price = detectedContract.strikePrice
      if (!entry.expiration_date) updateData.expiration_date = detectedContract.expirationDate
      if (!entry.dte_at_entry) {
        const dteAtEntry = computeDte(detectedContract.expirationDate, tradeDate)
        if (dteAtEntry != null) updateData.dte_at_entry = dteAtEntry
      }
      if (!entry.dte_at_exit) {
        const dteAtExit = computeDte(detectedContract.expirationDate, tradeDate)
        if (dteAtExit != null) updateData.dte_at_exit = dteAtExit
      }
    }

    const { error: updateError } = await supabase
      .from('journal_entries')
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
        mfe_percent: updateData.mfe_percent ?? null,
        mae_percent: updateData.mae_percent ?? null,
        warnings,
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
function generateSmartTags(context: MarketContext, _entry: JournalEntryForEnrich): string[] {
  if (!context.entryContext) return []
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
  const oc = context.optionsContext
  if (oc) {
    if (oc.ivRankAtEntry >= 70) tags.push('High IV Entry')
    if (oc.ivRankAtEntry <= 20) tags.push('Low IV Entry')
    if (oc.dteAtEntry === 0) tags.push('0-DTE')
    if (oc.dteAtEntry <= 1) tags.push('Same-Day Exp')
    if (oc.ivAtExit < oc.ivAtEntry * 0.8) tags.push('IV Crush')
  }

  return tags
}

function parseOptionContract(symbol: string | null | undefined): {
  contractType: 'call' | 'put'
  strikePrice: number | null
  expirationDate: string | null
} | null {
  if (!symbol || typeof symbol !== 'string') return null

  const occ = symbol.match(/([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})/)
  if (!occ) return null

  const [, , yy, mm, dd, cp, strikeRaw] = occ
  const expirationDate = `20${yy}-${mm}-${dd}`
  const strikePrice = Number(strikeRaw) / 1000

  return {
    contractType: cp === 'C' ? 'call' : 'put',
    strikePrice: Number.isFinite(strikePrice) ? strikePrice : null,
    expirationDate,
  }
}

function computeDte(expirationDate: string | null, tradeDate: string | null): number | null {
  if (!expirationDate || !tradeDate) return null
  const expiry = new Date(`${expirationDate}T00:00:00Z`)
  const trade = new Date(`${tradeDate}T00:00:00Z`)
  if (Number.isNaN(expiry.getTime()) || Number.isNaN(trade.getTime())) return null
  return Math.max(0, Math.ceil((expiry.getTime() - trade.getTime()) / (1000 * 60 * 60 * 24)))
}
