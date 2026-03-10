"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeVWAP = computeVWAP;
exports.computeEMA = computeEMA;
exports.computeSMA = computeSMA;
exports.computeFibonacciLevels = computeFibonacciLevels;
/**
 * Computes the Volume Weighted Average Price (VWAP) for an array of intraday bars.
 * Assumes the bars array contains only the current day's bars, ordered chronically.
 */
function computeVWAP(bars) {
    if (bars.length === 0)
        return 0;
    let cumulativePV = 0;
    let cumulativeV = 0;
    for (const bar of bars) {
        const typicalPrice = (bar.high + bar.low + bar.close) / 3;
        cumulativePV += typicalPrice * bar.volume;
        cumulativeV += bar.volume;
    }
    return cumulativeV === 0 ? 0 : cumulativePV / cumulativeV;
}
/**
 * Computes the Exponential Moving Average (EMA) of the close prices.
 * Returns the latest EMA value.
 */
function computeEMA(bars, period) {
    if (bars.length === 0)
        return 0;
    const k = 2 / (period + 1);
    let ema = bars[0].close; // Initialize with the first close price
    for (let i = 1; i < bars.length; i++) {
        ema = (bars[i].close - ema) * k + ema;
    }
    return ema;
}
/**
 * Computes the Simple Moving Average (SMA) of the close prices for the latest N periods.
 */
function computeSMA(bars, period) {
    if (bars.length < period)
        return 0;
    const recentBars = bars.slice(-period);
    const sum = recentBars.reduce((acc, bar) => acc + bar.close, 0);
    return sum / period;
}
/**
 * Computes the key Fibonacci retracement levels (0.236 and 0.382)
 * given the high and low of the previous day.
 */
function computeFibonacciLevels(prevDayHigh, prevDayLow) {
    const range = prevDayHigh - prevDayLow;
    return {
        // Retracements from the high (applicable after an uptrend day)
        retracementFromHigh236: prevDayHigh - range * 0.236,
        retracementFromHigh382: prevDayHigh - range * 0.382,
        // Retracements from the low (applicable after a downtrend day)
        retracementFromLow236: prevDayLow + range * 0.236,
        retracementFromLow382: prevDayLow + range * 0.382,
    };
}
//# sourceMappingURL=indicator-computer.js.map