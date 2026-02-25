import type { MassiveAggregate } from '../../config/massive';
import { getAggregates } from '../../config/massive';
import { getMinuteAggregates } from '../../config/massive';
import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import {
  summarizeSPXWinRateRows,
  type SPXWinRateAnalytics,
  type SetupFinalOutcome,
  type SetupInstanceRow,
} from './outcomeTracker';
import {
  calculateAdaptiveStop,
  deriveNearestGEXDistanceBp,
} from './stopEngine';
import type { Regime, SPXVixRegime } from './types';

type InternalBacktestSource = 'spx_setup_instances';

export type SPXWinRateBacktestSource = 'auto' | InternalBacktestSource;
export type SPXBacktestPriceResolution = 'auto' | 'minute' | 'second';

interface BacktestSetupCandidate {
  engineSetupId: string;
  sessionDate: string;
  setupType: string;
  direction: 'bullish' | 'bearish';
  regime: string | null;
  tier: string | null;
  gateStatus: 'eligible' | 'blocked' | null;
  entryLow: number;
  entryHigh: number;
  stopPrice: number;
  target1Price: number;
  target2Price: number | null;
  firstSeenAt: string | null;
  triggeredAt: string | null;
  tradeManagement: {
    partialAtT1Pct: number;
    moveStopToBreakeven: boolean;
  } | null;
  metadata: Record<string, unknown> | null;
}

interface EvaluatedSetup {
  row: SetupInstanceRow;
  ambiguityCount: number;
  missingTarget2: boolean;
  realizedR: number | null;
}

interface BacktestPauseFilters {
  pausedSetupTypes: Set<string>;
  pausedCombos: Set<string>;
  notes: string[];
  optimizerProfile: Record<string, unknown> | null;
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function parseFloatEnv(value: string | undefined, fallback: number, min = 0): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
}

function parseOptionalFloatEnv(value: string | undefined, min = 0): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(min, parsed);
}

export interface SPXBacktestExecutionModel {
  enabled: boolean;
  entrySlipPoints: number;
  targetSlipPoints: number;
  stopSlipPoints: number;
  commissionPerTradeR: number;
  partialAtT1Pct: number;
  moveStopToBreakevenAfterT1: boolean;
}

export interface SPXBacktestGeometryAdjustment {
  stopScale?: number;
  target1Scale?: number;
  target2Scale?: number;
}

export interface SPXBacktestProfitabilityMetrics {
  triggeredCount: number;
  resolvedCount: number;
  withRealizedRCount: number;
  averageRealizedR: number;
  medianRealizedR: number;
  cumulativeRealizedR: number;
  expectancyR: number;
  positiveRealizedRatePct: number;
  bySetupType: Array<{
    key: string;
    tradeCount: number;
    averageRealizedR: number;
    cumulativeRealizedR: number;
  }>;
}

const DEFAULT_EXECUTION_MODEL: SPXBacktestExecutionModel = {
  enabled: parseBooleanEnv(process.env.SPX_BACKTEST_EXECUTION_MODEL_ENABLED, true),
  entrySlipPoints: parseFloatEnv(process.env.SPX_BACKTEST_ENTRY_SLIP_POINTS, 0.2, 0),
  targetSlipPoints: parseFloatEnv(process.env.SPX_BACKTEST_TARGET_SLIP_POINTS, 0.25, 0),
  stopSlipPoints: parseFloatEnv(process.env.SPX_BACKTEST_STOP_SLIP_POINTS, 0.15, 0),
  commissionPerTradeR: parseFloatEnv(process.env.SPX_BACKTEST_COMMISSION_R, 0.04, 0),
  partialAtT1Pct: clamp(parseFloatEnv(process.env.SPX_BACKTEST_PARTIAL_AT_T1_PCT, 0.5, 0), 0, 1),
  moveStopToBreakevenAfterT1: parseBooleanEnv(process.env.SPX_BACKTEST_MOVE_STOP_TO_BREAKEVEN_AFTER_T1, true),
};

const DEFAULT_STOP_RECOMPUTE_PARAMS = {
  atrStopFloorEnabled: parseBooleanEnv(process.env.SPX_SETUP_ATR_STOP_FLOOR_ENABLED, true),
  atrStopMultiplier: (() => {
    const parsed = parseOptionalFloatEnv(process.env.SPX_SETUP_ATR_STOP_MULTIPLIER, 0.1);
    return parsed == null ? undefined : clamp(parsed, 0.1, 3);
  })(),
  vixStopScalingEnabled: parseBooleanEnv(process.env.SPX_SETUP_VIX_STOP_SCALING_ENABLED, true),
  gexMagnitudeScalingEnabled: parseBooleanEnv(process.env.SPX_SETUP_GEX_MAGNITUDE_STOP_SCALING_ENABLED, true),
};

function resolveExecutionModel(
  overrides?: Partial<SPXBacktestExecutionModel>,
): SPXBacktestExecutionModel {
  return {
    enabled: overrides?.enabled ?? DEFAULT_EXECUTION_MODEL.enabled,
    entrySlipPoints: Math.max(0, overrides?.entrySlipPoints ?? DEFAULT_EXECUTION_MODEL.entrySlipPoints),
    targetSlipPoints: Math.max(0, overrides?.targetSlipPoints ?? DEFAULT_EXECUTION_MODEL.targetSlipPoints),
    stopSlipPoints: Math.max(0, overrides?.stopSlipPoints ?? DEFAULT_EXECUTION_MODEL.stopSlipPoints),
    commissionPerTradeR: Math.max(0, overrides?.commissionPerTradeR ?? DEFAULT_EXECUTION_MODEL.commissionPerTradeR),
    partialAtT1Pct: clamp(overrides?.partialAtT1Pct ?? DEFAULT_EXECUTION_MODEL.partialAtT1Pct, 0, 1),
    moveStopToBreakevenAfterT1: overrides?.moveStopToBreakevenAfterT1 ?? DEFAULT_EXECUTION_MODEL.moveStopToBreakevenAfterT1,
  };
}

