import { getPredictionState } from './aiPredictor';
import { getCoachState } from './aiCoach';
import { getContractRecommendation } from './contractSelector';
import { getBasisState, getSpyImpactState } from './crossReference';
import { getFibLevels } from './fibEngine';
import { getFlowEvents } from './flowEngine';
import { computeUnifiedGEXLandscape, getCachedUnifiedGEXLandscape } from './gexEngine';
import { getMergedLevels } from './levelEngine';
import { logger } from '../../lib/logger';
import { cacheGet, cacheSet } from '../../config/redis';
import { classifyCurrentRegime } from './regimeClassifier';
import { detectActiveSetups } from './setupDetector';
import type {
  BasisState,
  CoachMessage,
  PredictionState,
  RegimeState,
  SpyImpactState,
  SPXSnapshot,
  UnifiedGEXLandscape,
} from './types';
import { nowIso } from './utils';

let snapshotInFlight: Promise<SPXSnapshot> | null = null;
const SNAPSHOT_CONTRACT_ENRICHMENT_BUDGET_MS = 2500;
const SNAPSHOT_MAX_INLINE_RECOMMENDATIONS = 2;
const SNAPSHOT_BACKGROUND_REFRESH_MS = 20_000;
const SNAPSHOT_REDIS_CACHE_KEY = 'spx_command_center:snapshot:last_good';
const SNAPSHOT_REDIS_CACHE_TTL_SECONDS = 300;
const SNAPSHOT_STAGE_TIMEOUTS_MS = {
  gex: resolveSnapshotGexTimeoutMs(),
  flow: 4_000,
  basis: 4_000,
  spyImpact: 4_000,
  fib: 5_000,
  levels: 5_000,
  regime: 4_000,
  setups: 5_000,
  prediction: 4_000,
  coach: 4_000,
} as const;

let lastGoodSnapshot: SPXSnapshot | null = null;
let lastGoodSnapshotAt = 0;
let snapshotHydrateInFlight: Promise<void> | null = null;

function resolveSnapshotGexTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.SPX_SNAPSHOT_GEX_TIMEOUT_MS || '', 10);
  if (!Number.isFinite(parsed) || parsed < 5_000) {
    return 30_000;
  }
  return Math.min(parsed, 120_000);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('Timed out')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function hydrateLastGoodSnapshotFromCache(): Promise<void> {
  if (lastGoodSnapshot) {
    return;
  }
  if (snapshotHydrateInFlight) {
    return snapshotHydrateInFlight;
  }

  snapshotHydrateInFlight = (async () => {
    try {
      const cached = await cacheGet<SPXSnapshot>(SNAPSHOT_REDIS_CACHE_KEY);
      if (cached) {
        lastGoodSnapshot = cached;
        lastGoodSnapshotAt = Date.now();
        logger.info('SPX snapshot hydrated from redis cache');
      }
    } catch (error) {
      logger.warn('SPX snapshot cache hydrate failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      snapshotHydrateInFlight = null;
    }
  })();

  return snapshotHydrateInFlight;
}

async function persistLastGoodSnapshot(snapshot: SPXSnapshot): Promise<void> {
  try {
    await cacheSet(SNAPSHOT_REDIS_CACHE_KEY, snapshot, SNAPSHOT_REDIS_CACHE_TTL_SECONDS);
  } catch (error) {
    logger.warn('SPX snapshot cache persist failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function createNeutralGexProfile(
  symbol: 'SPX' | 'SPY' | 'COMBINED',
  spotPrice: number,
): UnifiedGEXLandscape['spx'] {
  return {
    symbol,
    spotPrice,
    netGex: 0,
    flipPoint: spotPrice,
    callWall: spotPrice,
    putWall: spotPrice,
    zeroGamma: spotPrice,
    gexByStrike: [],
    keyLevels: [],
    expirationBreakdown: {},
    timestamp: nowIso(),
  };
}

function createNeutralGexLandscape(snapshot: SPXSnapshot | null): UnifiedGEXLandscape {
  const fallbackSpot = snapshot?.gex?.spx?.spotPrice
    ?? snapshot?.basis?.spxPrice
    ?? 0;
  const fallbackSpy = snapshot?.gex?.spy?.spotPrice
    ?? snapshot?.basis?.spyPrice
    ?? 0;

  return {
    spx: createNeutralGexProfile('SPX', fallbackSpot),
    spy: createNeutralGexProfile('SPY', fallbackSpy),
    combined: createNeutralGexProfile('COMBINED', fallbackSpot),
  };
}

function createNeutralBasisState(gex: UnifiedGEXLandscape, snapshot: SPXSnapshot | null): BasisState {
  if (snapshot?.basis) {
    return snapshot.basis;
  }

  return {
    current: 0,
    trend: 'stable',
    leading: 'neutral',
    ema5: 0,
    ema20: 0,
    zscore: 0,
    spxPrice: gex.spx.spotPrice,
    spyPrice: gex.spy.spotPrice,
    timestamp: nowIso(),
  };
}

function createNeutralSpyImpactState(basis: BasisState, snapshot: SPXSnapshot | null): SpyImpactState {
  if (snapshot?.spyImpact) {
    return snapshot.spyImpact;
  }

  return {
    beta: 10,
    correlation: 0,
    basisUsed: basis.current,
    spot: {
      spx: basis.spxPrice,
      spy: basis.spyPrice,
    },
    levels: [],
    timestamp: nowIso(),
  };
}

function createNeutralRegimeState(snapshot: SPXSnapshot | null): RegimeState {
  if (snapshot?.regime) {
    return snapshot.regime;
  }

  return {
    regime: 'compression',
    direction: 'neutral',
    probability: 0,
    magnitude: 'small',
    confidence: 0,
    timestamp: nowIso(),
  };
}

function createNeutralPredictionState(snapshot: SPXSnapshot | null, spotPrice: number): PredictionState {
  if (snapshot?.prediction) {
    return snapshot.prediction;
  }

  return {
    regime: 'compression',
    direction: { bullish: 0, bearish: 0, neutral: 100 },
    magnitude: { small: 100, medium: 0, large: 0 },
    timingWindow: {
      description: 'Prediction unavailable while snapshot dependencies refresh.',
      actionable: false,
    },
    nextTarget: {
      upside: { price: spotPrice, zone: 'unavailable' },
      downside: { price: spotPrice, zone: 'unavailable' },
    },
    probabilityCone: [],
    confidence: 0,
  };
}

function isGexDegraded(gex: UnifiedGEXLandscape): boolean {
  return gex.spx.gexByStrike.length === 0 && gex.combined.gexByStrike.length === 0;
}

function getFallbackCoachMessages(snapshot: SPXSnapshot | null): CoachMessage[] {
  return snapshot?.coachMessages || [];
}

async function withStageFallback<T>(input: {
  stage: keyof typeof SNAPSHOT_STAGE_TIMEOUTS_MS;
  run: () => Promise<T>;
  fallback: () => T | Promise<T>;
  forceRefresh: boolean;
}): Promise<T> {
  const timeoutMs = SNAPSHOT_STAGE_TIMEOUTS_MS[input.stage];

  try {
    return await withTimeout(input.run(), timeoutMs);
  } catch (error) {
    logger.warn('SPX snapshot stage failed; using fallback', {
      stage: input.stage,
      timeoutMs,
      forceRefresh: input.forceRefresh,
      error: error instanceof Error ? error.message : String(error),
    });
    return await input.fallback();
  }
}

async function resolveGexFallback(
  forceRefresh: boolean,
  snapshot: SPXSnapshot | null,
): Promise<UnifiedGEXLandscape> {
  if (forceRefresh) {
    try {
      const cached = await getCachedUnifiedGEXLandscape();
      if (cached) {
        logger.warn('SPX GEX stage using cached unified landscape after force-refresh timeout');
        return cached;
      }
    } catch (error) {
      logger.warn('SPX GEX cached fallback lookup failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (!snapshot) {
      try {
        const recovered = await withTimeout(
          computeUnifiedGEXLandscape({ forceRefresh: false }),
          10_000,
        );
        if (recovered.combined.gexByStrike.length > 0) {
          logger.warn('SPX GEX stage recovered via in-flight refresh after timeout');
          return recovered;
        }
      } catch (error) {
        logger.warn('SPX GEX in-flight recovery fallback failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return snapshot?.gex || createNeutralGexLandscape(snapshot);
}

async function buildSnapshot(forceRefresh: boolean): Promise<SPXSnapshot> {
  const fallbackSnapshot = lastGoodSnapshot;

  const gex = await withStageFallback({
    stage: 'gex',
    forceRefresh,
    run: () => computeUnifiedGEXLandscape({ forceRefresh }),
    fallback: () => resolveGexFallback(forceRefresh, fallbackSnapshot),
  });

  const flow = await withStageFallback({
    stage: 'flow',
    forceRefresh,
    run: () => getFlowEvents({ forceRefresh }),
    fallback: () => fallbackSnapshot?.flow || [],
  });

  const basis = await withStageFallback({
    stage: 'basis',
    forceRefresh,
    run: () => getBasisState({ forceRefresh, gexLandscape: gex }),
    fallback: () => createNeutralBasisState(gex, fallbackSnapshot),
  });

  const spyImpact = await withStageFallback({
    stage: 'spyImpact',
    forceRefresh,
    run: () => getSpyImpactState({ forceRefresh, basisState: basis, gexLandscape: gex }),
    fallback: () => createNeutralSpyImpactState(basis, fallbackSnapshot),
  });

  const fibLevels = await withStageFallback({
    stage: 'fib',
    forceRefresh,
    run: () => getFibLevels({ forceRefresh, basisState: basis }),
    fallback: () => fallbackSnapshot?.fibLevels || [],
  });

  const levelData = await withStageFallback({
    stage: 'levels',
    forceRefresh,
    run: () => getMergedLevels({ forceRefresh, basisState: basis, gexLandscape: gex, fibLevels }),
    fallback: () => ({
      levels: fallbackSnapshot?.levels || [],
      clusters: fallbackSnapshot?.clusters || [],
      generatedAt: nowIso(),
    }),
  });

  const gexDegraded = isGexDegraded(gex);
  if (gexDegraded) {
    logger.warn('SPX snapshot using fail-closed setup pipeline due to degraded GEX data');
  }

  const regime = gexDegraded
    ? createNeutralRegimeState(fallbackSnapshot)
    : await withStageFallback({
      stage: 'regime',
      forceRefresh,
      run: () => classifyCurrentRegime({ forceRefresh, gexLandscape: gex, levelData }),
      fallback: () => createNeutralRegimeState(fallbackSnapshot),
    });

  const setupsRaw = gexDegraded
    ? (fallbackSnapshot?.setups || [])
    : await withStageFallback({
      stage: 'setups',
      forceRefresh,
      run: () => detectActiveSetups({
        forceRefresh,
        levelData,
        gexLandscape: gex,
        fibLevels,
        regimeState: regime,
        flowEvents: flow,
      }),
      fallback: () => fallbackSnapshot?.setups || [],
    });

  const prediction = gexDegraded
    ? createNeutralPredictionState(fallbackSnapshot, gex.spx.spotPrice)
    : await withStageFallback({
      stage: 'prediction',
      forceRefresh,
      run: () => getPredictionState({
        forceRefresh,
        regimeState: regime,
        levelData,
        gexLandscape: gex,
      }),
      fallback: () => createNeutralPredictionState(fallbackSnapshot, gex.spx.spotPrice),
    });

  const coachState = gexDegraded
    ? {
      messages: [
        ...getFallbackCoachMessages(fallbackSnapshot),
        {
          id: `gex_degraded_${Date.now()}`,
          type: 'alert' as const,
          priority: 'alert' as const,
          setupId: null,
          content: 'Gamma data degraded from Massive options feed. Fresh setups are paused; showing last confirmed state.',
          structuredData: {
            reason: 'gex_degraded',
            source: 'massive_options',
            failClosed: true,
          },
          timestamp: nowIso(),
        },
      ],
      generatedAt: nowIso(),
    }
    : await withStageFallback({
      stage: 'coach',
      forceRefresh,
      run: () => getCoachState({ forceRefresh, setups: setupsRaw, prediction }),
      fallback: () => ({
        messages: getFallbackCoachMessages(fallbackSnapshot),
        generatedAt: nowIso(),
      }),
    });

  const deadline = Date.now() + SNAPSHOT_CONTRACT_ENRICHMENT_BUDGET_MS;
  let inlineRecommendations = 0;
  const setups = await Promise.all(
    setupsRaw.map(async (setup) => {
      if (setup.status !== 'ready') return setup;
      if (inlineRecommendations >= SNAPSHOT_MAX_INLINE_RECOMMENDATIONS) return setup;

      const timeRemainingMs = deadline - Date.now();
      if (timeRemainingMs <= 300) return setup;

      inlineRecommendations += 1;
      try {
        const recommendation = await withTimeout(
          getContractRecommendation({ setupId: setup.id, setup, forceRefresh }),
          Math.max(300, timeRemainingMs),
        );
        return {
          ...setup,
          recommendedContract: recommendation,
        };
      } catch (error) {
        logger.warn('Skipping inline contract recommendation during snapshot due to latency', {
          setupId: setup.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return setup;
      }
    }),
  );

  return {
    levels: levelData.levels,
    clusters: levelData.clusters,
    fibLevels,
    gex,
    basis,
    spyImpact,
    setups,
    regime,
    prediction,
    flow,
    coachMessages: coachState.messages,
    generatedAt: nowIso(),
  };
}

function refreshSnapshot(forceRefresh: boolean): Promise<SPXSnapshot> {
  if (snapshotInFlight) {
    return snapshotInFlight;
  }

  snapshotInFlight = buildSnapshot(forceRefresh)
    .then((snapshot) => {
      lastGoodSnapshot = snapshot;
      lastGoodSnapshotAt = Date.now();
      void persistLastGoodSnapshot(snapshot);
      return snapshot;
    })
    .catch((error) => {
      if (lastGoodSnapshot) {
        logger.warn('SPX snapshot refresh failed; serving last good snapshot', {
          forceRefresh,
          error: error instanceof Error ? error.message : String(error),
        });
        return lastGoodSnapshot;
      }
      throw error;
    })
    .finally(() => {
      snapshotInFlight = null;
    });

  return snapshotInFlight;
}

export async function getSPXSnapshot(options?: { forceRefresh?: boolean }): Promise<SPXSnapshot> {
  const forceRefresh = options?.forceRefresh === true;
  if (!lastGoodSnapshot) {
    await hydrateLastGoodSnapshotFromCache();
  }

  if (forceRefresh) {
    return refreshSnapshot(true);
  }

  if (!lastGoodSnapshot) {
    return refreshSnapshot(false);
  }

  if (Date.now() - lastGoodSnapshotAt > SNAPSHOT_BACKGROUND_REFRESH_MS && !snapshotInFlight) {
    void refreshSnapshot(false);
  }

  return lastGoodSnapshot;
}
