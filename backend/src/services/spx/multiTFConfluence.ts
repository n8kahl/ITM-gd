import { getAggregates, type MassiveAggregate } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import type { SymbolProfile } from './symbolProfile';
import { resolveSymbolProfile } from './symbolProfile';
import { ema, round } from './utils';

export type MultiTFTrend = 'up' | 'down' | 'flat';

export interface MultiTFFrameSnapshot {
  timeframe: '1m' | '5m' | '15m' | '1h';
  ema21: number;
  emaReliable: boolean;
  ema55: number;
  slope21: number;
  latestClose: number;
  trend: MultiTFTrend;
  swingHigh: number;
  swingLow: number;
  bars: Array<{ t: number; c: number; h: number; l: number; v: number }>;
}

export interface SPXMultiTFConfluenceContext {
  asOf: string;
  tf1m: MultiTFFrameSnapshot;
  tf5m: MultiTFFrameSnapshot;
  tf15m: MultiTFFrameSnapshot;
  tf1h: MultiTFFrameSnapshot;
  source: 'computed' | 'cached' | 'fallback';
}

export interface SPXMultiTFConfluenceScore {
  tf1hStructureAligned: number;
  tf15mSwingProximity: number;
  tf5mMomentumAlignment: number;
  tf1mMicrostructure: number;
  composite: number;
  aligned: boolean;
}

const MULTI_TF_CACHE_TTL_SECONDS = 45;
const MULTI_TF_ONE_HOUR_LOOKBACK_DAYS = 7;
const MULTI_TF_BASE_WEIGHTS = {
  weight1h: 0.55,
  weight15m: 0.2,
  weight5m: 0.15,
  weight1m: 0.1,
} as const;
const MULTI_TF_COMPONENT_CAPS = {
  tf1hStructureAligned: 25,
  tf15mSwingProximity: 20,
  tf5mMomentumAlignment: 15,
  tf1mMicrostructure: 16,
} as const;

