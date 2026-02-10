import type { MassiveAggregate } from '../../../config/massive';

/**
 * Fibonacci level values keyed by ratio marker.
 */
export interface FibonacciLevels {
  level_0: number;
  level_236: number;
  level_382: number;
  level_500: number;
  level_618: number;
  level_786: number;
  level_100: number;
}

/**
 * Fibonacci retracement payload for downstream AI and chart consumers.
 */
export interface FibonacciRetracement {
  symbol: string;
  swingHigh: number;
  swingHighIndex: number;
  swingLow: number;
  swingLowIndex: number;
  timeframe: string;
  lookbackBars: number;
  direction: 'retracement' | 'extension';
  levels: FibonacciLevels;
  calculatedAt: string;
}

interface SwingPoints {
  high: number;
  highIndex: number;
  low: number;
  lowIndex: number;
}

/**
 * Round a numeric value to 2 decimal places.
 */
function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Find swing high and swing low inside the requested lookback window.
 *
 * @param bars - Ordered OHLCV bars, oldest first.
 * @param lookback - Number of bars to include from the tail of `bars`.
 * @returns Swing high/low values and original indexes.
 */
function findSwingPoints(bars: MassiveAggregate[], lookback: number): SwingPoints {
  const startIndex = Math.max(0, bars.length - lookback);
  const recentBars = bars.slice(startIndex);

  let highestPrice = Number.NEGATIVE_INFINITY;
  let highestIndex = 0;
  let lowestPrice = Number.POSITIVE_INFINITY;
  let lowestIndex = 0;

  for (let i = 0; i < recentBars.length; i += 1) {
    const bar = recentBars[i];
    if (bar.h > highestPrice) {
      highestPrice = bar.h;
      highestIndex = i;
    }
    if (bar.l < lowestPrice) {
      lowestPrice = bar.l;
      lowestIndex = i;
    }
  }

  return {
    high: highestPrice,
    highIndex: startIndex + highestIndex,
    low: lowestPrice,
    lowIndex: startIndex + lowestIndex,
  };
}

/**
 * Build Fibonacci levels from a swing range and direction.
 *
 * @param direction - Retracement or extension direction.
 * @param high - Swing high price.
 * @param low - Swing low price.
 * @returns Rounded Fibonacci levels.
 */
function buildLevels(
  direction: 'retracement' | 'extension',
  high: number,
  low: number,
): FibonacciLevels {
  const range = high - low;

  const baseLevels: FibonacciLevels = direction === 'retracement'
    ? {
        level_0: high,
        level_236: high - (range * 0.236),
        level_382: high - (range * 0.382),
        level_500: high - (range * 0.5),
        level_618: high - (range * 0.618),
        level_786: high - (range * 0.786),
        level_100: low,
      }
    : {
        level_0: low,
        level_236: low + (range * 0.236),
        level_382: low + (range * 0.382),
        level_500: low + (range * 0.5),
        level_618: low + (range * 0.618),
        level_786: low + (range * 0.786),
        level_100: high,
      };

  return {
    level_0: roundPrice(baseLevels.level_0),
    level_236: roundPrice(baseLevels.level_236),
    level_382: roundPrice(baseLevels.level_382),
    level_500: roundPrice(baseLevels.level_500),
    level_618: roundPrice(baseLevels.level_618),
    level_786: roundPrice(baseLevels.level_786),
    level_100: roundPrice(baseLevels.level_100),
  };
}

/**
 * Calculate Fibonacci retracement or extension levels from market bars.
 *
 * @param symbol - Trading symbol (e.g. SPX, NDX, AAPL).
 * @param bars - Ordered OHLCV bars, oldest first.
 * @param timeframe - Timeframe label for downstream display.
 * @param lookback - Number of tail bars used for swing detection.
 * @returns Full Fibonacci payload with swing metadata.
 * @throws {Error} When fewer than 2 bars are provided.
 */
export function calculateFibonacciRetracement(
  symbol: string,
  bars: MassiveAggregate[],
  timeframe: string = 'daily',
  lookback: number = 20,
): FibonacciRetracement {
  if (bars.length < 2) {
    throw new Error('Insufficient data for Fibonacci calculation (need at least 2 bars)');
  }

  const normalizedLookback = Math.max(2, Math.min(lookback, bars.length));
  const swing = findSwingPoints(bars, normalizedLookback);

  const direction: 'retracement' | 'extension' = swing.highIndex > swing.lowIndex
    ? 'retracement'
    : 'extension';

  const levels = buildLevels(direction, swing.high, swing.low);

  return {
    symbol,
    swingHigh: roundPrice(swing.high),
    swingHighIndex: swing.highIndex,
    swingLow: roundPrice(swing.low),
    swingLowIndex: swing.lowIndex,
    timeframe,
    lookbackBars: normalizedLookback,
    direction,
    levels,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Find the Fibonacci level nearest to current price.
 *
 * @param fib - Calculated Fibonacci structure.
 * @param currentPrice - Current market price.
 * @returns Nearest level name, level price, and signed distance from current.
 */
export function findClosestFibLevel(
  fib: FibonacciRetracement,
  currentPrice: number,
): { level: keyof FibonacciLevels; price: number; distance: number } {
  let closestLevel: keyof FibonacciLevels = 'level_500';
  let closestDistance = Number.POSITIVE_INFINITY;

  const entries = Object.entries(fib.levels) as Array<[keyof FibonacciLevels, number]>;

  for (const [levelName, levelPrice] of entries) {
    const distance = Math.abs(currentPrice - levelPrice);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestLevel = levelName;
    }
  }

  const closestPrice = fib.levels[closestLevel];
  return {
    level: closestLevel,
    price: closestPrice,
    distance: roundPrice(currentPrice - closestPrice),
  };
}