function applyGeometryAdjustment(
  setup: BacktestSetupCandidate,
  adjustment: SPXBacktestGeometryAdjustment | null | undefined,
): BacktestSetupCandidate {
  if (!adjustment) return setup;

  const stopScale = clamp(
    typeof adjustment.stopScale === 'number' && Number.isFinite(adjustment.stopScale)
      ? adjustment.stopScale
      : 1,
    0.5,
    2.0,
  );
  const target1Scale = clamp(
    typeof adjustment.target1Scale === 'number' && Number.isFinite(adjustment.target1Scale)
      ? adjustment.target1Scale
      : 1,
    0.5,
    2.0,
  );
  const target2Scale = clamp(
    typeof adjustment.target2Scale === 'number' && Number.isFinite(adjustment.target2Scale)
      ? adjustment.target2Scale
      : 1,
    0.5,
    2.5,
  );

  if (
    Math.abs(stopScale - 1) < 0.0001
    && Math.abs(target1Scale - 1) < 0.0001
    && Math.abs(target2Scale - 1) < 0.0001
  ) {
    return setup;
  }

  const entryMid = (setup.entryLow + setup.entryHigh) / 2;
  const directionMultiplier = setup.direction === 'bullish' ? 1 : -1;
  const stopDistance = Math.max(0.25, Math.abs(entryMid - setup.stopPrice));
  const target1Distance = Math.max(0.25, Math.abs(setup.target1Price - entryMid));
  const fallbackTarget2Distance = target1Distance * 1.8;
  const target2DistanceBase = setup.target2Price == null
    ? fallbackTarget2Distance
    : Math.max(0.3, Math.abs(setup.target2Price - entryMid));

  const scaledStopDistance = Math.max(0.25, stopDistance * stopScale);
  const scaledTarget1Distance = Math.max(0.25, target1Distance * target1Scale);
  const scaledTarget2Distance = Math.max(
    scaledTarget1Distance + 0.1,
    target2DistanceBase * target2Scale,
  );

  return {
    ...setup,
    stopPrice: round(entryMid - (directionMultiplier * scaledStopDistance), 4),
    target1Price: round(entryMid + (directionMultiplier * scaledTarget1Distance), 4),
    target2Price: round(entryMid + (directionMultiplier * scaledTarget2Distance), 4),
  };
}

function toSessionMinuteEt(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const et = toEasternTime(new Date(parsed));
  const sessionOpenMinute = (9 * 60) + 30;
  return Math.max(0, (et.hour * 60 + et.minute) - sessionOpenMinute);
}

type GeometryBucket = 'early_open' | 'opening' | 'midday' | 'afternoon' | 'close';
function toGeometryBucket(firstSeenAtIso: string | null): GeometryBucket {
  const minuteSinceOpen = toSessionMinuteEt(firstSeenAtIso);
  if (minuteSinceOpen == null) return 'midday';
  if (minuteSinceOpen <= 30) return 'early_open';
  if (minuteSinceOpen <= 90) return 'opening';
  if (minuteSinceOpen <= 240) return 'midday';
  if (minuteSinceOpen <= 330) return 'afternoon';
  return 'close';
}

function resolveGeometryAdjustmentForSetup(
  setup: BacktestSetupCandidate,
  map: Record<string, SPXBacktestGeometryAdjustment>,
): SPXBacktestGeometryAdjustment | null {
  const regime = setup.regime || 'unknown';
  const bucket = toGeometryBucket(setup.firstSeenAt);
  const dirSuffix = setup.direction ? `_${setup.direction}` : '';
  const keys = [
    // Direction-specific keys (most specific first)
    ...(dirSuffix ? [
      `${setup.setupType}${dirSuffix}|${regime}|${bucket}`,
      `${setup.setupType}${dirSuffix}|${regime}`,
      `${setup.setupType}${dirSuffix}|${bucket}`,
      `${setup.setupType}${dirSuffix}`,
    ] : []),
    // Undirected keys (fallback)
    `${setup.setupType}|${regime}|${bucket}`,
    `${setup.setupType}|${regime}`,
    `${setup.setupType}|${bucket}`,
    setup.setupType,
  ];
  for (const key of keys) {
    const adjustment = map[key];
    if (adjustment && typeof adjustment === 'object' && !Array.isArray(adjustment)) {
      return adjustment;
    }
  }
  return null;
}

type SetupDetectorGeometryBucket = 'opening' | 'midday' | 'late';

interface BacktestSetupStopContext {
  baseStop: number | null;
  geometryStopScale: number | null;
  atr14: number | null;
  netGex: number | null;
  vixRegime: SPXVixRegime | null;
  gexDistanceBp: number | null;
  gexCallWall: number | null;
  gexPutWall: number | null;
  gexFlipPoint: number | null;
}

