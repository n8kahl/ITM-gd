import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { sanitizeSymbols } from '../../lib/symbols';
import type {
  SwingSniperRiskMode,
  SwingSniperSavedThesisRecord,
  SwingSniperSignalSnapshotInput,
  SwingSniperSignalSnapshotRecord,
  SwingSniperStructureStrategy,
  SwingSniperWatchlistFilters,
  SwingSniperWatchlistState,
  SwingSniperWatchlistUpdateInput,
} from './types';

const DEFAULT_DEFINED_RISK_SETUPS: SwingSniperStructureStrategy[] = [
  'call_debit_spread',
  'put_debit_spread',
  'call_calendar',
  'put_calendar',
  'call_diagonal',
  'put_diagonal',
  'call_butterfly',
  'put_butterfly',
];

const ADVANCED_NAKED_SETUPS = new Set<SwingSniperStructureStrategy>([
  'long_call',
  'long_put',
  'long_straddle',
  'long_strangle',
]);

const ALL_STRUCTURE_SETUPS = new Set<SwingSniperStructureStrategy>([
  ...DEFAULT_DEFINED_RISK_SETUPS,
  ...Array.from(ADVANCED_NAKED_SETUPS),
]);

const DEFAULT_FILTERS: SwingSniperWatchlistFilters = {
  preset: 'all',
  minScore: 0,
  riskMode: 'defined_risk_only',
  swingWindow: 'seven_to_fourteen',
  preferredSetups: [...DEFAULT_DEFINED_RISK_SETUPS],
};

const SNAPSHOT_RETENTION_DAYS = 90;
const SNAPSHOT_PRUNE_INTERVAL_MS = 2 * 60 * 60 * 1000;
const snapshotPruneLastRunByUser = new Map<string, number>();

interface SaveSignalSnapshotsOptions {
  ignoreDuplicates?: boolean;
  prune?: boolean;
}

interface SwingSniperWatchlistRow {
  user_id: string;
  symbols: string[] | null;
  selected_symbol: string | null;
  filters: Partial<SwingSniperWatchlistFilters> | null;
}

interface SwingSniperSavedThesisRow {
  symbol: string;
  saved_at: string;
  score: number | null;
  setup_label: string;
  direction: SwingSniperSavedThesisRecord['direction'];
  thesis: string;
  iv_rank_at_save: number | null;
  catalyst_label: string | null;
  catalyst_date: string | null;
  monitor_note: string | null;
}

interface SwingSniperSignalSnapshotRow {
  symbol: string;
  as_of: string;
  as_of_date: string;
  captured_from: 'universe' | 'dossier' | 'manual';
  score: number | null;
  direction: SwingSniperSavedThesisRecord['direction'];
  setup_label: string | null;
  thesis: string | null;
  current_price: number | string | null;
  current_iv: number | string | null;
  realized_vol20: number | string | null;
  iv_rank: number | string | null;
  iv_percentile: number | string | null;
  iv_vs_rv_gap: number | string | null;
  catalyst_date: string | null;
  catalyst_days_until: number | null;
  snapshot: Record<string, unknown> | null;
  created_at: string;
}

function normalizeFilters(value: Partial<SwingSniperWatchlistFilters> | null | undefined): SwingSniperWatchlistFilters {
  const riskMode: SwingSniperRiskMode = value?.riskMode === 'naked_allowed'
    ? 'naked_allowed'
    : DEFAULT_FILTERS.riskMode;

  const preferredSetups = Array.isArray(value?.preferredSetups)
    ? value?.preferredSetups.filter((strategy): strategy is SwingSniperStructureStrategy => ALL_STRUCTURE_SETUPS.has(strategy))
    : [];

  const dedupedSetups = Array.from(new Set(preferredSetups));
  const riskScopedSetups = riskMode === 'defined_risk_only'
    ? dedupedSetups.filter((strategy) => !ADVANCED_NAKED_SETUPS.has(strategy))
    : dedupedSetups;

  const normalizedSetups = riskScopedSetups.length > 0
    ? riskScopedSetups
    : [...DEFAULT_DEFINED_RISK_SETUPS];

  return {
    preset: value?.preset ?? DEFAULT_FILTERS.preset,
    minScore: Number.isFinite(value?.minScore) ? Math.max(0, Math.round(value?.minScore as number)) : DEFAULT_FILTERS.minScore,
    riskMode,
    swingWindow: value?.swingWindow ?? DEFAULT_FILTERS.swingWindow,
    preferredSetups: normalizedSetups,
  };
}

