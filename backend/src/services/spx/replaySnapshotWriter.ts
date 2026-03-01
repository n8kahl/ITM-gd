import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { isMarketOpen, toEasternTime } from '../marketHours';
import type { SPXMultiTFConfluenceContext } from './multiTFConfluence';
import type { Setup, SPXFlowEvent, SPXSnapshot } from './types';

const DEFAULT_SYMBOL = 'SPX';
const MAX_INSERT_BATCH_SIZE = 5;
const DEFAULT_FLUSH_INTERVAL_MS = 60_000;

export type ReplaySnapshotCaptureMode = 'interval' | 'setup_transition';

export interface ReplaySnapshotCaptureInput {
  snapshot: SPXSnapshot;
  capturedAt?: Date;
  symbol?: string;
  captureMode?: ReplaySnapshotCaptureMode;
  multiTFContext?: SPXMultiTFConfluenceContext | null;
}

export interface ReplaySnapshotInsertRow {
  session_date: string;
  symbol: string;
  captured_at: string;
  gex_net_gamma: number | null;
  gex_call_wall: number | null;
  gex_put_wall: number | null;
  gex_flip_point: number | null;
  gex_key_levels: unknown[] | null;
  gex_expiry_breakdown: Record<string, unknown> | null;
  flow_bias_5m: string | null;
  flow_bias_15m: string | null;
  flow_bias_30m: string | null;
  flow_event_count: number;
  flow_sweep_count: number;
  flow_bullish_premium: number;
  flow_bearish_premium: number;
  flow_events: unknown[] | null;
  regime: string | null;
  regime_direction: string | null;
  regime_probability: number | null;
  regime_confidence: number | null;
  regime_volume_trend: string | null;
  levels: unknown[] | null;
  cluster_zones: unknown[] | null;
  mtf_1h_trend: string | null;
  mtf_15m_trend: string | null;
  mtf_5m_trend: string | null;
  mtf_1m_trend: string | null;
  mtf_composite: number | null;
  mtf_aligned: boolean | null;
  vix_value: number | null;
  vix_regime: string | null;
  env_gate_passed: boolean | null;
  env_gate_reasons: string[];
  macro_next_event: Record<string, unknown> | null;
  session_minute_et: number | null;
  basis_value: number | null;
  spx_price: number | null;
  spy_price: number | null;
  rr_ratio: number | null;
  ev_r: number | null;
  memory_setup_type: string | null;
  memory_test_count: number | null;
  memory_win_rate: number | null;
  memory_hold_rate: number | null;
  memory_confidence: number | null;
  memory_score: number | null;
}

interface ReplaySnapshotInsertError {
  message?: string;
  code?: string;
}

interface ReplaySnapshotInsertResponse {
  error: ReplaySnapshotInsertError | null;
}

interface ReplaySnapshotTableClient {
  insert: (rows: ReplaySnapshotInsertRow[]) => Promise<ReplaySnapshotInsertResponse>;
}

interface ReplaySnapshotDbClient {
  from: (table: string) => ReplaySnapshotTableClient;
}

interface ReplaySnapshotLogger {
  warn: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
}

interface ReplaySnapshotWriterDependencies {
  db: ReplaySnapshotDbClient;
  logger: ReplaySnapshotLogger;
  env: NodeJS.ProcessEnv;
  isMarketOpen: (date?: Date) => boolean;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}

function parsePositiveIntegerEnv(value: string | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function resolveCapturedAt(explicit: Date | undefined, generatedAt: string): Date {
  if (explicit && Number.isFinite(explicit.getTime())) return explicit;

  const parsedGeneratedAt = new Date(generatedAt);
  if (Number.isFinite(parsedGeneratedAt.getTime())) return parsedGeneratedAt;

  return new Date();
}

function setupStatusRank(status: Setup['status']): number {
  switch (status) {
    case 'triggered':
      return 0;
    case 'ready':
      return 1;
    case 'forming':
      return 2;
    case 'invalidated':
      return 3;
    case 'expired':
      return 4;
    default:
      return 5;
  }
}

function selectPrimarySetup(setups: Setup[]): Setup | null {
  if (!Array.isArray(setups) || setups.length === 0) return null;

  const ranked = [...setups].sort((left, right) => {
    const statusDelta = setupStatusRank(left.status) - setupStatusRank(right.status);
    if (statusDelta !== 0) return statusDelta;

    const scoreDelta = (toNullableNumber(right.confluenceScore) ?? 0) - (toNullableNumber(left.confluenceScore) ?? 0);
    if (scoreDelta !== 0) return scoreDelta;

    return left.id.localeCompare(right.id);
  });

  return ranked[0] ?? null;
}

function computeRiskRewardRatio(primarySetup: Setup | null): number | null {
  if (!primarySetup) return null;

  const entryLow = toNullableNumber(primarySetup.entryZone?.low);
  const entryHigh = toNullableNumber(primarySetup.entryZone?.high);
  const stop = toNullableNumber(primarySetup.stop);
  const target1 = toNullableNumber(primarySetup.target1?.price);

  if (entryLow == null || entryHigh == null || stop == null || target1 == null) return null;

  const entry = (entryLow + entryHigh) / 2;
  const risk = Math.abs(entry - stop);
  if (!Number.isFinite(risk) || risk <= 0) return null;

  const reward = Math.abs(target1 - entry);
  if (!Number.isFinite(reward)) return null;

  return reward / risk;
}

function flowPremium(flowEvents: SPXFlowEvent[], direction: 'bullish' | 'bearish'): number {
  return flowEvents
    .filter((event) => event.direction === direction)
    .reduce((sum, event) => sum + (toNullableNumber(event.premium) ?? 0), 0);
}

export function isReplaySnapshotEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return parseBooleanEnv(env.REPLAY_SNAPSHOT_ENABLED, true);
}

function getReplaySnapshotFlushIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
  return parsePositiveIntegerEnv(env.REPLAY_SNAPSHOT_INTERVAL_MS, DEFAULT_FLUSH_INTERVAL_MS);
}

export function mapSnapshotToReplaySnapshotRow(input: ReplaySnapshotCaptureInput): ReplaySnapshotInsertRow {
  const capturedAt = resolveCapturedAt(input.capturedAt, input.snapshot.generatedAt);
  const capturedAtIso = capturedAt.toISOString();
  const sessionDate = toEasternTime(capturedAt).dateStr;

  const flowEvents = Array.isArray(input.snapshot.flow) ? input.snapshot.flow : [];
  const flowAggregation = input.snapshot.flowAggregation;
  const environmentGate = input.snapshot.environmentGate ?? null;
  const primarySetup = selectPrimarySetup(input.snapshot.setups || []);
  const rrRatio = computeRiskRewardRatio(primarySetup);
  const memoryContext = primarySetup?.memoryContext;
  const mtfSetup = primarySetup?.multiTFConfluence;
  const gex = input.snapshot.gex?.spx;

  const envGateReasons = Array.isArray(environmentGate?.reasons)
    ? environmentGate.reasons.filter((reason): reason is string => typeof reason === 'string')
    : [];

  return {
    session_date: sessionDate,
    symbol: input.symbol || DEFAULT_SYMBOL,
    captured_at: capturedAtIso,
    gex_net_gamma: toNullableNumber(gex?.netGex),
    gex_call_wall: toNullableNumber(gex?.callWall),
    gex_put_wall: toNullableNumber(gex?.putWall),
    gex_flip_point: toNullableNumber(gex?.flipPoint),
    gex_key_levels: Array.isArray(gex?.keyLevels) ? gex.keyLevels : null,
    gex_expiry_breakdown: gex?.expirationBreakdown && typeof gex.expirationBreakdown === 'object'
      ? gex.expirationBreakdown as Record<string, unknown>
      : null,
    flow_bias_5m: flowAggregation?.windows?.['5m']?.bias ?? null,
    flow_bias_15m: flowAggregation?.windows?.['15m']?.bias ?? null,
    flow_bias_30m: flowAggregation?.windows?.['30m']?.bias ?? null,
    flow_event_count: flowEvents.length,
    flow_sweep_count: flowEvents.filter((event) => event.type === 'sweep').length,
    flow_bullish_premium: flowPremium(flowEvents, 'bullish'),
    flow_bearish_premium: flowPremium(flowEvents, 'bearish'),
    flow_events: flowEvents,
    regime: input.snapshot.regime?.regime ?? null,
    regime_direction: input.snapshot.regime?.direction ?? null,
    regime_probability: toNullableNumber(input.snapshot.regime?.probability),
    regime_confidence: toNullableNumber(input.snapshot.regime?.confidence),
    regime_volume_trend: primarySetup?.volumeTrend ?? null,
    levels: Array.isArray(input.snapshot.levels) ? input.snapshot.levels : null,
    cluster_zones: Array.isArray(input.snapshot.clusters) ? input.snapshot.clusters : null,
    mtf_1h_trend: input.multiTFContext?.tf1h?.trend ?? null,
    mtf_15m_trend: input.multiTFContext?.tf15m?.trend ?? null,
    mtf_5m_trend: input.multiTFContext?.tf5m?.trend ?? null,
    mtf_1m_trend: input.multiTFContext?.tf1m?.trend ?? null,
    mtf_composite: toNullableNumber(mtfSetup?.score),
    mtf_aligned: typeof mtfSetup?.aligned === 'boolean' ? mtfSetup.aligned : null,
    vix_value: toNullableNumber(environmentGate?.breakdown?.vixRegime?.value),
    vix_regime: environmentGate?.vixRegime ?? null,
    env_gate_passed: typeof environmentGate?.passed === 'boolean' ? environmentGate.passed : null,
    env_gate_reasons: envGateReasons,
    macro_next_event: environmentGate?.breakdown?.macroCalendar?.nextEvent
      ? environmentGate.breakdown.macroCalendar.nextEvent as Record<string, unknown>
      : null,
    session_minute_et: toNullableNumber(environmentGate?.breakdown?.sessionTime?.minuteEt),
    basis_value: toNullableNumber(input.snapshot.basis?.current),
    spx_price: toNullableNumber(input.snapshot.basis?.spxPrice),
    spy_price: toNullableNumber(input.snapshot.basis?.spyPrice),
    rr_ratio: rrRatio,
    ev_r: toNullableNumber(primarySetup?.evR),
    memory_setup_type: primarySetup?.type ?? null,
    memory_test_count: toNullableNumber(memoryContext?.tests),
    memory_win_rate: toNullableNumber(memoryContext?.winRatePct),
    memory_hold_rate: toNullableNumber(primarySetup?.clusterZone?.holdRate),
    memory_confidence: toNullableNumber(memoryContext?.confidence),
    memory_score: toNullableNumber(memoryContext?.score),
  };
}

