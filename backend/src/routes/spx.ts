import { Router, Request, Response } from 'express';
import { supabase } from '../config/database';
import { getDailyAggregates, getMinuteAggregates, type MassiveAggregate } from '../config/massive';
import { logger } from '../lib/logger';
import { hasBackendAdminAccess } from '../lib/adminAccess';
import { formatMassiveTicker } from '../lib/symbols';
import { authenticateToken } from '../middleware/auth';
import { requireTier } from '../middleware/requireTier';
import { getPredictionState } from '../services/spx/aiPredictor';
import { generateCoachStream, getCoachState } from '../services/spx/aiCoach';
import { generateCoachDecision } from '../services/spx/coachDecisionEngine';
import { getContractRecommendation } from '../services/spx/contractSelector';
import { getBasisState } from '../services/spx/crossReference';
import { getFibLevels } from '../services/spx/fibEngine';
import { getFlowEvents } from '../services/spx/flowEngine';
import { computeUnifiedGEXLandscape } from '../services/spx/gexEngine';
import { getSPXSnapshot } from '../services/spx';
import { getMergedLevels } from '../services/spx/levelEngine';
import { getSPXWinRateAnalytics } from '../services/spx/outcomeTracker';
import {
  getSymbolProfileBySymbol,
  listSymbolProfiles,
  summarizeSymbolProfile,
} from '../services/spx/symbolProfile';
import { buildTradeStreamSnapshot, type TradeStreamFeedTrustMetadata } from '../services/spx/tradeStream';
import {
  getSPXOptimizerScorecard,
  getActiveSPXOptimizationProfile,
  runSPXOptimizerScan,
  revertSPXOptimizationProfile,
} from '../services/spx/optimizer';
import { getSPXOptimizerWorkerStatus } from '../workers/spxOptimizerWorker';
import {
  runSPXWinRateBacktest,
  type SPXBacktestPriceResolution,
  type SPXWinRateBacktestSource,
} from '../services/spx/winRateBacktest';
import { classifyCurrentRegime } from '../services/spx/regimeClassifier';
import { detectActiveSetups, getLatestSetupEnvironmentState, getSetupById } from '../services/spx/setupDetector';
import type { CoachDecisionRequest, Setup } from '../services/spx/types';
import { toEasternTime } from '../services/marketHours';
import { TradierClient } from '../services/broker/tradier/client';
import {
  decryptTradierAccessToken,
  isTradierProductionRuntimeEnabled,
} from '../services/broker/tradier/credentials';
import { getTradierExecutionRuntimeStatus } from '../services/broker/tradier/executionEngine';
import {
  inferTradierUnderlyingFromOptionSymbol,
  isTradierSPXOptionSymbol,
} from '../services/broker/tradier/killSwitchHelpers';
import {
  loadOpenStatesWithOrders,
  closeAllUserStates,
} from '../services/spx/executionStateStore';
import {
  normalizeEngineDirection,
  scoreReplayDrill,
  type DrillDirection,
  type EngineDirection,
} from '../services/spx/drillScoring';
import { buildReplayJournalEntries } from '../services/journal/replayJournalBuilder';

const router = Router();
const KNOWN_MISSING_RELATIONS = new Set<string>();
const TRADE_STREAM_STALE_THRESHOLD_MS = 30_000;
const REPLAY_SESSIONS_DEFAULT_WINDOW_DAYS = 30;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DRILL_PRICE_MIN = 0;
const DRILL_PRICE_MAX = 100_000;
const DRILL_PNL_ABS_MAX = 1_000;
const DRILL_DIRECTIONS = new Set<DrillDirection>(['long', 'short', 'flat']);
const ENGINE_DIRECTIONS = new Set<EngineDirection>(['bullish', 'bearish', 'neutral']);

type ReplaySessionQueryRow = {
  id?: unknown;
  session_date?: unknown;
  channel_id?: unknown;
  channel_name?: unknown;
  caller_name?: unknown;
  trade_count?: unknown;
  net_pnl_pct?: unknown;
  session_start?: unknown;
  session_end?: unknown;
  session_summary?: unknown;
};

type ReplayTradeQueryRow = {
  id?: unknown;
  trade_index?: unknown;
  symbol?: unknown;
  strike?: unknown;
  contract_type?: unknown;
  expiry?: unknown;
  direction?: unknown;
  entry_price?: unknown;
  entry_timestamp?: unknown;
  sizing?: unknown;
  initial_stop?: unknown;
  target_1?: unknown;
  target_2?: unknown;
  thesis_text?: unknown;
  entry_condition?: unknown;
  lifecycle_events?: unknown;
  final_pnl_pct?: unknown;
  is_winner?: unknown;
  fully_exited?: unknown;
  exit_timestamp?: unknown;
  entry_snapshot_id?: unknown;
};

type ReplayMessageQueryRow = {
  id?: unknown;
  discord_msg_id?: unknown;
  author_name?: unknown;
  author_id?: unknown;
  content?: unknown;
  sent_at?: unknown;
  is_signal?: unknown;
  signal_type?: unknown;
  parsed_trade_id?: unknown;
  created_at?: unknown;
};

type ReplayDrillResultQueryRow = {
  id?: unknown;
  user_id?: unknown;
  session_id?: unknown;
  parsed_trade_id?: unknown;
  decision_at?: unknown;
  direction?: unknown;
  strike?: unknown;
  stop_level?: unknown;
  target_level?: unknown;
  learner_rr?: unknown;
  learner_pnl_pct?: unknown;
  actual_pnl_pct?: unknown;
  engine_direction?: unknown;
  direction_match?: unknown;
  score?: unknown;
  feedback_summary?: unknown;
  created_at?: unknown;
};

type ReplayChartBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ReplayPriorDayBar = {
  high: number;
  low: number;
};

const REPLAY_TRADE_SELECT_FIELDS = [
  'id',
  'trade_index',
  'symbol',
  'strike',
  'contract_type',
  'expiry',
  'direction',
  'entry_price',
  'entry_timestamp',
  'sizing',
  'initial_stop',
  'target_1',
  'target_2',
  'thesis_text',
  'entry_condition',
  'lifecycle_events',
  'final_pnl_pct',
  'is_winner',
  'fully_exited',
  'exit_timestamp',
  'entry_snapshot_id',
].join(',');

const REPLAY_MESSAGE_SELECT_FIELDS = [
  'id',
  'discord_msg_id',
  'author_name',
  'author_id',
  'content',
  'sent_at',
  'is_signal',
  'signal_type',
  'parsed_trade_id',
  'created_at',
].join(',');

