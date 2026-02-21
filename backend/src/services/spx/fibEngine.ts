import { cacheGet, cacheSet } from '../../config/redis';
import { getDailyAggregates, getMinuteAggregates } from '../../config/massive';
import { logger } from '../../lib/logger';
import type { BasisState, FibLevel } from './types';
import { CLUSTER_RADIUS_POINTS, nowIso, round } from './utils';
import { getBasisState } from './crossReference';

const FIB_CACHE_KEY = 'spx_command_center:fib_levels';
const FIB_CACHE_TTL_SECONDS = 30;
const fibInFlightByKey = new Map<string, Promise<FibLevel[]>>();

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

function normalizeAsOfDate(input: string | undefined): string {
  if (!input) return new Date().toISOString().slice(0, 10);
  const normalized = input.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date().toISOString().slice(0, 10);
  }
  return normalized;
}

function dateAtNoonUtc(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function getDateOffset(days: number, asOfDate: string): string {
  const anchor = dateAtNoonUtc(asOfDate);
  const d = new Date(anchor.getTime() - days * 86400000);
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

async function computeFibSet(input: {
  symbol: 'SPX' | 'SPY';
  asOfDate: string;
}): Promise<FibLevel[]> {
  const { symbol, asOfDate } = input;
  const ticker = symbol === 'SPX' ? 'I:SPX' : 'SPY';

  const [daily30, daily90, intraday] = await Promise.all([
    getDailyAggregates(ticker, getDateOffset(40, asOfDate), getDateOffset(0, asOfDate)).then(toBars),
    getDailyAggregates(ticker, getDateOffset(180, asOfDate), getDateOffset(0, asOfDate)).then(toBars),
    getMinuteAggregates(ticker, asOfDate).then(toBars),
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
  basisCurrent?: number;
  asOfDate?: string;
}): Promise<FibLevel[]> {
  const forceRefresh = options?.forceRefresh === true;
  const asOfDate = normalizeAsOfDate(options?.asOfDate);
  const cacheKey = `${FIB_CACHE_KEY}:${asOfDate}`;
  const hasPrecomputedBasis = Boolean(options?.basisState)
    || (typeof options?.basisCurrent === 'number' && Number.isFinite(options.basisCurrent));
  if (!forceRefresh) {
    const existingInFlight = fibInFlightByKey.get(cacheKey);
    if (existingInFlight) {
      return existingInFlight;
    }
  }

  const run = async (): Promise<FibLevel[]> => {
    if (!forceRefresh && !hasPrecomputedBasis) {
      const cached = await cacheGet<FibLevel[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const [basisCurrent, spxLevels, spyLevels] = await Promise.all([
      typeof options?.basisCurrent === 'number' && Number.isFinite(options.basisCurrent)
        ? Promise.resolve(options.basisCurrent)
        : options?.basisState
          ? Promise.resolve(options.basisState.current)
          : getBasisState({ forceRefresh }).then((state) => state.current),
      computeFibSet({ symbol: 'SPX', asOfDate }),
      computeFibSet({ symbol: 'SPY', asOfDate }),
    ]);

    const merged = markCrossValidatedBySPY(spxLevels, spyLevels, basisCurrent)
      .sort((a, b) => a.price - b.price);

    await cacheSet(cacheKey, merged, FIB_CACHE_TTL_SECONDS);

    logger.info('SPX fibonacci levels updated', {
      asOfDate,
      count: merged.length,
      crossValidatedCount: merged.filter((item) => item.crossValidated).length,
      timestamp: nowIso(),
    });

    return merged;
  };

  if (forceRefresh) return run();

  const inFlight = run();
  fibInFlightByKey.set(cacheKey, inFlight);
  try {
    return await inFlight;
  } finally {
    fibInFlightByKey.delete(cacheKey);
  }
}
