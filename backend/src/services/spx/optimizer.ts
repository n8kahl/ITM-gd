import { cacheGet, cacheSet } from '../../config/redis';
import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import type { SetupStatus, SetupType } from './types';
import type { SetupFinalOutcome } from './outcomeTracker';
import { runSPXWinRateBacktest } from './winRateBacktest';

export interface SPXGeometryPolicyEntry {
  stopScale: number;
  target1Scale: number;
  target2Scale: number;
  t1MinR: number;
  t1MaxR: number;
  t2MinR: number;
  t2MaxR: number;
}

export interface SPXOptimizationProfile {
  source: 'default' | 'scan';
  generatedAt: string;
  qualityGate: {
    minConfluenceScore: number;
    minPWinCalibrated: number;
    minEvR: number;
    actionableStatuses: SetupStatus[];
  };
  flowGate: {
    requireFlowConfirmation: boolean;
    minAlignmentPct: number;
  };
  indicatorGate: {
    requireEmaAlignment: boolean;
    requireVolumeRegimeAlignment: boolean;
  };
  timingGate: {
    enabled: boolean;
    maxFirstSeenMinuteBySetupType: Record<string, number>;
  };
  regimeGate: {
    minTradesPerCombo: number;
    minT1WinRatePct: number;
    pausedCombos: string[];
  };
  tradeManagement: {
    partialAtT1Pct: number;
    moveStopToBreakeven: boolean;
  };
  geometryPolicy: {
    bySetupType: Record<string, SPXGeometryPolicyEntry>;
    bySetupRegime: Record<string, Partial<SPXGeometryPolicyEntry>>;
    bySetupRegimeTimeBucket: Record<string, Partial<SPXGeometryPolicyEntry>>;
  };
  walkForward: {
    trainingDays: number;
    validationDays: number;
    minTrades: number;
    objectiveWeights: {
      t1: number;
      t2: number;
      failurePenalty: number;
      expectancyR: number;
    };
  };
  driftControl: {
    enabled: boolean;
    shortWindowDays: number;
    longWindowDays: number;
    maxDropPct: number;
    minLongWindowTrades: number;
    autoQuarantineEnabled: boolean;
    triggerRateWindowDays: number;
    minQuarantineOpportunities: number;
    minTriggerRatePct: number;
    pausedSetupTypes: string[];
  };
}

export interface SPXOptimizationScanResult {
  profile: SPXOptimizationProfile;
  scorecard: SPXOptimizerScorecard;
}

export interface SPXConfidenceInterval {
  sampleSize: number;
  pointPct: number;
  lowerPct: number;
  upperPct: number;
}

export interface SPXOptimizerScorecard {
  generatedAt: string;
  scanRange: { from: string; to: string };
  trainingRange: { from: string; to: string };
  validationRange: { from: string; to: string };
  baseline: SPXOptimizationMetrics;
  optimized: SPXOptimizationMetrics;
  improvementPct: {
    t1WinRateDelta: number;
    t2WinRateDelta: number;
    objectiveDelta: number;
    objectiveConservativeDelta: number;
    expectancyRDelta: number;
  };
  driftAlerts: SPXDriftAlert[];
  setupTypePerformance: SPXPerformanceBucket[];
  setupComboPerformance: SPXPerformanceBucket[];
  setupActions: {
    add: string[];
    update: string[];
    remove: string[];
  };
  optimizationApplied: boolean;
  notes: string[];
}

export interface SPXOptimizationMetrics {
  tradeCount: number;
  resolvedCount: number;
  t1Wins: number;
  t2Wins: number;
  stopsBeforeT1: number;
  t1WinRatePct: number;
  t2WinRatePct: number;
  failureRatePct: number;
  expectancyR: number;
  expectancyLowerBoundR: number;
  positiveRealizedRatePct: number;
  objectiveScore: number;
  objectiveScoreConservative: number;
  t1Confidence95: SPXConfidenceInterval;
  t2Confidence95: SPXConfidenceInterval;
  failureConfidence95: SPXConfidenceInterval;
}

export interface SPXPerformanceBucket {
  key: string;
  tradeCount: number;
  resolvedCount: number;
  t1WinRatePct: number;
  t2WinRatePct: number;
  failureRatePct: number;
  t1Confidence95: SPXConfidenceInterval;
  t2Confidence95: SPXConfidenceInterval;
  failureConfidence95: SPXConfidenceInterval;
}

interface SPXDriftAlert {
  setupType: string;
  shortWindowDays: number;
  longWindowDays: number;
  shortT1WinRatePct: number;
  shortT1Lower95Pct: number;
  shortT1Upper95Pct: number;
  longT1WinRatePct: number;
  longT1Lower95Pct: number;
  longT1Upper95Pct: number;
  dropPct: number;
  confidenceDropPct: number;
  action: 'pause';
}

interface SPXTriggerRateQuarantineAlert {
  setupType: string;
  windowDays: number;
  opportunities: number;
  triggered: number;
  triggerRatePct: number;
  thresholdPct: number;
  action: 'pause';
}

interface OptimizationRow {
  engine_setup_id: string;
  session_date: string;
  setup_type: string;
  direction: 'bullish' | 'bearish' | null;
  regime: string | null;
  tier: string | null;
  first_seen_at: string | null;
  triggered_at: string | null;
  final_outcome: SetupFinalOutcome | null;
  stop_hit_at?: string | null;
  entry_zone_low: number | string | null;
  entry_zone_high: number | string | null;
  stop_price: number | string | null;
  target_1_price: number | string | null;
  target_2_price: number | string | null;
  entry_fill_price?: number | string | null;
  p_win_calibrated: number | string | null;
  ev_r: number | string | null;
  metadata: Record<string, unknown> | null;
}

interface OutcomeOverride {
  triggeredAt: string | null;
  finalOutcome: SetupFinalOutcome | null;
  entryFillPrice: number | null;
  stopHitAt: string | null;
}

interface PreparedOptimizationRow {
  sessionDate: string;
  setupType: string;
  regime: string;
  comboKey: string;
  tier: string | null;
  gateStatus: 'eligible' | 'blocked' | null;
  firstSeenAt: string | null;
  firstSeenMinuteEt: number | null;
  triggered: boolean;
  finalOutcome: SetupFinalOutcome | null;
  pWinCalibrated: number | null;
  evR: number | null;
  target1R: number | null;
  target2R: number | null;
  stopHit: boolean;
  moveStopToBreakeven: boolean;
  confluenceScore: number | null;
  flowAlignmentPct: number | null;
  flowConfirmed: boolean;
  emaAligned: boolean;
  volumeRegimeAligned: boolean;
}

interface ThresholdCandidate {
  requireFlowConfirmation: boolean;
  minConfluenceScore: number;
  minPWinCalibrated: number;
  minEvR: number;
  minAlignmentPct: number;
  requireEmaAlignment: boolean;
  requireVolumeRegimeAlignment: boolean;
  enforceTimingGate: boolean;
  partialAtT1Pct: number;
}

interface PersistedOptimizerStateRow {
  id: string;
  profile: unknown;
  scorecard: unknown;
  scan_range_from: string | null;
  scan_range_to: string | null;
  training_from: string | null;
  training_to: string | null;
  validation_from: string | null;
  validation_to: string | null;
  updated_at: string;
}

const OPTIMIZER_STATE_TABLE = 'spx_setup_optimizer_state';
const OPTIMIZER_STATE_ROW_ID = 'active';
const OPTIMIZER_PROFILE_CACHE_KEY = 'spx_command_center:optimizer_profile';
const OPTIMIZER_PROFILE_CACHE_TTL_SECONDS = 30;
const SESSION_OPEN_MINUTE_ET = 9 * 60 + 30;

