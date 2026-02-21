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

type InternalBacktestSource = 'spx_setup_instances' | 'ai_coach_tracked_setups';

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
}

interface EvaluatedSetup {
  row: SetupInstanceRow;
  ambiguityCount: number;
  missingTarget2: boolean;
  realizedR: number | null;
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

export interface SPXBacktestExecutionModel {
  enabled: boolean;
  entrySlipPoints: number;
  targetSlipPoints: number;
  stopSlipPoints: number;
  commissionPerTradeR: number;
  partialAtT1Pct: number;
  moveStopToBreakevenAfterT1: boolean;
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

function toSessionDate(value: string): string {
  return toEasternTime(new Date(value)).dateStr;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isMissingTableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('could not find the table') || normalized.includes('does not exist');
}

function normalizeDateInput(value: string): string {
  return value.trim().slice(0, 10);
}

function nextDate(date: string): string {
  const base = new Date(`${date}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString().slice(0, 10);
}

function buildLegacySetupKey(row: {
  id: string;
  sessionDate: string;
  metadata: Record<string, unknown>;
  trackedAt: string;
}): string {
  const detected = typeof row.metadata.detectedSetupId === 'string'
    ? row.metadata.detectedSetupId.trim()
    : '';
  if (detected.length > 0) return `detected:${detected}`;

  const dedupeKey = typeof row.metadata.dedupeKey === 'string'
    ? row.metadata.dedupeKey.trim()
    : '';
  if (dedupeKey.length > 0) return `dedupe:${row.sessionDate}:${dedupeKey}`;

  const trackedMinute = row.trackedAt.slice(0, 16);
  return `row:${row.id}:${row.sessionDate}:${trackedMinute}`;
}

async function loadSetupsFromInstances(input: {
  from: string;
  to: string;
  includeBlockedSetups?: boolean;
}): Promise<{ setups: BacktestSetupCandidate[]; notes: string[]; tableMissing: boolean }> {
  const includeBlockedSetups = input.includeBlockedSetups === true;
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
    };
  }

  const rows = (Array.isArray(data) ? data : []) as unknown as Record<string, unknown>[];
  const setups: BacktestSetupCandidate[] = [];
  let skipped = 0;
  let skippedBlocked = 0;

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
    if (!engineSetupId || !sessionDate) {
      skipped += 1;
      continue;
    }

    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {};
    const gateStatus = metadata.gateStatus === 'blocked'
      ? 'blocked'
      : metadata.gateStatus === 'eligible'
        ? 'eligible'
        : null;
    if (!includeBlockedSetups && gateStatus === 'blocked') {
      skippedBlocked += 1;
      continue;
    }

    setups.push({
      engineSetupId,
      sessionDate,
      setupType,
      direction,
      regime: typeof row.regime === 'string' ? row.regime : null,
      tier: typeof row.tier === 'string' ? row.tier : null,
      gateStatus,
      entryLow,
      entryHigh,
      stopPrice,
      target1Price,
      target2Price,
      firstSeenAt: typeof row.first_seen_at === 'string' ? row.first_seen_at : null,
      triggeredAt: typeof row.triggered_at === 'string' ? row.triggered_at : null,
    });
  }

  const notes: string[] = [];
  if (skipped > 0) {
    notes.push(`Skipped ${skipped} malformed spx_setup_instances rows during backtest setup load.`);
  }
  if (skippedBlocked > 0) {
    notes.push(`Skipped ${skippedBlocked} gate-blocked spx_setup_instances rows (non-actionable).`);
  }

  return {
    setups,
    notes,
    tableMissing: false,
  };
}

async function loadSetupsFromLegacyTrackedSetups(input: {
  from: string;
  to: string;
}): Promise<{ setups: BacktestSetupCandidate[]; notes: string[]; tableMissing: boolean }> {
  const startIso = `${input.from}T00:00:00.000Z`;
  const endIso = `${nextDate(input.to)}T00:00:00.000Z`;
  const pageSize = 500;
  const allRows: Record<string, unknown>[] = [];
  let page = 0;

  while (true) {
    const fromIndex = page * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    const { data, error } = await supabase
      .from('ai_coach_tracked_setups')
      .select('id,symbol,setup_type,direction,tracked_at,triggered_at,opportunity_data')
      .eq('symbol', 'SPX')
      .gte('tracked_at', startIso)
      .lt('tracked_at', endIso)
      .order('tracked_at', { ascending: true })
      .range(fromIndex, toIndex);

    if (error) {
      const tableMissing = isMissingTableError(error.message);
      return {
        setups: [],
        notes: [tableMissing
          ? 'ai_coach_tracked_setups table is not available in the connected Supabase project.'
          : `Failed to load ai_coach_tracked_setups rows: ${error.message}`],
        tableMissing,
      };
    }

    const rows = (Array.isArray(data) ? data : []) as unknown as Record<string, unknown>[];
    allRows.push(...rows);
    if (rows.length < pageSize) break;
    page += 1;
  }

  const deduped = new Map<string, BacktestSetupCandidate>();
  let skipped = 0;

  for (const row of allRows) {
    const trackedAt = typeof row.tracked_at === 'string' ? row.tracked_at : null;
    const direction = row.direction === 'bullish' || row.direction === 'bearish'
      ? row.direction
      : null;
    const setupType = typeof row.setup_type === 'string' ? row.setup_type : 'unknown';
    const rowId = typeof row.id === 'string' ? row.id : null;
    const payload = row.opportunity_data as Record<string, unknown> | null;
    const metadata = (payload?.metadata as Record<string, unknown> | undefined) || {};
    const source = typeof metadata.source === 'string' ? metadata.source : '';

    if (!trackedAt || !direction || !rowId || source !== 'setup_detector') {
      skipped += 1;
      continue;
    }

    const sessionDate = toSessionDate(trackedAt);
    if (sessionDate < input.from || sessionDate > input.to) continue;

    const suggestedTrade = payload?.suggestedTrade as Record<string, unknown> | undefined;
    const entry = toFiniteNumber(suggestedTrade?.entry);
    const stopLoss = toFiniteNumber(suggestedTrade?.stopLoss);
    const target = toFiniteNumber(suggestedTrade?.target);

    if (entry == null || stopLoss == null || target == null) {
      skipped += 1;
      continue;
    }

    const key = buildLegacySetupKey({
      id: rowId,
      sessionDate,
      metadata,
      trackedAt,
    });

    const current = deduped.get(key);
    if (current && (toEpochMs(current.firstSeenAt) || Number.MAX_SAFE_INTEGER) <= (toEpochMs(trackedAt) || 0)) {
      continue;
    }

    deduped.set(key, {
      engineSetupId: key,
      sessionDate,
      setupType,
      direction,
      regime: null,
      tier: null,
      gateStatus: null,
      entryLow: entry,
      entryHigh: entry,
      stopPrice: stopLoss,
      target1Price: target,
      target2Price: null,
      firstSeenAt: trackedAt,
      triggeredAt: typeof row.triggered_at === 'string' ? row.triggered_at : null,
    });
  }

  const notes: string[] = [];
  if (skipped > 0) {
    notes.push(`Skipped ${skipped} malformed legacy setup rows during backtest setup load.`);
  }
  notes.push('Using legacy ai_coach_tracked_setups source; T2 is unavailable for these setups.');

  return {
    setups: Array.from(deduped.values()),
    notes,
    tableMissing: false,
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
  const target1PriceEffective = effectiveTargetPrice(setup.direction, setup.target1Price, executionModel);
  const target2PriceEffective = setup.target2Price == null
    ? null
    : effectiveTargetPrice(setup.direction, setup.target2Price, executionModel);
  const initialStopPriceEffective = effectiveInitialStopPrice(setup.direction, setup.stopPrice, executionModel);

  if (triggered) {
    entryFillPrice = entryMidPrice;
  }

  const activeStopPrice = (): number => {
    if (t1HitAt && executionModel.moveStopToBreakevenAfterT1) {
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
        entryFillPrice = applyEntryFillPrice(setup.direction, triggerPrice, executionModel);
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
    const commissionR = executionModel.enabled ? executionModel.commissionPerTradeR : 0;
    const partialAtT1Pct = executionModel.enabled ? executionModel.partialAtT1Pct : 0.5;

    if (outcome === 't2_before_stop') {
      const r2 = target2R ?? target1R;
      realizedR = (partialAtT1Pct * target1R) + ((1 - partialAtT1Pct) * r2) - commissionR;
    } else if (outcome === 't1_before_stop') {
      realizedR = (partialAtT1Pct * target1R) - commissionR;
    } else if (outcome === 'stop_before_t1') {
      realizedR = -1 - commissionR;
    } else if (outcome === 'expired_unresolved') {
      const markPrice = lastObservedPrice ?? entryPrice;
      const directionalMove = setup.direction === 'bullish'
        ? markPrice - entryPrice
        : entryPrice - markPrice;
      realizedR = (directionalMove / riskR) - commissionR;
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
  executionModel?: Partial<SPXBacktestExecutionModel>;
}): Promise<SPXWinRateBacktestResult> {
  const from = normalizeDateInput(input.from);
  const to = normalizeDateInput(input.to);
  const source = input.source || 'spx_setup_instances';
  const resolution = input.resolution || 'second';
  const includeRows = input.includeRows === true;
  const executionModel = resolveExecutionModel(input.executionModel);
  const notes: string[] = [];

  let selectedSource: InternalBacktestSource | 'none' = 'none';
  let setups: BacktestSetupCandidate[] = [];
  let skippedSetupCount = 0;

  if (source === 'auto' || source === 'spx_setup_instances') {
    const instanceLoad = await loadSetupsFromInstances({
      from,
      to,
      includeBlockedSetups: input.includeBlockedSetups,
    });
    notes.push(...instanceLoad.notes);

    if (instanceLoad.setups.length > 0) {
      selectedSource = 'spx_setup_instances';
      setups = instanceLoad.setups;
    } else {
      selectedSource = 'spx_setup_instances';
      setups = [];
    }
  } else {
    const legacyLoad = await loadSetupsFromLegacyTrackedSetups({ from, to });
    notes.push(...legacyLoad.notes);
    selectedSource = 'ai_coach_tracked_setups';
    setups = legacyLoad.setups;
  }

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
};
