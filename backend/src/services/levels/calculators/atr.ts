import { logger } from '../../../lib/logger';
import { MassiveAggregate } from '../../../config/massive';

const VOLATILITY_THRESHOLDS: Record<string, { low: number; moderate: number; high: number }> = {
  SPX: { low: 30, moderate: 50, high: 70 },
  NDX: { low: 40, moderate: 70, high: 90 },
  SPY: { low: 3, moderate: 5, high: 7 },
  QQQ: { low: 4, moderate: 7, high: 10 },
};

function getVolatilityThresholds(symbol?: string): { low: number; moderate: number; high: number } {
  if (!symbol) return VOLATILITY_THRESHOLDS.SPX;
  return VOLATILITY_THRESHOLDS[symbol.toUpperCase()] || VOLATILITY_THRESHOLDS.SPX;
}

/**
 * Calculate True Range for a single period
 *
 * True Range = max(High - Low, abs(High - PrevClose), abs(Low - PrevClose))
 */
function calculateTrueRange(current: MassiveAggregate, previous: MassiveAggregate): number {
  const highLow = current.h - current.l;
  const highPrevClose = Math.abs(current.h - previous.c);
  const lowPrevClose = Math.abs(current.l - previous.c);

  return Math.max(highLow, highPrevClose, lowPrevClose);
}

/**
 * Calculate ATR (Average True Range)
 *
 * ATR is the moving average of True Range over N periods
 * Default period is 14 (standard for ATR)
 *
 * Formula:
 * True Range = max(High - Low, abs(High - PrevClose), abs(Low - PrevClose))
 * ATR = N-period moving average of True Range
 */
export function calculateATR(dailyData: MassiveAggregate[], period: number = 14): number | null {
  if (dailyData.length < period + 1) {
    logger.warn(`Insufficient data for ATR(${period}). Need at least ${period + 1} bars, got ${dailyData.length}`);
    return null;
  }

  const trueRanges: number[] = [];

  // Calculate True Range for each period
  for (let i = 1; i < dailyData.length; i++) {
    const tr = calculateTrueRange(dailyData[i], dailyData[i - 1]);
    trueRanges.push(tr);
  }

  // Calculate initial ATR (simple average of first N true ranges)
  let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;

  // Calculate smoothed ATR (using Wilder's smoothing method)
  // ATR = ((Previous ATR * (period - 1)) + Current TR) / period
  for (let i = period; i < trueRanges.length; i++) {
    atr = ((atr * (period - 1)) + trueRanges[i]) / period;
  }

  return Number(atr.toFixed(2));
}

/**
 * Calculate multiple ATR periods
 * Useful for comparing short-term vs long-term volatility
 */
export function calculateMultipleATRs(dailyData: MassiveAggregate[]): {
  atr7: number | null;
  atr14: number | null;
  atr21: number | null;
} {
  return {
    atr7: calculateATR(dailyData, 7),
    atr14: calculateATR(dailyData, 14),
    atr21: calculateATR(dailyData, 21)
  };
}

/**
 * Calculate ATR-based price targets
 * Used for setting stop losses and profit targets
 */
export function calculateATRTargets(
  currentPrice: number,
  atr: number | null,
  multiplier: number = 2
): {
  stopLossLong: number;
  targetLong: number;
  stopLossShort: number;
  targetShort: number;
} | null {
  if (atr === null) {
    return null;
  }

  return {
    stopLossLong: Number((currentPrice - (atr * multiplier)).toFixed(2)),
    targetLong: Number((currentPrice + (atr * multiplier)).toFixed(2)),
    stopLossShort: Number((currentPrice + (atr * multiplier)).toFixed(2)),
    targetShort: Number((currentPrice - (atr * multiplier)).toFixed(2))
  };
}

/**
 * Analyze volatility based on ATR
 * Returns classification of current volatility
 */
export function analyzeVolatility(
  atr14: number | null,
  atr7: number | null,
  symbol: string = 'SPX',
): {
  level: 'low' | 'moderate' | 'high' | 'extreme';
  expanding: boolean;
  contracting: boolean;
} {
  if (atr14 === null) {
    return {
      level: 'moderate',
      expanding: false,
      contracting: false
    };
  }

  const thresholds = getVolatilityThresholds(symbol);

  // Determine volatility level using symbol-aware thresholds.
  let level: 'low' | 'moderate' | 'high' | 'extreme';
  if (atr14 < thresholds.low) {
    level = 'low';
  } else if (atr14 < thresholds.moderate) {
    level = 'moderate';
  } else if (atr14 < thresholds.high) {
    level = 'high';
  } else {
    level = 'extreme';
  }

  // Determine if volatility is expanding or contracting
  let expanding = false;
  let contracting = false;

  if (atr7 !== null) {
    if (atr7 > atr14 * 1.1) {
      expanding = true;
    } else if (atr7 < atr14 * 0.9) {
      contracting = true;
    }
  }

  return {
    level,
    expanding,
    contracting
  };
}