interface RecomputeStopResult {
  stopPrice: number;
  changed: boolean;
  usedBaseStopMetadata: boolean;
  usedProfileStopScaleFallback: boolean;
  atrAvailable: boolean;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function findNestedNumberByKey(value: unknown, key: string, depth: number): number | null {
  if (depth < 0) return null;
  const record = getRecord(value);
  if (!record) return null;

  const direct = toFiniteNumber(record[key]);
  if (direct != null) return direct;
  if (depth === 0) return null;

  for (const child of Object.values(record)) {
    const nested = findNestedNumberByKey(child, key, depth - 1);
    if (nested != null) return nested;
  }
  return null;
}

function findNestedStringByKey(value: unknown, key: string, depth: number): string | null {
  if (depth < 0) return null;
  const record = getRecord(value);
  if (!record) return null;

  const direct = record[key];
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim();
  if (depth === 0) return null;

  for (const child of Object.values(record)) {
    const nested = findNestedStringByKey(child, key, depth - 1);
    if (nested) return nested;
  }
  return null;
}

function toRegime(value: string | null | undefined): Regime | null {
  if (value === 'compression' || value === 'ranging' || value === 'trending' || value === 'breakout') {
    return value;
  }
  return null;
}

function toVixRegime(value: string | null): SPXVixRegime | null {
  if (value === 'normal' || value === 'elevated' || value === 'extreme' || value === 'unknown') {
    return value;
  }
  return null;
}

function toSetupDetectorGeometryBucket(firstSeenAtIso: string | null): SetupDetectorGeometryBucket {
  const minuteSinceOpen = toSessionMinuteEt(firstSeenAtIso);
  if (minuteSinceOpen == null) return 'midday';
  if (minuteSinceOpen <= 90) return 'opening';
  if (minuteSinceOpen <= 240) return 'midday';
  return 'late';
}

function resolveGeometryStopScaleFromProfile(
  setup: BacktestSetupCandidate,
  profile: Record<string, unknown> | null,
): number | null {
  const geometryPolicy = getRecord(profile?.geometryPolicy);
  if (!geometryPolicy) return null;
  const bySetupType = getRecord(geometryPolicy.bySetupType);
  const bySetupRegime = getRecord(geometryPolicy.bySetupRegime);
  const bySetupRegimeTimeBucket = getRecord(geometryPolicy.bySetupRegimeTimeBucket);
  const regime = setup.regime || 'unknown';
  const bucket = toGeometryBucket(setup.firstSeenAt);
  const detectorBucket = toSetupDetectorGeometryBucket(setup.firstSeenAt);
  const dirSuffix = setup.direction ? `_${setup.direction}` : '';

  const byTypeCandidates = [
    ...(dirSuffix ? [`${setup.setupType}${dirSuffix}`] : []),
    setup.setupType,
  ];
  let resolved = byTypeCandidates
    .map((key) => toFiniteNumber(getRecord(bySetupType?.[key])?.stopScale))
    .find((value): value is number => value != null) ?? null;

  const byRegimeCandidates = [
    ...(dirSuffix ? [`${setup.setupType}${dirSuffix}|${regime}`] : []),
    `${setup.setupType}|${regime}`,
  ];
  for (const key of byRegimeCandidates) {
    const candidate = toFiniteNumber(getRecord(bySetupRegime?.[key])?.stopScale);
    if (candidate != null) {
      resolved = candidate;
      break;
    }
  }

  const byRegimeBucketCandidates = [
    ...(dirSuffix ? [
      `${setup.setupType}${dirSuffix}|${regime}|${bucket}`,
      `${setup.setupType}${dirSuffix}|${regime}|${detectorBucket}`,
    ] : []),
    `${setup.setupType}|${regime}|${bucket}`,
    `${setup.setupType}|${regime}|${detectorBucket}`,
  ];
  for (const key of byRegimeBucketCandidates) {
    const candidate = toFiniteNumber(getRecord(bySetupRegimeTimeBucket?.[key])?.stopScale);
    if (candidate != null) {
      resolved = candidate;
      break;
    }
  }

  return resolved == null ? null : clamp(resolved, 0.2, 4);
}

function extractStopContextFromMetadata(metadata: Record<string, unknown> | null): BacktestSetupStopContext {
  if (!metadata) {
    return {
      baseStop: null,
      geometryStopScale: null,
      atr14: null,
      netGex: null,
      vixRegime: null,
      gexDistanceBp: null,
      gexCallWall: null,
      gexPutWall: null,
      gexFlipPoint: null,
    };
  }

  const stopContext = getRecord(metadata.stopContext);
  const stopEngine = getRecord(metadata.stopEngine);
  const indicatorContext = getRecord(metadata.indicatorContext);
  const indicators = getRecord(metadata.indicators);
  const gexContext = getRecord(metadata.gex);
  const environmentContext = getRecord(metadata.environmentGate);
  const geometryPolicy = getRecord(metadata.geometryPolicy);

  const baseStop = (
    toFiniteNumber(stopContext?.baseStop)
    ?? toFiniteNumber(stopContext?.base_stop)
    ?? toFiniteNumber(stopEngine?.baseStop)
    ?? toFiniteNumber(stopEngine?.base_stop)
    ?? toFiniteNumber(metadata.baseStop)
    ?? toFiniteNumber(metadata.base_stop)
    ?? findNestedNumberByKey(stopContext, 'baseStop', 3)
    ?? findNestedNumberByKey(stopEngine, 'baseStop', 3)
    ?? findNestedNumberByKey(metadata, 'baseStop', 4)
  );

  const geometryStopScale = (
    toFiniteNumber(stopContext?.geometryStopScale)
    ?? toFiniteNumber(stopContext?.stopScale)
    ?? toFiniteNumber(stopEngine?.geometryStopScale)
    ?? toFiniteNumber(stopEngine?.stopScale)
    ?? toFiniteNumber(geometryPolicy?.stopScale)
    ?? toFiniteNumber(metadata.geometryStopScale)
    ?? toFiniteNumber(metadata.stopScale)
    ?? findNestedNumberByKey(stopContext, 'geometryStopScale', 3)
    ?? findNestedNumberByKey(stopEngine, 'geometryStopScale', 3)
    ?? findNestedNumberByKey(metadata, 'geometryStopScale', 4)
    ?? findNestedNumberByKey(metadata, 'stopScale', 4)
  );

  const atr14Candidate = (
    toFiniteNumber(metadata.atr14)
    ?? toFiniteNumber(indicatorContext?.atr14)
    ?? toFiniteNumber(indicators?.atr14)
    ?? toFiniteNumber(stopContext?.atr14)
    ?? toFiniteNumber(stopEngine?.atr14)
    ?? findNestedNumberByKey(metadata, 'atr14', 4)
  );

  const netGex = (
    toFiniteNumber(metadata.netGex)
    ?? toFiniteNumber(stopContext?.netGex)
    ?? toFiniteNumber(stopEngine?.netGex)
    ?? toFiniteNumber(gexContext?.netGex)
    ?? findNestedNumberByKey(metadata, 'netGex', 4)
  );

  const gexDistanceBp = (
    toFiniteNumber(metadata.gexDistanceBp)
    ?? toFiniteNumber(stopContext?.gexDistanceBp)
    ?? toFiniteNumber(stopEngine?.gexDistanceBp)
    ?? findNestedNumberByKey(metadata, 'gexDistanceBp', 4)
  );

  const gexCallWall = (
    toFiniteNumber(metadata.gexCallWall)
    ?? toFiniteNumber(stopContext?.gexCallWall)
    ?? toFiniteNumber(gexContext?.callWall)
    ?? findNestedNumberByKey(metadata, 'callWall', 4)
  );
  const gexPutWall = (
    toFiniteNumber(metadata.gexPutWall)
    ?? toFiniteNumber(stopContext?.gexPutWall)
    ?? toFiniteNumber(gexContext?.putWall)
    ?? findNestedNumberByKey(metadata, 'putWall', 4)
  );
  const gexFlipPoint = (
    toFiniteNumber(metadata.gexFlipPoint)
    ?? toFiniteNumber(stopContext?.gexFlipPoint)
    ?? toFiniteNumber(gexContext?.flipPoint)
    ?? findNestedNumberByKey(metadata, 'flipPoint', 4)
  );

  const vixRegime = toVixRegime(
    (
      typeof stopContext?.vixRegime === 'string'
        ? stopContext.vixRegime
        : null
    ) || (
      typeof stopEngine?.vixRegime === 'string'
        ? stopEngine.vixRegime
        : null
    ) || (
      typeof metadata.vixRegime === 'string'
        ? metadata.vixRegime
        : null
    ) || (
      typeof environmentContext?.vixRegime === 'string'
        ? environmentContext.vixRegime
        : null
    ) || findNestedStringByKey(metadata, 'vixRegime', 4),
  );

  return {
    baseStop,
    geometryStopScale,
    atr14: atr14Candidate != null && atr14Candidate > 0 ? atr14Candidate : null,
    netGex,
    vixRegime,
    gexDistanceBp,
    gexCallWall,
    gexPutWall,
    gexFlipPoint,
  };
}

function recomputeStopPriceForBacktestSetup(input: {
  setup: BacktestSetupCandidate;
  optimizerProfile: Record<string, unknown> | null;
}): RecomputeStopResult {
  const stopContext = extractStopContextFromMetadata(input.setup.metadata);
  const setupRegime = toRegime(input.setup.regime);
  const profileStopScale = resolveGeometryStopScaleFromProfile(input.setup, input.optimizerProfile);
  const hasBaseStopMetadata = stopContext.baseStop != null;

  // If no persisted pre-adaptive base stop is available, avoid reapplying scale factors
  // on top of an already-scaled persisted stop.
  const geometryStopScale = clamp(
    hasBaseStopMetadata
      ? (stopContext.geometryStopScale ?? profileStopScale ?? 1)
      : 1,
    0.2,
    4,
  );
  const entryMid = (input.setup.entryLow + input.setup.entryHigh) / 2;
  const gexDistanceBp = stopContext.gexDistanceBp
    ?? deriveNearestGEXDistanceBp({
      referencePrice: entryMid,
      callWall: stopContext.gexCallWall,
      putWall: stopContext.gexPutWall,
      flipPoint: stopContext.gexFlipPoint,
    });

  const recomputed = calculateAdaptiveStop({
    direction: input.setup.direction,
    entryLow: input.setup.entryLow,
    entryHigh: input.setup.entryHigh,
    baseStop: hasBaseStopMetadata ? (stopContext.baseStop as number) : input.setup.stopPrice,
    geometryStopScale,
    atr14: stopContext.atr14,
    atrStopFloorEnabled: DEFAULT_STOP_RECOMPUTE_PARAMS.atrStopFloorEnabled,
    atrStopMultiplier: DEFAULT_STOP_RECOMPUTE_PARAMS.atrStopMultiplier,
    regime: setupRegime,
    netGex: hasBaseStopMetadata ? stopContext.netGex : null,
    setupType: input.setup.setupType,
    vixRegime: hasBaseStopMetadata ? stopContext.vixRegime : null,
    vixStopScalingEnabled: hasBaseStopMetadata
      ? DEFAULT_STOP_RECOMPUTE_PARAMS.vixStopScalingEnabled
      : false,
    gexDistanceBp: hasBaseStopMetadata ? gexDistanceBp : null,
    gexMagnitudeScalingEnabled: hasBaseStopMetadata
      ? DEFAULT_STOP_RECOMPUTE_PARAMS.gexMagnitudeScalingEnabled
      : false,
  });

  return {
    stopPrice: recomputed.stop,
    changed: Math.abs(recomputed.stop - input.setup.stopPrice) >= 0.0001,
    usedBaseStopMetadata: hasBaseStopMetadata,
    usedProfileStopScaleFallback: hasBaseStopMetadata
      && stopContext.geometryStopScale == null
      && profileStopScale != null,
    atrAvailable: stopContext.atr14 != null,
  };
}

export interface SPXWinRateBacktestResult {
  dateRange: { from: string; to: string };
  sourceUsed: InternalBacktestSource | 'none';
  setupCount: number;
  evaluatedSetupCount: number;
  skippedSetupCount: number;
  ambiguousBarCount: number;
  missingTarget2Count: number;
  missingBarsSessions: string[];
  requestedResolution: SPXBacktestPriceResolution;
  resolutionUsed: 'minute' | 'second' | 'none';
  resolutionFallbackSessions: string[];
  usedMassiveMinuteBars: boolean;
  executionModel: SPXBacktestExecutionModel;
  profitability: SPXBacktestProfitabilityMetrics;
  notes: string[];
  analytics: SPXWinRateAnalytics;
  rows?: SetupInstanceRow[];
}

function toEpochMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseSetupTradeManagement(value: unknown): BacktestSetupCandidate['tradeManagement'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const partialRaw = toFiniteNumber(candidate.partialAtT1Pct);
  const partialAtT1Pct = partialRaw == null ? null : clamp(partialRaw, 0, 1);
  const moveStopRaw = candidate.moveStopToBreakeven;
  const moveStopToBreakeven = typeof moveStopRaw === 'boolean' ? moveStopRaw : null;
  if (partialAtT1Pct == null || moveStopToBreakeven == null) return null;
  return {
    partialAtT1Pct,
    moveStopToBreakeven,
  };
}

function isMissingTableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('could not find the table') || normalized.includes('does not exist');
}

function parseStringSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

async function loadBacktestPauseFilters(input: {
  includePausedSetups: boolean;
  requireOptimizerProfile?: boolean;
}): Promise<BacktestPauseFilters> {
  const requireOptimizerProfile = input.requireOptimizerProfile === true;
  if (input.includePausedSetups && !requireOptimizerProfile) {
    return {
      pausedSetupTypes: new Set(),
      pausedCombos: new Set(),
      notes: [],
      optimizerProfile: null,
    };
  }

  const { data, error } = await supabase
    .from('spx_setup_optimizer_state')
    .select('profile')
    .eq('id', 'active')
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message)) {
      return {
        pausedSetupTypes: new Set(),
        pausedCombos: new Set(),
        notes: [
          'SPX optimizer state table unavailable; paused setup filters were not applied to backtest rows.',
        ],
        optimizerProfile: null,
      };
    }
    logger.warn('SPX backtest failed to load optimizer pause filters', {
      error: error.message,
    });
    return {
      pausedSetupTypes: new Set(),
      pausedCombos: new Set(),
      notes: [
        `Failed to load optimizer pause filters: ${error.message}`,
      ],
      optimizerProfile: null,
    };
  }

  const profile = data?.profile && typeof data.profile === 'object' && !Array.isArray(data.profile)
    ? data.profile as Record<string, unknown>
    : null;

  if (!profile) {
    return {
      pausedSetupTypes: new Set(),
      pausedCombos: new Set(),
      notes: [],
      optimizerProfile: null,
    };
  }

  const driftControl = profile.driftControl && typeof profile.driftControl === 'object' && !Array.isArray(profile.driftControl)
    ? profile.driftControl as Record<string, unknown>
    : null;
  const regimeGate = profile.regimeGate && typeof profile.regimeGate === 'object' && !Array.isArray(profile.regimeGate)
    ? profile.regimeGate as Record<string, unknown>
    : null;

  return {
    pausedSetupTypes: input.includePausedSetups
      ? new Set()
      : parseStringSet(driftControl?.pausedSetupTypes),
    pausedCombos: input.includePausedSetups
      ? new Set()
      : parseStringSet(regimeGate?.pausedCombos),
    notes: [],
    optimizerProfile: profile,
  };
}

function normalizeDateInput(value: string): string {
  return value.trim().slice(0, 10);
}

