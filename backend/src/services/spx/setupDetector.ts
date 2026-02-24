import { cacheGet, cacheSet } from '../../config/redis';
import { getMinuteAggregates } from '../../config/massive';
import { analyzeVWAPPosition, calculateVWAPBandSet } from '../levels/calculators/vwap';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import { calculateAtrFromBars } from './atrService';
import { getFibLevels } from './fibEngine';
import {
  deriveFlowWindowSignal,
  getFlowWindowAggregation,
  type SPXFlowWindowAggregation,
  type SPXFlowWindowSignal,
} from './flowAggregator';
import { getFlowEvents } from './flowEngine';
import { computeUnifiedGEXLandscape } from './gexEngine';
import {
  applyEnvironmentGateToSetups,
  buildStandbyGuidance,
  evaluateEnvironmentGate,
} from './environmentGate';
import { calculateAdaptiveEV } from './evCalculator';
import { getMergedLevels } from './levelEngine';
import { getLevelMemoryContext } from './memoryEngine';
import {
  getMultiTFConfluenceContext,
  scoreMultiTFConfluence,
  type SPXMultiTFConfluenceContext,
} from './multiTFConfluence';
import { getActiveSPXOptimizationProfile, type SPXGeometryPolicyEntry } from './optimizer';
import { buildTriggerContext as buildTriggerContextFromPriceAction } from './priceActionEngine';
import { getWorkingMicrobar } from './microbarAggregator';
import { persistSetupInstancesForWinRate } from './outcomeTracker';
import { classifyCurrentRegime } from './regimeClassifier';
import { calculateAdaptiveStop, deriveNearestGEXDistanceBp } from './stopEngine';
import {
  minZoneQualityThreshold,
  selectBestZonesForEntry,
  type ZoneQualityScore,
} from './zoneQualityEngine';
import type {
  ClusterZone,
  FibLevel,
  Regime,
  RegimeState,
  Setup,
  SetupInvalidationReason,
  SetupTier,
  SetupType,
  SPXEnvironmentGateDecision,
  SPXFlowEvent,
  SPXStandbyGuidance,
  SPXLevel,
  SPXVixRegime,
  UnifiedGEXLandscape,
} from './types';
import { ema, round, stableId } from './utils';

const SETUPS_CACHE_KEY = 'spx_command_center:setups';
const SETUPS_ENV_STATE_CACHE_KEY = 'spx_command_center:setups:environment_gate';
const SETUPS_CACHE_TTL_SECONDS = 10;
let setupsInFlight: Promise<Setup[]> | null = null;
const FLOW_CONFIRMATION_WINDOW_MS = 20 * 60 * 1000;
const FLOW_ZONE_TOLERANCE_POINTS = 12;
const FLOW_MIN_DIRECTIONAL_PREMIUM = 75_000;
const FLOW_MIN_LOCAL_PREMIUM = 150_000;
const FLOW_MIN_LOCAL_EVENTS = 2;
const FLOW_QUALITY_MIN_EVENTS = 2;
const FLOW_QUALITY_MIN_PREMIUM = 90_000;
const ORB_MIN_FLOW_QUALITY_SCORE = 58;
const ORB_GRACE_MIN_CONFLUENCE_SCORE = 4;
const ORB_GRACE_MAX_FIRST_SEEN_MINUTE = 120;
const ORB_GRACE_REDUCED_FLOW_QUALITY_SCORE = 25;
const ORB_GRACE_REDUCED_FLOW_EVENTS = 0;
const ORB_RANGE_MIN_WIDTH_POINTS = 4;
const ORB_RANGE_MAX_WIDTH_POINTS = 18;
const CONTEXT_STREAK_TTL_MS = 30 * 60 * 1000;

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
const DEFAULT_MIN_SETUP_SCORE_FLOOR = 65;
const DEFAULT_LATE_SESSION_HARD_GATE_MINUTE_ET = 270;
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
  'vwap_reclaim',
  'vwap_fade_at_band',
]);
const DEFAULT_FADE_READY_MAX_SHARE = 0.5;
const DEFAULT_MIN_ALTERNATIVE_READY_SETUPS = 1;
const DEFAULT_MAX_FIRST_SEEN_MINUTE_BY_SETUP_TYPE: Record<string, number> = {
  fade_at_wall: 300,
  mean_reversion: 330,
  trend_continuation: 390,
  orb_breakout: 180,
  trend_pullback: 360,
  flip_reclaim: 360,
  vwap_reclaim: 300,
  vwap_fade_at_band: 330,
};
const STABLE_SETUP_PRICE_BUCKET = 1;
const STABLE_SETUP_MORPH_ENTRY_TOLERANCE = 1.5;
const MAX_MORPH_HISTORY_ITEMS = 12;
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
    // A6: Restore ORB quality gates while retaining early-session EMA grace.
    minConfluenceScore: 3.5,
    minPWinCalibrated: 0.56, // Was 0.61
    minEvR: 0.24, // Was 0.3
    requireFlowConfirmation: true,
    minAlignmentPct: 52,
    requireEmaAlignment: true,
    requireVolumeRegimeAlignment: true,
    maxFirstSeenMinuteEt: 120,
  },
  trend_pullback: {
    minConfluenceScore: 3,
    // Tightened from 0.58 — 38.71% failure rate was highest among active strategies.
    minPWinCalibrated: 0.62,
    minEvR: 0.24,
    requireFlowConfirmation: true,
    minAlignmentPct: 50,
    requireEmaAlignment: true,
    requireVolumeRegimeAlignment: true,
    maxFirstSeenMinuteEt: 300,
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
  // breakout_vacuum permanently quarantined (0% trigger rate YTD). Replaced by flip_reclaim.
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
}

interface SetupIndicatorContext {
  emaFast: number;
  emaSlow: number;
  emaFastSlope: number;
  emaSlowSlope: number;
  atr14?: number | null;
  volumeTrend: 'rising' | 'flat' | 'falling';
  sessionOpenPrice: number;
  orbHigh: number;
  orbLow: number;
  minutesSinceOpen: number;
  sessionOpenTimestamp: string;
  asOfTimestamp: string;
  vwapPrice: number | null;
  vwapDeviation: number | null;
  vwapBand1SD: {
    upper: number;
    lower: number;
  } | null;
  vwapBand15SD: {
    upper: number;
    lower: number;
  } | null;
  vwapBand2SD: {
    upper: number;
    lower: number;
  } | null;
  latestBar: {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  } | null;
  priorBar: {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  } | null;
  avgRecentVolume: number | null;
}

interface FlowQualitySummary {
  score: number;
  recentDirectionalEvents: number;
  recentDirectionalPremium: number;
  localDirectionalEvents: number;
  localDirectionalPremium: number;
}

interface WeightedConfluenceBreakdown {
  flow: number;
  ema: number;
  zone: number;
  gex: number;
  regime: number;
  multiTF: number;
  memory: number;
  composite: number;
  legacyEquivalent: number;
}

interface SetupContextState {
  regimeConflictStreak: number;
  flowDivergenceStreak: number;
  stopBreachStreak: number;
  updatedAtMs: number;
}

interface VWAPBand {
  upper: number;
  lower: number;
}

export interface SetupEnvironmentStateSnapshot {
  asOf: string;
  gate: SPXEnvironmentGateDecision | null;
  standbyGuidance: SPXStandbyGuidance | null;
}

let latestSetupEnvironmentState: SetupEnvironmentStateSnapshot | null = null;

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
  };
}

function detectVWAPReclaim(input: {
  currentPrice: number;
  previousBarClose: number;
  vwap: number;
  direction: 'bullish' | 'bearish';
  vwapBand1SD: VWAPBand;
}): boolean {
  if (input.direction === 'bullish') {
    return (
      input.previousBarClose < input.vwap
      && input.currentPrice >= input.vwap
      && input.currentPrice < input.vwapBand1SD.upper
    );
  }

  return (
    input.previousBarClose > input.vwap
    && input.currentPrice <= input.vwap
    && input.currentPrice > input.vwapBand1SD.lower
  );
}

function detectVWAPFade(input: {
  currentPrice: number;
  vwapBand15SD: VWAPBand;
  vwapBand2SD: VWAPBand;
}): { detected: boolean; direction: 'bullish' | 'bearish' } {
  if (
    input.currentPrice >= input.vwapBand15SD.upper
    && input.currentPrice <= input.vwapBand2SD.upper
  ) {
    return { detected: true, direction: 'bearish' };
  }

  if (
    input.currentPrice <= input.vwapBand15SD.lower
    && input.currentPrice >= input.vwapBand2SD.lower
  ) {
    return { detected: true, direction: 'bullish' };
  }

  return { detected: false, direction: 'bullish' };
}

