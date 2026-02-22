import { cacheGet, cacheSet } from '../../config/redis';
import { getAggregates, getMinuteAggregates, type MassiveAggregate } from '../../config/massive';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import { getFibLevels } from './fibEngine';
import { getFlowEvents } from './flowEngine';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { getMergedLevels } from './levelEngine';
import {
  getActiveSPXOptimizationProfile,
  type SPXGeometryPolicyEntry,
  type SPXMacroMicroPolicyEntry,
} from './optimizer';
import { persistSetupInstancesForWinRate } from './outcomeTracker';
import { classifyCurrentRegime } from './regimeClassifier';
import { loadSetupPWinCalibrationModel } from './setupCalibration';
import { getRecentTicks, type NormalizedMarketTick } from '../tickCache';
import type {
  ClusterZone,
  FibLevel,
  Regime,
  RegimeState,
  Setup,
  SetupInvalidationReason,
  SetupTier,
  SetupType,
  SPXFlowEvent,
  SPXLevel,
  UnifiedGEXLandscape,
} from './types';
import { ema, round, stableId } from './utils';

const SETUPS_CACHE_KEY = 'spx_command_center:setups';
const SETUPS_CACHE_TTL_SECONDS = 10;
let setupsInFlight: Promise<Setup[]> | null = null;
const historicalSecondBarsCache = new Map<string, MassiveAggregate[]>();
const FLOW_CONFIRMATION_WINDOW_MS = 20 * 60 * 1000;
const FLOW_ZONE_TOLERANCE_POINTS = 12;
const FLOW_MIN_DIRECTIONAL_PREMIUM = 75_000;
const FLOW_MIN_LOCAL_PREMIUM = 150_000;
const FLOW_MIN_LOCAL_EVENTS = 2;
const FLOW_QUALITY_MIN_EVENTS = 2;
const FLOW_QUALITY_MIN_PREMIUM = 90_000;
const ORB_MIN_FLOW_QUALITY_SCORE = 52;
const CONTEXT_STREAK_TTL_MS = 30 * 60 * 1000;
const MICROSTRUCTURE_STALE_WINDOW_MS = 3 * 60 * 1000;

const DEFAULT_REGIME_CONFLICT_CONFIDENCE_THRESHOLD = 68;
const DEFAULT_FLOW_DIVERGENCE_ALIGNMENT_THRESHOLD = 38;
const DEFAULT_CONTEXT_DEMOTION_STREAK = 2;
const DEFAULT_CONTEXT_INVALIDATION_STREAK = 3;
const DEFAULT_STOP_CONFIRMATION_TICKS = 2;
const DEFAULT_TTL_FORMING_MS = 20 * 60 * 1000;
const DEFAULT_TTL_READY_MS = 25 * 60 * 1000;
const DEFAULT_TTL_TRIGGERED_MS = 90 * 60 * 1000;
const DEFAULT_SNIPER_PRIMARY_SCORE = 78;
const DEFAULT_SNIPER_SECONDARY_SCORE = 72;
const DEFAULT_SNIPER_PRIMARY_PWIN = 0.58;
const DEFAULT_SNIPER_SECONDARY_PWIN = 0.54;
const DEFAULT_SNIPER_PRIMARY_EV_R = 0.35;
const DEFAULT_SNIPER_SECONDARY_EV_R = 0.2;
const DEFAULT_MACRO_ALIGNMENT_MIN_SCORE = 34;
const EMA_FAST_PERIOD = 21;
const EMA_SLOW_PERIOD = 55;
const EMA_MIN_BARS = 8;
const EMA_MIN_SLOPE_POINTS = 0.05;
const EMA_PRICE_TOLERANCE_POINTS = 4;
const ORB_WINDOW_MINUTES = 30;
const ORB_ACTIVE_WINDOW_MINUTES = 120;
const ORB_RECLAIM_TOLERANCE_POINTS = 8;
const ORB_BREAK_CONFIRM_POINTS = 1.5;
const TREND_PULLBACK_EMA_DISTANCE_POINTS = 10;
const FLIP_RECLAIM_TOLERANCE_POINTS = 6;
const LATE_DAY_FADE_CUTOFF_MINUTES = 300;
const SESSION_OPEN_MINUTE_ET = 9 * 60 + 30;
const FADE_ALIGNMENT_MAX_PCT = 84;
const FADE_STOP_BUFFER_POINTS = 2.25;
const MEAN_REVERSION_T1_R_MULTIPLIER = 1.2;
const MEAN_REVERSION_T2_R_MULTIPLIER = 1.9;
const MEAN_REVERSION_T1_R_MAX_MULTIPLIER = 1.85;
const MEAN_REVERSION_T2_R_MAX_MULTIPLIER = 2.7;
const FLIP_RECLAIM_T1_R_MULTIPLIER = 1.55;
const FLIP_RECLAIM_T2_R_MULTIPLIER = 2.55;
const TREND_PULLBACK_T1_R_MIN_MULTIPLIER = 1.1;
const TREND_PULLBACK_T1_R_MAX_MULTIPLIER = 2.2;
const TREND_PULLBACK_T2_R_MIN_MULTIPLIER = 1.75;
const TREND_PULLBACK_T2_R_MAX_MULTIPLIER = 3.4;
const TREND_PULLBACK_TARGET_SCALE = 0.95;
const ORB_BREAKOUT_T1_R_MIN_MULTIPLIER = 1.15;
const ORB_BREAKOUT_T1_R_MAX_MULTIPLIER = 2.4;
const ORB_BREAKOUT_T2_R_MIN_MULTIPLIER = 1.9;
const ORB_BREAKOUT_T2_R_MAX_MULTIPLIER = 3.8;
const MEAN_FADE_TARGET_SCALE = 0.95;
const MEAN_REVERSION_PARTIAL_AT_T1_MIN = 0.75;
const DEFAULT_MICROSTRUCTURE_LOOKBACK_TICKS = 180;
const DEFAULT_MICROSTRUCTURE_MIN_TICKS = 24;
const DEFAULT_MICROSTRUCTURE_MIN_DIRECTIONAL_VOLUME = 120;
const DEFAULT_MICROSTRUCTURE_MIN_QUOTE_COVERAGE_PCT = 0.35;
const DEFAULT_MICROSTRUCTURE_MIN_AGGRESSOR_SKEW = 0.1;
const DEFAULT_MICROSTRUCTURE_MIN_IMBALANCE = 0.06;
const DEFAULT_MICROSTRUCTURE_MAX_SPREAD_BPS = 30;
const GEOMETRY_BUCKET_OPENING_MAX_MINUTE = 90;
const GEOMETRY_BUCKET_MIDDAY_MAX_MINUTE = 240;
const FALLBACK_GEOMETRY_POLICY: SPXGeometryPolicyEntry = {
  stopScale: 1,
  target1Scale: 1,
  target2Scale: 1,
  t1MinR: 1,
  t1MaxR: 2.2,
  t2MinR: 1.6,
  t2MaxR: 3.4,
};
const DIVERSIFICATION_RECOVERY_COMBOS: ReadonlySet<string> = new Set([
  'mean_reversion|ranging',
  'flip_reclaim|ranging',
]);
const DIVERSIFICATION_PREFERRED_SETUP_TYPES: ReadonlySet<SetupType> = new Set([
  'mean_reversion',
  'flip_reclaim',
  'orb_breakout',
  'trend_pullback',
]);
const TREND_MICROSTRUCTURE_REQUIRED_SETUP_TYPES: ReadonlySet<SetupType> = new Set([
  'orb_breakout',
  'trend_pullback',
  'trend_continuation',
  'breakout_vacuum',
]);
const TREND_SETUP_TYPES: ReadonlySet<SetupType> = new Set([
  'orb_breakout',
  'trend_pullback',
  'trend_continuation',
  'breakout_vacuum',
]);
const DEFAULT_FADE_READY_MAX_SHARE = 0.5;
const DEFAULT_MIN_ALTERNATIVE_READY_SETUPS = 1;
const DEFAULT_MIN_TREND_READY_SETUPS = 1;
const DEFAULT_TREND_PROMOTION_MIN_SCORE = 66;
const DEFAULT_TREND_PROMOTION_MIN_PWIN = 0.57;
const DEFAULT_TREND_PROMOTION_MIN_EV_R = 0.22;
const DEFAULT_TREND_PROMOTION_MIN_MACRO_SCORE = 34;
const DEFAULT_TREND_PROMOTION_MIN_MICRO_SCORE = 56;
const DEFAULT_TREND_PROMOTION_REQUIRE_MICRO_ALIGNMENT = true;
const ORB_TREND_CONFLUENCE_TOLERANCE_POINTS = 10;
const ORB_TREND_CONFLUENCE_BREAK_CONFIRM_POINTS = 0.75;
const DEFAULT_MAX_FIRST_SEEN_MINUTE_BY_SETUP_TYPE: Record<SetupType, number> = {
  fade_at_wall: 300,
  breakout_vacuum: 360,
  mean_reversion: 330,
  trend_continuation: 390,
  orb_breakout: 180,
  trend_pullback: 240,
  flip_reclaim: 360,
};
interface SetupSpecificGateFloor {
  minConfluenceScore?: number;
  minPWinCalibrated?: number;
  minEvR?: number;
  requireFlowConfirmation?: boolean;
  minAlignmentPct?: number;
  requireEmaAlignment?: boolean;
  requireVolumeRegimeAlignment?: boolean;
  maxFirstSeenMinuteEt?: number;
}
const SETUP_SPECIFIC_GATE_FLOORS: Partial<Record<SetupType, SetupSpecificGateFloor>> = {
  mean_reversion: {
    // Mean reversion underperformed in historical replay unless calibrated pWin is higher.
    minConfluenceScore: 3,
    minPWinCalibrated: 0.66,
    minEvR: 0.2,
    maxFirstSeenMinuteEt: 330,
  },
  orb_breakout: {
    minConfluenceScore: 3,
    minPWinCalibrated: 0.58,
    minEvR: 0.24,
    requireFlowConfirmation: true,
    minAlignmentPct: 50,
    requireEmaAlignment: true,
    requireVolumeRegimeAlignment: true,
    maxFirstSeenMinuteEt: 165,
  },
  trend_pullback: {
    minConfluenceScore: 3,
    minPWinCalibrated: 0.58,
    minEvR: 0.24,
    requireFlowConfirmation: true,
    minAlignmentPct: 50,
    requireEmaAlignment: true,
    requireVolumeRegimeAlignment: true,
    maxFirstSeenMinuteEt: 240,
  },
  trend_continuation: {
    minConfluenceScore: 4,
    minPWinCalibrated: 0.6,
    minEvR: 0.28,
    requireFlowConfirmation: true,
    minAlignmentPct: 54,
    requireEmaAlignment: true,
    requireVolumeRegimeAlignment: true,
  },
  breakout_vacuum: {
    minConfluenceScore: 5,
    minPWinCalibrated: 0.7,
    minEvR: 0.4,
    requireFlowConfirmation: true,
    minAlignmentPct: 60,
    requireEmaAlignment: true,
    requireVolumeRegimeAlignment: true,
    maxFirstSeenMinuteEt: 225,
  },
};

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

interface SetupScoringConfig {
  evTieringEnabled: boolean;
  sniperPrimaryScore: number;
  sniperSecondaryScore: number;
  sniperPrimaryPWin: number;
  sniperSecondaryPWin: number;
  sniperPrimaryEvR: number;
  sniperSecondaryEvR: number;
}

interface SetupDiversificationConfig {
  enabled: boolean;
  allowRecoveryCombos: boolean;
  fadeReadyMaxShare: number;
  minAlternativeReadySetups: number;
  minTrendReadySetups: number;
  trendPromotionMinScore: number;
  trendPromotionMinPWin: number;
  trendPromotionMinEvR: number;
  trendPromotionMinMacroScore: number;
  trendPromotionMinMicroScore: number;
  trendPromotionRequireMicroAlignment: boolean;
}

interface SetupMacroFilterConfig {
  enabled: boolean;
  minAlignmentScore: number;
}

interface SetupMicrostructureConfig {
  enabled: boolean;
  lookbackTicks: number;
  minTicks: number;
  minDirectionalVolume: number;
  minQuoteCoveragePct: number;
  minAggressorSkewAbs: number;
  minImbalanceAbs: number;
  maxSpreadBps: number;
  requireTrendAlignment: boolean;
  failClosedWhenUnavailable: boolean;
}

interface SetupMicrostructureSummary {
  source: 'live_tick_cache' | 'historical_second_bars' | 'historical_ticks_injected';
  sampleCount: number;
  quoteCoveragePct: number;
  buyVolume: number;
  sellVolume: number;
  neutralVolume: number;
  directionalVolume: number;
  aggressorSkew: number | null;
  bidAskImbalance: number | null;
  avgSpreadBps: number | null;
  latestTimestampMs: number | null;
  available: boolean;
}

interface SetupMicrostructureAlignment {
  available: boolean;
  aligned: boolean;
  conflict: boolean;
  score: number | null;
  reasons: string[];
}

interface SetupIndicatorContext {
  emaFast: number;
  emaSlow: number;
  emaFastSlope: number;
  emaSlowSlope: number;
  volumeTrend: 'rising' | 'flat' | 'falling';
  sessionOpenPrice: number;
  orbHigh: number;
  orbLow: number;
  minutesSinceOpen: number;
  sessionOpenTimestamp: string;
  asOfTimestamp: string;
}

interface SetupOrbTrendConfluence {
  available: boolean;
  aligned: boolean;
  orbLevel: number | null;
  distanceToOrb: number | null;
  breakConfirmed: boolean;
  pullbackRetest: boolean;
  reclaimed: boolean;
  reasons: string[];
}

