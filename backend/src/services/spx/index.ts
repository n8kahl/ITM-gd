import { getPredictionState } from './aiPredictor';
import { getCoachState } from './aiCoach';
import { getContractRecommendation } from './contractSelector';
import { getBasisState, getSpyImpactState } from './crossReference';
import { getFibLevels } from './fibEngine';
import { getFlowEvents } from './flowEngine';
import { createNeutralFlowWindowAggregation, getFlowWindowAggregation } from './flowAggregator';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { getMergedLevels } from './levelEngine';
import { logger } from '../../lib/logger';
import { classifyCurrentRegime } from './regimeClassifier';
import { detectActiveSetups, getLatestSetupEnvironmentState } from './setupDetector';
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
const SNAPSHOT_STAGE_TIMEOUTS_MS = {
  gex: 12_000,
  flow: 4_000,
  flowAggregation: 4_000,
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

function getFallbackCoachMessages(snapshot: SPXSnapshot | null): CoachMessage[] {
  return snapshot?.coachMessages || [];
}

async function withStageFallback<T>(input: {
  stage: keyof typeof SNAPSHOT_STAGE_TIMEOUTS_MS;
  run: () => Promise<T>;
  fallback: () => T;
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
    return input.fallback();
  }
}

async function buildSnapshot(forceRefresh: boolean): Promise<SPXSnapshot> {
  const fallbackSnapshot = lastGoodSnapshot;

  const [gex, flow] = await Promise.all([
    withStageFallback({
      stage: 'gex',
      forceRefresh,
      run: () => computeUnifiedGEXLandscape({ forceRefresh }),
      fallback: () => fallbackSnapshot?.gex || createNeutralGexLandscape(fallbackSnapshot),
    }),
    withStageFallback({
      stage: 'flow',
      forceRefresh,
      run: () => getFlowEvents({ forceRefresh }),
      fallback: () => fallbackSnapshot?.flow || [],
    }),
  ]);
  const flowAggregation = await withStageFallback({
    stage: 'flowAggregation',
    forceRefresh,
    run: () => getFlowWindowAggregation({
      forceRefresh,
      flowEvents: flow,
    }),
    fallback: () => fallbackSnapshot?.flowAggregation || createNeutralFlowWindowAggregation(),
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

  const regime = await withStageFallback({
    stage: 'regime',
    forceRefresh,
    run: () => classifyCurrentRegime({ forceRefresh, gexLandscape: gex, levelData }),
    fallback: () => createNeutralRegimeState(fallbackSnapshot),
  });

  const setupsRaw = await withStageFallback({
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

  const prediction = await withStageFallback({
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

  const coachState = await withStageFallback({
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
  const setupEnvironmentState = await getLatestSetupEnvironmentState();

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
    flowAggregation,
    coachMessages: coachState.messages,
    environmentGate: setupEnvironmentState?.gate || null,
    standbyGuidance: setupEnvironmentState?.standbyGuidance || null,
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
