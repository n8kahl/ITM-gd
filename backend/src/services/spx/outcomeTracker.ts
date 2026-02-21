import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import type { SetupTransitionEvent } from './tickEvaluator';
import type { Setup } from './types';

export type SetupFinalOutcome =
  | 't2_before_stop'
  | 't1_before_stop'
  | 'stop_before_t1'
  | 'invalidated_other'
  | 'expired_unresolved';

export type SetupInstanceRow = {
  engine_setup_id: string;
  session_date: string;
  setup_type: string;
  direction: Setup['direction'];
  regime: string | null;
  tier: string | null;
  triggered_at: string | null;
  final_outcome: SetupFinalOutcome | null;
  t1_hit_at: string | null;
  t2_hit_at: string | null;
  stop_hit_at: string | null;
  realized_r?: number | null;
  entry_fill_price?: number | null;
};

export interface SPXWinRateAnalytics {
  dateRange: { from: string; to: string };
  denominator: 'resolved_triggered';
  triggeredCount: number;
  resolvedCount: number;
  pendingCount: number;
  t1Wins: number;
  t2Wins: number;
  stopsBeforeT1: number;
  invalidatedOther: number;
  expiredUnresolved: number;
  t1WinRatePct: number;
  t2WinRatePct: number;
  failureRatePct: number;
  bySetupType: SPXWinRateBucket[];
  byRegime: SPXWinRateBucket[];
  byTier: SPXWinRateBucket[];
}

export interface SPXWinRateBucket {
  key: string;
  triggeredCount: number;
  resolvedCount: number;
  pendingCount: number;
  t1Wins: number;
  t2Wins: number;
  stopsBeforeT1: number;
  invalidatedOther: number;
  expiredUnresolved: number;
  t1WinRatePct: number;
  t2WinRatePct: number;
  failureRatePct: number;
}