function parseBoolean(value: unknown): boolean {
  return String(value || '').toLowerCase() === 'true';
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseISODateInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!ISO_DATE_REGEX.test(trimmed)) return null;
  const parsed = Date.parse(`${trimmed}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return trimmed;
}

function parseCalendarISODateInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!ISO_DATE_REGEX.test(trimmed)) return null;
  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  const isValid = date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
  return isValid ? trimmed : null;
}

function dateDaysAgoET(days: number): string {
  return toEasternTime(new Date(Date.now() - (days * 86400000))).dateStr;
}

function parsePositiveInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseReplayChannelIdsFilter(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  const normalized = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (normalized.length === 0) return [];

  return Array.from(new Set(normalized));
}

function parseEpochMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIsoTimestampInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function parseDrillDirectionInput(value: unknown): DrillDirection | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!DRILL_DIRECTIONS.has(normalized as DrillDirection)) return null;
  return normalized as DrillDirection;
}

function parseEngineDirectionInput(value: unknown): EngineDirection | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!ENGINE_DIRECTIONS.has(normalized as EngineDirection)) return null;
  return normalized as EngineDirection;
}

function parseBoundedNumberInput(value: unknown, min: number, max: number): number | null {
  const parsed = parseFiniteNumber(value);
  if (parsed == null) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function normalizeBodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function bodyHasOwnKey(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function getPriorTradingDay(dateStr: string): string | null {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number.parseInt(yearStr || '', 10);
  const month = Number.parseInt(monthStr || '', 10);
  const day = Number.parseInt(dayStr || '', 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() - 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mapMassiveAggregatesToReplayBars(aggregates: MassiveAggregate[]): ReplayChartBar[] {
  return (aggregates || [])
    .map((bar) => {
      const timeSeconds = Math.floor((parseFiniteNumber(bar.t) ?? 0) / 1000);
      const open = parseFiniteNumber(bar.o);
      const high = parseFiniteNumber(bar.h);
      const low = parseFiniteNumber(bar.l);
      const close = parseFiniteNumber(bar.c);
      const volume = parseFiniteNumber(bar.v) ?? 0;

      if (
        !Number.isFinite(timeSeconds)
        || timeSeconds <= 0
        || open == null
        || high == null
        || low == null
        || close == null
      ) {
        return null;
      }

      return {
        time: timeSeconds,
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter((bar): bar is ReplayChartBar => bar != null)
    .sort((a, b) => a.time - b.time);
}

async function fetchReplaySessionMarketContext(
  sessionDate: string,
  symbol: string,
): Promise<{ bars: ReplayChartBar[]; priorDayBar: ReplayPriorDayBar | null }> {
  const replayDate = parseCalendarISODateInput(sessionDate);
  if (!replayDate) {
    return { bars: [], priorDayBar: null };
  }

  const ticker = formatMassiveTicker(symbol);
  const priorDate = getPriorTradingDay(replayDate);
  const [minuteBars, priorDailyBars] = await Promise.all([
    getMinuteAggregates(ticker, replayDate),
    priorDate ? getDailyAggregates(ticker, priorDate, priorDate) : Promise.resolve([] as MassiveAggregate[]),
  ]);

  const bars = mapMassiveAggregatesToReplayBars(minuteBars);

  const priorDailyBar = Array.isArray(priorDailyBars) && priorDailyBars.length > 0
    ? priorDailyBars[0]
    : null;
  const priorHigh = priorDailyBar ? parseFiniteNumber(priorDailyBar.h) : null;
  const priorLow = priorDailyBar ? parseFiniteNumber(priorDailyBar.l) : null;
  const priorDayBar = priorHigh != null && priorLow != null
    ? { high: priorHigh, low: priorLow }
    : null;

  return { bars, priorDayBar };
}

function compareReplaySessionRows(a: ReplaySessionQueryRow, b: ReplaySessionQueryRow): number {
  const aDate = typeof a.session_date === 'string' ? a.session_date : '';
  const bDate = typeof b.session_date === 'string' ? b.session_date : '';
  if (aDate !== bDate) return bDate.localeCompare(aDate);

  const aStartMs = parseEpochMs(a.session_start) ?? 0;
  const bStartMs = parseEpochMs(b.session_start) ?? 0;
  if (aStartMs !== bStartMs) return bStartMs - aStartMs;

  const aId = typeof a.id === 'string' ? a.id : '';
  const bId = typeof b.id === 'string' ? b.id : '';
  return aId.localeCompare(bId);
}

function mapReplayTradeRow(trade: ReplayTradeQueryRow) {
  const tradeIndex = parseFiniteNumber(trade.trade_index);
  return {
    id: toNullableString(trade.id),
    tradeIndex: tradeIndex == null ? 0 : Math.max(0, Math.trunc(tradeIndex)),
    contract: {
      symbol: toNullableString(trade.symbol),
      strike: parseFiniteNumber(trade.strike),
      type: toNullableString(trade.contract_type),
      expiry: toNullableString(trade.expiry),
    },
    entry: {
      direction: toNullableString(trade.direction),
      price: parseFiniteNumber(trade.entry_price),
      timestamp: toNullableString(trade.entry_timestamp),
      sizing: toNullableString(trade.sizing),
    },
    stop: {
      initial: parseFiniteNumber(trade.initial_stop),
    },
    targets: {
      target1: parseFiniteNumber(trade.target_1),
      target2: parseFiniteNumber(trade.target_2),
    },
    thesis: {
      text: toNullableString(trade.thesis_text),
      entryCondition: toNullableString(trade.entry_condition),
    },
    lifecycle: {
      events: Array.isArray(trade.lifecycle_events) ? trade.lifecycle_events : [],
    },
    outcome: {
      finalPnlPct: parseFiniteNumber(trade.final_pnl_pct),
      isWinner: typeof trade.is_winner === 'boolean' ? trade.is_winner : null,
      fullyExited: typeof trade.fully_exited === 'boolean' ? trade.fully_exited : null,
      exitTimestamp: toNullableString(trade.exit_timestamp),
    },
    entrySnapshotId: toNullableString(trade.entry_snapshot_id),
  };
}

function mapReplayMessageRow(message: ReplayMessageQueryRow) {
  return {
    id: toNullableString(message.id),
    discordMessageId: toNullableString(message.discord_msg_id),
    authorName: toNullableString(message.author_name),
    authorId: toNullableString(message.author_id),
    content: toNullableString(message.content),
    sentAt: toNullableString(message.sent_at),
    isSignal: typeof message.is_signal === 'boolean' ? message.is_signal : null,
    signalType: toNullableString(message.signal_type),
    parsedTradeId: toNullableString(message.parsed_trade_id),
    createdAt: toNullableString(message.created_at),
  };
}

function mapReplayDrillResultRow(row: ReplayDrillResultQueryRow) {
  return {
    id: toNullableString(row.id),
    userId: toNullableString(row.user_id),
    sessionId: toNullableString(row.session_id),
    parsedTradeId: toNullableString(row.parsed_trade_id),
    decisionAt: toNullableString(row.decision_at),
    direction: parseDrillDirectionInput(row.direction),
    strike: parseFiniteNumber(row.strike),
    stopLevel: parseFiniteNumber(row.stop_level),
    targetLevel: parseFiniteNumber(row.target_level),
    learnerRr: parseFiniteNumber(row.learner_rr),
    learnerPnlPct: parseFiniteNumber(row.learner_pnl_pct),
    actualPnlPct: parseFiniteNumber(row.actual_pnl_pct),
    engineDirection: parseEngineDirectionInput(row.engine_direction),
    directionMatch: typeof row.direction_match === 'boolean' ? row.direction_match : null,
    score: parseFiniteNumber(row.score),
    feedbackSummary: toNullableString(row.feedback_summary),
    createdAt: toNullableString(row.created_at),
  };
}

function toTradeStreamFeedTrust(generatedAt: string): TradeStreamFeedTrustMetadata {
  const snapshotMs = Date.parse(generatedAt);
  if (!Number.isFinite(snapshotMs)) {
    return {
      source: 'unknown',
      generatedAt,
      ageMs: 0,
      degraded: true,
      stale: true,
      reason: 'Snapshot freshness timestamp is invalid.',
    };
  }

  const ageMs = Math.max(0, Date.now() - snapshotMs);
  const stale = ageMs > TRADE_STREAM_STALE_THRESHOLD_MS;
  return {
    source: stale ? 'fallback' : 'live',
    generatedAt,
    ageMs,
    degraded: stale,
    stale,
    reason: stale
      ? `Snapshot age ${ageMs}ms exceeds freshness threshold ${TRADE_STREAM_STALE_THRESHOLD_MS}ms.`
      : null,
  };
}

function isMissingSupabaseRelationError(error: unknown, tableName: string): boolean {
  const code = typeof (error as { code?: unknown })?.code === 'string'
    ? String((error as { code: string }).code).toUpperCase()
    : '';
  const message = typeof (error as { message?: unknown })?.message === 'string'
    ? String((error as { message: string }).message).toLowerCase()
    : '';

  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST116') {
    return true;
  }

  if (!message || !message.includes(tableName.toLowerCase())) return false;
  return (
    message.includes('does not exist')
    || message.includes('could not find')
    || message.includes('not found')
  );
}

function isKnownMissingRelation(tableName: string): boolean {
  return KNOWN_MISSING_RELATIONS.has(tableName);
}

function markMissingRelation(tableName: string): void {
  KNOWN_MISSING_RELATIONS.add(tableName);
}

function parseBacktestSource(value: unknown): SPXWinRateBacktestSource {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'auto') return 'auto';
  if (normalized === 'spx_setup_instances' || normalized === 'instances') return 'spx_setup_instances';
  return 'spx_setup_instances';
}

function parseBacktestResolution(value: unknown): SPXBacktestPriceResolution {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'second' || normalized === '1s') return 'second';
  if (normalized === 'minute' || normalized === '1m') return 'minute';
  return 'second';
}

function parseSetupPayload(value: unknown): Setup | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const setup = value as Partial<Setup>;
  if (typeof setup.id !== 'string' || setup.id.length === 0) return null;
  if (setup.entryZone == null || typeof setup.entryZone !== 'object') return null;
  if (typeof setup.entryZone.low !== 'number' || typeof setup.entryZone.high !== 'number') return null;
  if (typeof setup.stop !== 'number') return null;
  if (setup.target1 == null || typeof setup.target1 !== 'object') return null;
  if (setup.target2 == null || typeof setup.target2 !== 'object') return null;
  if (typeof setup.target1.price !== 'number' || typeof setup.target2.price !== 'number') return null;
  if (typeof setup.direction !== 'string' || typeof setup.type !== 'string') return null;
  return setup as Setup;
}

async function requireBackendAdmin(req: Request, res: Response): Promise<boolean> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required.',
    });
    return false;
  }

  const isAdmin = await hasBackendAdminAccess(userId);
  if (!isAdmin) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required.',
    });
    return false;
  }

  return true;
}

router.use(authenticateToken, requireTier('pro'));

router.get('/replay-sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    const isAdmin = await hasBackendAdminAccess(userId);
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required.',
      });
    }

    const fromProvided = req.query.from !== undefined;
    const toProvided = req.query.to !== undefined;
    const parsedFrom = parseCalendarISODateInput(req.query.from);
    const parsedTo = parseCalendarISODateInput(req.query.to);

    if (fromProvided && !parsedFrom) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query parameter "from" must be a valid date in YYYY-MM-DD format.',
      });
    }

    if (toProvided && !parsedTo) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query parameter "to" must be a valid date in YYYY-MM-DD format.',
      });
    }

    const from = parsedFrom || dateDaysAgoET(REPLAY_SESSIONS_DEFAULT_WINDOW_DAYS - 1);
    const to = parsedTo || dateDaysAgoET(0);
    if (from > to) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: 'Query parameter "from" must be on or before "to" (YYYY-MM-DD).',
      });
    }

    const channelIds = parseReplayChannelIdsFilter(req.query.channelId);
    const channelFilter = channelIds.length > 0 ? channelIds.join(',') : null;
    const symbol = toNullableString(req.query.symbol)?.toUpperCase() || null;

    let sessionsQuery = supabase
      .from('discord_trade_sessions')
      .select(
        'id,session_date,channel_id,channel_name,caller_name,trade_count,net_pnl_pct,session_start,session_end,session_summary'
      )
      .gte('session_date', from)
      .lte('session_date', to);

    if (channelIds.length === 1) {
      sessionsQuery = sessionsQuery.eq('channel_id', channelIds[0]);
    } else if (channelIds.length > 1) {
      sessionsQuery = sessionsQuery.in('channel_id', channelIds);
    }

    const { data: sessionsData, error: sessionsError } = await sessionsQuery.order('session_date', { ascending: false });
    if (sessionsError) {
      throw sessionsError;
    }

    let sessionRows = (Array.isArray(sessionsData) ? sessionsData : []) as ReplaySessionQueryRow[];

    if (symbol && sessionRows.length > 0) {
      const sessionIds = sessionRows
        .map((row) => (typeof row.id === 'string' ? row.id : null))
        .filter((value): value is string => Boolean(value));

      if (sessionIds.length === 0) {
        sessionRows = [];
      } else {
        const { data: symbolRows, error: symbolError } = await supabase
          .from('discord_parsed_trades')
          .select('session_id')
          .eq('symbol', symbol)
          .in('session_id', sessionIds);

        if (symbolError) {
          throw symbolError;
        }

        const matchedSessionIds = new Set(
          (Array.isArray(symbolRows) ? symbolRows : [])
            .map((row) => (typeof (row as { session_id?: unknown }).session_id === 'string'
              ? String((row as { session_id: string }).session_id)
              : null))
            .filter((value): value is string => Boolean(value))
        );

        sessionRows = sessionRows.filter((row) => (
          typeof row.id === 'string' && matchedSessionIds.has(row.id)
        ));
      }
    }

    sessionRows.sort(compareReplaySessionRows);

    const sessions = sessionRows.map((row) => {
      const tradeCount = parseFiniteNumber(row.trade_count);
      return {
        sessionId: typeof row.id === 'string' ? row.id : '',
        sessionDate: toNullableString(row.session_date),
        channel: {
          id: toNullableString(row.channel_id),
          name: toNullableString(row.channel_name),
        },
        caller: toNullableString(row.caller_name),
        tradeCount: tradeCount == null ? 0 : Math.max(0, Math.trunc(tradeCount)),
        netPnlPct: parseFiniteNumber(row.net_pnl_pct),
        sessionStart: toNullableString(row.session_start),
        sessionEnd: toNullableString(row.session_end),
        sessionSummary: toNullableString(row.session_summary),
      };
    });

    return res.json({
      meta: {
        from,
        to,
        channelId: channelFilter,
        symbol,
        defaultWindowDays: REPLAY_SESSIONS_DEFAULT_WINDOW_DAYS,
        usedDefaultFrom: !parsedFrom,
        usedDefaultTo: !parsedTo,
      },
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    logger.error('SPX replay sessions list endpoint failed', {
      from: req.query.from,
      to: req.query.to,
      channelId: req.query.channelId,
      symbol: req.query.symbol,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load replay sessions.',
      retryAfter: 10,
    });
  }
});

router.get('/replay-sessions/:sessionId/trades', async (req: Request, res: Response) => {
  try {
    const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId.trim() : '';
    if (!isUuid(sessionId)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'sessionId must be a valid UUID.',
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    const isAdmin = await hasBackendAdminAccess(userId);
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required.',
      });
    }

    const symbol = toNullableString(req.query.symbol)?.toUpperCase() || null;

    const { data: session, error: sessionError } = await supabase
      .from('discord_trade_sessions')
      .select('id,session_date')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      return res.status(404).json({
        error: 'Not found',
        message: `Replay session ${sessionId} was not found.`,
      });
    }

    const sessionDate = toNullableString((session as { session_date?: unknown }).session_date);
    if (!sessionDate) {
      return res.status(404).json({
        error: 'Not found',
        message: `Replay session ${sessionId} was not found.`,
      });
    }

    let tradesQuery = supabase
      .from('discord_parsed_trades')
      .select(REPLAY_TRADE_SELECT_FIELDS)
      .eq('session_id', sessionId);

    if (symbol) {
      tradesQuery = tradesQuery.eq('symbol', symbol);
    }

    const { data: tradesData, error: tradesError } = await tradesQuery.order('trade_index', { ascending: true });
    if (tradesError) {
      throw tradesError;
    }

    const tradeRows = (Array.isArray(tradesData) ? tradesData : []) as ReplayTradeQueryRow[];
    const trades = tradeRows.map(mapReplayTradeRow);

    return res.json({
      sessionId,
      sessionDate,
      symbol,
      trades,
      count: trades.length,
    });
  } catch (error) {
    logger.error('SPX replay session trades endpoint failed', {
      sessionId: req.params.sessionId,
      symbol: req.query.symbol,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load replay session trades.',
      retryAfter: 10,
    });
  }
});

router.get('/replay-sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId.trim() : '';
    if (!isUuid(sessionId)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'sessionId must be a valid UUID.',
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    const isAdmin = await hasBackendAdminAccess(userId);
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required.',
      });
    }

    const symbol = toNullableString(req.query.symbol)?.toUpperCase() || 'SPX';

    const { data: session, error: sessionError } = await supabase
      .from('discord_trade_sessions')
      .select('id,session_date,channel_id,channel_name,caller_name,trade_count,net_pnl_pct,session_start,session_end,session_summary')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      return res.status(404).json({
        error: 'Not found',
        message: `Replay session ${sessionId} was not found.`,
      });
    }

    const sessionRow = session as ReplaySessionQueryRow;
    const sessionDate = toNullableString(sessionRow.session_date);
    if (!sessionDate) {
      return res.status(404).json({
        error: 'Not found',
        message: `Replay session ${sessionId} was not found.`,
      });
    }

    const [{ data: snapshotsData, error: snapshotsError }, { data: tradesData, error: tradesError }, { data: messagesData, error: messagesError }] = await Promise.all([
      supabase
        .from('replay_snapshots')
        .select('*')
        .eq('session_date', sessionDate)
        .eq('symbol', symbol)
        .order('captured_at', { ascending: true }),
      supabase
        .from('discord_parsed_trades')
        .select(REPLAY_TRADE_SELECT_FIELDS)
        .eq('session_id', sessionId)
        .eq('symbol', symbol)
        .order('trade_index', { ascending: true }),
      supabase
        .from('discord_messages')
        .select(REPLAY_MESSAGE_SELECT_FIELDS)
        .eq('session_id', sessionId)
        .order('sent_at', { ascending: true }),
    ]);

    if (snapshotsError) throw snapshotsError;
    if (tradesError) throw tradesError;
    if (messagesError) throw messagesError;

    const snapshotRows = Array.isArray(snapshotsData) ? snapshotsData : [];
    const tradeRows = (Array.isArray(tradesData) ? tradesData : []) as ReplayTradeQueryRow[];
    const messageRows = (Array.isArray(messagesData) ? messagesData : []) as ReplayMessageQueryRow[];

    const tradeCount = parseFiniteNumber(sessionRow.trade_count);
    const trades = tradeRows.map(mapReplayTradeRow);
    const messages = messageRows.map(mapReplayMessageRow);
    let bars: ReplayChartBar[] = [];
    let priorDayBar: ReplayPriorDayBar | null = null;

    try {
      const marketContext = await fetchReplaySessionMarketContext(sessionDate, symbol);
      bars = marketContext.bars;
      priorDayBar = marketContext.priorDayBar;
    } catch (marketError) {
      logger.warn('SPX replay session detail market-data enrichment failed', {
        sessionId,
        sessionDate,
        symbol,
        error: marketError instanceof Error ? marketError.message : String(marketError),
      });
      bars = [];
      priorDayBar = null;
    }

    return res.json({
      sessionId,
      sessionDate,
      symbol,
      session: {
        channel: {
          id: toNullableString(sessionRow.channel_id),
          name: toNullableString(sessionRow.channel_name),
        },
        caller: toNullableString(sessionRow.caller_name),
        tradeCount: tradeCount == null ? 0 : Math.max(0, Math.trunc(tradeCount)),
        netPnlPct: parseFiniteNumber(sessionRow.net_pnl_pct),
        sessionStart: toNullableString(sessionRow.session_start),
        sessionEnd: toNullableString(sessionRow.session_end),
        sessionSummary: toNullableString(sessionRow.session_summary),
      },
      snapshots: snapshotRows,
      trades,
      messages,
      bars,
      priorDayBar,
      counts: {
        snapshots: snapshotRows.length,
        trades: trades.length,
        messages: messages.length,
      },
    });
  } catch (error) {
    logger.error('SPX replay session detail endpoint failed', {
      sessionId: req.params.sessionId,
      symbol: req.query.symbol,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load replay session detail.',
      retryAfter: 10,
    });
  }
});

router.get('/replay-sessions/:sessionId/snapshots', async (req: Request, res: Response) => {
  try {
    const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId.trim() : '';
    if (!isUuid(sessionId)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'sessionId must be a valid UUID.',
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    const isAdmin = await hasBackendAdminAccess(userId);
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required.',
      });
    }

    const symbol = typeof req.query.symbol === 'string' && req.query.symbol.trim().length > 0
      ? req.query.symbol.trim().toUpperCase()
      : 'SPX';

    const { data: session, error: sessionError } = await supabase
      .from('discord_trade_sessions')
      .select('id,session_date')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      return res.status(404).json({
        error: 'Not found',
        message: `Replay session ${sessionId} was not found.`,
      });
    }

    const sessionDate = typeof (session as { session_date?: unknown }).session_date === 'string'
      ? (session as { session_date: string }).session_date
      : String((session as { session_date?: unknown }).session_date || '');

    if (!sessionDate) {
      return res.status(404).json({
        error: 'Not found',
        message: `Replay session ${sessionId} was not found.`,
      });
    }

    const { data: snapshots, error: snapshotsError } = await supabase
      .from('replay_snapshots')
      .select('*')
      .eq('session_date', sessionDate)
      .eq('symbol', symbol)
      .order('captured_at', { ascending: true });

    if (snapshotsError) {
      throw snapshotsError;
    }

    const snapshotRows = Array.isArray(snapshots) ? snapshots : [];
    return res.json({
      sessionId,
      sessionDate,
      symbol,
      snapshots: snapshotRows,
      count: snapshotRows.length,
    });
  } catch (error) {
    logger.error('SPX replay session snapshots endpoint failed', {
      sessionId: req.params.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load replay session snapshots.',
      retryAfter: 10,
    });
  }
});

router.post('/replay-sessions/:sessionId/journal', async (req: Request, res: Response) => {
  try {
    const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId.trim() : '';
    if (!isUuid(sessionId)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'sessionId must be a valid UUID.',
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    const isAdmin = await hasBackendAdminAccess(userId);
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required.',
      });
    }

    const body = normalizeBodyObject(req.body);
    const parsedTradeIdRaw = toNullableString(body.parsedTradeId);
    if (parsedTradeIdRaw && !isUuid(parsedTradeIdRaw)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Body field "parsedTradeId" must be a valid UUID when provided.',
      });
    }
    const parsedTradeId = parsedTradeIdRaw ?? null;

    const { data: session, error: sessionError } = await supabase
      .from('discord_trade_sessions')
      .select('id,session_date,channel_id,channel_name,caller_name,session_start,session_end,session_summary')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      return res.status(404).json({
        error: 'Not found',
        message: `Replay session ${sessionId} was not found.`,
      });
    }

    const sessionRow = session as ReplaySessionQueryRow;
    const sessionDate = toNullableString(sessionRow.session_date);
    if (!sessionDate) {
      return res.status(404).json({
        error: 'Not found',
        message: `Replay session ${sessionId} was not found.`,
      });
    }

    let tradesQuery = supabase
      .from('discord_parsed_trades')
      .select(REPLAY_TRADE_SELECT_FIELDS)
      .eq('session_id', sessionId);

    if (parsedTradeId) {
      tradesQuery = tradesQuery.eq('id', parsedTradeId);
    }

    const [{ data: tradesData, error: tradesError }, { data: messagesData, error: messagesError }, { data: snapshotsData, error: snapshotsError }] = await Promise.all([
      tradesQuery.order('trade_index', { ascending: true }),
      supabase
        .from('discord_messages')
        .select(REPLAY_MESSAGE_SELECT_FIELDS)
        .eq('session_id', sessionId)
        .order('sent_at', { ascending: true }),
      supabase
        .from('replay_snapshots')
        .select('*')
        .eq('session_date', sessionDate)
        .order('captured_at', { ascending: true }),
    ]);

    if (tradesError) throw tradesError;
    if (messagesError) throw messagesError;
    if (snapshotsError) throw snapshotsError;

    const tradeRows = (Array.isArray(tradesData) ? tradesData : []) as ReplayTradeQueryRow[];
    if (parsedTradeId && tradeRows.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Body field "parsedTradeId" must belong to the provided sessionId.',
      });
    }

    if (tradeRows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: `Replay session ${sessionId} has no parsed trades to save.`,
      });
    }

    const mappedTrades = tradeRows.map(mapReplayTradeRow);
    const mappedMessages = ((Array.isArray(messagesData) ? messagesData : []) as ReplayMessageQueryRow[]).map(mapReplayMessageRow);
    const snapshotRows = (Array.isArray(snapshotsData) ? snapshotsData : []) as Record<string, unknown>[];
    const resolvedSymbol = (
      toNullableString(mappedTrades[0]?.contract.symbol)
      || toNullableString((snapshotRows[0] as { symbol?: unknown })?.symbol)
      || 'SPX'
    ).toUpperCase();

    const builtEntries = buildReplayJournalEntries({
      userId,
      session: {
        sessionId,
        sessionDate,
        symbol: resolvedSymbol,
        channelId: toNullableString(sessionRow.channel_id),
        channelName: toNullableString(sessionRow.channel_name),
        caller: toNullableString(sessionRow.caller_name),
        sessionStart: toNullableString(sessionRow.session_start),
        sessionEnd: toNullableString(sessionRow.session_end),
        sessionSummary: toNullableString(sessionRow.session_summary),
      },
      trades: mappedTrades,
      messages: mappedMessages,
      snapshots: snapshotRows,
    });

    const journalPayloads = builtEntries.map((entry) => entry.payload);
    const { data: upsertedRows, error: upsertError } = await supabase
      .from('journal_entries')
      .upsert(journalPayloads, {
        onConflict: 'id',
        ignoreDuplicates: true,
      })
      .select('id');

    if (upsertError) throw upsertError;

    const createdIds = new Set(
      (Array.isArray(upsertedRows) ? upsertedRows : [])
        .map((row) => toNullableString((row as { id?: unknown }).id))
        .filter((value): value is string => Boolean(value)),
    );

    const results = builtEntries.map((entry) => ({
      journalEntryId: entry.payload.id,
      parsedTradeId: entry.parsedTradeId,
      importId: entry.payload.import_id,
      replayBacklink: entry.replayBacklink,
      status: createdIds.has(entry.payload.id) ? 'created' : 'existing',
    }));
    const createdCount = results.filter((row) => row.status === 'created').length;

    return res.status(201).json({
      sessionId,
      parsedTradeId,
      symbol: resolvedSymbol,
      count: results.length,
      createdCount,
      existingCount: Math.max(0, results.length - createdCount),
      results,
    });
  } catch (error) {
    logger.error('SPX replay journal create endpoint failed', {
      sessionId: req.params.sessionId,
      parsedTradeId: req.body && typeof req.body === 'object'
        ? (req.body as Record<string, unknown>).parsedTradeId
        : null,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to save replay session to journal.',
      retryAfter: 10,
    });
  }
});

router.post('/drill-results', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    const isAdmin = await hasBackendAdminAccess(userId);
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required.',
      });
    }

    const body = normalizeBodyObject(req.body);
    const sessionId = toNullableString(body.sessionId);
    if (!sessionId || !isUuid(sessionId)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Body field "sessionId" must be a valid UUID.',
      });
    }

    const parsedTradeIdRaw = toNullableString(body.parsedTradeId);
    if (parsedTradeIdRaw && !isUuid(parsedTradeIdRaw)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Body field "parsedTradeId" must be a valid UUID when provided.',
      });
    }
    const parsedTradeId = parsedTradeIdRaw ?? null;

    const decisionAt = parseIsoTimestampInput(body.decisionAt);
    if (!decisionAt) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Body field "decisionAt" must be a valid ISO timestamp.',
      });
    }

    const direction = parseDrillDirectionInput(body.direction);
    if (!direction) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Body field "direction" must be one of: long, short, flat.',
      });
    }

    const strikeProvided = bodyHasOwnKey(body, 'strike');
    const stopLevelProvided = bodyHasOwnKey(body, 'stopLevel');
    const targetLevelProvided = bodyHasOwnKey(body, 'targetLevel');

    const strike = parseBoundedNumberInput(body.strike, DRILL_PRICE_MIN, DRILL_PRICE_MAX);
    const stopLevel = parseBoundedNumberInput(body.stopLevel, DRILL_PRICE_MIN, DRILL_PRICE_MAX);
    const targetLevel = parseBoundedNumberInput(body.targetLevel, DRILL_PRICE_MIN, DRILL_PRICE_MAX);

    if (strikeProvided && strike == null) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `Body field "strike" must be a finite number between ${DRILL_PRICE_MIN} and ${DRILL_PRICE_MAX}.`,
      });
    }
    if (stopLevelProvided && stopLevel == null) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `Body field "stopLevel" must be a finite number between ${DRILL_PRICE_MIN} and ${DRILL_PRICE_MAX}.`,
      });
    }
    if (targetLevelProvided && targetLevel == null) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `Body field "targetLevel" must be a finite number between ${DRILL_PRICE_MIN} and ${DRILL_PRICE_MAX}.`,
      });
    }

    if (direction !== 'flat' && (strike == null || stopLevel == null || targetLevel == null)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Body fields "strike", "stopLevel", and "targetLevel" are required when direction is long or short.',
      });
    }

    const learnerPnlPctProvided = bodyHasOwnKey(body, 'learnerPnlPct');
    const learnerPnlPct = parseBoundedNumberInput(
      body.learnerPnlPct,
      -DRILL_PNL_ABS_MAX,
      DRILL_PNL_ABS_MAX,
    );
    if (learnerPnlPctProvided && learnerPnlPct == null) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `Body field "learnerPnlPct" must be between ${-DRILL_PNL_ABS_MAX} and ${DRILL_PNL_ABS_MAX} when provided.`,
      });
    }

    const actualPnlPctProvided = bodyHasOwnKey(body, 'actualPnlPct');
    const providedActualPnlPct = parseBoundedNumberInput(
      body.actualPnlPct,
      -DRILL_PNL_ABS_MAX,
      DRILL_PNL_ABS_MAX,
    );
    if (actualPnlPctProvided && providedActualPnlPct == null) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `Body field "actualPnlPct" must be between ${-DRILL_PNL_ABS_MAX} and ${DRILL_PNL_ABS_MAX} when provided.`,
      });
    }

    const rawEngineDirection = toNullableString(body.engineDirection);
    const providedEngineDirection = rawEngineDirection == null ? null : parseEngineDirectionInput(rawEngineDirection);
    if (rawEngineDirection != null && providedEngineDirection == null) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Body field "engineDirection" must be one of: bullish, bearish, neutral.',
      });
    }

    const { data: session, error: sessionError } = await supabase
      .from('discord_trade_sessions')
      .select('id')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      return res.status(404).json({
        error: 'Not found',
        message: `Replay session ${sessionId} was not found.`,
      });
    }

    let resolvedActualPnlPct = providedActualPnlPct;
    let resolvedEngineDirection = providedEngineDirection;

    if (parsedTradeId) {
      try {
        const { data: trade, error: tradeError } = await supabase
          .from('discord_parsed_trades')
          .select('id,session_id,direction,final_pnl_pct')
          .eq('id', parsedTradeId)
          .maybeSingle();

        if (tradeError) throw tradeError;

        if (trade) {
          const tradeSessionId = toNullableString((trade as { session_id?: unknown }).session_id);
          if (!tradeSessionId || tradeSessionId !== sessionId) {
            return res.status(400).json({
              error: 'Invalid request',
              message: 'Body field "parsedTradeId" must belong to the provided sessionId.',
            });
          }

          const tradePnl = parseBoundedNumberInput(
            (trade as { final_pnl_pct?: unknown }).final_pnl_pct,
            -DRILL_PNL_ABS_MAX,
            DRILL_PNL_ABS_MAX,
          );
          if (tradePnl != null) {
            resolvedActualPnlPct = tradePnl;
          }

          const tradeEngineDirection = normalizeEngineDirection((trade as { direction?: unknown }).direction);
          if (tradeEngineDirection) {
            resolvedEngineDirection = tradeEngineDirection;
          }
        }
      } catch (enrichmentError) {
        logger.warn('SPX drill result trade enrichment failed; continuing with provided values', {
          sessionId,
          parsedTradeId,
          error: enrichmentError instanceof Error ? enrichmentError.message : String(enrichmentError),
        });
      }
    }

    const scoreResult = scoreReplayDrill({
      learnerDirection: direction,
      engineDirection: resolvedEngineDirection,
      strike: direction === 'flat' ? null : strike,
      stopLevel: direction === 'flat' ? null : stopLevel,
      targetLevel: direction === 'flat' ? null : targetLevel,
      learnerPnlPct,
      actualPnlPct: resolvedActualPnlPct,
    });

    const insertPayload = {
      user_id: userId,
      session_id: sessionId,
      parsed_trade_id: parsedTradeId,
      decision_at: decisionAt,
      direction,
      strike: direction === 'flat' ? null : strike,
      stop_level: direction === 'flat' ? null : stopLevel,
      target_level: direction === 'flat' ? null : targetLevel,
      learner_rr: scoreResult.learnerRr,
      learner_pnl_pct: scoreResult.learnerPnlPct,
      actual_pnl_pct: resolvedActualPnlPct,
      engine_direction: resolvedEngineDirection,
      direction_match: scoreResult.directionMatch,
      score: scoreResult.score,
      feedback_summary: scoreResult.feedbackSummary,
    };

    const { data: insertedRow, error: insertError } = await supabase
      .from('replay_drill_results')
      .insert(insertPayload)
      .select('*')
      .maybeSingle();

    if (insertError) throw insertError;

    if (!insertedRow) {
      logger.error('SPX drill result insert returned no row', {
        sessionId,
        parsedTradeId,
        userId,
      });
      return res.status(503).json({
        error: 'Data unavailable',
        message: 'Unable to persist drill result.',
        retryAfter: 10,
      });
    }

    return res.status(201).json({
      result: mapReplayDrillResultRow(insertedRow as ReplayDrillResultQueryRow),
    });
  } catch (error) {
    logger.error('SPX drill result create endpoint failed', {
      sessionId: req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>).sessionId : null,
      parsedTradeId: req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>).parsedTradeId : null,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to persist drill result.',
      retryAfter: 10,
    });
  }
});

router.get('/drill-results/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    const isAdmin = await hasBackendAdminAccess(userId);
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required.',
      });
    }

    const sessionId = toNullableString(req.query.sessionId);
    if (sessionId && !isUuid(sessionId)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query parameter "sessionId" must be a valid UUID.',
      });
    }

    const limit = parsePositiveInteger(req.query.limit, 25, 1, 100);
    let historyQuery = supabase
      .from('replay_drill_results')
      .select('*')
      .eq('user_id', userId)
      .order('decision_at', { ascending: false });

    if (sessionId) {
      historyQuery = historyQuery.eq('session_id', sessionId);
    }

    const { data: rows, error } = await historyQuery.limit(limit);
    if (error) throw error;

    const historyRows = (Array.isArray(rows) ? rows : []) as ReplayDrillResultQueryRow[];
    const mappedHistory = historyRows.map(mapReplayDrillResultRow);

    let sessionMetaById = new Map<string, {
      sessionDate: string | null;
      channelName: string | null;
      caller: string | null;
    }>();
    let tradeMetaById = new Map<string, {
      symbol: string | null;
      tradeIndex: number | null;
    }>();

    try {
      const sessionIds = Array.from(new Set(
        mappedHistory
          .map((row) => row.sessionId)
          .filter((value): value is string => Boolean(value))
      ));
      const parsedTradeIds = Array.from(new Set(
        mappedHistory
          .map((row) => row.parsedTradeId)
          .filter((value): value is string => Boolean(value))
      ));

      if (sessionIds.length > 0) {
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('discord_trade_sessions')
          .select('id,session_date,channel_name,caller_name')
          .in('id', sessionIds);

        if (sessionsError) throw sessionsError;

        sessionMetaById = new Map(
          (Array.isArray(sessionsData) ? sessionsData : [])
            .map((row) => {
              const id = toNullableString((row as { id?: unknown }).id);
              if (!id) return null;
              return [
                id,
                {
                  sessionDate: toNullableString((row as { session_date?: unknown }).session_date),
                  channelName: toNullableString((row as { channel_name?: unknown }).channel_name),
                  caller: toNullableString((row as { caller_name?: unknown }).caller_name),
                },
              ] as const;
            })
            .filter((entry): entry is readonly [string, {
              sessionDate: string | null;
              channelName: string | null;
              caller: string | null;
            }] => entry != null)
        );
      }

      if (parsedTradeIds.length > 0) {
        const { data: tradesData, error: tradesError } = await supabase
          .from('discord_parsed_trades')
          .select('id,symbol,trade_index')
          .in('id', parsedTradeIds);

        if (tradesError) throw tradesError;

        tradeMetaById = new Map(
          (Array.isArray(tradesData) ? tradesData : [])
            .map((row) => {
              const id = toNullableString((row as { id?: unknown }).id);
              if (!id) return null;
              return [
                id,
                {
                  symbol: toNullableString((row as { symbol?: unknown }).symbol),
                  tradeIndex: parseFiniteNumber((row as { trade_index?: unknown }).trade_index),
                },
              ] as const;
            })
            .filter((entry): entry is readonly [string, {
              symbol: string | null;
              tradeIndex: number | null;
            }] => entry != null)
        );
      }
    } catch (enrichmentError) {
      logger.warn('SPX drill history enrichment failed; returning base history rows', {
        sessionId,
        error: enrichmentError instanceof Error ? enrichmentError.message : String(enrichmentError),
      });
    }

    const history = mappedHistory.map((row) => ({
      ...row,
      session:
        row.sessionId && sessionMetaById.has(row.sessionId)
          ? sessionMetaById.get(row.sessionId)
          : null,
      trade:
        row.parsedTradeId && tradeMetaById.has(row.parsedTradeId)
          ? tradeMetaById.get(row.parsedTradeId)
          : null,
    }));

    return res.json({
      count: history.length,
      history,
    });
  } catch (error) {
    logger.error('SPX drill history endpoint failed', {
      sessionId: req.query.sessionId,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load drill history.',
      retryAfter: 10,
    });
  }
});

router.get('/snapshot', async (req: Request, res: Response) => {
  try {
    const snapshot = await getSPXSnapshot({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json(snapshot);
  } catch (error) {
    logger.error('SPX snapshot endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX command center snapshot.',
      retryAfter: 10,
    });
  }
});

router.get('/trade-stream', async (req: Request, res: Response) => {
  try {
    const snapshot = await getSPXSnapshot({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    const tradeStream = buildTradeStreamSnapshot({
      setups: snapshot.setups,
      feedTrust: toTradeStreamFeedTrust(snapshot.generatedAt),
      generatedAt: new Date().toISOString(),
    });
    return res.json(tradeStream);
  } catch (error) {
    logger.error('SPX trade-stream endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX expert trade stream.',
      retryAfter: 10,
    });
  }
});

router.get('/analytics/win-rate', async (req: Request, res: Response) => {
  try {
    const to = parseISODateInput(req.query.to) || dateDaysAgoET(0);
    const from = parseISODateInput(req.query.from) || dateDaysAgoET(29);

    if (from > to) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: 'Query parameter "from" must be on or before "to" (YYYY-MM-DD).',
      });
    }

    const analytics = await getSPXWinRateAnalytics({ from, to });
    return res.json(analytics);
  } catch (error) {
    logger.error('SPX win-rate analytics endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to compute SPX win-rate analytics.',
      retryAfter: 10,
    });
  }
});

router.get('/analytics/win-rate/backtest', async (req: Request, res: Response) => {
  try {
    const to = parseISODateInput(req.query.to) || dateDaysAgoET(0);
    const from = parseISODateInput(req.query.from) || dateDaysAgoET(29);
    const source = parseBacktestSource(req.query.source);
    const resolution = parseBacktestResolution(req.query.resolution);

    if (from > to) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: 'Query parameter "from" must be on or before "to" (YYYY-MM-DD).',
      });
    }

    const optimizerProfile = await getActiveSPXOptimizationProfile();
    const backtest = await runSPXWinRateBacktest({
      from,
      to,
      source,
      resolution,
      executionModel: {
        partialAtT1Pct: optimizerProfile.tradeManagement.partialAtT1Pct,
        moveStopToBreakevenAfterT1: optimizerProfile.tradeManagement.moveStopToBreakeven,
      },
    });
    return res.json(backtest);
  } catch (error) {
    logger.error('SPX win-rate backtest endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to run SPX win-rate backtest.',
      retryAfter: 10,
    });
  }
});

router.get('/analytics/optimizer/scorecard', async (_req: Request, res: Response) => {
  try {
    const scorecard = await getSPXOptimizerScorecard();
    return res.json(scorecard);
  } catch (error) {
    logger.error('SPX optimizer scorecard endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX optimizer scorecard.',
      retryAfter: 10,
    });
  }
});

router.get('/analytics/optimizer/schedule', async (_req: Request, res: Response) => {
  try {
    const scorecard = await getSPXOptimizerScorecard();
    const schedule = getSPXOptimizerWorkerStatus();
    return res.json({
      ...schedule,
      lastOptimizationGeneratedAt: scorecard.generatedAt,
      lastOptimizationRange: scorecard.scanRange,
      lastOptimizationApplied: scorecard.optimizationApplied,
    });
  } catch (error) {
    logger.error('SPX optimizer schedule endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX optimizer schedule.',
      retryAfter: 10,
    });
  }
});

router.get('/analytics/optimizer/history', async (req: Request, res: Response) => {
  try {
    const limit = parsePositiveInteger(req.query.limit, 20, 1, 100);

    if (isKnownMissingRelation('spx_setup_optimizer_history')) {
      return res.json({ history: [], count: 0 });
    }

    const { data: rows, error } = await supabase
      .from('spx_setup_optimizer_history')
      .select(`
        id,
        created_at,
        mode,
        action,
        optimization_applied,
        actor,
        reason,
        reverted_from_history_id,
        scan_range_from,
        scan_range_to,
        training_from,
        training_to,
        validation_from,
        validation_to,
        previous_profile,
        next_profile,
        scorecard
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingSupabaseRelationError(error, 'spx_setup_optimizer_history')) {
        markMissingRelation('spx_setup_optimizer_history');
        logger.warn('SPX optimizer history table missing; returning empty history', {
          code: (error as { code?: unknown })?.code,
          message: (error as { message?: unknown })?.message,
        });
        return res.json({ history: [], count: 0 });
      }
      throw error;
    }

    const history = (rows || []).map((row) => {
      const previousProfile = typeof (row as { previous_profile?: unknown }).previous_profile === 'object'
        && (row as { previous_profile?: unknown }).previous_profile != null
        && !Array.isArray((row as { previous_profile?: unknown }).previous_profile)
        ? (row as { previous_profile: Record<string, unknown> }).previous_profile
        : {};
      const nextProfile = typeof (row as { next_profile?: unknown }).next_profile === 'object'
        && (row as { next_profile?: unknown }).next_profile != null
        && !Array.isArray((row as { next_profile?: unknown }).next_profile)
        ? (row as { next_profile: Record<string, unknown> }).next_profile
        : {};
      const scorecard = typeof (row as { scorecard?: unknown }).scorecard === 'object'
        && (row as { scorecard?: unknown }).scorecard != null
        && !Array.isArray((row as { scorecard?: unknown }).scorecard)
        ? (row as { scorecard: Record<string, unknown> }).scorecard
        : {};
      const baseline = typeof scorecard.baseline === 'object' && scorecard.baseline && !Array.isArray(scorecard.baseline)
        ? (scorecard.baseline as Record<string, unknown>)
        : {};
      const optimized = typeof scorecard.optimized === 'object' && scorecard.optimized && !Array.isArray(scorecard.optimized)
        ? (scorecard.optimized as Record<string, unknown>)
        : {};
      const improvementPct = typeof scorecard.improvementPct === 'object'
        && scorecard.improvementPct
        && !Array.isArray(scorecard.improvementPct)
        ? (scorecard.improvementPct as Record<string, unknown>)
        : {};
      const notes = Array.isArray(scorecard.notes)
        ? scorecard.notes.filter((entry): entry is string => typeof entry === 'string')
        : [];

      const numericOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

      return {
        id: typeof (row as { id?: unknown }).id === 'number' ? (row as { id: number }).id : 0,
        createdAt: typeof (row as { created_at?: unknown }).created_at === 'string'
          ? (row as { created_at: string }).created_at
          : new Date().toISOString(),
        mode: typeof (row as { mode?: unknown }).mode === 'string' ? (row as { mode: string }).mode : 'manual',
        action: typeof (row as { action?: unknown }).action === 'string' ? (row as { action: string }).action : 'scan',
        optimizationApplied: Boolean((row as { optimization_applied?: unknown }).optimization_applied),
        actor: typeof (row as { actor?: unknown }).actor === 'string' ? (row as { actor: string }).actor : null,
        reason: typeof (row as { reason?: unknown }).reason === 'string' ? (row as { reason: string }).reason : null,
        revertedFromHistoryId: typeof (row as { reverted_from_history_id?: unknown }).reverted_from_history_id === 'number'
          ? (row as { reverted_from_history_id: number }).reverted_from_history_id
          : null,
        scanRange: {
          from: typeof (row as { scan_range_from?: unknown }).scan_range_from === 'string'
            ? (row as { scan_range_from: string }).scan_range_from
            : null,
          to: typeof (row as { scan_range_to?: unknown }).scan_range_to === 'string'
            ? (row as { scan_range_to: string }).scan_range_to
            : null,
        },
        trainingRange: {
          from: typeof (row as { training_from?: unknown }).training_from === 'string'
            ? (row as { training_from: string }).training_from
            : null,
          to: typeof (row as { training_to?: unknown }).training_to === 'string'
            ? (row as { training_to: string }).training_to
            : null,
        },
        validationRange: {
          from: typeof (row as { validation_from?: unknown }).validation_from === 'string'
            ? (row as { validation_from: string }).validation_from
            : null,
          to: typeof (row as { validation_to?: unknown }).validation_to === 'string'
            ? (row as { validation_to: string }).validation_to
            : null,
        },
        previousProfileGeneratedAt: typeof previousProfile.generatedAt === 'string' ? previousProfile.generatedAt : null,
        nextProfileGeneratedAt: typeof nextProfile.generatedAt === 'string' ? nextProfile.generatedAt : null,
        scorecardSummary: {
          baselineTrades: numericOrNull(baseline.tradeCount) ?? 0,
          optimizedTrades: numericOrNull(optimized.tradeCount) ?? 0,
          t1Delta: numericOrNull(improvementPct.t1WinRateDelta) ?? 0,
          t2Delta: numericOrNull(improvementPct.t2WinRateDelta) ?? 0,
          expectancyDeltaR: numericOrNull(improvementPct.expectancyRDelta) ?? 0,
          objectiveConservativeDelta: numericOrNull(improvementPct.objectiveConservativeDelta) ?? 0,
          optimizationApplied: Boolean((row as { optimization_applied?: unknown }).optimization_applied),
        },
        notes,
      };
    });

    return res.json({
      history,
      count: history.length,
    });
  } catch (error) {
    logger.error('SPX optimizer history endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX optimizer history.',
      retryAfter: 10,
    });
  }
});

