import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import { getFibLevels } from './fibEngine';
import { getFlowEvents } from './flowEngine';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { getMergedLevels } from './levelEngine';
import { classifyCurrentRegime } from './regimeClassifier';
import type {
  ClusterZone,
  FibLevel,
  Regime,
  RegimeState,
  Setup,
  SetupInvalidationReason,
  SetupType,
  SPXFlowEvent,
  SPXLevel,
  UnifiedGEXLandscape,
} from './types';
import { nowIso, round, stableId } from './utils';

const SETUPS_CACHE_KEY = 'spx_command_center:setups';
const SETUPS_CACHE_TTL_SECONDS = 10;
let setupsInFlight: Promise<Setup[]> | null = null;
const FLOW_CONFIRMATION_WINDOW_MS = 20 * 60 * 1000;
const FLOW_ZONE_TOLERANCE_POINTS = 12;
const FLOW_MIN_DIRECTIONAL_PREMIUM = 75_000;
const FLOW_MIN_LOCAL_PREMIUM = 150_000;
const FLOW_MIN_LOCAL_EVENTS = 2;
const CONTEXT_STREAK_TTL_MS = 30 * 60 * 1000;

const DEFAULT_REGIME_CONFLICT_CONFIDENCE_THRESHOLD = 68;
const DEFAULT_FLOW_DIVERGENCE_ALIGNMENT_THRESHOLD = 38;
const DEFAULT_CONTEXT_DEMOTION_STREAK = 2;
const DEFAULT_CONTEXT_INVALIDATION_STREAK = 3;
const DEFAULT_STOP_CONFIRMATION_TICKS = 2;
const DEFAULT_TTL_FORMING_MS = 20 * 60 * 1000;
const DEFAULT_TTL_READY_MS = 25 * 60 * 1000;
const DEFAULT_TTL_TRIGGERED_MS = 90 * 60 * 1000;

interface SetupLifecycleConfig {
  lifecycleEnabled: boolean;
  telemetryEnabled: boolean;
  regimeConflictConfidenceThreshold: number;
  flowDivergenceAlignmentThreshold: number;
  contextDemotionStreak: number;
  contextInvalidationStreak: number;
  stopConfirmationTicks: number;
  ttlFormingMs: number;
  ttlReadyMs: number;
  ttlTriggeredMs: number;
}

interface SetupContextState {
  regimeConflictStreak: number;
  flowDivergenceStreak: number;
  stopBreachStreak: number;
  updatedAtMs: number;
}
const setupContextStateById = new Map<string, SetupContextState>();
type LevelData = {
  levels: SPXLevel[];
  clusters: ClusterZone[];
  generatedAt: string;
};
const WIN_RATE_BY_SCORE: Record<number, number> = {
  1: 35,
  2: 45,
  3: 58,
  4: 71,
  5: 82,
};

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function parseIntEnv(value: string | undefined, fallback: number, minimum = 0): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(parsed, minimum);
}

