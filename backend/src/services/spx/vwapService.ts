import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';

/**
 * S9: VWAP calculation service using 1-minute bars with volume.
 * Computes VWAP for the current session, deviation bands, and provides
 * directional filtering signals.
 */

interface MinuteBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface VWAPState {
  vwap: number;
  upperBand1SD: number;
  lowerBand1SD: number;
  upperBand2SD: number;
  lowerBand2SD: number;
  priceRelativeToVWAP: 'above' | 'below' | 'at';
  deviationFromVWAP: number;
  deviationBands: number;
  isReliable: boolean;
  barCount: number;
  lastUpdated: string;
}

// Grace period: VWAP not reliable before 10:00 AM ET (only 30 bars)
const VWAP_GRACE_MINUTE_ET = 10 * 60; // 10:00 AM ET = 600 minutes
const VWAP_STALE_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_OPEN_MINUTE_ET = 9 * 60 + 30;

let cachedVWAP: VWAPState | null = null;
let cachedVWAPTimestamp = 0;

/**
 * Compute VWAP from an array of minute bars.
 */
export function computeVWAP(bars: MinuteBar[]): VWAPState | null {
  if (!bars || bars.length === 0) {
    return null;
  }

  let cumulativeTPV = 0; // typical price * volume
  let cumulativeVolume = 0;
  let cumulativeTPVSquared = 0;

  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    const tpv = typicalPrice * bar.volume;
    cumulativeTPV += tpv;
    cumulativeVolume += bar.volume;
    cumulativeTPVSquared += typicalPrice * typicalPrice * bar.volume;
  }

  if (cumulativeVolume === 0) return null;

  const vwap = cumulativeTPV / cumulativeVolume;
  const varianceNumerator = (cumulativeTPVSquared / cumulativeVolume) - (vwap * vwap);
  const stdDev = Math.sqrt(Math.max(0, varianceNumerator));

  const lastBar = bars[bars.length - 1];
  const currentPrice = lastBar.close;
  const deviationFromVWAP = currentPrice - vwap;
  const deviationBands = stdDev > 0 ? deviationFromVWAP / stdDev : 0;

  const now = toEasternTime(new Date());
  const currentMinuteET = now.hour * 60 + now.minute;
  const isReliable = currentMinuteET >= VWAP_GRACE_MINUTE_ET && bars.length >= 15;

  const priceRelativeToVWAP: 'above' | 'below' | 'at' =
    deviationFromVWAP > 0.5 ? 'above' : deviationFromVWAP < -0.5 ? 'below' : 'at';

  return {
    vwap: Number(vwap.toFixed(2)),
    upperBand1SD: Number((vwap + stdDev).toFixed(2)),
    lowerBand1SD: Number((vwap - stdDev).toFixed(2)),
    upperBand2SD: Number((vwap + 2 * stdDev).toFixed(2)),
    lowerBand2SD: Number((vwap - 2 * stdDev).toFixed(2)),
    priceRelativeToVWAP,
    deviationFromVWAP: Number(deviationFromVWAP.toFixed(2)),
    deviationBands: Number(deviationBands.toFixed(2)),
    isReliable,
    barCount: bars.length,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Check if the current VWAP alignment supports a directional setup.
 * Returns a confluence bonus (0 or +1) and whether the setup should be filtered.
 */
export function evaluateVWAPAlignment(
  vwapState: VWAPState | null,
  direction: 'bullish' | 'bearish',
): {
  aligned: boolean;
  filtered: boolean;
  confluenceBonus: number;
  reason: string | null;
} {
  // Fail open: no VWAP data -> don't filter
  if (!vwapState) {
    return { aligned: true, filtered: false, confluenceBonus: 0, reason: null };
  }

  // Grace period: VWAP not reliable yet
  if (!vwapState.isReliable) {
    return { aligned: true, filtered: false, confluenceBonus: 0, reason: 'vwap_grace_period' };
  }

  // Stale check
  const age = Date.now() - new Date(vwapState.lastUpdated).getTime();
  if (age > VWAP_STALE_MS) {
    return { aligned: true, filtered: false, confluenceBonus: 0, reason: 'vwap_stale' };
  }

  // Directional filter
  const aligned = direction === 'bullish'
    ? vwapState.priceRelativeToVWAP === 'above' || vwapState.priceRelativeToVWAP === 'at'
    : vwapState.priceRelativeToVWAP === 'below' || vwapState.priceRelativeToVWAP === 'at';

  // VWAP cross bonus: if within 0.5 SD and aligned direction, +1 confluence
  const nearVWAP = Math.abs(vwapState.deviationBands) <= 0.5;
  const confluenceBonus = aligned && nearVWAP ? 1 : 0;

  // Mean reversion favored when > 1 SD from VWAP
  const meanReversionFavored = Math.abs(vwapState.deviationBands) > 1;

  return {
    aligned,
    filtered: !aligned,
    confluenceBonus,
    reason: aligned ? null : `price_${direction === 'bullish' ? 'below' : 'above'}_vwap`,
  };
}

/**
 * Get or compute cached VWAP state.
 */
export function getCachedVWAP(): VWAPState | null {
  return cachedVWAP;
}

export function setCachedVWAP(state: VWAPState | null): void {
  cachedVWAP = state;
  cachedVWAPTimestamp = Date.now();
}