const DEFAULT_MAX_FIRST_SEEN_MINUTE_BY_SETUP_TYPE: Record<SetupType, number> = {
  fade_at_wall: 300,
  breakout_vacuum: 360,
  mean_reversion: 330,
  trend_continuation: 390,
  orb_breakout: 180,
  trend_pullback: 360,
  flip_reclaim: 360,
};
const FALLBACK_GEOMETRY_POLICY_ENTRY: SPXGeometryPolicyEntry = {
  stopScale: 1,
  target1Scale: 1,
  target2Scale: 1,
  t1MinR: 1.0,
  t1MaxR: 2.2,
  t2MinR: 1.6,
  t2MaxR: 3.4,
};
const DEFAULT_GEOMETRY_BY_SETUP_TYPE: Record<SetupType, SPXGeometryPolicyEntry> = {
  fade_at_wall: {
    stopScale: 1,
    target1Scale: 0.95,
    target2Scale: 0.95,
    t1MinR: 1.0,
    t1MaxR: 1.7,
    t2MinR: 1.5,
    t2MaxR: 2.4,
  },
  breakout_vacuum: {
    stopScale: 1.04,
    target1Scale: 0.94,
    target2Scale: 0.92,
    t1MinR: 1.2,
    t1MaxR: 2.4,
    t2MinR: 1.9,
    t2MaxR: 3.8,
  },
  mean_reversion: {
    stopScale: 1,
    target1Scale: 0.95,
    target2Scale: 0.95,
    t1MinR: 1.1,
    t1MaxR: 1.85,
    t2MinR: 1.7,
    t2MaxR: 2.7,
  },
  trend_continuation: {
    stopScale: 1.02,
    target1Scale: 0.98,
    target2Scale: 0.96,
    t1MinR: 1.1,
    t1MaxR: 2.2,
    t2MinR: 1.7,
    t2MaxR: 3.3,
  },
  orb_breakout: {
    stopScale: 1.02,
    target1Scale: 0.96,
    target2Scale: 0.94,
    t1MinR: 1.1,
    t1MaxR: 2.3,
    t2MinR: 1.8,
    t2MaxR: 3.6,
  },
  trend_pullback: {
    stopScale: 1.02,
    target1Scale: 0.96,
    target2Scale: 0.94,
    t1MinR: 1.05,
    t1MaxR: 2.1,
    t2MinR: 1.6,
    t2MaxR: 3.2,
  },
  flip_reclaim: {
    stopScale: 1,
    target1Scale: 0.97,
    target2Scale: 0.95,
    t1MinR: 1.3,
    t1MaxR: 2.1,
    t2MinR: 2.0,
    t2MaxR: 3.0,
  },
};
const DEFAULT_GEOMETRY_BY_SETUP_REGIME: Record<string, Partial<SPXGeometryPolicyEntry>> = {
  'trend_pullback|breakout': {
    stopScale: 1.04,
    target1Scale: 0.94,
    target2Scale: 0.92,
  },
  'orb_breakout|breakout': {
    stopScale: 1.03,
    target1Scale: 0.95,
    target2Scale: 0.92,
  },
  'mean_reversion|ranging': {
    target1Scale: 0.97,
    target2Scale: 0.96,
  },
};
const DEFAULT_GEOMETRY_BY_SETUP_REGIME_TIME_BUCKET: Record<string, Partial<SPXGeometryPolicyEntry>> = {
  'trend_pullback|breakout|late': {
    stopScale: 1.06,
    target1Scale: 0.9,
    target2Scale: 0.88,
    t1MaxR: 1.8,
    t2MaxR: 2.8,
  },
  'orb_breakout|breakout|late': {
    stopScale: 1.06,
    target1Scale: 0.9,
    target2Scale: 0.88,
    t1MaxR: 1.85,
    t2MaxR: 2.9,
  },
  'mean_reversion|ranging|opening': {
    target1Scale: 0.99,
    target2Scale: 0.98,
  },
};

const DEFAULT_PROFILE: SPXOptimizationProfile = {
  source: 'default',
  generatedAt: new Date(0).toISOString(),
  qualityGate: {
    minConfluenceScore: 3,
    minPWinCalibrated: 0.62,
    minEvR: 0.2,
    actionableStatuses: ['ready', 'triggered'],
  },
  flowGate: {
    requireFlowConfirmation: false,
    minAlignmentPct: 0,
  },
  indicatorGate: {
    requireEmaAlignment: false,
    requireVolumeRegimeAlignment: false,
  },
  timingGate: {
    enabled: true,
    maxFirstSeenMinuteBySetupType: { ...DEFAULT_MAX_FIRST_SEEN_MINUTE_BY_SETUP_TYPE },
  },
  regimeGate: {
    minTradesPerCombo: 12,
    minT1WinRatePct: 48,
    pausedCombos: [],
  },
  tradeManagement: {
    partialAtT1Pct: 0.65,
    moveStopToBreakeven: true,
  },
  geometryPolicy: {
    bySetupType: { ...DEFAULT_GEOMETRY_BY_SETUP_TYPE },
    bySetupRegime: { ...DEFAULT_GEOMETRY_BY_SETUP_REGIME },
    bySetupRegimeTimeBucket: { ...DEFAULT_GEOMETRY_BY_SETUP_REGIME_TIME_BUCKET },
  },
  walkForward: {
    trainingDays: 20,
    validationDays: 5,
    minTrades: 12,
    objectiveWeights: {
      t1: 0.62,
      t2: 0.38,
      failurePenalty: 0.5,
      expectancyR: 14,
    },
  },
  driftControl: {
    enabled: true,
    shortWindowDays: 5,
    longWindowDays: 20,
    maxDropPct: 12,
    minLongWindowTrades: 20,
    autoQuarantineEnabled: true,
    triggerRateWindowDays: 20,
    minQuarantineOpportunities: 20,
    minTriggerRatePct: 3,
    pausedSetupTypes: ['breakout_vacuum'],
  },
};
const WEEKLY_AUTO_MIN_VALIDATION_TRADES = 12;
const WEEKLY_AUTO_MIN_OBJECTIVE_DELTA = 0.5;
const WEEKLY_AUTO_MAX_T2_DROP_PCT = 2;
const PROMOTION_MIN_T1_DELTA_PCT = 3;
const PROMOTION_MIN_T2_DELTA_PCT = 2;
const PROMOTION_MIN_EXPECTANCY_DELTA_R = 0.10;
const PROMOTION_MAX_FAILURE_DELTA_PCT = 1;
const WILSON_Z_95 = 1.96;
const ADD_SETUP_MIN_T1_LOWER_BOUND_PCT = 52;

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function clamp(value: number, min: number, max: number): number {
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

function normalizeGeometryPolicyEntry(
  raw: unknown,
  fallback: SPXGeometryPolicyEntry = FALLBACK_GEOMETRY_POLICY_ENTRY,
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
    Math.max(t1MinR + 0.2, 0.8),
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

function normalizeGeometryPolicyPatch(raw: unknown): Partial<SPXGeometryPolicyEntry> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const candidate = raw as Record<string, unknown>;
  const patch: Partial<SPXGeometryPolicyEntry> = {};
  const stopScale = toFiniteNumber(candidate.stopScale);
  const target1Scale = toFiniteNumber(candidate.target1Scale);
  const target2Scale = toFiniteNumber(candidate.target2Scale);
  const t1MinR = toFiniteNumber(candidate.t1MinR);
  const t1MaxR = toFiniteNumber(candidate.t1MaxR);
  const t2MinR = toFiniteNumber(candidate.t2MinR);
  const t2MaxR = toFiniteNumber(candidate.t2MaxR);
  if (stopScale != null) patch.stopScale = round(clamp(stopScale, 0.75, 1.4), 4);
  if (target1Scale != null) patch.target1Scale = round(clamp(target1Scale, 0.7, 1.3), 4);
  if (target2Scale != null) patch.target2Scale = round(clamp(target2Scale, 0.7, 1.4), 4);
  if (t1MinR != null) patch.t1MinR = round(clamp(t1MinR, 0.6, 3.5), 4);
  if (t1MaxR != null) patch.t1MaxR = round(clamp(t1MaxR, 0.7, 4.5), 4);
  if (t2MinR != null) patch.t2MinR = round(clamp(t2MinR, 0.8, 4.2), 4);
  if (t2MaxR != null) patch.t2MaxR = round(clamp(t2MaxR, 0.9, 6), 4);
  return patch;
}

function normalizeGeometryPolicyMap(
  raw: unknown,
): Record<string, SPXGeometryPolicyEntry> {
  const normalized: Record<string, SPXGeometryPolicyEntry> = Object.fromEntries(
    Object.entries(DEFAULT_GEOMETRY_BY_SETUP_TYPE).map(([key, value]) => [key, { ...value }]),
  );
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return normalized;
  }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const fallback = normalized[key] || FALLBACK_GEOMETRY_POLICY_ENTRY;
    normalized[key] = normalizeGeometryPolicyEntry(value, fallback);
  }
  return normalized;
}

function normalizeGeometryPolicyPatchMap(
  raw: unknown,
  defaults: Record<string, Partial<SPXGeometryPolicyEntry>>,
): Record<string, Partial<SPXGeometryPolicyEntry>> {
  const normalized: Record<string, Partial<SPXGeometryPolicyEntry>> = Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [key, { ...value }]),
  );
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return normalized;
  }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const patch = normalizeGeometryPolicyPatch(value);
    if (Object.keys(patch).length === 0) continue;
    normalized[key] = {
      ...(normalized[key] || {}),
      ...patch,
    };
  }
  return normalized;
}

function emptyConfidenceInterval(): SPXConfidenceInterval {
  return {
    sampleSize: 0,
    pointPct: 0,
    lowerPct: 0,
    upperPct: 100,
  };
}

function wilsonIntervalPct(successes: number, sampleSize: number, z = WILSON_Z_95): SPXConfidenceInterval {
  if (sampleSize <= 0) {
    return emptyConfidenceInterval();
  }

  const p = successes / sampleSize;
  const z2 = z * z;
  const denominator = 1 + (z2 / sampleSize);
  const center = (p + (z2 / (2 * sampleSize))) / denominator;
  const margin = (
    z
    * Math.sqrt(
      ((p * (1 - p)) / sampleSize)
      + (z2 / (4 * sampleSize * sampleSize)),
    )
  ) / denominator;

  return {
    sampleSize,
    pointPct: round(p * 100, 2),
    lowerPct: round(Math.max(0, (center - margin) * 100), 2),
    upperPct: round(Math.min(100, (center + margin) * 100), 2),
  };
}

function toSessionMinuteEt(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const et = toEasternTime(new Date(parsed));
  return Math.max(0, (et.hour * 60 + et.minute) - SESSION_OPEN_MINUTE_ET);
}

function normalizeTimingMap(
  value: unknown,
): Record<string, number> {
  const fallback = DEFAULT_MAX_FIRST_SEEN_MINUTE_BY_SETUP_TYPE;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...fallback };
  }

  const source = value as Record<string, unknown>;
  const merged: Record<string, number> = { ...fallback };
  for (const [key, raw] of Object.entries(source)) {
    const numeric = toFiniteNumber(raw);
    if (numeric == null) continue;
    merged[key] = Math.max(30, Math.min(390, Math.round(numeric)));
  }
  return merged;
}

