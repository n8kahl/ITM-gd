import type {
  MassiveAggregate,
  OptionsContract as MassiveOptionsContract,
} from '../../config/massive';
import { getAggregates } from '../../config/massive';
import { getMinuteAggregates } from '../../config/massive';
import { getOptionsContracts } from '../../config/massive';
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
export type SPXBacktestExecutionBasis = 'underlying' | 'options_contract';

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
}

interface EvaluatedSetup {
  row: SetupInstanceRow;
  ambiguityCount: number;
  missingTarget2: boolean;
  realizedR: number | null;
}

interface HistoricalOptionContractChoice {
  ticker: string;
  expiry: string;
  strike: number;
  type: 'call' | 'put';
}

interface BacktestPauseFilters {
  pausedSetupTypes: Set<string>;
  pausedCombos: Set<string>;
  notes: string[];
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

export interface SPXContractReplayTradeResult {
  engineSetupId: string;
  sessionDate: string;
  setupType: string;
  direction: 'bullish' | 'bearish';
  contractTicker: string | null;
  contractType: 'call' | 'put' | null;
  strike: number | null;
  expiry: string | null;
  entryTimestamp: string | null;
  exitTimestamp: string | null;
  entryPremium: number | null;
  exitPremium: number | null;
  returnPct: number | null;
  pnlOneContract: number | null;
  status:
    | 'ok'
    | 'not_triggered'
    | 'missing_snapshot'
    | 'missing_contract'
    | 'missing_bars'
    | 'missing_entry_price'
    | 'missing_exit_price';
  resolutionUsed: 'second' | 'minute' | 'none';
  usedMinuteFallback: boolean;
}

export interface SPXContractReplaySummary {
  executionBasis: SPXBacktestExecutionBasis;
  strictBars: boolean;
  requestedResolution: SPXBacktestPriceResolution;
  resolutionUsed: 'second' | 'minute' | 'mixed' | 'none';
  replayUniverse: number;
  replayedTrades: number;
  skippedTrades: number;
  coveragePct: number;
  minimumCoveragePct: number;
  coverageValid: boolean;
  missingSnapshotCount: number;
  missingContractCount: number;
  missingBarsCount: number;
  missingEntryPriceCount: number;
  missingExitPriceCount: number;
  usedMinuteFallback: boolean;
  positiveTrades: number;
  nonPositiveTrades: number;
  winRatePct: number;
  averageReturnPct: number;
  medianReturnPct: number;
  cumulativeReturnPct: number;
  cumulativePnlOneContract: number;
  bySetupType: Array<{
    key: string;
    tradeCount: number;
    winRatePct: number;
    averageReturnPct: number;
    cumulativePnlOneContract: number;
  }>;
  trades?: SPXContractReplayTradeResult[];
}

export interface SPXBacktestOptionsReplayConfig {
  strictBars?: boolean;
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
const DEFAULT_OPTIONS_REPLAY_STRICT_BARS = parseBooleanEnv(
  process.env.SPX_BACKTEST_OPTIONS_REPLAY_STRICT_BARS,
  true,
);
const DEFAULT_OPTIONS_REPLAY_LATE_DAY_CUTOFF_MINUTES_ET = (() => {
  const raw = process.env.SPX_BACKTEST_OPTIONS_REPLAY_ZERO_DTE_CUTOFF_ET || '14:45';
  const [hourRaw, minuteRaw] = raw.split(':');
  const hour = Number.parseInt(hourRaw || '', 10);
  const minute = Number.parseInt(minuteRaw || '', 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return (14 * 60) + 45;
  return Math.max(0, Math.min((23 * 60) + 59, (hour * 60) + minute));
})();
const OPTIONS_REPLAY_MAX_EXPIRY_LOOKAHEAD_DAYS = 5;
const OPTIONS_REPLAY_MAX_CANDIDATE_CONTRACTS = 20;
const OPTIONS_REPLAY_MAX_STRIKE_DISTANCE_POINTS = 260;
const OPTIONS_REPLAY_MIN_COVERAGE_PCT = clamp(
  parseFloatEnv(process.env.SPX_BACKTEST_OPTIONS_REPLAY_MIN_COVERAGE_PCT, 60, 0),
  0,
  100,
);
const DB_PAGE_SIZE = 1000;

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

function toGeometryBucket(firstSeenAtIso: string | null): 'opening' | 'midday' | 'late' {
  const minuteSinceOpen = toSessionMinuteEt(firstSeenAtIso);
  if (minuteSinceOpen == null) return 'midday';
  if (minuteSinceOpen <= 90) return 'opening';
  if (minuteSinceOpen <= 240) return 'midday';
  return 'late';
}

function resolveGeometryAdjustmentForSetup(
  setup: BacktestSetupCandidate,
  map: Record<string, SPXBacktestGeometryAdjustment>,
): SPXBacktestGeometryAdjustment | null {
  const regime = setup.regime || 'unknown';
  const bucket = toGeometryBucket(setup.firstSeenAt);
  const keys = [
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

export interface SPXWinRateBacktestResult {
  dateRange: { from: string; to: string };
  sourceUsed: InternalBacktestSource | 'none';
  executionBasis: SPXBacktestExecutionBasis;
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
  optionsReplay?: SPXContractReplaySummary;
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
}): Promise<BacktestPauseFilters> {
  if (input.includePausedSetups) {
    return {
      pausedSetupTypes: new Set(),
      pausedCombos: new Set(),
      notes: [],
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
    };
  }

  const driftControl = profile.driftControl && typeof profile.driftControl === 'object' && !Array.isArray(profile.driftControl)
    ? profile.driftControl as Record<string, unknown>
    : null;
  const regimeGate = profile.regimeGate && typeof profile.regimeGate === 'object' && !Array.isArray(profile.regimeGate)
    ? profile.regimeGate as Record<string, unknown>
    : null;

  return {
    pausedSetupTypes: parseStringSet(driftControl?.pausedSetupTypes),
    pausedCombos: parseStringSet(regimeGate?.pausedCombos),
    notes: [],
  };
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
  includeHiddenTiers?: boolean;
  includePausedSetups?: boolean;
}): Promise<{ setups: BacktestSetupCandidate[]; notes: string[]; tableMissing: boolean }> {
  const includeBlockedSetups = input.includeBlockedSetups === true;
  const includeHiddenTiers = input.includeHiddenTiers === true;
  const includePausedSetups = input.includePausedSetups === true;
  const pauseFilters = await loadBacktestPauseFilters({ includePausedSetups });
  const rows: Record<string, unknown>[] = [];
  let page = 0;
  while (true) {
    const fromIndex = page * DB_PAGE_SIZE;
    const toIndex = fromIndex + DB_PAGE_SIZE - 1;
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
      .lte('session_date', input.to)
      .order('session_date', { ascending: true })
      .order('engine_setup_id', { ascending: true })
      .range(fromIndex, toIndex);

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

    const pageRows = (Array.isArray(data) ? data : []) as unknown as Record<string, unknown>[];
    rows.push(...pageRows);
    if (pageRows.length < DB_PAGE_SIZE) break;
    page += 1;
  }

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
      tradeManagement: null,
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

function toBacktestSetupKey(input: { engineSetupId: string; sessionDate: string }): string {
  return `${input.engineSetupId}:${input.sessionDate}`;
}

function contractTypeForDirection(direction: 'bullish' | 'bearish'): 'call' | 'put' {
  return direction === 'bullish' ? 'call' : 'put';
}

function etMinuteOfDay(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const epoch = Date.parse(iso);
  if (!Number.isFinite(epoch)) return null;
  const et = toEasternTime(new Date(epoch));
  return (et.hour * 60) + et.minute;
}

function candidateExpiryDates(sessionDate: string, preferNextExpiry: boolean): string[] {
  const dates: string[] = [];
  let cursor = sessionDate;
  for (let day = 0; day <= OPTIONS_REPLAY_MAX_EXPIRY_LOOKAHEAD_DAYS; day += 1) {
    if (day > 0) {
      cursor = nextDate(cursor);
    }
    dates.push(cursor);
  }

  if (!preferNextExpiry) return dates;
  const [today, ...rest] = dates;
  return [...rest, today];
}

function toOptionExpiryDistanceDays(expiry: string, reference: string): number {
  const expiryEpoch = Date.parse(`${expiry}T00:00:00.000Z`);
  const referenceEpoch = Date.parse(`${reference}T00:00:00.000Z`);
  if (!Number.isFinite(expiryEpoch) || !Number.isFinite(referenceEpoch)) return 0;
  return Math.max(0, Math.round((expiryEpoch - referenceEpoch) / 86400000));
}

function normalizeContractTicker(ticker: string | null | undefined): string | null {
  if (typeof ticker !== 'string') return null;
  const normalized = ticker.trim().toUpperCase();
  return normalized || null;
}

async function loadCandidateContractsForSetup(input: {
  setup: BacktestSetupCandidate;
  row: SetupInstanceRow;
  contractsByExpiry: Map<string, MassiveOptionsContract[]>;
}): Promise<HistoricalOptionContractChoice[]> {
  const desiredType = contractTypeForDirection(input.setup.direction);
  const underlyingEntry = typeof input.row.entry_fill_price === 'number' && Number.isFinite(input.row.entry_fill_price)
    ? input.row.entry_fill_price
    : (input.setup.entryLow + input.setup.entryHigh) / 2;
  if (!(underlyingEntry > 0)) return [];

  const triggerMinutesEt = etMinuteOfDay(input.row.triggered_at || input.setup.firstSeenAt);
  const preferNextExpiry = triggerMinutesEt != null
    && triggerMinutesEt >= DEFAULT_OPTIONS_REPLAY_LATE_DAY_CUTOFF_MINUTES_ET;
  const expiries = candidateExpiryDates(input.setup.sessionDate, preferNextExpiry);
  const seen = new Set<string>();
  const collected: Array<HistoricalOptionContractChoice & { strikeDistance: number; expiryDistance: number }> = [];

  for (const expiry of expiries) {
    const cacheKey = `${input.setup.sessionDate}:${expiry}`;
    if (!input.contractsByExpiry.has(cacheKey)) {
      try {
        const contracts = await getOptionsContracts('SPX', expiry, 1000, input.setup.sessionDate);
        input.contractsByExpiry.set(cacheKey, contracts);
      } catch (error) {
        logger.warn('SPX options replay historical contracts load failed', {
          sessionDate: input.setup.sessionDate,
          expiry,
          error: error instanceof Error ? error.message : String(error),
        });
        input.contractsByExpiry.set(cacheKey, []);
      }
    }

    const contracts = input.contractsByExpiry.get(cacheKey) || [];
    for (const contract of contracts) {
      const ticker = normalizeContractTicker(contract.ticker);
      if (!ticker || seen.has(ticker)) continue;
      if (contract.contract_type !== desiredType) continue;
      if (contract.expiration_date < input.setup.sessionDate) continue;
      const strike = typeof contract.strike_price === 'number' ? contract.strike_price : Number.NaN;
      if (!Number.isFinite(strike)) continue;
      const strikeDistance = Math.abs(strike - underlyingEntry);
      if (strikeDistance > OPTIONS_REPLAY_MAX_STRIKE_DISTANCE_POINTS) continue;

      seen.add(ticker);
      collected.push({
        ticker,
        expiry: contract.expiration_date,
        strike,
        type: contract.contract_type,
        strikeDistance,
        expiryDistance: toOptionExpiryDistanceDays(contract.expiration_date, input.setup.sessionDate),
      });
    }

    if (collected.length >= OPTIONS_REPLAY_MAX_CANDIDATE_CONTRACTS) break;
  }

  return collected
    .sort((a, b) => (
      a.expiryDistance - b.expiryDistance
      || a.strikeDistance - b.strikeDistance
      || a.strike - b.strike
    ))
    .slice(0, OPTIONS_REPLAY_MAX_CANDIDATE_CONTRACTS)
    .map((contract) => ({
      ticker: contract.ticker,
      expiry: contract.expiry,
      strike: round(contract.strike, 2),
      type: contract.type,
    }));
}

function rankHistoricalOptionContracts(input: {
  setup: BacktestSetupCandidate;
  row: SetupInstanceRow;
  contracts: HistoricalOptionContractChoice[];
}): HistoricalOptionContractChoice[] {
  const underlyingEntry = typeof input.row.entry_fill_price === 'number' && Number.isFinite(input.row.entry_fill_price)
    ? input.row.entry_fill_price
    : (input.setup.entryLow + input.setup.entryHigh) / 2;
  if (!(underlyingEntry > 0)) return [];
  if (input.contracts.length === 0) return [];

  const triggerMinutesEt = etMinuteOfDay(input.row.triggered_at || input.setup.firstSeenAt);
  const preferNextExpiry = triggerMinutesEt != null
    && triggerMinutesEt >= DEFAULT_OPTIONS_REPLAY_LATE_DAY_CUTOFF_MINUTES_ET;
  const setupKey = input.setup.setupType.toLowerCase();
  const preferMomentumMoneyness = setupKey.includes('trend') || setupKey.includes('orb') || setupKey.includes('breakout');

  const expiries = Array.from(new Set(input.contracts.map((row) => row.expiry))).sort();
  const preferredExpiry = (() => {
    if (preferNextExpiry) {
      const next = expiries.find((expiry) => expiry > input.setup.sessionDate);
      return next || expiries[0];
    }
    const sameDay = expiries.find((expiry) => expiry === input.setup.sessionDate);
    if (sameDay) return sameDay;
    return expiries[0];
  })();

  const scored = input.contracts.map((contract) => {
    const strikeDistance = Math.abs(contract.strike - underlyingEntry);
    const strikeDistancePct = strikeDistance / Math.max(underlyingEntry, 1);
    const expiryDistancePenalty = Math.abs(
      toOptionExpiryDistanceDays(contract.expiry, input.setup.sessionDate)
      - toOptionExpiryDistanceDays(preferredExpiry, input.setup.sessionDate),
    ) * 0.03;

    let directionalPenalty = 0;
    if (preferMomentumMoneyness) {
      if (contract.type === 'call' && contract.strike < underlyingEntry) directionalPenalty += 0.04;
      if (contract.type === 'put' && contract.strike > underlyingEntry) directionalPenalty += 0.04;
    } else {
      directionalPenalty += strikeDistancePct * 0.2;
    }

    const score = (strikeDistancePct * 100) + expiryDistancePenalty + directionalPenalty;
    return { ...contract, score };
  });
  const scoped = scored
    .filter((row) => row.expiry === preferredExpiry)
    .sort((a, b) => a.score - b.score || a.strike - b.strike);
  const ordered = scoped.length > 0
    ? scoped
    : scored.sort((a, b) => a.score - b.score || a.strike - b.strike);

  return ordered.map((contract) => ({
    ticker: contract.ticker,
    expiry: contract.expiry,
    strike: round(contract.strike, 2),
    type: contract.type,
  }));
}

function chooseHistoricalOptionContract(input: {
  setup: BacktestSetupCandidate;
  row: SetupInstanceRow;
  contracts: HistoricalOptionContractChoice[];
}): HistoricalOptionContractChoice | null {
  const ranked = rankHistoricalOptionContracts(input);
  const best = ranked[0];
  if (!best) return null;

  return {
    ticker: best.ticker,
    expiry: best.expiry,
    strike: round(best.strike, 2),
    type: best.type,
  };
}

async function loadOptionBarsForReplay(input: {
  optionTicker: string;
  sessionDate: string;
  requestedResolution: SPXBacktestPriceResolution;
  strictBars: boolean;
}): Promise<{
  bars: MassiveAggregate[];
  resolutionUsed: 'second' | 'minute' | 'none';
  usedMinuteFallback: boolean;
}> {
  const shouldTrySecond = input.requestedResolution === 'second' || input.requestedResolution === 'auto';
  const shouldTryMinute = input.requestedResolution === 'minute'
    || input.requestedResolution === 'auto'
    || !input.strictBars;

  if (shouldTrySecond) {
    try {
      const secondBars = await getAggregates(input.optionTicker, 1, 'second', input.sessionDate, input.sessionDate);
      const rows = (secondBars.results || []).sort((a, b) => a.t - b.t);
      if (rows.length > 0) {
        return {
          bars: rows,
          resolutionUsed: 'second',
          usedMinuteFallback: false,
        };
      }
    } catch (error) {
      logger.warn('SPX options replay failed to load option second bars', {
        optionTicker: input.optionTicker,
        sessionDate: input.sessionDate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (shouldTryMinute) {
    try {
      const minuteBars = await getMinuteAggregates(input.optionTicker, input.sessionDate);
      const rows = (minuteBars || []).sort((a, b) => a.t - b.t);
      if (rows.length > 0) {
        return {
          bars: rows,
          resolutionUsed: 'minute',
          usedMinuteFallback: shouldTrySecond,
        };
      }
    } catch (error) {
      logger.warn('SPX options replay failed to load option minute bars', {
        optionTicker: input.optionTicker,
        sessionDate: input.sessionDate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    bars: [],
    resolutionUsed: 'none',
    usedMinuteFallback: false,
  };
}

function findBarCloseAtOrAfter(bars: MassiveAggregate[], timestampIso: string | null | undefined): number | null {
  const timestampMs = toEpochMs(timestampIso);
  if (timestampMs == null || bars.length === 0) return null;

  if (timestampMs <= bars[0].t) return bars[0].c;
  if (timestampMs >= bars[bars.length - 1].t) return bars[bars.length - 1].c;

  let left = 0;
  let right = bars.length - 1;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (bars[mid].t >= timestampMs) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }

  const bar = bars[left];
  return Number.isFinite(bar?.c) ? bar.c : null;
}

function oneContractPnl(entryPremium: number, exitPremium: number): number {
  return (exitPremium - entryPremium) * 100;
}

function buildEmptyOptionsReplaySummary(input: {
  requestedResolution: SPXBacktestPriceResolution;
  strictBars: boolean;
  includeTrades: boolean;
}): SPXContractReplaySummary {
  return {
    executionBasis: 'options_contract',
    strictBars: input.strictBars,
    requestedResolution: input.requestedResolution,
    resolutionUsed: 'none',
    replayUniverse: 0,
    replayedTrades: 0,
    skippedTrades: 0,
    coveragePct: 0,
    minimumCoveragePct: OPTIONS_REPLAY_MIN_COVERAGE_PCT,
    coverageValid: true,
    missingSnapshotCount: 0,
    missingContractCount: 0,
    missingBarsCount: 0,
    missingEntryPriceCount: 0,
    missingExitPriceCount: 0,
    usedMinuteFallback: false,
    positiveTrades: 0,
    nonPositiveTrades: 0,
    winRatePct: 0,
    averageReturnPct: 0,
    medianReturnPct: 0,
    cumulativeReturnPct: 0,
    cumulativePnlOneContract: 0,
    bySetupType: [],
    ...(input.includeTrades ? { trades: [] } : {}),
  };
}

async function buildOptionsContractReplaySummary(input: {
  evaluated: EvaluatedSetup[];
  setupByKey: Map<string, BacktestSetupCandidate>;
  barsBySession: Map<string, MassiveAggregate[]>;
  requestedResolution: SPXBacktestPriceResolution;
  strictBars: boolean;
  executionModel: SPXBacktestExecutionModel;
  includeTrades: boolean;
}): Promise<SPXContractReplaySummary> {
  const summary = buildEmptyOptionsReplaySummary({
    requestedResolution: input.requestedResolution,
    strictBars: input.strictBars,
    includeTrades: input.includeTrades,
  });

  const triggeredRows = input.evaluated.filter((entry) => Boolean(entry.row.triggered_at));
  if (triggeredRows.length === 0) {
    return summary;
  }

  summary.replayUniverse = triggeredRows.length;
  const contractsByExpiry = new Map<string, MassiveOptionsContract[]>();

  const barCache = new Map<string, {
    bars: MassiveAggregate[];
    resolutionUsed: 'second' | 'minute' | 'none';
    usedMinuteFallback: boolean;
  }>();
  const replayRows: SPXContractReplayTradeResult[] = [];

  for (const entry of triggeredRows) {
    const row = entry.row;
    const setupKey = toBacktestSetupKey({
      engineSetupId: row.engine_setup_id,
      sessionDate: row.session_date,
    });
    const setup = input.setupByKey.get(setupKey);
    if (!setup) continue;

    const contracts = await loadCandidateContractsForSetup({
      setup,
      row,
      contractsByExpiry,
    });
    if (contracts.length === 0) {
      summary.missingContractCount += 1;
      replayRows.push({
        engineSetupId: row.engine_setup_id,
        sessionDate: row.session_date,
        setupType: row.setup_type,
        direction: row.direction,
        contractTicker: null,
        contractType: null,
        strike: null,
        expiry: null,
        entryTimestamp: row.triggered_at,
        exitTimestamp: null,
        entryPremium: null,
        exitPremium: null,
        returnPct: null,
        pnlOneContract: null,
        status: 'missing_contract',
        resolutionUsed: 'none',
        usedMinuteFallback: false,
      });
      continue;
    }

    const rankedContracts = rankHistoricalOptionContracts({
      setup,
      row,
      contracts,
    });
    if (rankedContracts.length === 0) {
      summary.missingContractCount += 1;
      replayRows.push({
        engineSetupId: row.engine_setup_id,
        sessionDate: row.session_date,
        setupType: row.setup_type,
        direction: row.direction,
        contractTicker: null,
        contractType: null,
        strike: null,
        expiry: null,
        entryTimestamp: row.triggered_at,
        exitTimestamp: null,
        entryPremium: null,
        exitPremium: null,
        returnPct: null,
        pnlOneContract: null,
        status: 'missing_contract',
        resolutionUsed: 'none',
        usedMinuteFallback: false,
      });
      continue;
    }

    const primaryContract = rankedContracts[0];
    let contract: HistoricalOptionContractChoice | null = null;
    let barState: {
      bars: MassiveAggregate[];
      resolutionUsed: 'second' | 'minute' | 'none';
      usedMinuteFallback: boolean;
    } | null = null;
    let entryPremium: number | null = null;
    let hasBarsForAnyCandidate = false;
    let firstContractWithBars: HistoricalOptionContractChoice | null = null;
    let firstBarStateWithBars: {
      bars: MassiveAggregate[];
      resolutionUsed: 'second' | 'minute' | 'none';
      usedMinuteFallback: boolean;
    } | null = null;

    for (const candidate of rankedContracts) {
      const barCacheKey = `${row.session_date}:${candidate.ticker}`;
      if (!barCache.has(barCacheKey)) {
        barCache.set(barCacheKey, await loadOptionBarsForReplay({
          optionTicker: candidate.ticker,
          sessionDate: row.session_date,
          requestedResolution: input.requestedResolution,
          strictBars: input.strictBars,
        }));
      }

      const candidateBarState = barCache.get(barCacheKey) || {
        bars: [],
        resolutionUsed: 'none' as const,
        usedMinuteFallback: false,
      };
      if (candidateBarState.bars.length === 0) {
        continue;
      }

      if (!hasBarsForAnyCandidate) {
        hasBarsForAnyCandidate = true;
        firstContractWithBars = candidate;
        firstBarStateWithBars = candidateBarState;
      }

      const candidateEntryPremium = findBarCloseAtOrAfter(candidateBarState.bars, row.triggered_at);
      if (!(typeof candidateEntryPremium === 'number' && Number.isFinite(candidateEntryPremium) && candidateEntryPremium > 0)) {
        continue;
      }

      contract = candidate;
      barState = candidateBarState;
      entryPremium = candidateEntryPremium;
      break;
    }

    if (!hasBarsForAnyCandidate) {
      summary.missingBarsCount += 1;
      replayRows.push({
        engineSetupId: row.engine_setup_id,
        sessionDate: row.session_date,
        setupType: row.setup_type,
        direction: row.direction,
        contractTicker: primaryContract?.ticker || null,
        contractType: primaryContract?.type || null,
        strike: primaryContract?.strike || null,
        expiry: primaryContract?.expiry || null,
        entryTimestamp: row.triggered_at,
        exitTimestamp: null,
        entryPremium: null,
        exitPremium: null,
        returnPct: null,
        pnlOneContract: null,
        status: 'missing_bars',
        resolutionUsed: 'none',
        usedMinuteFallback: false,
      });
      continue;
    }

    if (!contract || !barState || entryPremium == null) {
      summary.missingEntryPriceCount += 1;
      replayRows.push({
        engineSetupId: row.engine_setup_id,
        sessionDate: row.session_date,
        setupType: row.setup_type,
        direction: row.direction,
        contractTicker: firstContractWithBars?.ticker || primaryContract?.ticker || null,
        contractType: firstContractWithBars?.type || primaryContract?.type || null,
        strike: firstContractWithBars?.strike || primaryContract?.strike || null,
        expiry: firstContractWithBars?.expiry || primaryContract?.expiry || null,
        entryTimestamp: row.triggered_at,
        exitTimestamp: null,
        entryPremium: null,
        exitPremium: null,
        returnPct: null,
        pnlOneContract: null,
        status: 'missing_entry_price',
        resolutionUsed: firstBarStateWithBars?.resolutionUsed || 'none',
        usedMinuteFallback: firstBarStateWithBars?.usedMinuteFallback || false,
      });
      continue;
    }

    const sessionBars = input.barsBySession.get(row.session_date) || [];
    const sessionCloseIso = sessionBars.length > 0
      ? new Date(sessionBars[sessionBars.length - 1].t).toISOString()
      : row.triggered_at;
    const t1Timestamp = row.t1_hit_at;
    const t2Timestamp = row.t2_hit_at;
    const stopTimestamp = row.stop_hit_at;
    const finalOutcome = row.final_outcome;
    const fallbackExitTimestamp = stopTimestamp || t2Timestamp || t1Timestamp || sessionCloseIso;
    const exitTimestamp = finalOutcome === 't2_before_stop'
      ? (t2Timestamp || fallbackExitTimestamp)
      : finalOutcome === 'stop_before_t1'
        ? (stopTimestamp || fallbackExitTimestamp)
        : finalOutcome === 't1_before_stop'
          ? (stopTimestamp || sessionCloseIso || fallbackExitTimestamp)
          : (sessionCloseIso || fallbackExitTimestamp);

    const t1Premium = findBarCloseAtOrAfter(barState.bars, t1Timestamp);
    const t2Premium = findBarCloseAtOrAfter(barState.bars, t2Timestamp);
    const stopPremium = findBarCloseAtOrAfter(barState.bars, stopTimestamp);
    const sessionClosePremium = findBarCloseAtOrAfter(barState.bars, sessionCloseIso);
    const exitPremiumRaw = findBarCloseAtOrAfter(barState.bars, exitTimestamp);

    let returnPct: number | null = null;
    let exitPremium: number | null = null;
    const partial = input.executionModel.partialAtT1Pct;
    const runner = 1 - partial;

    if (finalOutcome === 't2_before_stop') {
      if (!(typeof t2Premium === 'number' && t2Premium > 0)) {
        summary.missingExitPriceCount += 1;
      } else {
        const t1Resolved = typeof t1Premium === 'number' && t1Premium > 0 ? t1Premium : t2Premium;
        const t1Return = (t1Resolved - entryPremium) / entryPremium;
        const t2Return = (t2Premium - entryPremium) / entryPremium;
        returnPct = (partial * t1Return) + (runner * t2Return);
        exitPremium = t2Premium;
      }
    } else if (finalOutcome === 't1_before_stop') {
      if (!(typeof t1Premium === 'number' && t1Premium > 0)) {
        summary.missingExitPriceCount += 1;
      } else {
        const runnerExit = (typeof stopPremium === 'number' && stopPremium > 0)
          ? stopPremium
          : (typeof sessionClosePremium === 'number' && sessionClosePremium > 0)
            ? sessionClosePremium
            : exitPremiumRaw;
        if (!(typeof runnerExit === 'number' && runnerExit > 0)) {
          summary.missingExitPriceCount += 1;
        } else {
          const t1Return = (t1Premium - entryPremium) / entryPremium;
          const runnerReturn = (runnerExit - entryPremium) / entryPremium;
          returnPct = (partial * t1Return) + (runner * runnerReturn);
          exitPremium = runnerExit;
        }
      }
    } else if (finalOutcome === 'stop_before_t1') {
      if (!(typeof stopPremium === 'number' && stopPremium > 0)) {
        summary.missingExitPriceCount += 1;
      } else {
        returnPct = (stopPremium - entryPremium) / entryPremium;
        exitPremium = stopPremium;
      }
    } else {
      const fallbackExit = (typeof sessionClosePremium === 'number' && sessionClosePremium > 0)
        ? sessionClosePremium
        : exitPremiumRaw;
      if (!(typeof fallbackExit === 'number' && fallbackExit > 0)) {
        summary.missingExitPriceCount += 1;
      } else {
        returnPct = (fallbackExit - entryPremium) / entryPremium;
        exitPremium = fallbackExit;
      }
    }

    if (returnPct == null || exitPremium == null) {
      replayRows.push({
        engineSetupId: row.engine_setup_id,
        sessionDate: row.session_date,
        setupType: row.setup_type,
        direction: row.direction,
        contractTicker: contract.ticker,
        contractType: contract.type,
        strike: contract.strike,
        expiry: contract.expiry,
        entryTimestamp: row.triggered_at,
        exitTimestamp,
        entryPremium: round(entryPremium, 4),
        exitPremium: null,
        returnPct: null,
        pnlOneContract: null,
        status: 'missing_exit_price',
        resolutionUsed: barState.resolutionUsed,
        usedMinuteFallback: barState.usedMinuteFallback,
      });
      continue;
    }

    const pnlOneContract = oneContractPnl(entryPremium, exitPremium);
    replayRows.push({
      engineSetupId: row.engine_setup_id,
      sessionDate: row.session_date,
      setupType: row.setup_type,
      direction: row.direction,
      contractTicker: contract.ticker,
      contractType: contract.type,
      strike: contract.strike,
      expiry: contract.expiry,
      entryTimestamp: row.triggered_at,
      exitTimestamp,
      entryPremium: round(entryPremium, 4),
      exitPremium: round(exitPremium, 4),
      returnPct: round(returnPct * 100, 4),
      pnlOneContract: round(pnlOneContract, 2),
      status: 'ok',
      resolutionUsed: barState.resolutionUsed,
      usedMinuteFallback: barState.usedMinuteFallback,
    });
  }

  const okRows = replayRows.filter((row) => row.status === 'ok');
  const returnPcts = okRows
    .map((row) => row.returnPct)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const pnlValues = okRows
    .map((row) => row.pnlOneContract)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const positiveTrades = returnPcts.filter((value) => value > 0).length;
  const resolutionSet = new Set(okRows.map((row) => row.resolutionUsed).filter((value) => value !== 'none'));

  const bySetupTypeMap = new Map<string, { tradeCount: number; wins: number; cumulativeReturnPct: number; cumulativePnl: number }>();
  for (const row of okRows) {
    const key = row.setupType || 'unknown';
    const bucket = bySetupTypeMap.get(key) || { tradeCount: 0, wins: 0, cumulativeReturnPct: 0, cumulativePnl: 0 };
    bucket.tradeCount += 1;
    const returnPct = row.returnPct || 0;
    bucket.cumulativeReturnPct += returnPct;
    bucket.cumulativePnl += row.pnlOneContract || 0;
    if (returnPct > 0) bucket.wins += 1;
    bySetupTypeMap.set(key, bucket);
  }

  summary.replayedTrades = okRows.length;
  summary.skippedTrades = triggeredRows.length - okRows.length;
  summary.coveragePct = triggeredRows.length > 0
    ? round((summary.replayedTrades / triggeredRows.length) * 100, 2)
    : 0;
  summary.coverageValid = summary.coveragePct >= summary.minimumCoveragePct;
  summary.positiveTrades = positiveTrades;
  summary.nonPositiveTrades = Math.max(okRows.length - positiveTrades, 0);
  summary.winRatePct = okRows.length > 0 ? round((positiveTrades / okRows.length) * 100, 2) : 0;
  summary.averageReturnPct = returnPcts.length > 0
    ? round(returnPcts.reduce((sum, value) => sum + value, 0) / returnPcts.length, 4)
    : 0;
  summary.medianReturnPct = round(median(returnPcts), 4);
  summary.cumulativeReturnPct = round(returnPcts.reduce((sum, value) => sum + value, 0), 4);
  summary.cumulativePnlOneContract = round(pnlValues.reduce((sum, value) => sum + value, 0), 2);
  summary.usedMinuteFallback = replayRows.some((row) => row.usedMinuteFallback);
  summary.resolutionUsed = resolutionSet.size === 0
    ? 'none'
    : resolutionSet.size === 1
      ? (Array.from(resolutionSet)[0] as 'second' | 'minute')
      : 'mixed';
  summary.bySetupType = Array.from(bySetupTypeMap.entries())
    .map(([key, bucket]) => ({
      key,
      tradeCount: bucket.tradeCount,
      winRatePct: bucket.tradeCount > 0 ? round((bucket.wins / bucket.tradeCount) * 100, 2) : 0,
      averageReturnPct: bucket.tradeCount > 0 ? round(bucket.cumulativeReturnPct / bucket.tradeCount, 4) : 0,
      cumulativePnlOneContract: round(bucket.cumulativePnl, 2),
    }))
    .sort((a, b) => b.tradeCount - a.tradeCount || a.key.localeCompare(b.key));
  summary.trades = input.includeTrades ? replayRows : undefined;

  return summary;
}

export async function runSPXWinRateBacktest(input: {
  from: string;
  to: string;
  source?: SPXWinRateBacktestSource;
  resolution?: SPXBacktestPriceResolution;
  executionBasis?: SPXBacktestExecutionBasis;
  includeRows?: boolean;
  includeBlockedSetups?: boolean;
  includeHiddenTiers?: boolean;
  includePausedSetups?: boolean;
  geometryBySetupType?: Record<string, SPXBacktestGeometryAdjustment>;
  executionModel?: Partial<SPXBacktestExecutionModel>;
  optionsReplay?: SPXBacktestOptionsReplayConfig;
}): Promise<SPXWinRateBacktestResult> {
  const from = normalizeDateInput(input.from);
  const to = normalizeDateInput(input.to);
  const source = input.source || 'spx_setup_instances';
  const resolution = input.resolution || 'second';
  const executionBasis = input.executionBasis || 'underlying';
  const optionsReplayStrictBars = input.optionsReplay?.strictBars ?? DEFAULT_OPTIONS_REPLAY_STRICT_BARS;
  const includeRows = input.includeRows === true;
  const executionModel = resolveExecutionModel(input.executionModel);
  const notes: string[] = [];

  let selectedSource: InternalBacktestSource | 'none' = 'none';
  let setups: BacktestSetupCandidate[] = [];
  let skippedSetupCount = 0;
  let geometryAdjustedCount = 0;

  if (source === 'auto' || source === 'spx_setup_instances') {
    const instanceLoad = await loadSetupsFromInstances({
      from,
      to,
      includeBlockedSetups: input.includeBlockedSetups,
      includeHiddenTiers: input.includeHiddenTiers,
      includePausedSetups: input.includePausedSetups,
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
      executionBasis,
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
      ...(executionBasis === 'options_contract'
        ? {
          optionsReplay: buildEmptyOptionsReplaySummary({
            requestedResolution: resolution,
            strictBars: optionsReplayStrictBars,
            includeTrades: includeRows,
          }),
        }
        : {}),
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
  const setupByKey = new Map<string, BacktestSetupCandidate>(
    setups.map((setup) => [toBacktestSetupKey(setup), setup]),
  );
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

  let optionsReplay: SPXContractReplaySummary | undefined;
  if (executionBasis === 'options_contract') {
    optionsReplay = await buildOptionsContractReplaySummary({
      evaluated,
      setupByKey,
      barsBySession,
      requestedResolution: resolution,
      strictBars: optionsReplayStrictBars,
      executionModel,
      includeTrades: includeRows,
    });
    const replayUniverse = optionsReplay.replayedTrades + optionsReplay.skippedTrades;
    notes.push(
      `Options contract replay: ${optionsReplay.replayedTrades}/${replayUniverse} trades resolved from Massive option bars (win rate ${optionsReplay.winRatePct}%).`,
    );
    notes.push('Options contract selection uses historical contract reference data + trigger-time tradability checks from Massive bars (no snapshot chain dependency).');
    notes.push(
      `Options replay coverage: ${optionsReplay.coveragePct}% (minimum ${optionsReplay.minimumCoveragePct}% => ${optionsReplay.coverageValid ? 'valid' : 'invalid'}).`,
    );
    if (!optionsReplay.coverageValid) {
      notes.push('Options replay coverage is below institutional threshold; do not use this run for optimization decisions.');
    }
    if (optionsReplay.missingBarsCount > 0) {
      notes.push(`Options replay missing bars for ${optionsReplay.missingBarsCount} trades.`);
    }
    if (optionsReplay.missingEntryPriceCount > 0 || optionsReplay.missingExitPriceCount > 0) {
      notes.push(
        `Options replay missing pricing points: entry=${optionsReplay.missingEntryPriceCount}, exit=${optionsReplay.missingExitPriceCount}.`,
      );
    }
  }

  return {
    dateRange: { from, to },
    sourceUsed: selectedSource,
    executionBasis,
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
    ...(optionsReplay ? { optionsReplay } : {}),
    notes,
    analytics,
    ...(includeRows ? { rows } : {}),
  };
}

export const __testables = {
  evaluateSetupAgainstBars,
  findEntryTriggerPrice,
  buildBarPath,
  chooseHistoricalOptionContract,
  findBarCloseAtOrAfter,
};
