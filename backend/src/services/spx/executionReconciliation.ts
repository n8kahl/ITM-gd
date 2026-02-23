import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import type { Setup } from './types';

export type ExecutionFillSide = 'entry' | 'partial' | 'exit';
export type ExecutionFillSource = 'proxy' | 'manual' | 'broker_tradier' | 'broker_other';
export type ExecutionTransitionPhase = 'triggered' | 'target1_hit' | 'target2_hit' | 'invalidated' | 'expired';

interface SetupInstanceReference {
  sessionDate: string;
  direction: Setup['direction'] | null;
  entryFillPrice: number | null;
}

interface TransitionReference {
  transitionEventId: string;
  phase: ExecutionTransitionPhase;
  reason: 'entry' | 'stop' | 'target1' | 'target2';
  price: number;
  timestamp: string;
}

export interface RecordExecutionFillInput {
  setupId: string;
  side: ExecutionFillSide;
  fillPrice: number;
  direction?: Setup['direction'];
  phase?: ExecutionTransitionPhase;
  source?: ExecutionFillSource;
  executedAt?: string;
  transitionEventId?: string;
  fillQuantity?: number;
  brokerOrderId?: string;
  brokerExecutionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionFillReconciliation {
  persisted: boolean;
  tableAvailable: boolean;
  fillId: number | null;
  setupId: string;
  sessionDate: string;
  side: ExecutionFillSide;
  phase: ExecutionTransitionPhase | null;
  source: ExecutionFillSource;
  fillPrice: number;
  fillQuantity: number | null;
  executedAt: string;
  direction: Setup['direction'] | null;
  reference: TransitionReference | null;
  slippagePoints: number | null;
  slippageBps: number | null;
}

export interface ExecutionFillReconciliationHistory {
  setupId: string;
  count: number;
  fills: ExecutionFillReconciliation[];
}

export interface ExecutionFillSourceBucket {
  source: ExecutionFillSource;
  fillCount: number;
  fillSharePct: number;
  entryFillCount: number;
  exitFillCount: number;
  avgEntrySlippagePts: number | null;
  avgExitSlippagePts: number | null;
  avgEntrySlippageBps: number | null;
  avgExitSlippageBps: number | null;
}

export interface ExecutionFillSourceComposition {
  setupId: string;
  sessionDate: string | null;
  totalFills: number;
  proxySharePct: number;
  nonProxySharePct: number;
  bySource: ExecutionFillSourceBucket[];
}

interface RawTransitionRow {
  event_id: string;
  to_phase: ExecutionTransitionPhase;
  reason: 'entry' | 'stop' | 'target1' | 'target2';
  price: number | string;
  event_ts: string;
}

interface RawFillRow {
  id: number;
  engine_setup_id: string;
  session_date: string;
  side: ExecutionFillSide;
  phase: ExecutionTransitionPhase | null;
  source: ExecutionFillSource;
  fill_price: number | string;
  fill_qty: number | string | null;
  executed_at: string;
  transition_event_id: string | null;
  reference_price: number | string | null;
  slippage_points: number | string | null;
  slippage_bps: number | string | null;
  metadata: Record<string, unknown> | null;
}

const SOURCE_PRIORITY: Record<ExecutionFillSource, number> = {
  broker_tradier: 4,
  broker_other: 3,
  manual: 2,
  proxy: 1,
};

function round(value: number, decimals = 4): number {
  return Number(value.toFixed(decimals));
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toIso(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
}

function toSessionDate(iso: string): string {
  return toEasternTime(new Date(iso)).dateStr;
}

function isUuid(value: string | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isMissingRelationError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('relation')
    && normalized.includes('does not exist')
    && normalized.includes('spx_setup_execution_fills')
  );
}

function parseDirection(value: unknown): Setup['direction'] | null {
  return value === 'bullish' || value === 'bearish' ? value : null;
}

function computeDirectionalSlippagePoints(input: {
  side: ExecutionFillSide;
  direction: Setup['direction'];
  referencePrice: number;
  fillPrice: number;
}): number {
  const directionalMove = input.direction === 'bullish'
    ? input.fillPrice - input.referencePrice
    : input.referencePrice - input.fillPrice;

  const sideMultiplier = input.side === 'entry' ? 1 : -1;
  return round(directionalMove * sideMultiplier, 4);
}

function computeSlippageBps(slippagePoints: number, referencePrice: number): number | null {
  if (!Number.isFinite(referencePrice) || referencePrice <= 0) return null;
  return round((slippagePoints / referencePrice) * 10_000, 2);
}

async function loadLatestInstanceReference(setupId: string): Promise<SetupInstanceReference | null> {
  const { data, error } = await supabase
    .from('spx_setup_instances')
    .select('session_date,direction,entry_fill_price')
    .eq('engine_setup_id', setupId)
    .order('session_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn('SPX execution reconciliation: failed to load setup instance reference', {
      setupId,
      error: error.message,
    });
    return null;
  }

  if (!data) return null;

  return {
    sessionDate: String((data as { session_date?: unknown }).session_date || ''),
    direction: parseDirection((data as { direction?: unknown }).direction),
    entryFillPrice: toFiniteNumber((data as { entry_fill_price?: unknown }).entry_fill_price),
  };
}