interface OutcomeResolution {
  finalOutcome: SetupFinalOutcome;
  finalReason: string;
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function toSessionDate(value: string | null | undefined): string {
  if (!value) return toEasternTime(new Date()).dateStr;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return toEasternTime(new Date()).dateStr;
  return toEasternTime(new Date(parsed)).dateStr;
}

function toTrackedRow(setup: Setup, observedAt: string) {
  return {
    engine_setup_id: setup.id,
    session_date: toSessionDate(setup.createdAt || observedAt),
    setup_type: setup.type,
    direction: setup.direction,
    regime: setup.regime,
    entry_zone_low: setup.entryZone.low,
    entry_zone_high: setup.entryZone.high,
    stop_price: setup.stop,
    target_1_price: setup.target1.price,
    target_2_price: setup.target2.price,
    score: setup.score ?? null,
    p_win_calibrated: setup.pWinCalibrated ?? null,
    ev_r: setup.evR ?? null,
    tier: setup.tier ?? null,
    first_seen_at: setup.createdAt || observedAt,
    last_seen_at: observedAt,
    triggered_at: setup.triggeredAt || null,
    latest_status: setup.status,
    latest_invalidation_reason: setup.invalidationReason || null,
    metadata: {
      confluenceScore: setup.confluenceScore,
      confluenceSources: setup.confluenceSources,
      probability: setup.probability,
      alignmentScore: setup.alignmentScore ?? null,
      flowAlignmentPct: setup.alignmentScore ?? null,
      flowConfirmed: setup.flowConfirmed ?? null,
      emaAligned: setup.confluenceSources.includes('ema_alignment'),
      volumeRegimeAligned: setup.confluenceSources.includes('volume_regime_alignment'),
      confidenceTrend: setup.confidenceTrend ?? null,
      decisionDrivers: Array.isArray(setup.decisionDrivers) ? setup.decisionDrivers : [],
      decisionRisks: Array.isArray(setup.decisionRisks) ? setup.decisionRisks : [],
      gateStatus: setup.gateStatus ?? null,
      gateReasons: Array.isArray(setup.gateReasons) ? setup.gateReasons : [],
      tradeManagement: setup.tradeManagement ?? null,
      statusUpdatedAt: setup.statusUpdatedAt || null,
      rank: setup.rank ?? null,
    },
    updated_at: observedAt,
  };
}

function shouldResolveOutcome(existing: SetupFinalOutcome | null | undefined): boolean {
  return existing == null;
}

function resolveOutcomeFromSetup(input: {
  setup: Setup;
  row: SetupInstanceRow;
}): OutcomeResolution | null {
  if (!input.setup.triggeredAt && !input.row.triggered_at) return null;
  if (!shouldResolveOutcome(input.row.final_outcome)) return null;

  const t1Hit = Boolean(input.row.t1_hit_at);
  const t2Hit = Boolean(input.row.t2_hit_at);
  const stopHit = Boolean(input.row.stop_hit_at)
    || (
      input.setup.status === 'invalidated'
      && input.setup.invalidationReason === 'stop_breach_confirmed'
    );

  if (t2Hit) {
    return {
      finalOutcome: 't2_before_stop',
      finalReason: 'target2_hit',
    };
  }

  if (stopHit && !t1Hit) {
    return {
      finalOutcome: 'stop_before_t1',
      finalReason: 'stop_breach_confirmed',
    };
  }

  if (input.setup.status === 'invalidated') {
    return t1Hit
      ? {
        finalOutcome: 't1_before_stop',
        finalReason: 'stop_after_target1',
      }
      : {
        finalOutcome: 'invalidated_other',
        finalReason: input.setup.invalidationReason || 'invalidated',
      };
  }

  if (input.setup.status === 'expired') {
    return t1Hit
      ? {
        finalOutcome: 't1_before_stop',
        finalReason: 'target1_then_expired',
      }
      : {
        finalOutcome: 'expired_unresolved',
        finalReason: 'expired_without_target_hit',
      };
  }

  return null;
}

function resolveOutcomeFromTransition(input: {
  event: SetupTransitionEvent;
  row: SetupInstanceRow;
}): OutcomeResolution | null {
  if (!shouldResolveOutcome(input.row.final_outcome)) return null;

  if (input.event.toPhase === 'target2_hit') {
    return {
      finalOutcome: 't2_before_stop',
      finalReason: 'target2_hit',
    };
  }

  if (input.event.toPhase === 'invalidated' && input.event.reason === 'stop') {
    const t1Occurred = Boolean(input.row.t1_hit_at);
    return t1Occurred
      ? {
        finalOutcome: 't1_before_stop',
        finalReason: 'stop_after_target1',
      }
      : {
        finalOutcome: 'stop_before_t1',
        finalReason: 'stop_breach_confirmed',
      };
  }

  return null;
}

function finalReasonForOutcome(outcome: SetupFinalOutcome | null): string | null {
  if (!outcome) return null;
  if (outcome === 't2_before_stop') return 'target2_hit';
  if (outcome === 't1_before_stop') return 'target1_then_stop_or_expiry';
  if (outcome === 'stop_before_t1') return 'stop_breach_confirmed';
  if (outcome === 'invalidated_other') return 'invalidated_other';
  return 'expired_without_target_hit';
}

function resolvedAtForOutcome(row: SetupInstanceRow): string | null {
  return row.t2_hit_at || row.stop_hit_at || row.t1_hit_at || row.triggered_at || null;
}

function isMissingColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    (normalized.includes('column') && normalized.includes('does not exist'))
    || (normalized.includes('could not find') && normalized.includes('column'))
  );
}

function toRowKey(engineSetupId: string, sessionDate: string): string {
  return `${engineSetupId}:${sessionDate}`;
}

async function loadTrackedRows(setupIds: string[]): Promise<Map<string, SetupInstanceRow>> {
  const uniqueIds = Array.from(new Set(setupIds)).filter((id) => id.length > 0);
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('spx_setup_instances')
    .select('engine_setup_id,session_date,setup_type,direction,regime,tier,triggered_at,final_outcome,t1_hit_at,t2_hit_at,stop_hit_at')
    .in('engine_setup_id', uniqueIds);

  if (error) {
    logger.warn('SPX outcome tracker failed to load setup instances', {
      setupCount: uniqueIds.length,
      error: error.message,
    });
    return new Map();
  }

  const rows = (data || []) as SetupInstanceRow[];
  return new Map(rows.map((row) => [toRowKey(row.engine_setup_id, row.session_date), row]));
}

