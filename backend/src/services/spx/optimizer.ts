import { cacheGet, cacheSet } from '../../config/redis';
import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import type { SetupStatus, SetupType } from './types';
import type { SetupFinalOutcome } from './outcomeTracker';
import { runSPXWinRateBacktest } from './winRateBacktest';

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
  walkForward: {
    trainingDays: number;
    validationDays: number;
    minTrades: number;
    objectiveWeights: {
      t1: number;
      t2: number;
      failurePenalty: number;
    };
  };
  driftControl: {
    enabled: boolean;
    shortWindowDays: number;
    longWindowDays: number;
    maxDropPct: number;
    minLongWindowTrades: number;
    pausedSetupTypes: string[];
  };
}

export interface SPXOptimizationScanResult {
  profile: SPXOptimizationProfile;
  scorecard: SPXOptimizerScorecard;
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
  objectiveScore: number;
}

export interface SPXPerformanceBucket {
  key: string;
  tradeCount: number;
  resolvedCount: number;
  t1WinRatePct: number;
  t2WinRatePct: number;
  failureRatePct: number;
}

interface SPXDriftAlert {
  setupType: string;
  shortWindowDays: number;
  longWindowDays: number;
  shortT1WinRatePct: number;
  longT1WinRatePct: number;
  dropPct: number;
  action: 'pause';
}

interface OptimizationRow {
  engine_setup_id: string;
  session_date: string;
  setup_type: string;
  regime: string | null;
  first_seen_at: string | null;
  triggered_at: string | null;
  final_outcome: SetupFinalOutcome | null;
  p_win_calibrated: number | string | null;
  ev_r: number | string | null;
  metadata: Record<string, unknown> | null;
}

interface OutcomeOverride {
  triggeredAt: string | null;
  finalOutcome: SetupFinalOutcome | null;
}