async function loadTransitionReferences(input: {
  setupId: string;
  sessionDate: string;
}): Promise<TransitionReference[]> {
  const { data, error } = await supabase
    .from('spx_setup_transitions')
    .select('event_id,to_phase,reason,price,event_ts')
    .eq('engine_setup_id', input.setupId)
    .eq('session_date', input.sessionDate)
    .order('event_ts', { ascending: false })
    .limit(50);

  if (error) {
    logger.warn('SPX execution reconciliation: failed to load transition references', {
      setupId: input.setupId,
      sessionDate: input.sessionDate,
      error: error.message,
    });
    return [];
  }

  const rows = (data || []) as RawTransitionRow[];
  return rows
    .map((row) => {
      const price = toFiniteNumber(row.price);
      if (!price) return null;
      if (!row.event_id || !row.event_ts) return null;

      return {
        transitionEventId: row.event_id,
        phase: row.to_phase,
        reason: row.reason,
        price,
        timestamp: row.event_ts,
      } as TransitionReference;
    })
    .filter((row): row is TransitionReference => row !== null);
}

function uniquePhases(phases: Array<ExecutionTransitionPhase | null | undefined>): ExecutionTransitionPhase[] {
  const seen = new Set<ExecutionTransitionPhase>();
  const ordered: ExecutionTransitionPhase[] = [];
  for (const phase of phases) {
    if (!phase) continue;
    if (seen.has(phase)) continue;
    seen.add(phase);
    ordered.push(phase);
  }
  return ordered;
}

function selectTransitionReference(input: {
  transitions: TransitionReference[];
  side: ExecutionFillSide;
  phase?: ExecutionTransitionPhase;
  transitionEventId?: string;
  executedAt: string;
}): TransitionReference | null {
  if (input.transitions.length === 0) return null;

  if (input.transitionEventId) {
    const exact = input.transitions.find((transition) => transition.transitionEventId === input.transitionEventId);
    if (exact) return exact;
  }

  const desiredPhases = input.side === 'entry'
    ? uniquePhases([input.phase, 'triggered'])
    : input.side === 'partial'
      ? uniquePhases([input.phase, 'target1_hit'])
      : uniquePhases([input.phase, 'target2_hit', 'invalidated', 'target1_hit']);

  for (const phase of desiredPhases) {
    const match = input.transitions.find((transition) => {
      if (transition.phase !== phase) return false;
      if (phase === 'invalidated') {
        return transition.reason === 'stop';
      }
      return true;
    });

    if (match) return match;
  }

  const executedEpoch = Date.parse(input.executedAt);
  if (!Number.isFinite(executedEpoch)) return input.transitions[0];

  return input.transitions.reduce((closest, candidate) => {
    const closestEpoch = Date.parse(closest.timestamp);
    const candidateEpoch = Date.parse(candidate.timestamp);

    if (!Number.isFinite(candidateEpoch)) return closest;
    if (!Number.isFinite(closestEpoch)) return candidate;

    const closestDelta = Math.abs(executedEpoch - closestEpoch);
    const candidateDelta = Math.abs(executedEpoch - candidateEpoch);
    return candidateDelta < closestDelta ? candidate : closest;
  }, input.transitions[0]);
}

async function upsertEntryFillPrice(input: {
  setupId: string;
  sessionDate: string;
  fillPrice: number;
  source: ExecutionFillSource;
  existingEntryFillPrice: number | null;
}): Promise<void> {
  if (input.source === 'proxy' && input.existingEntryFillPrice != null) {
    return;
  }

  const { error } = await supabase
    .from('spx_setup_instances')
    .update({
      entry_fill_price: input.fillPrice,
      updated_at: new Date().toISOString(),
    })
    .eq('engine_setup_id', input.setupId)
    .eq('session_date', input.sessionDate);

  if (error) {
    logger.warn('SPX execution reconciliation: failed to update entry_fill_price', {
      setupId: input.setupId,
      sessionDate: input.sessionDate,
      source: input.source,
      error: error.message,
    });
  }
}

function normalizeSource(source: ExecutionFillSource | undefined): ExecutionFillSource {
  return source || 'manual';
}