function maxFirstSeenMinuteForSetup(
  setupType: string,
  timingMap: Record<string, number>,
): number {
  const raw = timingMap[setupType];
  if (Number.isFinite(raw)) return raw;
  return 390;
}

function isMissingTableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('could not find the table') || normalized.includes('does not exist');
}

function normalizeDateInput(value: string): string {
  return value.trim().slice(0, 10);
}

function shiftDate(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function dateDaysAgoET(days: number): string {
  return toEasternTime(new Date(Date.now() - (days * 86400000))).dateStr;
}

function defaultScanRange(profile: SPXOptimizationProfile): { from: string; to: string } {
  const to = dateDaysAgoET(1);
  const historyDays = profile.walkForward.trainingDays + profile.walkForward.validationDays - 1;
  return {
    from: shiftDate(to, -historyDays),
    to,
  };
}

function normalizeProfile(raw: unknown): SPXOptimizationProfile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...DEFAULT_PROFILE,
      generatedAt: new Date().toISOString(),
    };
  }

  const candidate = raw as Partial<SPXOptimizationProfile>;
  const normalized: SPXOptimizationProfile = {
    source: candidate.source === 'scan' ? 'scan' : 'default',
    generatedAt: typeof candidate.generatedAt === 'string' ? candidate.generatedAt : new Date().toISOString(),
    qualityGate: {
      minConfluenceScore: toFiniteNumber(candidate.qualityGate?.minConfluenceScore) ?? DEFAULT_PROFILE.qualityGate.minConfluenceScore,
      minPWinCalibrated: toFiniteNumber(candidate.qualityGate?.minPWinCalibrated) ?? DEFAULT_PROFILE.qualityGate.minPWinCalibrated,
      minEvR: toFiniteNumber(candidate.qualityGate?.minEvR) ?? DEFAULT_PROFILE.qualityGate.minEvR,
      actionableStatuses: Array.isArray(candidate.qualityGate?.actionableStatuses)
        ? candidate.qualityGate.actionableStatuses.filter((status): status is SetupStatus => (
          status === 'ready' || status === 'triggered' || status === 'forming' || status === 'invalidated' || status === 'expired'
        ))
        : DEFAULT_PROFILE.qualityGate.actionableStatuses,
    },
    flowGate: {
      requireFlowConfirmation: candidate.flowGate?.requireFlowConfirmation !== false,
      minAlignmentPct: toFiniteNumber(candidate.flowGate?.minAlignmentPct) ?? DEFAULT_PROFILE.flowGate.minAlignmentPct,
    },
    indicatorGate: {
      requireEmaAlignment: candidate.indicatorGate?.requireEmaAlignment === true,
      requireVolumeRegimeAlignment: candidate.indicatorGate?.requireVolumeRegimeAlignment === true,
    },
    timingGate: {
      enabled: candidate.timingGate?.enabled !== false,
      maxFirstSeenMinuteBySetupType: normalizeTimingMap(candidate.timingGate?.maxFirstSeenMinuteBySetupType),
    },
    regimeGate: {
      minTradesPerCombo: Math.max(1, Math.floor(toFiniteNumber(candidate.regimeGate?.minTradesPerCombo) ?? DEFAULT_PROFILE.regimeGate.minTradesPerCombo)),
      minT1WinRatePct: toFiniteNumber(candidate.regimeGate?.minT1WinRatePct) ?? DEFAULT_PROFILE.regimeGate.minT1WinRatePct,
      pausedCombos: Array.isArray(candidate.regimeGate?.pausedCombos)
        ? candidate.regimeGate.pausedCombos.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [],
    },
    tradeManagement: {
      partialAtT1Pct: Math.min(0.9, Math.max(
        0.1,
        toFiniteNumber(candidate.tradeManagement?.partialAtT1Pct) ?? DEFAULT_PROFILE.tradeManagement.partialAtT1Pct,
      )),
      moveStopToBreakeven: candidate.tradeManagement?.moveStopToBreakeven !== false,
    },
    geometryPolicy: {
      bySetupType: normalizeGeometryPolicyMap(candidate.geometryPolicy?.bySetupType),
      bySetupRegime: normalizeGeometryPolicyPatchMap(
        candidate.geometryPolicy?.bySetupRegime,
        DEFAULT_GEOMETRY_BY_SETUP_REGIME,
      ),
      bySetupRegimeTimeBucket: normalizeGeometryPolicyPatchMap(
        candidate.geometryPolicy?.bySetupRegimeTimeBucket,
        DEFAULT_GEOMETRY_BY_SETUP_REGIME_TIME_BUCKET,
      ),
    },
    walkForward: {
      trainingDays: Math.max(5, Math.floor(toFiniteNumber(candidate.walkForward?.trainingDays) ?? DEFAULT_PROFILE.walkForward.trainingDays)),
      validationDays: Math.max(3, Math.floor(toFiniteNumber(candidate.walkForward?.validationDays) ?? DEFAULT_PROFILE.walkForward.validationDays)),
      minTrades: Math.max(5, Math.floor(toFiniteNumber(candidate.walkForward?.minTrades) ?? DEFAULT_PROFILE.walkForward.minTrades)),
      objectiveWeights: {
        t1: toFiniteNumber(candidate.walkForward?.objectiveWeights?.t1) ?? DEFAULT_PROFILE.walkForward.objectiveWeights.t1,
        t2: toFiniteNumber(candidate.walkForward?.objectiveWeights?.t2) ?? DEFAULT_PROFILE.walkForward.objectiveWeights.t2,
        failurePenalty: toFiniteNumber(candidate.walkForward?.objectiveWeights?.failurePenalty)
          ?? DEFAULT_PROFILE.walkForward.objectiveWeights.failurePenalty,
        expectancyR: toFiniteNumber(candidate.walkForward?.objectiveWeights?.expectancyR)
          ?? DEFAULT_PROFILE.walkForward.objectiveWeights.expectancyR,
      },
    },
    driftControl: {
      enabled: candidate.driftControl?.enabled !== false,
      shortWindowDays: Math.max(3, Math.floor(toFiniteNumber(candidate.driftControl?.shortWindowDays) ?? DEFAULT_PROFILE.driftControl.shortWindowDays)),
      longWindowDays: Math.max(10, Math.floor(toFiniteNumber(candidate.driftControl?.longWindowDays) ?? DEFAULT_PROFILE.driftControl.longWindowDays)),
      maxDropPct: toFiniteNumber(candidate.driftControl?.maxDropPct) ?? DEFAULT_PROFILE.driftControl.maxDropPct,
      minLongWindowTrades: Math.max(10, Math.floor(
        toFiniteNumber(candidate.driftControl?.minLongWindowTrades) ?? DEFAULT_PROFILE.driftControl.minLongWindowTrades,
      )),
      autoQuarantineEnabled: candidate.driftControl?.autoQuarantineEnabled !== false,
      triggerRateWindowDays: Math.max(5, Math.floor(
        toFiniteNumber(candidate.driftControl?.triggerRateWindowDays) ?? DEFAULT_PROFILE.driftControl.triggerRateWindowDays,
      )),
      minQuarantineOpportunities: Math.max(5, Math.floor(
        toFiniteNumber(candidate.driftControl?.minQuarantineOpportunities) ?? DEFAULT_PROFILE.driftControl.minQuarantineOpportunities,
      )),
      minTriggerRatePct: Math.max(0, Math.min(100,
        toFiniteNumber(candidate.driftControl?.minTriggerRatePct) ?? DEFAULT_PROFILE.driftControl.minTriggerRatePct,
      )),
      pausedSetupTypes: Array.isArray(candidate.driftControl?.pausedSetupTypes)
        ? candidate.driftControl.pausedSetupTypes.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [],
    },
  };

  const legacyWeightShape = (
    Math.abs(normalized.walkForward.objectiveWeights.t1 - 0.6) < 0.0001
    && Math.abs(normalized.walkForward.objectiveWeights.t2 - 0.4) < 0.0001
    && Math.abs(normalized.walkForward.objectiveWeights.failurePenalty - 0.45) < 0.0001
  );
  if (legacyWeightShape) {
    normalized.walkForward.objectiveWeights = {
      ...DEFAULT_PROFILE.walkForward.objectiveWeights,
    };
  }
  const legacyPartialShape = Math.abs(normalized.tradeManagement.partialAtT1Pct - 0.5) < 0.0001;
  if (legacyPartialShape) {
    normalized.tradeManagement.partialAtT1Pct = DEFAULT_PROFILE.tradeManagement.partialAtT1Pct;
  }

  return normalized;
}

function toMetadataObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toPreparedRow(row: OptimizationRow): PreparedOptimizationRow {
  const metadata = toMetadataObject(row.metadata);
  const confluenceScore = toFiniteNumber(metadata.confluenceScore);
  const flowAlignmentPct = toFiniteNumber(metadata.flowAlignmentPct) ?? toFiniteNumber(metadata.alignmentScore);
  const flowConfirmed = metadata.flowConfirmed === true;
  const confluenceSources = Array.isArray(metadata.confluenceSources)
    ? metadata.confluenceSources.filter((item): item is string => typeof item === 'string')
    : [];
  const tradeManagement = (
    metadata.tradeManagement
    && typeof metadata.tradeManagement === 'object'
    && !Array.isArray(metadata.tradeManagement)
  )
    ? metadata.tradeManagement as Record<string, unknown>
    : null;
  const moveStopToBreakeven = typeof tradeManagement?.moveStopToBreakeven === 'boolean'
    ? tradeManagement.moveStopToBreakeven
    : true;
  const gateStatusRaw = metadata.gateStatus;
  const gateStatus = gateStatusRaw === 'blocked'
    ? 'blocked'
    : gateStatusRaw === 'eligible'
      ? 'eligible'
      : null;
  const emaAligned = metadata.emaAligned === true || confluenceSources.includes('ema_alignment');
  const volumeRegimeAligned = metadata.volumeRegimeAligned === true || confluenceSources.includes('volume_regime_alignment');
  const regime = typeof row.regime === 'string' && row.regime.length > 0 ? row.regime : 'unknown';
  const setupType = typeof row.setup_type === 'string' && row.setup_type.length > 0 ? row.setup_type : 'unknown';
  const entryLow = toFiniteNumber(row.entry_zone_low);
  const entryHigh = toFiniteNumber(row.entry_zone_high);
  const stopPrice = toFiniteNumber(row.stop_price);
  const target1Price = toFiniteNumber(row.target_1_price);
  const target2Price = toFiniteNumber(row.target_2_price);
  const entryMid = entryLow != null && entryHigh != null
    ? (entryLow + entryHigh) / 2
    : null;
  const entryFillPrice = toFiniteNumber(row.entry_fill_price);
  const entryPrice = entryFillPrice ?? entryMid;

  let target1R: number | null = null;
  let target2R: number | null = null;
  if (entryPrice != null && stopPrice != null && target1Price != null) {
    const riskR = Math.max(0.25, Math.abs(entryPrice - stopPrice));
    target1R = Math.abs(target1Price - entryPrice) / riskR;
    target2R = target2Price != null
      ? Math.abs(target2Price - entryPrice) / riskR
      : target1R;
  }

  return {
    sessionDate: row.session_date,
    setupType,
    regime,
    comboKey: `${setupType}|${regime}`,
    tier: typeof row.tier === 'string' ? row.tier : null,
    gateStatus,
    firstSeenAt: row.first_seen_at,
    firstSeenMinuteEt: toSessionMinuteEt(row.first_seen_at),
    triggered: typeof row.triggered_at === 'string' && row.triggered_at.length > 0,
    finalOutcome: row.final_outcome,
    pWinCalibrated: toFiniteNumber(row.p_win_calibrated),
    evR: toFiniteNumber(row.ev_r),
    target1R: target1R != null ? round(target1R, 4) : null,
    target2R: target2R != null ? round(target2R, 4) : null,
    stopHit: typeof row.stop_hit_at === 'string' && row.stop_hit_at.length > 0,
    moveStopToBreakeven,
    confluenceScore,
    flowAlignmentPct,
    flowConfirmed,
    emaAligned,
    volumeRegimeAligned,
  };
}

function optimizationRowKey(engineSetupId: string, sessionDate: string): string {
  return `${engineSetupId}:${sessionDate}`;
}

