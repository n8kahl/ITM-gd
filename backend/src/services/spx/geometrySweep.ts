import { getAggregates, type MassiveAggregate } from '../../config/massive';
import { supabase } from '../../config/database';
import { __optimizerTestUtils } from './optimizer';
import {
  __testables,
  type SPXBacktestExecutionModel,
  type SPXBacktestGeometryAdjustment,
} from './winRateBacktest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SweepFamily = 'fade_at_wall' | 'mean_reversion' | 'trend_pullback' | 'orb_breakout';

export const ALL_SWEEP_FAMILIES: SweepFamily[] = ['fade_at_wall', 'mean_reversion', 'trend_pullback', 'orb_breakout'];

export interface SetupDbRow {
  engine_setup_id: string;
  session_date: string;
  setup_type: string;
  direction: 'bullish' | 'bearish' | null;
  regime: string | null;
  tier: string | null;
  entry_zone_low: number | string | null;
  entry_zone_high: number | string | null;
  stop_price: number | string | null;
  target_1_price: number | string | null;
  target_2_price: number | string | null;
  first_seen_at: string | null;
  triggered_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface EvalSetupCandidate {
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
}

export interface CandidateConfig {
  geometry: SPXBacktestGeometryAdjustment;
  partialAtT1Pct: number;
  moveStopToBreakeven: boolean;
  label: string;
}

export interface FamilyMetrics {
  family: SweepFamily;
  opportunities: number;
  triggered: number;
  resolved: number;
  t1WinRatePct: number;
  t2WinRatePct: number;
  failureRatePct: number;
  expectancyR: number;
  expectancyLowerBoundR: number;
  objectiveScore: number;
  objectiveScoreConservative: number;
}

export interface CandidateResult {
  config: CandidateConfig;
  metrics: FamilyMetrics;
}

export interface SweepFamilyResult {
  best: CandidateResult;
  baseline: CandidateResult;
  improved: boolean;
  delta: {
    objectiveConservative: number;
    expectancyR: number;
    t1WinRatePct: number;
    t2WinRatePct: number;
    failureRatePct: number;
  };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

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

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function lowerBoundMean(values: number[], z = 1.96): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const margin = z * (stdDev(values) / Math.sqrt(values.length));
  return avg - margin;
}

// ---------------------------------------------------------------------------
// Row conversion
// ---------------------------------------------------------------------------

function parseTradeManagement(metadata: Record<string, unknown> | null): EvalSetupCandidate['tradeManagement'] {
  const raw = metadata?.tradeManagement;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  const partial = toFiniteNumber(candidate.partialAtT1Pct);
  const moveBE = candidate.moveStopToBreakeven;
  if (partial == null || typeof moveBE !== 'boolean') return null;
  return {
    partialAtT1Pct: clamp(partial, 0, 1),
    moveStopToBreakeven: moveBE,
  };
}

export function toSetupCandidate(row: SetupDbRow): EvalSetupCandidate | null {
  if (row.direction !== 'bullish' && row.direction !== 'bearish') return null;
  const entryLow = toFiniteNumber(row.entry_zone_low);
  const entryHigh = toFiniteNumber(row.entry_zone_high);
  const stopPrice = toFiniteNumber(row.stop_price);
  const target1Price = toFiniteNumber(row.target_1_price);
  const target2Price = toFiniteNumber(row.target_2_price);
  if (entryLow == null || entryHigh == null || stopPrice == null || target1Price == null) return null;

  const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? row.metadata
    : {};
  const gateStatus = metadata.gateStatus === 'blocked'
    ? 'blocked'
    : metadata.gateStatus === 'eligible'
      ? 'eligible'
      : null;

  return {
    engineSetupId: row.engine_setup_id,
    sessionDate: row.session_date,
    setupType: row.setup_type,
    direction: row.direction,
    regime: row.regime,
    tier: row.tier,
    gateStatus,
    entryLow,
    entryHigh,
    stopPrice,
    target1Price,
    target2Price,
    firstSeenAt: row.first_seen_at,
    triggeredAt: row.triggered_at,
    tradeManagement: parseTradeManagement(metadata),
  };
}

// ---------------------------------------------------------------------------
// Geometry application
// ---------------------------------------------------------------------------

export function applyGeometry(
  setup: EvalSetupCandidate,
  adjustment: SPXBacktestGeometryAdjustment,
): EvalSetupCandidate {
  const stopScale = clamp(adjustment.stopScale ?? 1, 0.5, 2);
  const target1Scale = clamp(adjustment.target1Scale ?? 1, 0.5, 2);
  const target2Scale = clamp(adjustment.target2Scale ?? 1, 0.5, 2.5);

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
  const target2Distance = Math.max(
    target1Distance + 0.1,
    Math.abs((setup.target2Price ?? (entryMid + (directionMultiplier * target1Distance * 1.8))) - entryMid),
  );

  return {
    ...setup,
    stopPrice: round(entryMid - (directionMultiplier * stopDistance * stopScale), 4),
    target1Price: round(entryMid + (directionMultiplier * target1Distance * target1Scale), 4),
    target2Price: round(entryMid + (directionMultiplier * target2Distance * target2Scale), 4),
  };
}

function toBacktestSetup(setup: EvalSetupCandidate, config: CandidateConfig): EvalSetupCandidate {
  const geometryAdjusted = applyGeometry(setup, config.geometry);
  return {
    ...geometryAdjusted,
    tradeManagement: {
      partialAtT1Pct: config.partialAtT1Pct,
      moveStopToBreakeven: config.moveStopToBreakeven,
    },
  };
}

// ---------------------------------------------------------------------------
// Metrics computation
// ---------------------------------------------------------------------------

export function toFamilyMetrics(input: {
  family: SweepFamily;
  rows: Array<{ final_outcome: string | null; triggered_at: string | null; realized_r?: number | null }>;
  objectiveWeights: {
    t1: number;
    t2: number;
    failurePenalty: number;
    expectancyR: number;
  };
}): FamilyMetrics {
  const opportunities = input.rows.length;
  const triggeredRows = input.rows.filter((row) => typeof row.triggered_at === 'string' && row.triggered_at.length > 0);
  const resolvedRows = triggeredRows.filter((row) => row.final_outcome != null);

  const t1Wins = resolvedRows.filter((row) => row.final_outcome === 't2_before_stop' || row.final_outcome === 't1_before_stop').length;
  const t2Wins = resolvedRows.filter((row) => row.final_outcome === 't2_before_stop').length;
  const stops = resolvedRows.filter((row) => row.final_outcome === 'stop_before_t1').length;

  const realized = resolvedRows
    .map((row) => (typeof row.realized_r === 'number' && Number.isFinite(row.realized_r) ? row.realized_r : null))
    .filter((value): value is number => value != null);

  const resolvedCount = resolvedRows.length;
  const t1WinRatePct = resolvedCount > 0 ? round((t1Wins / resolvedCount) * 100, 2) : 0;
  const t2WinRatePct = resolvedCount > 0 ? round((t2Wins / resolvedCount) * 100, 2) : 0;
  const failureRatePct = resolvedCount > 0 ? round((stops / resolvedCount) * 100, 2) : 0;
  const expectancyR = realized.length > 0
    ? round(realized.reduce((sum, value) => sum + value, 0) / realized.length, 4)
    : 0;
  const expectancyLowerBoundR = realized.length > 0 ? round(lowerBoundMean(realized), 4) : 0;

  const t1CI = __optimizerTestUtils.wilsonIntervalPct(t1Wins, resolvedCount);
  const t2CI = __optimizerTestUtils.wilsonIntervalPct(t2Wins, resolvedCount);
  const failCI = __optimizerTestUtils.wilsonIntervalPct(stops, resolvedCount);

  const objectiveScore = round(
    (t1WinRatePct * input.objectiveWeights.t1)
    + (t2WinRatePct * input.objectiveWeights.t2)
    - (failureRatePct * input.objectiveWeights.failurePenalty)
    + (expectancyR * input.objectiveWeights.expectancyR),
    2,
  );
  const objectiveScoreConservative = round(
    (t1CI.lowerPct * input.objectiveWeights.t1)
    + (t2CI.lowerPct * input.objectiveWeights.t2)
    - (failCI.upperPct * input.objectiveWeights.failurePenalty)
    + (expectancyLowerBoundR * input.objectiveWeights.expectancyR),
    2,
  );

  return {
    family: input.family,
    opportunities,
    triggered: triggeredRows.length,
    resolved: resolvedCount,
    t1WinRatePct,
    t2WinRatePct,
    failureRatePct,
    expectancyR,
    expectancyLowerBoundR,
    objectiveScore,
    objectiveScoreConservative,
  };
}

// ---------------------------------------------------------------------------
// Candidate grid
// ---------------------------------------------------------------------------

export function geometryCandidateGrid(input: {
  family: SweepFamily;
  baselinePartial: number;
  fastMode: boolean;
}): CandidateConfig[] {
  const configs: CandidateConfig[] = [];
  const trendFamily = input.family === 'trend_pullback' || input.family === 'orb_breakout';
  const stopScales = input.fastMode
    ? [0.95, 1, 1.05]
    : trendFamily ? [0.95, 1, 1.05] : [0.9, 1, 1.1];
  const target1Scales = input.fastMode
    ? [0.95, 1, 1.05]
    : trendFamily ? [0.9, 1, 1.1] : [0.95, 1, 1.05];
  const target2Scales = input.fastMode
    ? [0.95, 1, 1.05]
    : trendFamily ? [0.85, 0.95, 1, 1.05] : [0.9, 1, 1.1];
  const partials = trendFamily
    ? Array.from(new Set([0.5, 0.6, round(input.baselinePartial, 2), 0.7])).sort((a, b) => a - b)
    : Array.from(new Set([0.6, round(input.baselinePartial, 2), 0.75])).sort((a, b) => a - b);
  const moveBEValues = input.fastMode ? [true] : [true, false];

  configs.push({
    geometry: { stopScale: 1, target1Scale: 1, target2Scale: 1 },
    partialAtT1Pct: round(input.baselinePartial, 2),
    moveStopToBreakeven: true,
    label: `baseline|partial=${round(input.baselinePartial, 2)}|be=true`,
  });

  for (const stopScale of stopScales) {
    for (const target1Scale of target1Scales) {
      for (const target2Scale of target2Scales) {
        for (const partialAtT1Pct of partials) {
          for (const moveStopToBreakeven of moveBEValues) {
            configs.push({
              geometry: { stopScale, target1Scale, target2Scale },
              partialAtT1Pct,
              moveStopToBreakeven,
              label: `stop=${stopScale}|t1=${target1Scale}|t2=${target2Scale}|partial=${partialAtT1Pct}|be=${moveStopToBreakeven}`,
            });
          }
        }
      }
    }
  }

  return configs;
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

export async function loadSetups(from: string, to: string): Promise<EvalSetupCandidate[]> {
  const { data, error } = await supabase
    .from('spx_setup_instances')
    .select('engine_setup_id,session_date,setup_type,direction,regime,tier,entry_zone_low,entry_zone_high,stop_price,target_1_price,target_2_price,first_seen_at,triggered_at,metadata')
    .gte('session_date', from)
    .lte('session_date', to)
    .order('session_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to load setup instances for sweep: ${error.message}`);
  }

  return ((data || []) as SetupDbRow[])
    .map((row) => toSetupCandidate(row))
    .filter((row): row is EvalSetupCandidate => row !== null);
}

export async function loadBarsBySession(sessionDates: string[]): Promise<Map<string, MassiveAggregate[]>> {
  const barsBySession = new Map<string, MassiveAggregate[]>();
  for (const date of sessionDates) {
    const response = await getAggregates('I:SPX', 1, 'second', date, date);
    const bars = Array.isArray(response.results)
      ? response.results.filter((bar) => Number.isFinite(bar.t) && Number.isFinite(bar.o) && Number.isFinite(bar.h) && Number.isFinite(bar.l) && Number.isFinite(bar.c))
      : [];
    if (bars.length > 0) {
      barsBySession.set(date, bars);
    }
  }
  return barsBySession;
}

// ---------------------------------------------------------------------------
// Single-candidate evaluation
// ---------------------------------------------------------------------------

export function evaluateFamilyConfig(input: {
  family: SweepFamily;
  setups: EvalSetupCandidate[];
  barsBySession: Map<string, MassiveAggregate[]>;
  config: CandidateConfig;
  objectiveWeights: {
    t1: number;
    t2: number;
    failurePenalty: number;
    expectancyR: number;
  };
}): CandidateResult {
  const executionModel: SPXBacktestExecutionModel = {
    enabled: true,
    entrySlipPoints: 0.2,
    targetSlipPoints: 0.25,
    stopSlipPoints: 0.15,
    commissionPerTradeR: 0.04,
    partialAtT1Pct: input.config.partialAtT1Pct,
    moveStopToBreakevenAfterT1: input.config.moveStopToBreakeven,
  };

  const evaluatedRows = input.setups.map((setup) => {
    const adjusted = toBacktestSetup(setup, input.config);
    const bars = input.barsBySession.get(adjusted.sessionDate) || [];
    if (bars.length === 0) {
      return {
        final_outcome: null,
        triggered_at: null,
        realized_r: null,
      };
    }
    const evaluation = __testables.evaluateSetupAgainstBars(
      adjusted as Parameters<typeof __testables.evaluateSetupAgainstBars>[0],
      bars as Parameters<typeof __testables.evaluateSetupAgainstBars>[1],
      executionModel,
      { respectPersistedTriggeredAt: false },
    );
    return {
      final_outcome: evaluation.row.final_outcome,
      triggered_at: evaluation.row.triggered_at,
      realized_r: evaluation.row.realized_r,
    };
  });

  return {
    config: input.config,
    metrics: toFamilyMetrics({
      family: input.family,
      rows: evaluatedRows,
      objectiveWeights: input.objectiveWeights,
    }),
  };
}

// ---------------------------------------------------------------------------
// Full family sweep — callable entry point for optimizer integration
// ---------------------------------------------------------------------------

export function sweepGeometryForFamilies(input: {
  families: SweepFamily[];
  setups: EvalSetupCandidate[];
  barsBySession: Map<string, MassiveAggregate[]>;
  objectiveWeights: { t1: number; t2: number; failurePenalty: number; expectancyR: number };
  baselinePartial: number;
  fastMode?: boolean;
}): Record<SweepFamily, SweepFamilyResult | null> {
  const results: Record<SweepFamily, SweepFamilyResult | null> = {
    fade_at_wall: null,
    mean_reversion: null,
    trend_pullback: null,
    orb_breakout: null,
  };

  for (const family of input.families) {
    const familySetups = input.setups.filter((setup) => setup.setupType === family);
    if (familySetups.length < 8) continue;

    const configs = geometryCandidateGrid({
      family,
      baselinePartial: input.baselinePartial,
      fastMode: input.fastMode ?? false,
    });

    const evaluated: CandidateResult[] = [];
    for (const config of configs) {
      evaluated.push(evaluateFamilyConfig({
        family,
        setups: familySetups,
        barsBySession: input.barsBySession,
        config,
        objectiveWeights: input.objectiveWeights,
      }));
    }

    evaluated.sort((a, b) => {
      if (b.metrics.objectiveScoreConservative !== a.metrics.objectiveScoreConservative) {
        return b.metrics.objectiveScoreConservative - a.metrics.objectiveScoreConservative;
      }
      if (b.metrics.expectancyLowerBoundR !== a.metrics.expectancyLowerBoundR) {
        return b.metrics.expectancyLowerBoundR - a.metrics.expectancyLowerBoundR;
      }
      return b.metrics.triggered - a.metrics.triggered;
    });

    const baseline = evaluated.find((row) => row.config.label.startsWith('baseline|')) || evaluated[0];
    const best = evaluated[0];

    results[family] = {
      best,
      baseline,
      improved: best.metrics.objectiveScoreConservative > baseline.metrics.objectiveScoreConservative,
      delta: {
        objectiveConservative: round(best.metrics.objectiveScoreConservative - baseline.metrics.objectiveScoreConservative, 2),
        expectancyR: round(best.metrics.expectancyR - baseline.metrics.expectancyR, 4),
        t1WinRatePct: round(best.metrics.t1WinRatePct - baseline.metrics.t1WinRatePct, 2),
        t2WinRatePct: round(best.metrics.t2WinRatePct - baseline.metrics.t2WinRatePct, 2),
        failureRatePct: round(best.metrics.failureRatePct - baseline.metrics.failureRatePct, 2),
      },
    };
  }

  return results;
}

// Re-export MassiveAggregate for convenience
export type { MassiveAggregate } from '../../config/massive';
export type { SPXBacktestGeometryAdjustment } from './winRateBacktest';
