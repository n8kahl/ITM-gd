import { cacheGet, cacheSet } from '../../config/redis';
import { getMinuteAggregates } from '../../config/massive';
import { logger } from '../../lib/logger';
import { calculateLevels } from '../levels';
import type { LevelItem } from '../levels';
import { getBasisState } from './crossReference';
import { getFibLevels } from './fibEngine';
import { computeUnifiedGEXLandscape } from './gexEngine';
import type { BasisState, ClusterZone, FibLevel, LevelCategory, SPXLevel, UnifiedGEXLandscape } from './types';
import {
  CATEGORY_WEIGHT,
  CLUSTER_RADIUS_POINTS,
  classifyZoneType,
  nowIso,
  round,
  stableId,
  uuid,
} from './utils';

const LEVEL_CACHE_KEY = 'spx_command_center:levels';
const LEVEL_CACHE_TTL_SECONDS = 15; // Reduced from 30s to limit compound staleness (Audit #7 HIGH-1)
let levelsInFlight: Promise<{
  levels: SPXLevel[];
  clusters: ClusterZone[];
  generatedAt: string;
}> | null = null;

function toChartStyle(category: LevelCategory): SPXLevel['chartStyle'] {
  switch (category) {
    case 'structural':
      return {
        color: 'rgba(96, 165, 250, 0.7)',
        lineStyle: 'solid',
        lineWidth: 2,
        labelFormat: 'Structural',
      };
    case 'tactical':
      return {
        color: 'rgba(255, 255, 255, 0.6)',
        lineStyle: 'solid',
        lineWidth: 1.5,
        labelFormat: 'Tactical',
      };
    case 'intraday':
      return {
        color: 'rgba(156, 163, 175, 0.5)',
        lineStyle: 'dotted',
        lineWidth: 1,
        labelFormat: 'Intraday',
      };
    case 'options':
      return {
        color: 'rgba(16, 185, 129, 0.8)',
        lineStyle: 'solid',
        lineWidth: 2,
        labelFormat: 'Options',
      };
    case 'spy_derived':
      return {
        color: 'rgba(16, 185, 129, 0.5)',
        lineStyle: 'dot-dash',
        lineWidth: 1.5,
        labelFormat: 'SPY Derived',
      };
    case 'fibonacci':
    default:
      return {
        color: 'rgba(245, 237, 204, 0.6)',
        lineStyle: 'dashed',
        lineWidth: 1.5,
        labelFormat: 'Fibonacci',
      };
  }
}

function mapLevelCategory(type: string): LevelCategory {
  const normalized = type.toUpperCase();

  if (normalized.startsWith('PW') || normalized.includes('MONTH')) {
    return 'structural';
  }

  if (normalized.startsWith('PD') || normalized.startsWith('PM')) {
    return 'tactical';
  }

  if (normalized.includes('VWAP') || normalized.startsWith('OR-') || normalized.startsWith('IB-')) {
    return 'intraday';
  }

  return 'tactical';
}

function mapLegacyLevel(
  symbol: 'SPX' | 'SPY',
  level: LevelItem,
  category: LevelCategory,
  transformedPrice?: number,
): SPXLevel {
  return {
    id: uuid('spx_level'),
    symbol,
    category,
    source: level.type,
    price: round(transformedPrice ?? level.price, 2),
    strength: level.strength,
    timeframe: category === 'structural' ? 'weekly' : category === 'intraday' ? 'intraday' : 'daily',
    metadata: {
      description: level.description,
      testsToday: level.testsToday ?? 0,
      lastTestAt: level.lastTest ?? null,
      holdRate: level.holdRate ?? null,
      displayContext: level.displayContext ?? null,
    },
    chartStyle: toChartStyle(category),
  };
}

function collectLegacyLevels(levels: Awaited<ReturnType<typeof calculateLevels>>): LevelItem[] {
  const items = [
    ...levels.levels.resistance,
    ...levels.levels.support,
  ];

  // Ensure VWAP is always present as a level — even if it wasn't placed into
  // resistance/support by the levels calculator (Audit CRITICAL-1, Chart domain).
  // The indicators.vwap field holds the numeric value; synthesize a LevelItem
  // if no VWAP-typed entry already exists in the resistance/support arrays.
  const vwapPrice = levels.levels.indicators?.vwap;
  if (typeof vwapPrice === 'number' && Number.isFinite(vwapPrice) && vwapPrice > 0) {
    const hasVwap = items.some((item) => item.type === 'VWAP');
    if (!hasVwap) {
      items.push({
        type: 'VWAP',
        price: vwapPrice,
        strength: 'dynamic',
        description: 'Volume Weighted Average Price',
        testsToday: 0,
        lastTest: null,
      } as LevelItem);
    }
  }

  return items;
}