async function loadOutcomeOverridesFromBacktest(from: string, to: string): Promise<Map<string, OutcomeOverride>> {
  try {
    const backtest = await runSPXWinRateBacktest({
      from,
      to,
      source: 'spx_setup_instances',
      resolution: 'second',
      includeRows: true,
      includePausedSetups: true,
    });

    const map = new Map<string, OutcomeOverride>();
    for (const row of backtest.rows || []) {
      const key = optimizationRowKey(row.engine_setup_id, row.session_date);
      map.set(key, {
        triggeredAt: row.triggered_at,
        finalOutcome: row.final_outcome,
        entryFillPrice: toFiniteNumber((row as Record<string, unknown>).entry_fill_price),
        stopHitAt: typeof (row as Record<string, unknown>).stop_hit_at === 'string'
          ? (row as Record<string, unknown>).stop_hit_at as string
          : null,
      });
    }

    return map;
  } catch (error) {
    logger.warn('SPX optimizer failed to load outcome overrides from backtest', {
      from,
      to,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Map();
  }
}

function emptyMetrics(): SPXOptimizationMetrics {
  return {
    tradeCount: 0,
    resolvedCount: 0,
    t1Wins: 0,
    t2Wins: 0,
    stopsBeforeT1: 0,
    t1WinRatePct: 0,
    t2WinRatePct: 0,
    failureRatePct: 0,
    expectancyR: 0,
    expectancyLowerBoundR: 0,
    positiveRealizedRatePct: 0,
    objectiveScore: 0,
    objectiveScoreConservative: 0,
    t1Confidence95: emptyConfidenceInterval(),
    t2Confidence95: emptyConfidenceInterval(),
    failureConfidence95: emptyConfidenceInterval(),
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function confidenceLowerBoundMean(values: number[], z = WILSON_Z_95): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const avg = mean(values);
  const stdev = standardDeviation(values);
  const margin = z * (stdev / Math.sqrt(values.length));
  return avg - margin;
}

function realizedRForOutcome(
  row: PreparedOptimizationRow,
  partialAtT1Pct: number,
  commissionR = 0.04,
): number | null {
  if (!row.finalOutcome) return null;
  const target1R = row.target1R;
  const target2R = row.target2R ?? target1R;
  if (target1R == null || !Number.isFinite(target1R)) return null;

  if (row.finalOutcome === 't2_before_stop') {
    const runnerR = target2R != null && Number.isFinite(target2R) ? target2R : target1R;
    return (partialAtT1Pct * target1R) + ((1 - partialAtT1Pct) * runnerR) - commissionR;
  }
  if (row.finalOutcome === 't1_before_stop') {
    const runnerR = row.stopHit
      ? (row.moveStopToBreakeven ? 0 : -1)
      : 0;
    return (partialAtT1Pct * target1R) + ((1 - partialAtT1Pct) * runnerR) - commissionR;
  }
  if (row.finalOutcome === 'stop_before_t1') {
    return -1 - commissionR;
  }
  if (row.finalOutcome === 'expired_unresolved') {
    return -commissionR;
  }
  return null;
}

function toMetrics(
  rows: PreparedOptimizationRow[],
  weights: SPXOptimizationProfile['walkForward']['objectiveWeights'],
  candidate: Pick<ThresholdCandidate, 'partialAtT1Pct'>,
): SPXOptimizationMetrics {
  const metrics = emptyMetrics();
  const realizedRows: number[] = [];

  for (const row of rows) {
    if (!row.triggered) continue;
    metrics.tradeCount += 1;

    if (!row.finalOutcome) continue;
    metrics.resolvedCount += 1;

    if (row.finalOutcome === 't2_before_stop') {
      metrics.t2Wins += 1;
      metrics.t1Wins += 1;
    } else if (row.finalOutcome === 't1_before_stop') {
      metrics.t1Wins += 1;
    } else if (row.finalOutcome === 'stop_before_t1') {
      metrics.stopsBeforeT1 += 1;
    }

    const realized = realizedRForOutcome(row, candidate.partialAtT1Pct);
    if (realized != null && Number.isFinite(realized)) {
      realizedRows.push(realized);
    }
  }

  const denominator = metrics.resolvedCount;
  metrics.t1WinRatePct = denominator > 0 ? round((metrics.t1Wins / denominator) * 100, 2) : 0;
  metrics.t2WinRatePct = denominator > 0 ? round((metrics.t2Wins / denominator) * 100, 2) : 0;
  metrics.failureRatePct = denominator > 0 ? round((metrics.stopsBeforeT1 / denominator) * 100, 2) : 0;
  metrics.expectancyR = realizedRows.length > 0 ? round(mean(realizedRows), 4) : 0;
  metrics.expectancyLowerBoundR = realizedRows.length > 0
    ? round(confidenceLowerBoundMean(realizedRows), 4)
    : 0;
  metrics.positiveRealizedRatePct = realizedRows.length > 0
    ? round((realizedRows.filter((value) => value > 0).length / realizedRows.length) * 100, 2)
    : 0;
  metrics.t1Confidence95 = wilsonIntervalPct(metrics.t1Wins, denominator);
  metrics.t2Confidence95 = wilsonIntervalPct(metrics.t2Wins, denominator);
  metrics.failureConfidence95 = wilsonIntervalPct(metrics.stopsBeforeT1, denominator);
  metrics.objectiveScore = round(
    (metrics.t1WinRatePct * weights.t1)
    + (metrics.t2WinRatePct * weights.t2)
    - (metrics.failureRatePct * weights.failurePenalty),
    2,
  ) + round(metrics.expectancyR * weights.expectancyR, 2);
  metrics.objectiveScore = round(metrics.objectiveScore, 2);
  metrics.objectiveScoreConservative = denominator > 0
    ? round(
      (metrics.t1Confidence95.lowerPct * weights.t1)
      + (metrics.t2Confidence95.lowerPct * weights.t2)
      - (metrics.failureConfidence95.upperPct * weights.failurePenalty)
      + (metrics.expectancyLowerBoundR * weights.expectancyR),
      2,
    )
    : round(metrics.expectancyLowerBoundR * weights.expectancyR, 2);

  return metrics;
}

function candidateGrid(): ThresholdCandidate[] {
  const candidates: ThresholdCandidate[] = [];
  const alignmentGridByFlowGate: Record<'true' | 'false', number[]> = {
    true: [52, 55, 58, 60],
    false: [0],
  };
  const partialTakeGrid = [0.35, 0.5, 0.65, 0.7, 0.8];
  for (const minConfluenceScore of [3, 4, 5]) {
    for (const minPWinCalibrated of [0.58, 0.6, 0.62, 0.64]) {
      for (const minEvR of [0.18, 0.22, 0.25, 0.3, 0.35, 0.4]) {
        for (const requireFlowConfirmation of [true, false]) {
          for (const minAlignmentPct of alignmentGridByFlowGate[String(requireFlowConfirmation) as 'true' | 'false']) {
            for (const requireEmaAlignment of [false, true]) {
              for (const requireVolumeRegimeAlignment of [false, true]) {
                for (const enforceTimingGate of [true, false]) {
                  for (const partialAtT1Pct of partialTakeGrid) {
                    candidates.push({
                      requireFlowConfirmation,
                      minConfluenceScore,
                      minPWinCalibrated,
                      minEvR,
                      minAlignmentPct,
                      requireEmaAlignment,
                      requireVolumeRegimeAlignment,
                      enforceTimingGate,
                      partialAtT1Pct,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return candidates;
}

function passesCandidate(
  row: PreparedOptimizationRow,
  candidate: ThresholdCandidate,
  input: {
    pausedSetupTypes?: Set<string>;
    pausedCombos?: Set<string>;
    timingMap?: Record<string, number>;
  },
): boolean {
  if (!row.triggered) return false;
  if (row.tier === 'hidden') return false;
  if (row.gateStatus === 'blocked') return false;
  if (input.pausedSetupTypes?.has(row.setupType)) return false;
  if (input.pausedCombos?.has(row.comboKey)) return false;
  if (candidate.enforceTimingGate && row.firstSeenMinuteEt != null) {
    const maxMinute = maxFirstSeenMinuteForSetup(
      row.setupType,
      input.timingMap || DEFAULT_MAX_FIRST_SEEN_MINUTE_BY_SETUP_TYPE,
    );
    if (row.firstSeenMinuteEt > maxMinute) return false;
  }

  if ((row.confluenceScore ?? -1) < candidate.minConfluenceScore) return false;
  if ((row.pWinCalibrated ?? -1) < candidate.minPWinCalibrated) return false;
  if ((row.evR ?? Number.NEGATIVE_INFINITY) < candidate.minEvR) return false;

  if (candidate.requireFlowConfirmation) {
    if (!row.flowConfirmed) return false;
    if ((row.flowAlignmentPct ?? -1) < candidate.minAlignmentPct) return false;
  }
  if (candidate.requireEmaAlignment && !row.emaAligned) return false;
  if (candidate.requireVolumeRegimeAlignment && !row.volumeRegimeAligned) return false;

  return true;
}

function passesCandidateOpportunity(
  row: PreparedOptimizationRow,
  candidate: ThresholdCandidate,
  input: {
    pausedSetupTypes?: Set<string>;
    pausedCombos?: Set<string>;
    timingMap?: Record<string, number>;
  },
): boolean {
  if (row.tier === 'hidden') return false;
  if (row.gateStatus === 'blocked') return false;
  if (input.pausedSetupTypes?.has(row.setupType)) return false;
  if (input.pausedCombos?.has(row.comboKey)) return false;
  if (candidate.enforceTimingGate && row.firstSeenMinuteEt != null) {
    const maxMinute = maxFirstSeenMinuteForSetup(
      row.setupType,
      input.timingMap || DEFAULT_MAX_FIRST_SEEN_MINUTE_BY_SETUP_TYPE,
    );
    if (row.firstSeenMinuteEt > maxMinute) return false;
  }

  if ((row.confluenceScore ?? -1) < candidate.minConfluenceScore) return false;
  if ((row.pWinCalibrated ?? -1) < candidate.minPWinCalibrated) return false;
  if ((row.evR ?? Number.NEGATIVE_INFINITY) < candidate.minEvR) return false;

  if (candidate.requireFlowConfirmation) {
    if (!row.flowConfirmed) return false;
    if ((row.flowAlignmentPct ?? -1) < candidate.minAlignmentPct) return false;
  }
  if (candidate.requireEmaAlignment && !row.emaAligned) return false;
  if (candidate.requireVolumeRegimeAlignment && !row.volumeRegimeAligned) return false;

  return true;
}

function evaluateBuckets(
  rows: PreparedOptimizationRow[],
  keySelector: (row: PreparedOptimizationRow) => string,
  weights: SPXOptimizationProfile['walkForward']['objectiveWeights'],
  partialAtT1Pct: number,
): SPXPerformanceBucket[] {
  const byKey = new Map<string, PreparedOptimizationRow[]>();

  for (const row of rows) {
    if (!row.triggered) continue;
    const key = keySelector(row);
    const list = byKey.get(key) || [];
    list.push(row);
    byKey.set(key, list);
  }

  return Array.from(byKey.entries())
    .map(([key, keyRows]) => {
      const metrics = toMetrics(keyRows, weights, { partialAtT1Pct });
      return {
        key,
        tradeCount: metrics.tradeCount,
        resolvedCount: metrics.resolvedCount,
        t1WinRatePct: metrics.t1WinRatePct,
        t2WinRatePct: metrics.t2WinRatePct,
        failureRatePct: metrics.failureRatePct,
        t1Confidence95: metrics.t1Confidence95,
        t2Confidence95: metrics.t2Confidence95,
        failureConfidence95: metrics.failureConfidence95,
      };
    })
    .sort((a, b) => b.tradeCount - a.tradeCount || a.key.localeCompare(b.key));
}

function resolvePausedCombos(
  comboBuckets: SPXPerformanceBucket[],
  profile: SPXOptimizationProfile,
): string[] {
  return comboBuckets
    .filter((bucket) => (
      bucket.tradeCount >= profile.regimeGate.minTradesPerCombo
      && bucket.t1WinRatePct < profile.regimeGate.minT1WinRatePct
      && bucket.t1Confidence95.upperPct < profile.regimeGate.minT1WinRatePct
    ))
    .map((bucket) => bucket.key)
    .sort();
}

function resolveDriftAlerts(
  rows: PreparedOptimizationRow[],
  profile: SPXOptimizationProfile,
  toDate: string,
  partialAtT1Pct: number,
): SPXDriftAlert[] {
  if (!profile.driftControl.enabled) return [];

  const shortFrom = shiftDate(toDate, -(profile.driftControl.shortWindowDays - 1));
  const longFrom = shiftDate(toDate, -(profile.driftControl.longWindowDays - 1));
  const setupTypes = Array.from(new Set(rows.map((row) => row.setupType))).sort();
  const alerts: SPXDriftAlert[] = [];

  for (const setupType of setupTypes) {
    const shortRows = rows.filter((row) => row.setupType === setupType && row.sessionDate >= shortFrom);
    const longRows = rows.filter((row) => row.setupType === setupType && row.sessionDate >= longFrom);

    const shortMetrics = toMetrics(shortRows, profile.walkForward.objectiveWeights, { partialAtT1Pct });
    const longMetrics = toMetrics(longRows, profile.walkForward.objectiveWeights, { partialAtT1Pct });
    if (longMetrics.tradeCount < profile.driftControl.minLongWindowTrades) continue;
    if (shortMetrics.tradeCount < Math.max(3, profile.walkForward.validationDays)) continue;

    const drop = round(longMetrics.t1WinRatePct - shortMetrics.t1WinRatePct, 2);
    const confidenceDrop = round(longMetrics.t1Confidence95.lowerPct - shortMetrics.t1Confidence95.upperPct, 2);
    if (drop < profile.driftControl.maxDropPct) continue;
    if (confidenceDrop <= 0) continue;

    alerts.push({
      setupType,
      shortWindowDays: profile.driftControl.shortWindowDays,
      longWindowDays: profile.driftControl.longWindowDays,
      shortT1WinRatePct: shortMetrics.t1WinRatePct,
      shortT1Lower95Pct: shortMetrics.t1Confidence95.lowerPct,
      shortT1Upper95Pct: shortMetrics.t1Confidence95.upperPct,
      longT1WinRatePct: longMetrics.t1WinRatePct,
      longT1Lower95Pct: longMetrics.t1Confidence95.lowerPct,
      longT1Upper95Pct: longMetrics.t1Confidence95.upperPct,
      dropPct: drop,
      confidenceDropPct: confidenceDrop,
      action: 'pause',
    });
  }

  return alerts;
}

function resolveTriggerRateQuarantines(
  rows: PreparedOptimizationRow[],
  profile: SPXOptimizationProfile,
  toDate: string,
): SPXTriggerRateQuarantineAlert[] {
  if (!profile.driftControl.enabled || !profile.driftControl.autoQuarantineEnabled) return [];

  const windowDays = profile.driftControl.triggerRateWindowDays;
  const from = shiftDate(toDate, -(windowDays - 1));
  const bySetupType = new Map<string, { opportunities: number; triggered: number }>();

  for (const row of rows) {
    if (row.sessionDate < from) continue;
    const bucket = bySetupType.get(row.setupType) || { opportunities: 0, triggered: 0 };
    bucket.opportunities += 1;
    if (row.triggered) {
      bucket.triggered += 1;
    }
    bySetupType.set(row.setupType, bucket);
  }

  const alerts: SPXTriggerRateQuarantineAlert[] = [];
  for (const [setupType, bucket] of bySetupType.entries()) {
    if (bucket.opportunities < profile.driftControl.minQuarantineOpportunities) continue;
    const triggerRatePct = bucket.opportunities > 0
      ? round((bucket.triggered / bucket.opportunities) * 100, 2)
      : 0;
    if (triggerRatePct > profile.driftControl.minTriggerRatePct) continue;
    alerts.push({
      setupType,
      windowDays,
      opportunities: bucket.opportunities,
      triggered: bucket.triggered,
      triggerRatePct,
      thresholdPct: profile.driftControl.minTriggerRatePct,
      action: 'pause',
    });
  }

  return alerts.sort((a, b) => {
    if (a.triggerRatePct !== b.triggerRatePct) return a.triggerRatePct - b.triggerRatePct;
    return b.opportunities - a.opportunities;
  });
}

function buildSetupActionRecommendations(input: {
  setupTypeBuckets: SPXPerformanceBucket[];
  setupComboBuckets: SPXPerformanceBucket[];
  pausedCombos: string[];
  driftAlerts: SPXDriftAlert[];
  triggerRateQuarantines: SPXTriggerRateQuarantineAlert[];
  baselineCandidate: ThresholdCandidate;
  optimizedCandidate: ThresholdCandidate;
  toDate: string;
  profile: SPXOptimizationProfile;
  rows: PreparedOptimizationRow[];
}): { add: string[]; update: string[]; remove: string[] } {
  const remove = new Set<string>();
  const add = new Set<string>();
  const update = new Set<string>();
  const comboBucketByKey = new Map(input.setupComboBuckets.map((bucket) => [bucket.key, bucket]));

  for (const combo of input.pausedCombos) {
    const comboMetrics = comboBucketByKey.get(combo);
    if (comboMetrics) {
      remove.add(
        `Pause ${combo}: T1 ${comboMetrics.t1WinRatePct}% (95% CI ${comboMetrics.t1Confidence95.lowerPct}-${comboMetrics.t1Confidence95.upperPct}) remains below floor ${input.profile.regimeGate.minT1WinRatePct}%.`,
      );
    } else {
      remove.add(`Pause ${combo}: T1 win rate below ${input.profile.regimeGate.minT1WinRatePct}% with sufficient sample.`);
    }
  }

  for (const alert of input.driftAlerts) {
    remove.add(
      `Pause ${alert.setupType}: ${alert.shortWindowDays}d T1 ${alert.shortT1WinRatePct}% (95% CI ${alert.shortT1Lower95Pct}-${alert.shortT1Upper95Pct}) dropped ${alert.dropPct} pts vs ${alert.longWindowDays}d baseline ${alert.longT1WinRatePct}% (95% CI ${alert.longT1Lower95Pct}-${alert.longT1Upper95Pct}).`,
    );
  }
  for (const alert of input.triggerRateQuarantines) {
    remove.add(
      `Pause ${alert.setupType}: trigger rate ${alert.triggerRatePct}% (${alert.triggered}/${alert.opportunities}) over ${alert.windowDays}d is below quarantine floor ${alert.thresholdPct}%.`,
    );
  }

  if (input.optimizedCandidate.minConfluenceScore !== input.baselineCandidate.minConfluenceScore) {
    update.add(`Quality gate: set confluence >= ${input.optimizedCandidate.minConfluenceScore}.`);
  }
  if (input.optimizedCandidate.minPWinCalibrated !== input.baselineCandidate.minPWinCalibrated) {
    update.add(`Quality gate: set pWin >= ${input.optimizedCandidate.minPWinCalibrated.toFixed(2)}.`);
  }
  if (input.optimizedCandidate.minEvR !== input.baselineCandidate.minEvR) {
    update.add(`Quality gate: set EV(R) >= ${input.optimizedCandidate.minEvR.toFixed(2)}.`);
  }
  if (input.optimizedCandidate.requireFlowConfirmation !== input.baselineCandidate.requireFlowConfirmation) {
    update.add(`Flow gate: require flow confirmation = ${input.optimizedCandidate.requireFlowConfirmation}.`);
  }
  if (
    input.optimizedCandidate.requireFlowConfirmation
    && input.optimizedCandidate.minAlignmentPct !== input.baselineCandidate.minAlignmentPct
  ) {
    update.add(`Flow gate: set alignment >= ${input.optimizedCandidate.minAlignmentPct}%.`);
  }
  if (input.optimizedCandidate.requireEmaAlignment !== input.baselineCandidate.requireEmaAlignment) {
    update.add(`Indicator gate: require EMA alignment = ${input.optimizedCandidate.requireEmaAlignment}.`);
  }
  if (input.optimizedCandidate.requireVolumeRegimeAlignment !== input.baselineCandidate.requireVolumeRegimeAlignment) {
    update.add(`Indicator gate: require volume-regime alignment = ${input.optimizedCandidate.requireVolumeRegimeAlignment}.`);
  }
  if (input.optimizedCandidate.enforceTimingGate !== input.baselineCandidate.enforceTimingGate) {
    update.add(`Timing gate: enforce late-session discipline = ${input.optimizedCandidate.enforceTimingGate}.`);
  }
  if (input.optimizedCandidate.partialAtT1Pct !== input.baselineCandidate.partialAtT1Pct) {
    update.add(`Trade management: take ${(input.optimizedCandidate.partialAtT1Pct * 100).toFixed(0)}% at T1 and run ${(100 - (input.optimizedCandidate.partialAtT1Pct * 100)).toFixed(0)}%.`);
  } else {
    update.add(`Trade management: keep ${(input.optimizedCandidate.partialAtT1Pct * 100).toFixed(0)}% at T1 with breakeven runner policy.`);
  }

  const shortFrom = shiftDate(input.toDate, -4);
  for (const bucket of input.setupTypeBuckets) {
    if (bucket.tradeCount < input.profile.walkForward.minTrades) continue;
    if (bucket.t1WinRatePct < 58) continue;
    if (bucket.t1Confidence95.lowerPct < ADD_SETUP_MIN_T1_LOWER_BOUND_PCT) continue;
    const recentTrades = input.rows.filter(
      (row) => row.setupType === bucket.key && row.sessionDate >= shortFrom && row.triggered,
    ).length;
    if (recentTrades > 0) continue;
    add.add(
      `Add/enable ${bucket.key}: strong historical edge (${bucket.t1WinRatePct}% T1, 95% CI ${bucket.t1Confidence95.lowerPct}-${bucket.t1Confidence95.upperPct}) but no recent deployment.`,
    );
  }

  return {
    add: Array.from(add),
    update: Array.from(update),
    remove: Array.from(remove),
  };
}

async function loadOptimizationRows(
  from: string,
  to: string,
  outcomeOverrides?: Map<string, OutcomeOverride>,
): Promise<PreparedOptimizationRow[]> {
  const { data, error } = await supabase
    .from('spx_setup_instances')
    .select('engine_setup_id,session_date,setup_type,direction,regime,first_seen_at,triggered_at,final_outcome,stop_hit_at,entry_zone_low,entry_zone_high,stop_price,target_1_price,target_2_price,p_win_calibrated,ev_r,metadata')
    .gte('session_date', from)
    .lte('session_date', to);

  if (error) {
    if (isMissingTableError(error.message)) {
      logger.warn('SPX optimizer skipped row load because spx_setup_instances is missing');
      return [];
    }
    throw new Error(`Failed to load optimizer rows: ${error.message}`);
  }

  return ((data || []) as OptimizationRow[]).map((row) => {
    const override = outcomeOverrides?.get(optimizationRowKey(row.engine_setup_id, row.session_date));
    if (!override) return toPreparedRow(row);

    return toPreparedRow({
      ...row,
      triggered_at: override.triggeredAt,
      final_outcome: override.finalOutcome,
      entry_fill_price: override.entryFillPrice,
      stop_hit_at: override.stopHitAt,
    });
  });
}

async function readPersistedOptimizerState(): Promise<PersistedOptimizerStateRow | null> {
  const { data, error } = await supabase
    .from(OPTIMIZER_STATE_TABLE)
    .select('id,profile,scorecard,scan_range_from,scan_range_to,training_from,training_to,validation_from,validation_to,updated_at')
    .eq('id', OPTIMIZER_STATE_ROW_ID)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message)) return null;
    logger.warn('SPX optimizer failed to read persisted optimizer state', { error: error.message });
    return null;
  }

  return (data || null) as PersistedOptimizerStateRow | null;
}

async function persistOptimizerState(input: {
  profile: SPXOptimizationProfile;
  scorecard: SPXOptimizerScorecard;
  scanRange: { from: string; to: string };
  trainingRange: { from: string; to: string };
  validationRange: { from: string; to: string };
}): Promise<void> {
  const row = {
    id: OPTIMIZER_STATE_ROW_ID,
    status: 'active',
    profile: input.profile,
    scorecard: input.scorecard,
    scan_range_from: input.scanRange.from,
    scan_range_to: input.scanRange.to,
    training_from: input.trainingRange.from,
    training_to: input.trainingRange.to,
    validation_from: input.validationRange.from,
    validation_to: input.validationRange.to,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from(OPTIMIZER_STATE_TABLE)
    .upsert(row, { onConflict: 'id' });

  if (error) {
    if (isMissingTableError(error.message)) {
      logger.warn('SPX optimizer state table missing; skipping persistence');
      return;
    }

    logger.warn('SPX optimizer failed to persist optimizer state', { error: error.message });
  }
}

function withDateRangeProfile(base: SPXOptimizationProfile, generatedAt: string): SPXOptimizationProfile {
  return {
    ...base,
    generatedAt,
  };
}

export async function getActiveSPXOptimizationProfile(): Promise<SPXOptimizationProfile> {
  try {
    const cached = await cacheGet<SPXOptimizationProfile>(OPTIMIZER_PROFILE_CACHE_KEY);
    if (cached) {
      return normalizeProfile(cached);
    }
  } catch {
    // noop
  }

  const persisted = await readPersistedOptimizerState();
  const profile = normalizeProfile(persisted?.profile || DEFAULT_PROFILE);

  try {
    await cacheSet(OPTIMIZER_PROFILE_CACHE_KEY, profile, OPTIMIZER_PROFILE_CACHE_TTL_SECONDS);
  } catch {
    // noop
  }

  return profile;
}

export async function getSPXOptimizerScorecard(): Promise<SPXOptimizerScorecard> {
  const persisted = await readPersistedOptimizerState();
  if (persisted?.scorecard && typeof persisted.scorecard === 'object' && !Array.isArray(persisted.scorecard)) {
    return persisted.scorecard as SPXOptimizerScorecard;
  }

  const profile = await getActiveSPXOptimizationProfile();
  const { from, to } = defaultScanRange(profile);
  const outcomeOverrides = await loadOutcomeOverridesFromBacktest(from, to);
  const rows = await loadOptimizationRows(from, to, outcomeOverrides);
  const baselineCandidate: ThresholdCandidate = {
    requireFlowConfirmation: profile.flowGate.requireFlowConfirmation,
    minConfluenceScore: profile.qualityGate.minConfluenceScore,
    minPWinCalibrated: profile.qualityGate.minPWinCalibrated,
    minEvR: profile.qualityGate.minEvR,
    minAlignmentPct: profile.flowGate.minAlignmentPct,
    requireEmaAlignment: profile.indicatorGate.requireEmaAlignment,
    requireVolumeRegimeAlignment: profile.indicatorGate.requireVolumeRegimeAlignment,
    enforceTimingGate: profile.timingGate.enabled,
    partialAtT1Pct: profile.tradeManagement.partialAtT1Pct,
  };
  const timingMap = profile.timingGate.maxFirstSeenMinuteBySetupType;
  const eligibleRows = rows.filter((row) => passesCandidate(row, baselineCandidate, { timingMap }));
  const metrics = toMetrics(eligibleRows, profile.walkForward.objectiveWeights, {
    partialAtT1Pct: baselineCandidate.partialAtT1Pct,
  });

  return {
    generatedAt: new Date().toISOString(),
    scanRange: { from, to },
    trainingRange: { from, to },
    validationRange: { from, to },
    baseline: metrics,
    optimized: metrics,
    improvementPct: {
      t1WinRateDelta: 0,
      t2WinRateDelta: 0,
      objectiveDelta: 0,
      objectiveConservativeDelta: 0,
      expectancyRDelta: 0,
    },
    driftAlerts: [],
    setupTypePerformance: evaluateBuckets(
      eligibleRows,
      (row) => row.setupType,
      profile.walkForward.objectiveWeights,
      baselineCandidate.partialAtT1Pct,
    ),
    setupComboPerformance: evaluateBuckets(
      eligibleRows,
      (row) => row.comboKey,
      profile.walkForward.objectiveWeights,
      baselineCandidate.partialAtT1Pct,
    ),
    setupActions: {
      add: [],
      update: ['Run Scan & Optimize to generate walk-forward recommendations.'],
      remove: [],
    },
    optimizationApplied: false,
    notes: ['Optimizer scorecard is using baseline profile defaults.'],
  };
}

export async function runSPXOptimizerScan(input?: {
  from?: string;
  to?: string;
  mode?: 'manual' | 'weekly_auto';
}): Promise<SPXOptimizationScanResult> {
  const currentProfile = await getActiveSPXOptimizationProfile();
  const fallbackRange = defaultScanRange(currentProfile);
  const scanFrom = normalizeDateInput(input?.from || fallbackRange.from);
  const scanTo = normalizeDateInput(input?.to || fallbackRange.to);
  const weeklyAutoMode = input?.mode === 'weekly_auto';

  const profileForScan = normalizeProfile(currentProfile);
  const trainingDays = profileForScan.walkForward.trainingDays;
  const validationDays = profileForScan.walkForward.validationDays;

  const validationTo = scanTo;
  const validationFrom = shiftDate(validationTo, -(validationDays - 1));
  const trainingTo = shiftDate(validationFrom, -1);
  const trainingFrom = shiftDate(trainingTo, -(trainingDays - 1));

  const outcomeOverrides = await loadOutcomeOverridesFromBacktest(trainingFrom, validationTo);
  const rows = await loadOptimizationRows(trainingFrom, validationTo, outcomeOverrides);
  const trainingRows = rows.filter((row) => row.sessionDate >= trainingFrom && row.sessionDate <= trainingTo);
  const validationRows = rows.filter((row) => row.sessionDate >= validationFrom && row.sessionDate <= validationTo);

  const baselineCandidate: ThresholdCandidate = {
    requireFlowConfirmation: profileForScan.flowGate.requireFlowConfirmation,
    minConfluenceScore: profileForScan.qualityGate.minConfluenceScore,
    minPWinCalibrated: profileForScan.qualityGate.minPWinCalibrated,
    minEvR: profileForScan.qualityGate.minEvR,
    minAlignmentPct: profileForScan.flowGate.minAlignmentPct,
    requireEmaAlignment: profileForScan.indicatorGate.requireEmaAlignment,
    requireVolumeRegimeAlignment: profileForScan.indicatorGate.requireVolumeRegimeAlignment,
    enforceTimingGate: profileForScan.timingGate.enabled,
    partialAtT1Pct: profileForScan.tradeManagement.partialAtT1Pct,
  };
  const timingMap = profileForScan.timingGate.maxFirstSeenMinuteBySetupType;

  let bestCandidate = baselineCandidate;
  let bestTrainingMetrics = toMetrics(
    trainingRows.filter((row) => passesCandidate(row, baselineCandidate, { timingMap })),
    profileForScan.walkForward.objectiveWeights,
    { partialAtT1Pct: baselineCandidate.partialAtT1Pct },
  );
  let hasQualifiedTrainingCandidate = bestTrainingMetrics.tradeCount >= profileForScan.walkForward.minTrades;

  for (const candidate of candidateGrid()) {
    const eligible = trainingRows.filter((row) => passesCandidate(row, candidate, { timingMap }));
    const metrics = toMetrics(eligible, profileForScan.walkForward.objectiveWeights, {
      partialAtT1Pct: candidate.partialAtT1Pct,
    });
    if (metrics.tradeCount < profileForScan.walkForward.minTrades) continue;
    if (
      hasQualifiedTrainingCandidate
      && metrics.objectiveScoreConservative <= bestTrainingMetrics.objectiveScoreConservative
    ) continue;

    bestCandidate = candidate;
    bestTrainingMetrics = metrics;
    hasQualifiedTrainingCandidate = true;
  }

  const baselineValidationMetrics = toMetrics(
    validationRows.filter((row) => passesCandidate(row, baselineCandidate, { timingMap })),
    profileForScan.walkForward.objectiveWeights,
    { partialAtT1Pct: baselineCandidate.partialAtT1Pct },
  );

  const optimizedValidationMetrics = toMetrics(
    validationRows.filter((row) => passesCandidate(row, bestCandidate, { timingMap })),
    profileForScan.walkForward.objectiveWeights,
    { partialAtT1Pct: bestCandidate.partialAtT1Pct },
  );

  const baselineValidationQualified = baselineValidationMetrics.tradeCount >= profileForScan.walkForward.minTrades;
  const fallbackValidationMinTrades = Math.max(3, Math.min(8, profileForScan.walkForward.validationDays));
  const baseRequiredValidationTrades = baselineValidationQualified
    ? profileForScan.walkForward.minTrades
    : fallbackValidationMinTrades;
  const requiredValidationTrades = weeklyAutoMode
    ? Math.max(baseRequiredValidationTrades, WEEKLY_AUTO_MIN_VALIDATION_TRADES)
    : baseRequiredValidationTrades;
  const baselineHasValidationTrades = baselineValidationMetrics.tradeCount > 0;
  const objectiveDelta = round(optimizedValidationMetrics.objectiveScore - baselineValidationMetrics.objectiveScore, 2);
  const objectiveConservativeDelta = round(
    optimizedValidationMetrics.objectiveScoreConservative - baselineValidationMetrics.objectiveScoreConservative,
    2,
  );
  const expectancyRDelta = round(optimizedValidationMetrics.expectancyR - baselineValidationMetrics.expectancyR, 4);
  const t1WinRateDelta = round(optimizedValidationMetrics.t1WinRatePct - baselineValidationMetrics.t1WinRatePct, 2);
  const t2WinRateDelta = round(optimizedValidationMetrics.t2WinRatePct - baselineValidationMetrics.t2WinRatePct, 2);
  const failureRateDelta = round(optimizedValidationMetrics.failureRatePct - baselineValidationMetrics.failureRatePct, 2);
  const weeklyGuardrailPassed = !weeklyAutoMode || (
    objectiveDelta >= WEEKLY_AUTO_MIN_OBJECTIVE_DELTA
    && objectiveConservativeDelta >= 0
    && expectancyRDelta >= 0
    && t1WinRateDelta >= 0
    && t2WinRateDelta >= -WEEKLY_AUTO_MAX_T2_DROP_PCT
  );
  const promotionGuardrailPassed = (
    objectiveConservativeDelta >= 0
    && t1WinRateDelta >= PROMOTION_MIN_T1_DELTA_PCT
    && t2WinRateDelta >= PROMOTION_MIN_T2_DELTA_PCT
    && expectancyRDelta >= PROMOTION_MIN_EXPECTANCY_DELTA_R
    && failureRateDelta <= PROMOTION_MAX_FAILURE_DELTA_PCT
  );
  const optimizationApplied = (
    optimizedValidationMetrics.tradeCount >= requiredValidationTrades
    && (
      optimizedValidationMetrics.objectiveScoreConservative > baselineValidationMetrics.objectiveScoreConservative
      || (
        !baselineHasValidationTrades
        && optimizedValidationMetrics.objectiveScoreConservative > 0
      )
    )
    && weeklyGuardrailPassed
    && promotionGuardrailPassed
  );

  const activeCandidate = optimizationApplied ? bestCandidate : baselineCandidate;

  const setupTypePerformance = evaluateBuckets(
    rows.filter((row) => passesCandidate(row, activeCandidate, { timingMap })),
    (row) => row.setupType,
    profileForScan.walkForward.objectiveWeights,
    activeCandidate.partialAtT1Pct,
  );
  const setupComboPerformance = evaluateBuckets(
    rows.filter((row) => passesCandidate(row, activeCandidate, { timingMap })),
    (row) => row.comboKey,
    profileForScan.walkForward.objectiveWeights,
    activeCandidate.partialAtT1Pct,
  );

  const pausedCombos = resolvePausedCombos(setupComboPerformance, profileForScan);
  const driftAlerts = resolveDriftAlerts(
    rows.filter((row) => passesCandidate(row, activeCandidate, {
      pausedCombos: new Set(pausedCombos),
      timingMap,
    })),
    profileForScan,
    validationTo,
    activeCandidate.partialAtT1Pct,
  );
  const opportunityRowsForQuarantine = rows.filter((row) => passesCandidateOpportunity(row, activeCandidate, {
    pausedCombos: new Set(pausedCombos),
    timingMap,
  }));
  const triggerRateQuarantines = resolveTriggerRateQuarantines(
    opportunityRowsForQuarantine,
    profileForScan,
    validationTo,
  );
  const manualPausedSetupTypes = profileForScan.driftControl.pausedSetupTypes
    .filter((setupType) => typeof setupType === 'string' && setupType.length > 0);
  const driftPausedSetupTypes = Array.from(new Set(driftAlerts.map((alert) => alert.setupType))).sort();
  const quarantinePausedSetupTypes = Array.from(new Set(triggerRateQuarantines.map((alert) => alert.setupType))).sort();
  const mergedPausedSetupTypes = Array.from(
    new Set([...manualPausedSetupTypes, ...driftPausedSetupTypes, ...quarantinePausedSetupTypes]),
  ).sort();

  const nextProfile: SPXOptimizationProfile = withDateRangeProfile({
    ...profileForScan,
    source: 'scan',
    qualityGate: {
      ...profileForScan.qualityGate,
      minConfluenceScore: activeCandidate.minConfluenceScore,
      minPWinCalibrated: activeCandidate.minPWinCalibrated,
      minEvR: activeCandidate.minEvR,
    },
    flowGate: {
      ...profileForScan.flowGate,
      minAlignmentPct: activeCandidate.minAlignmentPct,
      requireFlowConfirmation: activeCandidate.requireFlowConfirmation,
    },
    indicatorGate: {
      ...profileForScan.indicatorGate,
      requireEmaAlignment: activeCandidate.requireEmaAlignment,
      requireVolumeRegimeAlignment: activeCandidate.requireVolumeRegimeAlignment,
    },
    timingGate: {
      ...profileForScan.timingGate,
      enabled: activeCandidate.enforceTimingGate,
    },
    regimeGate: {
      ...profileForScan.regimeGate,
      pausedCombos,
    },
    tradeManagement: {
      ...profileForScan.tradeManagement,
      partialAtT1Pct: activeCandidate.partialAtT1Pct,
      moveStopToBreakeven: true,
    },
    driftControl: {
      ...profileForScan.driftControl,
      pausedSetupTypes: mergedPausedSetupTypes,
    },
  }, new Date().toISOString());

  const setupActions = buildSetupActionRecommendations({
    setupTypeBuckets: setupTypePerformance,
    setupComboBuckets: setupComboPerformance,
    pausedCombos,
    driftAlerts,
    triggerRateQuarantines,
    baselineCandidate,
    optimizedCandidate: activeCandidate,
    toDate: validationTo,
    profile: profileForScan,
    rows,
  });

  const scorecard: SPXOptimizerScorecard = {
    generatedAt: new Date().toISOString(),
    scanRange: { from: scanFrom, to: scanTo },
    trainingRange: { from: trainingFrom, to: trainingTo },
    validationRange: { from: validationFrom, to: validationTo },
    baseline: baselineValidationMetrics,
    optimized: optimizedValidationMetrics,
    improvementPct: {
      t1WinRateDelta,
      t2WinRateDelta,
      objectiveDelta,
      objectiveConservativeDelta,
      expectancyRDelta,
    },
    driftAlerts,
    setupTypePerformance,
    setupComboPerformance,
    setupActions,
    optimizationApplied,
    notes: [
      optimizationApplied
        ? `Walk-forward optimization applied to active profile (validation trades=${optimizedValidationMetrics.tradeCount}, minimum required=${requiredValidationTrades}).`
        : 'Candidate thresholds did not beat baseline on validation window; baseline retained.',
      weeklyAutoMode
        ? `Weekly auto guardrails: objective delta >= ${WEEKLY_AUTO_MIN_OBJECTIVE_DELTA}, conservative objective delta >= 0, expectancy delta >= 0, T1 delta >= 0, T2 delta >= -${WEEKLY_AUTO_MAX_T2_DROP_PCT}, validation trades >= ${requiredValidationTrades}.`
        : 'Weekly auto guardrails not enforced for this scan mode.',
      `Promotion guardrails: T1 delta >= ${PROMOTION_MIN_T1_DELTA_PCT}, T2 delta >= ${PROMOTION_MIN_T2_DELTA_PCT}, expectancy delta >= ${PROMOTION_MIN_EXPECTANCY_DELTA_R}, failure delta <= ${PROMOTION_MAX_FAILURE_DELTA_PCT}, conservative objective delta >= 0.`,
      `Validation objective: baseline ${baselineValidationMetrics.objectiveScore} (conservative ${baselineValidationMetrics.objectiveScoreConservative}) vs optimized ${optimizedValidationMetrics.objectiveScore} (conservative ${optimizedValidationMetrics.objectiveScoreConservative}).`,
      `Validation expectancy(R): baseline ${baselineValidationMetrics.expectancyR} (lower bound ${baselineValidationMetrics.expectancyLowerBoundR}) vs optimized ${optimizedValidationMetrics.expectancyR} (lower bound ${optimizedValidationMetrics.expectancyLowerBoundR}).`,
      `Validation win/failure deltas: T1 ${t1WinRateDelta}, T2 ${t2WinRateDelta}, failure ${failureRateDelta}.`,
      `Flow gate: require flow confirmation=${nextProfile.flowGate.requireFlowConfirmation}, alignment floor=${nextProfile.flowGate.minAlignmentPct}.`,
      `Indicator gates: require EMA alignment=${nextProfile.indicatorGate.requireEmaAlignment}, require volume-regime alignment=${nextProfile.indicatorGate.requireVolumeRegimeAlignment}.`,
      `Timing gate: enforce=${nextProfile.timingGate.enabled}.`,
      `Trade management policy: ${nextProfile.tradeManagement.partialAtT1Pct * 100}% at T1, stop to breakeven=${nextProfile.tradeManagement.moveStopToBreakeven}.`,
      `Geometry policy: setupType=${Object.keys(nextProfile.geometryPolicy.bySetupType).length}, setupRegime=${Object.keys(nextProfile.geometryPolicy.bySetupRegime).length}, setupRegimeTimeBucket=${Object.keys(nextProfile.geometryPolicy.bySetupRegimeTimeBucket).length}.`,
      `Drift control paused ${driftPausedSetupTypes.length} setup types and trigger-rate quarantine paused ${quarantinePausedSetupTypes.length} setup types; merged paused setup types=${mergedPausedSetupTypes.length}.`,
      `Regime gate paused ${pausedCombos.length} setup/regime combos.`,
    ],
  };

  await persistOptimizerState({
    profile: nextProfile,
    scorecard,
    scanRange: { from: scanFrom, to: scanTo },
    trainingRange: { from: trainingFrom, to: trainingTo },
    validationRange: { from: validationFrom, to: validationTo },
  });

  try {
    await cacheSet(OPTIMIZER_PROFILE_CACHE_KEY, nextProfile, OPTIMIZER_PROFILE_CACHE_TTL_SECONDS);
  } catch {
    // noop
  }

  return {
    profile: nextProfile,
    scorecard,
  };
}

export const __optimizerTestUtils = {
  wilsonIntervalPct,
  toMetrics,
  resolvePausedCombos,
};
