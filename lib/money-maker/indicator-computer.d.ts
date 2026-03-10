import { CandleBar } from './types';
/**
 * Computes the Volume Weighted Average Price (VWAP) for an array of intraday bars.
 * Assumes the bars array contains only the current day's bars, ordered chronically.
 */
export declare function computeVWAP(bars: CandleBar[]): number;
/**
 * Computes the Exponential Moving Average (EMA) of the close prices.
 * Returns the latest EMA value.
 */
export declare function computeEMA(bars: CandleBar[], period: number): number;
/**
 * Computes the Simple Moving Average (SMA) of the close prices for the latest N periods.
 */
export declare function computeSMA(bars: CandleBar[], period: number): number;
/**
 * Computes the key Fibonacci retracement levels (0.236 and 0.382)
 * given the high and low of the previous day.
 */
export declare function computeFibonacciLevels(prevDayHigh: number, prevDayLow: number): {
    retracementFromHigh236: number;
    retracementFromHigh382: number;
    retracementFromLow236: number;
    retracementFromLow382: number;
};
//# sourceMappingURL=indicator-computer.d.ts.map