async function updateTrackedRow(input: {
  engineSetupId: string;
  sessionDate: string;
  patch: Record<string, unknown>;
  suppressWarn?: boolean;
}): Promise<{ ok: boolean; errorMessage?: string }> {
  const { error } = await supabase
    .from('spx_setup_instances')
    .update(input.patch)
    .eq('engine_setup_id', input.engineSetupId)
    .eq('session_date', input.sessionDate);

  if (error) {
    if (!input.suppressWarn) {
      logger.warn('SPX outcome tracker failed to update setup instance', {
        setupId: input.engineSetupId,
        sessionDate: input.sessionDate,
        error: error.message,
      });
    }
    return {
      ok: false,
      errorMessage: error.message,
    };
  }

  return { ok: true };
}

export async function persistSetupInstancesForWinRate(
  setups: Setup[],
  options?: { observedAt?: string },
): Promise<void> {
  if (setups.length === 0) return;

  const observedAt = options?.observedAt || new Date().toISOString();
  const rows = setups.map((setup) => toTrackedRow(setup, observedAt));

  const { error: upsertError } = await supabase
    .from('spx_setup_instances')
    .upsert(rows, { onConflict: 'engine_setup_id,session_date' });

  if (upsertError) {
    logger.warn('SPX outcome tracker failed to upsert setup instances', {
      setupCount: setups.length,
      error: upsertError.message,
    });
    return;
  }

  const rowMap = await loadTrackedRows(setups.map((setup) => setup.id));

  for (const setup of setups) {
    const sessionDate = toSessionDate(setup.createdAt || observedAt);
    const rowKey = toRowKey(setup.id, sessionDate);
    const trackedRow = rowMap.get(rowKey);
    if (!trackedRow) continue;

    const patch: Record<string, unknown> = {};
    const statusUpdatedAt = setup.statusUpdatedAt || observedAt;

    if (!trackedRow.triggered_at && setup.triggeredAt) {
      patch.triggered_at = setup.triggeredAt;
      trackedRow.triggered_at = setup.triggeredAt;
    }

    if (
      setup.status === 'invalidated'
      && setup.invalidationReason === 'stop_breach_confirmed'
      && !trackedRow.stop_hit_at
    ) {
      patch.stop_hit_at = statusUpdatedAt;
      trackedRow.stop_hit_at = statusUpdatedAt;
    }

    const outcome = resolveOutcomeFromSetup({ setup, row: trackedRow });
    if (outcome) {
      patch.final_outcome = outcome.finalOutcome;
      patch.final_reason = outcome.finalReason;
      patch.resolved_at = statusUpdatedAt;
      trackedRow.final_outcome = outcome.finalOutcome;
    }

    if (Object.keys(patch).length === 0) continue;
    patch.updated_at = observedAt;
    await updateTrackedRow({
      engineSetupId: setup.id,
      sessionDate,
      patch,
    });
  }
}

export async function persistSetupTransitionsForWinRate(
  events: SetupTransitionEvent[],
): Promise<void> {
  if (events.length === 0) return;

  const setups = events.map((event) => event.setup);
  await persistSetupInstancesForWinRate(setups, {
    observedAt: events[events.length - 1]?.timestamp || new Date().toISOString(),
  });

  const transitionRows = events.map((event) => ({
    engine_setup_id: event.setupId,
    session_date: toSessionDate(event.setup.createdAt || event.timestamp),
    event_id: event.id,
    from_phase: event.fromPhase,
    to_phase: event.toPhase,
    reason: event.reason,
    price: event.price,
    event_ts: event.timestamp,
    payload: {
      symbol: event.symbol,
      direction: event.direction,
    },
  }));

  const { error: transitionError } = await supabase
    .from('spx_setup_transitions')
    .upsert(transitionRows, { onConflict: 'event_id', ignoreDuplicates: true });

  if (transitionError) {
    logger.warn('SPX outcome tracker failed to persist transitions', {
      transitionCount: transitionRows.length,
      error: transitionError.message,
    });
  }

  const rowMap = await loadTrackedRows(events.map((event) => event.setupId));

  for (const event of events) {
    const sessionDate = toSessionDate(event.setup.createdAt || event.timestamp);
    const rowKey = toRowKey(event.setupId, sessionDate);
    const trackedRow = rowMap.get(rowKey);
    if (!trackedRow) continue;

    const patch: Record<string, unknown> = {
      latest_status: event.setup.status,
      last_seen_at: event.timestamp,
      updated_at: event.timestamp,
    };

    if (!trackedRow.triggered_at && event.setup.triggeredAt) {
      patch.triggered_at = event.setup.triggeredAt;
      trackedRow.triggered_at = event.setup.triggeredAt;
    }

    if (event.toPhase === 'target1_hit' && !trackedRow.t1_hit_at) {
      patch.t1_hit_at = event.timestamp;
      trackedRow.t1_hit_at = event.timestamp;
    }

    if (event.toPhase === 'target2_hit' && !trackedRow.t2_hit_at) {
      patch.t2_hit_at = event.timestamp;
      trackedRow.t2_hit_at = event.timestamp;
    }

    if (event.toPhase === 'invalidated' && event.reason === 'stop' && !trackedRow.stop_hit_at) {
      patch.stop_hit_at = event.timestamp;
      trackedRow.stop_hit_at = event.timestamp;
    }

    const outcome = resolveOutcomeFromTransition({ event, row: trackedRow });
    if (outcome) {
      patch.final_outcome = outcome.finalOutcome;
      patch.final_reason = outcome.finalReason;
      patch.resolved_at = event.timestamp;
      trackedRow.final_outcome = outcome.finalOutcome;
    }

    await updateTrackedRow({
      engineSetupId: event.setupId,
      sessionDate,
      patch,
    });
  }
}