function getSetupLifecycleConfig(): SetupLifecycleConfig {
  return {
    lifecycleEnabled: parseBooleanEnv(process.env.SPX_SETUP_LIFECYCLE_ENABLED, true),
    telemetryEnabled: parseBooleanEnv(process.env.SPX_SETUP_TRANSITION_TELEMETRY_ENABLED, true),
    regimeConflictConfidenceThreshold: parseIntEnv(
      process.env.SPX_SETUP_REGIME_CONFLICT_CONFIDENCE_THRESHOLD,
      DEFAULT_REGIME_CONFLICT_CONFIDENCE_THRESHOLD,
      0,
    ),
    flowDivergenceAlignmentThreshold: parseIntEnv(
      process.env.SPX_SETUP_FLOW_DIVERGENCE_THRESHOLD,
      DEFAULT_FLOW_DIVERGENCE_ALIGNMENT_THRESHOLD,
      0,
    ),
    contextDemotionStreak: parseIntEnv(
      process.env.SPX_SETUP_DEMOTION_STREAK,
      DEFAULT_CONTEXT_DEMOTION_STREAK,
      1,
    ),
    contextInvalidationStreak: parseIntEnv(
      process.env.SPX_SETUP_INVALIDATION_STREAK,
      DEFAULT_CONTEXT_INVALIDATION_STREAK,
      1,
    ),
    stopConfirmationTicks: parseIntEnv(
      process.env.SPX_SETUP_STOP_CONFIRMATION_TICKS,
      DEFAULT_STOP_CONFIRMATION_TICKS,
      1,
    ),
    ttlFormingMs: parseIntEnv(
      process.env.SPX_SETUP_TTL_FORMING_MS,
      DEFAULT_TTL_FORMING_MS,
      60_000,
    ),
    ttlReadyMs: parseIntEnv(
      process.env.SPX_SETUP_TTL_READY_MS,
      DEFAULT_TTL_READY_MS,
      60_000,
    ),
    ttlTriggeredMs: parseIntEnv(
      process.env.SPX_SETUP_TTL_TRIGGERED_MS,
      DEFAULT_TTL_TRIGGERED_MS,
      60_000,
    ),
  };
}

function setupTypeForRegime(regime: Regime): SetupType {
  switch (regime) {
    case 'ranging':
      return 'fade_at_wall';
    case 'breakout':
      return 'breakout_vacuum';
    case 'trending':
      return 'trend_continuation';
    case 'compression':
    default:
      return 'mean_reversion';
  }
}

function isRegimeAligned(type: SetupType, regime: Regime): boolean {
  return (
    (type === 'fade_at_wall' && regime === 'ranging')
    || (type === 'breakout_vacuum' && regime === 'breakout')
    || (type === 'trend_continuation' && regime === 'trending')
    || (type === 'mean_reversion' && regime === 'compression')
  );
}

function setupDirection(zone: ClusterZone, currentPrice: number): 'bullish' | 'bearish' {
  const center = (zone.priceLow + zone.priceHigh) / 2;
  return center <= currentPrice ? 'bullish' : 'bearish';
}

function getTargetPrice(
  zones: ClusterZone[],
  currentPrice: number,
  direction: 'bullish' | 'bearish',
  fallbackDistance: number,
): { target1: number; target2: number } {
  const sorted = [...zones].sort((a, b) => a.priceLow - b.priceLow);

  if (direction === 'bullish') {
    const above = sorted.filter((zone) => zone.priceLow > currentPrice);
    const first = above[0];
    const second = above[1];
    return {
      target1: first ? round((first.priceLow + first.priceHigh) / 2, 2) : round(currentPrice + fallbackDistance, 2),
      target2: second ? round((second.priceLow + second.priceHigh) / 2, 2) : round(currentPrice + fallbackDistance * 2, 2),
    };
  }

  const below = sorted.filter((zone) => zone.priceHigh < currentPrice).sort((a, b) => b.priceHigh - a.priceHigh);
  const first = below[0];
  const second = below[1];
  return {
    target1: first ? round((first.priceLow + first.priceHigh) / 2, 2) : round(currentPrice - fallbackDistance, 2),
    target2: second ? round((second.priceLow + second.priceHigh) / 2, 2) : round(currentPrice - fallbackDistance * 2, 2),
  };
}

function calculateConfluence(input: {
  zone: ClusterZone;
  direction: 'bullish' | 'bearish';
  currentPrice: number;
  flipPoint: number;
  netGex: number;
  fibTouch: boolean;
  regimeAligned: boolean;
  flowConfirmed: boolean;
}): { score: number; sources: string[] } {
  const sources: string[] = [];

  if (input.zone.type === 'fortress' || input.zone.type === 'defended') {
    sources.push('level_quality');
  }

  const gexAligned = input.direction === 'bullish'
    ? input.currentPrice >= input.flipPoint || input.netGex > 0
    : input.currentPrice <= input.flipPoint || input.netGex < 0;

  if (gexAligned) sources.push('gex_alignment');
  if (input.flowConfirmed) sources.push('flow_confirmation');
  if (input.fibTouch) sources.push('fibonacci_touch');
  if (input.regimeAligned) sources.push('regime_alignment');

  return {
    score: Math.min(5, sources.length),
    sources,
  };
}