interface MultiTFComputationConfig {
  ticker: string;
  emaFast: number;
  emaSlow: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function toFrameBars(bars: MassiveAggregate[], maxBars = 80): MultiTFFrameSnapshot['bars'] {
  return (bars || [])
    .filter((bar) => Number.isFinite(bar.t) && Number.isFinite(bar.c) && Number.isFinite(bar.h) && Number.isFinite(bar.l))
    .sort((a, b) => a.t - b.t)
    .slice(-maxBars)
    .map((bar) => ({
      t: bar.t,
      c: bar.c,
      h: bar.h,
      l: bar.l,
      v: Number.isFinite(bar.v) ? bar.v : 0,
    }));
}

function frameTrend(input: {
  ema21: number;
  ema55: number;
  slope21: number;
}): MultiTFTrend {
  if (input.ema21 > input.ema55 && input.slope21 > 0) return 'up';
  if (input.ema21 < input.ema55 && input.slope21 < 0) return 'down';
  return 'flat';
}

function buildFrameSnapshot(input: {
  timeframe: MultiTFFrameSnapshot['timeframe'];
  bars: MultiTFFrameSnapshot['bars'];
  emaFast: number;
  emaSlow: number;
}): MultiTFFrameSnapshot {
  const closes = input.bars.map((bar) => bar.c);
  const emaFast = Math.max(1, Math.round(input.emaFast));
  const emaSlow = Math.max(1, Math.round(input.emaSlow));
  const emaReliable = closes.length >= emaFast;
  const ema21 = closes.length > 0 ? ema(closes, Math.min(emaFast, closes.length)) : 0;
  const ema55 = closes.length > 0 ? ema(closes, Math.min(emaSlow, closes.length)) : 0;
  const priorCloses = closes.slice(0, -1);
  const ema21Prior = priorCloses.length > 0 ? ema(priorCloses, Math.min(emaFast, priorCloses.length)) : ema21;
  const slope21 = ema21 - ema21Prior;
  const latestClose = closes.length > 0 ? closes[closes.length - 1] : 0;
  const swingLookback = input.timeframe === '1h' ? 4 : input.timeframe === '15m' ? 8 : 12;
  const swingBars = input.bars.slice(-swingLookback);
  const swingHigh = swingBars.length > 0
    ? swingBars.reduce((max, bar) => Math.max(max, bar.h), Number.NEGATIVE_INFINITY)
    : latestClose;
  const swingLow = swingBars.length > 0
    ? swingBars.reduce((min, bar) => Math.min(min, bar.l), Number.POSITIVE_INFINITY)
    : latestClose;

  return {
    timeframe: input.timeframe,
    ema21: round(ema21, 4),
    emaReliable,
    ema55: round(ema55, 4),
    slope21: round(slope21, 4),
    latestClose: round(latestClose, 4),
    trend: frameTrend({
      ema21,
      ema55,
      slope21,
    }),
    swingHigh: round(Number.isFinite(swingHigh) ? swingHigh : latestClose, 4),
    swingLow: round(Number.isFinite(swingLow) ? swingLow : latestClose, 4),
    bars: input.bars,
  };
}

function neutralFrame(timeframe: MultiTFFrameSnapshot['timeframe']): MultiTFFrameSnapshot {
  return {
    timeframe,
    ema21: 0,
    emaReliable: false,
    ema55: 0,
    slope21: 0,
    latestClose: 0,
    trend: 'flat',
    swingHigh: 0,
    swingLow: 0,
    bars: [],
  };
}

function neutralContext(asOf: string): SPXMultiTFConfluenceContext {
  return {
    asOf,
    tf1m: neutralFrame('1m'),
    tf5m: neutralFrame('5m'),
    tf15m: neutralFrame('15m'),
    tf1h: neutralFrame('1h'),
    source: 'fallback',
  };
}

function isValidContext(value: unknown): value is SPXMultiTFConfluenceContext {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SPXMultiTFConfluenceContext> & {
    tf1m?: Partial<MultiTFFrameSnapshot>;
    tf5m?: Partial<MultiTFFrameSnapshot>;
    tf15m?: Partial<MultiTFFrameSnapshot>;
    tf1h?: Partial<MultiTFFrameSnapshot>;
  };
  return (
    typeof candidate.asOf === 'string'
    && candidate.tf1m != null
    && typeof candidate.tf1m.emaReliable === 'boolean'
    && candidate.tf5m != null
    && typeof candidate.tf5m.emaReliable === 'boolean'
    && candidate.tf15m != null
    && typeof candidate.tf15m.emaReliable === 'boolean'
    && candidate.tf1h != null
    && typeof candidate.tf1h.emaReliable === 'boolean'
  );
}

function cacheKeyForDate(dateIso: string): string {
  const dateStr = toEasternTime(new Date(dateIso)).dateStr;
  return `spx_command_center:multi_tf:v2:${dateStr}`;
}

function cacheKeyForSymbolDate(dateIso: string, symbol: string): string {
  const dateStr = toEasternTime(new Date(dateIso)).dateStr;
  const normalized = symbol.trim().toUpperCase();
  return normalized === 'SPX'
    ? cacheKeyForDate(dateIso)
    : `spx_command_center:multi_tf:v2:${normalized}:${dateStr}`;
}

function dateDaysAgo(date: Date, days: number): string {
  const shifted = new Date(date.getTime() - (days * 24 * 60 * 60 * 1000));
  return toEasternTime(shifted).dateStr;
}

export async function getMultiTFConfluenceContext(options?: {
  forceRefresh?: boolean;
  evaluationDate?: Date;
  symbol?: string;
  profile?: SymbolProfile | null;
}): Promise<SPXMultiTFConfluenceContext> {
  const profile = await resolveSymbolProfile({
    symbol: options?.symbol,
    profile: options?.profile ?? null,
  });
  const computationConfig: MultiTFComputationConfig = {
    ticker: profile.tickers.massiveTicker,
    emaFast: Math.max(1, Math.round(profile.multiTF.emaFast)),
    emaSlow: Math.max(1, Math.round(profile.multiTF.emaSlow)),
  };
  const evaluationDate = options?.evaluationDate || new Date();
  const asOf = evaluationDate.toISOString();
  const key = cacheKeyForSymbolDate(asOf, profile.symbol);

  if (!options?.forceRefresh) {
    const cached = await cacheGet(key);
    if (isValidContext(cached)) {
      return {
        ...cached,
        source: 'cached',
      };
    }
  }

  try {
    const dateStr = toEasternTime(evaluationDate).dateStr;
    const oneHourFromDateStr = dateDaysAgo(evaluationDate, MULTI_TF_ONE_HOUR_LOOKBACK_DAYS);
    const [m1, m5, m15, h1] = await Promise.all([
      getAggregates(computationConfig.ticker, 1, 'minute', dateStr, dateStr),
      getAggregates(computationConfig.ticker, 5, 'minute', dateStr, dateStr),
      getAggregates(computationConfig.ticker, 15, 'minute', dateStr, dateStr),
      getAggregates(computationConfig.ticker, 60, 'minute', oneHourFromDateStr, dateStr),
    ]);

    const context = {
      asOf,
      tf1m: buildFrameSnapshot({
        timeframe: '1m',
        bars: toFrameBars(m1.results || []),
        emaFast: computationConfig.emaFast,
        emaSlow: computationConfig.emaSlow,
      }),
      tf5m: buildFrameSnapshot({
        timeframe: '5m',
        bars: toFrameBars(m5.results || []),
        emaFast: computationConfig.emaFast,
        emaSlow: computationConfig.emaSlow,
      }),
      tf15m: buildFrameSnapshot({
        timeframe: '15m',
        bars: toFrameBars(m15.results || []),
        emaFast: computationConfig.emaFast,
        emaSlow: computationConfig.emaSlow,
      }),
      tf1h: buildFrameSnapshot({
        timeframe: '1h',
        bars: toFrameBars(h1.results || []),
        emaFast: computationConfig.emaFast,
        emaSlow: computationConfig.emaSlow,
      }),
      source: 'computed',
    } satisfies SPXMultiTFConfluenceContext;

    await cacheSet(key, context, MULTI_TF_CACHE_TTL_SECONDS);
    return context;
  } catch (error) {
    logger.warn('Failed to compute multi-timeframe confluence context', {
      error: error instanceof Error ? error.message : String(error),
    });
    return neutralContext(asOf);
  }
}

export function scoreMultiTFConfluence(input: {
  context: SPXMultiTFConfluenceContext | null | undefined;
  direction: 'bullish' | 'bearish';
  currentPrice: number;
  profile?: SymbolProfile | null;
}): SPXMultiTFConfluenceScore {
  const context = input.context;
  if (!context) {
    return {
      tf1hStructureAligned: 6,
      tf15mSwingProximity: 4,
      tf5mMomentumAlignment: 4,
      tf1mMicrostructure: 4,
      composite: 24,
      aligned: false,
    };
  }

  const directionTrend: MultiTFTrend = input.direction === 'bullish' ? 'up' : 'down';
  const tf1hStructureAligned = context.tf1h.trend === directionTrend ? 25 : context.tf1h.trend === 'flat' ? 11 : 5;

  const distanceTo15mSwing = Math.min(
    Math.abs(input.currentPrice - context.tf15m.swingHigh),
    Math.abs(input.currentPrice - context.tf15m.swingLow),
  );
  const tf15mSwingProximity = distanceTo15mSwing <= 4
    ? 20
    : distanceTo15mSwing <= 8
      ? 12
      : distanceTo15mSwing <= 14
        ? 7
        : 3;

  const tf5mMomentumAlignment = context.tf5m.trend === directionTrend
    ? 15
    : context.tf5m.trend === 'flat'
      ? 8
      : 3;

  const microAligned = input.direction === 'bullish'
    ? context.tf1m.latestClose >= context.tf1m.ema21 && context.tf1m.slope21 >= 0
    : context.tf1m.latestClose <= context.tf1m.ema21 && context.tf1m.slope21 <= 0;
  const tf1mMicrostructure = microAligned ? 16 : 6;

  const weight1h = Math.max(0, input.profile?.multiTF.weight1h ?? MULTI_TF_BASE_WEIGHTS.weight1h);
  const weight15m = Math.max(0, input.profile?.multiTF.weight15m ?? MULTI_TF_BASE_WEIGHTS.weight15m);
  const weight5m = Math.max(0, input.profile?.multiTF.weight5m ?? MULTI_TF_BASE_WEIGHTS.weight5m);
  const weight1m = Math.max(0, input.profile?.multiTF.weight1m ?? MULTI_TF_BASE_WEIGHTS.weight1m);

  const weightScale1h = weight1h / MULTI_TF_BASE_WEIGHTS.weight1h;
  const weightScale15m = weight15m / MULTI_TF_BASE_WEIGHTS.weight15m;
  const weightScale5m = weight5m / MULTI_TF_BASE_WEIGHTS.weight5m;
  const weightScale1m = weight1m / MULTI_TF_BASE_WEIGHTS.weight1m;

  const weightedRaw = (
    (tf1hStructureAligned * weightScale1h)
    + (tf15mSwingProximity * weightScale15m)
    + (tf5mMomentumAlignment * weightScale5m)
    + (tf1mMicrostructure * weightScale1m)
  );
  const weightedCap = (
    (MULTI_TF_COMPONENT_CAPS.tf1hStructureAligned * weightScale1h)
    + (MULTI_TF_COMPONENT_CAPS.tf15mSwingProximity * weightScale15m)
    + (MULTI_TF_COMPONENT_CAPS.tf5mMomentumAlignment * weightScale5m)
    + (MULTI_TF_COMPONENT_CAPS.tf1mMicrostructure * weightScale1m)
  );
  const normalizationCap = weightedCap > 0 ? weightedCap : 76;

  let composite = round(clamp((weightedRaw / normalizationCap) * 100), 2);
  if ([context.tf1m, context.tf5m, context.tf15m, context.tf1h].some((frame) => !frame.emaReliable)) {
    composite = round(composite * 0.6, 2);
  }

  return {
    tf1hStructureAligned,
    tf15mSwingProximity,
    tf5mMomentumAlignment,
    tf1mMicrostructure,
    composite,
    aligned: composite >= 60,
  };
}
