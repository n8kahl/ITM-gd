import { logger } from '../../../lib/logger';
import { MassiveAggregate } from '../../../config/massive';

/**
 * Calculate VWAP (Volume Weighted Average Price)
 *
 * Formula:
 * VWAP = Σ(Price × Volume) / Σ(Volume)
 *
 * Where Price is typically the average of high, low, and close (HLC/3) or just close
 * Cumulative from market open (9:30 AM ET) to current time
 */
export function calculateVWAP(intradayData: MassiveAggregate[]): number | null {
  if (intradayData.length === 0) {
    logger.info('No intraday data available for VWAP calculation');
    return null;
  }

  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  for (const candle of intradayData) {
    // Use typical price (average of high, low, close)
    const typicalPrice = (candle.h + candle.l + candle.c) / 3;

    // Use volume-weighted price if available, otherwise use typical price
    const price = candle.vw || typicalPrice;
    const volume = candle.v || 0;

    cumulativePriceVolume += price * volume;
    cumulativeVolume += volume;
  }

  if (cumulativeVolume === 0) {
    logger.warn('Total volume is zero, cannot calculate VWAP');
    return null;
  }

  const vwap = cumulativePriceVolume / cumulativeVolume;
  return Number(vwap.toFixed(2));
}

/**
 * Calculate anchored VWAP from a specific start time
 * Useful for calculating VWAP from significant events (e.g., market open, key level break)
 */
export function calculateAnchoredVWAP(
  intradayData: MassiveAggregate[],
  anchorTimestamp: number
): number | null {
  // Filter data from anchor point onwards
  const anchoredData = intradayData.filter(candle => candle.t >= anchorTimestamp);

  return calculateVWAP(anchoredData);
}

/**
 * Calculate VWAP bands (standard deviation bands around VWAP)
 * Useful for identifying overbought/oversold conditions
 */
export function calculateVWAPBands(
  intradayData: MassiveAggregate[],
  numStdDevs: number = 2
): {
  vwap: number;
  upperBand: number;
  lowerBand: number;
} | null {
  const vwap = calculateVWAP(intradayData);

  if (vwap === null) {
    return null;
  }

  // Calculate standard deviation
  let sumSquaredDiff = 0;
  let totalVolume = 0;

  for (const candle of intradayData) {
    const typicalPrice = (candle.h + candle.l + candle.c) / 3;
    const price = candle.vw || typicalPrice;
    const volume = candle.v || 0;

    sumSquaredDiff += Math.pow(price - vwap, 2) * volume;
    totalVolume += volume;
  }

  const variance = sumSquaredDiff / totalVolume;
  const stdDev = Math.sqrt(variance);

  return {
    vwap,
    upperBand: Number((vwap + numStdDevs * stdDev).toFixed(2)),
    lowerBand: Number((vwap - numStdDevs * stdDev).toFixed(2))
  };
}

/**
 * Analyze price position relative to VWAP
 */
export function analyzeVWAPPosition(
  currentPrice: number,
  vwap: number | null
): {
  aboveVWAP: boolean;
  belowVWAP: boolean;
  distance: number;
  distancePct: number;
} {
  if (vwap === null) {
    return {
      aboveVWAP: false,
      belowVWAP: false,
      distance: 0,
      distancePct: 0
    };
  }

  const distance = currentPrice - vwap;
  const distancePct = (distance / vwap) * 100;

  return {
    aboveVWAP: currentPrice > vwap,
    belowVWAP: currentPrice < vwap,
    distance: Number(distance.toFixed(2)),
    distancePct: Number(distancePct.toFixed(2))
  };
}