/**
 * Calculate Opening Range (OR) for SPX.
 * The Opening Range is the high/low of the first 30 minutes of regular
 * trading (9:30 AM - 10:00 AM ET). Returns null if market hasn't reached
 * 10:00 AM yet or if data is unavailable.
 * Addresses Audit #8 CRITICAL-2: "Opening Range levels not calculated."
 */
const OR_CACHE_KEY = 'spx_command_center:opening_range';
const OR_CACHE_TTL_SECONDS = 60;
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 30;
const OR_END_MINUTE = 60; // 30 minutes after open = 10:00 AM

interface OpeningRange {
  high: number;
  low: number;
  computedAt: string;
}

async function calculateOpeningRange(asOfDate?: string): Promise<OpeningRange | null> {
  const dateStr = asOfDate || new Date().toISOString().slice(0, 10);

  // Check cache first
  const cacheKey = `${OR_CACHE_KEY}:${dateStr}`;
  const cached = await cacheGet<OpeningRange>(cacheKey);
  if (cached) return cached;

  // Check if it's past 10:00 AM ET today
  const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const isToday = dateStr === new Date(nowET).toISOString().slice(0, 10);
  if (isToday) {
    const currentMinutesSinceOpen = (nowET.getHours() - MARKET_OPEN_HOUR) * 60 + (nowET.getMinutes() - MARKET_OPEN_MINUTE);
    if (currentMinutesSinceOpen < OR_END_MINUTE - MARKET_OPEN_MINUTE) {
      // Not yet 10:00 AM ET — OR is still forming
      return null;
    }
  }

  try {
    const bars = await getMinuteAggregates('I:SPX', dateStr);
    if (!bars?.results?.length) return null;

    // Filter to first 30 minutes of trading (9:30-10:00 AM ET)
    const openMs = new Date(`${dateStr}T09:30:00-05:00`).getTime();
    const orEndMs = openMs + 30 * 60 * 1000; // +30 minutes

    const orBars = bars.results.filter((bar: { t: number }) =>
      bar.t >= openMs && bar.t < orEndMs
    );

    if (orBars.length === 0) return null;

    let high = -Infinity;
    let low = Infinity;
    for (const bar of orBars) {
      if (typeof bar.h === 'number' && bar.h > high) high = bar.h;
      if (typeof bar.l === 'number' && bar.l < low) low = bar.l;
    }

    if (!Number.isFinite(high) || !Number.isFinite(low)) return null;

    const result: OpeningRange = {
      high: round(high, 2),
      low: round(low, 2),
      computedAt: nowIso(),
    };

    // Cache for 60s (OR doesn't change after 10 AM)
    await cacheSet(cacheKey, result, OR_CACHE_TTL_SECONDS);
    logger.info('SPX Opening Range calculated', { date: dateStr, high: result.high, low: result.low });
    return result;
  } catch (error) {
    logger.warn('Failed to calculate Opening Range', {
      error: error instanceof Error ? error.message : String(error),
      date: dateStr,
    });
    return null;
  }
}

function buildOpeningRangeLevels(or: OpeningRange | null): SPXLevel[] {
  if (!or) return [];
  const levels: SPXLevel[] = [];

  if (Number.isFinite(or.high) && or.high > 0) {
    levels.push({
      id: uuid('spx_level'),
      symbol: 'SPX',
      category: 'intraday',
      source: 'opening_range_high',
      price: or.high,
      strength: 'strong',
      timeframe: '0dte',
      metadata: {
        description: 'Opening Range High (9:30–10:00 AM)',
        computedAt: or.computedAt,
      },
      chartStyle: {
        color: 'rgba(16, 185, 129, 0.65)',
        lineStyle: 'dashed',
        lineWidth: 1.5,
        labelFormat: 'OR-High',
      },
    });
  }

  if (Number.isFinite(or.low) && or.low > 0) {
    levels.push({
      id: uuid('spx_level'),
      symbol: 'SPX',
      category: 'intraday',
      source: 'opening_range_low',
      price: or.low,
      strength: 'strong',
      timeframe: '0dte',
      metadata: {
        description: 'Opening Range Low (9:30–10:00 AM)',
        computedAt: or.computedAt,
      },
      chartStyle: {
        color: 'rgba(239, 68, 68, 0.65)',
        lineStyle: 'dashed',
        lineWidth: 1.5,
        labelFormat: 'OR-Low',
      },
    });
  }

  return levels;
}

