import { fetchAllSymbolData } from './symbolDataFetcher'
import { ConfluenceLevel, MoneyMakerSignal, MoneyMakerSnapshotResult, MoneyMakerSymbolSnapshot, DEFAULT_CONFIG } from '../../lib/money-maker/types'
import { computeVWAP, computeEMA, computeSMA, computeFibonacciLevels } from '../../lib/money-maker/indicator-computer'
import { computeORB, determineRegime } from '../../lib/money-maker/orb-calculator'
import { detectPatienceCandle } from '../../lib/money-maker/patience-candle-detector'
import { buildConfluenceZones } from '../../lib/money-maker/confluence-detector'
import { determineStrategy, StrategyRouterContext } from '../../lib/money-maker/kcu-strategy-router'
import { calculateRR } from '../../lib/money-maker/rr-calculator'
import { rankSignals } from '../../lib/money-maker/signal-ranker'
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid'
import { supabase } from '../../config/database'
import { toEasternTime } from '../marketHours'

const SIGNAL_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'

function getCurrentSessionBars<T extends { timestamp: number }>(bars: T[]): T[] {
    if (bars.length === 0) return []

    const latestBar = bars[bars.length - 1]
    const latestSession = toEasternTime(new Date(latestBar.timestamp)).dateStr

    return bars.filter((bar) => {
        const et = toEasternTime(new Date(bar.timestamp))
        const minutesFromMidnight = et.hour * 60 + et.minute
        return et.dateStr === latestSession && minutesFromMidnight >= 570 && minutesFromMidnight < 960
    })
}

function buildHourlyLevels(bars: Array<{ high: number; low: number }>): ConfluenceLevel[] {
    const recentBars = bars.slice(-35)

    return recentBars.flatMap((bar) => ([
        { source: `Hourly High ${bar.high.toFixed(2)}`, price: bar.high, weight: 1.4 },
        { source: `Hourly Low ${bar.low.toFixed(2)}`, price: bar.low, weight: 1.4 },
    ]))
}

function selectNextHourlyLevel(
    bars: Array<{ high: number; low: number }>,
    currentPrice: number,
    direction: 'long' | 'short',
): number | null {
    const recentBars = bars.slice(-35)

    if (direction === 'long') {
        const resistanceLevels = recentBars
            .map((bar) => bar.high)
            .filter((price) => price > currentPrice)
            .sort((left, right) => left - right)

        return resistanceLevels[0] ?? null
    }

    const supportLevels = recentBars
        .map((bar) => bar.low)
        .filter((price) => price < currentPrice)
        .sort((left, right) => right - left)

    return supportLevels[0] ?? null
}

/**
 * Main engine loop (Slice 2.3)
 * Fetches required bars, computes indicators, detects setups, and ranks them.
 */