async function loadSetupsFromInstances(input: {
  from: string;
  to: string;
  includeBlockedSetups?: boolean;
  includeHiddenTiers?: boolean;
  includePausedSetups?: boolean;
  requireOptimizerProfile?: boolean;
}): Promise<{ setups: BacktestSetupCandidate[]; notes: string[]; tableMissing: boolean; optimizerProfile: Record<string, unknown> | null }> {
  const includeBlockedSetups = input.includeBlockedSetups === true;
  const includeHiddenTiers = input.includeHiddenTiers === true;
  const includePausedSetups = input.includePausedSetups === true;
  const pauseFilters = await loadBacktestPauseFilters({
    includePausedSetups,
    requireOptimizerProfile: input.requireOptimizerProfile,
  });
  const { data, error } = await supabase
    .from('spx_setup_instances')
    .select(
      [
        'engine_setup_id',
        'session_date',
        'setup_type',
        'direction',
        'regime',
        'tier',
        'entry_zone_low',
        'entry_zone_high',
        'stop_price',
        'target_1_price',
        'target_2_price',
        'first_seen_at',
        'triggered_at',
        'metadata',
      ].join(','),
    )
    .gte('session_date', input.from)
    .lte('session_date', input.to);

  if (error) {
    const tableMissing = isMissingTableError(error.message);
    return {
      setups: [],
      notes: [tableMissing
        ? 'spx_setup_instances table is not available in the connected Supabase project.'
        : `Failed to load spx_setup_instances: ${error.message}`],
      tableMissing,
      optimizerProfile: pauseFilters.optimizerProfile,
    };
  }

  const rows = (Array.isArray(data) ? data : []) as unknown as Record<string, unknown>[];
  const setups: BacktestSetupCandidate[] = [];
  let skipped = 0;
  let skippedBlocked = 0;
  let skippedHidden = 0;
  let skippedPausedSetupType = 0;
  let skippedPausedCombo = 0;

  for (const row of rows) {
    const direction = row.direction === 'bullish' || row.direction === 'bearish'
      ? row.direction
      : null;
    const entryLow = toFiniteNumber(row.entry_zone_low);
    const entryHigh = toFiniteNumber(row.entry_zone_high);
    const stopPrice = toFiniteNumber(row.stop_price);
    const target1Price = toFiniteNumber(row.target_1_price);
    const target2Price = toFiniteNumber(row.target_2_price);

    if (!direction || entryLow == null || entryHigh == null || stopPrice == null || target1Price == null) {
      skipped += 1;
      continue;
    }

    const engineSetupId = typeof row.engine_setup_id === 'string' ? row.engine_setup_id : '';
    const sessionDate = typeof row.session_date === 'string' ? row.session_date : '';
    const setupType = typeof row.setup_type === 'string' ? row.setup_type : 'unknown';
    const tier = typeof row.tier === 'string' ? row.tier : null;
    if (!engineSetupId || !sessionDate) {
      skipped += 1;
      continue;
    }

    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {};
    const tradeManagement = parseSetupTradeManagement(metadata.tradeManagement);
    const gateStatus = metadata.gateStatus === 'blocked'
      ? 'blocked'
      : metadata.gateStatus === 'eligible'
        ? 'eligible'
        : null;
    if (!includeBlockedSetups && gateStatus === 'blocked') {
      skippedBlocked += 1;
      continue;
    }
    if (!includeHiddenTiers && tier === 'hidden') {
      skippedHidden += 1;
      continue;
    }
    if (!includePausedSetups && pauseFilters.pausedSetupTypes.has(setupType)) {
      skippedPausedSetupType += 1;
      continue;
    }
    const regime = typeof row.regime === 'string' ? row.regime : null;
    const comboKey = regime ? `${setupType}|${regime}` : null;
    if (!includePausedSetups && comboKey && pauseFilters.pausedCombos.has(comboKey)) {
      skippedPausedCombo += 1;
      continue;
    }

    setups.push({
      engineSetupId,
      sessionDate,
      setupType,
      direction,
      regime,
      tier: typeof row.tier === 'string' ? row.tier : null,
      gateStatus,
      entryLow,
      entryHigh,
      stopPrice,
      target1Price,
      target2Price,
      firstSeenAt: typeof row.first_seen_at === 'string' ? row.first_seen_at : null,
      triggeredAt: typeof row.triggered_at === 'string' ? row.triggered_at : null,
      tradeManagement,
      metadata,
    });
  }

  const notes: string[] = [...pauseFilters.notes];
  if (skipped > 0) {
    notes.push(`Skipped ${skipped} malformed spx_setup_instances rows during backtest setup load.`);
  }
  if (skippedBlocked > 0) {
    notes.push(`Skipped ${skippedBlocked} gate-blocked spx_setup_instances rows (non-actionable).`);
  }
  if (skippedHidden > 0) {
    notes.push(`Skipped ${skippedHidden} hidden-tier spx_setup_instances rows (non-actionable).`);
  }
  if (skippedPausedSetupType > 0) {
    notes.push(`Skipped ${skippedPausedSetupType} paused-setup-type rows via optimizer profile.`);
  }
  if (skippedPausedCombo > 0) {
    notes.push(`Skipped ${skippedPausedCombo} paused setup/regime combo rows via optimizer profile.`);
  }

  return {
    setups,
    notes,
    tableMissing: false,
    optimizerProfile: pauseFilters.optimizerProfile,
  };
}

function buildBarPath(bar: MassiveAggregate): number[] {
  if (bar.c >= bar.o) {
    return [bar.o, bar.l, bar.h, bar.c];
  }
  return [bar.o, bar.h, bar.l, bar.c];
}

function applyEntryFillPrice(
  direction: 'bullish' | 'bearish',
  triggerPrice: number,
  executionModel: SPXBacktestExecutionModel,
): number {
  if (!executionModel.enabled) return triggerPrice;
  if (direction === 'bullish') return triggerPrice + executionModel.entrySlipPoints;
  return triggerPrice - executionModel.entrySlipPoints;
}

function effectiveTargetPrice(
  direction: 'bullish' | 'bearish',
  targetPrice: number,
  executionModel: SPXBacktestExecutionModel,
): number {
  if (!executionModel.enabled) return targetPrice;
  if (direction === 'bullish') return targetPrice + executionModel.targetSlipPoints;
  return targetPrice - executionModel.targetSlipPoints;
}

function effectiveInitialStopPrice(
  direction: 'bullish' | 'bearish',
  stopPrice: number,
  executionModel: SPXBacktestExecutionModel,
): number {
  if (!executionModel.enabled) return stopPrice;
  if (direction === 'bullish') return stopPrice + executionModel.stopSlipPoints;
  return stopPrice - executionModel.stopSlipPoints;
}

function findEntryTriggerPrice(
  start: number,
  end: number,
  entryLow: number,
  entryHigh: number,
): number | null {
  const zoneLow = Math.min(entryLow, entryHigh);
  const zoneHigh = Math.max(entryLow, entryHigh);
  const inZone = (price: number) => price >= zoneLow && price <= zoneHigh;

  if (inZone(start)) return start;
  if (start === end) return null;
  if (end > start) {
    if (start < zoneLow && end >= zoneLow) return zoneLow;
    if (start > zoneHigh && end <= zoneHigh) return zoneHigh;
    return null;
  }

  if (start > zoneHigh && end <= zoneHigh) return zoneHigh;
  if (start < zoneLow && end >= zoneLow) return zoneLow;
  return null;
}

function barContainsAmbiguity(
  setup: BacktestSetupCandidate,
  bar: MassiveAggregate,
): boolean {
  if (setup.direction === 'bullish') {
    const stopTouched = bar.l <= setup.stopPrice;
    const targetTouched = bar.h >= setup.target1Price;
    return stopTouched && targetTouched;
  }

  const stopTouched = bar.h >= setup.stopPrice;
  const targetTouched = bar.l <= setup.target1Price;
  return stopTouched && targetTouched;
}