function pickCandidateZones(zones: ClusterZone[], currentPrice: number): ClusterZone[] {
  return [...zones]
    .map((zone) => {
      const center = (zone.priceLow + zone.priceHigh) / 2;
      return {
        zone,
        distance: Math.abs(center - currentPrice),
      };
    })
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return b.zone.clusterScore - a.zone.clusterScore;
    })
    .slice(0, 8)
    .map((item) => item.zone);
}

function isRecentFlowEvent(event: SPXFlowEvent, nowMs: number): boolean {
  const eventMs = Date.parse(event.timestamp);
  if (!Number.isFinite(eventMs)) return false;
  return nowMs - eventMs <= FLOW_CONFIRMATION_WINDOW_MS;
}

function hasFlowConfirmation(input: {
  flowEvents: SPXFlowEvent[];
  direction: 'bullish' | 'bearish';
  zoneCenter: number;
  nowMs: number;
}): boolean {
  const directional = input.flowEvents.filter((event) => (
    event.direction === input.direction && isRecentFlowEvent(event, input.nowMs)
  ));

  if (directional.length === 0) return false;

  const directionalPremium = directional.reduce((sum, event) => sum + event.premium, 0);
  if (directionalPremium < FLOW_MIN_DIRECTIONAL_PREMIUM) return false;

  const local = directional.filter((event) => Math.abs(event.strike - input.zoneCenter) <= FLOW_ZONE_TOLERANCE_POINTS);
  const localPremium = local.reduce((sum, event) => sum + event.premium, 0);

  return (
    localPremium >= FLOW_MIN_LOCAL_PREMIUM
    || (local.length >= FLOW_MIN_LOCAL_EVENTS && localPremium >= FLOW_MIN_DIRECTIONAL_PREMIUM)
  );
}

function flowAlignmentPercent(input: {
  flowEvents: SPXFlowEvent[];
  direction: 'bullish' | 'bearish';
  nowMs: number;
}): number | null {
  const recentDirectional = input.flowEvents.filter((event) => (
    isRecentFlowEvent(event, input.nowMs)
      && (event.direction === 'bullish' || event.direction === 'bearish')
  ));

  const bullishPremium = recentDirectional
    .filter((event) => event.direction === 'bullish')
    .reduce((sum, event) => sum + event.premium, 0);
  const bearishPremium = recentDirectional
    .filter((event) => event.direction === 'bearish')
    .reduce((sum, event) => sum + event.premium, 0);

  const totalPremium = bullishPremium + bearishPremium;
  if (totalPremium < FLOW_MIN_DIRECTIONAL_PREMIUM) return null;

  const alignedPremium = input.direction === 'bullish' ? bullishPremium : bearishPremium;
  return (alignedPremium / totalPremium) * 100;
}

function hasRegimeConflict(
  direction: 'bullish' | 'bearish',
  regimeState: RegimeState,
  confidenceThreshold: number,
): boolean {
  if (regimeState.confidence < confidenceThreshold) return false;
  if (regimeState.direction === 'neutral') return false;
  return regimeState.direction !== direction;
}

function updateSetupContextState(input: {
  setupId: string;
  nowMs: number;
  regimeConflict: boolean;
  flowDivergence: boolean;
  stopBreach: boolean;
}): SetupContextState {
  const previous = setupContextStateById.get(input.setupId);
  const stale = !previous || (input.nowMs - previous.updatedAtMs > CONTEXT_STREAK_TTL_MS);
  const base = stale
    ? {
      regimeConflictStreak: 0,
      flowDivergenceStreak: 0,
      stopBreachStreak: 0,
      updatedAtMs: input.nowMs,
    }
    : previous;

  const next: SetupContextState = {
    regimeConflictStreak: input.regimeConflict ? base.regimeConflictStreak + 1 : 0,
    flowDivergenceStreak: input.flowDivergence ? base.flowDivergenceStreak + 1 : 0,
    stopBreachStreak: input.stopBreach ? base.stopBreachStreak + 1 : 0,
    updatedAtMs: input.nowMs,
  };

  setupContextStateById.set(input.setupId, next);
  return next;
}