function toSavedThesisRecord(row: SwingSniperSavedThesisRow): SwingSniperSavedThesisRecord {
  return {
    symbol: row.symbol,
    savedAt: row.saved_at,
    score: row.score,
    setupLabel: row.setup_label,
    direction: row.direction,
    thesis: row.thesis,
    ivRankAtSave: row.iv_rank_at_save,
    catalystLabel: row.catalyst_label,
    catalystDate: row.catalyst_date,
    monitorNote: row.monitor_note || 'Waiting for refreshed volatility context.',
  };
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toDateOnly(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function shouldPruneSnapshotsForUser(userId: string): boolean {
  const now = Date.now();
  const previousRun = snapshotPruneLastRunByUser.get(userId) || 0;
  if (now - previousRun < SNAPSHOT_PRUNE_INTERVAL_MS) return false;
  snapshotPruneLastRunByUser.set(userId, now);
  return true;
}

function toSignalSnapshotRecord(row: SwingSniperSignalSnapshotRow): SwingSniperSignalSnapshotRecord {
  return {
    symbol: row.symbol,
    asOf: row.as_of,
    asOfDate: row.as_of_date,
    capturedFrom: row.captured_from,
    score: row.score,
    direction: row.direction,
    setupLabel: row.setup_label,
    thesis: row.thesis,
    currentPrice: toNullableNumber(row.current_price),
    currentIV: toNullableNumber(row.current_iv),
    realizedVol20: toNullableNumber(row.realized_vol20),
    ivRank: toNullableNumber(row.iv_rank),
    ivPercentile: toNullableNumber(row.iv_percentile),
    ivVsRvGap: toNullableNumber(row.iv_vs_rv_gap),
    catalystDate: row.catalyst_date,
    catalystDaysUntil: row.catalyst_days_until,
    snapshot: row.snapshot || {},
    createdAt: row.created_at,
  };
}

function emptyWatchlistState(): SwingSniperWatchlistState {
  return {
    symbols: [],
    selectedSymbol: null,
    filters: {
      ...DEFAULT_FILTERS,
      preferredSetups: [...DEFAULT_FILTERS.preferredSetups],
    },
    savedTheses: [],
  };
}

export async function getSwingSniperWatchlistState(userId: string): Promise<SwingSniperWatchlistState> {
  const [{ data: watchlistRow, error: watchlistError }, { data: thesisRows, error: thesisError }] = await Promise.all([
    supabase
      .from('swing_sniper_watchlists')
      .select('user_id, symbols, selected_symbol, filters')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('swing_sniper_saved_theses')
      .select('symbol, saved_at, score, setup_label, direction, thesis, iv_rank_at_save, catalyst_label, catalyst_date, monitor_note')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false })
      .limit(25),
  ]);

  if (watchlistError) {
    logger.warn('Swing Sniper watchlist query degraded; defaulting to in-memory empty state', {
      userId,
      error: watchlistError.message,
    });
    return emptyWatchlistState();
  }

  if (thesisError) {
    logger.warn('Swing Sniper saved-thesis query degraded; defaulting to in-memory empty state', {
      userId,
      error: thesisError.message,
    });
    return emptyWatchlistState();
  }

  const row = watchlistRow as SwingSniperWatchlistRow | null;
  const savedTheses = ((thesisRows || []) as SwingSniperSavedThesisRow[]).map(toSavedThesisRecord);

  return {
    symbols: sanitizeSymbols(row?.symbols || [], 50),
    selectedSymbol: row?.selected_symbol || savedTheses[0]?.symbol || null,
    filters: normalizeFilters(row?.filters),
    savedTheses,
  };
}

export async function saveSwingSniperWatchlistState(
  userId: string,
  input: SwingSniperWatchlistUpdateInput,
): Promise<SwingSniperWatchlistState> {
  const existing = await getSwingSniperWatchlistState(userId);
  const removedThesisSymbol = sanitizeSymbols(
    input.removeThesisSymbol ? [input.removeThesisSymbol] : [],
    1,
  )[0] || null;

  const mergedSymbols = sanitizeSymbols([
    ...(input.symbols || existing.symbols),
    ...(input.thesis ? [input.thesis.symbol] : []),
  ], 50);

  const nextFilters = normalizeFilters({
    ...existing.filters,
    ...input.filters,
  });

  const selectedSymbol = input.selectedSymbol === undefined
    ? existing.selectedSymbol
    : input.selectedSymbol;

  const { error: watchlistError } = await supabase
    .from('swing_sniper_watchlists')
    .upsert({
      user_id: userId,
      symbols: mergedSymbols,
      selected_symbol: selectedSymbol,
      filters: nextFilters,
    }, {
      onConflict: 'user_id',
    });

  if (watchlistError) {
    throw new Error(`Failed to save Swing Sniper watchlist: ${watchlistError.message}`);
  }

  if (removedThesisSymbol) {
    const { error: removeThesisError } = await supabase
      .from('swing_sniper_saved_theses')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', removedThesisSymbol);

    if (removeThesisError) {
      throw new Error(`Failed to remove Swing Sniper thesis: ${removeThesisError.message}`);
    }
  }

  if (input.thesis) {
    const { error: thesisError } = await supabase
      .from('swing_sniper_saved_theses')
      .upsert({
        user_id: userId,
        symbol: input.thesis.symbol,
        score: input.thesis.score,
        setup_label: input.thesis.setupLabel,
        direction: input.thesis.direction,
        thesis: input.thesis.thesis,
        iv_rank_at_save: input.thesis.ivRankAtSave,
        catalyst_label: input.thesis.catalystLabel || null,
        catalyst_date: input.thesis.catalystDate || null,
        monitor_note: input.thesis.monitorNote || null,
      }, {
        onConflict: 'user_id,symbol',
      });

    if (thesisError) {
      throw new Error(`Failed to save Swing Sniper thesis: ${thesisError.message}`);
    }
  }

  return getSwingSniperWatchlistState(userId);
}