interface PreparedOptimizationRow {
  sessionDate: string;
  setupType: string;
  regime: string;
  comboKey: string;
  firstSeenAt: string | null;
  firstSeenMinuteEt: number | null;
  triggered: boolean;
  finalOutcome: SetupFinalOutcome | null;
  pWinCalibrated: number | null;
  evR: number | null;
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

const DEFAULT_PROFILE: SPXOptimizationProfile = {
  source: 'default',
  generatedAt: new Date(0).toISOString(),
  qualityGate: {
    minConfluenceScore: 4,
    minPWinCalibrated: 0.6,
    minEvR: 0.25,
    actionableStatuses: ['ready', 'triggered'],
  },
  flowGate: {
    requireFlowConfirmation: true,
    minAlignmentPct: 55,
  },
  indicatorGate: {
    requireEmaAlignment: false,
    requireVolumeRegimeAlignment: false,
  },
  timingGate: {
    enabled: false,
    maxFirstSeenMinuteBySetupType: { ...DEFAULT_MAX_FIRST_SEEN_MINUTE_BY_SETUP_TYPE },
  },
  regimeGate: {
    minTradesPerCombo: 12,
    minT1WinRatePct: 48,
    pausedCombos: [],
  },
  tradeManagement: {
    partialAtT1Pct: 0.5,
    moveStopToBreakeven: true,
  },
  walkForward: {
    trainingDays: 20,
    validationDays: 5,
    minTrades: 12,
    objectiveWeights: {
      t1: 0.6,
      t2: 0.4,
      failurePenalty: 0.45,
    },
  },
  driftControl: {
    enabled: true,
    shortWindowDays: 5,
    longWindowDays: 20,
    maxDropPct: 12,
    minLongWindowTrades: 20,
    pausedSetupTypes: [],
  },
};
const WEEKLY_AUTO_MIN_VALIDATION_TRADES = 12;
const WEEKLY_AUTO_MIN_OBJECTIVE_DELTA = 0.5;
const WEEKLY_AUTO_MAX_T2_DROP_PCT = 2;

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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
  return {
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
      partialAtT1Pct: toFiniteNumber(candidate.tradeManagement?.partialAtT1Pct) ?? DEFAULT_PROFILE.tradeManagement.partialAtT1Pct,
      moveStopToBreakeven: candidate.tradeManagement?.moveStopToBreakeven !== false,
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
      pausedSetupTypes: Array.isArray(candidate.driftControl?.pausedSetupTypes)
        ? candidate.driftControl.pausedSetupTypes.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [],
    },
  };
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
  const emaAligned = metadata.emaAligned === true || confluenceSources.includes('ema_alignment');
  const volumeRegimeAligned = metadata.volumeRegimeAligned === true || confluenceSources.includes('volume_regime_alignment');
  const regime = typeof row.regime === 'string' && row.regime.length > 0 ? row.regime : 'unknown';
  const setupType = typeof row.setup_type === 'string' && row.setup_type.length > 0 ? row.setup_type : 'unknown';

  return {
    sessionDate: row.session_date,
    setupType,
    regime,
    comboKey: `${setupType}|${regime}`,
    firstSeenAt: row.first_seen_at,
    firstSeenMinuteEt: toSessionMinuteEt(row.first_seen_at),
    triggered: typeof row.triggered_at === 'string' && row.triggered_at.length > 0,
    finalOutcome: row.final_outcome,
    pWinCalibrated: toFiniteNumber(row.p_win_calibrated),
    evR: toFiniteNumber(row.ev_r),
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
    });

    const map = new Map<string, OutcomeOverride>();
    for (const row of backtest.rows || []) {
      const key = optimizationRowKey(row.engine_setup_id, row.session_date);
      map.set(key, {
        triggeredAt: row.triggered_at,
        finalOutcome: row.final_outcome,
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
    objectiveScore: 0,
  };
}

function toMetrics(
  rows: PreparedOptimizationRow[],
  weights: SPXOptimizationProfile['walkForward']['objectiveWeights'],
): SPXOptimizationMetrics {
  const metrics = emptyMetrics();

  for (const row of rows) {
    if (!row.triggered) continue;
    metrics.tradeCount += 1;

    if (!row.finalOutcome) continue;
    metrics.resolvedCount += 1;

    if (row.finalOutcome === 't2_before_stop') {
      metrics.t2Wins += 1;
      metrics.t1Wins += 1;
      continue;
    }
    if (row.finalOutcome === 't1_before_stop') {
      metrics.t1Wins += 1;
      continue;
    }
    if (row.finalOutcome === 'stop_before_t1') {
      metrics.stopsBeforeT1 += 1;
    }
  }

  const denominator = metrics.resolvedCount;
  metrics.t1WinRatePct = denominator > 0 ? round((metrics.t1Wins / denominator) * 100, 2) : 0;
  metrics.t2WinRatePct = denominator > 0 ? round((metrics.t2Wins / denominator) * 100, 2) : 0;
  metrics.failureRatePct = denominator > 0 ? round((metrics.stopsBeforeT1 / denominator) * 100, 2) : 0;
  metrics.objectiveScore = round(
    (metrics.t1WinRatePct * weights.t1)
    + (metrics.t2WinRatePct * weights.t2)
    - (metrics.failureRatePct * weights.failurePenalty),
    2,
  );

  return metrics;
}

function candidateGrid(): ThresholdCandidate[] {
  const candidates: ThresholdCandidate[] = [];
  const alignmentGridByFlowGate: Record<'true' | 'false', number[]> = {
    true: [50, 55, 60],
    false: [0],
  };
  for (const minConfluenceScore of [3, 4, 5]) {
    for (const minPWinCalibrated of [0.58, 0.6, 0.62]) {
      for (const minEvR of [0.2, 0.25, 0.3]) {
        for (const requireFlowConfirmation of [true, false]) {
          for (const minAlignmentPct of alignmentGridByFlowGate[String(requireFlowConfirmation) as 'true' | 'false']) {
            for (const requireEmaAlignment of [false, true]) {
              for (const requireVolumeRegimeAlignment of [false, true]) {
                for (const enforceTimingGate of [true, false]) {
                  candidates.push({
                    requireFlowConfirmation,
                    minConfluenceScore,
                    minPWinCalibrated,
                    minEvR,
                    minAlignmentPct,
                    requireEmaAlignment,
                    requireVolumeRegimeAlignment,
                    enforceTimingGate,
                  });
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
      const metrics = toMetrics(keyRows, weights);
      return {
        key,
        tradeCount: metrics.tradeCount,
        resolvedCount: metrics.resolvedCount,
        t1WinRatePct: metrics.t1WinRatePct,
        t2WinRatePct: metrics.t2WinRatePct,
        failureRatePct: metrics.failureRatePct,
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
    ))
    .map((bucket) => bucket.key)
    .sort();
}

function resolveDriftAlerts(
  rows: PreparedOptimizationRow[],
  profile: SPXOptimizationProfile,
  toDate: string,
): SPXDriftAlert[] {
  if (!profile.driftControl.enabled) return [];

  const shortFrom = shiftDate(toDate, -(profile.driftControl.shortWindowDays - 1));
  const longFrom = shiftDate(toDate, -(profile.driftControl.longWindowDays - 1));
  const setupTypes = Array.from(new Set(rows.map((row) => row.setupType))).sort();
  const alerts: SPXDriftAlert[] = [];

  for (const setupType of setupTypes) {
    const shortRows = rows.filter((row) => row.setupType === setupType && row.sessionDate >= shortFrom);
    const longRows = rows.filter((row) => row.setupType === setupType && row.sessionDate >= longFrom);

    const shortMetrics = toMetrics(shortRows, profile.walkForward.objectiveWeights);
    const longMetrics = toMetrics(longRows, profile.walkForward.objectiveWeights);
    if (longMetrics.tradeCount < profile.driftControl.minLongWindowTrades) continue;

    const drop = round(longMetrics.t1WinRatePct - shortMetrics.t1WinRatePct, 2);
    if (drop < profile.driftControl.maxDropPct) continue;

    alerts.push({
      setupType,
      shortWindowDays: profile.driftControl.shortWindowDays,
      longWindowDays: profile.driftControl.longWindowDays,
      shortT1WinRatePct: shortMetrics.t1WinRatePct,
      longT1WinRatePct: longMetrics.t1WinRatePct,
      dropPct: drop,
      action: 'pause',
    });
  }

  return alerts;
}

function buildSetupActionRecommendations(input: {
  setupTypeBuckets: SPXPerformanceBucket[];
  pausedCombos: string[];
  driftAlerts: SPXDriftAlert[];
  baselineCandidate: ThresholdCandidate;
  optimizedCandidate: ThresholdCandidate;
  toDate: string;
  profile: SPXOptimizationProfile;
  rows: PreparedOptimizationRow[];
}): { add: string[]; update: string[]; remove: string[] } {
  const remove = new Set<string>();
  const add = new Set<string>();
  const update = new Set<string>();

  for (const combo of input.pausedCombos) {
    remove.add(`Pause ${combo}: T1 win rate below ${input.profile.regimeGate.minT1WinRatePct}% with sufficient sample.`);
  }

  for (const alert of input.driftAlerts) {
    remove.add(
      `Pause ${alert.setupType}: ${alert.shortWindowDays}d T1 win (${alert.shortT1WinRatePct}%) dropped ${alert.dropPct} pts vs ${alert.longWindowDays}d baseline (${alert.longT1WinRatePct}%).`,
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
  update.add('Trade management: take 50% at T1 and move stop to breakeven on remainder.');

  const shortFrom = shiftDate(input.toDate, -4);
  for (const bucket of input.setupTypeBuckets) {
    if (bucket.tradeCount < input.profile.walkForward.minTrades) continue;
    if (bucket.t1WinRatePct < 58) continue;
    const recentTrades = input.rows.filter(
      (row) => row.setupType === bucket.key && row.sessionDate >= shortFrom && row.triggered,
    ).length;
    if (recentTrades > 0) continue;
    add.add(`Add/enable ${bucket.key}: strong historical edge (${bucket.t1WinRatePct}% T1) but no recent deployment.`);
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
    .select('engine_setup_id,session_date,setup_type,regime,first_seen_at,triggered_at,final_outcome,p_win_calibrated,ev_r,metadata')
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
  };
  const timingMap = profile.timingGate.maxFirstSeenMinuteBySetupType;
  const eligibleRows = rows.filter((row) => passesCandidate(row, baselineCandidate, { timingMap }));
  const metrics = toMetrics(eligibleRows, profile.walkForward.objectiveWeights);

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
    },
    driftAlerts: [],
    setupTypePerformance: evaluateBuckets(eligibleRows, (row) => row.setupType, profile.walkForward.objectiveWeights),
    setupComboPerformance: evaluateBuckets(eligibleRows, (row) => row.comboKey, profile.walkForward.objectiveWeights),
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
  };
  const timingMap = profileForScan.timingGate.maxFirstSeenMinuteBySetupType;

  let bestCandidate = baselineCandidate;
  let bestTrainingMetrics = toMetrics(
    trainingRows.filter((row) => passesCandidate(row, baselineCandidate, { timingMap })),
    profileForScan.walkForward.objectiveWeights,
  );
  let hasQualifiedTrainingCandidate = bestTrainingMetrics.tradeCount >= profileForScan.walkForward.minTrades;

  for (const candidate of candidateGrid()) {
    const eligible = trainingRows.filter((row) => passesCandidate(row, candidate, { timingMap }));
    const metrics = toMetrics(eligible, profileForScan.walkForward.objectiveWeights);
    if (metrics.tradeCount < profileForScan.walkForward.minTrades) continue;
    if (hasQualifiedTrainingCandidate && metrics.objectiveScore <= bestTrainingMetrics.objectiveScore) continue;

    bestCandidate = candidate;
    bestTrainingMetrics = metrics;
    hasQualifiedTrainingCandidate = true;
  }

  const baselineValidationMetrics = toMetrics(
    validationRows.filter((row) => passesCandidate(row, baselineCandidate, { timingMap })),
    profileForScan.walkForward.objectiveWeights,
  );

  const optimizedValidationMetrics = toMetrics(
    validationRows.filter((row) => passesCandidate(row, bestCandidate, { timingMap })),
    profileForScan.walkForward.objectiveWeights,
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
  const t1WinRateDelta = round(optimizedValidationMetrics.t1WinRatePct - baselineValidationMetrics.t1WinRatePct, 2);
  const t2WinRateDelta = round(optimizedValidationMetrics.t2WinRatePct - baselineValidationMetrics.t2WinRatePct, 2);
  const weeklyGuardrailPassed = !weeklyAutoMode || (
    objectiveDelta >= WEEKLY_AUTO_MIN_OBJECTIVE_DELTA
    && t1WinRateDelta >= 0
    && t2WinRateDelta >= -WEEKLY_AUTO_MAX_T2_DROP_PCT
  );
  const optimizationApplied = (
    optimizedValidationMetrics.tradeCount >= requiredValidationTrades
    && (
      optimizedValidationMetrics.objectiveScore > baselineValidationMetrics.objectiveScore
      || (
        !baselineHasValidationTrades
        && optimizedValidationMetrics.objectiveScore > 0
      )
    )
    && weeklyGuardrailPassed
  );

  const activeCandidate = optimizationApplied ? bestCandidate : baselineCandidate;

  const setupTypePerformance = evaluateBuckets(
    rows.filter((row) => passesCandidate(row, activeCandidate, { timingMap })),
    (row) => row.setupType,
    profileForScan.walkForward.objectiveWeights,
  );
  const setupComboPerformance = evaluateBuckets(
    rows.filter((row) => passesCandidate(row, activeCandidate, { timingMap })),
    (row) => row.comboKey,
    profileForScan.walkForward.objectiveWeights,
  );

  const pausedCombos = resolvePausedCombos(setupComboPerformance, profileForScan);
  const driftAlerts = resolveDriftAlerts(
    rows.filter((row) => passesCandidate(row, activeCandidate, {
      pausedCombos: new Set(pausedCombos),
      timingMap,
    })),
    profileForScan,
    validationTo,
  );
  const driftPausedSetupTypes = Array.from(new Set(driftAlerts.map((alert) => alert.setupType))).sort();

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
      partialAtT1Pct: 0.5,
      moveStopToBreakeven: true,
    },
    driftControl: {
      ...profileForScan.driftControl,
      pausedSetupTypes: driftPausedSetupTypes,
    },
  }, new Date().toISOString());

  const setupActions = buildSetupActionRecommendations({
    setupTypeBuckets: setupTypePerformance,
    pausedCombos,
    driftAlerts,
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
        ? `Weekly auto guardrails: objective delta >= ${WEEKLY_AUTO_MIN_OBJECTIVE_DELTA}, T1 delta >= 0, T2 delta >= -${WEEKLY_AUTO_MAX_T2_DROP_PCT}, validation trades >= ${requiredValidationTrades}.`
        : 'Weekly auto guardrails not enforced for this scan mode.',
      `Flow gate: require flow confirmation=${nextProfile.flowGate.requireFlowConfirmation}, alignment floor=${nextProfile.flowGate.minAlignmentPct}.`,
      `Indicator gates: require EMA alignment=${nextProfile.indicatorGate.requireEmaAlignment}, require volume-regime alignment=${nextProfile.indicatorGate.requireVolumeRegimeAlignment}.`,
      `Timing gate: enforce=${nextProfile.timingGate.enabled}.`,
      `Trade management policy: ${nextProfile.tradeManagement.partialAtT1Pct * 100}% at T1, stop to breakeven=${nextProfile.tradeManagement.moveStopToBreakeven}.`,
      `Drift control paused ${driftPausedSetupTypes.length} setup types and regime gate paused ${pausedCombos.length} setup/regime combos.`,
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