function buildGexDerivedLevels(input: {
  gex: Awaited<ReturnType<typeof computeUnifiedGEXLandscape>>;
}): SPXLevel[] {
  const { gex } = input;
  const optionsLevels: SPXLevel[] = [];
  const isRenderablePrice = (price: number): boolean => Number.isFinite(price) && price > 0;

  const addLevel = (
    symbol: 'SPX' | 'SPY',
    category: LevelCategory,
    source: string,
    price: number,
    strength: SPXLevel['strength'] = 'critical',
    metadata: Record<string, unknown> = {},
  ): void => {
    if (!isRenderablePrice(price)) {
      logger.warn('Skipping non-renderable GEX-derived level', {
        symbol,
        category,
        source,
        price,
      });
      return;
    }

    optionsLevels.push({
      id: uuid('spx_level'),
      symbol,
      category,
      source,
      price: round(price, 2),
      strength,
      timeframe: '0dte',
      metadata,
      chartStyle: toChartStyle(category),
    });
  };

  addLevel('SPX', 'options', 'spx_call_wall', gex.spx.callWall, 'critical', { gex: gex.spx.netGex });
  addLevel('SPX', 'options', 'spx_put_wall', gex.spx.putWall, 'critical', { gex: gex.spx.netGex });
  addLevel('SPX', 'options', 'spx_flip_point', gex.spx.flipPoint, 'dynamic', { gex: gex.spx.netGex });
  // Zero Gamma — critical options S/R level (Audit HIGH-1, Chart domain).
  // Was present in GEX profile but never mapped to an SPXLevel for chart rendering.
  addLevel('SPX', 'options', 'spx_zero_gamma', gex.spx.zeroGamma, 'strong', { gex: gex.spx.netGex });

  addLevel('SPY', 'spy_derived', 'spy_call_wall', gex.spy.callWall, 'critical', { gex: gex.spy.netGex });
  addLevel('SPY', 'spy_derived', 'spy_put_wall', gex.spy.putWall, 'critical', { gex: gex.spy.netGex });
  addLevel('SPY', 'spy_derived', 'spy_flip_point', gex.spy.flipPoint, 'dynamic', { gex: gex.spy.netGex });
  addLevel('SPY', 'spy_derived', 'spy_zero_gamma', gex.spy.zeroGamma, 'strong', { gex: gex.spy.netGex });

  for (const keyLevel of gex.combined.keyLevels.slice(0, 5)) {
    addLevel('SPX', 'options', `combined_${keyLevel.type}`, keyLevel.strike, 'strong', {
      gex: keyLevel.gex,
      source: 'combined',
    });
  }

  return optionsLevels;
}

function buildFibLevelsAsSPXLevels(fibLevels: Awaited<ReturnType<typeof getFibLevels>>): SPXLevel[] {
  return fibLevels.map((level) => ({
    id: uuid('spx_level'),
    symbol: 'SPX',
    category: 'fibonacci',
    source: `fib_${level.timeframe}_${String(level.ratio).replace('.', '')}`,
    price: round(level.price, 2),
    strength: level.crossValidated ? 'strong' : 'moderate',
    timeframe: level.timeframe,
    metadata: {
      ratio: level.ratio,
      direction: level.direction,
      swingHigh: level.swingHigh,
      swingLow: level.swingLow,
      crossValidated: level.crossValidated,
    },
    chartStyle: toChartStyle('fibonacci'),
  }));
}

function scoreLevel(level: SPXLevel): number {
  const categoryWeight = CATEGORY_WEIGHT[level.category] || 1;
  const crossValidatedBonus = level.category === 'fibonacci' && level.metadata.crossValidated === true ? 0.5 : 0;
  return categoryWeight + crossValidatedBonus;
}