export async function saveSwingSniperSignalSnapshots(
  userId: string,
  snapshots: SwingSniperSignalSnapshotInput[],
  options?: SaveSignalSnapshotsOptions,
): Promise<void> {
  if (snapshots.length === 0) return;

  const deduped = new Map<string, SwingSniperSignalSnapshotInput>();

  for (const snapshot of snapshots) {
    const normalizedSymbol = sanitizeSymbols([snapshot.symbol], 1)[0];
    if (!normalizedSymbol) continue;
    const asOfDate = toDateOnly(snapshot.asOf);
    deduped.set(`${normalizedSymbol}:${asOfDate}`, {
      ...snapshot,
      symbol: normalizedSymbol,
    });
  }

  const rows = Array.from(deduped.values()).map((snapshot) => ({
    user_id: userId,
    symbol: snapshot.symbol,
    as_of: snapshot.asOf,
    as_of_date: toDateOnly(snapshot.asOf),
    captured_from: snapshot.capturedFrom,
    score: snapshot.score,
    direction: snapshot.direction,
    setup_label: snapshot.setupLabel || null,
    thesis: snapshot.thesis || null,
    current_price: snapshot.currentPrice ?? null,
    current_iv: snapshot.currentIV ?? null,
    realized_vol20: snapshot.realizedVol20 ?? null,
    iv_rank: snapshot.ivRank ?? null,
    iv_percentile: snapshot.ivPercentile ?? null,
    iv_vs_rv_gap: snapshot.ivVsRvGap ?? null,
    catalyst_date: snapshot.catalystDate || null,
    catalyst_days_until: snapshot.catalystDaysUntil ?? null,
    snapshot: snapshot.snapshot || {},
  }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('swing_sniper_signal_snapshots')
    .upsert(rows, {
      onConflict: 'user_id,symbol,as_of_date',
      ignoreDuplicates: options?.ignoreDuplicates ?? false,
    });

  if (error) {
    throw new Error(`Failed to persist Swing Sniper signal snapshots: ${error.message}`);
  }

  if (options?.prune && shouldPruneSnapshotsForUser(userId)) {
    const cutoffDate = new Date(Date.now() - (SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000))
      .toISOString()
      .slice(0, 10);
    await supabase
      .from('swing_sniper_signal_snapshots')
      .delete()
      .eq('user_id', userId)
      .lt('as_of_date', cutoffDate);
  }
}

export async function listSwingSniperSignalSnapshots(
  userId: string,
  symbol: string,
  limit: number = 120,
): Promise<SwingSniperSignalSnapshotRecord[]> {
  const normalizedSymbol = sanitizeSymbols([symbol], 1)[0];
  if (!normalizedSymbol) return [];

  const cappedLimit = Math.max(1, Math.min(250, Math.floor(limit)));
  const { data, error } = await supabase
    .from('swing_sniper_signal_snapshots')
    .select('symbol, as_of, as_of_date, captured_from, score, direction, setup_label, thesis, current_price, current_iv, realized_vol20, iv_rank, iv_percentile, iv_vs_rv_gap, catalyst_date, catalyst_days_until, snapshot, created_at')
    .eq('user_id', userId)
    .eq('symbol', normalizedSymbol)
    .order('as_of', { ascending: false })
    .limit(cappedLimit);

  if (error) {
    throw new Error(`Failed to load Swing Sniper signal snapshots: ${error.message}`);
  }

  return ((data || []) as SwingSniperSignalSnapshotRow[]).map(toSignalSnapshotRecord);
}

export async function listSwingSniperRecentUniverseSnapshots(
  userId: string,
  lookbackDays: number = 14,
  limit: number = 320,
): Promise<SwingSniperSignalSnapshotRecord[]> {
  const safeLookback = Math.max(3, Math.min(30, Math.floor(lookbackDays)));
  const safeLimit = Math.max(20, Math.min(500, Math.floor(limit)));
  const cutoffDate = new Date(Date.now() - (safeLookback * 24 * 60 * 60 * 1000))
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from('swing_sniper_signal_snapshots')
    .select('symbol, as_of, as_of_date, captured_from, score, direction, setup_label, thesis, current_price, current_iv, realized_vol20, iv_rank, iv_percentile, iv_vs_rv_gap, catalyst_date, catalyst_days_until, snapshot, created_at')
    .eq('user_id', userId)
    .eq('captured_from', 'universe')
    .gte('as_of_date', cutoffDate)
    .order('as_of', { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Failed to load recent Swing Sniper universe snapshots: ${error.message}`);
  }

  return ((data || []) as SwingSniperSignalSnapshotRow[]).map(toSignalSnapshotRecord);
}
