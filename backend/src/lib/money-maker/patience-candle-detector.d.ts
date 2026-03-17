import { CandleBar, PatienceCandleConfig } from './types';
export interface PatienceLevelZone {
    priceLow: number;
    priceHigh: number;
}
export interface PatienceCandleResult {
    isPatienceCandle: boolean;
    pattern?: 'hammer' | 'inverted_hammer';
    bodyToRangeRatio?: number;
    dominantWickRatio?: number;
    opposingWickRatio?: number;
    volumeRatio?: number;
    relativeRangeRatio?: number;
    reason?: string;
}
/**
 * Calculates a dynamic band tolerance based on stock price.
 * From spec section 4.3:
 * $20–$80: ±$0.10
 * $80–$100: ±$0.20
 * $100–$300: ±$0.30
 * $300–$500: ±$0.50
 * $500–$2,000: ±$1.00
 * $2,000+ (SPX): ±$2.00
 */
export declare function getDynamicBandTolerance(price: number): number;
/**
 * Detects whether a given valid candle is a patience candle (hammer/inverted hammer).
 *
 * @param candle The current potential patience candle
 * @param direction "long" for hammer, "short" for inverted hammer
 * @param recentCandles Array of preceding candles (earliest first, latest right before `candle`)
 * @param levelPrice The price of the confluence zone or level to bounce off
 * @param config The threshold configuration object
 */
export declare function detectPatienceCandle(candle: CandleBar, direction: 'long' | 'short', recentCandles: CandleBar[], levelReference: number | PatienceLevelZone, config?: PatienceCandleConfig): PatienceCandleResult;
//# sourceMappingURL=patience-candle-detector.d.ts.map
