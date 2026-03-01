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
import { getMultiTFConfluenceContext, type SPXMultiTFConfluenceContext } from './multiTFConfluence';
import { replaySnapshotWriter } from './replaySnapshotWriter';
import { classifyCurrentRegime } from './regimeClassifier';
import { resolveSymbolProfile } from './symbolProfile';
import {
  readSharedSnapshot,
  releaseSnapshotBuildLock,
  tryAcquireSnapshotBuildLock,
  waitForSharedSnapshot,
  writeSharedSnapshot,
} from './snapshotCoordination';
import { detectActiveSetups, getLatestSetupEnvironmentState } from './setupDetector';
import { applyTickStateToSetups, evaluateTickSetupTransitions, syncTickEvaluatorSetups, persistTickEvaluatorState } from './tickEvaluator';
import { getLatestTick, isTickStreamHealthy } from '../tickCache';
import type {
  BasisState,
  CoachMessage,
  PredictionState,
  RegimeState,
  SPXLevelsDataQuality,
  SpyImpactState,
  SPXSnapshot,
  SPXSnapshotDataQuality,
  SPXSnapshotStageQuality,
  UnifiedGEXLandscape,
} from './types';
import { nowIso } from './utils';

let snapshotInFlight: Promise<SPXSnapshot> | null = null;
let snapshotInFlightStartedAt = 0;
const SNAPSHOT_CONTRACT_ENRICHMENT_BUDGET_MS = 2500;
const SNAPSHOT_MAX_INLINE_RECOMMENDATIONS = 2;
const SNAPSHOT_BACKGROUND_REFRESH_MS = 20_000;
const SNAPSHOT_MAX_FALLBACK_AGE_MS = 5 * 60 * 1000; // 5-minute max age for fallback snapshot
const SNAPSHOT_INFLIGHT_STALENESS_MS = 10_000; // 10s — discard stale in-flight promise
const SNAPSHOT_TICK_HEALTH_MAX_AGE_MS = 12_000;
const SNAPSHOT_STAGE_TIMEOUTS_MS = {
  gex: 12_000,
  flow: 4_000,
  flowAggregation: 4_000,
  basis: 4_000,
  spyImpact: 4_000,
  fib: 5_000,
  levels: 5_000,
  multiTF: 4_000,
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

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}