export class ReplaySnapshotWriterService {
  private readonly deps: ReplaySnapshotWriterDependencies;
  private readonly pendingRows: ReplaySnapshotInsertRow[] = [];
  private flushInFlight: Promise<void> | null = null;
  private flushIntervalHandle: NodeJS.Timeout | null = null;

  constructor(dependencies?: Partial<ReplaySnapshotWriterDependencies>) {
    this.deps = {
      db: dependencies?.db ?? (supabase as unknown as ReplaySnapshotDbClient),
      logger: dependencies?.logger ?? logger,
      env: dependencies?.env ?? process.env,
      isMarketOpen: dependencies?.isMarketOpen ?? isMarketOpen,
    };
  }

  getPendingCount(): number {
    return this.pendingRows.length;
  }

  start(): void {
    try {
      if (!isReplaySnapshotEnabled(this.deps.env)) {
        return;
      }

      if (this.flushIntervalHandle) {
        return;
      }

      const intervalMs = getReplaySnapshotFlushIntervalMs(this.deps.env);
      this.flushIntervalHandle = setInterval(() => {
        void this.flush().catch((error) => {
          this.deps.logger.warn('Replay snapshot periodic flush failed; continuing fail-open', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }, intervalMs);

      if (typeof this.flushIntervalHandle.unref === 'function') {
        this.flushIntervalHandle.unref();
      }
    } catch (error) {
      this.deps.logger.warn('Replay snapshot writer failed to start; continuing fail-open', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.flushIntervalHandle) {
        clearInterval(this.flushIntervalHandle);
        this.flushIntervalHandle = null;
      }

      await this.flush();
    } catch (error) {
      this.deps.logger.warn('Replay snapshot writer failed to stop; continuing fail-open', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async capture(input: ReplaySnapshotCaptureInput): Promise<void> {
    if (!isReplaySnapshotEnabled(this.deps.env)) {
      return;
    }

    const captureMode = input.captureMode ?? 'interval';
    const capturedAt = resolveCapturedAt(input.capturedAt, input.snapshot.generatedAt);

    if (captureMode === 'interval' && !this.deps.isMarketOpen(capturedAt)) {
      this.deps.logger.debug('Replay snapshot capture skipped because market is closed', {
        capturedAt: capturedAt.toISOString(),
      });
      return;
    }

    this.pendingRows.push(mapSnapshotToReplaySnapshotRow({
      ...input,
      capturedAt,
    }));

    if (this.pendingRows.length >= MAX_INSERT_BATCH_SIZE) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushInFlight) {
      return this.flushInFlight;
    }

    this.flushInFlight = this.flushInternal().finally(() => {
      this.flushInFlight = null;
    });

    return this.flushInFlight;
  }

  private async flushInternal(): Promise<void> {
    if (!isReplaySnapshotEnabled(this.deps.env)) {
      this.pendingRows.splice(0, this.pendingRows.length);
      return;
    }

    while (this.pendingRows.length > 0) {
      const batch = this.pendingRows.splice(0, MAX_INSERT_BATCH_SIZE);

      try {
        const { error } = await this.deps.db
          .from('replay_snapshots')
          .insert(batch);

        if (error) {
          this.deps.logger.warn('Replay snapshot insert failed; continuing without blocking engine', {
            error: error.message || 'unknown_error',
            code: error.code,
            batchSize: batch.length,
          });
        }
      } catch (error) {
        this.deps.logger.warn('Replay snapshot insert threw; continuing without blocking engine', {
          error: error instanceof Error ? error.message : String(error),
          batchSize: batch.length,
        });
      }
    }
  }
}

export const replaySnapshotWriter = new ReplaySnapshotWriterService();