function dedupeSources(sources: ClusterZone['sources']): ClusterZone['sources'] {
  const deduped: ClusterZone['sources'] = [];
  const keys = new Set<string>();

  for (const source of sources) {
    const key = `${source.instrument}:${source.category}:${source.source}:${source.price}`;
    if (keys.has(key)) continue;
    keys.add(key);
    deduped.push(source);
  }

  return deduped;
}

function clusterSourceSignature(sources: ClusterZone['sources']): string {
  return dedupeSources(sources)
    .map((source) => `${source.instrument}:${source.category}:${source.source}:${round(source.price, 2)}`)
    .sort()
    .join('|');
}

function buildClusterId(priceLow: number, priceHigh: number, sources: ClusterZone['sources']): string {
  return stableId(
    'cluster',
    `${round(priceLow, 2)}|${round(priceHigh, 2)}|${clusterSourceSignature(sources)}`,
  );
}

function mergeOverlappingZones(zones: ClusterZone[]): ClusterZone[] {
  if (zones.length <= 1) return zones;

  const sorted = [...zones].sort((a, b) => a.priceLow - b.priceLow);
  const merged: ClusterZone[] = [];

  for (const zone of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || zone.priceLow > previous.priceHigh) {
      merged.push(zone);
      continue;
    }

    const dominant = zone.clusterScore >= previous.clusterScore ? zone : previous;
    const mergedScore = round(Math.max(zone.clusterScore, previous.clusterScore), 2);
    const mergedSources = dedupeSources([...previous.sources, ...zone.sources]);
    const mergedLow = round(Math.min(previous.priceLow, zone.priceLow), 2);
    const mergedHigh = round(Math.max(previous.priceHigh, zone.priceHigh), 2);

    merged[merged.length - 1] = {
      ...dominant,
      id: buildClusterId(mergedLow, mergedHigh, mergedSources),
      priceLow: mergedLow,
      priceHigh: mergedHigh,
      clusterScore: mergedScore,
      type: classifyZoneType(mergedScore),
      testCount: previous.testCount + zone.testCount,
      sources: mergedSources,
      holdRate: previous.holdRate == null && zone.holdRate == null
        ? null
        : round(((previous.holdRate || 0) + (zone.holdRate || 0)) / ((previous.holdRate != null ? 1 : 0) + (zone.holdRate != null ? 1 : 0)), 2),
      held: dominant.held,
      lastTestAt: [previous.lastTestAt, zone.lastTestAt].filter(Boolean).sort().pop() || null,
    };
  }

  return merged;
}

