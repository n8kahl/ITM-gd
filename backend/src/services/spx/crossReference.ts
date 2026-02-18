import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import type { BasisState, SpyImpactLevel, SpyImpactState, UnifiedGEXLandscape } from './types';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { ema, nowIso, round, zscore } from './utils';

const BASIS_CACHE_KEY = 'spx_command_center:basis';
const BASIS_CACHE_TTL_SECONDS = 15;
const SPY_IMPACT_CACHE_KEY = 'spx_command_center:spy_impact';
const SPY_IMPACT_CACHE_TTL_SECONDS = 15;
const SPY_IMPACT_HISTORY_LIMIT = 240;
const SPY_IMPACT_MIN_RETURN_SAMPLES = 20;
const SPY_IMPACT_DEFAULT_BETA = 10;
const SPY_IMPACT_DEFAULT_CORRELATION = 0;
const SPY_IMPACT_BETA_CLAMP: readonly [number, number] = [8, 12];
const SPY_IMPACT_CORRELATION_CLAMP: readonly [number, number] = [-0.99, 0.99];
const basisHistory: number[] = [];
const spySpxPriceHistory: Array<{ spx: number; spy: number }> = [];
let basisInFlight: Promise<BasisState> | null = null;
let spyImpactInFlight: Promise<SpyImpactState> | null = null;

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function updateSpySpxHistory(spxPrice: number, spyPrice: number): Array<{ spx: number; spy: number }> {
  if (!Number.isFinite(spxPrice) || !Number.isFinite(spyPrice) || spxPrice <= 0 || spyPrice <= 0) {
    return [...spySpxPriceHistory];
  }

  const previous = spySpxPriceHistory[spySpxPriceHistory.length - 1];
  if (previous && Math.abs(previous.spx - spxPrice) <= 0.01 && Math.abs(previous.spy - spyPrice) <= 0.001) {
    return [...spySpxPriceHistory];
  }

  spySpxPriceHistory.push({
    spx: round(spxPrice, 4),
    spy: round(spyPrice, 4),
  });
  while (spySpxPriceHistory.length > SPY_IMPACT_HISTORY_LIMIT) {
    spySpxPriceHistory.shift();
  }

  return [...spySpxPriceHistory];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function estimateSpySpxStats(history: Array<{ spx: number; spy: number }>): {
  beta: number;
  correlation: number;
  samples: number;
} {
  const spyReturns: number[] = [];
  const spxReturns: number[] = [];

  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1];
    const next = history[i];
    if (prev.spy <= 0 || prev.spx <= 0) continue;

    const spyReturn = (next.spy - prev.spy) / prev.spy;
    const spxReturn = (next.spx - prev.spx) / prev.spx;

    if (!Number.isFinite(spyReturn) || !Number.isFinite(spxReturn)) continue;
    spyReturns.push(spyReturn);
    spxReturns.push(spxReturn);
  }

  if (spyReturns.length < SPY_IMPACT_MIN_RETURN_SAMPLES) {
    return {
      beta: SPY_IMPACT_DEFAULT_BETA,
      correlation: SPY_IMPACT_DEFAULT_CORRELATION,
      samples: spyReturns.length,
    };
  }

  const meanSpy = mean(spyReturns);
  const meanSpx = mean(spxReturns);

  let covariance = 0;
  let varianceSpy = 0;
  let varianceSpx = 0;

  for (let i = 0; i < spyReturns.length; i += 1) {
    const centeredSpy = spyReturns[i] - meanSpy;
    const centeredSpx = spxReturns[i] - meanSpx;
    covariance += centeredSpy * centeredSpx;
    varianceSpy += centeredSpy * centeredSpy;
    varianceSpx += centeredSpx * centeredSpx;
  }

  const denominator = Math.max(spyReturns.length - 1, 1);
  covariance /= denominator;
  varianceSpy /= denominator;
  varianceSpx /= denominator;

  if (varianceSpy <= 1e-12 || varianceSpx <= 1e-12) {
    return {
      beta: SPY_IMPACT_DEFAULT_BETA,
      correlation: 0,
      samples: spyReturns.length,
    };
  }

  const rawBeta = covariance / varianceSpy;
  const rawCorrelation = covariance / Math.sqrt(varianceSpy * varianceSpx);

  return {
    beta: clamp(rawBeta, SPY_IMPACT_BETA_CLAMP[0], SPY_IMPACT_BETA_CLAMP[1]),
    correlation: clamp(rawCorrelation, SPY_IMPACT_CORRELATION_CLAMP[0], SPY_IMPACT_CORRELATION_CLAMP[1]),
    samples: spyReturns.length,
  };
}

function computeBaseConfidence(correlation: number, samples: number): number {
  const sampleComponent = Math.min(1, samples / 80);
  const correlationComponent = Math.min(1, Math.abs(correlation));
  return clamp(0.35 + sampleComponent * 0.4 + correlationComponent * 0.25, 0.25, 0.97);
}

function sourceConfidenceMultiplier(source: string): number {
  const normalized = source.toLowerCase();
  if (normalized.includes('call_wall') || normalized.includes('put_wall')) return 1;
  if (normalized.includes('flip_point')) return 0.92;
  return 0.84;
}

