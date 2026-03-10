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