function evaluateSetupAgainstBars(
  setup: BacktestSetupCandidate,
  bars: MassiveAggregate[],
  executionModel: SPXBacktestExecutionModel = resolveExecutionModel({ enabled: false }),
  options?: { respectPersistedTriggeredAt?: boolean },
): EvaluatedSetup {
  const effectiveExecutionModel = resolveExecutionModel({
    ...executionModel,
    partialAtT1Pct: setup.tradeManagement?.partialAtT1Pct ?? executionModel.partialAtT1Pct,
    moveStopToBreakevenAfterT1: setup.tradeManagement?.moveStopToBreakeven ?? executionModel.moveStopToBreakevenAfterT1,
  });
  let triggeredAt = options?.respectPersistedTriggeredAt === true
    ? setup.triggeredAt
    : null;
  let t1HitAt: string | null = null;
  let t2HitAt: string | null = null;
  let stopHitAt: string | null = null;
  let finalOutcome: SetupFinalOutcome | null = null;
  let resolvedAt: string | null = null;
  let ambiguityCount = 0;

  const firstSeenEpoch = toEpochMs(setup.firstSeenAt);
  let triggered = triggeredAt != null;
  let lastObservedIso: string | null = null;
  let lastObservedPrice: number | null = null;
  let entryFillPrice: number | null = null;
  const entryMidPrice = round((setup.entryLow + setup.entryHigh) / 2, 2);
  const target1PriceEffective = effectiveTargetPrice(setup.direction, setup.target1Price, effectiveExecutionModel);
  const target2PriceEffective = setup.target2Price == null
    ? null
    : effectiveTargetPrice(setup.direction, setup.target2Price, effectiveExecutionModel);
  const initialStopPriceEffective = effectiveInitialStopPrice(setup.direction, setup.stopPrice, effectiveExecutionModel);

  if (triggered) {
    entryFillPrice = entryMidPrice;
  }

  const activeStopPrice = (): number => {
    if (t1HitAt && effectiveExecutionModel.moveStopToBreakevenAfterT1) {
      return entryFillPrice ?? entryMidPrice;
    }
    return initialStopPriceEffective;
  };

  const markStop = (tsIso: string): void => {
    if (finalOutcome) return;
    stopHitAt = stopHitAt || tsIso;
    resolvedAt = tsIso;
    finalOutcome = t1HitAt ? 't1_before_stop' : 'stop_before_t1';
  };

  const markT1 = (tsIso: string): void => {
    if (!t1HitAt) t1HitAt = tsIso;
  };

  const markT2 = (tsIso: string): void => {
    if (finalOutcome) return;
    if (!t1HitAt) t1HitAt = tsIso;
    t2HitAt = t2HitAt || tsIso;
    resolvedAt = tsIso;
    finalOutcome = 't2_before_stop';
  };

  const applyPointState = (price: number, tsIso: string): void => {
    if (finalOutcome) return;
    if (setup.direction === 'bullish') {
      if (price <= activeStopPrice()) {
        markStop(tsIso);
        return;
      }
      if (target2PriceEffective != null && price >= target2PriceEffective) {
        markT2(tsIso);
        return;
      }
      if (price >= target1PriceEffective) {
        markT1(tsIso);
      }
      return;
    }

    if (price >= activeStopPrice()) {
      markStop(tsIso);
      return;
    }
    if (target2PriceEffective != null && price <= target2PriceEffective) {
      markT2(tsIso);
      return;
    }
    if (price <= target1PriceEffective) {
      markT1(tsIso);
    }
  };

  const applySegmentMovement = (start: number, end: number, tsIso: string): void => {
    if (finalOutcome || start === end) return;

    if (setup.direction === 'bullish') {
      if (end > start) {
        if (!t1HitAt && target1PriceEffective > start && target1PriceEffective <= end) {
          markT1(tsIso);
        }
        if (target2PriceEffective != null && target2PriceEffective > start && target2PriceEffective <= end) {
          markT2(tsIso);
        }
        return;
      }

      const stopPrice = activeStopPrice();
      if (start > stopPrice && end <= stopPrice) {
        markStop(tsIso);
      }
      return;
    }

    if (end < start) {
      if (!t1HitAt && target1PriceEffective < start && target1PriceEffective >= end) {
        markT1(tsIso);
      }
      if (target2PriceEffective != null && target2PriceEffective < start && target2PriceEffective >= end) {
        markT2(tsIso);
      }
      return;
    }

    const stopPrice = activeStopPrice();
    if (start < stopPrice && end >= stopPrice) {
      markStop(tsIso);
    }
  };

  for (const bar of bars) {
    if (firstSeenEpoch != null && bar.t < firstSeenEpoch) continue;
    if (!Number.isFinite(bar.o) || !Number.isFinite(bar.h) || !Number.isFinite(bar.l) || !Number.isFinite(bar.c)) continue;

    const barIso = new Date(bar.t).toISOString();
    lastObservedIso = barIso;
    lastObservedPrice = bar.c;
    const path = buildBarPath(bar);
    let ambiguityCountedForBar = false;

    for (let i = 0; i < path.length - 1; i += 1) {
      let segmentStart = path[i];
      const segmentEnd = path[i + 1];

      if (!triggered) {
        const triggerPrice = findEntryTriggerPrice(segmentStart, segmentEnd, setup.entryLow, setup.entryHigh);
        if (triggerPrice == null) continue;

        triggered = true;
        triggeredAt = triggeredAt || barIso;
        entryFillPrice = applyEntryFillPrice(setup.direction, triggerPrice, effectiveExecutionModel);
        segmentStart = triggerPrice;
      }

      if (!ambiguityCountedForBar && barContainsAmbiguity(setup, bar)) {
        ambiguityCount += 1;
        ambiguityCountedForBar = true;
      }

      applyPointState(segmentStart, barIso);
      if (finalOutcome) break;
      applySegmentMovement(segmentStart, segmentEnd, barIso);
      if (finalOutcome) break;
      applyPointState(segmentEnd, barIso);
      if (finalOutcome) break;
    }

    if (finalOutcome) break;
  }

  if (triggered && !finalOutcome) {
    finalOutcome = t1HitAt ? 't1_before_stop' : 'expired_unresolved';
    resolvedAt = lastObservedIso || triggeredAt;
  }

  if (resolvedAt && finalOutcome == null) {
    logger.warn('Backtest produced resolved_at without final_outcome', {
      setupId: setup.engineSetupId,
      resolvedAt,
    });
  }

  let realizedR: number | null = null;
  if (triggered && finalOutcome) {
    const outcome = finalOutcome as SetupFinalOutcome;
    const entryPrice = entryFillPrice ?? entryMidPrice;
    const riskR = Math.max(0.25, Math.abs(entryPrice - setup.stopPrice));
    const target1R = Math.abs(setup.target1Price - entryPrice) / riskR;
    const target2R = setup.target2Price == null
      ? null
      : Math.abs(setup.target2Price - entryPrice) / riskR;
    const commissionR = effectiveExecutionModel.enabled ? effectiveExecutionModel.commissionPerTradeR : 0;
    const partialAtT1Pct = effectiveExecutionModel.enabled ? effectiveExecutionModel.partialAtT1Pct : 0.5;
    const runnerWeight = 1 - partialAtT1Pct;
    const runnerMarkToCloseR = (): number => {
      const markPrice = lastObservedPrice ?? entryPrice;
      const directionalMove = setup.direction === 'bullish'
        ? markPrice - entryPrice
        : entryPrice - markPrice;
      return directionalMove / riskR;
    };

    if (outcome === 't2_before_stop') {
      const r2 = target2R ?? target1R;
      realizedR = (partialAtT1Pct * target1R) + ((1 - partialAtT1Pct) * r2) - commissionR;
    } else if (outcome === 't1_before_stop') {
      const runnerR = stopHitAt
        ? (effectiveExecutionModel.moveStopToBreakevenAfterT1 ? 0 : -1)
        : runnerMarkToCloseR();
      realizedR = (partialAtT1Pct * target1R) + (runnerWeight * runnerR) - commissionR;
    } else if (outcome === 'stop_before_t1') {
      realizedR = -1 - commissionR;
    } else if (outcome === 'expired_unresolved') {
      realizedR = runnerMarkToCloseR() - commissionR;
    } else {
      realizedR = -commissionR;
    }

    realizedR = round(realizedR, 4);
  }

  return {
    row: {
      engine_setup_id: setup.engineSetupId,
      session_date: setup.sessionDate,
      setup_type: setup.setupType,
      direction: setup.direction,
      regime: setup.regime,
      tier: setup.tier,
      triggered_at: triggered ? (triggeredAt || setup.firstSeenAt || null) : null,
      final_outcome: triggered ? finalOutcome : null,
      t1_hit_at: triggered ? t1HitAt : null,
      t2_hit_at: triggered ? t2HitAt : null,
      stop_hit_at: triggered ? stopHitAt : null,
      realized_r: triggered ? realizedR : null,
      entry_fill_price: triggered ? round(entryFillPrice ?? entryMidPrice, 2) : null,
    },
    ambiguityCount,
    missingTarget2: setup.target2Price == null,
    realizedR,
  };
}