function buildSpyImpactLevels(input: {
  gex: UnifiedGEXLandscape;
  basis: BasisState;
  beta: number;
  correlation: number;
  samples: number;
}): SpyImpactLevel[] {
  const { gex, basis, beta, correlation, samples } = input;
  const spotSpx = basis.spxPrice;

  const candidates: Array<{ source: string; projectedSpxFromSource: number }> = [
    { source: 'spy_call_wall', projectedSpxFromSource: gex.spy.callWall },
    { source: 'spy_put_wall', projectedSpxFromSource: gex.spy.putWall },
    { source: 'spy_flip_point', projectedSpxFromSource: gex.spy.flipPoint },
    ...gex.spy.keyLevels.slice(0, 4).map((level, index) => ({
      source: `spy_key_${index + 1}_${level.type}`,
      projectedSpxFromSource: level.strike,
    })),
  ].filter((candidate) => Number.isFinite(candidate.projectedSpxFromSource));

  const deduped = new Map<string, { source: string; projectedSpxFromSource: number }>();
  for (const candidate of candidates) {
    const bucket = round(candidate.projectedSpxFromSource, 2);
    if (!Number.isFinite(bucket)) continue;
    const key = `${candidate.source}:${bucket}`;
    if (!deduped.has(key)) {
      deduped.set(key, candidate);
    }
  }

  const baseConfidence = computeBaseConfidence(correlation, samples);

  return Array.from(deduped.values())
    .map((candidate) => {
      const spyLevel = convertSpxPriceToSpy(candidate.projectedSpxFromSource, basis.current);
      const projectedSpx = round(spyLevel * beta + basis.current, 2);
      const impactSpxPoints = round(projectedSpx - spotSpx, 2);

      const confidence = clamp(
        baseConfidence * sourceConfidenceMultiplier(candidate.source),
        0.2,
        0.98,
      );
      const confidencePenalty = 1 - confidence;
      const betaPenalty = Math.abs(beta - SPY_IMPACT_DEFAULT_BETA) * 0.9;
      const bandHalfWidth = Math.max(
        1.25,
        confidencePenalty * 8 + betaPenalty + Math.abs(basis.zscore) * 0.55,
      );

      return {
        source: candidate.source,
        spyLevel,
        projectedSpx,
        impactSpxPoints,
        confidence: round(confidence, 2),
        confidenceBand: {
          low: round(projectedSpx - bandHalfWidth, 2),
          high: round(projectedSpx + bandHalfWidth, 2),
        },
      };
    })
    .sort((a, b) => {
      const distanceA = Math.abs(a.projectedSpx - spotSpx);
      const distanceB = Math.abs(b.projectedSpx - spotSpx);
      if (distanceA !== distanceB) return distanceA - distanceB;
      return b.confidence - a.confidence;
    })
    .slice(0, 6);
}

export async function getBasisState(options?: {
  forceRefresh?: boolean;
  gexLandscape?: UnifiedGEXLandscape;
}): Promise<BasisState> {
  const forceRefresh = options?.forceRefresh === true;
  const hasPrecomputedGex = Boolean(options?.gexLandscape);
  if (!forceRefresh && basisInFlight) {
    return basisInFlight;
  }

  const run = async (): Promise<BasisState> => {
    if (!forceRefresh && !hasPrecomputedGex) {
      const cached = await cacheGet<BasisState>(BASIS_CACHE_KEY);
      if (cached) {
        return cached;
      }
    }

    const gex = options?.gexLandscape || await computeUnifiedGEXLandscape({ forceRefresh });
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
  };

  if (forceRefresh) {
    return run();
  }

  basisInFlight = run();
  try {
    return await basisInFlight;
  } finally {
    basisInFlight = null;
  }
}

export async function getSpyImpactState(options?: {
  forceRefresh?: boolean;
  basisState?: BasisState;
  gexLandscape?: UnifiedGEXLandscape;
}): Promise<SpyImpactState> {
  const forceRefresh = options?.forceRefresh === true;
  const hasPrecomputedDependencies = Boolean(options?.basisState || options?.gexLandscape);

  if (!forceRefresh && spyImpactInFlight) {
    return spyImpactInFlight;
  }

  const run = async (): Promise<SpyImpactState> => {
    if (!forceRefresh && !hasPrecomputedDependencies) {
      const cached = await cacheGet<SpyImpactState>(SPY_IMPACT_CACHE_KEY);
      if (cached) {
        return cached;
      }
    }

    const [basis, gex] = await Promise.all([
      options?.basisState
        ? Promise.resolve(options.basisState)
        : getBasisState({ forceRefresh }),
      options?.gexLandscape
        ? Promise.resolve(options.gexLandscape)
        : computeUnifiedGEXLandscape({ forceRefresh }),
    ]);

    const history = updateSpySpxHistory(basis.spxPrice, basis.spyPrice);
    const stats = estimateSpySpxStats(history);
    const levels = buildSpyImpactLevels({
      gex,
      basis,
      beta: stats.beta,
      correlation: stats.correlation,
      samples: stats.samples,
    });

    const state: SpyImpactState = {
      beta: round(stats.beta, 2),
      correlation: round(stats.correlation, 2),
      basisUsed: round(basis.current, 2),
      spot: {
        spx: round(basis.spxPrice, 2),
        spy: round(basis.spyPrice, 2),
      },
      levels,
      timestamp: nowIso(),
    };

    await cacheSet(SPY_IMPACT_CACHE_KEY, state, SPY_IMPACT_CACHE_TTL_SECONDS);

    logger.info('SPY impact state updated', {
      beta: state.beta,
      correlation: state.correlation,
      levels: state.levels.length,
      basis: state.basisUsed,
      samples: stats.samples,
    });

    return state;
  };

  if (forceRefresh) {
    return run();
  }

  spyImpactInFlight = run();
  try {
    return await spyImpactInFlight;
  } finally {
    spyImpactInFlight = null;
  }
}