export async function buildSnapshot(symbols: string[], userId?: string): Promise<MoneyMakerSnapshotResult> {
    const signalCandidates: MoneyMakerSignal[] = []
    const symbolSnapshots: MoneyMakerSymbolSnapshot[] = []

    // 1. Fetch raw data
    const symbolData = await fetchAllSymbolData(symbols)

    for (const symbol of symbols) {
        const data = symbolData[symbol]
        if (!data || !data['5Min'] || data['5Min'].length === 0) continue

        const bars5m = data['5Min']
        const sessionBars5m = getCurrentSessionBars(bars5m)
        const bars1D = data['1D'] || []
        const bars1H = data['1H'] || []
        const currentBar = sessionBars5m[sessionBars5m.length - 1] || bars5m[bars5m.length - 1]
        const previousBar = sessionBars5m.length >= 2
            ? sessionBars5m[sessionBars5m.length - 2]
            : bars5m.length >= 2
                ? bars5m[bars5m.length - 2]
                : null

        // 2. Compute Indicators
        const vwap = computeVWAP(sessionBars5m)
        const ema8 = computeEMA(bars5m, 8)
        const ema21 = computeEMA(bars5m, 21)
        const ema34 = computeEMA(bars5m, 34)
        const sma200 = computeSMA(bars5m, 200)

        let fibLevels: Record<string, number> | null = null
        if (bars1D.length >= 2) {
            const prevDay = bars1D[bars1D.length - 2]
            fibLevels = computeFibonacciLevels(prevDay.high, prevDay.low)
        }

        // Regime
        const mappedCandles = sessionBars5m.map((b: any) => ({
            ...b,
            body: Math.abs(b.close - b.open),
            wickUpper: b.high - Math.max(b.close, b.open),
            wickLower: Math.min(b.close, b.open) - b.low,
            isGreen: b.close > b.open
        }))

        const orb = computeORB(sessionBars5m.slice(0, 3))
        const openPrice = sessionBars5m.length > 0 ? sessionBars5m[0].open : null

        const regime = determineRegime(currentBar.close, orb)

        // 3. Patience Candle config
        const pcConfig = { ...DEFAULT_CONFIG }

        // Build raw confluence levels
        const rawLevels: ConfluenceLevel[] = []
        if (vwap !== null) rawLevels.push({ source: 'VWAP', price: vwap, weight: 1.5 })
        if (ema8 !== null) rawLevels.push({ source: '8 EMA', price: ema8, weight: 1.2 })
        if (ema21 !== null) rawLevels.push({ source: '21 EMA', price: ema21, weight: 1.0 })
        if (ema34 !== null) rawLevels.push({ source: '34 EMA', price: ema34, weight: 1.0 })
        if (sma200 !== null) rawLevels.push({ source: '200 SMA', price: sma200, weight: 1.3 })
        if (orb) {
            rawLevels.push({ source: 'ORB High', price: orb.high, weight: 1.2 })
            rawLevels.push({ source: 'ORB Low', price: orb.low, weight: 1.2 })
        }
        if (openPrice !== null) {
            rawLevels.push({ source: 'Open Price', price: openPrice, weight: 1.0 })
        }
        rawLevels.push(...buildHourlyLevels(bars1H))

        if (fibLevels) {
            if (fibLevels.fib0236) rawLevels.push({ source: 'Fib 0.236', price: fibLevels.fib0236, weight: 1.1 })
            if (fibLevels.fib0382) rawLevels.push({ source: 'Fib 0.382', price: fibLevels.fib0382, weight: 1.1 })
        }

        // Build zones
        const zones = buildConfluenceZones(rawLevels, currentBar.close, '5m')
        const strongestConfluence = zones.length > 0
            ? [...zones].sort((left, right) => {
                if (right.score !== left.score) return right.score - left.score
                return right.levels.length - left.levels.length
            })[0]
            : null
        const priceChange = previousBar ? currentBar.close - previousBar.close : null
        const priceChangePercent = previousBar && previousBar.close !== 0
            ? ((currentBar.close - previousBar.close) / previousBar.close) * 100
            : null

        symbolSnapshots.push({
            symbol,
            price: currentBar.close,
            priceChange,
            priceChangePercent,
            orbRegime: regime,
            strongestConfluence,
            indicators: {
                vwap,
                ema8,
                ema21,
                ema34,
                sma200,
            },
            lastCandleAt: currentBar.timestamp,
        })

        // For each zone, check both directions for patience candle
        for (const zone of zones) {
            for (const dir of ['long', 'short'] as ('long' | 'short')[]) {
                const pcDetection = detectPatienceCandle(currentBar, dir, mappedCandles.slice(0, -1), currentBar.close, pcConfig)

                if (pcDetection.isPatienceCandle) {
                    // 4. Route Strategy
                    const routerCtx: StrategyRouterContext = {
                        timestamp: currentBar.timestamp,
                        orbRegime: regime,
                        confluenceZone: zone,
                        direction: dir,
                        isVwapCrossFromBelow: false,
                        isMorningTrend: regime === 'trending_up',
                        isPrevDayTrend: false,
                        isSteepTrend: false
                    }

                    const routing = determineStrategy(routerCtx)

                    if (routing.isValid && routing.strategyType) {
                        // 5. Calculate R:R
                        const nextLevel = selectNextHourlyLevel(bars1H, currentBar.close, dir)
                        if (nextLevel === null) {
                            continue
                        }

                        const rr = calculateRR({
                            patienceCandle: currentBar,
                            direction: dir,
                            nextLevel
                        })

                        if (rr.isValid) {
                            const zoneKey = `${zone.priceLow.toFixed(4)}-${zone.priceHigh.toFixed(4)}-${routing.strategyType}`
                            const signalId = userId
                                ? uuidv5(`${userId}-${symbol}-${currentBar.timestamp}-${dir}-${zoneKey}`, SIGNAL_NAMESPACE)
                                : uuidv4()

                            signalCandidates.push({
                                id: signalId,
                                symbol,
                                timestamp: currentBar.timestamp,
                                strategyType: routing.strategyType,
                                strategyLabel: routing.strategyLabel || routing.strategyType,
                                direction: dir,
                                patienceCandle: {
                                    pattern: pcDetection.pattern as 'hammer' | 'inverted_hammer',
                                    bar: currentBar,
                                    timeframe: '5m',
                                    bodyToRangeRatio: pcDetection.bodyToRangeRatio || 0,
                                    dominantWickRatio: pcDetection.dominantWickRatio || 0
                                },
                                confluenceZone: zone,
                                entry: rr.entry,
                                stop: rr.stop,
                                target: rr.target,
                                riskRewardRatio: rr.riskRewardRatio,
                                orbRegime: regime,
                                trendStrength: 50,
                                signalRank: 0,
                                status: 'ready',
                                ttlSeconds: 300,
                                expiresAt: currentBar.timestamp + 300 * 1000
                            })
                        }
                    }
                }
            }
        }
    }

    // 6. Rank
    const rankedSignals = rankSignals(signalCandidates)

    // 7. DB Logging (Fire and forget)
    if (userId && rankedSignals.length > 0) {
        try {
            const inserts = rankedSignals.map((s: MoneyMakerSignal) => ({
                id: s.id,
                user_id: userId,
                symbol: s.symbol,
                strategy_type: s.strategyType,
                direction: s.direction,
                patience_candle_pattern: s.patienceCandle.pattern,
                patience_candle_timeframe: s.patienceCandle.timeframe,
                confluence_score: s.confluenceZone.score,
                confluence_levels: s.confluenceZone.levels,
                is_king_queen: s.confluenceZone.isKingQueen,
                entry_price: s.entry,
                stop_price: s.stop,
                target_price: s.target,
                risk_reward_ratio: s.riskRewardRatio,
                orb_regime: s.orbRegime,
                signal_rank: s.signalRank,
                status: s.status,
                triggered_at: new Date(s.timestamp).toISOString(),
                expired_at: new Date(s.expiresAt).toISOString()
            }))

            supabase.from('money_maker_signals').upsert(inserts, { onConflict: 'id' }).then(({ error }) => {
                if (error) console.error('[buildSnapshot] Error logging signals to Supabase:', error)
            })
        } catch (e) {
            console.error('[buildSnapshot] Failed to format signals for DB:', e)
        }
    }

    return {
        timestamp: Date.now(),
        signals: rankedSignals,
        symbolSnapshots,
    }
}
