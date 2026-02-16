import { cacheGet, cacheSet } from '../../config/redis';
import { getDailyAggregates, getMinuteAggregates } from '../../config/massive';
import { logger } from '../../lib/logger';
import type { BasisState, FibLevel } from './types';
import { CLUSTER_RADIUS_POINTS, nowIso, round } from './utils';
import { getBasisState } from './crossReference';

const FIB_CACHE_KEY = 'spx_command_center:fib_levels';
const FIB_CACHE_TTL_SECONDS = 30;
let fibInFlight: Promise<FibLevel[]> | null = null;

interface AggregateBar {
  o: number;
  h: number;
  l: number;
  c: number;
  t: number;
}

interface SwingRange {
  swingHigh: number;
  swingLow: number;
  trendUp: boolean;
}

function getDateOffset(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

function toBars(data: unknown): AggregateBar[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => row as Record<string, unknown>)
    .filter((row) => typeof row.h === 'number' && typeof row.l === 'number' && typeof row.c === 'number')
    .map((row) => ({
      o: typeof row.o === 'number' ? row.o : 0,
      h: row.h as number,
      l: row.l as number,
      c: row.c as number,
      t: typeof row.t === 'number' ? row.t : Date.now(),
    }))
    .sort((a, b) => a.t - b.t);
}

function detectSwingRange(bars: AggregateBar[], confirmationBars: number): SwingRange | null {
  if (bars.length < 4) return null;

  const cutoff = Math.max(1, bars.length - confirmationBars);
  const candidates = bars.slice(0, cutoff);
  if (candidates.length < 2) return null;

  const swingHigh = Math.max(...candidates.map((bar) => bar.h));
  const swingLow = Math.min(...candidates.map((bar) => bar.l));

  if (!Number.isFinite(swingHigh) || !Number.isFinite(swingLow) || swingHigh <= swingLow) {
    return null;
  }

  const trendUp = candidates[candidates.length - 1].c >= candidates[0].c;

  return {
    swingHigh,
    swingLow,
    trendUp,
  };
}

function buildFibLevels(
  swing: SwingRange,
  timeframe: FibLevel['timeframe'],
): FibLevel[] {
  const ratios = [0.236, 0.382, 0.5, 0.618, 0.786, 1.272, 1.618, 2, 2.618];
  const range = swing.swingHigh - swing.swingLow;

  return ratios.map((ratio) => {
    const isExtension = ratio > 1;
    let price: number;

    if (swing.trendUp) {
      price = isExtension
        ? swing.swingHigh + range * (ratio - 1)
        : swing.swingHigh - range * ratio;
    } else {
      price = isExtension
        ? swing.swingLow - range * (ratio - 1)
        : swing.swingLow + range * ratio;
    }

    return {
      ratio,
      price: round(price, 2),
      timeframe,
      direction: isExtension ? 'extension' : 'retracement',
      swingHigh: round(swing.swingHigh, 2),
      swingLow: round(swing.swingLow, 2),
      crossValidated: false,
    };
  });
}

function markCrossValidatedBySPY(
  spxLevels: FibLevel[],
  spyLevels: FibLevel[],
  basis: number,
): FibLevel[] {
  return spxLevels.map((spxLevel) => {
    const matched = spyLevels.find((spyLevel) => {
      if (spyLevel.ratio !== spxLevel.ratio || spyLevel.timeframe !== spxLevel.timeframe) {
        return false;
      }

      const spyAsSpx = spyLevel.price * 10 + basis;
      return Math.abs(spyAsSpx - spxLevel.price) <= CLUSTER_RADIUS_POINTS;
    });

    if (!matched) return spxLevel;

    return {
      ...spxLevel,
      crossValidated: true,
    };
  });
}

async function computeFibSet(symbol: 'SPX' | 'SPY'): Promise<FibLevel[]> {
  const ticker = symbol === 'SPX' ? 'I:SPX' : 'SPY';

  const [daily30, daily90, intraday] = await Promise.all([
    getDailyAggregates(ticker, getDateOffset(40), getDateOffset(0)).then(toBars),
    getDailyAggregates(ticker, getDateOffset(180), getDateOffset(0)).then(toBars),
    getMinuteAggregates(ticker, getDateOffset(0)).then(toBars),
  ]);

  const monthlySwing = detectSwingRange(daily90, 3);
  const weeklySwing = detectSwingRange(daily90.slice(-65), 2);
  const dailySwing = detectSwingRange(daily30, 2);
  const intradaySwing = detectSwingRange(intraday, 5);

  const levels: FibLevel[] = [];

  if (monthlySwing) levels.push(...buildFibLevels(monthlySwing, 'monthly'));
  if (weeklySwing) levels.push(...buildFibLevels(weeklySwing, 'weekly'));
  if (dailySwing) levels.push(...buildFibLevels(dailySwing, 'daily'));
  if (intradaySwing) levels.push(...buildFibLevels(intradaySwing, 'intraday'));

  return levels;
}

export async function getFibLevels(options?: {
  forceRefresh?: boolean;
  basisState?: BasisState;
}): Promise<FibLevel[]> {
  const forceRefresh = options?.forceRefresh === true;
  const hasPrecomputedBasis = Boolean(options?.basisState);
  if (!forceRefresh && fibInFlight) {
    return fibInFlight;
  }

  const run = async (): Promise<FibLevel[]> => {
    if (!forceRefresh && !hasPrecomputedBasis) {
      const cached = await cacheGet<FibLevel[]>(FIB_CACHE_KEY);
      if (cached) {
        return cached;
      }
    }

    const [basis, spxLevels, spyLevels] = await Promise.all([
      options?.basisState
        ? Promise.resolve(options.basisState)
        : getBasisState({ forceRefresh }),
      computeFibSet('SPX'),
      computeFibSet('SPY'),
    ]);

    const merged = markCrossValidatedBySPY(spxLevels, spyLevels, basis.current)
      .sort((a, b) => a.price - b.price);

    await cacheSet(FIB_CACHE_KEY, merged, FIB_CACHE_TTL_SECONDS);

    logger.info('SPX fibonacci levels updated', {
      count: merged.length,
      crossValidatedCount: merged.filter((item) => item.crossValidated).length,
      timestamp: nowIso(),
    });

    return merged;
  };

  if (forceRefresh) {
    return run();
  }

  fibInFlight = run();
  try {
    return await fibInFlight;
  } finally {
    fibInFlight = null;
  }
}
