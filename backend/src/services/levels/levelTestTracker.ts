import type { MassiveAggregate } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import type { LevelItem } from './index';

const LEVEL_TEST_CACHE_TTL_SECONDS = 5 * 60;
const LEVEL_TEST_TOUCH_TOLERANCE_PCT = 0.0015; // 0.15%

export interface LevelTestEvent {
  timestamp: string;
  price: number;
  result: 'held' | 'broken';
  volume: number;
  barIndex: number;
}

export interface LevelTestHistory {
  level: string;
  levelType: string;
  levelPrice: number;
  side: 'resistance' | 'support';
  testsToday: number;
  tests: LevelTestEvent[];
  holdRate: number;
  lastTest: string | null;
  avgVolumeAtTest: number | null;
}

type SerializedLevelTestEntries = Array<[string, LevelTestHistory]>;

/**
 * Build Redis cache key for level-test snapshots.
 */
function buildCacheKey(cacheKey: string): string {
  return `level_tests:${cacheKey}`;
}

/**
 * Infer level side using explicit side first, then current price position.
 */
function inferSide(level: LevelItem, currentPrice: number): 'resistance' | 'support' {
  if (level.side === 'resistance' || level.side === 'support') {
    return level.side;
  }
  return level.price >= currentPrice ? 'resistance' : 'support';
}

/**
 * Determine whether a candle touched the requested level within tolerance.
 */
function wasLevelTouched(
  bar: MassiveAggregate,
  levelPrice: number,
  side: 'resistance' | 'support',
  tolerance: number,
): boolean {
  if (side === 'resistance') {
    return Math.abs(bar.h - levelPrice) <= tolerance || (bar.h >= levelPrice && bar.l <= levelPrice);
  }
  return Math.abs(bar.l - levelPrice) <= tolerance || (bar.h >= levelPrice && bar.l <= levelPrice);
}

/**
 * Determine if a touched level held or broke based on close location.
 */
function getTouchResult(
  close: number,
  levelPrice: number,
  side: 'resistance' | 'support',
): 'held' | 'broken' {
  if (side === 'resistance') {
    return close < levelPrice ? 'held' : 'broken';
  }
  return close > levelPrice ? 'held' : 'broken';
}

/**
 * Find all qualifying test events for one level.
 *
 * @param level - Level metadata.
 * @param bars - Intraday candles.
 * @param side - Expected market side for the level.
 * @returns Ordered test events for the trading day.
 */
function findLevelTests(
  level: LevelItem,
  bars: MassiveAggregate[],
  side: 'resistance' | 'support',
): LevelTestEvent[] {
  const tests: LevelTestEvent[] = [];
  const tolerance = level.price * LEVEL_TEST_TOUCH_TOLERANCE_PCT;
  let lastTouchIndex = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];
    if (!wasLevelTouched(bar, level.price, side, tolerance)) {
      continue;
    }

    // Debounce adjacent bars so one prolonged test does not over-count.
    if (i - lastTouchIndex <= 1) {
      continue;
    }

    const touchPrice = side === 'resistance' ? bar.h : bar.l;
    tests.push({
      timestamp: new Date(bar.t).toISOString(),
      price: Number(touchPrice.toFixed(2)),
      result: getTouchResult(bar.c, level.price, side),
      volume: bar.v,
      barIndex: i,
    });
    lastTouchIndex = i;
  }

  return tests;
}

/**
 * Convert serialized Redis cache payload to map.
 */
function toMap(entries: SerializedLevelTestEntries): Map<string, LevelTestHistory> {
  return new Map(entries);
}

/**
 * Load cached level tests.
 */
async function readCachedLevelTests(cacheKey: string): Promise<Map<string, LevelTestHistory> | null> {
  try {
    const cached = await cacheGet<SerializedLevelTestEntries>(buildCacheKey(cacheKey));
    if (!cached) return null;
    return toMap(cached);
  } catch (error) {
    logger.warn('Failed to parse cached level tests', {
      cacheKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Store level tests in cache.
 */
async function writeCachedLevelTests(
  cacheKey: string,
  tests: Map<string, LevelTestHistory>,
): Promise<void> {
  try {
    const serialized: SerializedLevelTestEntries = Array.from(tests.entries());
    await cacheSet(buildCacheKey(cacheKey), serialized, LEVEL_TEST_CACHE_TTL_SECONDS);
  } catch (error) {
    logger.warn('Failed to cache level tests', {
      cacheKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Analyze and aggregate test behavior across supplied levels.
 *
 * @param symbol - Symbol being analyzed.
 * @param levels - Candidate support/resistance levels.
 * @param intradayBars - Intraday bars used for touch detection.
 * @param currentPrice - Current market price.
 * @param cacheKey - Cache identifier including symbol/time context.
 * @returns Level-keyed test history map.
 */
export async function analyzeLevelTests(
  symbol: string,
  levels: LevelItem[],
  intradayBars: MassiveAggregate[],
  currentPrice: number,
  cacheKey: string,
): Promise<Map<string, LevelTestHistory>> {
  try {
    const cached = await readCachedLevelTests(cacheKey);
    if (cached) {
      logger.debug('Loaded level tests from cache', { symbol, cacheKey });
      return cached;
    }

    const historyMap = new Map<string, LevelTestHistory>();

    for (const level of levels) {
      const side = inferSide(level, currentPrice);
      const tests = findLevelTests(level, intradayBars, side);

      if (tests.length === 0) {
        continue;
      }

      const heldCount = tests.filter((event) => event.result === 'held').length;
      const holdRate = heldCount / tests.length;
      const averageVolume = tests.reduce((sum, event) => sum + event.volume, 0) / tests.length;
      const levelKey = `${level.type}_${level.price.toFixed(2)}`;

      historyMap.set(levelKey, {
        level: levelKey,
        levelType: level.type,
        levelPrice: level.price,
        side,
        testsToday: tests.length,
        tests,
        holdRate: Number(holdRate.toFixed(4)),
        lastTest: tests[tests.length - 1]?.timestamp || null,
        avgVolumeAtTest: Number.isFinite(averageVolume) ? Number(averageVolume.toFixed(0)) : null,
      });
    }

    await writeCachedLevelTests(cacheKey, historyMap);
    return historyMap;
  } catch (error) {
    logger.warn('Failed to analyze level tests', {
      symbol,
      cacheKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Map<string, LevelTestHistory>();
  }
}

/**
 * Build concise natural-language summary for AI reasoning context.
 */
export function formatLevelTestSummary(history: LevelTestHistory): string {
  if (history.testsToday <= 0) {
    return `${history.levelType} at $${history.levelPrice.toFixed(2)} has not been tested today.`;
  }

  const lastTestTime = history.lastTest
    ? new Date(history.lastTest).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : 'unknown';

  const holdPct = Math.round(history.holdRate * 100);
  const strengthLabel = history.holdRate >= 0.75
    ? 'strong level'
    : history.holdRate >= 0.5
      ? 'moderate level'
      : 'weak level';

  return `${history.levelType} at $${history.levelPrice.toFixed(2)} tested ${history.testsToday}x today (last: ${lastTestTime}). Held ${holdPct}% of tests (${strengthLabel}).`;
}