export async function recordExecutionFill(input: RecordExecutionFillInput): Promise<ExecutionFillReconciliation> {
  const source = normalizeSource(input.source);
  const executedAt = toIso(input.executedAt);
  const fillPrice = round(input.fillPrice, 4);
  const fillQuantity = toFiniteNumber(input.fillQuantity);

  const latestInstance = await loadLatestInstanceReference(input.setupId);
  const sessionDate = latestInstance?.sessionDate || toSessionDate(executedAt);
  const direction = input.direction || latestInstance?.direction || null;

  const transitions = await loadTransitionReferences({
    setupId: input.setupId,
    sessionDate,
  });

  const reference = selectTransitionReference({
    transitions,
    side: input.side,
    phase: input.phase,
    transitionEventId: input.transitionEventId,
    executedAt,
  });

  const slippagePoints = direction && reference
    ? computeDirectionalSlippagePoints({
      side: input.side,
      direction,
      referencePrice: reference.price,
      fillPrice,
    })
    : null;

  const slippageBps = slippagePoints != null && reference
    ? computeSlippageBps(slippagePoints, reference.price)
    : null;

  const insertPayload: Record<string, unknown> = {
    engine_setup_id: input.setupId,
    session_date: sessionDate,
    side: input.side,
    phase: input.phase || reference?.phase || null,
    source,
    fill_price: fillPrice,
    fill_qty: fillQuantity,
    executed_at: executedAt,
    transition_event_id: input.transitionEventId || reference?.transitionEventId || null,
    reference_price: reference?.price || null,
    slippage_points: slippagePoints,
    slippage_bps: slippageBps,
    broker_order_id: input.brokerOrderId || null,
    broker_execution_id: input.brokerExecutionId || null,
    reported_by_user_id: isUuid(input.userId) ? input.userId : null,
    metadata: input.metadata || {},
    updated_at: new Date().toISOString(),
  };

  let fillId: number | null = null;
  const { data, error } = await supabase
    .from('spx_setup_execution_fills')
    .insert(insertPayload)
    .select('id')
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error.message)) {
      logger.warn('SPX execution reconciliation unavailable because table is missing', {
        setupId: input.setupId,
        error: error.message,
      });

      return {
        persisted: false,
        tableAvailable: false,
        fillId: null,
        setupId: input.setupId,
        sessionDate,
        side: input.side,
        phase: input.phase || reference?.phase || null,
        source,
        fillPrice,
        fillQuantity,
        executedAt,
        direction,
        reference,
        slippagePoints,
        slippageBps,
      };
    }

    if (input.brokerExecutionId && /duplicate key value|already exists/i.test(error.message)) {
      const { data: existing } = await supabase
        .from('spx_setup_execution_fills')
        .select('id')
        .eq('broker_execution_id', input.brokerExecutionId)
        .limit(1)
        .maybeSingle();
      fillId = toFiniteNumber((existing as { id?: unknown } | null)?.id);
    } else {
      throw new Error(`Failed to persist SPX execution fill: ${error.message}`);
    }
  } else {
    fillId = toFiniteNumber((data as { id?: unknown } | null)?.id);
  }

  if (input.side === 'entry') {
    await upsertEntryFillPrice({
      setupId: input.setupId,
      sessionDate,
      fillPrice,
      source,
      existingEntryFillPrice: latestInstance?.entryFillPrice ?? null,
    });
  }

  return {
    persisted: true,
    tableAvailable: true,
    fillId,
    setupId: input.setupId,
    sessionDate,
    side: input.side,
    phase: (insertPayload.phase as ExecutionTransitionPhase | null) || null,
    source,
    fillPrice,
    fillQuantity,
    executedAt,
    direction,
    reference,
    slippagePoints,
    slippageBps,
  };
}

function mapFillRowToReconciliation(row: RawFillRow): ExecutionFillReconciliation {
  const fillPrice = toFiniteNumber(row.fill_price) || 0;
  const fillQuantity = toFiniteNumber(row.fill_qty);
  const referencePrice = toFiniteNumber(row.reference_price);
  const slippagePoints = toFiniteNumber(row.slippage_points);
  const slippageBps = toFiniteNumber(row.slippage_bps);

  return {
    persisted: true,
    tableAvailable: true,
    fillId: row.id,
    setupId: row.engine_setup_id,
    sessionDate: row.session_date,
    side: row.side,
    phase: row.phase,
    source: row.source,
    fillPrice,
    fillQuantity,
    executedAt: row.executed_at,
    direction: null,
    reference: row.transition_event_id && referencePrice != null
      ? {
        transitionEventId: row.transition_event_id,
        phase: row.phase || 'triggered',
        reason: 'entry',
        price: referencePrice,
        timestamp: row.executed_at,
      }
      : null,
    slippagePoints,
    slippageBps,
  };
}