function pruneSetupContextState(activeSetupIds: Set<string>, nowMs: number): void {
  for (const [setupId, state] of setupContextStateById.entries()) {
    const stale = nowMs - state.updatedAtMs > CONTEXT_STREAK_TTL_MS;
    if (stale || !activeSetupIds.has(setupId)) {
      setupContextStateById.delete(setupId);
    }
  }
}

function isPriceInsideEntry(setup: Pick<Setup, 'entryZone'>, price: number): boolean {
  return price >= setup.entryZone.low && price <= setup.entryZone.high;
}

function isStopBreached(setup: Pick<Setup, 'direction' | 'stop'>, price: number): boolean {
  return setup.direction === 'bullish'
    ? price <= setup.stop
    : price >= setup.stop;
}

function isTarget2Reached(setup: Pick<Setup, 'direction' | 'target2'>, price: number): boolean {
  return setup.direction === 'bullish'
    ? price >= setup.target2.price
    : price <= setup.target2.price;
}

function toEpochMs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveLifecycleStatus(input: {
  computedStatus: Setup['status'];
  currentPrice: number;
  fallbackDistance: number;
  setup: Pick<Setup, 'direction' | 'entryZone' | 'stop' | 'target2'>;
  previous: Setup | null;
}): Setup['status'] {
  const previous = input.previous;
  let status: Setup['status'] = input.computedStatus;

  const wasTriggered = previous?.status === 'triggered';
  const isTriggeredNow = status === 'triggered';

  if (wasTriggered && previous) {
    if (isTarget2Reached(previous, input.currentPrice)) {
      return 'expired';
    }
  }

  // Once triggered, keep setup in triggered state until explicit resolution.
  if (wasTriggered && !isTriggeredNow) {
    status = 'triggered';
  }

  if ((wasTriggered || isTriggeredNow) && isTarget2Reached(input.setup, input.currentPrice)) {
    return 'expired';
  }

  if (status === 'forming' || status === 'ready') {
    const zoneMid = (input.setup.entryZone.low + input.setup.entryZone.high) / 2;
    const staleDistance = Math.max(18, input.fallbackDistance * 2.5);
    if (Math.abs(input.currentPrice - zoneMid) > staleDistance) {
      return 'expired';
    }
  }

  return status;
}

function ttlMsForStatus(status: Setup['status'], config: SetupLifecycleConfig): number | null {
  if (status === 'forming') return config.ttlFormingMs;
  if (status === 'ready') return config.ttlReadyMs;
  if (status === 'triggered') return config.ttlTriggeredMs;
  return null;
}

function resolveContextInvalidationReason(input: {
  contextState: SetupContextState;
  config: SetupLifecycleConfig;
}): SetupInvalidationReason | null {
  const { contextState, config } = input;
  const regimeInvalidates = contextState.regimeConflictStreak >= config.contextInvalidationStreak;
  const flowInvalidates = contextState.flowDivergenceStreak >= config.contextInvalidationStreak;
  if (!regimeInvalidates && !flowInvalidates) return null;
  if (regimeInvalidates && flowInvalidates) {
    return contextState.regimeConflictStreak >= contextState.flowDivergenceStreak
      ? 'regime_conflict'
      : 'flow_divergence';
  }
  return regimeInvalidates ? 'regime_conflict' : 'flow_divergence';
}