router.post('/analytics/optimizer/scan', async (req: Request, res: Response) => {
  try {
    const from = parseISODateInput(req.body?.from) || undefined;
    const to = parseISODateInput(req.body?.to) || undefined;
    const dryRun = req.body?.dryRun === true;

    const result = await runSPXOptimizerScan({ from, to, dryRun });
    return res.json(result);
  } catch (error) {
    logger.error('SPX optimizer scan endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to run SPX optimizer scan.',
      retryAfter: 10,
    });
  }
});

router.post('/analytics/optimizer/revert', async (req: Request, res: Response) => {
  try {
    const historyId = parseFiniteNumber(req.body?.historyId);
    if (!historyId || !Number.isInteger(historyId) || historyId < 1) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'historyId must be a positive integer referencing an optimizer history entry.',
      });
    }

    const result = await revertSPXOptimizationProfile(historyId);
    if (!result.success) {
      return res.status(404).json({
        error: 'Revert failed',
        message: result.message,
      });
    }

    return res.json(result);
  } catch (error) {
    logger.error('SPX optimizer revert endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to revert SPX optimizer profile.',
      retryAfter: 10,
    });
  }
});

router.get('/symbol-profiles', async (req: Request, res: Response) => {
  try {
    if (!await requireBackendAdmin(req, res)) {
      return;
    }

    const includeInactive = parseBoolean(req.query.includeInactive);
    const profiles = await listSymbolProfiles({
      includeInactive,
      failOpen: false,
    });

    return res.json({
      profiles: profiles.map((profile) => summarizeSymbolProfile(profile)),
      count: profiles.length,
      includeInactive,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('SPX symbol profile list endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load symbol profiles.',
      retryAfter: 10,
    });
  }
});

router.get('/symbol-profiles/:symbol', async (req: Request, res: Response) => {
  try {
    if (!await requireBackendAdmin(req, res)) {
      return;
    }

    const symbol = toNullableString(req.params.symbol)?.toUpperCase() || null;
    if (!symbol) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Path parameter \"symbol\" is required.',
      });
    }

    const profile = await getSymbolProfileBySymbol(symbol, {
      includeInactive: true,
      failOpen: false,
      bypassCache: parseBoolean(req.query.forceRefresh),
    });

    if (!profile) {
      return res.status(404).json({
        error: 'Not found',
        message: `No symbol profile exists for ${symbol}.`,
      });
    }

    return res.json({
      profile,
      summary: summarizeSymbolProfile(profile),
    });
  } catch (error) {
    logger.error('SPX symbol profile detail endpoint failed', {
      symbol: req.params.symbol,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load symbol profile details.',
      retryAfter: 10,
    });
  }
});