interface FlowQualitySummary {
  score: number;
  recentDirectionalEvents: number;
  recentDirectionalPremium: number;
  localDirectionalEvents: number;
  localDirectionalPremium: number;
  localCoveragePct: number;
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
const CONFLUENCE_SOURCE_WEIGHTS: Record<string, number> = {
  level_quality: 1.35,
  gex_alignment: 1.2,
  flow_confirmation: 1.2,
  fibonacci_touch: 0.55,
  regime_alignment: 0.95,
  ema_alignment: 0.85,
  volume_regime_alignment: 0.75,
  microstructure_alignment: 1.0,
  orb_trend_confluence: 1.15,
  strike_flow_confluence: 0.9,
  intraday_gamma_pressure: 0.95,
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

function parseFloatEnv(value: string | undefined, fallback: number, minimum = 0): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseFloat(value);
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

function getSetupScoringConfig(): SetupScoringConfig {
  return {
    evTieringEnabled: parseBooleanEnv(process.env.SPX_SETUP_EV_TIERING_ENABLED, true),
    sniperPrimaryScore: parseIntEnv(
      process.env.SPX_SETUP_SNIPER_PRIMARY_SCORE,
      DEFAULT_SNIPER_PRIMARY_SCORE,
      0,
    ),
    sniperSecondaryScore: parseIntEnv(
      process.env.SPX_SETUP_SNIPER_SECONDARY_SCORE,
      DEFAULT_SNIPER_SECONDARY_SCORE,
      0,
    ),
    sniperPrimaryPWin: parseFloatEnv(
      process.env.SPX_SETUP_SNIPER_PRIMARY_PWIN,
      DEFAULT_SNIPER_PRIMARY_PWIN,
      0,
    ),
    sniperSecondaryPWin: parseFloatEnv(
      process.env.SPX_SETUP_SNIPER_SECONDARY_PWIN,
      DEFAULT_SNIPER_SECONDARY_PWIN,
      0,
    ),
    sniperPrimaryEvR: parseFloatEnv(
      process.env.SPX_SETUP_SNIPER_PRIMARY_EV_R,
      DEFAULT_SNIPER_PRIMARY_EV_R,
      0,
    ),
    sniperSecondaryEvR: parseFloatEnv(
      process.env.SPX_SETUP_SNIPER_SECONDARY_EV_R,
      DEFAULT_SNIPER_SECONDARY_EV_R,
      0,
    ),
  };
}

function getSetupDiversificationConfig(): SetupDiversificationConfig {
  return {
    enabled: parseBooleanEnv(process.env.SPX_SETUP_DIVERSIFICATION_ENABLED, true),
    allowRecoveryCombos: parseBooleanEnv(process.env.SPX_SETUP_ALLOW_RECOVERY_COMBOS, true),
    fadeReadyMaxShare: Math.min(0.9, Math.max(0.2, parseFloatEnv(
      process.env.SPX_SETUP_FADE_READY_MAX_SHARE,
      DEFAULT_FADE_READY_MAX_SHARE,
      0.2,
    ))),
    minAlternativeReadySetups: parseIntEnv(
      process.env.SPX_SETUP_MIN_ALTERNATIVE_READY_SETUPS,
      DEFAULT_MIN_ALTERNATIVE_READY_SETUPS,
      0,
    ),
    minTrendReadySetups: parseIntEnv(
      process.env.SPX_SETUP_MIN_TREND_READY_SETUPS,
      DEFAULT_MIN_TREND_READY_SETUPS,
      0,
    ),
    trendPromotionMinScore: Math.min(100, Math.max(0, parseFloatEnv(
      process.env.SPX_SETUP_TREND_PROMOTION_MIN_SCORE,
      DEFAULT_TREND_PROMOTION_MIN_SCORE,
      0,
    ))),
    trendPromotionMinPWin: Math.min(1, Math.max(0, parseFloatEnv(
      process.env.SPX_SETUP_TREND_PROMOTION_MIN_PWIN,
      DEFAULT_TREND_PROMOTION_MIN_PWIN,
      0,
    ))),
    trendPromotionMinEvR: parseFloatEnv(
      process.env.SPX_SETUP_TREND_PROMOTION_MIN_EV_R,
      DEFAULT_TREND_PROMOTION_MIN_EV_R,
      -2,
    ),
    trendPromotionMinMacroScore: Math.min(100, Math.max(0, parseFloatEnv(
      process.env.SPX_SETUP_TREND_PROMOTION_MIN_MACRO_SCORE,
      DEFAULT_TREND_PROMOTION_MIN_MACRO_SCORE,
      0,
    ))),
    trendPromotionMinMicroScore: Math.min(100, Math.max(0, parseFloatEnv(
      process.env.SPX_SETUP_TREND_PROMOTION_MIN_MICRO_SCORE,
      DEFAULT_TREND_PROMOTION_MIN_MICRO_SCORE,
      0,
    ))),
    trendPromotionRequireMicroAlignment: parseBooleanEnv(
      process.env.SPX_SETUP_TREND_PROMOTION_REQUIRE_MICRO_ALIGNMENT,
      DEFAULT_TREND_PROMOTION_REQUIRE_MICRO_ALIGNMENT,
    ),
  };
}

function getSetupMacroFilterConfig(): SetupMacroFilterConfig {
  return {
    enabled: parseBooleanEnv(process.env.SPX_SETUP_MACRO_KILLSWITCH_ENABLED, true),
    minAlignmentScore: parseFloatEnv(
      process.env.SPX_SETUP_MACRO_MIN_ALIGNMENT_SCORE,
      DEFAULT_MACRO_ALIGNMENT_MIN_SCORE,
      0,
    ),
  };
}

function getSetupMicrostructureConfig(): SetupMicrostructureConfig {
  return {
    enabled: parseBooleanEnv(process.env.SPX_SETUP_MICROSTRUCTURE_ENABLED, true),
    lookbackTicks: parseIntEnv(
      process.env.SPX_SETUP_MICROSTRUCTURE_LOOKBACK_TICKS,
      DEFAULT_MICROSTRUCTURE_LOOKBACK_TICKS,
      10,
    ),
    minTicks: parseIntEnv(
      process.env.SPX_SETUP_MICROSTRUCTURE_MIN_TICKS,
      DEFAULT_MICROSTRUCTURE_MIN_TICKS,
      1,
    ),
    minDirectionalVolume: parseIntEnv(
      process.env.SPX_SETUP_MICROSTRUCTURE_MIN_DIRECTIONAL_VOLUME,
      DEFAULT_MICROSTRUCTURE_MIN_DIRECTIONAL_VOLUME,
      1,
    ),
    minQuoteCoveragePct: Math.min(1, parseFloatEnv(
      process.env.SPX_SETUP_MICROSTRUCTURE_MIN_QUOTE_COVERAGE_PCT,
      DEFAULT_MICROSTRUCTURE_MIN_QUOTE_COVERAGE_PCT,
      0,
    )),
    minAggressorSkewAbs: Math.min(1, parseFloatEnv(
      process.env.SPX_SETUP_MICROSTRUCTURE_MIN_AGGRESSOR_SKEW,
      DEFAULT_MICROSTRUCTURE_MIN_AGGRESSOR_SKEW,
      0,
    )),
    minImbalanceAbs: Math.min(1, parseFloatEnv(
      process.env.SPX_SETUP_MICROSTRUCTURE_MIN_IMBALANCE,
      DEFAULT_MICROSTRUCTURE_MIN_IMBALANCE,
      0,
    )),
    maxSpreadBps: parseFloatEnv(
      process.env.SPX_SETUP_MICROSTRUCTURE_MAX_SPREAD_BPS,
      DEFAULT_MICROSTRUCTURE_MAX_SPREAD_BPS,
      0,
    ),
    requireTrendAlignment: parseBooleanEnv(
      process.env.SPX_SETUP_MICROSTRUCTURE_REQUIRE_TREND_ALIGNMENT,
      true,
    ),
    failClosedWhenUnavailable: parseBooleanEnv(
      process.env.SPX_SETUP_MICROSTRUCTURE_FAIL_CLOSED_WHEN_UNAVAILABLE,
      false,
    ),
  };
}

function normalizeMacroMicroPolicyEntry(
  value: unknown,
): SPXMacroMicroPolicyEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as SPXMacroMicroPolicyEntry;
}

function resolveSetupMacroMicroPolicyEntry(input: {
  setupType: SetupType;
  regime: Regime;
  firstSeenMinuteEt: number | null;
  profile: Awaited<ReturnType<typeof getActiveSPXOptimizationProfile>>;
}): SPXMacroMicroPolicyEntry {
  const policy = input.profile.macroMicroPolicy;
  if (!policy) return {};
  const bucket = toGeometryBucket(input.firstSeenMinuteEt);
  return {
    minMacroAlignmentScore: policy.defaultMinMacroAlignmentScore,
    requireMicrostructureAlignment: (
      policy.defaultRequireTrendMicrostructureAlignment
      && TREND_MICROSTRUCTURE_REQUIRED_SETUP_TYPES.has(input.setupType)
    ),
    failClosedWhenUnavailable: policy.defaultFailClosedWhenUnavailable,
    minMicroAggressorSkewAbs: policy.defaultMinMicroAggressorSkewAbs,
    minMicroImbalanceAbs: policy.defaultMinMicroImbalanceAbs,
    minMicroQuoteCoveragePct: policy.defaultMinMicroQuoteCoveragePct,
    maxMicroSpreadBps: policy.defaultMaxMicroSpreadBps,
    ...normalizeMacroMicroPolicyEntry(policy.bySetupType?.[input.setupType]),
    ...normalizeMacroMicroPolicyEntry(policy.bySetupRegime?.[`${input.setupType}|${input.regime}`]),
    ...normalizeMacroMicroPolicyEntry(policy.bySetupRegimeTimeBucket?.[
      `${input.setupType}|${input.regime}|${bucket}`
    ]),
  };
}

function resolveSetupMacroFilterConfig(input: {
  base: SetupMacroFilterConfig;
  policy: SPXMacroMicroPolicyEntry;
}): SetupMacroFilterConfig {
  const explicitEnvFloor = typeof process.env.SPX_SETUP_MACRO_MIN_ALIGNMENT_SCORE === 'string'
    && process.env.SPX_SETUP_MACRO_MIN_ALIGNMENT_SCORE.trim().length > 0;
  const policyFloor = typeof input.policy.minMacroAlignmentScore === 'number' && Number.isFinite(input.policy.minMacroAlignmentScore)
    ? input.policy.minMacroAlignmentScore
    : null;
  return {
    enabled: input.base.enabled,
    minAlignmentScore: explicitEnvFloor
      ? Math.max(input.base.minAlignmentScore, policyFloor ?? input.base.minAlignmentScore)
      : policyFloor ?? input.base.minAlignmentScore,
  };
}

function resolveSetupMicrostructureConfig(input: {
  setupType: SetupType;
  base: SetupMicrostructureConfig;
  policy: SPXMacroMicroPolicyEntry;
}): SetupMicrostructureConfig {
  const defaultRequireAlignment = input.base.requireTrendAlignment
    && TREND_MICROSTRUCTURE_REQUIRED_SETUP_TYPES.has(input.setupType);
  return {
    ...input.base,
    minAggressorSkewAbs: typeof input.policy.minMicroAggressorSkewAbs === 'number' && Number.isFinite(input.policy.minMicroAggressorSkewAbs)
      ? Math.max(0, Math.min(1, input.policy.minMicroAggressorSkewAbs))
      : input.base.minAggressorSkewAbs,
    minImbalanceAbs: typeof input.policy.minMicroImbalanceAbs === 'number' && Number.isFinite(input.policy.minMicroImbalanceAbs)
      ? Math.max(0, Math.min(1, input.policy.minMicroImbalanceAbs))
      : input.base.minImbalanceAbs,
    minQuoteCoveragePct: typeof input.policy.minMicroQuoteCoveragePct === 'number' && Number.isFinite(input.policy.minMicroQuoteCoveragePct)
      ? Math.max(0, Math.min(1, input.policy.minMicroQuoteCoveragePct))
      : input.base.minQuoteCoveragePct,
    maxSpreadBps: typeof input.policy.maxMicroSpreadBps === 'number' && Number.isFinite(input.policy.maxMicroSpreadBps)
      ? Math.max(0, input.policy.maxMicroSpreadBps)
      : input.base.maxSpreadBps,
    requireTrendAlignment: typeof input.policy.requireMicrostructureAlignment === 'boolean'
      ? input.policy.requireMicrostructureAlignment
      : defaultRequireAlignment,
    failClosedWhenUnavailable: typeof input.policy.failClosedWhenUnavailable === 'boolean'
      ? input.policy.failClosedWhenUnavailable
      : input.base.failClosedWhenUnavailable,
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
  if (regime === 'ranging') {
    return type === 'fade_at_wall' || type === 'mean_reversion' || type === 'flip_reclaim';
  }
  if (regime === 'compression') {
    return type === 'mean_reversion'
      || type === 'breakout_vacuum'
      || type === 'orb_breakout'
      || type === 'flip_reclaim'
      || type === 'trend_pullback';
  }
  if (regime === 'trending') {
    return type === 'trend_continuation' || type === 'breakout_vacuum' || type === 'trend_pullback';
  }
  if (regime === 'breakout') {
    return type === 'breakout_vacuum'
      || type === 'trend_continuation'
      || type === 'orb_breakout'
      || type === 'flip_reclaim'
      || type === 'trend_pullback';
  }
  return false;
}

function inferSetupTypeForZone(input: {
  regime: Regime;
  direction: 'bullish' | 'bearish';
  currentPrice: number;
  zoneCenter: number;
  gexLandscape: UnifiedGEXLandscape;
  indicatorContext: SetupIndicatorContext | null;
  emaAligned: boolean;
  volumeRegimeAligned: boolean;
}): SetupType {
  const fallback = setupTypeForRegime(input.regime);
  const distanceToFlip = Math.abs(input.zoneCenter - input.gexLandscape.combined.flipPoint);
  const nearFlip = distanceToFlip <= 10;
  const netGexNegative = input.gexLandscape.combined.netGex < 0;
  const volumeTrend = input.indicatorContext?.volumeTrend || 'flat';
  const emaSlope = input.indicatorContext?.emaFastSlope || 0;
  const directionalMomentum = input.direction === 'bullish'
    ? emaSlope >= EMA_MIN_SLOPE_POINTS
    : emaSlope <= -EMA_MIN_SLOPE_POINTS;
  const inMomentumState = input.emaAligned && directionalMomentum && volumeTrend === 'rising';
  const minutesSinceOpen = input.indicatorContext?.minutesSinceOpen ?? 120;
  const hasIndicatorContext = Boolean(input.indicatorContext);
  const inOpeningWindow = minutesSinceOpen <= ORB_ACTIVE_WINDOW_MINUTES;
  const orbHigh = input.indicatorContext?.orbHigh;
  const orbLow = input.indicatorContext?.orbLow;
  const nearOpeningRangeEdge = input.direction === 'bullish'
    ? (Number.isFinite(orbHigh)
      && Math.abs(input.zoneCenter - (orbHigh as number)) <= ORB_RECLAIM_TOLERANCE_POINTS
      && input.currentPrice >= (orbHigh as number) - ORB_RECLAIM_TOLERANCE_POINTS)
    : (Number.isFinite(orbLow)
      && Math.abs(input.zoneCenter - (orbLow as number)) <= ORB_RECLAIM_TOLERANCE_POINTS
      && input.currentPrice <= (orbLow as number) + ORB_RECLAIM_TOLERANCE_POINTS);
  const openingRangeBreakConfirmed = input.direction === 'bullish'
    ? (Number.isFinite(orbHigh) && input.currentPrice >= (orbHigh as number) + ORB_BREAK_CONFIRM_POINTS)
    : (Number.isFinite(orbLow) && input.currentPrice <= (orbLow as number) - ORB_BREAK_CONFIRM_POINTS);
  const nearFastEma = input.indicatorContext
    ? Math.abs(input.currentPrice - input.indicatorContext.emaFast) <= TREND_PULLBACK_EMA_DISTANCE_POINTS
    : false;
  const openingMomentumConfirmed = inMomentumState || (
    directionalMomentum
    && (volumeTrend === 'rising' || (minutesSinceOpen <= 75 && volumeTrend === 'flat'))
  );
  const intradayTrendStructure = (
    hasIndicatorContext
    && nearFastEma
    && input.emaAligned
    && directionalMomentum
    && volumeTrend !== 'falling'
  );
  const flipReclaim = input.direction === 'bullish'
    ? (input.currentPrice >= input.gexLandscape.combined.flipPoint - FLIP_RECLAIM_TOLERANCE_POINTS
      && input.zoneCenter <= input.gexLandscape.combined.flipPoint + FLIP_RECLAIM_TOLERANCE_POINTS)
    : (input.currentPrice <= input.gexLandscape.combined.flipPoint + FLIP_RECLAIM_TOLERANCE_POINTS
      && input.zoneCenter >= input.gexLandscape.combined.flipPoint - FLIP_RECLAIM_TOLERANCE_POINTS);

  if (
    hasIndicatorContext
    && 
    inOpeningWindow
    && (nearOpeningRangeEdge || openingRangeBreakConfirmed)
    && openingMomentumConfirmed
    && (
      input.regime === 'breakout'
      || input.regime === 'compression'
      || input.regime === 'trending'
      || input.regime === 'ranging'
    )
  ) {
    return 'orb_breakout';
  }

  if (input.regime === 'breakout') {
    if (intradayTrendStructure && minutesSinceOpen <= 300) return 'trend_pullback';
    if (hasIndicatorContext && flipReclaim && nearFlip) return 'flip_reclaim';
    return inMomentumState ? 'trend_continuation' : 'breakout_vacuum';
  }

  if (input.regime === 'trending') {
    if (intradayTrendStructure) return 'trend_pullback';
    if (inMomentumState) return 'trend_continuation';
    if (hasIndicatorContext && flipReclaim && nearFlip) return 'flip_reclaim';
    if (nearFlip || netGexNegative) return 'breakout_vacuum';
    return 'trend_continuation';
  }

  if (input.regime === 'compression') {
    if (intradayTrendStructure && minutesSinceOpen <= 240) return 'trend_pullback';
    if (hasIndicatorContext && flipReclaim && nearFlip) return 'flip_reclaim';
    if (volumeTrend === 'rising' && (nearFlip || netGexNegative)) return 'breakout_vacuum';
    return 'mean_reversion';
  }

  if (input.regime === 'ranging') {
    const distanceToZone = Math.abs(input.currentPrice - input.zoneCenter);
    if (
      intradayTrendStructure
      && minutesSinceOpen <= 210
      && (nearFlip || distanceToZone <= 14)
    ) {
      return 'trend_pullback';
    }
    if (hasIndicatorContext && minutesSinceOpen >= LATE_DAY_FADE_CUTOFF_MINUTES && distanceToZone >= 24) {
      return flipReclaim ? 'flip_reclaim' : 'mean_reversion';
    }
    if (flipReclaim && nearFlip) return 'flip_reclaim';
    if (hasIndicatorContext && flipReclaim && nearFlip && volumeTrend !== 'rising') return 'flip_reclaim';
    if (distanceToZone >= 20) return 'mean_reversion';
    if (inMomentumState && (nearFlip || netGexNegative)) return 'breakout_vacuum';
    if (distanceToZone >= 40) return 'mean_reversion';
    return 'fade_at_wall';
  }

  return fallback;
}

function evaluateOrbTrendConfluence(input: {
  setupType: SetupType;
  direction: 'bullish' | 'bearish';
  currentPrice: number;
  zoneCenter: number;
  indicatorContext: SetupIndicatorContext | null;
  emaAligned: boolean;
  flowConfirmed: boolean;
}): SetupOrbTrendConfluence {
  if (input.setupType !== 'trend_pullback' && input.setupType !== 'orb_breakout') {
    return {
      available: false,
      aligned: false,
      orbLevel: null,
      distanceToOrb: null,
      breakConfirmed: false,
      pullbackRetest: false,
      reclaimed: false,
      reasons: ['setup_type_not_orb_family'],
    };
  }

  const context = input.indicatorContext;
  if (!context) {
    return {
      available: false,
      aligned: false,
      orbLevel: null,
      distanceToOrb: null,
      breakConfirmed: false,
      pullbackRetest: false,
      reclaimed: false,
      reasons: ['indicator_context_unavailable'],
    };
  }

  const orbLevel = input.direction === 'bullish' ? context.orbHigh : context.orbLow;
  if (!Number.isFinite(orbLevel)) {
    return {
      available: false,
      aligned: false,
      orbLevel: null,
      distanceToOrb: null,
      breakConfirmed: false,
      pullbackRetest: false,
      reclaimed: false,
      reasons: ['orb_level_unavailable'],
    };
  }

  const distanceToOrb = Math.abs(input.zoneCenter - orbLevel);
  const breakConfirmed = input.direction === 'bullish'
    ? input.currentPrice >= orbLevel + ORB_TREND_CONFLUENCE_BREAK_CONFIRM_POINTS
    : input.currentPrice <= orbLevel - ORB_TREND_CONFLUENCE_BREAK_CONFIRM_POINTS;
  const reclaimed = input.direction === 'bullish'
    ? input.currentPrice >= orbLevel - ORB_RECLAIM_TOLERANCE_POINTS
    : input.currentPrice <= orbLevel + ORB_RECLAIM_TOLERANCE_POINTS;
  const pullbackRetest = distanceToOrb <= ORB_TREND_CONFLUENCE_TOLERANCE_POINTS;
  const openingCarry = (
    context.minutesSinceOpen <= 210
    && breakConfirmed
    && input.emaAligned
    && (input.flowConfirmed || context.volumeTrend === 'rising')
  );
  const aligned = (pullbackRetest && reclaimed && breakConfirmed) || openingCarry;

  const reasons: string[] = [];
  if (aligned) {
    reasons.push(openingCarry ? 'opening_orb_carry' : 'orb_retest_confirmed');
  } else {
    if (!pullbackRetest) reasons.push('orb_retest_missed');
    if (!reclaimed) reasons.push('orb_not_reclaimed');
    if (!breakConfirmed) reasons.push('orb_break_not_confirmed');
  }

  return {
    available: true,
    aligned,
    orbLevel: round(orbLevel, 2),
    distanceToOrb: round(distanceToOrb, 2),
    breakConfirmed,
    pullbackRetest,
    reclaimed,
    reasons,
  };
}

function adjustTargetsForSetupType(input: {
  setupType: SetupType;
  direction: 'bullish' | 'bearish';
  entryLow: number;
  entryHigh: number;
  stop: number;
  target1: number;
  target2: number;
  flipPoint: number;
  indicatorContext: SetupIndicatorContext | null;
  geometryPolicy: SPXGeometryPolicyEntry;
}): { target1: number; target2: number } {
  const geometryPolicy = normalizeGeometryPolicyEntry(
    input.geometryPolicy,
    defaultGeometryPolicyForSetup(input.setupType),
  );
  if (
    input.setupType === 'trend_pullback'
    || input.setupType === 'orb_breakout'
    || input.setupType === 'trend_continuation'
  ) {
    const entryMid = (input.entryLow + input.entryHigh) / 2;
    const risk = Math.max(0.5, Math.abs(entryMid - input.stop));
    const directionMultiplier = input.direction === 'bullish' ? 1 : -1;
    const existingT1Distance = Math.max(0.25, Math.abs(input.target1 - entryMid));
    const existingT2Distance = Math.max(0.4, Math.abs(input.target2 - entryMid));
    const boundedT1Distance = Math.max(
      risk * geometryPolicy.t1MinR,
      Math.min(risk * geometryPolicy.t1MaxR, existingT1Distance),
    );
    const boundedT2Distance = Math.max(
      boundedT1Distance + Math.max(0.35, risk * 0.55),
      Math.max(
        risk * geometryPolicy.t2MinR,
        Math.min(risk * geometryPolicy.t2MaxR, existingT2Distance),
      ),
    );
    const scaledT1Distance = Math.max(0.25, boundedT1Distance * geometryPolicy.target1Scale);
    const scaledT2Distance = Math.max(
      scaledT1Distance + Math.max(0.3, risk * 0.5),
      boundedT2Distance * geometryPolicy.target2Scale,
    );

    return {
      target1: round(entryMid + (directionMultiplier * scaledT1Distance), 2),
      target2: round(entryMid + (directionMultiplier * scaledT2Distance), 2),
    };
  }

  if (
    input.setupType !== 'fade_at_wall'
    && input.setupType !== 'mean_reversion'
    && input.setupType !== 'flip_reclaim'
  ) {
    return {
      target1: round(input.target1, 2),
      target2: round(input.target2, 2),
    };
  }

  const entryMid = (input.entryLow + input.entryHigh) / 2;
  const risk = Math.max(0.5, Math.abs(entryMid - input.stop));
  const directionMultiplier = input.direction === 'bullish' ? 1 : -1;
  const directional = (price: number): boolean => (
    input.direction === 'bullish' ? price > entryMid : price < entryMid
  );

  const t1Multiplier = input.setupType === 'flip_reclaim'
    ? FLIP_RECLAIM_T1_R_MULTIPLIER
    : MEAN_REVERSION_T1_R_MULTIPLIER;
  const t2Multiplier = input.setupType === 'flip_reclaim'
    ? FLIP_RECLAIM_T2_R_MULTIPLIER
    : MEAN_REVERSION_T2_R_MULTIPLIER;

  let target1 = entryMid + (directionMultiplier * Math.max(risk * t1Multiplier, 2.5));
  let target2 = entryMid + (directionMultiplier * Math.max(risk * t2Multiplier, 4.0));

  const anchorCandidates = [
    input.flipPoint,
    input.indicatorContext?.emaFast,
    input.indicatorContext?.sessionOpenPrice,
  ]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .filter((value) => directional(value))
    .sort((a, b) => Math.abs(a - entryMid) - Math.abs(b - entryMid));

  const anchor = anchorCandidates.find((candidate) => {
    const distance = Math.abs(candidate - entryMid);
    return distance >= (risk * 1.1) && distance <= (risk * 3.2);
  });

  if (anchor !== undefined) {
    target1 = anchor;
  }

  if (input.direction === 'bullish') {
    target1 = Math.min(target1, input.target1);
    target2 = Math.min(target2, input.target2);
    if (target1 <= entryMid + 0.25) {
      target1 = entryMid + Math.max(risk * 1.1, 1.5);
    }
    if (target2 <= target1 + 0.25) {
      target2 = target1 + Math.max(risk * 0.8, 1.25);
    }
  } else {
    target1 = Math.max(target1, input.target1);
    target2 = Math.max(target2, input.target2);
    if (target1 >= entryMid - 0.25) {
      target1 = entryMid - Math.max(risk * 1.1, 1.5);
    }
    if (target2 >= target1 - 0.25) {
      target2 = target1 - Math.max(risk * 0.8, 1.25);
    }
  }

  if (input.setupType === 'mean_reversion') {
    const maxT1Distance = risk * MEAN_REVERSION_T1_R_MAX_MULTIPLIER;
    const maxT2Distance = risk * MEAN_REVERSION_T2_R_MAX_MULTIPLIER;
    if (input.direction === 'bullish') {
      target1 = Math.min(target1, entryMid + maxT1Distance);
      target2 = Math.min(target2, entryMid + maxT2Distance);
      if (target2 <= target1 + 0.25) {
        target2 = target1 + Math.max(risk * 0.8, 1.25);
      }
    } else {
      target1 = Math.max(target1, entryMid - maxT1Distance);
      target2 = Math.max(target2, entryMid - maxT2Distance);
      if (target2 >= target1 - 0.25) {
        target2 = target1 - Math.max(risk * 0.8, 1.25);
      }
    }
  }

  if (input.setupType === 'mean_reversion' || input.setupType === 'fade_at_wall') {
    const entryMid = (input.entryLow + input.entryHigh) / 2;
    const directionMultiplier = input.direction === 'bullish' ? 1 : -1;
    const target1Distance = Math.max(0.25, Math.abs(target1 - entryMid) * geometryPolicy.target1Scale);
    const target2Distance = Math.max(
      target1Distance + 0.25,
      Math.abs(target2 - entryMid) * geometryPolicy.target2Scale,
    );
    target1 = entryMid + (directionMultiplier * target1Distance);
    target2 = entryMid + (directionMultiplier * target2Distance);
  }

  {
    const target1Distance = Math.max(0.25, Math.abs(target1 - entryMid));
    const target2Distance = Math.max(0.3, Math.abs(target2 - entryMid));
    const boundedTarget1Distance = Math.max(
      risk * geometryPolicy.t1MinR,
      Math.min(risk * geometryPolicy.t1MaxR, target1Distance),
    );
    const boundedTarget2Distance = Math.max(
      boundedTarget1Distance + Math.max(0.2, risk * 0.45),
      Math.max(
        risk * geometryPolicy.t2MinR,
        Math.min(risk * geometryPolicy.t2MaxR, target2Distance),
      ),
    );
    target1 = entryMid + (directionMultiplier * boundedTarget1Distance);
    target2 = entryMid + (directionMultiplier * boundedTarget2Distance);
  }

  return {
    target1: round(target1, 2),
    target2: round(target2, 2),
  };
}

function resolveTradeManagementForSetup(input: {
  setupType: SetupType;
  regime: Regime;
  confluenceScore: number;
  flowConfirmed: boolean;
  basePolicy: {
    partialAtT1Pct: number;
    moveStopToBreakeven: boolean;
  };
}): {
  partialAtT1Pct: number;
  moveStopToBreakeven: boolean;
} {
  const basePartial = Math.min(0.9, Math.max(0.1, input.basePolicy.partialAtT1Pct));
  const baseMoveToBreakeven = input.basePolicy.moveStopToBreakeven !== false;

  if (input.setupType === 'mean_reversion') {
    return {
      partialAtT1Pct: Math.max(basePartial, MEAN_REVERSION_PARTIAL_AT_T1_MIN),
      moveStopToBreakeven: true,
    };
  }

  const fadeRunnerHold = (
    input.setupType === 'fade_at_wall'
    && input.regime === 'ranging'
    && input.confluenceScore >= 4
    && (input.flowConfirmed || input.confluenceScore >= 5)
  );
  if (fadeRunnerHold) {
    return {
      partialAtT1Pct: Math.max(basePartial, 0.65),
      moveStopToBreakeven: false,
    };
  }

  return {
    partialAtT1Pct: basePartial,
    moveStopToBreakeven: baseMoveToBreakeven,
  };
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
  emaAligned: boolean;
  volumeRegimeAligned: boolean;
  microstructureAligned: boolean;
  orbTrendConfluenceAligned: boolean;
  strikeFlowConfluence: boolean;
  intradayGammaPressureAligned: boolean;
}): {
  score: number;
  sources: string[];
  gexAligned: boolean;
} {
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
  if (input.emaAligned) sources.push('ema_alignment');
  if (input.volumeRegimeAligned) sources.push('volume_regime_alignment');
  if (input.microstructureAligned) sources.push('microstructure_alignment');
  if (input.orbTrendConfluenceAligned) sources.push('orb_trend_confluence');
  if (input.strikeFlowConfluence) sources.push('strike_flow_confluence');
  if (input.intradayGammaPressureAligned) sources.push('intraday_gamma_pressure');
  const weightedScore = sources.reduce((sum, source) => {
    return sum + (CONFLUENCE_SOURCE_WEIGHTS[source] || 0.5);
  }, 0);

  return {
    score: round(Math.min(5, weightedScore), 2),
    sources,
    gexAligned,
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
  const deltaMs = nowMs - eventMs;
  return deltaMs >= 0 && deltaMs <= FLOW_CONFIRMATION_WINDOW_MS;
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

function evaluateFlowQuality(input: {
  flowEvents: SPXFlowEvent[];
  direction: 'bullish' | 'bearish';
  zoneCenter: number;
  nowMs: number;
}): FlowQualitySummary {
  const directional = input.flowEvents.filter((event) => (
    event.direction === input.direction && isRecentFlowEvent(event, input.nowMs)
  ));
  const recentDirectionalPremium = directional.reduce((sum, event) => sum + event.premium, 0);
  const localDirectional = directional.filter((event) => (
    Math.abs(event.strike - input.zoneCenter) <= FLOW_ZONE_TOLERANCE_POINTS
  ));
  const localDirectionalPremium = localDirectional.reduce((sum, event) => sum + event.premium, 0);

  const eventCountScore = Math.min(100, directional.length * 20);
  const premiumScore = Math.min(100, (recentDirectionalPremium / FLOW_QUALITY_MIN_PREMIUM) * 100);
  const localCoverage = recentDirectionalPremium > 0
    ? localDirectionalPremium / recentDirectionalPremium
    : 0;
  const localCoverageScore = Math.min(100, localCoverage * 100);

  return {
    score: round((eventCountScore * 0.35) + (premiumScore * 0.40) + (localCoverageScore * 0.25), 2),
    recentDirectionalEvents: directional.length,
    recentDirectionalPremium: round(recentDirectionalPremium, 2),
    localDirectionalEvents: localDirectional.length,
    localDirectionalPremium: round(localDirectionalPremium, 2),
    localCoveragePct: round(localCoverage * 100, 2),
  };
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

function classifyAggressorSideFromTick(tick: NormalizedMarketTick): 'buyer' | 'seller' | 'neutral' {
  if (tick.aggressorSide === 'buyer' || tick.aggressorSide === 'seller' || tick.aggressorSide === 'neutral') {
    return tick.aggressorSide;
  }
  if (tick.ask != null && tick.price >= tick.ask) return 'buyer';
  if (tick.bid != null && tick.price <= tick.bid) return 'seller';
  return 'neutral';
}

function bidAskImbalanceFromTick(tick: NormalizedMarketTick): number | null {
  if (
    typeof tick.bidSize !== 'number'
    || !Number.isFinite(tick.bidSize)
    || typeof tick.askSize !== 'number'
    || !Number.isFinite(tick.askSize)
  ) {
    return null;
  }
  const denominator = tick.bidSize + tick.askSize;
  if (denominator <= 0) return null;
  return (tick.bidSize - tick.askSize) / denominator;
}

function spreadBpsFromTick(tick: NormalizedMarketTick): number | null {
  if (
    typeof tick.bid !== 'number'
    || !Number.isFinite(tick.bid)
    || typeof tick.ask !== 'number'
    || !Number.isFinite(tick.ask)
    || tick.ask < tick.bid
  ) {
    return null;
  }

  const mid = (tick.bid + tick.ask) / 2;
  if (mid <= 0) return null;
  return ((tick.ask - tick.bid) / mid) * 10_000;
}

function secondBarToSyntheticTick(
  bar: MassiveAggregate,
  symbol: string,
): NormalizedMarketTick | null {
  if (!Number.isFinite(bar.t) || !Number.isFinite(bar.c) || bar.c <= 0) return null;
  const high = Number.isFinite(bar.h) ? bar.h : bar.c;
  const low = Number.isFinite(bar.l) ? bar.l : bar.c;
  const open = Number.isFinite(bar.o) ? bar.o : bar.c;
  const spreadPoints = Math.max(0.01, Math.abs(high - low));
  const bid = Math.max(0.01, bar.c - (spreadPoints / 2));
  const ask = Math.max(bid + 0.01, bar.c + (spreadPoints / 2));
  const size = Math.max(0, Math.floor(Number.isFinite(bar.v) ? bar.v : 0));
  const aggressorSide: NormalizedMarketTick['aggressorSide'] = bar.c > open
    ? 'buyer'
    : bar.c < open
      ? 'seller'
      : 'neutral';
  const bidSize = size <= 0
    ? 0
    : aggressorSide === 'buyer'
      ? Math.max(1, Math.round(size * 0.62))
      : aggressorSide === 'seller'
        ? Math.max(1, Math.round(size * 0.38))
        : Math.max(1, Math.round(size * 0.5));
  const askSize = size <= 0
    ? 0
    : Math.max(1, size - bidSize);

  return {
    symbol,
    rawSymbol: `I:${symbol}`,
    price: bar.c,
    size,
    timestamp: Math.floor(bar.t),
    sequence: null,
    bid,
    ask,
    bidSize,
    askSize,
    aggressorSide,
  };
}

async function loadHistoricalSecondBars(dateStr: string): Promise<MassiveAggregate[]> {
  const cached = historicalSecondBarsCache.get(dateStr);
  if (cached) return cached;
  try {
    const response = await getAggregates('I:SPX', 1, 'second', dateStr, dateStr);
    const bars = (response.results || [])
      .filter((bar) => Number.isFinite(bar.t) && Number.isFinite(bar.c))
      .sort((a, b) => a.t - b.t);
    historicalSecondBarsCache.set(dateStr, bars);
    return bars;
  } catch (error) {
    logger.warn('SPX setup detector failed to load historical second bars for microstructure parity', {
      date: dateStr,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function loadMicrostructureSummary(input: {
  symbol: string;
  nowMs: number;
  hasHistoricalTimestamp: boolean;
  historicalTimestampIso?: string;
  historicalTicks?: NormalizedMarketTick[];
  config: SetupMicrostructureConfig;
}): Promise<SetupMicrostructureSummary | null> {
  if (!input.config.enabled) return null;

  let tickWindow: NormalizedMarketTick[] = [];
  let summarySource: SetupMicrostructureSummary['source'] = 'live_tick_cache';
  if (input.hasHistoricalTimestamp) {
    if (Array.isArray(input.historicalTicks) && input.historicalTicks.length > 0) {
      tickWindow = input.historicalTicks;
      summarySource = 'historical_ticks_injected';
    } else {
      const dateStr = input.historicalTimestampIso
        ? toEasternTime(new Date(input.historicalTimestampIso)).dateStr
        : toEasternTime(new Date(input.nowMs)).dateStr;
      const bars = await loadHistoricalSecondBars(dateStr);
      const limitedBars = bars
        .filter((bar) => bar.t <= input.nowMs)
        .slice(-Math.max(input.config.lookbackTicks * 4, 720));
      tickWindow = limitedBars
        .map((bar) => secondBarToSyntheticTick(bar, input.symbol))
        .filter((tick): tick is NormalizedMarketTick => tick !== null);
      summarySource = 'historical_second_bars';
    }
  } else {
    tickWindow = getRecentTicks(input.symbol, input.config.lookbackTicks);
    summarySource = 'live_tick_cache';
  }

  const recentTicks = tickWindow.filter((tick) => (
    Number.isFinite(tick.timestamp)
    && tick.timestamp > 0
    && input.nowMs >= tick.timestamp
    && (input.nowMs - tick.timestamp) <= MICROSTRUCTURE_STALE_WINDOW_MS
  ));

  if (recentTicks.length === 0) return null;

  let buyVolume = 0;
  let sellVolume = 0;
  let neutralVolume = 0;
  let quoteSamples = 0;
  let imbalanceSamples = 0;
  let imbalanceSum = 0;
  let spreadSamples = 0;
  let spreadSum = 0;
  let latestTimestampMs: number | null = null;

  for (const tick of recentTicks) {
    const volume = Math.max(0, Math.floor(tick.size));
    const side = classifyAggressorSideFromTick(tick);
    if (side === 'buyer') buyVolume += volume;
    else if (side === 'seller') sellVolume += volume;
    else neutralVolume += volume;

    if (
      typeof tick.bid === 'number'
      && Number.isFinite(tick.bid)
      && typeof tick.ask === 'number'
      && Number.isFinite(tick.ask)
      && tick.ask >= tick.bid
    ) {
      quoteSamples += 1;
    }

    const imbalance = bidAskImbalanceFromTick(tick);
    if (imbalance != null) {
      imbalanceSamples += 1;
      imbalanceSum += imbalance;
    }

    const spreadBps = spreadBpsFromTick(tick);
    if (spreadBps != null) {
      spreadSamples += 1;
      spreadSum += spreadBps;
    }

    latestTimestampMs = latestTimestampMs == null
      ? tick.timestamp
      : Math.max(latestTimestampMs, tick.timestamp);
  }

  const sampleCount = recentTicks.length;
  const directionalVolume = buyVolume + sellVolume;
  const quoteCoveragePct = sampleCount > 0 ? quoteSamples / sampleCount : 0;
  const aggressorSkew = directionalVolume > 0
    ? (buyVolume - sellVolume) / directionalVolume
    : null;
  const bidAskImbalance = imbalanceSamples > 0 ? (imbalanceSum / imbalanceSamples) : null;
  const avgSpreadBps = spreadSamples > 0 ? (spreadSum / spreadSamples) : null;
  const available = (
    sampleCount >= input.config.minTicks
    && directionalVolume >= input.config.minDirectionalVolume
    && quoteCoveragePct >= input.config.minQuoteCoveragePct
  );

  return {
    source: summarySource,
    sampleCount,
    quoteCoveragePct: round(quoteCoveragePct * 100, 2),
    buyVolume,
    sellVolume,
    neutralVolume,
    directionalVolume,
    aggressorSkew: aggressorSkew == null ? null : round(aggressorSkew, 4),
    bidAskImbalance: bidAskImbalance == null ? null : round(bidAskImbalance, 4),
    avgSpreadBps: avgSpreadBps == null ? null : round(avgSpreadBps, 2),
    latestTimestampMs,
    available,
  };
}

function evaluateMicrostructureAlignment(input: {
  direction: 'bullish' | 'bearish';
  setupType: SetupType;
  summary: SetupMicrostructureSummary | null;
  config: SetupMicrostructureConfig;
}): SetupMicrostructureAlignment {
  if (!input.summary || !input.summary.available) {
    return {
      available: false,
      aligned: false,
      conflict: false,
      score: null,
      reasons: ['microstructure_unavailable'],
    };
  }

  const directional = input.direction === 'bullish' ? 1 : -1;
  let score = 50;
  const reasons: string[] = [];

  if (typeof input.summary.aggressorSkew === 'number') {
    const directionalSkew = directional * input.summary.aggressorSkew;
    if (directionalSkew >= input.config.minAggressorSkewAbs) {
      score += 24;
      reasons.push('aggressor_skew_aligned');
    } else if (directionalSkew <= -input.config.minAggressorSkewAbs) {
      score -= 24;
      reasons.push('aggressor_skew_conflict');
    }
  }

  if (typeof input.summary.bidAskImbalance === 'number') {
    const directionalImbalance = directional * input.summary.bidAskImbalance;
    if (directionalImbalance >= input.config.minImbalanceAbs) {
      score += 14;
      reasons.push('orderbook_imbalance_aligned');
    } else if (directionalImbalance <= -input.config.minImbalanceAbs) {
      score -= 14;
      reasons.push('orderbook_imbalance_conflict');
    }
  }

  if (typeof input.summary.avgSpreadBps === 'number') {
    if (input.summary.avgSpreadBps <= input.config.maxSpreadBps) {
      score += 8;
      reasons.push('spread_within_floor');
    } else {
      score -= 10;
      reasons.push('spread_too_wide');
    }
  }

  if (
    TREND_MICROSTRUCTURE_REQUIRED_SETUP_TYPES.has(input.setupType)
    && input.summary.quoteCoveragePct >= 55
  ) {
    score += 6;
  }

  const finalScore = clamp(score);
  return {
    available: true,
    aligned: finalScore >= 60,
    conflict: finalScore <= 35,
    score: round(finalScore, 2),
    reasons,
  };
}

function hasStrikeFlowConfluence(flowQuality: FlowQualitySummary): boolean {
  return (
    flowQuality.recentDirectionalEvents >= FLOW_QUALITY_MIN_EVENTS
    && flowQuality.localDirectionalEvents >= 1
    && flowQuality.localCoveragePct >= 35
  );
}

function evaluateIntradayGammaPressure(input: {
  flowEvents: SPXFlowEvent[];
  direction: 'bullish' | 'bearish';
  nowMs: number;
  flipPoint: number;
}): { score: number | null; aligned: boolean; skew: number | null } {
  const directional = input.direction === 'bullish' ? 1 : -1;
  const weighted = input.flowEvents
    .filter((event) => isRecentFlowEvent(event, input.nowMs))
    .map((event) => {
      const distance = Math.abs(event.strike - input.flipPoint);
      const distanceWeight = 1 / Math.max(1, distance / 8);
      return {
        premium: event.premium * distanceWeight,
        signedPremium: (event.direction === 'bullish' ? 1 : -1) * event.premium * distanceWeight,
      };
    });

  const totalWeightedPremium = weighted.reduce((sum, event) => sum + Math.max(0, event.premium), 0);
  if (totalWeightedPremium < FLOW_MIN_DIRECTIONAL_PREMIUM) {
    return { score: null, aligned: false, skew: null };
  }

  const signed = weighted.reduce((sum, event) => sum + event.signedPremium, 0);
  const skew = signed / totalWeightedPremium;
  const directionalSkew = directional * skew;
  const score = clamp(50 + (directionalSkew * 45));
  return {
    score: round(score, 2),
    aligned: directionalSkew >= 0.12,
    skew: round(skew, 4),
  };
}

function calculateMacroAlignmentScore(input: {
  regimeAligned: boolean;
  regimeConflict: boolean;
  flowConfirmed: boolean;
  flowAlignmentPct: number | null;
  flowDivergence: boolean;
  emaAligned: boolean;
  volumeRegimeAligned: boolean;
  gexAligned: boolean;
  gammaPressureAligned: boolean;
  microstructureScore: number | null;
}): number {
  const flowComponent = input.flowAlignmentPct != null
    ? Math.min(35, Math.max(0, input.flowAlignmentPct * 0.35))
    : (input.flowConfirmed ? 20 : 12);
  const regimeComponent = input.regimeAligned ? 24 : 10;
  const emaComponent = input.emaAligned ? 14 : 6;
  const volumeComponent = input.volumeRegimeAligned ? 11 : 5;
  const gexComponent = input.gexAligned ? 10 : 4;
  const gammaComponent = input.gammaPressureAligned ? 8 : 3;
  const microAdj = input.microstructureScore == null
    ? 0
    : ((input.microstructureScore - 50) * 0.18);
  const penalties = (
    (input.regimeConflict ? 18 : 0)
    + (input.flowDivergence ? 14 : 0)
  );

  return round(clamp(
    regimeComponent
      + flowComponent
      + emaComponent
      + volumeComponent
      + gexComponent
      + gammaComponent
      + microAdj
      - penalties,
  ), 2);
}

function volumeTrendFromBars(bars: Array<{ v: number }>): 'rising' | 'flat' | 'falling' {
  if (bars.length < 15) return 'flat';
  const last = bars.slice(-5).reduce((sum, bar) => sum + bar.v, 0) / 5;
  const prior = bars.slice(-10, -5).reduce((sum, bar) => sum + bar.v, 0) / 5;
  if (!Number.isFinite(last) || !Number.isFinite(prior) || prior <= 0) return 'flat';
  const ratio = last / prior;
  if (ratio > 1.2) return 'rising';
  if (ratio < 0.85) return 'falling';
  return 'flat';
}

function toBarHigh(bar: { h?: number; o?: number; c: number }): number {
  if (typeof bar.h === 'number' && Number.isFinite(bar.h)) return bar.h;
  if (typeof bar.o === 'number' && Number.isFinite(bar.o)) return Math.max(bar.o, bar.c);
  return bar.c;
}

function toBarLow(bar: { l?: number; o?: number; c: number }): number {
  if (typeof bar.l === 'number' && Number.isFinite(bar.l)) return bar.l;
  if (typeof bar.o === 'number' && Number.isFinite(bar.o)) return Math.min(bar.o, bar.c);
  return bar.c;
}

function buildIndicatorContextFromBars(input: {
  bars: Array<{ c: number; v: number; t: number; o?: number; h?: number; l?: number }>;
  asOfTimestamp: string;
}): SetupIndicatorContext | null {
  const sortedBars = [...input.bars]
    .filter((bar) => Number.isFinite(bar.c) && bar.c > 0)
    .sort((a, b) => a.t - b.t);
  if (sortedBars.length < EMA_MIN_BARS) return null;

  const closes = sortedBars.map((bar) => bar.c);
  const emaFast = ema(closes, Math.min(EMA_FAST_PERIOD, closes.length));
  const emaSlow = ema(closes, Math.min(EMA_SLOW_PERIOD, closes.length));

  const priorCloses = closes.slice(0, -1);
  const emaFastPrior = priorCloses.length > 0
    ? ema(priorCloses, Math.min(EMA_FAST_PERIOD, priorCloses.length))
    : emaFast;
  const emaSlowPrior = priorCloses.length > 0
    ? ema(priorCloses, Math.min(EMA_SLOW_PERIOD, priorCloses.length))
    : emaSlow;
  const firstBar = sortedBars[0];
  const asOfMsRaw = Date.parse(input.asOfTimestamp);
  const asOfMs = Number.isFinite(asOfMsRaw) ? asOfMsRaw : sortedBars[sortedBars.length - 1].t;
  const minutesSinceOpen = Math.max(0, Math.floor((asOfMs - firstBar.t) / 60_000));
  const orbWindowEnd = firstBar.t + (ORB_WINDOW_MINUTES * 60_000);
  const orbBars = sortedBars.filter((bar) => bar.t <= orbWindowEnd);
  const orbHigh = orbBars.reduce((max, bar) => Math.max(max, toBarHigh(bar)), Number.NEGATIVE_INFINITY);
  const orbLow = orbBars.reduce((min, bar) => Math.min(min, toBarLow(bar)), Number.POSITIVE_INFINITY);
  const sessionOpenPrice = typeof firstBar.o === 'number' && Number.isFinite(firstBar.o)
    ? firstBar.o
    : firstBar.c;

  return {
    emaFast: round(emaFast, 2),
    emaSlow: round(emaSlow, 2),
    emaFastSlope: round(emaFast - emaFastPrior, 4),
    emaSlowSlope: round(emaSlow - emaSlowPrior, 4),
    volumeTrend: volumeTrendFromBars(sortedBars),
    sessionOpenPrice: round(sessionOpenPrice, 2),
    orbHigh: round(Number.isFinite(orbHigh) ? orbHigh : sessionOpenPrice, 2),
    orbLow: round(Number.isFinite(orbLow) ? orbLow : sessionOpenPrice, 2),
    minutesSinceOpen,
    sessionOpenTimestamp: new Date(firstBar.t).toISOString(),
    asOfTimestamp: input.asOfTimestamp,
  };
}

async function loadIndicatorContext(input: {
  evaluationDate: Date;
  asOfTimestamp?: string;
}): Promise<SetupIndicatorContext | null> {
  try {
    const dateStr = toEasternTime(input.evaluationDate).dateStr;
    const bars = await getMinuteAggregates('I:SPX', dateStr);
    if (!Array.isArray(bars) || bars.length === 0) return null;

    const asOfMs = input.asOfTimestamp ? Date.parse(input.asOfTimestamp) : Number.NaN;
    const usableBars = Number.isFinite(asOfMs)
      ? bars.filter((bar) => bar.t <= asOfMs)
      : bars;

    return buildIndicatorContextFromBars({
      bars: usableBars,
      asOfTimestamp: input.asOfTimestamp || input.evaluationDate.toISOString(),
    });
  } catch {
    return null;
  }
}

function isEmaAligned(input: {
  direction: 'bullish' | 'bearish';
  currentPrice: number;
  indicatorContext: SetupIndicatorContext | null;
}): boolean {
  const context = input.indicatorContext;
  if (!context) return false;

  if (input.direction === 'bullish') {
    return (
      context.emaFast >= context.emaSlow
      && context.emaFastSlope >= -EMA_MIN_SLOPE_POINTS
      && input.currentPrice >= context.emaFast - EMA_PRICE_TOLERANCE_POINTS
    );
  }

  return (
    context.emaFast <= context.emaSlow
    && context.emaFastSlope <= EMA_MIN_SLOPE_POINTS
    && input.currentPrice <= context.emaFast + EMA_PRICE_TOLERANCE_POINTS
  );
}

function isVolumeRegimeAligned(input: {
  regime: Regime;
  indicatorContext: SetupIndicatorContext | null;
}): boolean {
  const trend = input.indicatorContext?.volumeTrend || 'flat';
  if (input.regime === 'breakout' || input.regime === 'trending') {
    return trend === 'rising';
  }
  return trend === 'flat' || trend === 'falling';
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

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function regimeWeights(regime: Regime): {
  structure: number;
  flow: number;
  gex: number;
  regime: number;
  proximity: number;
  microTrigger: number;
} {
  if (regime === 'compression') {
    return {
      structure: 0.24,
      flow: 0.22,
      gex: 0.18,
      regime: 0.16,
      proximity: 0.12,
      microTrigger: 0.08,
    };
  }

  if (regime === 'trending') {
    return {
      structure: 0.30,
      flow: 0.24,
      gex: 0.08,
      regime: 0.20,
      proximity: 0.10,
      microTrigger: 0.08,
    };
  }

  return {
    structure: 0.22,
    flow: 0.20,
    gex: 0.20,
    regime: 0.18,
    proximity: 0.12,
    microTrigger: 0.08,
  };
}

function microTriggerFeature(status: Setup['status'], inEntry: boolean): number {
  if (status === 'triggered') return 90;
  if (status === 'ready' && inEntry) return 84;
  if (status === 'ready') return 66;
  if (status === 'forming') return 48;
  if (status === 'invalidated') return 10;
  return 12;
}

function deriveSetupTier(input: {
  status: Setup['status'];
  score: number;
  pWinCalibrated: number;
  evR: number;
  config: SetupScoringConfig;
}): SetupTier {
  if (input.status === 'invalidated' || input.status === 'expired') return 'hidden';
  if (input.status === 'forming') {
    return input.score >= 60 ? 'watchlist' : 'hidden';
  }

  if (
    input.score >= input.config.sniperPrimaryScore
    && input.pWinCalibrated >= input.config.sniperPrimaryPWin
    && input.evR >= input.config.sniperPrimaryEvR
  ) {
    return 'sniper_primary';
  }

  if (
    input.score >= input.config.sniperSecondaryScore
    && input.pWinCalibrated >= input.config.sniperSecondaryPWin
    && input.evR >= input.config.sniperSecondaryEvR
  ) {
    return 'sniper_secondary';
  }

  return input.score >= 60 ? 'watchlist' : 'hidden';
}

function toSessionMinuteEt(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const et = toEasternTime(new Date(parsed));
  return Math.max(0, (et.hour * 60 + et.minute) - SESSION_OPEN_MINUTE_ET);
}

type SetupGeometryBucket = 'opening' | 'midday' | 'late';

function toGeometryBucket(minuteSinceOpenEt: number | null): SetupGeometryBucket {
  if (minuteSinceOpenEt == null) return 'midday';
  if (minuteSinceOpenEt <= GEOMETRY_BUCKET_OPENING_MAX_MINUTE) return 'opening';
  if (minuteSinceOpenEt <= GEOMETRY_BUCKET_MIDDAY_MAX_MINUTE) return 'midday';
  return 'late';
}

function normalizeGeometryPolicyEntry(
  raw: unknown,
  fallback: SPXGeometryPolicyEntry = FALLBACK_GEOMETRY_POLICY,
): SPXGeometryPolicyEntry {
  const candidate = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const stopScale = clamp(
    toFiniteNumber(candidate.stopScale) ?? fallback.stopScale,
    0.75,
    1.4,
  );
  const target1Scale = clamp(
    toFiniteNumber(candidate.target1Scale) ?? fallback.target1Scale,
    0.7,
    1.3,
  );
  const target2Scale = clamp(
    toFiniteNumber(candidate.target2Scale) ?? fallback.target2Scale,
    0.7,
    1.4,
  );
  const t1MinR = clamp(
    toFiniteNumber(candidate.t1MinR) ?? fallback.t1MinR,
    0.6,
    3.5,
  );
  const t1MaxR = clamp(
    toFiniteNumber(candidate.t1MaxR) ?? fallback.t1MaxR,
    t1MinR + 0.1,
    4.5,
  );
  const t2MinR = clamp(
    toFiniteNumber(candidate.t2MinR) ?? fallback.t2MinR,
    Math.max(0.8, t1MinR + 0.2),
    4.2,
  );
  const t2MaxR = clamp(
    toFiniteNumber(candidate.t2MaxR) ?? fallback.t2MaxR,
    Math.max(t2MinR + 0.1, t1MaxR + 0.2),
    6,
  );
  return {
    stopScale: round(stopScale, 4),
    target1Scale: round(target1Scale, 4),
    target2Scale: round(target2Scale, 4),
    t1MinR: round(t1MinR, 4),
    t1MaxR: round(t1MaxR, 4),
    t2MinR: round(t2MinR, 4),
    t2MaxR: round(t2MaxR, 4),
  };
}

function mergeGeometryPolicy(
  base: SPXGeometryPolicyEntry,
  patch: unknown,
): SPXGeometryPolicyEntry {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return base;
  return normalizeGeometryPolicyEntry({
    ...base,
    ...(patch as Record<string, unknown>),
  }, base);
}

function defaultGeometryPolicyForSetup(setupType: SetupType): SPXGeometryPolicyEntry {
  if (setupType === 'orb_breakout') {
    return {
      stopScale: 1.02,
      target1Scale: 1,
      target2Scale: 1,
      t1MinR: ORB_BREAKOUT_T1_R_MIN_MULTIPLIER,
      t1MaxR: ORB_BREAKOUT_T1_R_MAX_MULTIPLIER,
      t2MinR: ORB_BREAKOUT_T2_R_MIN_MULTIPLIER,
      t2MaxR: ORB_BREAKOUT_T2_R_MAX_MULTIPLIER,
    };
  }
  if (setupType === 'trend_pullback') {
    return {
      stopScale: 1,
      target1Scale: TREND_PULLBACK_TARGET_SCALE,
      target2Scale: TREND_PULLBACK_TARGET_SCALE,
      t1MinR: TREND_PULLBACK_T1_R_MIN_MULTIPLIER,
      t1MaxR: TREND_PULLBACK_T1_R_MAX_MULTIPLIER,
      t2MinR: TREND_PULLBACK_T2_R_MIN_MULTIPLIER,
      t2MaxR: TREND_PULLBACK_T2_R_MAX_MULTIPLIER,
    };
  }
  if (setupType === 'trend_continuation') {
    return {
      stopScale: 1,
      target1Scale: 1,
      target2Scale: 1,
      t1MinR: TREND_PULLBACK_T1_R_MIN_MULTIPLIER,
      t1MaxR: TREND_PULLBACK_T1_R_MAX_MULTIPLIER,
      t2MinR: TREND_PULLBACK_T2_R_MIN_MULTIPLIER,
      t2MaxR: TREND_PULLBACK_T2_R_MAX_MULTIPLIER,
    };
  }
  if (setupType === 'mean_reversion') {
    return {
      stopScale: 1,
      target1Scale: MEAN_FADE_TARGET_SCALE,
      target2Scale: MEAN_FADE_TARGET_SCALE,
      t1MinR: MEAN_REVERSION_T1_R_MULTIPLIER,
      t1MaxR: MEAN_REVERSION_T1_R_MAX_MULTIPLIER,
      t2MinR: MEAN_REVERSION_T2_R_MULTIPLIER,
      t2MaxR: MEAN_REVERSION_T2_R_MAX_MULTIPLIER,
    };
  }
  if (setupType === 'fade_at_wall') {
    return {
      stopScale: 1,
      target1Scale: MEAN_FADE_TARGET_SCALE,
      target2Scale: MEAN_FADE_TARGET_SCALE,
      t1MinR: 1,
      t1MaxR: 1.7,
      t2MinR: 1.5,
      t2MaxR: 2.4,
    };
  }
  if (setupType === 'flip_reclaim') {
    return {
      stopScale: 1,
      target1Scale: 1,
      target2Scale: 1,
      t1MinR: FLIP_RECLAIM_T1_R_MULTIPLIER,
      t1MaxR: 2.2,
      t2MinR: FLIP_RECLAIM_T2_R_MULTIPLIER,
      t2MaxR: 3.2,
    };
  }
  return FALLBACK_GEOMETRY_POLICY;
}

function resolveSetupGeometryPolicy(input: {
  setupType: SetupType;
  regime: Regime;
  firstSeenMinuteEt: number | null;
  profile: Awaited<ReturnType<typeof getActiveSPXOptimizationProfile>>;
}): SPXGeometryPolicyEntry {
  const bucket = toGeometryBucket(input.firstSeenMinuteEt);
  const fallback = defaultGeometryPolicyForSetup(input.setupType);
  const policy = input.profile.geometryPolicy;
  const byType = normalizeGeometryPolicyEntry(
    policy?.bySetupType?.[input.setupType],
    fallback,
  );
  const byRegime = policy?.bySetupRegime?.[`${input.setupType}|${input.regime}`];
  const byRegimeBucket = policy?.bySetupRegimeTimeBucket?.[
    `${input.setupType}|${input.regime}|${bucket}`
  ];
  return mergeGeometryPolicy(mergeGeometryPolicy(byType, byRegime), byRegimeBucket);
}

function applyStopGeometryPolicy(input: {
  direction: 'bullish' | 'bearish';
  entryLow: number;
  entryHigh: number;
  baseStop: number;
  geometryPolicy: SPXGeometryPolicyEntry;
}): number {
  const entryMid = (input.entryLow + input.entryHigh) / 2;
  const risk = Math.max(0.35, Math.abs(entryMid - input.baseStop));
  const scaledRisk = Math.max(0.35, risk * input.geometryPolicy.stopScale);
  const stop = input.direction === 'bullish'
    ? entryMid - scaledRisk
    : entryMid + scaledRisk;
  return round(stop, 2);
}

function maxFirstSeenMinuteForSetup(
  setupType: SetupType,
  profile: Awaited<ReturnType<typeof getActiveSPXOptimizationProfile>>,
): number {
  const configured = profile.timingGate.maxFirstSeenMinuteBySetupType[setupType];
  if (Number.isFinite(configured)) return configured;
  return DEFAULT_MAX_FIRST_SEEN_MINUTE_BY_SETUP_TYPE[setupType] ?? 390;
}

function evaluateOptimizationGate(input: {
  status: Setup['status'];
  wasPreviouslyTriggered: boolean;
  setupType: SetupType;
  regime: Regime;
  firstSeenAtIso: string | null;
  confluenceScore: number;
  pWinCalibrated: number;
  evR: number;
  flowConfirmed: boolean;
  flowAlignmentPct: number | null;
  flowQuality: FlowQualitySummary;
  macroAlignmentScore: number;
  macroFilterConfig: SetupMacroFilterConfig;
  emaAligned: boolean;
  volumeRegimeAligned: boolean;
  microstructureConfig: SetupMicrostructureConfig;
  microstructureAlignment: SetupMicrostructureAlignment;
  orbTrendConfluence: SetupOrbTrendConfluence;
  requireOrbTrendConfluence: boolean;
  pausedSetupTypes: Set<string>;
  pausedCombos: Set<string>;
  profile: Awaited<ReturnType<typeof getActiveSPXOptimizationProfile>>;
  direction: 'bullish' | 'bearish';
}): { reasons: string[]; effectiveFlowConfirmed: boolean; effectiveVolumeAligned: boolean } {
  const actionableStatuses = new Set(input.profile.qualityGate.actionableStatuses);
  const isNewActionable = (input.status === 'ready' || input.status === 'triggered') && !input.wasPreviouslyTriggered;
  if (!isNewActionable || !actionableStatuses.has(input.status)) {
    return { reasons: [], effectiveFlowConfirmed: input.flowConfirmed, effectiveVolumeAligned: input.volumeRegimeAligned };
  }

  const reasons: string[] = [];
  const useSetupSpecificFloors = parseBooleanEnv(
    process.env.SPX_SETUP_SPECIFIC_GATES_ENABLED,
    true,
  );
  const setupFloors = useSetupSpecificFloors
    ? SETUP_SPECIFIC_GATE_FLOORS[input.setupType]
    : undefined;
  const minConfluenceScore = Math.max(
    input.profile.qualityGate.minConfluenceScore,
    setupFloors?.minConfluenceScore ?? 0,
  );
  const minPWinCalibrated = Math.max(
    input.profile.qualityGate.minPWinCalibrated,
    setupFloors?.minPWinCalibrated ?? 0,
  );
  const minEvR = Math.max(
    input.profile.qualityGate.minEvR,
    setupFloors?.minEvR ?? Number.NEGATIVE_INFINITY,
  );
  const requireFlowConfirmation = (
    input.profile.flowGate.requireFlowConfirmation
    || setupFloors?.requireFlowConfirmation === true
  );
  const minAlignmentPct = Math.max(
    requireFlowConfirmation ? input.profile.flowGate.minAlignmentPct : 0,
    setupFloors?.minAlignmentPct ?? 0,
  );
  const requireEmaAlignment = (
    input.profile.indicatorGate.requireEmaAlignment
    || setupFloors?.requireEmaAlignment === true
  );
  const requireVolumeRegimeAlignment = (
    input.profile.indicatorGate.requireVolumeRegimeAlignment
    || setupFloors?.requireVolumeRegimeAlignment === true
  );
  const comboKey = `${input.setupType}|${input.regime}`;
  const firstSeenMinute = toSessionMinuteEt(input.firstSeenAtIso);
  const trendFamilyFlowGraceEligible = (
    input.setupType === 'trend_pullback'
    && firstSeenMinute != null
    && firstSeenMinute <= 300
    && input.emaAligned
    && input.confluenceScore >= Math.max(3, minConfluenceScore - 1)
  );
  const orbFlowGraceEligible = (
    input.setupType === 'orb_breakout'
    && input.orbTrendConfluence.aligned
    && input.emaAligned
    && input.confluenceScore >= Math.max(3, minConfluenceScore)
  );
  const trendFamilyVolumeGraceEligible = (
    input.setupType === 'trend_pullback'
    && firstSeenMinute != null
    && firstSeenMinute <= 300
    && input.emaAligned
    && input.confluenceScore >= 3
  );
  const orbVolumeGraceEligible = (
    input.setupType === 'orb_breakout'
    && firstSeenMinute != null
    && firstSeenMinute <= 240
    && input.emaAligned
    && input.confluenceScore >= 3
    && input.orbTrendConfluence.aligned
  );
  const volumeGraceExpandedEnabled = parseBooleanEnv(
    process.env.SPX_VOLUME_GRACE_EXPANDED_ENABLED,
    true,
  );
  const expandedVolumeGraceEligible = (
    volumeGraceExpandedEnabled
    && TREND_SETUP_TYPES.has(input.setupType)
    && input.volumeRegimeAligned === false
    && input.emaAligned
    && input.confluenceScore >= Math.max(3, minConfluenceScore)
  );
  const flowAlignmentUnavailable = input.flowAlignmentPct == null;
  const flowDataSparse = (
    input.flowQuality.recentDirectionalEvents < FLOW_QUALITY_MIN_EVENTS
    && input.flowQuality.recentDirectionalPremium < FLOW_MIN_DIRECTIONAL_PREMIUM
  );
  const flowAvailability: 'available' | 'sparse' | 'unavailable' = (
    !flowAlignmentUnavailable ? 'available'
    : !flowDataSparse ? 'sparse'
    : 'unavailable'
  );
  const flowUnavailableGraceEnabled = parseBooleanEnv(
    process.env.SPX_FLOW_UNAVAILABLE_GRACE_ENABLED,
    true,
  );
  const flowUnavailableGraceActive = (
    flowUnavailableGraceEnabled
    && flowAvailability !== 'available'
    && input.emaAligned
    && input.confluenceScore >= Math.max(3, minConfluenceScore)
  );
  const trendFlowUnavailableGraceEligible = (
    TREND_SETUP_TYPES.has(input.setupType)
    && flowAlignmentUnavailable
    && flowDataSparse
    && input.emaAligned
    && input.confluenceScore >= Math.max(3, minConfluenceScore)
  );
  const orbTrendFusionGraceEligible = (
    input.setupType === 'trend_pullback'
    && input.orbTrendConfluence.aligned
  );
  if (input.pausedSetupTypes.has(input.setupType)) {
    reasons.push(`setup_type_paused:${input.setupType}`);
  }
  if (input.pausedCombos.has(comboKey)) {
    reasons.push(`regime_combo_paused:${comboKey}`);
  }
  if (input.confluenceScore < minConfluenceScore) {
    reasons.push(`confluence_below_floor:${input.confluenceScore}<${minConfluenceScore}`);
  }
  if (input.pWinCalibrated < minPWinCalibrated) {
    reasons.push(`pwin_below_floor:${round(input.pWinCalibrated, 4)}<${minPWinCalibrated}`);
  }
  if (input.evR < minEvR) {
    reasons.push(`evr_below_floor:${round(input.evR, 3)}<${round(minEvR, 3)}`);
  }
  if (
    requireFlowConfirmation
    && !input.flowConfirmed
    && !flowUnavailableGraceActive
    && !trendFamilyFlowGraceEligible
    && !orbFlowGraceEligible
    && !trendFlowUnavailableGraceEligible
    && !orbTrendFusionGraceEligible
  ) {
    reasons.push('flow_confirmation_required');
  }
  if (input.flowAlignmentPct != null) {
    if (minAlignmentPct > 0 && input.flowAlignmentPct < minAlignmentPct) {
      reasons.push(`flow_alignment_below_floor:${round(input.flowAlignmentPct, 2)}<${minAlignmentPct}`);
    }
  } else if (
    requireFlowConfirmation
    && minAlignmentPct > 0
    && !flowUnavailableGraceActive
    && !trendFamilyFlowGraceEligible
    && !orbFlowGraceEligible
    && !trendFlowUnavailableGraceEligible
    && !orbTrendFusionGraceEligible
  ) {
    reasons.push('flow_alignment_unavailable');
  }
  if (requireEmaAlignment && !input.emaAligned) {
    reasons.push('ema_alignment_required');
  }
  if (
    requireVolumeRegimeAlignment
    && !input.volumeRegimeAligned
    && !expandedVolumeGraceEligible
    && !trendFamilyVolumeGraceEligible
    && !orbVolumeGraceEligible
    && !orbTrendFusionGraceEligible
  ) {
    reasons.push('volume_regime_alignment_required');
  }
  const setupSpecificMaxMinute = setupFloors?.maxFirstSeenMinuteEt;
  const timingGateEnabled = input.profile.timingGate.enabled || Number.isFinite(setupSpecificMaxMinute);
  if (timingGateEnabled) {
    const profileMaxMinute = input.profile.timingGate.enabled
      ? maxFirstSeenMinuteForSetup(input.setupType, input.profile)
      : 390;
    const maxMinute = Math.min(
      profileMaxMinute,
      Number.isFinite(setupSpecificMaxMinute) ? (setupSpecificMaxMinute as number) : 390,
    );
    if (firstSeenMinute != null && firstSeenMinute > maxMinute) {
      reasons.push(`timing_gate_blocked:${firstSeenMinute}>${maxMinute}`);
    }
  }

  if (input.setupType === 'fade_at_wall' && input.regime === 'ranging') {
    if (input.flowConfirmed) {
      reasons.push('fade_flow_momentum_conflict');
    }
    if (input.flowAlignmentPct != null && input.flowAlignmentPct >= FADE_ALIGNMENT_MAX_PCT) {
      reasons.push(`fade_alignment_too_high:${round(input.flowAlignmentPct, 2)}>=${FADE_ALIGNMENT_MAX_PCT}`);
    }
    if (input.direction === 'bullish' && input.flowAlignmentPct != null && input.flowAlignmentPct >= 75) {
      reasons.push(`fade_bullish_alignment_conflict:${round(input.flowAlignmentPct, 2)}`);
    }
  }

  const hasDirectionalFlowSample = (
    input.flowQuality.recentDirectionalEvents > 0
    || input.flowQuality.recentDirectionalPremium >= FLOW_MIN_DIRECTIONAL_PREMIUM
  );
  const orbSparseFlowGrace = (
    input.setupType === 'orb_breakout'
    && !hasDirectionalFlowSample
    && flowAvailability !== 'available'
    && input.emaAligned
    && input.confluenceScore >= 3
  );
  if (input.setupType === 'orb_breakout') {
    if (hasDirectionalFlowSample && !orbSparseFlowGrace) {
      if (input.flowQuality.recentDirectionalEvents < FLOW_QUALITY_MIN_EVENTS) {
        reasons.push(`flow_event_count_low:${input.flowQuality.recentDirectionalEvents}<${FLOW_QUALITY_MIN_EVENTS}`);
      }
      const effectiveOrbMinFlowQuality = flowAvailability === 'sparse'
        ? ORB_MIN_FLOW_QUALITY_SCORE - 7
        : ORB_MIN_FLOW_QUALITY_SCORE;
      if (input.flowQuality.score < effectiveOrbMinFlowQuality) {
        reasons.push(`flow_quality_low:${round(input.flowQuality.score, 2)}<${effectiveOrbMinFlowQuality}`);
      }
    } else if (!input.orbTrendConfluence.aligned && !orbSparseFlowGrace) {
      reasons.push('orb_flow_or_confluence_required');
    }
  }

  if (input.setupType === 'trend_pullback' && firstSeenMinute != null) {
    const trendTimingByRegime: Record<Regime, number> = {
      breakout: 240,
      trending: 260,
      compression: 220,
      ranging: 200,
    };
    const trendMaxMinute = trendTimingByRegime[input.regime];
    if (firstSeenMinute > trendMaxMinute) {
      reasons.push(`trend_timing_window:${firstSeenMinute}>${trendMaxMinute}`);
    }
  }
  if (
    input.setupType === 'trend_pullback'
    && input.requireOrbTrendConfluence
    && !input.orbTrendConfluence.aligned
  ) {
    reasons.push('trend_orb_confluence_required');
  }

  if (
    input.macroFilterConfig.enabled
    && input.macroAlignmentScore < input.macroFilterConfig.minAlignmentScore
  ) {
    reasons.push(
      `macro_alignment_below_floor:${round(input.macroAlignmentScore, 2)}<${round(input.macroFilterConfig.minAlignmentScore, 2)}`
    );
  }

  const requireMicrostructureAlignment = input.microstructureConfig.requireTrendAlignment;
  if (requireMicrostructureAlignment) {
    if (input.microstructureAlignment.available && !input.microstructureAlignment.aligned) {
      reasons.push('microstructure_alignment_required');
    } else if (!input.microstructureAlignment.available && input.microstructureConfig.failClosedWhenUnavailable) {
      reasons.push('microstructure_unavailable');
    }
    if (input.microstructureAlignment.conflict) {
      reasons.push('microstructure_conflict');
    }
  }

  // Compute grace-aware effective booleans for optimizer parity.
  // When a flow/volume grace allows a setup through the gate, the optimizer's
  // passesCandidate must also see these as effectively satisfied.
  const flowGraceApplied = (
    requireFlowConfirmation
    && !input.flowConfirmed
    && (flowUnavailableGraceActive
      || trendFamilyFlowGraceEligible
      || orbFlowGraceEligible
      || trendFlowUnavailableGraceEligible
      || orbTrendFusionGraceEligible
      || orbSparseFlowGrace)
  );
  const volumeGraceApplied = (
    requireVolumeRegimeAlignment
    && !input.volumeRegimeAligned
    && (expandedVolumeGraceEligible
      || trendFamilyVolumeGraceEligible
      || orbVolumeGraceEligible
      || orbTrendFusionGraceEligible)
  );

  return {
    reasons,
    effectiveFlowConfirmed: input.flowConfirmed || flowGraceApplied,
    effectiveVolumeAligned: input.volumeRegimeAligned || volumeGraceApplied,
  };
}

function setupSemanticKey(setup: Setup): string {
  return [
    setup.type,
    setup.direction,
    round(setup.entryZone.low, 2),
    round(setup.entryZone.high, 2),
    round(setup.stop, 2),
    round(setup.target1.price, 2),
    round(setup.target2.price, 2),
    setup.regime,
  ].join('|');
}

function withBlockedByMixPolicy(setup: Setup, reason: string, nowMs: number): Setup {
  const existingReasons = Array.isArray(setup.gateReasons) ? setup.gateReasons : [];
  const nextReasons = existingReasons.includes(reason) ? existingReasons : [...existingReasons, reason];
  return {
    ...setup,
    status: 'forming',
    gateStatus: 'blocked',
    gateReasons: nextReasons,
    tier: 'hidden',
    statusUpdatedAt: new Date(nowMs).toISOString(),
    triggeredAt: null,
    invalidationReason: null,
  };
}

function withReadyByMixPromotion(setup: Setup, nowMs: number): Setup {
  return {
    ...setup,
    status: 'ready',
    tier: setup.tier === 'hidden' ? 'watchlist' : setup.tier,
    gateStatus: setup.gateStatus === 'blocked' ? 'eligible' : setup.gateStatus,
    gateReasons: setup.gateStatus === 'blocked'
      ? (setup.gateReasons || []).filter((reason) => !reason.startsWith('mix_cap_blocked'))
      : setup.gateReasons,
    statusUpdatedAt: setup.statusUpdatedAt || new Date(nowMs).toISOString(),
  };
}

function trendTelemetryScore(setup: Setup): number {
  const macro = typeof setup.macroAlignmentScore === 'number' ? clamp(setup.macroAlignmentScore) : 0;
  const microScore = typeof setup.microstructureScore === 'number'
    ? clamp(setup.microstructureScore)
    : (typeof setup.microstructure?.score === 'number' ? clamp(setup.microstructure.score) : 0);
  const microAlignedBonus = setup.microstructure?.aligned ? 10 : 0;
  const confluence = clamp((setup.confluenceScore / 5) * 100);
  const setupScore = clamp(setup.score || 0);
  const ev = clamp(((setup.evR || 0.0) + 1) * 50);
  return round(
    (macro * 0.28)
    + (microScore * 0.28)
    + (confluence * 0.16)
    + (setupScore * 0.16)
    + (ev * 0.12)
    + microAlignedBonus,
    2,
  );
}

function isTrendPromotionCandidate(
  setup: Setup,
  config: SetupDiversificationConfig,
): boolean {
  if (!TREND_SETUP_TYPES.has(setup.type)) return false;
  if ((setup.score || 0) < config.trendPromotionMinScore) return false;
  if ((setup.pWinCalibrated || 0) < config.trendPromotionMinPWin) return false;
  if ((setup.evR || 0) < config.trendPromotionMinEvR) return false;
  if ((setup.macroAlignmentScore ?? Number.NEGATIVE_INFINITY) < config.trendPromotionMinMacroScore) return false;
  if (!config.trendPromotionRequireMicroAlignment) return true;
  if (setup.microstructure?.available !== true) return false;
  if (setup.microstructure?.aligned !== true) return false;
  const microScore = typeof setup.microstructureScore === 'number'
    ? setup.microstructureScore
    : (typeof setup.microstructure?.score === 'number' ? setup.microstructure.score : null);
  if (microScore != null && microScore < config.trendPromotionMinMicroScore) return false;
  return true;
}

function applySetupMixPolicy(input: {
  setups: Setup[];
  config: SetupDiversificationConfig;
  nowMs: number;
}): Setup[] {
  if (!input.config.enabled || input.setups.length < 2) {
    return input.setups;
  }

  const setups = [...input.setups];
  const actionableReady = setups
    .map((setup, index) => ({ setup, index }))
    .filter(({ setup }) => setup.status === 'ready' && setup.gateStatus !== 'blocked');

  if (actionableReady.length < 2) {
    return setups;
  }

  const fadeReady = actionableReady
    .filter(({ setup }) => setup.type === 'fade_at_wall')
    .sort((a, b) => (a.setup.score || 0) - (b.setup.score || 0));
  const maxFadeReady = Math.max(1, Math.floor(actionableReady.length * input.config.fadeReadyMaxShare));
  if (fadeReady.length > maxFadeReady) {
    const toBlock = fadeReady.slice(0, fadeReady.length - maxFadeReady);
    for (const item of toBlock) {
      setups[item.index] = withBlockedByMixPolicy(
        setups[item.index],
        `mix_cap_blocked:fade_at_wall>${maxFadeReady}`,
        input.nowMs,
      );
    }
  }

  const refreshedReady = setups
    .map((setup, index) => ({ setup, index }))
    .filter(({ setup }) => setup.status === 'ready' && setup.gateStatus !== 'blocked');
  const alternativeReady = refreshedReady.filter(({ setup }) => setup.type !== 'fade_at_wall');
  const neededAlternative = Math.max(0, input.config.minAlternativeReadySetups - alternativeReady.length);
  if (neededAlternative === 0) {
    return setups;
  }

  const promotableAlternatives = setups
    .map((setup, index) => ({ setup, index }))
    .filter(({ setup }) => (
      setup.status === 'forming'
      && setup.gateStatus !== 'blocked'
      && DIVERSIFICATION_PREFERRED_SETUP_TYPES.has(setup.type)
      && setup.confluenceScore >= 3
      && (setup.score || 0) >= 62
      && (setup.pWinCalibrated || 0) >= 0.56
      && (setup.evR || 0) >= 0.2
      && (!TREND_SETUP_TYPES.has(setup.type) || isTrendPromotionCandidate(setup, input.config))
    ))
    .sort((a, b) => {
      const telemetryDelta = trendTelemetryScore(b.setup) - trendTelemetryScore(a.setup);
      if (telemetryDelta !== 0) return telemetryDelta;
      return (b.setup.score || 0) - (a.setup.score || 0);
    });

  const promoteCount = Math.min(neededAlternative, promotableAlternatives.length);
  for (let i = 0; i < promoteCount; i += 1) {
    const candidate = promotableAlternatives[i];
    setups[candidate.index] = withReadyByMixPromotion(setups[candidate.index], input.nowMs);
  }

  const refreshedAfterAlternativePromotion = setups
    .map((setup, index) => ({ setup, index }))
    .filter(({ setup }) => setup.status === 'ready' && setup.gateStatus !== 'blocked');
  const trendReady = refreshedAfterAlternativePromotion.filter(({ setup }) => TREND_SETUP_TYPES.has(setup.type));
  const neededTrendReady = Math.max(0, input.config.minTrendReadySetups - trendReady.length);
  if (neededTrendReady <= 0) {
    return setups;
  }

  const promotableTrends = setups
    .map((setup, index) => ({ setup, index }))
    .filter(({ setup }) => (
      setup.status === 'forming'
      && setup.gateStatus !== 'blocked'
      && isTrendPromotionCandidate(setup, input.config)
    ))
    .sort((a, b) => {
      const telemetryDelta = trendTelemetryScore(b.setup) - trendTelemetryScore(a.setup);
      if (telemetryDelta !== 0) return telemetryDelta;
      if ((b.setup.score || 0) !== (a.setup.score || 0)) return (b.setup.score || 0) - (a.setup.score || 0);
      return (b.setup.evR || 0) - (a.setup.evR || 0);
    });

  const trendPromoteCount = Math.min(neededTrendReady, promotableTrends.length);
  for (let i = 0; i < trendPromoteCount; i += 1) {
    const candidate = promotableTrends[i];
    setups[candidate.index] = withReadyByMixPromotion(setups[candidate.index], input.nowMs);
  }

  return setups;
}

function shouldReplaceSemanticDuplicate(existing: Setup, incoming: Setup): boolean {
  const statusDelta = SETUP_STATUS_SORT_ORDER[incoming.status] - SETUP_STATUS_SORT_ORDER[existing.status];
  if (statusDelta !== 0) return statusDelta < 0;

  const incomingTier = incoming.tier || 'hidden';
  const existingTier = existing.tier || 'hidden';
  const tierDelta = SETUP_TIER_SORT_ORDER[incomingTier] - SETUP_TIER_SORT_ORDER[existingTier];
  if (tierDelta !== 0) return tierDelta < 0;

  if ((incoming.evR || 0) !== (existing.evR || 0)) return (incoming.evR || 0) > (existing.evR || 0);
  if ((incoming.score || 0) !== (existing.score || 0)) return (incoming.score || 0) > (existing.score || 0);
  if (incoming.probability !== existing.probability) return incoming.probability > existing.probability;

  return toEpochMs(incoming.statusUpdatedAt || incoming.createdAt) > toEpochMs(existing.statusUpdatedAt || existing.createdAt);
}

function dedupeSetupsBySemanticKey(setups: Setup[]): Setup[] {
  const deduped = new Map<string, Setup>();

  for (const setup of setups) {
    const key = setupSemanticKey(setup);
    const existing = deduped.get(key);
    if (!existing || shouldReplaceSemanticDuplicate(existing, setup)) {
      deduped.set(key, setup);
    }
  }

  return Array.from(deduped.values());
}

const SETUP_STATUS_SORT_ORDER: Record<Setup['status'], number> = {
  triggered: 0,
  ready: 1,
  forming: 2,
  invalidated: 3,
  expired: 4,
};

const SETUP_TIER_SORT_ORDER: Record<SetupTier, number> = {
  sniper_primary: 0,
  sniper_secondary: 1,
  watchlist: 2,
  hidden: 3,
};

export async function detectActiveSetups(options?: {
  forceRefresh?: boolean;
  asOfTimestamp?: string;
  persistForWinRate?: boolean;
  levelData?: LevelData;
  gexLandscape?: UnifiedGEXLandscape;
  fibLevels?: FibLevel[];
  regimeState?: RegimeState;
  flowEvents?: SPXFlowEvent[];
  indicatorContext?: SetupIndicatorContext | null;
  historicalTicks?: NormalizedMarketTick[];
  previousSetups?: Setup[];
}): Promise<Setup[]> {
  const levelData = options?.levelData;
  const gexLandscape = options?.gexLandscape;
  const fibLevelsProvided = options?.fibLevels;
  const regimeStateProvided = options?.regimeState;
  const flowEventsProvided = options?.flowEvents;
  const indicatorContextProvided = options?.indicatorContext;
  const hasHistoricalTimestamp = typeof options?.asOfTimestamp === 'string' && options.asOfTimestamp.trim().length > 0;
  const forceRefresh = options?.forceRefresh === true || hasHistoricalTimestamp;
  const historicalDate = hasHistoricalTimestamp
    ? new Date(options?.asOfTimestamp as string)
    : null;
  const evaluationDate = historicalDate && Number.isFinite(historicalDate.getTime())
    ? historicalDate
    : new Date();
  const evaluationIso = evaluationDate.toISOString();
  const shouldUseCache = !hasHistoricalTimestamp;
  const shouldPersistForWinRate = options?.persistForWinRate !== false;
  const hasPrecomputedDependencies = Boolean(
    levelData
    || gexLandscape
    || fibLevelsProvided
    || regimeStateProvided
    || flowEventsProvided
    || indicatorContextProvided !== undefined
    || (options?.historicalTicks && options.historicalTicks.length > 0)
  );
  if (shouldUseCache && !forceRefresh && setupsInFlight) {
    return setupsInFlight;
  }

  const run = async (): Promise<Setup[]> => {
  if (shouldUseCache && !forceRefresh && !hasPrecomputedDependencies) {
    const cached = await cacheGet<Setup[]>(SETUPS_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const previousSetups = options?.previousSetups
    || (shouldUseCache ? await cacheGet<Setup[]>(SETUPS_CACHE_KEY) : []);
  const previousById = new Map<string, Setup>(
    (previousSetups || []).map((setup) => [setup.id, setup]),
  );

  const sessionDate = toEasternTime(evaluationDate).dateStr;
  const [levels, gex, fibLevels, regimeState, flowEvents, indicatorContext, optimizationProfile, pWinCalibrationModel] = await Promise.all([
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
    indicatorContextProvided !== undefined
      ? Promise.resolve(indicatorContextProvided)
      : loadIndicatorContext({
        evaluationDate,
        asOfTimestamp: hasHistoricalTimestamp ? evaluationIso : undefined,
      }),
    getActiveSPXOptimizationProfile(),
    loadSetupPWinCalibrationModel({
      asOfDateEt: sessionDate,
      forceRefresh,
    }),
  ]);

  const currentPrice = gex.spx.spotPrice;
  const candidateZones = pickCandidateZones(levels.clusters, currentPrice);
  const nowMs = evaluationDate.getTime();
  const lifecycleConfig = getSetupLifecycleConfig();
  const scoringConfig = getSetupScoringConfig();
  const diversificationConfig = getSetupDiversificationConfig();
  const macroFilterConfig = getSetupMacroFilterConfig();
  const microstructureBaseConfig = getSetupMicrostructureConfig();
  const microstructureSummary = await loadMicrostructureSummary({
    symbol: 'SPX',
    nowMs,
    hasHistoricalTimestamp,
    historicalTimestampIso: hasHistoricalTimestamp ? evaluationIso : undefined,
    historicalTicks: options?.historicalTicks,
    config: microstructureBaseConfig,
  });
  const pausedSetupTypes = new Set(optimizationProfile.driftControl.pausedSetupTypes);
  const pausedCombos = new Set(
    optimizationProfile.regimeGate.pausedCombos.filter((combo) => (
      !diversificationConfig.allowRecoveryCombos || !DIVERSIFICATION_RECOVERY_COMBOS.has(combo)
    )),
  );

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
    const emaAligned = isEmaAligned({
      direction,
      currentPrice,
      indicatorContext,
    });
    const volumeRegimeAligned = isVolumeRegimeAligned({
      regime: regimeState.regime,
      indicatorContext,
    });
    const flowConfirmed = hasFlowConfirmation({
      flowEvents,
      direction,
      zoneCenter,
      nowMs,
    });
    const flowQuality = evaluateFlowQuality({
      flowEvents,
      direction,
      zoneCenter,
      nowMs,
    });
    const setupType = inferSetupTypeForZone({
      regime: regimeState.regime,
      direction,
      currentPrice,
      zoneCenter,
      gexLandscape: gex,
      indicatorContext,
      emaAligned,
      volumeRegimeAligned,
    });
    const regimeAligned = isRegimeAligned(setupType, regimeState.regime);
    const setupIdSeed = [
      sessionDate,
      setupType,
      zone.id,
      round(zone.priceLow, 2),
      round(zone.priceHigh, 2),
    ].join('|');
    const setupId = stableId('spx_setup', setupIdSeed);
    const previous = previousById.get(setupId) || null;
    const createdAt = previous?.createdAt || evaluationIso;
    const firstSeenMinuteEt = toSessionMinuteEt(createdAt);
    const macroMicroPolicyEntry = resolveSetupMacroMicroPolicyEntry({
      setupType,
      regime: regimeState.regime,
      firstSeenMinuteEt,
      profile: optimizationProfile,
    });
    const setupMacroFilterConfig = resolveSetupMacroFilterConfig({
      base: macroFilterConfig,
      policy: macroMicroPolicyEntry,
    });
    const setupMicrostructureConfig = resolveSetupMicrostructureConfig({
      setupType,
      base: microstructureBaseConfig,
      policy: macroMicroPolicyEntry,
    });
    const orbTrendConfluence = evaluateOrbTrendConfluence({
      setupType,
      direction,
      currentPrice,
      zoneCenter,
      indicatorContext,
      emaAligned,
      flowConfirmed,
    });
    const requireOrbTrendConfluence = (
      setupType === 'trend_pullback'
      && macroMicroPolicyEntry.requireOrbTrendConfluence === true
    );
    const microstructureAlignment = evaluateMicrostructureAlignment({
      direction,
      setupType,
      summary: microstructureSummary,
      config: setupMicrostructureConfig,
    });
    const strikeFlowConfluence = hasStrikeFlowConfluence(flowQuality);
    const intradayGammaPressure = evaluateIntradayGammaPressure({
      flowEvents,
      direction,
      nowMs,
      flipPoint: gex.combined.flipPoint,
    });

    const confluence = calculateConfluence({
      zone,
      direction,
      currentPrice,
      flipPoint: gex.combined.flipPoint,
      netGex: gex.combined.netGex,
      fibTouch,
      regimeAligned,
      flowConfirmed,
      emaAligned,
      volumeRegimeAligned,
      microstructureAligned: microstructureAlignment.aligned,
      orbTrendConfluenceAligned: orbTrendConfluence.aligned,
      strikeFlowConfluence,
      intradayGammaPressureAligned: intradayGammaPressure.aligned,
    });
    const macroAlignmentScore = calculateMacroAlignmentScore({
      regimeAligned,
      regimeConflict,
      flowConfirmed,
      flowAlignmentPct: alignmentPct,
      flowDivergence,
      emaAligned,
      volumeRegimeAligned,
      gexAligned: confluence.gexAligned,
      gammaPressureAligned: intradayGammaPressure.aligned,
      microstructureScore: microstructureAlignment.score,
    });

    const fallbackDistance = Math.max(6, Math.abs(gex.combined.callWall - gex.combined.putWall) / 4);
    const entryLow = round(zone.priceLow, 2);
    const entryHigh = round(zone.priceHigh, 2);
    const geometryPolicy = resolveSetupGeometryPolicy({
      setupType,
      regime: regimeState.regime,
      firstSeenMinuteEt,
      profile: optimizationProfile,
    });
    const stopBufferBase = zone.type === 'fortress' ? 2.5 : 1.5;
    const stopBuffer = (
      setupType === 'fade_at_wall'
      || setupType === 'mean_reversion'
      || setupType === 'flip_reclaim'
    )
      ? Math.max(stopBufferBase, FADE_STOP_BUFFER_POINTS)
      : stopBufferBase;
    const baseStop = direction === 'bullish'
      ? round(zone.priceLow - stopBuffer, 2)
      : round(zone.priceHigh + stopBuffer, 2);
    const stop = applyStopGeometryPolicy({
      direction,
      entryLow,
      entryHigh,
      baseStop,
      geometryPolicy,
    });
    const baseTargets = getTargetPrice(levels.clusters, zoneCenter, direction, fallbackDistance);
    const tunedTargets = adjustTargetsForSetupType({
      setupType,
      direction,
      entryLow,
      entryHigh,
      stop,
      target1: baseTargets.target1,
      target2: baseTargets.target2,
      flipPoint: gex.combined.flipPoint,
      indicatorContext,
      geometryPolicy,
    });
    const target1 = tunedTargets.target1;
    const target2 = tunedTargets.target2;

    const readyConfluenceThreshold = (
      setupType === 'flip_reclaim'
      && regimeState.regime === 'ranging'
    )
      ? 2
      : 3;
    let computedStatus: Setup['status'] = confluence.score >= readyConfluenceThreshold ? 'ready' : 'forming';
    if (isPriceInsideEntry({ entryZone: { low: entryLow, high: entryHigh } }, currentPrice)) {
      computedStatus = 'triggered';
    }

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
      triggeredAt = evaluationIso;
    }

    const lifecycle = resolveLifecycleMetadata({
      nowMs,
      currentStatus: status,
      previous,
      invalidationReason,
      config: lifecycleConfig,
    });
    const entryMid = (entryLow + entryHigh) / 2;
    const riskToStop = Math.max(Math.abs(entryMid - stop), 0.25);
    const rewardToTarget1 = Math.abs(target1 - entryMid);
    const rewardToTarget2 = Math.abs(target2 - entryMid);
    const inEntryZone = isPriceInsideEntry({ entryZone: { low: entryLow, high: entryHigh } }, currentPrice);
    const normalizedConfluence = clamp((confluence.score / 5) * 100);
    const zoneTypeBonus = zone.type === 'fortress'
      ? 20
      : zone.type === 'defended'
        ? 12
        : zone.type === 'moderate'
          ? 6
          : 0;
    const structureQuality = clamp(((zone.clusterScore / 5) * 60) + (normalizedConfluence * 0.4) + zoneTypeBonus);
    const flowAlignment = alignmentPct == null ? (flowConfirmed ? 58 : 44) : clamp(alignmentPct + (flowConfirmed ? 6 : 0));
    const gexAlignment = confluence.sources.includes('gex_alignment') ? 82 : 42;
    const emaTrendScore = emaAligned
      ? clamp(68 + (indicatorContext?.emaFastSlope || 0) * 20)
      : 38;
    const volumeContextScore = volumeRegimeAligned
      ? 72
      : 44;
    const regimeAlignment = clamp(
      (regimeAligned ? 82 : 36)
        + (regimeState.direction === direction ? 8 : 0)
        - (regimeConflict ? 10 : 0),
    );
    const proximityDistance = Math.abs(currentPrice - entryMid);
    const proximityRatio = 1 - Math.min(1, proximityDistance / Math.max(2, fallbackDistance * 1.25));
    const proximityUrgency = clamp(35 + (proximityRatio * 65));
    const microTriggerQuality = microTriggerFeature(lifecycle.status, inEntryZone);

    const weights = regimeWeights(regimeState.regime);
    const scoreRaw = (
      (weights.structure * (structureQuality / 100))
      + (weights.flow * (flowAlignment / 100))
      + (weights.gex * (gexAlignment / 100))
      + (weights.regime * (regimeAlignment / 100))
      + (weights.proximity * (proximityUrgency / 100))
      + (weights.microTrigger * (microTriggerQuality / 100))
    );
    const indicatorBlend = (0.65 * emaTrendScore) + (0.35 * volumeContextScore);
    const stalePenalty = Math.min(12, (contextState.regimeConflictStreak + contextState.flowDivergenceStreak) * 3);
    const contradictionPenalty = (regimeConflict ? 8 : 0) + (flowDivergence ? 7 : 0);
    const lifecyclePenalty = lifecycle.status === 'forming' ? 6 : lifecycle.status === 'invalidated' ? 90 : lifecycle.status === 'expired' ? 95 : 0;
    const finalScore = scoringConfig.evTieringEnabled
      ? clamp((scoreRaw * 100) - stalePenalty - contradictionPenalty - lifecyclePenalty + ((indicatorBlend - 50) * 0.1))
      : normalizedConfluence;

    const heuristicBaselineWin = (WIN_RATE_BY_SCORE[confluence.score] || 32) / 100;
    const scoreAdjustment = (finalScore - 50) / 220;
    const flowAdjustment = alignmentPct == null ? 0 : ((alignmentPct - 50) / 240);
    const pWinHeuristic = clamp(
      heuristicBaselineWin
        + scoreAdjustment
        + (regimeAligned ? 0.03 : -0.04)
        + flowAdjustment,
      0.05,
      0.95,
    );
    const pWinCalibration = pWinCalibrationModel.calibrate({
      setupType,
      regime: regimeState.regime,
      firstSeenMinuteEt,
      rawPWin: pWinHeuristic,
    });
    const pWinCalibrated = clamp(pWinCalibration.pWin, 0.05, 0.95);
    const rTarget1 = rewardToTarget1 / riskToStop;
    const rTarget2 = rewardToTarget2 / riskToStop;
    const rBlended = (0.65 * rTarget1) + (0.35 * rTarget2);
    const costR = 0.08 + (flowConfirmed ? 0 : 0.03) + (lifecycle.status === 'forming' ? 0.05 : 0);
    const evR = (pWinCalibrated * rBlended) - ((1 - pWinCalibrated) * 1.0) - costR;
    const flowAlignmentPct = alignmentPct == null ? null : round(alignmentPct, 2);
    const { reasons: gateReasons, effectiveFlowConfirmed, effectiveVolumeAligned } = evaluateOptimizationGate({
      status: lifecycle.status,
      wasPreviouslyTriggered: Boolean(previous?.triggeredAt),
      setupType,
      regime: regimeState.regime,
      firstSeenAtIso: createdAt,
      confluenceScore: confluence.score,
      pWinCalibrated,
      evR,
      flowConfirmed,
      flowAlignmentPct,
      flowQuality,
      macroAlignmentScore,
      macroFilterConfig: setupMacroFilterConfig,
      emaAligned,
      volumeRegimeAligned,
      microstructureConfig: setupMicrostructureConfig,
      microstructureAlignment,
      orbTrendConfluence,
      requireOrbTrendConfluence,
      pausedSetupTypes,
      pausedCombos,
      profile: optimizationProfile,
      direction,
    });
    const gateStatus: Setup['gateStatus'] = gateReasons.length > 0 ? 'blocked' : 'eligible';
    const gatedStatus: Setup['status'] = gateStatus === 'blocked' ? 'forming' : lifecycle.status;
    const gatedTriggeredAt = gateStatus === 'blocked' && !previous?.triggeredAt
      ? null
      : triggeredAt;
    const gatedLifecycle = gateStatus === 'blocked'
      ? resolveLifecycleMetadata({
        nowMs,
        currentStatus: 'forming',
        previous,
        invalidationReason: null,
        config: lifecycleConfig,
      })
      : lifecycle;

    const tier = scoringConfig.evTieringEnabled
      ? deriveSetupTier({
        status: gatedStatus,
        score: finalScore,
        pWinCalibrated,
        evR,
        config: scoringConfig,
      })
      : (gatedStatus === 'ready' || gatedStatus === 'triggered') ? 'watchlist' : 'hidden';
    const gatedTier = gateStatus === 'blocked'
      ? 'hidden'
      : (gatedStatus === 'triggered' && tier === 'hidden')
        ? 'watchlist'
        : tier;
    const tradeManagementPolicy = resolveTradeManagementForSetup({
      setupType,
      regime: regimeState.regime,
      confluenceScore: confluence.score,
      flowConfirmed,
      basePolicy: optimizationProfile.tradeManagement,
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
      status: gatedLifecycle.status,
      score: round(finalScore, 2),
      alignmentScore: flowAlignmentPct ?? undefined,
      macroAlignmentScore: round(macroAlignmentScore, 2),
      microstructureScore: microstructureAlignment.score == null
        ? undefined
        : round(microstructureAlignment.score, 2),
      microstructure: microstructureSummary
        ? {
          source: microstructureSummary.source,
          available: microstructureSummary.available,
          sampleCount: microstructureSummary.sampleCount,
          quoteCoveragePct: microstructureSummary.quoteCoveragePct,
          buyVolume: microstructureSummary.buyVolume,
          sellVolume: microstructureSummary.sellVolume,
          neutralVolume: microstructureSummary.neutralVolume,
          directionalVolume: microstructureSummary.directionalVolume,
          aggressorSkew: microstructureSummary.aggressorSkew,
          bidAskImbalance: microstructureSummary.bidAskImbalance,
          avgSpreadBps: microstructureSummary.avgSpreadBps,
          latestTimestamp: microstructureSummary.latestTimestampMs == null
            ? null
            : new Date(microstructureSummary.latestTimestampMs).toISOString(),
          aligned: microstructureAlignment.aligned,
          score: microstructureAlignment.score,
          reasons: microstructureAlignment.reasons,
        }
        : undefined,
      flowConfirmed,
      effectiveFlowConfirmed,
      emaAligned,
      volumeRegimeAligned,
      effectiveVolumeAligned,
      confidenceTrend: emaAligned
        ? ((indicatorContext?.emaFastSlope || 0) > EMA_MIN_SLOPE_POINTS ? 'up' : 'flat')
        : ((indicatorContext?.emaFastSlope || 0) < -EMA_MIN_SLOPE_POINTS ? 'down' : 'flat'),
      decisionDrivers: [
        ...(emaAligned ? ['EMA trend alignment'] : []),
        ...(volumeRegimeAligned ? ['Volume trend aligned with regime'] : []),
        ...(orbTrendConfluence.aligned ? ['ORB + pullback confluence confirmed'] : []),
        ...(microstructureAlignment.aligned ? ['Microstructure aligned with direction'] : []),
        ...(intradayGammaPressure.aligned ? ['Intraday gamma pressure aligned'] : []),
        ...(macroAlignmentScore >= setupMacroFilterConfig.minAlignmentScore ? ['Macro alignment threshold satisfied'] : []),
      ],
      decisionRisks: [
        ...(!emaAligned ? ['EMA trend misalignment'] : []),
        ...(!volumeRegimeAligned ? ['Volume trend not confirming regime'] : []),
        ...(requireOrbTrendConfluence && !orbTrendConfluence.aligned
          ? ['Trend pullback missing ORB confluence']
          : []),
        ...(microstructureAlignment.available && !microstructureAlignment.aligned
          ? ['Microstructure conflict with setup direction']
          : []),
        ...(macroAlignmentScore < setupMacroFilterConfig.minAlignmentScore
          ? [`Macro alignment below floor (${round(macroAlignmentScore, 2)})`]
          : []),
      ],
      gateStatus,
      gateReasons,
      tradeManagement: tradeManagementPolicy,
      pWinCalibrated: round(pWinCalibrated, 4),
      evR: round(evR, 3),
      tier: gatedTier,
      rank: undefined,
      statusUpdatedAt: gatedLifecycle.statusUpdatedAt,
      ttlExpiresAt: gatedLifecycle.ttlExpiresAt,
      invalidationReason: gatedLifecycle.invalidationReason,
      probability: round(pWinCalibrated * 100, 2),
      recommendedContract: null,
      createdAt,
      triggeredAt: gatedLifecycle.status === 'triggered' || gatedLifecycle.status === 'invalidated' || gatedLifecycle.status === 'expired'
        ? gatedTriggeredAt
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

  const dedupedSetups = dedupeSetupsBySemanticKey(setups);
  const diversifiedSetups = applySetupMixPolicy({
    setups: dedupedSetups,
    config: diversificationConfig,
    nowMs,
  });

  const rankedSetups = [...diversifiedSetups]
    .sort((a, b) => {
      const statusDelta = SETUP_STATUS_SORT_ORDER[a.status] - SETUP_STATUS_SORT_ORDER[b.status];
      if (statusDelta !== 0) return statusDelta;

      const tierA = SETUP_TIER_SORT_ORDER[a.tier || 'hidden'];
      const tierB = SETUP_TIER_SORT_ORDER[b.tier || 'hidden'];
      if (tierA !== tierB) return tierA - tierB;

      if ((b.evR || 0) !== (a.evR || 0)) return (b.evR || 0) - (a.evR || 0);
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      if (b.probability !== a.probability) return b.probability - a.probability;
      return toEpochMs(b.statusUpdatedAt || b.createdAt) - toEpochMs(a.statusUpdatedAt || a.createdAt);
    })
    .map((setup, index) => ({
      ...setup,
      rank: index + 1,
    }));

  if (shouldUseCache) {
    await cacheSet(SETUPS_CACHE_KEY, rankedSetups, SETUPS_CACHE_TTL_SECONDS);
  }

  if (shouldPersistForWinRate) {
    await persistSetupInstancesForWinRate(rankedSetups).catch((error) => {
      logger.warn('SPX setup outcome tracking persistence failed', {
        setupCount: rankedSetups.length,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  const invalidationReasons = rankedSetups
    .filter((setup) => setup.status === 'invalidated' && setup.invalidationReason)
    .reduce<Record<string, number>>((acc, setup) => {
      const reason = setup.invalidationReason || 'unknown';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});
  const microstructureAvailableCount = rankedSetups.filter((setup) => setup.microstructure?.available === true).length;
  const microstructureAlignedCount = rankedSetups.filter((setup) => setup.microstructure?.aligned === true).length;
  const macroBlockedCount = rankedSetups.filter((setup) => (
    (setup.gateReasons || []).some((reason) => reason.startsWith('macro_alignment_below_floor'))
  )).length;

  if (lifecycleConfig.telemetryEnabled) {
    logger.info('SPX setup lifecycle telemetry', {
      lifecycleEnabled: lifecycleConfig.lifecycleEnabled,
      contextDemotionStreak: lifecycleConfig.contextDemotionStreak,
      contextInvalidationStreak: lifecycleConfig.contextInvalidationStreak,
      stopConfirmationTicks: lifecycleConfig.stopConfirmationTicks,
      invalidationReasons,
      macroKillSwitchEnabled: macroFilterConfig.enabled,
      macroAlignmentMinScore: macroFilterConfig.minAlignmentScore,
      macroBlockedCount,
      microstructureEnabled: microstructureBaseConfig.enabled,
      microstructureAvailableCount,
      microstructureAlignedCount,
      microstructureSummary,
    });
  }

  logger.info('SPX setups detected', {
    count: rankedSetups.length,
    ready: rankedSetups.filter((setup) => setup.status === 'ready').length,
    triggered: rankedSetups.filter((setup) => setup.status === 'triggered').length,
    invalidated: rankedSetups.filter((setup) => setup.status === 'invalidated').length,
    expired: rankedSetups.filter((setup) => setup.status === 'expired').length,
    sniperPrimary: rankedSetups.filter((setup) => setup.tier === 'sniper_primary').length,
    sniperSecondary: rankedSetups.filter((setup) => setup.tier === 'sniper_secondary').length,
    watchlist: rankedSetups.filter((setup) => setup.tier === 'watchlist').length,
    hidden: rankedSetups.filter((setup) => setup.tier === 'hidden').length,
    optimizerBlocked: rankedSetups.filter((setup) => setup.gateStatus === 'blocked').length,
    diversificationEnabled: diversificationConfig.enabled,
    diversificationRecoveryCombosEnabled: diversificationConfig.allowRecoveryCombos,
    diversificationFadeReadyMaxShare: diversificationConfig.fadeReadyMaxShare,
    diversificationMinAlternativeReady: diversificationConfig.minAlternativeReadySetups,
    diversificationMinTrendReady: diversificationConfig.minTrendReadySetups,
    diversificationTrendPromotionMinScore: diversificationConfig.trendPromotionMinScore,
    diversificationTrendPromotionMinPWin: diversificationConfig.trendPromotionMinPWin,
    diversificationTrendPromotionMinEvR: diversificationConfig.trendPromotionMinEvR,
    diversificationTrendPromotionMinMacroScore: diversificationConfig.trendPromotionMinMacroScore,
    diversificationTrendPromotionMinMicroScore: diversificationConfig.trendPromotionMinMicroScore,
    diversificationTrendPromotionRequireMicroAlignment: diversificationConfig.trendPromotionRequireMicroAlignment,
    optimizerPausedSetupTypes: optimizationProfile.driftControl.pausedSetupTypes,
    optimizerPausedCombos: optimizationProfile.regimeGate.pausedCombos,
    invalidationReasons,
    macroKillSwitchEnabled: macroFilterConfig.enabled,
    macroAlignmentMinScore: macroFilterConfig.minAlignmentScore,
    macroBlockedCount,
    microstructureEnabled: microstructureBaseConfig.enabled,
    microstructureAvailableCount,
    microstructureAlignedCount,
    lifecycleEnabled: lifecycleConfig.lifecycleEnabled,
    evTieringEnabled: scoringConfig.evTieringEnabled,
  });

  return rankedSetups;
  };

  if (!shouldUseCache || forceRefresh) {
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
  historicalSecondBarsCache.clear();
  setupsInFlight = null;
}

export const __testables = {
  evaluateOptimizationGate,
};