function buildVWAPSetupGeometry(input: {
  setupType: SetupType;
  direction: 'bullish' | 'bearish';
  indicatorContext: SetupIndicatorContext | null;
}): {
  entryLow: number;
  entryHigh: number;
  stop: number;
  target1: number;
  target2: number;
} | null {
  const context = input.indicatorContext;
  if (!context || context.vwapPrice == null) return null;

  if (
    input.setupType === 'vwap_reclaim'
    && context.vwapBand1SD
    && context.vwapBand15SD
  ) {
    const vwap = context.vwapPrice;
    const entryLow = round(vwap - 0.5, 2);
    const entryHigh = round(vwap + 0.5, 2);
    const stop = input.direction === 'bullish'
      ? round(vwap - 2, 2)
      : round(vwap + 2, 2);
    const target1 = input.direction === 'bullish'
      ? round(context.vwapBand1SD.upper, 2)
      : round(context.vwapBand1SD.lower, 2);
    const target2 = input.direction === 'bullish'
      ? round(context.vwapBand15SD.upper, 2)
      : round(context.vwapBand15SD.lower, 2);

    return {
      entryLow,
      entryHigh,
      stop,
      target1,
      target2,
    };
  }

  if (
    input.setupType === 'vwap_fade_at_band'
    && context.vwapBand1SD
    && context.vwapBand15SD
    && context.vwapBand2SD
  ) {
    const vwap = context.vwapPrice;
    const halfSdDistance = Math.max(0.1, Math.abs(context.vwapBand1SD.upper - vwap) * 0.5);
    const fadeAnchor = input.direction === 'bearish'
      ? context.vwapBand15SD.upper
      : context.vwapBand15SD.lower;
    const entryLow = round(fadeAnchor - 1, 2);
    const entryHigh = round(fadeAnchor + 1, 2);
    const stop = input.direction === 'bearish'
      ? round(context.vwapBand2SD.upper + 2, 2)
      : round(context.vwapBand2SD.lower - 2, 2);
    const target1 = round(vwap, 2);
    const target2 = input.direction === 'bearish'
      ? round(vwap - halfSdDistance, 2)
      : round(vwap + halfSdDistance, 2);

    return {
      entryLow,
      entryHigh,
      stop,
      target1,
      target2,
    };
  }

  return null;
}

function setupTypeForRegime(regime: Regime): SetupType {
  switch (regime) {
    case 'ranging':
      return 'fade_at_wall';
    case 'breakout':
      return 'flip_reclaim'; // S7: was breakout_vacuum (pruned)
    case 'trending':
      return 'trend_continuation';
    case 'compression':
    default:
      return 'mean_reversion';
  }
}