function compareFillPriority(a: RawFillRow, b: RawFillRow): number {
  const sourceDelta = (SOURCE_PRIORITY[b.source] || 0) - (SOURCE_PRIORITY[a.source] || 0);
  if (sourceDelta !== 0) return sourceDelta;

  const aEpoch = Date.parse(a.executed_at);
  const bEpoch = Date.parse(b.executed_at);
  if (Number.isFinite(aEpoch) && Number.isFinite(bEpoch) && bEpoch !== aEpoch) {
    return bEpoch - aEpoch;
  }

  return b.id - a.id;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return round(sum / values.length, 4);
}

export async function getExecutionReconciliationHistory(input: {
  setupId: string;
  sessionDate?: string;
}): Promise<ExecutionFillReconciliationHistory> {
  let query = supabase
    .from('spx_setup_execution_fills')
    .select('id,engine_setup_id,session_date,side,phase,source,fill_price,fill_qty,executed_at,transition_event_id,reference_price,slippage_points,slippage_bps,metadata')
    .eq('engine_setup_id', input.setupId)
    .order('executed_at', { ascending: false })
    .limit(60);

  if (input.sessionDate) {
    query = query.eq('session_date', input.sessionDate);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingRelationError(error.message)) {
      return {
        setupId: input.setupId,
        count: 0,
        fills: [],
      };
    }
    throw new Error(`Failed to load SPX execution reconciliation history: ${error.message}`);
  }

  const rows = ((data || []) as RawFillRow[])
    .sort(compareFillPriority);

  return {
    setupId: input.setupId,
    count: rows.length,
    fills: rows.map((row) => mapFillRowToReconciliation(row)),
  };
}

export async function summarizeExecutionFillSourceComposition(input: {
  setupId: string;
  sessionDate?: string;
}): Promise<ExecutionFillSourceComposition> {
  const history = await getExecutionReconciliationHistory(input);
  const total = history.fills.length;
  const bySourceMap = new Map<ExecutionFillSource, {
    fillCount: number;
    entryFillCount: number;
    exitFillCount: number;
    entrySlippagePts: number[];
    exitSlippagePts: number[];
    entrySlippageBps: number[];
    exitSlippageBps: number[];
  }>();

  const sources: ExecutionFillSource[] = ['broker_tradier', 'broker_other', 'manual', 'proxy'];
  for (const source of sources) {
    bySourceMap.set(source, {
      fillCount: 0,
      entryFillCount: 0,
      exitFillCount: 0,
      entrySlippagePts: [],
      exitSlippagePts: [],
      entrySlippageBps: [],
      exitSlippageBps: [],
    });
  }

  for (const fill of history.fills) {
    const bucket = bySourceMap.get(fill.source);
    if (!bucket) continue;
    bucket.fillCount += 1;
    if (fill.side === 'entry') {
      bucket.entryFillCount += 1;
      if (typeof fill.slippagePoints === 'number') bucket.entrySlippagePts.push(fill.slippagePoints);
      if (typeof fill.slippageBps === 'number') bucket.entrySlippageBps.push(fill.slippageBps);
    } else if (fill.side === 'exit') {
      bucket.exitFillCount += 1;
      if (typeof fill.slippagePoints === 'number') bucket.exitSlippagePts.push(fill.slippagePoints);
      if (typeof fill.slippageBps === 'number') bucket.exitSlippageBps.push(fill.slippageBps);
    }
  }

  const bySource: ExecutionFillSourceBucket[] = sources.map((source) => {
    const bucket = bySourceMap.get(source)!;
    return {
      source,
      fillCount: bucket.fillCount,
      fillSharePct: total > 0 ? round((bucket.fillCount / total) * 100, 2) : 0,
      entryFillCount: bucket.entryFillCount,
      exitFillCount: bucket.exitFillCount,
      avgEntrySlippagePts: average(bucket.entrySlippagePts),
      avgExitSlippagePts: average(bucket.exitSlippagePts),
      avgEntrySlippageBps: average(bucket.entrySlippageBps),
      avgExitSlippageBps: average(bucket.exitSlippageBps),
    };
  });

  const proxyCount = bySourceMap.get('proxy')?.fillCount || 0;
  const proxySharePct = total > 0 ? round((proxyCount / total) * 100, 2) : 0;

  return {
    setupId: input.setupId,
    sessionDate: input.sessionDate || null,
    totalFills: total,
    proxySharePct,
    nonProxySharePct: total > 0 ? round(100 - proxySharePct, 2) : 0,
    bySource,
  };
}