router.get('/levels', async (req: Request, res: Response) => {
  try {
    const data = await getMergedLevels({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json({
      levels: data.levels,
      generatedAt: data.generatedAt,
    });
  } catch (error) {
    logger.error('SPX levels endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX levels at the moment.',
      retryAfter: 10,
    });
  }
});

router.get('/clusters', async (req: Request, res: Response) => {
  try {
    const data = await getMergedLevels({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json({
      zones: data.clusters,
      generatedAt: data.generatedAt,
    });
  } catch (error) {
    logger.error('SPX clusters endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX cluster zones right now.',
      retryAfter: 10,
    });
  }
});

router.get('/gex', async (req: Request, res: Response) => {
  try {
    const forceRefresh = parseBoolean(req.query.forceRefresh);
    const gex = await computeUnifiedGEXLandscape({ forceRefresh });
    return res.json(gex);
  } catch (error) {
    logger.error('SPX GEX endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to compute GEX profile.',
      retryAfter: 10,
    });
  }
});

router.get('/gex/history', async (req: Request, res: Response) => {
  try {
    const symbol = typeof req.query.symbol === 'string' ? req.query.symbol.toUpperCase() : 'SPX';
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 60)));

    const { data, error } = await supabase
      .from('spx_gex_snapshots')
      .select('*')
      .eq('symbol', symbol)
      .order('snapshot_time', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return res.json({
      symbol,
      snapshots: data || [],
      count: (data || []).length,
    });
  } catch (error) {
    logger.error('SPX GEX history endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load GEX history snapshots.',
      retryAfter: 10,
    });
  }
});