function isRegimeAligned(type: SetupType, regime: Regime): boolean {
  if (regime === 'ranging') {
    return (
      type === 'fade_at_wall'
      || type === 'mean_reversion'
      || type === 'flip_reclaim'
      || type === 'vwap_fade_at_band'
    );
  }
  if (regime === 'compression') {
    return type === 'mean_reversion'
      || type === 'flip_reclaim'
      || type === 'orb_breakout'
      || type === 'trend_pullback'
      || type === 'vwap_fade_at_band'
      || type === 'vwap_reclaim';
  }
  if (regime === 'trending') {
    return (
      type === 'trend_continuation'
      || type === 'trend_pullback'
      || type === 'vwap_reclaim'
    );
  }
  if (regime === 'breakout') {
    return type === 'trend_continuation'
      || type === 'orb_breakout'
      || type === 'flip_reclaim'
      || type === 'trend_pullback'
      || type === 'vwap_reclaim';
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
  const vwapPrice = input.indicatorContext?.vwapPrice ?? null;
  const vwapBand1SD = input.indicatorContext?.vwapBand1SD ?? null;
  const vwapBand15SD = input.indicatorContext?.vwapBand15SD ?? null;
  const vwapBand2SD = input.indicatorContext?.vwapBand2SD ?? null;
  const previousBarClose = input.indicatorContext?.priorBar?.c ?? null;
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
  const bullishReclaim = (
    hasIndicatorContext
    && vwapPrice != null
    && vwapBand1SD != null
    && previousBarClose != null
    && detectVWAPReclaim({
      currentPrice: input.currentPrice,
      previousBarClose,
      vwap: vwapPrice,
      direction: 'bullish',
      vwapBand1SD,
    })
  );
  const bearishReclaim = (
    hasIndicatorContext
    && vwapPrice != null
    && vwapBand1SD != null
    && previousBarClose != null
    && detectVWAPReclaim({
      currentPrice: input.currentPrice,
      previousBarClose,
      vwap: vwapPrice,
      direction: 'bearish',
      vwapBand1SD,
    })
  );
  const vwapFadeSignal = (
    hasIndicatorContext
    && vwapBand15SD != null
    && vwapBand2SD != null
  )
    ? detectVWAPFade({
      currentPrice: input.currentPrice,
      vwapBand15SD,
      vwapBand2SD,
    })
    : { detected: false, direction: 'bullish' as const };

  if ((input.direction === 'bullish' && bullishReclaim) || (input.direction === 'bearish' && bearishReclaim)) {
    return 'vwap_reclaim';
  }

  if (vwapFadeSignal.detected && vwapFadeSignal.direction === input.direction) {
    return 'vwap_fade_at_band';
  }

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
    return inMomentumState ? 'trend_continuation' : 'flip_reclaim';
  }

  if (input.regime === 'trending') {
    if (intradayTrendStructure) return 'trend_pullback';
    if (inMomentumState) return 'trend_continuation';
    if (hasIndicatorContext && flipReclaim && nearFlip) return 'flip_reclaim';
    if (nearFlip || netGexNegative) return 'flip_reclaim';
    return 'trend_continuation';
  }

  if (input.regime === 'compression') {
    if (intradayTrendStructure && minutesSinceOpen <= 240) return 'trend_pullback';
    if (hasIndicatorContext && flipReclaim && nearFlip) return 'flip_reclaim';
    if (volumeTrend === 'rising' && (nearFlip || netGexNegative)) return 'flip_reclaim';
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
    if (inMomentumState && (nearFlip || netGexNegative)) return 'flip_reclaim';
    if (distanceToZone >= 40) return 'mean_reversion';
    return 'fade_at_wall';
  }

  return fallback;
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

  // Regime-adaptive partial at T1 — trend/breakout: hold more runner; compression/ranging: take more profit
  const regimePartialOverride: Record<Regime, number> = {
    compression: 0.75,
    ranging: 0.70,
    trending: 0.55,
    breakout: 0.50,
  };
  const regimePartial = regimePartialOverride[input.regime] ?? basePartial;

  return {
    partialAtT1Pct: Math.max(Math.min(regimePartial, 0.9), 0.1),
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
  vwapPrice: number | null;
  vwapDeviation: number | null;
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
  if (input.emaAligned) sources.push('ema_alignment');
  if (input.volumeRegimeAligned) sources.push('volume_regime_alignment');

  // VWAP alignment: price aligned with direction relative to VWAP
  if (input.vwapPrice != null) {
    const vwapAligned = input.direction === 'bullish'
      ? input.currentPrice >= input.vwapPrice
      : input.currentPrice <= input.vwapPrice;
    if (vwapAligned) sources.push('vwap_alignment');
  }

  return {
    score: Math.min(5, sources.length),
    sources,
  };
}

function calculateWeightedConfluence(input: {
  flowQualityScore: number;
  flowConfirmed: boolean;
  emaAligned: boolean;
  emaFastSlope: number | null | undefined;
  zoneQualityScore: number;
  gexAligned: boolean;
  regimeAligned: boolean;
  regimeConflict: boolean;
  multiTFComposite: number | null | undefined;
  memoryScoreBoost: number;
}): WeightedConfluenceBreakdown {
  const flow = clamp(input.flowQualityScore + (input.flowConfirmed ? 8 : -12));
  const ema = clamp((input.emaAligned ? 68 : 34) + ((input.emaFastSlope || 0) * 22));
  const zone = clamp(input.zoneQualityScore);
  const gex = input.gexAligned ? 82 : 38;
  const regime = clamp((input.regimeAligned ? 80 : 34) - (input.regimeConflict ? 12 : 0));
  const multiTF = clamp(input.multiTFComposite ?? 50);
  const memory = clamp(50 + (input.memoryScoreBoost * 7), 20, 95);

  const weighted = (
    (flow * 0.24)
    + (ema * 0.18)
    + (zone * 0.20)
    + (gex * 0.14)
    + (regime * 0.10)
    + (multiTF * 0.10)
    + (memory * 0.04)
  );
  const composite = round(zone < 40 ? Math.min(50, weighted) : weighted, 2);
  const legacyEquivalent = Math.max(1, Math.min(5, Math.round(composite / 20)));

  return {
    flow: round(flow, 2),
    ema: round(ema, 2),
    zone: round(zone, 2),
    gex: round(gex, 2),
    regime: round(regime, 2),
    multiTF: round(multiTF, 2),
    memory: round(memory, 2),
    composite,
    legacyEquivalent,
  };
}

function pickCandidateZones(input: {
  zones: ClusterZone[];
  currentPrice: number;
  regime: Regime;
  vixRegime: SPXVixRegime;
}): Array<{ zone: ClusterZone; quality: ZoneQualityScore }> {
  const maxZones = parseIntEnv(process.env.SPX_SETUP_MAX_CANDIDATE_ZONES, 3);
  const selected = selectBestZonesForEntry({
    zones: input.zones,
    currentPrice: input.currentPrice,
    regime: input.regime,
    vixRegime: input.vixRegime,
    maxZones: Math.max(1, Math.min(8, maxZones)),
  });

  return selected;
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

function blendFlowAlignmentPercent(input: {
  eventAlignmentPct: number | null;
  windowAlignmentPct: number | null;
}): number | null {
  if (input.eventAlignmentPct == null && input.windowAlignmentPct == null) return null;
  if (input.eventAlignmentPct == null) return input.windowAlignmentPct;
  if (input.windowAlignmentPct == null) return input.eventAlignmentPct;
  return round((input.eventAlignmentPct * 0.65) + (input.windowAlignmentPct * 0.35), 2);
}

function applyFlowWindowQualityBoost(input: {
  flowQuality: FlowQualitySummary;
  flowWindowSignal: SPXFlowWindowSignal;
}): FlowQualitySummary {
  if (!input.flowWindowSignal.confirmed) {
    return input.flowQuality;
  }

  const scoreBoost = Math.min(18, Math.max(4, input.flowWindowSignal.strength * 0.12));
  return {
    score: round(clamp(input.flowQuality.score + scoreBoost), 2),
    recentDirectionalEvents: Math.max(
      input.flowQuality.recentDirectionalEvents,
      input.flowWindowSignal.eventCount,
    ),
    recentDirectionalPremium: round(Math.max(
      input.flowQuality.recentDirectionalPremium,
      input.flowWindowSignal.totalPremium,
    ), 2),
    localDirectionalEvents: input.flowQuality.localDirectionalEvents,
    localDirectionalPremium: input.flowQuality.localDirectionalPremium,
  };
}

function buildTriggerContext(input: {
  previous: Setup | null;
  setupStatus: Setup['status'];
  triggeredAt: string | null;
  evaluationTimestamp: string;
  direction: Setup['direction'];
  zone: ClusterZone;
  indicatorContext: SetupIndicatorContext | null;
}): Setup['triggerContext'] | undefined {
  return buildTriggerContextFromPriceAction({
    previous: input.previous?.triggerContext,
    setupStatus: input.setupStatus,
    triggeredAt: input.triggeredAt,
    evaluationTimestamp: input.evaluationTimestamp,
    direction: input.direction,
    zone: input.zone,
    latestBar: input.indicatorContext?.latestBar || null,
    priorBar: input.indicatorContext?.priorBar || null,
  });
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

  const vwapBars = sortedBars.map((bar) => ({
    h: typeof bar.h === 'number' && Number.isFinite(bar.h) ? bar.h : bar.c,
    l: typeof bar.l === 'number' && Number.isFinite(bar.l) ? bar.l : bar.c,
    c: bar.c,
    v: bar.v,
    vw: 0,
    o: typeof bar.o === 'number' && Number.isFinite(bar.o) ? bar.o : bar.c,
    t: bar.t,
    n: 0,
  }));
  const vwapBandSet = calculateVWAPBandSet(vwapBars);
  const vwapPrice = vwapBandSet?.vwap ?? null;
  const lastClose = closes[closes.length - 1];
  const vwapPosition = vwapPrice != null ? analyzeVWAPPosition(lastClose, vwapPrice) : null;
  const atr14 = calculateAtrFromBars(sortedBars, 14);
  const latestBarRaw = sortedBars[sortedBars.length - 1];
  const priorBarRaw = sortedBars.length > 1 ? sortedBars[sortedBars.length - 2] : null;
  const toTriggerBar = (bar: { t: number; o?: number; h?: number; l?: number; c: number; v: number } | null) => {
    if (!bar) return null;
    const open = typeof bar.o === 'number' && Number.isFinite(bar.o) ? bar.o : bar.c;
    const high = typeof bar.h === 'number' && Number.isFinite(bar.h) ? bar.h : Math.max(open, bar.c);
    const low = typeof bar.l === 'number' && Number.isFinite(bar.l) ? bar.l : Math.min(open, bar.c);
    return {
      t: bar.t,
      o: round(open, 4),
      h: round(high, 4),
      l: round(low, 4),
      c: round(bar.c, 4),
      v: Math.max(0, round(bar.v, 2)),
    };
  };
  const recentVolumeBars = sortedBars.slice(-20);
  const avgRecentVolume = recentVolumeBars.length > 0
    ? round(recentVolumeBars.reduce((sum, bar) => sum + bar.v, 0) / recentVolumeBars.length, 2)
    : null;

  return {
    emaFast: round(emaFast, 2),
    emaSlow: round(emaSlow, 2),
    emaFastSlope: round(emaFast - emaFastPrior, 4),
    emaSlowSlope: round(emaSlow - emaSlowPrior, 4),
    atr14: atr14 != null ? round(atr14, 4) : null,
    volumeTrend: volumeTrendFromBars(sortedBars),
    sessionOpenPrice: round(sessionOpenPrice, 2),
    orbHigh: round(Number.isFinite(orbHigh) ? orbHigh : sessionOpenPrice, 2),
    orbLow: round(Number.isFinite(orbLow) ? orbLow : sessionOpenPrice, 2),
    minutesSinceOpen,
    sessionOpenTimestamp: new Date(firstBar.t).toISOString(),
    asOfTimestamp: input.asOfTimestamp,
    vwapPrice: vwapPrice != null ? round(vwapPrice, 2) : null,
    vwapDeviation: vwapPosition != null ? round(vwapPosition.distancePct, 4) : null,
    vwapBand1SD: vwapBandSet
      ? {
        upper: round(vwapBandSet.band1SD.upper, 2),
        lower: round(vwapBandSet.band1SD.lower, 2),
      }
      : null,
    vwapBand15SD: vwapBandSet
      ? {
        upper: round(vwapBandSet.band15SD.upper, 2),
        lower: round(vwapBandSet.band15SD.lower, 2),
      }
      : null,
    vwapBand2SD: vwapBandSet
      ? {
        upper: round(vwapBandSet.band2SD.upper, 2),
        lower: round(vwapBandSet.band2SD.lower, 2),
      }
      : null,
    latestBar: toTriggerBar(latestBarRaw),
    priorBar: toTriggerBar(priorBarRaw),
    avgRecentVolume,
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
  netGex?: number;
  setupType?: string;
  atr14?: number | null;
  vixRegime?: SPXVixRegime | null;
  gexCallWall?: number;
  gexPutWall?: number;
  gexFlipPoint?: number;
}): number {
  const atrStopFloorEnabled = parseBooleanEnv(process.env.SPX_SETUP_ATR_STOP_FLOOR_ENABLED, true);
  const atrStopMultiplier = clamp(
    parseFloatEnv(process.env.SPX_SETUP_ATR_STOP_MULTIPLIER, 0.9, 0.1),
    0.1,
    3,
  );
  const vixStopScalingEnabled = parseBooleanEnv(process.env.SPX_SETUP_VIX_STOP_SCALING_ENABLED, true);
  const gexMagnitudeScalingEnabled = parseBooleanEnv(
    process.env.SPX_SETUP_GEX_MAGNITUDE_STOP_SCALING_ENABLED,
    true,
  );
  const entryMid = (input.entryLow + input.entryHigh) / 2;
  const gexDistanceBp = deriveNearestGEXDistanceBp({
    referencePrice: entryMid,
    callWall: input.gexCallWall,
    putWall: input.gexPutWall,
    flipPoint: input.gexFlipPoint,
  });

  return calculateAdaptiveStop({
    direction: input.direction,
    entryLow: input.entryLow,
    entryHigh: input.entryHigh,
    baseStop: input.baseStop,
    geometryStopScale: input.geometryPolicy.stopScale,
    atr14: input.atr14,
    atrStopFloorEnabled,
    atrStopMultiplier,
    netGex: input.netGex,
    setupType: input.setupType,
    vixRegime: input.vixRegime,
    vixStopScalingEnabled,
    gexDistanceBp,
    gexMagnitudeScalingEnabled,
  }).stop;
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
  setupScore: number;
  evaluationMinuteEt?: number | null;
  firstSeenAtIso: string | null;
  confluenceScore: number;
  pWinCalibrated: number;
  evR: number;
  flowConfirmed: boolean;
  flowAlignmentPct: number | null;
  flowQuality: FlowQualitySummary;
  emaAligned: boolean;
  volumeRegimeAligned: boolean;
  pausedSetupTypes: Set<string>;
  pausedCombos: Set<string>;
  profile: Awaited<ReturnType<typeof getActiveSPXOptimizationProfile>>;
  direction: 'bullish' | 'bearish';
  orbHigh?: number;
  orbLow?: number;
  vwapPrice?: number | null;
  vwapDeviation?: number | null;
}): string[] {
  const actionableStatuses = new Set(input.profile.qualityGate.actionableStatuses);
  const isNewActionable = (input.status === 'ready' || input.status === 'triggered') && !input.wasPreviouslyTriggered;
  if (!isNewActionable || !actionableStatuses.has(input.status)) return [];

  const reasons: string[] = [];
  const useSetupSpecificFloors = parseBooleanEnv(
    process.env.SPX_SETUP_SPECIFIC_GATES_ENABLED,
    true,
  );
  const setupFloors = useSetupSpecificFloors
    ? SETUP_SPECIFIC_GATE_FLOORS[input.setupType]
    : undefined;
  const scoreFloorEnabled = parseBooleanEnv(
    process.env.SPX_SETUP_SCORE_FLOOR_ENABLED,
    true,
  );
  const minSetupScoreFloor = clamp(
    parseFloatEnv(
      process.env.SPX_SETUP_MIN_SCORE_FLOOR,
      DEFAULT_MIN_SETUP_SCORE_FLOOR,
      0,
    ),
    0,
    100,
  );
  const lateSessionHardGateEnabled = parseBooleanEnv(
    process.env.SPX_SETUP_LATE_SESSION_HARD_GATE_ENABLED,
    true,
  );
  const lateSessionHardGateMinuteEt = parseIntEnv(
    process.env.SPX_SETUP_LATE_SESSION_HARD_GATE_MINUTE_ET,
    DEFAULT_LATE_SESSION_HARD_GATE_MINUTE_ET,
    0,
  );
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
  const orbFlowGraceEnabled = parseBooleanEnv(
    process.env.SPX_ORB_FLOW_GRACE_ENABLED,
    true,
  );
  const orbFlowGraceEligible = (
    orbFlowGraceEnabled
    && input.setupType === 'orb_breakout'
    && firstSeenMinute != null
    && firstSeenMinute <= ORB_GRACE_MAX_FIRST_SEEN_MINUTE
    && input.emaAligned
    && input.confluenceScore >= Math.max(ORB_GRACE_MIN_CONFLUENCE_SCORE, minConfluenceScore)
  );
  const orbVolumeGraceEligible = (
    orbFlowGraceEnabled
    && input.setupType === 'orb_breakout'
    && firstSeenMinute != null
    && firstSeenMinute <= ORB_GRACE_MAX_FIRST_SEEN_MINUTE
    && input.emaAligned
    && input.confluenceScore >= ORB_GRACE_MIN_CONFLUENCE_SCORE
  );
  const orbEmaGraceEligible = (
    orbFlowGraceEnabled
    && input.setupType === 'orb_breakout'
    && firstSeenMinute != null
    && firstSeenMinute <= ORB_WINDOW_MINUTES
    && input.confluenceScore >= ORB_GRACE_MIN_CONFLUENCE_SCORE
  );
  const trendFamilyVolumeGraceEligible = (
    input.setupType === 'trend_pullback'
    && firstSeenMinute != null
    && firstSeenMinute <= 240
    && input.emaAligned
    && input.confluenceScore >= 3
  );
  if (input.pausedSetupTypes.has(input.setupType)) {
    reasons.push(`setup_type_paused:${input.setupType}`);
  }
  if (input.pausedCombos.has(comboKey)) {
    reasons.push(`regime_combo_paused:${comboKey}`);
  }
  if (scoreFloorEnabled && input.setupScore < minSetupScoreFloor) {
    reasons.push(`score_below_floor:${round(input.setupScore, 2)}<${round(minSetupScoreFloor, 2)}`);
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
  if (requireFlowConfirmation && !input.flowConfirmed && !trendFamilyFlowGraceEligible && !orbFlowGraceEligible) {
    reasons.push('flow_confirmation_required');
  }
  if (input.flowAlignmentPct != null) {
    if (minAlignmentPct > 0 && input.flowAlignmentPct < minAlignmentPct) {
      reasons.push(`flow_alignment_below_floor:${round(input.flowAlignmentPct, 2)}<${minAlignmentPct}`);
    }
  } else if (requireFlowConfirmation && minAlignmentPct > 0 && !trendFamilyFlowGraceEligible && !orbFlowGraceEligible) {
    reasons.push('flow_alignment_unavailable');
  }
  if (requireEmaAlignment && !input.emaAligned && !orbEmaGraceEligible) {
    reasons.push('ema_alignment_required');
  }
  if (requireVolumeRegimeAlignment && !input.volumeRegimeAligned && !trendFamilyVolumeGraceEligible && !orbVolumeGraceEligible) {
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
  if (
    lateSessionHardGateEnabled
    && Number.isFinite(input.evaluationMinuteEt ?? NaN)
    && Number(input.evaluationMinuteEt) >= lateSessionHardGateMinuteEt
  ) {
    reasons.push(`late_session_hard_gate:${Number(input.evaluationMinuteEt)}>=${lateSessionHardGateMinuteEt}`);
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

  if (input.setupType === 'orb_breakout') {
    const effectiveFlowMinEvents = orbFlowGraceEligible
      ? ORB_GRACE_REDUCED_FLOW_EVENTS
      : FLOW_QUALITY_MIN_EVENTS;
    const effectiveFlowMinScore = orbFlowGraceEligible
      ? ORB_GRACE_REDUCED_FLOW_QUALITY_SCORE
      : ORB_MIN_FLOW_QUALITY_SCORE;
    if (input.flowQuality.recentDirectionalEvents < effectiveFlowMinEvents) {
      reasons.push(`flow_event_count_low:${input.flowQuality.recentDirectionalEvents}<${effectiveFlowMinEvents}`);
    }
    if (input.flowQuality.score < effectiveFlowMinScore) {
      reasons.push(`flow_quality_low:${round(input.flowQuality.score, 2)}<${effectiveFlowMinScore}`);
    }
    // ORB range width filter — reject too-narrow or too-wide opening ranges
    const orbWidth = (input.orbHigh ?? 0) - (input.orbLow ?? 0);
    if (input.orbHigh != null && input.orbLow != null && orbWidth > 0) {
      if (orbWidth < ORB_RANGE_MIN_WIDTH_POINTS) {
        reasons.push(`orb_range_too_narrow:${round(orbWidth, 2)}<${ORB_RANGE_MIN_WIDTH_POINTS}`);
      }
      if (orbWidth > ORB_RANGE_MAX_WIDTH_POINTS) {
        reasons.push(`orb_range_too_wide:${round(orbWidth, 2)}>${ORB_RANGE_MAX_WIDTH_POINTS}`);
      }
    }
  }

  // VWAP directional filter — bullish setups should be at or above VWAP, bearish below
  const vwapGateEnabled = parseBooleanEnv(process.env.SPX_VWAP_GATE_ENABLED, true);
  if (vwapGateEnabled && input.vwapPrice != null && Number.isFinite(input.vwapPrice)) {
    const vwapMisaligned = input.direction === 'bullish'
      ? input.vwapDeviation != null && input.vwapDeviation < -0.15
      : input.vwapDeviation != null && input.vwapDeviation > 0.15;
    if (vwapMisaligned) {
      reasons.push(`vwap_direction_misaligned:${input.direction}|dev=${round(input.vwapDeviation ?? 0, 4)}`);
    }
  }

  if (input.setupType === 'trend_pullback' && firstSeenMinute != null) {
    const trendTimingByRegime: Record<Regime, number> = {
      breakout: 300,
      trending: 320,
      compression: 240,
      ranging: 210,
    };
    const trendMaxMinute = trendTimingByRegime[input.regime];
    if (firstSeenMinute > trendMaxMinute) {
      reasons.push(`trend_timing_window:${firstSeenMinute}>${trendMaxMinute}`);
    }
  }

  return reasons;
}

function bucketPrice(value: number, bucket = STABLE_SETUP_PRICE_BUCKET): number {
  if (!Number.isFinite(value)) return 0;
  const safeBucket = bucket > 0 ? bucket : 0.5;
  return round(Math.round(value / safeBucket) * safeBucket, 2);
}

function hashStableSetupId(input: {
  sessionDate: string;
  setupType: SetupType;
  direction: Setup['direction'];
  entryMid: number;
  geometryBucket: SetupGeometryBucket;
}): string {
  const seed = [
    input.sessionDate,
    input.setupType,
    input.direction,
    bucketPrice(input.entryMid),
    input.geometryBucket,
  ].join('|');
  return stableId('stable_setup', seed).replace('stable_setup_', '');
}

function deriveStableIdHashFromExistingSetup(setup: Setup): string {
  if (typeof setup.stableIdHash === 'string' && setup.stableIdHash.length > 0) {
    return setup.stableIdHash;
  }

  const createdDate = Date.parse(setup.createdAt);
  const sessionDate = Number.isFinite(createdDate)
    ? toEasternTime(new Date(createdDate)).dateStr
    : toEasternTime(new Date()).dateStr;
  const firstSeenMinuteEt = toSessionMinuteEt(setup.createdAt);
  const geometryBucket = toGeometryBucket(firstSeenMinuteEt);
  const entryMid = (setup.entryZone.low + setup.entryZone.high) / 2;

  return hashStableSetupId({
    sessionDate,
    setupType: setup.type,
    direction: setup.direction,
    entryMid,
    geometryBucket,
  });
}

function pickMorphCandidate(input: {
  candidates: Setup[];
  entryMid: number;
}): Setup | null {
  if (input.candidates.length === 0) return null;
  const sorted = [...input.candidates]
    .map((candidate) => ({
      candidate,
      entryMid: (candidate.entryZone.low + candidate.entryZone.high) / 2,
    }))
    .sort((a, b) => Math.abs(a.entryMid - input.entryMid) - Math.abs(b.entryMid - input.entryMid));

  const nearest = sorted[0];
  if (!nearest) return null;
  if (Math.abs(nearest.entryMid - input.entryMid) > STABLE_SETUP_MORPH_ENTRY_TOLERANCE) return null;
  return nearest.candidate;
}

function buildMorphHistory(input: {
  previous: Setup | null;
  nextStop: number;
  nextTarget2: number;
  timestamp: string;
}): Setup['morphHistory'] {
  const priorHistory = Array.isArray(input.previous?.morphHistory)
    ? input.previous?.morphHistory
    : [];
  if (!input.previous) return priorHistory;

  const stopChanged = Math.abs((input.previous.stop || 0) - input.nextStop) >= 0.05;
  const targetChanged = Math.abs((input.previous.target2?.price || 0) - input.nextTarget2) >= 0.1;
  if (!stopChanged && !targetChanged) {
    return priorHistory;
  }

  const nextRecord = {
    timestamp: input.timestamp,
    priorStop: round(input.previous.stop, 2),
    newStop: round(input.nextStop, 2),
    priorTarget: round(input.previous.target2.price, 2),
    newTarget: round(input.nextTarget2, 2),
  };

  return [...priorHistory, nextRecord].slice(-MAX_MORPH_HISTORY_ITEMS);
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
    ))
    .sort((a, b) => (b.setup.score || 0) - (a.setup.score || 0));

  const promoteCount = Math.min(neededAlternative, promotableAlternatives.length);
  for (let i = 0; i < promoteCount; i += 1) {
    const candidate = promotableAlternatives[i];
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

function emptyEnvironmentState(asOf: string): SetupEnvironmentStateSnapshot {
  return {
    asOf,
    gate: null,
    standbyGuidance: null,
  };
}

async function loadCachedEnvironmentState(): Promise<SetupEnvironmentStateSnapshot | null> {
  const cached = await cacheGet<SetupEnvironmentStateSnapshot>(SETUPS_ENV_STATE_CACHE_KEY);
  if (!cached || typeof cached !== 'object') return null;
  if (typeof cached.asOf !== 'string') return null;

  return {
    asOf: cached.asOf,
    gate: cached.gate || null,
    standbyGuidance: cached.standbyGuidance || null,
  };
}

async function persistEnvironmentState(input: {
  state: SetupEnvironmentStateSnapshot;
  shouldUseCache: boolean;
}): Promise<void> {
  latestSetupEnvironmentState = input.state;
  if (!input.shouldUseCache) return;
  await cacheSet(SETUPS_ENV_STATE_CACHE_KEY, input.state, SETUPS_CACHE_TTL_SECONDS);
}

export async function getLatestSetupEnvironmentState(options?: {
  forceRefresh?: boolean;
}): Promise<SetupEnvironmentStateSnapshot | null> {
  if (!options?.forceRefresh && latestSetupEnvironmentState) {
    return latestSetupEnvironmentState;
  }

  const cached = await loadCachedEnvironmentState();
  if (cached) {
    latestSetupEnvironmentState = cached;
    return cached;
  }

  return latestSetupEnvironmentState;
}

export async function detectActiveSetups(options?: {
  forceRefresh?: boolean;
  asOfTimestamp?: string;
  persistForWinRate?: boolean;
  levelData?: LevelData;
  gexLandscape?: UnifiedGEXLandscape;
  fibLevels?: FibLevel[];
  regimeState?: RegimeState;
  flowEvents?: SPXFlowEvent[];
  flowAggregationOverride?: SPXFlowWindowAggregation | null;
  multiTFConfluenceOverride?: SPXMultiTFConfluenceContext | null;
  indicatorContext?: SetupIndicatorContext | null;
  previousSetups?: Setup[];
  environmentGateOverride?: SPXEnvironmentGateDecision | null;
}): Promise<Setup[]> {
  const levelData = options?.levelData;
  const gexLandscape = options?.gexLandscape;
  const fibLevelsProvided = options?.fibLevels;
  const regimeStateProvided = options?.regimeState;
  const flowEventsProvided = options?.flowEvents;
  const flowAggregationOverride = options?.flowAggregationOverride;
  const multiTFConfluenceOverride = options?.multiTFConfluenceOverride;
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
  );
  if (shouldUseCache && !forceRefresh && setupsInFlight) {
    return setupsInFlight;
  }

  const run = async (): Promise<Setup[]> => {
  if (shouldUseCache && !forceRefresh && !hasPrecomputedDependencies) {
    const [cachedSetups, cachedEnvironment] = await Promise.all([
      cacheGet<Setup[]>(SETUPS_CACHE_KEY),
      loadCachedEnvironmentState(),
    ]);
    if (cachedSetups) {
      latestSetupEnvironmentState = cachedEnvironment || emptyEnvironmentState(evaluationIso);
      return cachedSetups;
    }
  }

  const previousSetups = options?.previousSetups
    || (shouldUseCache ? await cacheGet<Setup[]>(SETUPS_CACHE_KEY) : []);
  const previousById = new Map<string, Setup>(
    (previousSetups || []).map((setup) => [setup.id, setup]),
  );
  const previousByStableHash = new Map<string, Setup[]>();
  for (const previousSetup of previousSetups || []) {
    const stableHash = deriveStableIdHashFromExistingSetup(previousSetup);
    const existing = previousByStableHash.get(stableHash) || [];
    existing.push(previousSetup);
    previousByStableHash.set(stableHash, existing);
  }
  const matchedPreviousSetupIds = new Set<string>();

  const [levels, gex, fibLevels, regimeState, flowEvents, indicatorContext] = await Promise.all([
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
  ]);
  const flowAggregation = flowAggregationOverride
    || await getFlowWindowAggregation({
      forceRefresh,
      flowEvents,
      asOf: evaluationDate,
    });

  const currentPrice = gex.spx.spotPrice;
  const environmentGateEnabled = parseBooleanEnv(process.env.SPX_ENVIRONMENT_GATE_ENABLED, false);
  const environmentGate = environmentGateEnabled
    ? (
      options?.environmentGateOverride
      || await evaluateEnvironmentGate({
        evaluationDate,
        currentPrice,
        sessionOpenPrice: indicatorContext?.sessionOpenPrice ?? null,
        atr14: indicatorContext?.atr14 ?? null,
        regime: regimeState.regime,
        regimeState,
        vixValue: null,
        disableMacroCalendar: hasHistoricalTimestamp,
      })
    )
    : null;
  const candidateZones = pickCandidateZones({
    zones: levels.clusters,
    currentPrice,
    regime: regimeState.regime,
    vixRegime: environmentGate?.vixRegime || 'unknown',
  });
  const zoneQualityThreshold = minZoneQualityThreshold({
    regime: regimeState.regime,
    vixRegime: environmentGate?.vixRegime || 'unknown',
  });
  const multiTFConfluenceEnabled = (
    parseBooleanEnv(process.env.SPX_MULTI_TF_CONFLUENCE_ENABLED, false)
    || multiTFConfluenceOverride != null
  );
  const multiTFConfluenceContext = multiTFConfluenceEnabled
    ? (
      multiTFConfluenceOverride
      || await getMultiTFConfluenceContext({
        forceRefresh,
        evaluationDate,
      })
    )
    : null;
  const memoryEngineEnabled = parseBooleanEnv(process.env.SPX_MEMORY_ENGINE_ENABLED, false);
  const weightedConfluenceEnabled = parseBooleanEnv(process.env.SPX_WEIGHTED_CONFLUENCE_ENABLED, false);
  const adaptiveEvEnabled = parseBooleanEnv(process.env.SPX_ADAPTIVE_EV_ENABLED, false);
  const adaptiveEvSlippageR = parseFloatEnv(process.env.SPX_EV_SLIPPAGE_R, 0.05, 0);
  const nowMs = evaluationDate.getTime();
  const lifecycleConfig = getSetupLifecycleConfig();
  const scoringConfig = getSetupScoringConfig();
  const diversificationConfig = getSetupDiversificationConfig();
  const optimizationProfile = await getActiveSPXOptimizationProfile();
  const pausedSetupTypes = new Set(optimizationProfile.driftControl.pausedSetupTypes);
  const pausedCombos = new Set(
    optimizationProfile.regimeGate.pausedCombos.filter((combo) => (
      !diversificationConfig.allowRecoveryCombos || !DIVERSIFICATION_RECOVERY_COMBOS.has(combo)
    )),
  );

  const sessionDate = toEasternTime(evaluationDate).dateStr;

  const setups: Setup[] = await Promise.all(candidateZones.map(async ({ zone, quality }) => {
    const direction = setupDirection(zone, currentPrice);
    const zoneCenter = (zone.priceLow + zone.priceHigh) / 2;
    const regimeConflict = hasRegimeConflict(
      direction,
      regimeState,
      lifecycleConfig.regimeConflictConfidenceThreshold,
    );
    const eventAlignmentPct = flowAlignmentPercent({
      flowEvents,
      direction,
      nowMs,
    });
    const flowWindowSignal = deriveFlowWindowSignal({
      aggregation: flowAggregation,
      direction,
    });
    const alignmentPct = blendFlowAlignmentPercent({
      eventAlignmentPct,
      windowAlignmentPct: flowWindowSignal.alignmentPct,
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
    const flowConfirmedFromEvents = hasFlowConfirmation({
      flowEvents,
      direction,
      zoneCenter,
      nowMs,
    });
    const flowConfirmed = flowConfirmedFromEvents || flowWindowSignal.confirmed;
    const flowQuality = applyFlowWindowQualityBoost({
      flowQuality: evaluateFlowQuality({
        flowEvents,
        direction,
        zoneCenter,
        nowMs,
      }),
      flowWindowSignal,
    });
    const flowWindowDriver = flowWindowSignal.confirmed && flowWindowSignal.window
      ? `Flow window ${flowWindowSignal.window} aligned (${round(flowWindowSignal.alignmentPct ?? 0, 1)}%)`
      : null;
    const flowWindowRisk = (!flowConfirmedFromEvents && flowWindowSignal.confirmed)
      ? 'Local flow weaker than global window signal'
      : null;
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
    const memoryContext = memoryEngineEnabled
      ? await getLevelMemoryContext({
        sessionDate,
        setupType,
        direction,
        entryMid: zoneCenter,
      })
      : null;
    const memoryScoreBoost = memoryContext
      ? clamp((memoryContext.score - 50) * 0.08, -4, 7)
      : 0;
    const memoryPWinAdjustment = memoryContext
      ? clamp(((memoryContext.score - 50) / 100) * 0.08 * Math.max(0.2, memoryContext.confidence), -0.04, 0.06)
      : 0;
    const regimeAligned = isRegimeAligned(setupType, regimeState.regime);
    const regimeCompatibility = regimeAligned
      ? (
        regimeState.direction === 'neutral'
          ? 0.72
          : regimeState.direction === direction
            ? 0.9
            : 0.65
      )
      : 0.35;
    const memoryWinRate = memoryContext?.winRatePct != null
      ? memoryContext.winRatePct / 100
      : null;
    const memoryTotalTests = memoryContext?.resolved ?? 0;
    const memoryBonus = (
      memoryWinRate != null
      && memoryWinRate >= 0.55
      && memoryTotalTests >= 5
      && regimeCompatibility >= 0.65
    )
      ? Math.min(1, Math.max(0, (memoryWinRate - 0.5) * 2))
      : 0;
    const hasMemoryEdge = memoryBonus > 0;
    const memoryWeakness = Boolean(
      memoryContext
      && memoryContext.resolved >= 5
      && memoryContext.winRatePct != null
      && memoryContext.winRatePct <= 45,
    );
    const memoryDriver = hasMemoryEdge && memoryContext?.winRatePct != null
      ? `Cross-session memory ${memoryContext.wins}/${memoryContext.resolved} wins (${round(memoryContext.winRatePct, 1)}%)`
      : null;
    const memoryRisk = memoryWeakness && memoryContext?.winRatePct != null
      ? `Cross-session memory weak (${round(memoryContext.winRatePct, 1)}% win rate)`
      : null;
    const multiTFConfluence = multiTFConfluenceEnabled
      ? scoreMultiTFConfluence({
        context: multiTFConfluenceContext,
        direction,
        currentPrice,
      })
      : null;

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
      vwapPrice: indicatorContext?.vwapPrice ?? null,
      vwapDeviation: indicatorContext?.vwapDeviation ?? null,
    });
    let confluenceScore = hasMemoryEdge ? Math.min(5, confluence.score + memoryBonus) : confluence.score;
    let confluenceSources = hasMemoryEdge && !confluence.sources.includes('cross_session_memory')
      ? [...confluence.sources, 'cross_session_memory']
      : confluence.sources;
    const gexAligned = confluence.sources.includes('gex_alignment');
    const weightedConfluence = calculateWeightedConfluence({
      flowQualityScore: flowQuality.score,
      flowConfirmed,
      emaAligned,
      emaFastSlope: indicatorContext?.emaFastSlope,
      zoneQualityScore: quality.compositeScore,
      gexAligned,
      regimeAligned,
      regimeConflict,
      multiTFComposite: multiTFConfluence?.composite ?? null,
      memoryScoreBoost,
    });
    if (multiTFConfluence?.aligned && !confluenceSources.includes('multi_tf_alignment')) {
      confluenceSources = [...confluenceSources, 'multi_tf_alignment'];
      confluenceScore = Math.min(5, confluenceScore + 1);
    }
    if (weightedConfluenceEnabled) {
      confluenceScore = Math.max(confluenceScore, weightedConfluence.legacyEquivalent);
      if (!confluenceSources.includes('weighted_confluence')) {
        confluenceSources = [...confluenceSources, 'weighted_confluence'];
      }
    }

    const fallbackDistance = Math.max(6, Math.abs(gex.combined.callWall - gex.combined.putWall) / 4);
    const vwapGeometry = buildVWAPSetupGeometry({
      setupType,
      direction,
      indicatorContext,
    });
    const entryLow = vwapGeometry?.entryLow ?? round(zone.priceLow, 2);
    const entryHigh = vwapGeometry?.entryHigh ?? round(zone.priceHigh, 2);
    const entryMid = (entryLow + entryHigh) / 2;
    const stableIdHash = hashStableSetupId({
      sessionDate,
      setupType,
      direction,
      entryMid,
      geometryBucket: toGeometryBucket(toSessionMinuteEt(evaluationIso)),
    });
    const generatedSetupId = stableId('spx_setup', stableIdHash);
    const previous = previousById.get(generatedSetupId)
      || pickMorphCandidate({
        candidates: previousByStableHash.get(stableIdHash) || [],
        entryMid,
      })
      || pickMorphCandidate({
        candidates: (previousSetups || []).filter((setup) => (
          setup.status === 'triggered' || setup.status === 'ready'
        )),
        entryMid,
      })
      || null;
    if (previous) {
      matchedPreviousSetupIds.add(previous.id);
    }
    const setupId = previous?.id || generatedSetupId;
    const resolvedStableIdHash = previous?.stableIdHash || stableIdHash;
    const createdAt = previous?.createdAt || evaluationIso;
    const firstSeenMinuteEt = toSessionMinuteEt(createdAt);
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
    const derivedStop = applyStopGeometryPolicy({
      direction,
      entryLow,
      entryHigh,
      baseStop,
      geometryPolicy,
      netGex: gex.combined.netGex,
      setupType,
      atr14: indicatorContext?.atr14 ?? null,
      vixRegime: environmentGate?.vixRegime ?? null,
      gexCallWall: gex.combined.callWall,
      gexPutWall: gex.combined.putWall,
      gexFlipPoint: gex.combined.flipPoint,
    });
    const stop = vwapGeometry?.stop ?? derivedStop;
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
    const target1 = vwapGeometry?.target1 ?? tunedTargets.target1;
    const target2 = vwapGeometry?.target2 ?? tunedTargets.target2;

    const setupReadyFloor = (
      setupType === 'flip_reclaim'
      && regimeState.regime === 'ranging'
    )
      ? 2
      : 3;
    const readyConfluenceThreshold = environmentGate
      ? Math.max(setupReadyFloor, environmentGate.dynamicReadyThreshold)
      : setupReadyFloor;
    const readyConfluenceThresholdScore = clamp(readyConfluenceThreshold * 20, 20, 95);
    let computedStatus: Setup['status'] = weightedConfluenceEnabled
      ? weightedConfluence.composite >= readyConfluenceThresholdScore
        ? 'ready'
        : 'forming'
      : confluenceScore >= readyConfluenceThreshold
        ? 'ready'
        : 'forming';
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
    const riskToStop = Math.max(Math.abs(entryMid - stop), 0.25);
    const rewardToTarget1 = Math.abs(target1 - entryMid);
    const rewardToTarget2 = Math.abs(target2 - entryMid);
    const inEntryZone = isPriceInsideEntry({ entryZone: { low: entryLow, high: entryHigh } }, currentPrice);
    const normalizedConfluence = clamp((confluenceScore / 5) * 100);
    const zoneTypeBonus = zone.type === 'fortress'
      ? 20
      : zone.type === 'defended'
        ? 12
        : zone.type === 'moderate'
          ? 6
          : 0;
    const structureQuality = clamp(((zone.clusterScore / 5) * 60) + (normalizedConfluence * 0.4) + zoneTypeBonus);
    const flowAlignment = alignmentPct == null ? (flowConfirmed ? 58 : 44) : clamp(alignmentPct + (flowConfirmed ? 6 : 0));
    const gexAlignment = confluenceSources.includes('gex_alignment') ? 82 : 42;
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
    const multiTFComposite = multiTFConfluence?.composite ?? 50;

    const weights = regimeWeights(regimeState.regime);
    const scoreRawBase = (
      (weights.structure * (structureQuality / 100))
      + (weights.flow * (flowAlignment / 100))
      + (weights.gex * (gexAlignment / 100))
      + (weights.regime * (regimeAlignment / 100))
      + (weights.proximity * (proximityUrgency / 100))
      + (weights.microTrigger * (microTriggerQuality / 100))
    );
    const scoreRaw = multiTFConfluence
      ? (scoreRawBase * 0.88) + ((multiTFComposite / 100) * 0.12)
      : scoreRawBase;
    const indicatorBlend = (0.65 * emaTrendScore) + (0.35 * volumeContextScore);
    const stalePenalty = Math.min(12, (contextState.regimeConflictStreak + contextState.flowDivergenceStreak) * 3);
    const contradictionPenalty = (regimeConflict ? 8 : 0) + (flowDivergence ? 7 : 0);
    const lifecyclePenalty = lifecycle.status === 'forming' ? 6 : lifecycle.status === 'invalidated' ? 90 : lifecycle.status === 'expired' ? 95 : 0;
    const blendedRawScore = weightedConfluenceEnabled
      ? ((scoreRaw * 100) * 0.70) + (weightedConfluence.composite * 0.30)
      : (scoreRaw * 100);
    const finalScore = scoringConfig.evTieringEnabled
      ? clamp(blendedRawScore - stalePenalty - contradictionPenalty - lifecyclePenalty + ((indicatorBlend - 50) * 0.1) + memoryScoreBoost)
      : clamp(normalizedConfluence + Math.max(0, memoryScoreBoost * 0.35));
    const confluenceBreakdown = weightedConfluenceEnabled
      ? {
        flow: weightedConfluence.flow,
        ema: weightedConfluence.ema,
        zone: weightedConfluence.zone,
        gex: weightedConfluence.gex,
        regime: weightedConfluence.regime,
        multiTF: weightedConfluence.multiTF,
        memory: round(memoryBonus, 2),
        composite: weightedConfluence.composite,
        legacyEquivalent: weightedConfluence.legacyEquivalent,
        threshold: round(readyConfluenceThresholdScore, 2),
      }
      : undefined;

    const baselineWin = (WIN_RATE_BY_SCORE[confluenceScore] || 32) / 100;
    const scoreAdjustment = (finalScore - 50) / 220;
    const flowAdjustment = alignmentPct == null ? 0 : ((alignmentPct - 50) / 240);
    const pWinCalibrated = clamp(
      baselineWin
        + scoreAdjustment
        + (regimeAligned ? 0.03 : -0.04)
        + flowAdjustment
        + memoryPWinAdjustment,
      0.05,
      0.95,
    );
    const rTarget1 = rewardToTarget1 / riskToStop;
    const rTarget2 = rewardToTarget2 / riskToStop;
    const rBlended = (0.65 * rTarget1) + (0.35 * rTarget2);
    const costR = 0.08 + (flowConfirmed ? 0 : 0.03) + (lifecycle.status === 'forming' ? 0.05 : 0);
    const baselineEvR = (pWinCalibrated * rBlended) - ((1 - pWinCalibrated) * 1.0) - costR;
    const adaptiveEv = adaptiveEvEnabled
      ? calculateAdaptiveEV({
        pWin: pWinCalibrated,
        target1R: rTarget1,
        target2R: rTarget2,
        vixValue: environmentGate?.breakdown.vixRegime.value ?? null,
        minutesSinceOpen: indicatorContext?.minutesSinceOpen ?? null,
        slippageR: adaptiveEvSlippageR,
        partialAtT1Pct: optimizationProfile.tradeManagement.partialAtT1Pct,
      })
      : null;
    const effectivePWinCalibrated = adaptiveEv?.adjustedPWin ?? pWinCalibrated;
    const evR = adaptiveEv?.evR ?? baselineEvR;
    const flowAlignmentPct = alignmentPct == null ? null : round(alignmentPct, 2);
    const gateReasons = evaluateOptimizationGate({
      status: lifecycle.status,
      wasPreviouslyTriggered: Boolean(previous?.triggeredAt),
      setupType,
      regime: regimeState.regime,
      setupScore: finalScore,
      evaluationMinuteEt: indicatorContext?.minutesSinceOpen ?? null,
      firstSeenAtIso: createdAt,
      confluenceScore,
      pWinCalibrated: effectivePWinCalibrated,
      evR,
      flowConfirmed,
      flowAlignmentPct,
      flowQuality,
      emaAligned,
      volumeRegimeAligned,
      pausedSetupTypes,
      pausedCombos,
      profile: optimizationProfile,
      direction,
      orbHigh: indicatorContext?.orbHigh,
      orbLow: indicatorContext?.orbLow,
      vwapPrice: indicatorContext?.vwapPrice,
      vwapDeviation: indicatorContext?.vwapDeviation,
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
        pWinCalibrated: effectivePWinCalibrated,
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
      confluenceScore,
      flowConfirmed,
      basePolicy: optimizationProfile.tradeManagement,
    });
    const morphHistory = buildMorphHistory({
      previous,
      nextStop: stop,
      nextTarget2: target2,
      timestamp: evaluationIso,
    });
    const morphCount = Array.isArray(morphHistory) ? morphHistory.length : 0;
    const zoneQualityDriver = quality.compositeScore >= zoneQualityThreshold
      ? `Zone quality ${round(quality.compositeScore, 1)}`
      : null;
    const zoneQualityRisk = quality.compositeScore < zoneQualityThreshold
      ? `Zone quality below target (${round(quality.compositeScore, 1)} < ${zoneQualityThreshold})`
      : null;
    const multiTFDriver = multiTFConfluence?.aligned
      ? `Multi-TF aligned (${Math.round(multiTFConfluence.composite)} score)`
      : null;
    const multiTFRisk = multiTFConfluence && !multiTFConfluence.aligned
      ? `Multi-TF weak (${Math.round(multiTFConfluence.composite)} score)`
      : null;
    const weightedConfluenceDriver = weightedConfluenceEnabled
      ? `Weighted confluence ${round(weightedConfluence.composite, 1)} / ${round(readyConfluenceThresholdScore, 1)}`
      : null;
    const weightedConfluenceRisk = (
      weightedConfluenceEnabled
      && weightedConfluence.composite < readyConfluenceThresholdScore
    )
      ? `Weighted confluence below ready threshold (${round(weightedConfluence.composite, 1)} < ${round(readyConfluenceThresholdScore, 1)})`
      : null;
    const adaptiveEvDriver = adaptiveEv
      ? `Adaptive EV ${round(adaptiveEv.evR, 2)}R (T1/T2 ${Math.round(adaptiveEv.t1Weight * 100)}/${Math.round(adaptiveEv.t2Weight * 100)})`
      : null;
    const adaptiveEvRisk = adaptiveEv && adaptiveEv.adjustedPWin < pWinCalibrated
      ? `EV pWin decayed to ${round(adaptiveEv.adjustedPWin * 100, 1)}%`
      : null;
    const morphDriver = morphCount > 0 ? `Setup morphed ${morphCount}x` : null;
    const finalTriggeredAt = gatedLifecycle.status === 'triggered' || gatedLifecycle.status === 'invalidated' || gatedLifecycle.status === 'expired'
      ? gatedTriggeredAt
      : null;
    const triggerContext = buildTriggerContext({
      previous,
      setupStatus: gatedLifecycle.status,
      triggeredAt: finalTriggeredAt,
      evaluationTimestamp: evaluationIso,
      direction,
      zone,
      indicatorContext,
    });
    const triggerDriver = triggerContext && gatedLifecycle.status === 'triggered'
      ? `Trigger ${triggerContext.triggerBarPatternType} ${Math.round(triggerContext.triggerLatencyMs / 1000)}s ago`
      : null;

    return {
      id: setupId,
      stableIdHash: resolvedStableIdHash,
      type: setupType,
      direction,
      entryZone: { low: entryLow, high: entryHigh },
      stop,
      target1: { price: target1, label: 'Target 1' },
      target2: { price: target2, label: 'Target 2' },
      confluenceScore,
      confluenceSources,
      clusterZone: zone,
      regime: regimeState.regime,
      status: gatedLifecycle.status,
      score: round(finalScore, 2),
      alignmentScore: flowAlignmentPct ?? undefined,
      flowConfirmed,
      confidenceTrend: emaAligned
        ? ((indicatorContext?.emaFastSlope || 0) > EMA_MIN_SLOPE_POINTS ? 'up' : 'flat')
        : ((indicatorContext?.emaFastSlope || 0) < -EMA_MIN_SLOPE_POINTS ? 'down' : 'flat'),
      decisionDrivers: [
        ...(emaAligned ? ['EMA trend alignment'] : []),
        ...(volumeRegimeAligned ? ['Volume trend aligned with regime'] : []),
        ...(flowWindowDriver ? [flowWindowDriver] : []),
        ...(memoryDriver ? [memoryDriver] : []),
        ...(multiTFDriver ? [multiTFDriver] : []),
        ...(weightedConfluenceDriver ? [weightedConfluenceDriver] : []),
        ...(adaptiveEvDriver ? [adaptiveEvDriver] : []),
        ...(zoneQualityDriver ? [zoneQualityDriver] : []),
        ...(morphDriver ? [morphDriver] : []),
        ...(triggerDriver ? [triggerDriver] : []),
      ],
      decisionRisks: [
        ...(!emaAligned ? ['EMA trend misalignment'] : []),
        ...(!volumeRegimeAligned ? ['Volume trend not confirming regime'] : []),
        ...(flowWindowRisk ? [flowWindowRisk] : []),
        ...(memoryRisk ? [memoryRisk] : []),
        ...(multiTFRisk ? [multiTFRisk] : []),
        ...(weightedConfluenceRisk ? [weightedConfluenceRisk] : []),
        ...(adaptiveEvRisk ? [adaptiveEvRisk] : []),
        ...(zoneQualityRisk ? [zoneQualityRisk] : []),
      ],
      zoneQualityScore: quality.compositeScore,
      zoneQualityComponents: quality,
      morphHistory,
      gateStatus,
      gateReasons,
      tradeManagement: tradeManagementPolicy,
      pWinCalibrated: round(effectivePWinCalibrated, 4),
      evR: round(evR, 3),
      evContext: adaptiveEv
        ? {
          model: 'adaptive',
          adjustedPWin: round(adaptiveEv.adjustedPWin, 4),
          expectedLossR: round(adaptiveEv.expectedLossR, 4),
          blendedWinR: round(adaptiveEv.blendedWinR, 4),
          t1Weight: round(adaptiveEv.t1Weight, 4),
          t2Weight: round(adaptiveEv.t2Weight, 4),
          slippageR: round(adaptiveEv.slippageR, 4),
        }
        : undefined,
      tier: gatedTier,
      rank: undefined,
      statusUpdatedAt: gatedLifecycle.statusUpdatedAt,
      ttlExpiresAt: gatedLifecycle.ttlExpiresAt,
      invalidationReason: gatedLifecycle.invalidationReason,
      probability: WIN_RATE_BY_SCORE[confluenceScore] || 32,
      recommendedContract: null,
      createdAt,
      triggeredAt: finalTriggeredAt,
      triggerContext,
      // Telemetry for optimizer learning (P16-S7)
      flowQualityScore: flowQuality.score,
      flowRecentDirectionalEvents: flowQuality.recentDirectionalEvents,
      flowRecentDirectionalPremium: flowQuality.recentDirectionalPremium,
      flowLocalDirectionalEvents: flowQuality.localDirectionalEvents,
      flowLocalDirectionalPremium: flowQuality.localDirectionalPremium,
      confluenceBreakdown,
      multiTFConfluence: multiTFConfluence
        ? {
          score: round(multiTFConfluence.composite, 2),
          aligned: multiTFConfluence.aligned,
          tf1hStructureAligned: multiTFConfluence.tf1hStructureAligned,
          tf15mSwingProximity: multiTFConfluence.tf15mSwingProximity,
          tf5mMomentumAlignment: multiTFConfluence.tf5mMomentumAlignment,
          tf1mMicrostructure: multiTFConfluence.tf1mMicrostructure,
          contextSource: multiTFConfluenceContext?.source,
        }
        : undefined,
      memoryContext: memoryContext || undefined,
      volumeTrend: indicatorContext?.volumeTrend ?? 'flat',
      minutesSinceOpen: indicatorContext?.minutesSinceOpen ?? undefined,
      emaFastSlope: indicatorContext?.emaFastSlope ?? undefined,
      microstructureSnapshot: (() => {
        const bar = getWorkingMicrobar('SPX', '5s');
        if (!bar) return null;
        return {
          deltaVolume: bar.deltaVolume,
          bidAskImbalance: bar.bidAskImbalance,
          avgSpreadBps: bar.avgSpreadBps,
          quoteCoveragePct: bar.quoteCoveragePct,
          buyVolume: bar.buyVolume,
          sellVolume: bar.sellVolume,
        };
      })(),
      orbFlowGraceApplied: (
        setupType === 'orb_breakout'
        && parseBooleanEnv(process.env.SPX_ORB_FLOW_GRACE_ENABLED, true)
        && emaAligned
        && confluenceScore >= ORB_GRACE_MIN_CONFLUENCE_SCORE
        && indicatorContext?.minutesSinceOpen != null
        && indicatorContext.minutesSinceOpen <= ORB_GRACE_MAX_FIRST_SEEN_MINUTE
      ) || undefined,
    };
  }));

  // Preserve recently active setups that dropped from the candidate list as expired.
  const setupIds = new Set(setups.map((setup) => setup.id));
  for (const previous of previousSetups || []) {
    if (matchedPreviousSetupIds.has(previous.id)) continue;
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

  const standbyGuidance = environmentGate
    ? buildStandbyGuidance({
      gate: environmentGate,
      setups: diversifiedSetups,
      asOfTimestamp: evaluationIso,
    })
    : null;
  const environmentAdjustedSetups = environmentGate
    ? applyEnvironmentGateToSetups({
      setups: diversifiedSetups,
      gate: environmentGate,
    })
    : diversifiedSetups;

  const rankedSetups = [...environmentAdjustedSetups]
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

  await persistEnvironmentState({
    state: environmentGate
      ? {
        asOf: evaluationIso,
        gate: environmentGate,
        standbyGuidance,
      }
      : emptyEnvironmentState(evaluationIso),
    shouldUseCache,
  });

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
    optimizerPausedSetupTypes: optimizationProfile.driftControl.pausedSetupTypes,
    optimizerPausedCombos: optimizationProfile.regimeGate.pausedCombos,
    invalidationReasons,
    lifecycleEnabled: lifecycleConfig.lifecycleEnabled,
    evTieringEnabled: scoringConfig.evTieringEnabled,
    environmentGateEnabled,
    environmentGatePassed: environmentGate?.passed ?? true,
    environmentGateReason: environmentGate?.reason ?? null,
    standbyGuidanceActive: standbyGuidance?.status === 'STANDBY',
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
  setupsInFlight = null;
  latestSetupEnvironmentState = null;
}

export const __testables = {
  detectVWAPReclaim,
  detectVWAPFade,
  buildVWAPSetupGeometry,
};