function resolveLifecycleMetadata(input: {
  nowMs: number;
  currentStatus: Setup['status'];
  previous: Setup | null;
  invalidationReason: SetupInvalidationReason | null;
  config: SetupLifecycleConfig;
}): {
  status: Setup['status'];
  statusUpdatedAt: string;
  ttlExpiresAt: string | null;
  invalidationReason: SetupInvalidationReason | null;
} {
  let status = input.currentStatus;
  let invalidationReason = status === 'invalidated' ? input.invalidationReason || 'unknown' : null;

  const previousStatus = input.previous?.status || null;
  const previousStatusUpdatedAtMs = toEpochMs(input.previous?.statusUpdatedAt || input.previous?.createdAt || null);
  let statusAnchorMs = previousStatus === status && previousStatusUpdatedAtMs > 0
    ? previousStatusUpdatedAtMs
    : input.nowMs;

  const ttlMs = ttlMsForStatus(status, input.config);
  let ttlExpiresAt: string | null = ttlMs ? new Date(statusAnchorMs + ttlMs).toISOString() : null;

  if (ttlMs && input.nowMs > statusAnchorMs + ttlMs) {
    if (status === 'triggered') {
      status = 'invalidated';
      invalidationReason = 'ttl_expired';
    } else {
      status = 'expired';
      invalidationReason = null;
    }
    statusAnchorMs = input.nowMs;
    ttlExpiresAt = null;
  }

  if (status === 'invalidated' && !invalidationReason) {
    invalidationReason = input.previous?.invalidationReason || 'unknown';
  }
  if (status !== 'invalidated') {
    invalidationReason = null;
  }
  if (status === 'expired' || status === 'invalidated') {
    ttlExpiresAt = null;
  }

  return {
    status,
    statusUpdatedAt: new Date(statusAnchorMs).toISOString(),
    ttlExpiresAt,
    invalidationReason,
  };
}