router.get('/setups', async (req: Request, res: Response) => {
  try {
    const setups = await detectActiveSetups({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    const environment = await getLatestSetupEnvironmentState();
    return res.json({
      setups,
      count: setups.length,
      environmentGate: environment?.gate || null,
      standbyGuidance: environment?.standbyGuidance || null,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('SPX setups endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load active setups.',
      retryAfter: 10,
    });
  }
});

router.get('/setups/:id', async (req: Request, res: Response) => {
  try {
    const setup = await getSetupById(req.params.id, { forceRefresh: parseBoolean(req.query.forceRefresh) });
    if (!setup) {
      return res.status(404).json({
        error: 'Not found',
        message: `Setup ${req.params.id} was not found`,
      });
    }

    return res.json(setup);
  } catch (error) {
    logger.error('SPX setup detail endpoint failed', {
      setupId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load setup details.',
      retryAfter: 10,
    });
  }
});

router.get('/fibonacci', async (req: Request, res: Response) => {
  try {
    const levels = await getFibLevels({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json({
      levels,
      count: levels.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('SPX fibonacci endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load fibonacci levels.',
      retryAfter: 10,
    });
  }
});

router.get('/flow', async (req: Request, res: Response) => {
  try {
    const events = await getFlowEvents({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json({
      events,
      count: events.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('SPX flow endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load options flow feed.',
      retryAfter: 10,
    });
  }
});

router.get('/regime', async (req: Request, res: Response) => {
  try {
    const forceRefresh = parseBoolean(req.query.forceRefresh);
    const [regime, prediction] = await Promise.all([
      classifyCurrentRegime({ forceRefresh }),
      getPredictionState({ forceRefresh }),
    ]);

    return res.json({
      ...regime,
      prediction,
    });
  } catch (error) {
    logger.error('SPX regime endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to classify current regime.',
      retryAfter: 10,
    });
  }
});

router.get('/basis', async (req: Request, res: Response) => {
  try {
    const basis = await getBasisState({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json(basis);
  } catch (error) {
    logger.error('SPX basis endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX/SPY basis state.',
      retryAfter: 10,
    });
  }
});

router.get('/contract-select', async (req: Request, res: Response) => {
  try {
    const setupId = typeof req.query.setupId === 'string' ? req.query.setupId : undefined;
    const totalEquity = parseFiniteNumber(req.query.totalEquity);
    const dayTradeBuyingPower = parseFiniteNumber(req.query.dayTradeBuyingPower);
    const maxRiskPct = parseFiniteNumber(req.query.maxRiskPct);
    const buyingPowerUtilizationPct = parseFiniteNumber(req.query.buyingPowerUtilizationPct);
    const hasRiskOverride = [totalEquity, dayTradeBuyingPower, maxRiskPct, buyingPowerUtilizationPct]
      .some((value) => value != null);
    const recommendation = await getContractRecommendation({
      setupId,
      forceRefresh: parseBoolean(req.query.forceRefresh),
      userId: req.user?.id,
      riskContext: hasRiskOverride
        ? {
          totalEquity: totalEquity ?? undefined,
          dayTradeBuyingPower: dayTradeBuyingPower ?? undefined,
          maxRiskPct: maxRiskPct ?? undefined,
          buyingPowerUtilizationPct: buyingPowerUtilizationPct ?? undefined,
        }
        : undefined,
    });

    if (!recommendation) {
      return res.status(404).json({
        error: 'No recommendation',
        message: 'No qualifying setup/contract recommendation is currently available.',
      });
    }

    return res.json(recommendation);
  } catch (error) {
    logger.error('SPX contract selector endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to compute contract recommendation.',
      retryAfter: 10,
    });
  }
});

router.post('/contract-select', async (req: Request, res: Response) => {
  try {
    const setupId = typeof req.body?.setupId === 'string' ? req.body.setupId : undefined;
    const setup = parseSetupPayload(req.body?.setup);
    const totalEquity = parseFiniteNumber(req.body?.totalEquity);
    const dayTradeBuyingPower = parseFiniteNumber(req.body?.dayTradeBuyingPower);
    const maxRiskPct = parseFiniteNumber(req.body?.maxRiskPct);
    const buyingPowerUtilizationPct = parseFiniteNumber(req.body?.buyingPowerUtilizationPct);
    const hasRiskOverride = [totalEquity, dayTradeBuyingPower, maxRiskPct, buyingPowerUtilizationPct]
      .some((value) => value != null);
    const recommendation = await getContractRecommendation({
      setupId,
      setup,
      forceRefresh: parseBoolean(req.body?.forceRefresh),
      userId: req.user?.id,
      riskContext: hasRiskOverride
        ? {
          totalEquity: totalEquity ?? undefined,
          dayTradeBuyingPower: dayTradeBuyingPower ?? undefined,
          maxRiskPct: maxRiskPct ?? undefined,
          buyingPowerUtilizationPct: buyingPowerUtilizationPct ?? undefined,
        }
        : undefined,
    });

    if (!recommendation) {
      return res.status(404).json({
        error: 'No recommendation',
        message: 'No qualifying setup/contract recommendation is currently available.',
      });
    }

    return res.json(recommendation);
  } catch (error) {
    logger.error('SPX contract selector POST endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to compute contract recommendation.',
      retryAfter: 10,
    });
  }
});

router.get('/broker/tradier/status', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    let credentialRow: Record<string, unknown> | null = null;
    if (!isKnownMissingRelation('broker_credentials')) {
      const { data, error: credentialError } = await supabase
        .from('broker_credentials')
        .select('broker_name,account_id,is_active,metadata,updated_at')
        .eq('user_id', userId)
        .eq('broker_name', 'tradier')
        .maybeSingle();
      if (credentialError) {
        if (isMissingSupabaseRelationError(credentialError, 'broker_credentials')) {
          markMissingRelation('broker_credentials');
          logger.warn('broker_credentials table missing; returning Tradier status with configured=false', {
            code: (credentialError as { code?: unknown })?.code,
            message: (credentialError as { message?: unknown })?.message,
          });
        } else {
          throw credentialError;
        }
      } else {
        credentialRow = (data as Record<string, unknown> | null) || null;
      }
    }

    let snapshotRow: Record<string, unknown> | null = null;
    if (!isKnownMissingRelation('portfolio_snapshots')) {
      const { data: snapshots, error: snapshotError } = await supabase
        .from('portfolio_snapshots')
        .select('snapshot_time,total_equity,day_trade_buying_power,realized_pnl_daily')
        .eq('user_id', userId)
        .order('snapshot_time', { ascending: false })
        .limit(1);
      if (snapshotError) {
        if (isMissingSupabaseRelationError(snapshotError, 'portfolio_snapshots')) {
          markMissingRelation('portfolio_snapshots');
          logger.warn('portfolio_snapshots table missing; returning Tradier status without portfolio snapshot', {
            code: (snapshotError as { code?: unknown })?.code,
            message: (snapshotError as { message?: unknown })?.message,
          });
        } else {
          throw snapshotError;
        }
      } else if (Array.isArray(snapshots) && snapshots.length > 0) {
        snapshotRow = (snapshots[0] as Record<string, unknown>) || null;
      }
    }

    const runtime = getTradierExecutionRuntimeStatus();
    const portfolioSyncRuntime = isTradierProductionRuntimeEnabled({
      baseEnabled: String(process.env.TRADIER_PORTFOLIO_SYNC_ENABLED || 'false').toLowerCase() === 'true',
      productionEnableEnv: process.env.TRADIER_PORTFOLIO_SYNC_PRODUCTION_ENABLED,
    });

    const metadata = (credentialRow as { metadata?: Record<string, unknown> } | null)?.metadata || {};
    const accountId = (credentialRow as { account_id?: string } | null)?.account_id;
    const maskedAccountId = typeof accountId === 'string' && accountId.length > 4
      ? `****${accountId.slice(-4)}`
      : accountId || null;

    return res.json({
      broker: 'tradier',
      credential: credentialRow
        ? {
          configured: true,
          isActive: Boolean((credentialRow as { is_active?: unknown }).is_active),
          accountIdMasked: maskedAccountId,
          sandbox: typeof metadata.tradier_sandbox === 'boolean' ? metadata.tradier_sandbox : null,
          autoExecute: typeof metadata.spx_auto_execute === 'boolean' ? metadata.spx_auto_execute : false,
          updatedAt: (credentialRow as { updated_at?: string }).updated_at || null,
        }
        : { configured: false },
      latestPortfolioSnapshot: snapshotRow || null,
      runtime: {
        execution: runtime,
        portfolioSync: portfolioSyncRuntime,
      },
    });
  } catch (error) {
    logger.error('SPX Tradier status endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load Tradier status.',
    });
  }
});

router.post('/broker/tradier/credentials', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    const accountId = typeof req.body?.accountId === 'string' ? req.body.accountId.trim() : '';
    const accessToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
    const isActive = parseBoolean(req.body?.isActive ?? true);
    const sandbox = parseBoolean(req.body?.sandbox ?? true);
    const autoExecute = parseBoolean(req.body?.autoExecute ?? false);

    if (!accountId || !accessToken) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Both accountId and accessToken are required.',
      });
    }

    const { data: existingRow } = await supabase
      .from('broker_credentials')
      .select('metadata')
      .eq('user_id', userId)
      .eq('broker_name', 'tradier')
      .maybeSingle();

    const existingMetadata = (
      existingRow && typeof (existingRow as { metadata?: unknown }).metadata === 'object'
        ? (existingRow as { metadata: Record<string, unknown> }).metadata
        : {}
    );

    const metadata = {
      ...existingMetadata,
      tradier_sandbox: sandbox,
      spx_auto_execute: autoExecute,
      credential_source: 'api',
    };

    const { error } = await supabase
      .from('broker_credentials')
      .upsert({
        user_id: userId,
        broker_name: 'tradier',
        account_id: accountId,
        access_token_ciphertext: accessToken,
        is_active: isActive,
        metadata,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      broker: 'tradier',
      accountIdMasked: accountId.length > 4 ? `****${accountId.slice(-4)}` : accountId,
      isActive,
      sandbox,
      autoExecute,
    });
  } catch (error) {
    logger.error('SPX Tradier credential upsert failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to store Tradier credentials.',
    });
  }
});

