"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDynamicBandTolerance = getDynamicBandTolerance;
exports.detectPatienceCandle = detectPatienceCandle;
const types_1 = require("./types");
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
function getDynamicBandTolerance(price) {
    if (price < 20)
        return 0.05; // Failsafe for very cheap stocks
    if (price <= 80)
        return 0.10;
    if (price <= 100)
        return 0.20;
    if (price <= 300)
        return 0.30;
    if (price <= 500)
        return 0.50;
    if (price <= 2000)
        return 1.00;
    return 2.00;
}
/**
 * Detects whether a given valid candle is a patience candle (hammer/inverted hammer).
 *
 * @param candle The current potential patience candle
 * @param direction "long" for hammer, "short" for inverted hammer
 * @param recentCandles Array of preceding candles (earliest first, latest right before `candle`)
 * @param levelPrice The price of the confluence zone or level to bounce off
 * @param config The threshold configuration object
 */
function detectPatienceCandle(candle, direction, recentCandles, levelPrice, config = types_1.DEFAULT_CONFIG) {
    const range = candle.high - candle.low;
    // Must have a range
    if (range === 0) {
        return { isPatienceCandle: false, reason: 'Zero range candle' };
    }
    const bodyTop = Math.max(candle.open, candle.close);
    const bodyBottom = Math.min(candle.open, candle.close);
    const bodySize = bodyTop - bodyBottom;
    const upperWick = candle.high - bodyTop;
    const lowerWick = bodyBottom - candle.low;
    const bodyToRangeRatio = bodySize / range;
    const lowerWickRatio = lowerWick / range;
    const upperWickRatio = upperWick / range;
    const bandTolerance = getDynamicBandTolerance(candle.close);
    let dominantWickRatio = 0;
    let opposingWickRatio = 0;
    let isAtLevel = false;
    if (direction === 'long') {
        // Hammer logic
        dominantWickRatio = lowerWickRatio;
        opposingWickRatio = upperWickRatio;
        // For hammer, the candle low should be within the band tolerance of the level
        // That implies the level is near the bottom of the candle (acting as support)
        // Absolute difference between candle low and the level price
        isAtLevel = Math.abs(candle.low - levelPrice) <= bandTolerance;
    }
    else {
        // Inverted hammer logic
        dominantWickRatio = upperWickRatio;
        opposingWickRatio = lowerWickRatio;
        // For inverted hammer, the candle high should be within the band tolerance of the level
        // That implies the level is near the top of the candle (acting as resistance)
        // Absolute difference between candle high and the level price
        isAtLevel = Math.abs(candle.high - levelPrice) <= bandTolerance;
    }
    // Calculate volume ratio
    let volumeRatio = 1;
    if (recentCandles.length > 0) {
        const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
        if (avgVolume > 0) {
            volumeRatio = candle.volume / avgVolume;
        }
    }
    // Calculate relative range ratio using up to the last 5 candles
    let relativeRangeRatio = 1;
    const periodForRange = recentCandles.slice(-5);
    if (periodForRange.length > 0) {
        const avgRange = periodForRange.reduce((sum, c) => sum + (c.high - c.low), 0) / periodForRange.length;
        if (avgRange > 0) {
            relativeRangeRatio = range / avgRange;
        }
    }
    // Apply validations based on config
    if (bodyToRangeRatio > config.maxBodyToRangeRatio) {
        return { isPatienceCandle: false, reason: 'Body too large compared to range' };
    }
    if (dominantWickRatio < config.minDominantWickRatio) {
        return { isPatienceCandle: false, reason: 'Dominant wick too short' };
    }
    if (opposingWickRatio > config.maxOpposingWickRatio) {
        return { isPatienceCandle: false, reason: 'Opposing wick too long' };
    }
    if (volumeRatio < config.minVolumeRatio) {
        return { isPatienceCandle: false, reason: 'Volume too low (ghost candle)' };
    }
    if (!isAtLevel) {
        return { isPatienceCandle: false, reason: 'Not at key level' };
    }
    if (relativeRangeRatio > config.maxRelativeRangeRatio) {
        return { isPatienceCandle: false, reason: 'Candle range too large relative to recent candles' };
    }
    // Trend Validation (Basic Structure)
    if (recentCandles.length >= config.minPrecedingTrendBars) {
        // Simplified trend check: The last N candles should exhibit a general directional move
        // leading INTO the patience candle level.
        // For long (hammer), we expect a pullback down to support:
        // So price should have generally been dropping or the highest high over the last N 
        // should be significantly above the current level.
        // Conversely, we check if the trend direction matches.
        // For V1 precision, let's keep it simple: at least some move into the level.
        const lastNCandles = recentCandles.slice(-config.minPrecedingTrendBars);
        if (direction === 'long') {
            // Pullback context: The start of the trend bars should be higher than recent low
            const startHigh = lastNCandles[0].high;
            if (startHigh <= candle.low) {
                // Doesn't look like a pullback
                // return { isPatienceCandle: false, reason: 'No preceding downtrend/pullback found' }
            }
        }
        else {
            const startLow = lastNCandles[0].low;
            if (startLow >= candle.high) {
                // Doesn't look like a rally into resistance
                // return { isPatienceCandle: false, reason: 'No preceding uptrend/rally found' }
            }
        }
    }
    return {
        isPatienceCandle: true,
        pattern: direction === 'long' ? 'hammer' : 'inverted_hammer',
        bodyToRangeRatio,
        dominantWickRatio,
        opposingWickRatio,
        volumeRatio,
        relativeRangeRatio
    };
}
//# sourceMappingURL=patience-candle-detector.js.map