export async function detectActiveSetups(options?: {
  forceRefresh?: boolean;
  levelData?: LevelData;
  gexLandscape?: UnifiedGEXLandscape;
  fibLevels?: FibLevel[];
  regimeState?: RegimeState;
  flowEvents?: SPXFlowEvent[];
}): Promise<Setup[]> {
  const levelData = options?.levelData;
  const gexLandscape = options?.gexLandscape;
  const fibLevelsProvided = options?.fibLevels;
  const regimeStateProvided = options?.regimeState;
  const flowEventsProvided = options?.flowEvents;
  const forceRefresh = options?.forceRefresh === true;
  const hasPrecomputedDependencies = Boolean(levelData || gexLandscape || fibLevelsProvided || regimeStateProvided || flowEventsProvided);
  if (!forceRefresh && setupsInFlight) {
    return setupsInFlight;
  }

  const run = async (): Promise<Setup[]> => {
  if (!forceRefresh && !hasPrecomputedDependencies) {
    const cached = await cacheGet<Setup[]>(SETUPS_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const previousSetups = await cacheGet<Setup[]>(SETUPS_CACHE_KEY);
  const previousById = new Map<string, Setup>(
    (previousSetups || []).map((setup) => [setup.id, setup]),
  );

  const [levels, gex, fibLevels, regimeState, flowEvents] = await Promise.all([
    levelData
      ? Promise.resolve(levelData)
      : getMergedLevels({ forceRefresh }),
    gexLandscape
      ? Promise.resolve(gexLandscape)
      : computeUnifiedGEXLandscape({ forceRefresh }),
    fibLevelsProvided
      ? Promise.resolve(fibLevelsProvided)
      : getFibLevels({ forceRefresh }),
    regimeStateProvided
      ? Promise.resolve(regimeStateProvided)
      : classifyCurrentRegime({ forceRefresh }),
    flowEventsProvided
      ? Promise.resolve(flowEventsProvided)
      : getFlowEvents({ forceRefresh }),
  ]);

  const currentPrice = gex.spx.spotPrice;
  const candidateZones = pickCandidateZones(levels.clusters, currentPrice);
  const setupType = setupTypeForRegime(regimeState.regime);
  const nowMs = Date.now();
  const lifecycleConfig = getSetupLifecycleConfig();

  const sessionDate = toEasternTime(new Date()).dateStr;

  const setups: Setup[] = candidateZones.map((zone) => {
    const direction = setupDirection(zone, currentPrice);
    const zoneCenter = (zone.priceLow + zone.priceHigh) / 2;
    const regimeConflict = hasRegimeConflict(
      direction,
      regimeState,
      lifecycleConfig.regimeConflictConfidenceThreshold,
    );
    const alignmentPct = flowAlignmentPercent({
      flowEvents,
      direction,
      nowMs,
    });
    const flowDivergence = alignmentPct != null
      && alignmentPct < lifecycleConfig.flowDivergenceAlignmentThreshold;

    const fibTouch = fibLevels.some((fib) => Math.abs(fib.price - zoneCenter) <= 0.5);
    const flowConfirmed = hasFlowConfirmation({
      flowEvents,
      direction,
      zoneCenter,
      nowMs,
    });
    const regimeAligned = isRegimeAligned(setupType, regimeState.regime);

    const confluence = calculateConfluence({
      zone,
      direction,
      currentPrice,
      flipPoint: gex.combined.flipPoint,
      netGex: gex.combined.netGex,
      fibTouch,
      regimeAligned,
      flowConfirmed,
    });

    const fallbackDistance = Math.max(6, Math.abs(gex.combined.callWall - gex.combined.putWall) / 4);
    const { target1, target2 } = getTargetPrice(levels.clusters, zoneCenter, direction, fallbackDistance);

    const entryLow = round(zone.priceLow, 2);
    const entryHigh = round(zone.priceHigh, 2);
    const stop = direction === 'bullish'
      ? round(zone.priceLow - (zone.type === 'fortress' ? 2.5 : 1.5), 2)
      : round(zone.priceHigh + (zone.type === 'fortress' ? 2.5 : 1.5), 2);

    let computedStatus: Setup['status'] = confluence.score >= 3 ? 'ready' : 'forming';
    if (isPriceInsideEntry({ entryZone: { low: entryLow, high: entryHigh } }, currentPrice)) {
      computedStatus = 'triggered';
    }

    const setupIdSeed = [
      sessionDate,
      setupType,
      zone.id,
      round(zone.priceLow, 2),
      round(zone.priceHigh, 2),
    ].join('|');
    const setupId = stableId('spx_setup', setupIdSeed);
    const previous = previousById.get(setupId) || null;
    const lifecycleSetup = previous?.status === 'triggered'
      ? {
        direction: previous.direction,
        entryZone: previous.entryZone,
        stop: previous.stop,
        target2: previous.target2,
      }
      : {
        direction,
        entryZone: { low: entryLow, high: entryHigh },
        stop,
        target2: { price: target2, label: 'Target 2' as const },
      };
    const stopBreachedNow = isStopBreached({
      direction: lifecycleSetup.direction,
      stop: lifecycleSetup.stop,
    }, currentPrice);
    const contextState = updateSetupContextState({
      setupId,
      nowMs,
      regimeConflict,
      flowDivergence,
      stopBreach: stopBreachedNow,
    });

    let status = resolveLifecycleStatus({
      computedStatus,
      currentPrice,
      fallbackDistance,
      setup: lifecycleSetup,
      previous,
    });

    let invalidationReason: SetupInvalidationReason | null = null;
    if (lifecycleConfig.lifecycleEnabled) {
      const contextInvalidationReason = resolveContextInvalidationReason({
        contextState,
        config: lifecycleConfig,
      });
      const contextDemote = contextState.regimeConflictStreak >= lifecycleConfig.contextDemotionStreak
        || contextState.flowDivergenceStreak >= lifecycleConfig.contextDemotionStreak;
      const stopBreachedConfirmed = contextState.stopBreachStreak >= lifecycleConfig.stopConfirmationTicks;

      if ((status === 'ready' || status === 'triggered') && stopBreachedConfirmed) {
        status = 'invalidated';
        invalidationReason = 'stop_breach_confirmed';
      } else if (status === 'triggered' && contextInvalidationReason) {
        status = 'invalidated';
        invalidationReason = contextInvalidationReason;
      } else if (status === 'ready' && contextDemote) {
        status = 'forming';
      }
    }

    let triggeredAt: string | null = previous?.triggeredAt || null;
    if (status === 'triggered' && !triggeredAt) {
      triggeredAt = nowIso();
    }
    if (status !== 'triggered' && status !== 'invalidated' && status !== 'expired') {
      triggeredAt = null;
    }

    const createdAt = previous?.createdAt || nowIso();
    const lifecycle = resolveLifecycleMetadata({
      nowMs,
      currentStatus: status,
      previous,
      invalidationReason,
      config: lifecycleConfig,
    });

    return {
      id: setupId,
      type: setupType,
      direction,
      entryZone: { low: entryLow, high: entryHigh },
      stop,
      target1: { price: target1, label: 'Target 1' },
      target2: { price: target2, label: 'Target 2' },
      confluenceScore: confluence.score,
      confluenceSources: confluence.sources,
      clusterZone: zone,
      regime: regimeState.regime,
      status: lifecycle.status,
      statusUpdatedAt: lifecycle.statusUpdatedAt,
      ttlExpiresAt: lifecycle.ttlExpiresAt,
      invalidationReason: lifecycle.invalidationReason,
      probability: WIN_RATE_BY_SCORE[confluence.score] || 32,
      recommendedContract: null,
      createdAt,
      triggeredAt: lifecycle.status === 'triggered' || lifecycle.status === 'invalidated' || lifecycle.status === 'expired'
        ? triggeredAt
        : null,
    };
  });

  // Preserve recently active setups that dropped from the candidate list as expired.
  const setupIds = new Set(setups.map((setup) => setup.id));
  for (const previous of previousSetups || []) {
    if (setupIds.has(previous.id)) continue;
    if (previous.status === 'expired' || previous.status === 'invalidated') continue;

    setups.push({
      ...previous,
      status: 'expired',
      statusUpdatedAt: new Date(nowMs).toISOString(),
      ttlExpiresAt: null,
      invalidationReason: null,
    });
  }

  const activeContextIds = new Set(
    setups
      .filter((setup) => setup.status !== 'expired' && setup.status !== 'invalidated')
      .map((setup) => setup.id),
  );
  pruneSetupContextState(activeContextIds, nowMs);

  await cacheSet(SETUPS_CACHE_KEY, setups, SETUPS_CACHE_TTL_SECONDS);

  const invalidationReasons = setups
    .filter((setup) => setup.status === 'invalidated' && setup.invalidationReason)
    .reduce<Record<string, number>>((acc, setup) => {
      const reason = setup.invalidationReason || 'unknown';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

  if (lifecycleConfig.telemetryEnabled) {
    logger.info('SPX setup lifecycle telemetry', {
      lifecycleEnabled: lifecycleConfig.lifecycleEnabled,
      contextDemotionStreak: lifecycleConfig.contextDemotionStreak,
      contextInvalidationStreak: lifecycleConfig.contextInvalidationStreak,
      stopConfirmationTicks: lifecycleConfig.stopConfirmationTicks,
      invalidationReasons,
    });
  }

  logger.info('SPX setups detected', {
    count: setups.length,
    ready: setups.filter((setup) => setup.status === 'ready').length,
    triggered: setups.filter((setup) => setup.status === 'triggered').length,
    invalidated: setups.filter((setup) => setup.status === 'invalidated').length,
    expired: setups.filter((setup) => setup.status === 'expired').length,
    invalidationReasons,
    lifecycleEnabled: lifecycleConfig.lifecycleEnabled,
  });

  return setups;
  };

  if (forceRefresh) {
    return run();
  }

  setupsInFlight = run();
  try {
    return await setupsInFlight;
  } finally {
    setupsInFlight = null;
  }
}

export async function getSetupById(id: string, options?: { forceRefresh?: boolean }): Promise<Setup | null> {
  const setups = await detectActiveSetups(options);
  return setups.find((setup) => setup.id === id) || null;
}

export function __resetSetupDetectorStateForTests(): void {
  setupContextStateById.clear();
  setupsInFlight = null;
}