export async function persistBacktestRowsForWinRate(
  rows: SetupInstanceRow[],
  options?: { observedAt?: string },
): Promise<void> {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const observedAt = options?.observedAt || new Date().toISOString();
  let profitabilityColumnsSupported = true;

  for (const row of rows) {
    if (!row.engine_setup_id || !row.session_date) continue;
    if (!row.triggered_at && !row.final_outcome) continue;

    const patch: Record<string, unknown> = {
      updated_at: observedAt,
      last_seen_at: observedAt,
    };

    if (row.triggered_at) patch.triggered_at = row.triggered_at;
    if (row.t1_hit_at) patch.t1_hit_at = row.t1_hit_at;
    if (row.t2_hit_at) patch.t2_hit_at = row.t2_hit_at;
    if (row.stop_hit_at) patch.stop_hit_at = row.stop_hit_at;
    if (profitabilityColumnsSupported && typeof row.realized_r === 'number' && Number.isFinite(row.realized_r)) {
      patch.realized_r = row.realized_r;
    }
    if (profitabilityColumnsSupported && typeof row.entry_fill_price === 'number' && Number.isFinite(row.entry_fill_price)) {
      patch.entry_fill_price = row.entry_fill_price;
    }

    if (row.final_outcome) {
      patch.final_outcome = row.final_outcome;
      patch.final_reason = finalReasonForOutcome(row.final_outcome);
      patch.resolved_at = resolvedAtForOutcome(row);
      patch.latest_status = row.final_outcome === 'stop_before_t1' ? 'invalidated' : 'expired';
    }

    const result = await updateTrackedRow({
      engineSetupId: row.engine_setup_id,
      sessionDate: row.session_date,
      patch,
      suppressWarn: profitabilityColumnsSupported,
    });

    if (
      !result.ok
      && result.errorMessage
      && isMissingColumnError(result.errorMessage)
      && ('realized_r' in patch || 'entry_fill_price' in patch)
    ) {
      profitabilityColumnsSupported = false;
      const fallbackPatch = { ...patch };
      delete fallbackPatch.realized_r;
      delete fallbackPatch.entry_fill_price;
      await updateTrackedRow({
        engineSetupId: row.engine_setup_id,
        sessionDate: row.session_date,
        patch: fallbackPatch,
      });
    }
  }
}

type WinRateAggregateCounter = {
  triggeredCount: number;
  resolvedCount: number;
  t1Wins: number;
  t2Wins: number;
  stopsBeforeT1: number;
  invalidatedOther: number;
  expiredUnresolved: number;
};

function emptyCounter(): WinRateAggregateCounter {
  return {
    triggeredCount: 0,
    resolvedCount: 0,
    t1Wins: 0,
    t2Wins: 0,
    stopsBeforeT1: 0,
    invalidatedOther: 0,
    expiredUnresolved: 0,
  };
}

function applyOutcome(counter: WinRateAggregateCounter, outcome: SetupFinalOutcome): void {
  counter.resolvedCount += 1;
  if (outcome === 't2_before_stop') {
    counter.t2Wins += 1;
    counter.t1Wins += 1;
    return;
  }
  if (outcome === 't1_before_stop') {
    counter.t1Wins += 1;
    return;
  }
  if (outcome === 'stop_before_t1') {
    counter.stopsBeforeT1 += 1;
    return;
  }
  if (outcome === 'invalidated_other') {
    counter.invalidatedOther += 1;
    return;
  }
  counter.expiredUnresolved += 1;
}