router.post('/broker/tradier/test-balance', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    const requestAccountId = typeof req.body?.accountId === 'string' ? req.body.accountId.trim() : '';
    const requestToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
    const requestSandbox = req.body?.sandbox;

    let accountId = requestAccountId;
    let token = requestToken;
    let sandbox = typeof requestSandbox === 'boolean'
      ? requestSandbox
      : String(process.env.TRADIER_EXECUTION_SANDBOX || 'true').toLowerCase() !== 'false';

    if (!accountId || !token) {
      const { data: credentialRow, error: credentialError } = await supabase
        .from('broker_credentials')
        .select('account_id,access_token_ciphertext,metadata')
        .eq('user_id', userId)
        .eq('broker_name', 'tradier')
        .eq('is_active', true)
        .maybeSingle();
      if (credentialError) throw credentialError;

      if (!credentialRow) {
        return res.status(400).json({
          error: 'Missing credentials',
          message: 'Provide accountId/accessToken or configure stored Tradier credentials first.',
        });
      }

      const row = credentialRow as {
        account_id: string;
        access_token_ciphertext: string;
        metadata?: Record<string, unknown> | null;
      };
      accountId = row.account_id;
      token = decryptTradierAccessToken(row.access_token_ciphertext);
      if (typeof requestSandbox !== 'boolean' && typeof row.metadata?.tradier_sandbox === 'boolean') {
        sandbox = row.metadata.tradier_sandbox;
      }
    }

    const tradier = new TradierClient({
      accountId,
      accessToken: token,
      sandbox,
    });
    const balances = await tradier.getBalances();

    return res.json({
      success: true,
      sandbox,
      accountIdMasked: accountId.length > 4 ? `****${accountId.slice(-4)}` : accountId,
      balances,
    });
  } catch (error) {
    logger.error('SPX Tradier balance test failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to fetch Tradier balances. Verify sandbox credentials and account settings.',
    });
  }
});

