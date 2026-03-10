import { fetchAllSymbolData } from './symbolDataFetcher'
import { ConfluenceLevel, MoneyMakerSignal, DEFAULT_CONFIG } from '../../lib/money-maker/types'
import { computeVWAP, computeEMA, computeSMA, computeFibonacciLevels } from '../../lib/money-maker/indicator-computer'
import { determineRegime } from '../../lib/money-maker/orb-calculator'
import { detectPatienceCandle } from '../../lib/money-maker/patience-candle-detector'
import { buildConfluenceZones } from '../../lib/money-maker/confluence-detector'
import { determineStrategy, StrategyRouterContext } from '../../lib/money-maker/kcu-strategy-router'
import { calculateRR } from '../../lib/money-maker/rr-calculator'
import { rankSignals } from '../../lib/money-maker/signal-ranker'
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid'
import { supabase } from '../../config/database'

const SIGNAL_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'

export interface SnapshotResult {
    timestamp: number
    signals: MoneyMakerSignal[]
}

/**
 * Main engine loop (Slice 2.3)
 * Fetches required bars, computes indicators, detects setups, and ranks them.
 */
export async function buildSnapshot(symbols: string[], userId?: string): Promise<SnapshotResult> {
    const signalCandidates: MoneyMakerSignal[] = []

    // 1. Fetch raw data
    const symbolData = await fetchAllSymbolData(symbols)

    for (const symbol of symbols) {
        const data = symbolData[symbol]
        if (!data || !data['5Min'] || data['5Min'].length === 0) continue

        const bars5m = data['5Min']
        const bars1D = data['1D'] || []
        const currentBar = bars5m[bars5m.length - 1]

        // 2. Compute Indicators
        const vwap = computeVWAP(bars5m)
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
        const mappedCandles = bars5m.map((b: any) => ({
            ...b,
            body: Math.abs(b.close - b.open),
            wickUpper: b.high - Math.max(b.close, b.open),
            wickLower: Math.min(b.close, b.open) - b.low,
            isGreen: b.close > b.open
        }))

        const orb = bars5m.length >= 3 ? {
            high: Math.max(...bars5m.slice(0, 3).map((b: any) => b.high)),
            low: Math.min(...bars5m.slice(0, 3).map((b: any) => b.low))
        } : null

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

        if (fibLevels) {
            if (fibLevels.fib0382) rawLevels.push({ source: 'Fib 0.382', price: fibLevels.fib0382, weight: 1.1 })
            if (fibLevels.fib0500) rawLevels.push({ source: 'Fib 0.500', price: fibLevels.fib0500, weight: 1.2 })
            if (fibLevels.fib0618) rawLevels.push({ source: 'Fib 0.618', price: fibLevels.fib0618, weight: 1.3 })
        }

        // Build zones
        const zones = buildConfluenceZones(rawLevels, currentBar.close, '5m')

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
                        const nextLevel = dir === 'long' ? currentBar.close * 1.01 : currentBar.close * 0.99

                        const rr = calculateRR({
                            patienceCandle: currentBar,
                            direction: dir,
                            nextLevel
                        })

                        if (rr.isValid) {
                            const signalId = userId
                                ? uuidv5(`${userId}-${symbol}-${currentBar.timestamp}`, SIGNAL_NAMESPACE)
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
        signals: rankedSignals
    }
}