async function loadSecondBars(sessionDate: string): Promise<MassiveAggregate[]> {
  const response = await getAggregates('I:SPX', 1, 'second', sessionDate, sessionDate);
  return response.results || [];
}

async function loadBarsBySessionDateWithResolution(
  sessionDates: string[],
  requestedResolution: SPXBacktestPriceResolution,
): Promise<{
  barsBySession: Map<string, MassiveAggregate[]>;
  missingBarsSessions: string[];
  resolutionUsed: 'minute' | 'second' | 'none';
  resolutionFallbackSessions: string[];
  usedMassiveMinuteBars: boolean;
}> {
  const uniqueDates = Array.from(new Set(sessionDates)).sort();
  const barsBySession = new Map<string, MassiveAggregate[]>();
  const missingBarsSessions: string[] = [];
  const resolutionFallbackSessions: string[] = [];
  let loadedSecond = 0;
  let loadedMinute = 0;

  for (const sessionDate of uniqueDates) {
    try {
      let bars: MassiveAggregate[] = [];

      if (requestedResolution === 'second' || requestedResolution === 'auto') {
        try {
          bars = await loadSecondBars(sessionDate);
          if (bars.length > 0) {
            loadedSecond += 1;
          }
        } catch (error) {
          logger.warn('SPX win-rate backtest failed to load second bars', {
            sessionDate,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (bars.length === 0 && (requestedResolution === 'minute' || requestedResolution === 'auto')) {
        bars = await getMinuteAggregates('I:SPX', sessionDate);
        if (bars.length > 0) {
          loadedMinute += 1;
          if (requestedResolution === 'auto') {
            resolutionFallbackSessions.push(sessionDate);
          }
        }
      }

      if (!Array.isArray(bars) || bars.length === 0) {
        missingBarsSessions.push(sessionDate);
        barsBySession.set(sessionDate, []);
        continue;
      }

      barsBySession.set(
        sessionDate,
        [...bars].sort((a, b) => a.t - b.t),
      );
    } catch (error) {
      missingBarsSessions.push(sessionDate);
      barsBySession.set(sessionDate, []);
      logger.warn('SPX win-rate backtest failed to load minute bars', {
        sessionDate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const resolutionUsed: 'minute' | 'second' | 'none' = loadedSecond > 0
    ? 'second'
    : loadedMinute > 0
      ? 'minute'
      : 'none';

  return {
    barsBySession,
    missingBarsSessions,
    resolutionUsed,
    resolutionFallbackSessions,
    usedMassiveMinuteBars: loadedMinute > 0,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function emptyProfitabilityMetrics(): SPXBacktestProfitabilityMetrics {
  return {
    triggeredCount: 0,
    resolvedCount: 0,
    withRealizedRCount: 0,
    averageRealizedR: 0,
    medianRealizedR: 0,
    cumulativeRealizedR: 0,
    expectancyR: 0,
    positiveRealizedRatePct: 0,
    bySetupType: [],
  };
}

function buildProfitabilityMetrics(evaluated: EvaluatedSetup[]): SPXBacktestProfitabilityMetrics {
  const triggered = evaluated.filter((entry) => Boolean(entry.row.triggered_at));
  if (triggered.length === 0) return emptyProfitabilityMetrics();

  const resolvedCount = triggered.filter((entry) => entry.row.final_outcome != null).length;
  const realizedRows = triggered.filter((entry) => typeof entry.realizedR === 'number' && Number.isFinite(entry.realizedR));
  const realizedValues = realizedRows.map((entry) => entry.realizedR as number);
  const cumulativeRealizedR = realizedValues.reduce((sum, value) => sum + value, 0);
  const averageRealizedR = realizedValues.length > 0 ? cumulativeRealizedR / realizedValues.length : 0;
  const positiveRealizedCount = realizedValues.filter((value) => value > 0).length;

  const bySetupTypeMap = new Map<string, { count: number; cumulative: number }>();
  for (const entry of realizedRows) {
    const key = entry.row.setup_type || 'unknown';
    const current = bySetupTypeMap.get(key) || { count: 0, cumulative: 0 };
    current.count += 1;
    current.cumulative += entry.realizedR as number;
    bySetupTypeMap.set(key, current);
  }

  const bySetupType = Array.from(bySetupTypeMap.entries())
    .map(([key, value]) => ({
      key,
      tradeCount: value.count,
      averageRealizedR: value.count > 0 ? round(value.cumulative / value.count, 4) : 0,
      cumulativeRealizedR: round(value.cumulative, 4),
    }))
    .sort((a, b) => b.tradeCount - a.tradeCount || a.key.localeCompare(b.key));

  return {
    triggeredCount: triggered.length,
    resolvedCount,
    withRealizedRCount: realizedValues.length,
    averageRealizedR: round(averageRealizedR, 4),
    medianRealizedR: round(median(realizedValues), 4),
    cumulativeRealizedR: round(cumulativeRealizedR, 4),
    expectancyR: round(averageRealizedR, 4),
    positiveRealizedRatePct: realizedValues.length > 0
      ? round((positiveRealizedCount / realizedValues.length) * 100, 2)
      : 0,
    bySetupType,
  };
}

export async function runSPXWinRateBacktest(input: {
  from: string;
  to: string;
  source?: SPXWinRateBacktestSource;
  resolution?: SPXBacktestPriceResolution;
  includeRows?: boolean;
  includeBlockedSetups?: boolean;
  includeHiddenTiers?: boolean;
  includePausedSetups?: boolean;
  geometryBySetupType?: Record<string, SPXBacktestGeometryAdjustment>;
  executionModel?: Partial<SPXBacktestExecutionModel>;
  recomputeStops?: boolean;
}): Promise<SPXWinRateBacktestResult> {
  const from = normalizeDateInput(input.from);
  const to = normalizeDateInput(input.to);
  const resolution = input.resolution || 'second';
  const includeRows = input.includeRows === true;
  const recomputeStops = input.recomputeStops === true;
  const executionModel = resolveExecutionModel(input.executionModel);
  const notes: string[] = [];

  let selectedSource: InternalBacktestSource | 'none' = 'none';
  let setups: BacktestSetupCandidate[] = [];
  let skippedSetupCount = 0;
  let geometryAdjustedCount = 0;

  const instanceLoad = await loadSetupsFromInstances({
    from,
    to,
    includeBlockedSetups: input.includeBlockedSetups,
    includeHiddenTiers: input.includeHiddenTiers,
    includePausedSetups: input.includePausedSetups,
    requireOptimizerProfile: recomputeStops,
  });
  notes.push(...instanceLoad.notes);
  selectedSource = 'spx_setup_instances';
  setups = instanceLoad.setups;

  if (setups.length === 0) {
    const emptyAnalytics = summarizeSPXWinRateRows([], { from, to });
    notes.push('No backtestable setups found for the requested date range.');
    return {
      dateRange: { from, to },
      sourceUsed: selectedSource,
      setupCount: 0,
      evaluatedSetupCount: 0,
      skippedSetupCount: 0,
      ambiguousBarCount: 0,
      missingTarget2Count: 0,
      missingBarsSessions: [],
      requestedResolution: resolution,
      resolutionUsed: 'none',
      resolutionFallbackSessions: [],
      usedMassiveMinuteBars: false,
      executionModel,
      profitability: emptyProfitabilityMetrics(),
      notes,
      analytics: emptyAnalytics,
      ...(includeRows ? { rows: [] } : {}),
    };
  }

  const geometryBySetupType = (
    input.geometryBySetupType
    && typeof input.geometryBySetupType === 'object'
    && !Array.isArray(input.geometryBySetupType)
  )
    ? input.geometryBySetupType
    : null;
  if (geometryBySetupType) {
    setups = setups.map((setup) => {
      const adjustment = resolveGeometryAdjustmentForSetup(setup, geometryBySetupType);
      const adjusted = applyGeometryAdjustment(setup, adjustment);
      if (
        adjusted.stopPrice !== setup.stopPrice
        || adjusted.target1Price !== setup.target1Price
        || adjusted.target2Price !== setup.target2Price
      ) {
        geometryAdjustedCount += 1;
      }
      return adjusted;
    });
    if (geometryAdjustedCount > 0) {
      notes.push(`Applied geometry adjustments to ${geometryAdjustedCount} setups via geometryBySetupType.`);
    }
  }

  if (recomputeStops) {
    const optimizerProfile = instanceLoad.optimizerProfile;
    let recomputeChangedCount = 0;
    let recomputeUsedBaseStopMetadataCount = 0;
    let recomputeUsedProfileStopScaleFallbackCount = 0;
    let recomputeAtrAvailableCount = 0;

    setups = setups.map((setup) => {
      const recomputed = recomputeStopPriceForBacktestSetup({
        setup,
        optimizerProfile,
      });
      if (recomputed.changed) recomputeChangedCount += 1;
      if (recomputed.usedBaseStopMetadata) recomputeUsedBaseStopMetadataCount += 1;
      if (recomputed.usedProfileStopScaleFallback) recomputeUsedProfileStopScaleFallbackCount += 1;
      if (recomputed.atrAvailable) recomputeAtrAvailableCount += 1;
      return {
        ...setup,
        stopPrice: recomputed.stopPrice,
      };
    });

    notes.push(
      `Recomputed adaptive stops for ${setups.length} setups (changed ${recomputeChangedCount} stop prices).`,
    );
    if (recomputeUsedBaseStopMetadataCount > 0) {
      notes.push(
        `Recompute used persisted base-stop metadata for ${recomputeUsedBaseStopMetadataCount} setups.`,
      );
    } else {
      notes.push(
        'Recompute fallback: no persisted base-stop metadata found, so persisted stop_price was used as the base stop with neutral non-ATR scaling.',
      );
    }
    if (recomputeUsedProfileStopScaleFallbackCount > 0) {
      notes.push(
        `Recompute used optimizer-profile geometry stopScale fallback for ${recomputeUsedProfileStopScaleFallbackCount} setups.`,
      );
    } else if (!optimizerProfile) {
      notes.push(
        'Optimizer profile unavailable during recompute; geometry stopScale fallback remained at 1 when setup metadata was missing.',
      );
    }
    if (recomputeAtrAvailableCount === 0) {
      notes.push(
        'No ATR14 metadata found in recomputed setups; regime-aware ATR floor could not materially adjust stop distances for this dataset.',
      );
    }
  }

  const {
    barsBySession,
    missingBarsSessions,
    resolutionUsed,
    resolutionFallbackSessions,
    usedMassiveMinuteBars,
  } = await loadBarsBySessionDateWithResolution(
    setups.map((setup) => setup.sessionDate),
    resolution,
  );

  const evaluated: EvaluatedSetup[] = [];
  for (const setup of setups) {
    const bars = barsBySession.get(setup.sessionDate) || [];
    if (bars.length === 0) {
      skippedSetupCount += 1;
      continue;
    }

    evaluated.push(evaluateSetupAgainstBars(setup, bars, executionModel, {
      respectPersistedTriggeredAt: false,
    }));
  }

  const rows = evaluated.map((entry) => entry.row);
  const analytics = summarizeSPXWinRateRows(rows, { from, to });
  const profitability = buildProfitabilityMetrics(evaluated);
  const ambiguousBarCount = evaluated.reduce((sum, row) => sum + row.ambiguityCount, 0);
  const missingTarget2Count = evaluated.reduce((sum, row) => sum + (row.missingTarget2 ? 1 : 0), 0);

  if (missingTarget2Count > 0) {
    notes.push(`Target2 missing for ${missingTarget2Count} setups in backtest source.`);
  }
  if (missingBarsSessions.length > 0) {
    notes.push(`No SPX historical bars were returned for ${missingBarsSessions.length} session dates.`);
  }
  if (resolutionFallbackSessions.length > 0) {
    notes.push(`Second bars unavailable for ${resolutionFallbackSessions.length} sessions; used minute bars fallback.`);
  }

  return {
    dateRange: { from, to },
    sourceUsed: selectedSource,
    setupCount: setups.length,
    evaluatedSetupCount: evaluated.length,
    skippedSetupCount,
    ambiguousBarCount,
    missingTarget2Count,
    missingBarsSessions,
    requestedResolution: resolution,
    resolutionUsed,
    resolutionFallbackSessions,
    usedMassiveMinuteBars,
    executionModel,
    profitability,
    notes,
    analytics,
    ...(includeRows ? { rows } : {}),
  };
}

export const __testables = {
  evaluateSetupAgainstBars,
  findEntryTriggerPrice,
  buildBarPath,
  recomputeStopPriceForBacktestSetup,
};