router.post('/broker/tradier/mode', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }

    const mode = req.body?.mode;
    if (!['off', 'manual', 'auto'].includes(mode)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Mode must be one of: off, manual, auto.',
      });
    }

    const isActive = mode !== 'off';
    const autoExecute = mode === 'auto';

    const { data: existingRow, error: fetchError } = await supabase
      .from('broker_credentials')
      .select('metadata')
      .eq('user_id', userId)
      .eq('broker_name', 'tradier')
      .maybeSingle();
    if (fetchError) throw fetchError;

    if (!existingRow) {
      return res.status(404).json({
        error: 'Not found',
        message: 'No Tradier credentials configured. Add credentials first.',
      });
    }

    const existingMetadata = (
      typeof (existingRow as { metadata?: unknown }).metadata === 'object'
        ? (existingRow as { metadata: Record<string, unknown> }).metadata
        : {}
    );

    const { error: updateError } = await supabase
      .from('broker_credentials')
      .update({
        is_active: isActive,
        metadata: { ...existingMetadata, spx_auto_execute: autoExecute, exec_mode: mode },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('broker_name', 'tradier');

    if (updateError) throw updateError;

    logger.info('Tradier execution mode updated', { userId, mode, isActive, autoExecute });
    return res.json({ success: true, mode, isActive, autoExecute });
  } catch (error) {
    logger.error('SPX Tradier mode update failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to update execution mode.',
    });
  }
});

