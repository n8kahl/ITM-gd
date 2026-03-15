export interface CandleBar {
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume: number
}

export type KCUStrategyType =
    | 'KING_AND_QUEEN'
    | 'EMA_BOUNCE'
    | 'VWAP_STRATEGY'
    | 'ADVANCED_VWAP'
    | 'CLOUD_STRATEGY'
    | 'FIB_BOUNCE'
    | 'FIB_REJECT'

export interface PatienceCandleConfig {
    maxBodyToRangeRatio: number      // default: 0.35
    minDominantWickRatio: number     // default: 0.50
    maxOpposingWickRatio: number     // default: 0.15
    minVolumeRatio: number           // default: 0.50
    minPrecedingTrendBars: number    // default: 3
    maxRelativeRangeRatio: number    // default: 0.75
    levelProximityPercent: number    // default: 0.20 (0.20% of price)
}

export const DEFAULT_CONFIG: PatienceCandleConfig = {
    maxBodyToRangeRatio: 0.35,
    minDominantWickRatio: 0.50,
    maxOpposingWickRatio: 0.15,
    minVolumeRatio: 0.50,
    minPrecedingTrendBars: 3,
    maxRelativeRangeRatio: 0.75,
    levelProximityPercent: 0.20,
}

export interface ConfluenceLevel {
    source: string             // "VWAP", "8 EMA", "Hourly 242.50", etc.
    price: number
    weight: number
}

export interface ConfluenceZone {
    priceLow: number
    priceHigh: number
    score: number                // 2.0–5.0
    label: 'moderate' | 'strong' | 'fortress'
    levels: ConfluenceLevel[]
    isKingQueen: boolean         // VWAP present in zone?
}

export interface MoneyMakerIndicatorSnapshot {
    vwap: number | null
    ema8: number | null
    ema21: number | null
    ema34: number | null
    sma200: number | null
}

export interface MoneyMakerHourlyLevelSummary {
    nearestSupport: number | null
    nextSupport: number | null
    nearestResistance: number | null
    nextResistance: number | null
}

export interface MoneyMakerSymbolSnapshot {
    symbol: string
    price: number
    priceChange: number | null
    priceChangePercent: number | null
    orbRegime: 'trending_up' | 'trending_down' | 'choppy'
    strongestConfluence: ConfluenceZone | null
    hourlyLevels?: MoneyMakerHourlyLevelSummary | null
    indicators: MoneyMakerIndicatorSnapshot
    lastCandleAt: number
}

export interface MoneyMakerSignal {
    id: string
    symbol: string
    timestamp: number

    // What strategy?
    strategyType: KCUStrategyType
    strategyLabel: string          // "King & Queen", "EMA Bounce", etc.

    // What's the setup?
    direction: 'long' | 'short'
    patienceCandle: {
        pattern: 'hammer' | 'inverted_hammer'
        bar: CandleBar               // The actual candle
        bodyToRangeRatio: number
        dominantWickRatio: number
        timeframe: '2m' | '5m' | '10m'
    }

    // Where are the levels?
    confluenceZone: ConfluenceZone

    // What's the trade?
    entry: number                  // Break of patience candle in trend direction
    stop: number                   // Other side of patience candle
    target: number                 // Next hourly level
    riskRewardRatio: number        // Must be ≥ 2.0

    // What's the context?
    orbRegime: 'trending_up' | 'trending_down' | 'choppy'
    trendStrength: number          // 0-100 based on preceding trend bars
    signalRank: number             // 1 = best signal across all symbols

    // Lifecycle
    status: 'forming' | 'ready' | 'expired'
    ttlSeconds: number             // Auto-expire after N seconds
    expiresAt: number
}

export type MoneyMakerExecutionState =
    | 'watching'
    | 'armed'
    | 'triggered'
    | 'extended'
    | 'target1_hit'
    | 'target2_in_play'
    | 'failed'
    | 'closed'

export type MoneyMakerEntryQuality = 'ideal' | 'acceptable' | 'late'

export type MoneyMakerTimeWarning = 'normal' | 'late_session' | 'avoid_new_entries'

export interface MoneyMakerExecutionPlan {
    symbol: string
    signalId: string | null
    executionState: MoneyMakerExecutionState
    triggerDistance: number
    triggerDistancePct: number
    entry: number
    stop: number
    target1: number
    target2: number | null
    riskPerShare: number
    rewardToTarget1: number
    rewardToTarget2: number | null
    riskRewardRatio: number
    entryQuality: MoneyMakerEntryQuality
    idealEntryLow: number
    idealEntryHigh: number
    chaseCutoff: number
    timeWarning: MoneyMakerTimeWarning
    invalidationReason: string
    holdWhile: string[]
    reduceWhen: string[]
    exitImmediatelyWhen: string[]
}

export interface MoneyMakerContractCandidate {
    label: 'primary' | 'conservative' | 'lower_cost'
    optionSymbol: string
    expiry: string
    strike: number
    type: 'call' | 'put'
    bid: number
    ask: number
    mid: number
    spreadPct: number
    delta: number | null
    theta: number | null
    impliedVolatility: number | null
    openInterest: number | null
    volume: number | null
    premiumPerContract: number
    dte: number
    quality: 'green' | 'amber'
    explanation: string
}

export interface MoneyMakerWorkspaceResponse {
    symbolSnapshot: MoneyMakerSymbolSnapshot
    activeSignal: MoneyMakerSignal | null
    executionPlan: MoneyMakerExecutionPlan | null
    contracts: MoneyMakerContractCandidate[]
    generatedAt: number
    degradedReason: string | null
}

export interface MoneyMakerSnapshotResult {
    timestamp: number
    signals: MoneyMakerSignal[]
    symbolSnapshots: MoneyMakerSymbolSnapshot[]
}
