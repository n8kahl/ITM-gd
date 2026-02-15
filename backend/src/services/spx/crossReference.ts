import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import type { BasisState } from './types';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { ema, nowIso, round, zscore } from './utils';

const BASIS_CACHE_KEY = 'spx_command_center:basis';
const BASIS_CACHE_TTL_SECONDS = 5;
const basisHistory: number[] = [];

function updateHistory(nextBasis: number): number[] {
  basisHistory.push(nextBasis);
  while (basisHistory.length > 120) {
    basisHistory.shift();
  }
  return [...basisHistory];
}

export function convertSpyPriceToSpx(spyPrice: number, basis: number): number {
  return round(spyPrice * 10 + basis, 2);
}

export function convertSpxPriceToSpy(spxPrice: number, basis: number): number {
  return round((spxPrice - basis) / 10, 2);
}

export async function getBasisState(options?: { forceRefresh?: boolean }): Promise<BasisState> {
  const forceRefresh = options?.forceRefresh === true;

  if (!forceRefresh) {
    const cached = await cacheGet<BasisState>(BASIS_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const gex = await computeUnifiedGEXLandscape({ forceRefresh });
  const spxPrice = gex.spx.spotPrice;
  const spyPrice = gex.spy.spotPrice;

  const current = round(spxPrice - spyPrice * 10, 2);
  const history = updateHistory(current);

  const ema5 = round(ema(history.slice(-5), Math.min(5, history.length)), 2);
  const ema20 = round(ema(history.slice(-20), Math.min(20, history.length)), 2);
  const trendDelta = ema5 - ema20;

  const trend: BasisState['trend'] = trendDelta > 0.35
    ? 'expanding'
    : trendDelta < -0.35
      ? 'contracting'
      : 'stable';

  const leading: BasisState['leading'] = current > ema20 + 0.35
    ? 'SPX'
    : current < ema20 - 0.35
      ? 'SPY'
      : 'neutral';

  const state: BasisState = {
    current,
    trend,
    leading,
    ema5,
    ema20,
    zscore: round(zscore(history, current), 2),
    spxPrice,
    spyPrice,
    timestamp: nowIso(),
  };

  await cacheSet(BASIS_CACHE_KEY, state, BASIS_CACHE_TTL_SECONDS);

  logger.info('SPX basis state updated', {
    current: state.current,
    trend: state.trend,
    leading: state.leading,
    zscore: state.zscore,
  });

  return state;
}