function toBucket(key: string, counter: WinRateAggregateCounter): SPXWinRateBucket {
  const denominator = counter.resolvedCount;
  return {
    key,
    triggeredCount: counter.triggeredCount,
    resolvedCount: counter.resolvedCount,
    pendingCount: Math.max(counter.triggeredCount - counter.resolvedCount, 0),
    t1Wins: counter.t1Wins,
    t2Wins: counter.t2Wins,
    stopsBeforeT1: counter.stopsBeforeT1,
    invalidatedOther: counter.invalidatedOther,
    expiredUnresolved: counter.expiredUnresolved,
    t1WinRatePct: denominator > 0 ? round((counter.t1Wins / denominator) * 100, 2) : 0,
    t2WinRatePct: denominator > 0 ? round((counter.t2Wins / denominator) * 100, 2) : 0,
    failureRatePct: denominator > 0 ? round((counter.stopsBeforeT1 / denominator) * 100, 2) : 0,
  };
}

function normalizeBucketKey(value: string | null | undefined): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'unknown';
}

function computeBuckets(
  rows: SetupInstanceRow[],
  keySelector: (row: SetupInstanceRow) => string,
): SPXWinRateBucket[] {
  const counterByKey = new Map<string, WinRateAggregateCounter>();

  for (const row of rows) {
    if (!row.triggered_at) continue;
    const key = normalizeBucketKey(keySelector(row));
    const counter = counterByKey.get(key) || emptyCounter();
    counter.triggeredCount += 1;

    if (row.final_outcome) {
      applyOutcome(counter, row.final_outcome);
    }

    counterByKey.set(key, counter);
  }

  return Array.from(counterByKey.entries())
    .map(([key, counter]) => toBucket(key, counter))
    .sort((a, b) => {
      if (b.triggeredCount !== a.triggeredCount) return b.triggeredCount - a.triggeredCount;
      return a.key.localeCompare(b.key);
    });
}

export function summarizeSPXWinRateRows(rows: SetupInstanceRow[], input: {
  from: string;
  to: string;
}): SPXWinRateAnalytics {
  const overall = emptyCounter();

  for (const row of rows) {
    if (!row.triggered_at) continue;
    overall.triggeredCount += 1;
    if (row.final_outcome) {
      applyOutcome(overall, row.final_outcome);
    }
  }

  const denominator = overall.resolvedCount;

  return {
    dateRange: { from: input.from, to: input.to },
    denominator: 'resolved_triggered',
    triggeredCount: overall.triggeredCount,
    resolvedCount: overall.resolvedCount,
    pendingCount: Math.max(overall.triggeredCount - overall.resolvedCount, 0),
    t1Wins: overall.t1Wins,
    t2Wins: overall.t2Wins,
    stopsBeforeT1: overall.stopsBeforeT1,
    invalidatedOther: overall.invalidatedOther,
    expiredUnresolved: overall.expiredUnresolved,
    t1WinRatePct: denominator > 0 ? round((overall.t1Wins / denominator) * 100, 2) : 0,
    t2WinRatePct: denominator > 0 ? round((overall.t2Wins / denominator) * 100, 2) : 0,
    failureRatePct: denominator > 0 ? round((overall.stopsBeforeT1 / denominator) * 100, 2) : 0,
    bySetupType: computeBuckets(rows, (row) => row.setup_type),
    byRegime: computeBuckets(rows, (row) => row.regime || 'unknown'),
    byTier: computeBuckets(rows, (row) => row.tier || 'unknown'),
  };
}

export async function getSPXWinRateAnalytics(input: {
  from: string;
  to: string;
}): Promise<SPXWinRateAnalytics> {
  const { data, error } = await supabase
    .from('spx_setup_instances')
    .select('engine_setup_id,session_date,setup_type,direction,regime,tier,triggered_at,final_outcome,t1_hit_at,t2_hit_at,stop_hit_at')
    .gte('session_date', input.from)
    .lte('session_date', input.to);

  if (error) {
    throw new Error(`Failed to load SPX setup analytics: ${error.message}`);
  }

  return summarizeSPXWinRateRows((data || []) as SetupInstanceRow[], input);
}