export function buildClusterZones(levels: SPXLevel[]): ClusterZone[] {
  if (levels.length === 0) return [];

  const sorted = [...levels].sort((a, b) => a.price - b.price);
  const grouped: SPXLevel[][] = [];

  let bucket: SPXLevel[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const bucketMax = bucket[bucket.length - 1].price;

    if (current.price - bucketMax <= CLUSTER_RADIUS_POINTS) {
      bucket.push(current);
      continue;
    }

    grouped.push(bucket);
    bucket = [current];
  }
  grouped.push(bucket);

  const zones = grouped.map((bucketLevels) => {
    const min = Math.min(...bucketLevels.map((level) => level.price));
    const max = Math.max(...bucketLevels.map((level) => level.price));
    const score = round(bucketLevels.reduce((sum, level) => sum + scoreLevel(level), 0), 2);

    const holdRates = bucketLevels
      .map((level) => (typeof level.metadata.holdRate === 'number' ? level.metadata.holdRate : null))
      .filter((value): value is number => value !== null);

    const testCount = bucketLevels
      .map((level) => (typeof level.metadata.testsToday === 'number' ? level.metadata.testsToday : 0))
      .reduce((sum, value) => sum + value, 0);

    const lastTestAt = bucketLevels
      .map((level) => (typeof level.metadata.lastTestAt === 'string' ? level.metadata.lastTestAt : null))
      .filter((value): value is string => value !== null)
      .sort()
      .pop() || null;

    const priceLow = round(min - 0.25, 2);
    const priceHigh = round(max + 0.25, 2);
    const sources = dedupeSources(bucketLevels.map((level) => ({
      source: level.source,
      category: level.category,
      price: round(level.price, 2),
      instrument: level.symbol,
    })));

    return {
      id: buildClusterId(priceLow, priceHigh, sources),
      priceLow,
      priceHigh,
      clusterScore: score,
      type: classifyZoneType(score),
      sources,
      testCount,
      lastTestAt,
      held: holdRates.length > 0 ? holdRates.reduce((sum, value) => sum + value, 0) / holdRates.length >= 60 : null,
      holdRate: holdRates.length > 0
        ? round(holdRates.reduce((sum, value) => sum + value, 0) / holdRates.length, 2)
        : null,
    };
  });

  return mergeOverlappingZones(zones);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function getMergedLevels(options?: {
  forceRefresh?: boolean;
  basisState?: BasisState;
  gexLandscape?: UnifiedGEXLandscape;
  fibLevels?: FibLevel[];
}): Promise<{
  levels: SPXLevel[];
  clusters: ClusterZone[];
  generatedAt: string;
}> {
  const forceRefresh = options?.forceRefresh === true;
  const hasPrecomputedDependencies = Boolean(options?.basisState || options?.gexLandscape || options?.fibLevels);
  if (!forceRefresh && levelsInFlight) {
    return levelsInFlight;
  }

  const run = async (): Promise<{
    levels: SPXLevel[];
    clusters: ClusterZone[];
    generatedAt: string;
  }> => {
    if (!forceRefresh && !hasPrecomputedDependencies) {
      const cached = await cacheGet<{ levels: SPXLevel[]; clusters: ClusterZone[]; generatedAt: string }>(LEVEL_CACHE_KEY);
      if (cached) {
        return cached;
      }
    }

    const [spxLegacy, spyLegacy] = await Promise.all([
      calculateLevels('SPX', 'intraday'),
      calculateLevels('SPY', 'intraday'),
    ]);

    let basis: BasisState | null = options?.basisState ?? null;
    let gex: UnifiedGEXLandscape | null = options?.gexLandscape ?? null;
    let fibLevels: FibLevel[] | null = options?.fibLevels ?? null;

    if (!basis) {
      try {
        basis = await getBasisState({ forceRefresh });
      } catch (error) {
        logger.warn('Basis state failed, continuing without SPY-derived levels', {
          error: toErrorMessage(error),
        });
      }
    }

    if (!gex) {
      try {
        gex = await computeUnifiedGEXLandscape({ forceRefresh });
      } catch (error) {
        logger.warn('GEX landscape failed, continuing without GEX-derived levels', {
          error: toErrorMessage(error),
        });
      }
    }

    if (!fibLevels) {
      try {
        fibLevels = await getFibLevels({ forceRefresh });
      } catch (error) {
        logger.warn('Fibonacci levels failed, continuing without fib levels', {
          error: toErrorMessage(error),
        });
      }
    }

    const spxLevels = collectLegacyLevels(spxLegacy).map((level) => {
      const category = mapLevelCategory(level.type);
      return mapLegacyLevel('SPX', level, category);
    });

    const spyDerivedLevels = basis
      ? collectLegacyLevels(spyLegacy).map((level) => {
        const transformedPrice = level.price * 10 + basis.current;
        return mapLegacyLevel('SPY', level, 'spy_derived', transformedPrice);
      })
      : [];

    const optionLevels = gex ? buildGexDerivedLevels({ gex }) : [];
    const fibMappedLevels = fibLevels ? buildFibLevelsAsSPXLevels(fibLevels) : [];

    // Opening Range levels (OR-High / OR-Low) — Audit #8 CRITICAL-2
    let orLevels: SPXLevel[] = [];
    try {
      const openingRange = await calculateOpeningRange();
      orLevels = buildOpeningRangeLevels(openingRange);
    } catch (error) {
      logger.debug('Opening Range levels unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const allLevels = [...spxLevels, ...spyDerivedLevels, ...optionLevels, ...fibMappedLevels, ...orLevels]
      .sort((a, b) => a.price - b.price);

    const clusters = buildClusterZones(allLevels);

    const payload = {
      levels: allLevels,
      clusters,
      generatedAt: nowIso(),
    };

    await cacheSet(LEVEL_CACHE_KEY, payload, LEVEL_CACHE_TTL_SECONDS);

    logger.info('SPX command center levels updated', {
      levels: allLevels.length,
      clusters: clusters.length,
      generatedAt: payload.generatedAt,
    });

    return payload;
  };

  if (forceRefresh) {
    return run();
  }

  levelsInFlight = run();
  try {
    return await levelsInFlight;
  } finally {
    levelsInFlight = null;
  }
}
