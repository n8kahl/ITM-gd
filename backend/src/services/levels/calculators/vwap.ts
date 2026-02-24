import { logger } from '../../../lib/logger';
import { MassiveAggregate } from '../../../config/massive';
import { MARKET_HOLIDAYS, toEasternTime } from '../../marketHours';

const SESSION_OPEN_MINUTE_ET = 9 * 60 + 30;
const SESSION_REGULAR_CLOSE_MINUTE_ET = 16 * 60;
const SESSION_EARLY_CLOSE_MINUTE_ET = 13 * 60;

export interface RunningVWAP {
  cumulativeTPV: number;
  cumulativeVolume: number;
  value: number;
  variance: number;
  lastPrice: number;
  lastUpdatedMs: number;
  sessionDate: string;
}

const runningVWAPBySymbol = new Map<string, RunningVWAP>();

function regularSessionCloseMinute(dateStr: string): number {
  return MARKET_HOLIDAYS[dateStr] === 'early'
    ? SESSION_EARLY_CLOSE_MINUTE_ET
    : SESSION_REGULAR_CLOSE_MINUTE_ET;
}

function isRegularSessionTimestamp(timestampMs: number): { regular: boolean; dateStr: string } {
  const et = toEasternTime(new Date(timestampMs));
  const minuteOfDay = (et.hour * 60) + et.minute;
  const closeMinute = regularSessionCloseMinute(et.dateStr);
  const regular = minuteOfDay >= SESSION_OPEN_MINUTE_ET && minuteOfDay <= closeMinute;
  return { regular, dateStr: et.dateStr };
}

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

export interface VWAPBandSet {
  vwap: number;
  band1SD: {
    upper: number;
    lower: number;
  };
  band15SD: {
    upper: number;
    lower: number;
  };
  band2SD: {
    upper: number;
    lower: number;
  };
}

/**
 * Calculate commonly used VWAP standard deviation bands in one payload.
 */
export function calculateVWAPBandSet(intradayData: MassiveAggregate[]): VWAPBandSet | null {
  const band1SD = calculateVWAPBands(intradayData, 1);
  const band15SD = calculateVWAPBands(intradayData, 1.5);
  const band2SD = calculateVWAPBands(intradayData, 2);

  if (!band1SD || !band15SD || !band2SD) return null;

  return {
    vwap: band1SD.vwap,
    band1SD: {
      upper: band1SD.upperBand,
      lower: band1SD.lowerBand,
    },
    band15SD: {
      upper: band15SD.upperBand,
      lower: band15SD.lowerBand,
    },
    band2SD: {
      upper: band2SD.upperBand,
      lower: band2SD.lowerBand,
    },
  };
}

export function updateVWAP(
  running: RunningVWAP | null,
  tick: { price: number; volume: number; timestampMs: number; sessionDate: string },
): RunningVWAP | null {
  if (!Number.isFinite(tick.price) || tick.price <= 0) return running;
  if (!Number.isFinite(tick.volume) || tick.volume <= 0) return running;
  if (!Number.isFinite(tick.timestampMs) || tick.timestampMs <= 0) return running;

  const base: RunningVWAP = running ?? {
    cumulativeTPV: 0,
    cumulativeVolume: 0,
    value: tick.price,
    variance: 0,
    lastPrice: tick.price,
    lastUpdatedMs: tick.timestampMs,
    sessionDate: tick.sessionDate,
  };

  const newTPV = base.cumulativeTPV + (tick.price * tick.volume);
  const newVolume = base.cumulativeVolume + tick.volume;
  const newVWAP = newVolume > 0 ? newTPV / newVolume : tick.price;
  const newVariance = (
    base.variance
    + (tick.volume * (tick.price - base.value) * (tick.price - newVWAP))
  );

  return {
    cumulativeTPV: newTPV,
    cumulativeVolume: newVolume,
    value: Number(newVWAP.toFixed(4)),
    variance: Number(Math.max(0, newVariance).toFixed(8)),
    lastPrice: tick.price,
    lastUpdatedMs: tick.timestampMs,
    sessionDate: tick.sessionDate,
  };
}

export function updateRunningVWAPForSymbol(
  symbol: string,
  tick: { price: number; volume: number; timestampMs: number },
): RunningVWAP | null {
  const normalizedSymbol = symbol.toUpperCase();
  const session = isRegularSessionTimestamp(tick.timestampMs);

  if (!session.regular) {
    runningVWAPBySymbol.delete(normalizedSymbol);
    return null;
  }

  const existing = runningVWAPBySymbol.get(normalizedSymbol);
  const carryForward = existing && existing.sessionDate === session.dateStr
    ? existing
    : null;
  const updated = updateVWAP(carryForward, {
    ...tick,
    sessionDate: session.dateStr,
  });
  if (!updated) return null;
  runningVWAPBySymbol.set(normalizedSymbol, updated);
  return updated;
}

export function getRunningVWAP(symbol: string): RunningVWAP | null {
  return runningVWAPBySymbol.get(symbol.toUpperCase()) ?? null;
}

export function resetRunningVWAP(symbol?: string): void {
  if (symbol) {
    runningVWAPBySymbol.delete(symbol.toUpperCase());
    return;
  }
  runningVWAPBySymbol.clear();
}

export function getRunningVWAPBandSet(symbol: string): VWAPBandSet | null {
  const running = getRunningVWAP(symbol);
  if (!running || running.cumulativeVolume <= 0) return null;

  const variance = Math.max(0, running.variance / running.cumulativeVolume);
  const stdDev = Math.sqrt(variance);
  const vwap = Number(running.value.toFixed(2));
  const band = (stdScale: number) => ({
    upper: Number((vwap + (stdDev * stdScale)).toFixed(2)),
    lower: Number((vwap - (stdDev * stdScale)).toFixed(2)),
  });

  return {
    vwap,
    band1SD: band(1),
    band15SD: band(1.5),
    band2SD: band(2),
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
