export interface CandleBar {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export type KCUStrategyType = 'KING_AND_QUEEN' | 'EMA_BOUNCE' | 'VWAP_STRATEGY' | 'ADVANCED_VWAP' | 'CLOUD_STRATEGY' | 'FIB_BOUNCE' | 'FIB_REJECT';
export interface PatienceCandleConfig {
    maxBodyToRangeRatio: number;
    minDominantWickRatio: number;
    maxOpposingWickRatio: number;
    minVolumeRatio: number;
    minPrecedingTrendBars: number;
    maxRelativeRangeRatio: number;
    levelProximityPercent: number;
}
export declare const DEFAULT_CONFIG: PatienceCandleConfig;
export interface ConfluenceLevel {
    source: string;
    price: number;
    weight: number;
}
export interface ConfluenceZone {
    priceLow: number;
    priceHigh: number;
    score: number;
    label: 'moderate' | 'strong' | 'fortress';
    levels: ConfluenceLevel[];
    isKingQueen: boolean;
}
export interface MoneyMakerSignal {
    id: string;
    symbol: string;
    timestamp: number;
    strategyType: KCUStrategyType;
    strategyLabel: string;
    direction: 'long' | 'short';
    patienceCandle: {
        pattern: 'hammer' | 'inverted_hammer';
        bar: CandleBar;
        bodyToRangeRatio: number;
        dominantWickRatio: number;
        timeframe: '2m' | '5m' | '10m';
    };
    confluenceZone: ConfluenceZone;
    entry: number;
    stop: number;
    target: number;
    riskRewardRatio: number;
    orbRegime: 'trending_up' | 'trending_down' | 'choppy';
    trendStrength: number;
    signalRank: number;
    status: 'forming' | 'ready' | 'expired';
    ttlSeconds: number;
    expiresAt: number;
}
//# sourceMappingURL=types.d.ts.map