router.post('/broker/tradier/kill', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }

    const { data: credentialRow, error: credentialError } = await supabase
      .from('broker_credentials')
      .select('account_id,access_token_ciphertext,metadata')
      .eq('user_id', userId)
      .eq('broker_name', 'tradier')
      .maybeSingle();
    if (credentialError) throw credentialError;

    if (!credentialRow) {
      return res.status(404).json({
        error: 'Not found',
        message: 'No Tradier credentials configured.',
      });
    }

    const row = credentialRow as {
      account_id: string;
      access_token_ciphertext: string;
      metadata?: Record<string, unknown> | null;
    };

    const sandbox = typeof row.metadata?.tradier_sandbox === 'boolean'
      ? row.metadata.tradier_sandbox
      : String(process.env.TRADIER_EXECUTION_SANDBOX || 'true').toLowerCase() !== 'false';

    const tradier = new TradierClient({
      accountId: row.account_id,
      accessToken: decryptTradierAccessToken(row.access_token_ciphertext),
      sandbox,
    });

    const existingMetadata = (
      typeof row.metadata === 'object' && row.metadata
        ? row.metadata
        : {}
    );

    const { error: updateError } = await supabase
      .from('broker_credentials')
      .update({
        is_active: false,
        metadata: { ...existingMetadata, spx_auto_execute: false, exec_mode: 'off', kill_switch_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('broker_name', 'tradier');

    if (updateError) {
      logger.error('Kill switch: failed to deactivate credentials', { userId, error: updateError.message });
    }

    // S2: Cancel all open orders for this user
    let cancelledOrders = 0;
    try {
      // Query persisted execution states for active order IDs
      const openStates = await loadOpenStatesWithOrders(userId);
      for (const state of openStates) {
        if (state.entryOrderId) {
          try {
            await tradier.cancelOrder(state.entryOrderId);
            cancelledOrders++;
          } catch {
            // Order may already be filled/cancelled
          }
        }
        if (state.runnerStopOrderId) {
          try {
            await tradier.cancelOrder(state.runnerStopOrderId);
            cancelledOrders++;
          } catch {
            // Order may already be filled/cancelled
          }
        }
      }

      // Fallback: query Tradier directly for any SPX-tagged pending orders we may have missed
      try {
        const pendingOrders = await tradier.getOpenOrders('spx:');
        for (const order of pendingOrders) {
          try {
            await tradier.cancelOrder(order.id);
            cancelledOrders++;
          } catch {
            // Already cancelled or filled
          }
        }
      } catch {
        logger.warn('Kill switch: Tradier open orders query failed (non-fatal)', { userId });
      }

      // Close all execution states in Supabase
      const closedCount = await closeAllUserStates(userId, 'kill_switch');
      logger.info('Kill switch: closed execution states', { userId, closedCount });
    } catch (posError) {
      logger.warn('Kill switch: order cancellation encountered errors (non-fatal)', {
        error: posError instanceof Error ? posError.message : String(posError),
      });
    }

    // S3: Flatten any remaining SPX/SPXW option positions.
    let flattenAttempted = 0;
    let flattenSucceeded = 0;
    const flattenFailures: Array<{ symbol: string; quantity: number; side: 'sell_to_close' | 'buy_to_close'; error: string }> = [];
    try {
      const brokerPositions = await tradier.getPositions();
      const spxPositions = brokerPositions.filter((position) =>
        isTradierSPXOptionSymbol(position.symbol)
        && Number.isFinite(position.quantity)
        && position.quantity !== 0,
      );

      for (const position of spxPositions) {
        const quantity = Math.max(0, Math.abs(Math.trunc(position.quantity)));
        if (quantity <= 0) continue;

        const side: 'sell_to_close' | 'buy_to_close' = position.quantity > 0
          ? 'sell_to_close'
          : 'buy_to_close';

        flattenAttempted += 1;
        try {
          await tradier.placeOrder({
            class: 'option',
            symbol: inferTradierUnderlyingFromOptionSymbol(position.symbol),
            option_symbol: position.symbol,
            side,
            quantity,
            type: 'market',
            duration: 'day',
            tag: `spx:kill:${Date.now()}:flatten`,
          });
          flattenSucceeded += 1;
        } catch (error) {
          flattenFailures.push({
            symbol: position.symbol,
            quantity,
            side,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      flattenFailures.push({
        symbol: 'SPX*',
        quantity: 0,
        side: 'sell_to_close',
        error: `position_query_failed:${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // S3: Verify no SPX option positions remain.
    let verificationFailed = false;
    let remainingPositions: Array<{ symbol: string; quantity: number }> = [];
    try {
      const brokerPositions = await tradier.getPositions();
      remainingPositions = brokerPositions
        .filter((position) =>
          isTradierSPXOptionSymbol(position.symbol)
          && Number.isFinite(position.quantity)
          && position.quantity !== 0,
        )
        .map((position) => ({
          symbol: position.symbol,
          quantity: position.quantity,
        }));
    } catch (error) {
      verificationFailed = true;
      flattenFailures.push({
        symbol: 'SPX*',
        quantity: 0,
        side: 'sell_to_close',
        error: `verification_failed:${error instanceof Error ? error.message : String(error)}`,
      });
    }

    const neutralized = !verificationFailed && flattenFailures.length === 0 && remainingPositions.length === 0;
    const statusCode = neutralized ? 200 : 503;
    logger.info('Kill switch activated', {
      userId,
      cancelledOrders,
      flattenAttempted,
      flattenSucceeded,
      flattenFailures: flattenFailures.length,
      remainingPositions: remainingPositions.length,
      verificationFailed,
    });

    return res.status(statusCode).json({
      success: neutralized,
      message: neutralized
        ? 'Kill switch activated. Execution disabled, open orders cancelled, and SPX positions flattened.'
        : 'Kill switch partially completed. Review failures and remaining positions immediately.',
      cancelledOrders,
      flattenAttempted,
      flattenSucceeded,
      flattenFailures,
      verificationFailed,
      remainingPositions,
    });
  } catch (error) {
    logger.error('SPX Tradier kill switch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Kill switch encountered an error.',
    });
  }
});

router.get('/broker/tradier/positions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }

    const { data: credentialRow, error: credentialError } = await supabase
      .from('broker_credentials')
      .select('account_id,access_token_ciphertext,metadata,is_active')
      .eq('user_id', userId)
      .eq('broker_name', 'tradier')
      .maybeSingle();
    if (credentialError) throw credentialError;

    if (!credentialRow) {
      return res.status(404).json({
        error: 'Not found',
        message: 'No Tradier credentials configured.',
      });
    }

    const row = credentialRow as {
      account_id: string;
      access_token_ciphertext: string;
      metadata?: Record<string, unknown> | null;
      is_active?: boolean;
    };

    if (!row.is_active) {
      return res.json({ positions: [], isActive: false, message: 'Broker is not active.' });
    }

    const sandbox = typeof row.metadata?.tradier_sandbox === 'boolean'
      ? row.metadata.tradier_sandbox
      : String(process.env.TRADIER_EXECUTION_SANDBOX || 'true').toLowerCase() !== 'false';

    const tradier = new TradierClient({
      accountId: row.account_id,
      accessToken: decryptTradierAccessToken(row.access_token_ciphertext),
      sandbox,
    });

    const positions = await tradier.getPositions();
    return res.json({ positions, isActive: true, positionCount: positions.length });
  } catch (error) {
    logger.error('SPX Tradier positions endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to fetch Tradier positions.',
    });
  }
});

router.get('/coach/state', async (req: Request, res: Response) => {
  try {
    const state = await getCoachState({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json(state);
  } catch (error) {
    logger.error('SPX coach state endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load coach state.',
      retryAfter: 10,
    });
  }
});

router.post('/coach/message', async (req: Request, res: Response) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
    const setupId = typeof req.body?.setupId === 'string' ? req.body.setupId : undefined;
    const forceRefresh = parseBoolean(req.body?.forceRefresh);
    const userId = req.user?.id;
    const coachTimeoutMs = 20_000;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const messages = await Promise.race([
      generateCoachStream({ prompt, setupId, forceRefresh, userId }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Coach stream timed out after ${coachTimeoutMs}ms`)), coachTimeoutMs);
      }),
    ]).catch((error) => {
      logger.error('SPX coach message generation failed; returning fallback message', {
        error: error instanceof Error ? error.message : String(error),
        setupId,
      });

      return [{
        id: `coach_stream_fallback_${Date.now()}`,
        type: 'alert',
        priority: 'alert',
        setupId: setupId || null,
        content: 'Coach is temporarily delayed. Retry in a few seconds or switch to risk-first execution rules.',
        structuredData: {
          source: 'route_fallback',
          failed: true,
          setupId: setupId || null,
        },
        timestamp: new Date().toISOString(),
      }];
    });

    for (const message of messages) {
      res.write(`event: coach_message\n`);
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    }

    res.write('event: done\n');
    res.write(`data: ${JSON.stringify({ count: messages.length })}\n\n`);
    res.end();
    return;
  } catch (error) {
    logger.error('SPX coach message endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    if (!res.headersSent) {
      res.status(503).json({
        error: 'Coach unavailable',
        message: 'AI coach is temporarily unavailable.',
        retryAfter: 10,
      });
      return;
    }

    res.write('event: error\n');
    res.write(`data: ${JSON.stringify({ message: 'AI coach unavailable' })}\n\n`);
    res.end();
    return;
  }
});

router.post('/coach/decision', async (req: Request, res: Response) => {
  try {
    const setupId = typeof req.body?.setupId === 'string' ? req.body.setupId : undefined;
    const forceRefresh = parseBoolean(req.body?.forceRefresh);
    const userId = req.user?.id;
    const coachTimeoutMs = 20_000;

    const tradeModeRaw = req.body?.tradeMode;
    const tradeMode = tradeModeRaw === 'scan' || tradeModeRaw === 'evaluate' || tradeModeRaw === 'in_trade'
      ? tradeModeRaw
      : undefined;

    const question = typeof req.body?.question === 'string'
      ? req.body.question
      : (typeof req.body?.prompt === 'string' ? req.body.prompt : undefined);

    const selectedContractRaw = req.body?.selectedContract;
    const selectedContract = selectedContractRaw
      && typeof selectedContractRaw === 'object'
      && typeof selectedContractRaw.description === 'string'
      && typeof selectedContractRaw.bid === 'number'
      && typeof selectedContractRaw.ask === 'number'
      && typeof selectedContractRaw.riskReward === 'number'
      ? {
        description: selectedContractRaw.description,
        bid: selectedContractRaw.bid,
        ask: selectedContractRaw.ask,
        riskReward: selectedContractRaw.riskReward,
      }
      : undefined;

    const clientContextRaw = req.body?.clientContext;
    const layoutModeRaw = clientContextRaw?.layoutMode;
    const layoutMode = layoutModeRaw === 'legacy'
      || layoutModeRaw === 'scan'
      || layoutModeRaw === 'evaluate'
      || layoutModeRaw === 'in_trade'
      ? layoutModeRaw
      : undefined;

    const clientContext = clientContextRaw
      && typeof clientContextRaw === 'object'
      ? {
        layoutMode,
        surface: typeof clientContextRaw.surface === 'string'
          ? clientContextRaw.surface
          : undefined,
      }
      : undefined;

    const decisionRequest: CoachDecisionRequest = {
      setupId,
      tradeMode,
      question,
      selectedContract,
      clientContext,
    };

    const decision = await Promise.race([
      generateCoachDecision({
        ...decisionRequest,
        forceRefresh,
        userId,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Coach decision timed out after ${coachTimeoutMs}ms`)), coachTimeoutMs);
      }),
    ]).catch((error) => {
      logger.error('SPX coach decision generation failed; returning fallback decision', {
        error: error instanceof Error ? error.message : String(error),
        setupId,
      });

      return {
        decisionId: `coach_decision_route_fallback_${Date.now()}`,
        setupId: setupId || null,
        verdict: 'WAIT',
        confidence: 0,
        primaryText: 'Coach decision is temporarily delayed. Use risk-first execution rules and retry shortly.',
        why: ['Fallback decision engaged while coach service recovers.'],
        actions: [
          {
            id: 'OPEN_HISTORY',
            label: 'Open Coach History',
            style: 'secondary',
          },
        ],
        severity: 'warning',
        freshness: {
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          stale: true,
        },
        source: 'fallback_v1',
      };
    });

    return res.json(decision);
  } catch (error) {
    logger.error('SPX coach decision endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Coach unavailable',
      message: 'AI coach decision service is temporarily unavailable.',
      retryAfter: 10,
    });
  }
});

export default router;