// Throttled tick evaluator persistence — at most once per 30s
const TICK_PERSIST_THROTTLE_MS = 30_000;
let lastTickPersistAtMs = 0;
function throttledPersistTickState(): void {
  const now = Date.now();
  if (now - lastTickPersistAtMs < TICK_PERSIST_THROTTLE_MS) return;
  lastTickPersistAtMs = now;
  persistTickEvaluatorState().catch((err) => {
    logger.warn('Throttled tick evaluator persist failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
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

interface SetupStatusTransition {
  setupId: string;
  from: string;
  to: string;
}

function detectSetupStatusTransitions(
  previousSnapshot: SPXSnapshot | null,
  nextSnapshot: SPXSnapshot,
): SetupStatusTransition[] {
  if (!previousSnapshot) return [];

  const previousById = new Map<string, string>();
  for (const setup of previousSnapshot.setups || []) {
    previousById.set(setup.id, setup.status);
  }

  const transitions: SetupStatusTransition[] = [];
  const sortedNextSetups = [...(nextSnapshot.setups || [])].sort((left, right) => left.id.localeCompare(right.id));
  for (const setup of sortedNextSetups) {
    const previousStatus = previousById.get(setup.id);
    if (!previousStatus || previousStatus === setup.status) continue;

    transitions.push({
      setupId: setup.id,
      from: previousStatus,
      to: setup.status,
    });
  }

  return transitions;
}

function queueReplaySnapshotCapture(input: {
  snapshot: SPXSnapshot;
  previousSnapshot: SPXSnapshot | null;
  multiTFContext: SPXMultiTFConfluenceContext | null;
}): void {
  void (async () => {
    const transitions = detectSetupStatusTransitions(input.previousSnapshot, input.snapshot);
    const capturedAt = new Date(input.snapshot.generatedAt);
    const captureBase = {
      snapshot: input.snapshot,
      capturedAt,
      multiTFContext: input.multiTFContext,
    } as const;

    const capturePromises: Array<Promise<void>> = [
      replaySnapshotWriter.capture({
        ...captureBase,
        captureMode: 'interval',
      }),
      ...transitions.map(() => replaySnapshotWriter.capture({
        ...captureBase,
        captureMode: 'setup_transition',
      })),
    ];

    const captureResults = await Promise.allSettled(capturePromises);
    const failedCaptureCount = captureResults.filter((result) => result.status === 'rejected').length;

    if (failedCaptureCount > 0) {
      logger.warn('Replay snapshot capture failed (fail-open)', {
        failedCaptureCount,
        totalCaptureCalls: capturePromises.length,
        transitionCount: transitions.length,
      });
    }
  })().catch((error) => {
    logger.warn('Replay snapshot capture orchestration failed (fail-open)', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

type SnapshotStage = keyof typeof SNAPSHOT_STAGE_TIMEOUTS_MS;

interface StageFallbackResult<T> {
  value: T;
  quality: SPXSnapshotStageQuality;
}

function parseDateMs(value: unknown): number | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function extractQualityTimestamp(value: unknown, depth = 0): string | null {
  if (depth > 2) return null;
  if (typeof value === 'string' && parseDateMs(value) != null) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = extractQualityTimestamp(item, depth + 1);
      if (candidate) return candidate;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const directTimestampKeys = ['generatedAt', 'timestamp', 'latestEventAt', 'calculatedAt', 'updatedAt'];
  for (const key of directTimestampKeys) {
    const raw = candidate[key];
    if (typeof raw !== 'string') continue;
    if (parseDateMs(raw) != null) return raw;
  }

  const nestedKeys = ['spx', 'spy', 'combined', 'messages'];
  for (const key of nestedKeys) {
    if (!(key in candidate)) continue;
    const nested = extractQualityTimestamp(candidate[key], depth + 1);
    if (nested) return nested;
  }

  return null;
}

function extractQualitySource(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = (value as { source?: unknown }).source;
  if (typeof candidate !== 'string' || candidate.trim().length === 0) return null;
  return candidate.trim();
}

function buildStageQuality(input: {
  ok: boolean;
  value: unknown;
  degradedReason: string | null;
  completedAtMs: number;
}): SPXSnapshotStageQuality {
  const timestamp = extractQualityTimestamp(input.value);
  const timestampMs = parseDateMs(timestamp);
  const freshnessMs = timestampMs == null
    ? 0
    : Math.max(0, input.completedAtMs - timestampMs);

  return {
    ok: input.ok,
    source: extractQualitySource(input.value) || (input.ok ? 'primary' : 'fallback'),
    freshnessMs,
    degradedReason: input.degradedReason,
  };
}

async function withStageFallback<T>(input: {
  stage: SnapshotStage;
  run: () => Promise<T>;
  fallback: () => T;
  forceRefresh: boolean;
}): Promise<StageFallbackResult<T>> {
  const timeoutMs = SNAPSHOT_STAGE_TIMEOUTS_MS[input.stage];

  try {
    const value = await withTimeout(input.run(), timeoutMs);
    return {
      value,
      quality: buildStageQuality({
        ok: true,
        value,
        degradedReason: null,
        completedAtMs: Date.now(),
      }),
    };
  } catch (error) {
    const degradedReason = error instanceof Error ? error.message : String(error);
    logger.warn('SPX snapshot stage failed; using fallback', {
      stage: input.stage,
      timeoutMs,
      forceRefresh: input.forceRefresh,
      error: degradedReason,
    });
    const value = input.fallback();
    return {
      value,
      quality: buildStageQuality({
        ok: false,
        value,
        degradedReason,
        completedAtMs: Date.now(),
      }),
    };
  }
}

async function buildSnapshot(forceRefresh: boolean): Promise<SPXSnapshot> {
  // Bound fallback snapshot age to 5 minutes max (Audit CRITICAL-3, Cache domain).
  // If the last good snapshot is older than 5 minutes, stages that fail should
  // NOT return 20+ minute old data — they'll get null/empty defaults instead.
  const fallbackAge = Date.now() - lastGoodSnapshotAt;
  const fallbackSnapshot = (lastGoodSnapshot && fallbackAge <= SNAPSHOT_MAX_FALLBACK_AGE_MS)
    ? lastGoodSnapshot
    : null;
  const previousSnapshotForReplayCapture = lastGoodSnapshot;
  const tickHealth = isTickStreamHealthy('SPX', {
    maxAgeMs: SNAPSHOT_TICK_HEALTH_MAX_AGE_MS,
  });
  if (!tickHealth.healthy) {
    logger.warn('SPX snapshot tick freshness gate active', {
      reason: tickHealth.reason,
      ageMs: tickHealth.ageMs,
      maxAgeMs: SNAPSHOT_TICK_HEALTH_MAX_AGE_MS,
      hasFallbackSnapshot: Boolean(fallbackSnapshot),
    });
  }

  const symbolProfile = await resolveSymbolProfile({ symbol: 'SPX' });
  const stageQuality: SPXSnapshotDataQuality['stages'] = {};

  const [gexResult, flowResult] = await Promise.all([
    withStageFallback({
      stage: 'gex',
      forceRefresh,
      run: () => computeUnifiedGEXLandscape({ forceRefresh, profile: symbolProfile }),
      fallback: () => fallbackSnapshot?.gex || createNeutralGexLandscape(fallbackSnapshot),
    }),
    withStageFallback({
      stage: 'flow',
      forceRefresh,
      run: () => getFlowEvents({ forceRefresh, profile: symbolProfile }),
      fallback: () => fallbackSnapshot?.flow || [],
    }),
  ]);
  stageQuality.gex = gexResult.quality;
  stageQuality.flow = flowResult.quality;
  const gex = gexResult.value;
  const flow = flowResult.value;

  const flowAggregationResult = await withStageFallback({
    stage: 'flowAggregation',
    forceRefresh,
    run: () => getFlowWindowAggregation({
      forceRefresh,
      flowEvents: flow,
    }),
    fallback: () => fallbackSnapshot?.flowAggregation || createNeutralFlowWindowAggregation(),
  });
  stageQuality.flowAggregation = flowAggregationResult.quality;
  const flowAggregation = flowAggregationResult.value;

  const basisResult = await withStageFallback({
    stage: 'basis',
    forceRefresh,
    run: () => getBasisState({ forceRefresh, gexLandscape: gex }),
    fallback: () => createNeutralBasisState(gex, fallbackSnapshot),
  });
  stageQuality.basis = basisResult.quality;
  const basis = basisResult.value;

  const spyImpactResult = await withStageFallback({
    stage: 'spyImpact',
    forceRefresh,
    run: () => getSpyImpactState({ forceRefresh, basisState: basis, gexLandscape: gex }),
    fallback: () => createNeutralSpyImpactState(basis, fallbackSnapshot),
  });
  stageQuality.spyImpact = spyImpactResult.quality;
  const spyImpact = spyImpactResult.value;

  const fibLevelsResult = await withStageFallback({
    stage: 'fib',
    forceRefresh,
    run: () => getFibLevels({ forceRefresh, basisState: basis }),
    fallback: () => fallbackSnapshot?.fibLevels || [],
  });
  stageQuality.fib = fibLevelsResult.quality;
  const fibLevels = fibLevelsResult.value;

  const levelDataResult = await withStageFallback({
    stage: 'levels',
    forceRefresh,
    run: async () => {
      if (!tickHealth.healthy) {
        // Keep levels available even when the tick stream is stale by reusing
        // last known levels or a degraded cache-backed recompute.
        if (lastGoodSnapshot?.levels?.length) {
          return {
            levels: lastGoodSnapshot.levels,
            clusters: lastGoodSnapshot.clusters || [],
            generatedAt: nowIso(),
          };
        }
        return getMergedLevels({
          forceRefresh: false,
          profile: symbolProfile,
          basisState: basis,
          gexLandscape: gex,
          fibLevels,
        });
      }
      return getMergedLevels({
        forceRefresh,
        profile: symbolProfile,
        basisState: basis,
        gexLandscape: gex,
        fibLevels,
      });
    },
    fallback: () => ({
      levels: fallbackSnapshot?.levels || lastGoodSnapshot?.levels || [],
      clusters: fallbackSnapshot?.clusters || lastGoodSnapshot?.clusters || [],
      generatedAt: nowIso(),
    }),
  });
  stageQuality.levels = levelDataResult.quality;
  const levelData = levelDataResult.value;

  const regimeResult = await withStageFallback({
    stage: 'regime',
    forceRefresh,
    run: () => classifyCurrentRegime({ forceRefresh, profile: symbolProfile, gexLandscape: gex, levelData }),
    fallback: () => createNeutralRegimeState(fallbackSnapshot),
  });
  stageQuality.regime = regimeResult.quality;
  const regime = regimeResult.value;

  const multiTFEnabled = parseBooleanEnv(process.env.SPX_MULTI_TF_CONFLUENCE_ENABLED, false);
  const multiTFResult = multiTFEnabled
    ? await withStageFallback({
      stage: 'multiTF',
      forceRefresh,
      run: () => getMultiTFConfluenceContext({ forceRefresh, profile: symbolProfile }),
      fallback: () => null as SPXMultiTFConfluenceContext | null,
    })
    : {
      value: null as SPXMultiTFConfluenceContext | null,
      quality: {
        ok: true,
        source: 'disabled',
        freshnessMs: 0,
        degradedReason: null,
      } satisfies SPXSnapshotStageQuality,
    };
  stageQuality.multiTF = multiTFResult.quality;
  const multiTFContextForReplay = multiTFResult.value;

  const setupsRawResult = await withStageFallback({
    stage: 'setups',
    forceRefresh,
      run: () => detectActiveSetups({
        forceRefresh,
        profile: symbolProfile,
        levelData,
        gexLandscape: gex,
        fibLevels,
      regimeState: regime,
      flowEvents: flow,
      ...(multiTFContextForReplay ? { multiTFConfluenceOverride: multiTFContextForReplay } : {}),
    }),
    fallback: () => fallbackSnapshot?.setups || [],
  });
  stageQuality.setups = setupsRawResult.quality;
  const setupsRaw = setupsRawResult.value;
  syncTickEvaluatorSetups(setupsRaw);
  const latestSpxTick = getLatestTick('SPX');
  if (latestSpxTick) {
    const transitions = evaluateTickSetupTransitions(latestSpxTick);
    // Persist tick evaluator state to Redis after transitions (throttled to once per 30s)
    if (transitions.length > 0) {
      throttledPersistTickState();
    }
  }
  const setupsTickAdjusted = applyTickStateToSetups(setupsRaw);

  const predictionResult = await withStageFallback({
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
  stageQuality.prediction = predictionResult.quality;
  const prediction = predictionResult.value;

  const coachStateResult = await withStageFallback({
    stage: 'coach',
    forceRefresh,
    run: () => getCoachState({ forceRefresh, setups: setupsTickAdjusted, prediction }),
    fallback: () => ({
      messages: getFallbackCoachMessages(fallbackSnapshot),
      generatedAt: nowIso(),
    }),
  });
  stageQuality.coach = coachStateResult.quality;
  const coachState = coachStateResult.value;

  const deadline = Date.now() + SNAPSHOT_CONTRACT_ENRICHMENT_BUDGET_MS;
  let inlineRecommendations = 0;
  const setups = await Promise.all(
    setupsTickAdjusted.map(async (setup) => {
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
  const degradedReasons = (Object.entries(stageQuality) as Array<[SnapshotStage, SPXSnapshotStageQuality | undefined]>)
    .filter(([, quality]) => Boolean(quality && quality.ok === false))
    .map(([stage, quality]) => `${stage}:${quality?.degradedReason || 'fallback'}`);
  if (!tickHealth.healthy) {
    degradedReasons.push(`tick_stream:${tickHealth.reason || 'stale'}`);
  }
  const dataQuality: SPXSnapshotDataQuality = {
    generatedAt: nowIso(),
    degraded: degradedReasons.length > 0,
    degradedReasons,
    stages: stageQuality,
  };
  const levelsDataQuality: SPXLevelsDataQuality = {
    integrity: dataQuality.degraded ? 'degraded' : 'full',
    warnings: Array.from(new Set(degradedReasons)),
  };

  const snapshot: SPXSnapshot = {
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
    dataQuality,
    levelsDataQuality,
    environmentGate: setupEnvironmentState?.gate || null,
    standbyGuidance: setupEnvironmentState?.standbyGuidance || null,
    generatedAt: nowIso(),
  };

  queueReplaySnapshotCapture({
    snapshot,
    previousSnapshot: previousSnapshotForReplayCapture,
    multiTFContext: multiTFContextForReplay,
  });

  return snapshot;
}

function refreshSnapshot(forceRefresh: boolean): Promise<SPXSnapshot> {
  // Discard stale in-flight promise if it's been running longer than 10 seconds
  // (Audit CRITICAL-2, Cache domain). Prevents new requests from receiving
  // data that's aging while a slow GEX/flow stage holds up the promise.
  if (snapshotInFlight) {
    const inFlightAge = Date.now() - snapshotInFlightStartedAt;
    if (inFlightAge <= SNAPSHOT_INFLIGHT_STALENESS_MS) {
      return snapshotInFlight;
    }
    logger.warn('SPX snapshot in-flight promise stale; starting fresh build', {
      inFlightAgeMs: inFlightAge,
    });
    // Let the old promise resolve on its own; start a new one
  }

  snapshotInFlightStartedAt = Date.now();
  snapshotInFlight = (async () => {
    const cachedSharedSnapshot = !forceRefresh
      ? await readSharedSnapshot()
      : null;
    if (cachedSharedSnapshot) {
      logger.info('SPX snapshot served from distributed shared cache');
      return cachedSharedSnapshot;
    }

    const lockOwnerToken = await tryAcquireSnapshotBuildLock();
    if (lockOwnerToken) {
      try {
        const builtSnapshot = await buildSnapshot(forceRefresh);
        await writeSharedSnapshot(builtSnapshot);
        return builtSnapshot;
      } finally {
        await releaseSnapshotBuildLock(lockOwnerToken);
      }
    }

    const waitedSnapshot = await waitForSharedSnapshot();
    if (waitedSnapshot) {
      logger.info('SPX snapshot served after waiting on distributed build lock');
      return waitedSnapshot;
    }

    logger.warn('SPX snapshot distributed coordination fallback: lock wait timed out, building locally');
    return buildSnapshot(forceRefresh);
  })()
    .then((snapshot) => {
      lastGoodSnapshot = snapshot;
      lastGoodSnapshotAt = Date.now();
      return snapshot;
    })
    .catch(async (error) => {
      const sharedSnapshot = await readSharedSnapshot();
      if (sharedSnapshot) {
        logger.warn('SPX snapshot refresh failed; serving distributed shared snapshot', {
          forceRefresh,
          error: error instanceof Error ? error.message : String(error),
        });
        return sharedSnapshot;
      }
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
