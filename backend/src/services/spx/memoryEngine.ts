import { supabase } from '../../config/database';
import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import type { Setup } from './types';
import { round } from './utils';

const MEMORY_CACHE_TTL_SECONDS = 90;
const MEMORY_LOOKBACK_SESSIONS = 5;
const MEMORY_MAX_QUERY_ROWS = 900;
const MEMORY_LEVEL_TOLERANCE_POINTS = 2.5;

interface SetupMemoryRow {
  session_date: string;
  entry_zone_low: number | string | null;
  entry_zone_high: number | string | null;
  final_outcome: string | null;
  triggered_at: string | null;
}

export interface SPXMemoryContext {
  tests: number;
  resolved: number;
  wins: number;
  losses: number;
  winRatePct: number | null;
  confidence: number;
  score: number;
  lookbackSessions: number;
  tolerancePoints: number;
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

function neutralMemoryContext(): SPXMemoryContext {
  return {
    tests: 0,
    resolved: 0,
    wins: 0,
    losses: 0,
    winRatePct: null,
    confidence: 0,
    score: 50,
    lookbackSessions: MEMORY_LOOKBACK_SESSIONS,
    tolerancePoints: MEMORY_LEVEL_TOLERANCE_POINTS,
  };
}

function toCacheKey(input: {
  sessionDate: string;
  setupType: string;
  direction: Setup['direction'];
  entryMid: number;
  lookbackSessions: number;
  tolerancePoints: number;
}): string {
  const roundedEntry = round(input.entryMid, 1);
  return [
    'spx_command_center:memory:v1',
    input.sessionDate,
    input.setupType,
    input.direction,
    roundedEntry,
    input.lookbackSessions,
    input.tolerancePoints,
  ].join(':');
}

function scoreFromWinRate(input: {
  winRatePct: number | null;
  resolved: number;
}): { score: number; confidence: number } {
  if (input.winRatePct == null || input.resolved <= 0) {
    return { score: 50, confidence: 0 };
  }

  const confidence = clamp(input.resolved / 8, 0, 1);
  const centered = input.winRatePct - 50;
  return {
    score: round(clamp(50 + (centered * confidence), 20, 85), 2),
    confidence: round(confidence, 2),
  };
}

function parseEntryMid(row: SetupMemoryRow): number | null {
  const low = toFiniteNumber(row.entry_zone_low);
  const high = toFiniteNumber(row.entry_zone_high);
  if (low == null || high == null) return null;
  return (low + high) / 2;
}

function isWinningOutcome(outcome: string | null): boolean {
  return outcome === 't1_before_stop' || outcome === 't2_before_stop';
}

export async function getLevelMemoryContext(input: {
  sessionDate: string;
  setupType: string;
  direction: Setup['direction'];
  entryMid: number;
  lookbackSessions?: number;
  tolerancePoints?: number;
  forceRefresh?: boolean;
}): Promise<SPXMemoryContext> {
  const lookbackSessions = Number.isFinite(input.lookbackSessions)
    ? Math.max(1, Math.floor(input.lookbackSessions as number))
    : MEMORY_LOOKBACK_SESSIONS;
  const tolerancePoints = Number.isFinite(input.tolerancePoints)
    ? Math.max(0.5, input.tolerancePoints as number)
    : MEMORY_LEVEL_TOLERANCE_POINTS;
  const cacheKey = toCacheKey({
    sessionDate: input.sessionDate,
    setupType: input.setupType,
    direction: input.direction,
    entryMid: input.entryMid,
    lookbackSessions,
    tolerancePoints,
  });

  if (!input.forceRefresh) {
    const cached = await cacheGet<SPXMemoryContext>(cacheKey);
    if (cached) return cached;
  }

  try {
    const { data, error } = await supabase
      .from('spx_setup_instances')
      .select('session_date,entry_zone_low,entry_zone_high,final_outcome,triggered_at')
      .eq('setup_type', input.setupType)
      .eq('direction', input.direction)
      .lt('session_date', input.sessionDate)
      .order('session_date', { ascending: false })
      .limit(MEMORY_MAX_QUERY_ROWS);

    if (error) {
      logger.warn('SPX memory engine query failed', {
        setupType: input.setupType,
        direction: input.direction,
        sessionDate: input.sessionDate,
        error: error.message,
      });
      return neutralMemoryContext();
    }

    const rows = (data || []) as SetupMemoryRow[];
    if (rows.length === 0) {
      const neutral = neutralMemoryContext();
      await cacheSet(cacheKey, neutral, MEMORY_CACHE_TTL_SECONDS);
      return neutral;
    }

    const includedSessions = new Set<string>();
    const scopedRows: SetupMemoryRow[] = [];
    for (const row of rows) {
      const sessionDate = typeof row.session_date === 'string' ? row.session_date : '';
      if (!sessionDate) continue;
      if (!includedSessions.has(sessionDate) && includedSessions.size >= lookbackSessions) {
        continue;
      }
      includedSessions.add(sessionDate);
      scopedRows.push(row);
    }

    const matchingRows = scopedRows.filter((row) => {
      const entryMid = parseEntryMid(row);
      if (entryMid == null) return false;
      return Math.abs(entryMid - input.entryMid) <= tolerancePoints;
    });

    const tests = matchingRows.length;
    const resolvedRows = matchingRows.filter((row) => typeof row.final_outcome === 'string' && row.final_outcome.length > 0);
    const wins = resolvedRows.filter((row) => isWinningOutcome(row.final_outcome)).length;
    const losses = resolvedRows.filter((row) => row.final_outcome === 'stop_before_t1').length;
    const resolved = resolvedRows.length;
    const winRatePct = resolved > 0 ? round((wins / resolved) * 100, 2) : null;
    const scored = scoreFromWinRate({
      winRatePct,
      resolved,
    });

    const memory = {
      tests,
      resolved,
      wins,
      losses,
      winRatePct,
      confidence: scored.confidence,
      score: scored.score,
      lookbackSessions,
      tolerancePoints,
    } satisfies SPXMemoryContext;

    await cacheSet(cacheKey, memory, MEMORY_CACHE_TTL_SECONDS);
    return memory;
  } catch (error) {
    logger.warn('SPX memory engine fallback to neutral context', {
      setupType: input.setupType,
      direction: input.direction,
      sessionDate: input.sessionDate,
      error: error instanceof Error ? error.message : String(error),
    });
    return neutralMemoryContext();
  }
}
