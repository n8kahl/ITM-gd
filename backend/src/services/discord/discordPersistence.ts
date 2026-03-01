import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import type { DiscordSignalType, ParsedDiscordSignal } from './messageParser';

interface DiscordTradeSessionUpsertRow {
  session_date: string;
  channel_id: string;
  channel_name: string | null;
  guild_id: string;
  caller_name: string | null;
}

interface DiscordTradeSessionSelectRow {
  id?: unknown;
  session_date?: unknown;
  session_start?: unknown;
  session_end?: unknown;
  trade_count?: unknown;
  net_pnl_pct?: unknown;
}

interface DiscordMessageUpsertRow {
  session_id: string;
  discord_msg_id: string;
  author_name: string;
  author_id: string;
  content: string;
  sent_at: string;
  is_signal: boolean;
  signal_type: string | null;
  parsed_trade_id: string | null;
}

interface DiscordParsedTradeInsertRow {
  session_id: string;
  trade_index: number;
  symbol: string;
  strike: number;
  contract_type: string;
  direction: string | null;
  entry_price: number | null;
  entry_timestamp: string | null;
  lifecycle_events: unknown[];
  fully_exited: boolean;
}

interface DiscordParsedTradeSelectRow {
  id?: unknown;
  trade_index?: unknown;
  entry_timestamp?: unknown;
  fully_exited?: unknown;
  lifecycle_events?: unknown;
  final_pnl_pct?: unknown;
}

type DiscordLifecycleState = 'IDLE' | 'STAGED' | 'ACTIVE' | 'CLOSED';

interface DiscordSessionLifecycleContext {
  state: DiscordLifecycleState;
  currentTradeId: string | null;
}

interface DiscordPersistenceLogger {
  warn: (message: string, meta?: Record<string, unknown>) => void;
}

interface DiscordTradeSessionsTableClient {
  upsert: (
    rows: DiscordTradeSessionUpsertRow[],
    options: { onConflict: string },
  ) => {
    select: (columns: string) => {
      maybeSingle: () => Promise<{ data: DiscordTradeSessionSelectRow | null; error: unknown | null }>;
    };
  };
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: unknown) => {
      select: (columns: string) => {
        maybeSingle: () => Promise<{ data: DiscordTradeSessionSelectRow | null; error: unknown | null }>;
      };
    };
  };
}

interface DiscordMessagesTableClient {
  upsert: (
    rows: DiscordMessageUpsertRow[],
    options: { onConflict: string; ignoreDuplicates?: boolean },
  ) => Promise<{ error: unknown | null }>;
}

interface DiscordParsedTradesSelectBuilder {
  eq: (column: string, value: unknown) => DiscordParsedTradesSelectBuilder;
  order: (column: string, options: { ascending: boolean }) => DiscordParsedTradesSelectBuilder;
  limit: (count: number) => DiscordParsedTradesSelectBuilder;
  maybeSingle: () => Promise<{ data: DiscordParsedTradeSelectRow | null; error: unknown | null }>;
}

interface DiscordParsedTradesUpdateBuilder {
  eq: (column: string, value: unknown) => DiscordParsedTradesUpdateBuilder;
  select: (columns: string) => {
    maybeSingle: () => Promise<{ data: DiscordParsedTradeSelectRow | null; error: unknown | null }>;
  };
}

interface DiscordParsedTradesTableClient {
  select: (columns: string) => DiscordParsedTradesSelectBuilder;
  insert: (rows: DiscordParsedTradeInsertRow[]) => {
    select: (columns: string) => {
      maybeSingle: () => Promise<{ data: DiscordParsedTradeSelectRow | null; error: unknown | null }>;
    };
  };
  update: (values: Record<string, unknown>) => DiscordParsedTradesUpdateBuilder;
}

interface DiscordPersistenceDbClient {
  from: (table: string) => DiscordTradeSessionsTableClient | DiscordMessagesTableClient | DiscordParsedTradesTableClient;
}

interface DiscordPersistenceDependencies {
  db: DiscordPersistenceDbClient;
  logger: DiscordPersistenceLogger;
}

interface PersistDiscordMessageResult {
  sessionId: string;
  sessionDate: string;
  parsedTradeId: string | null;
}

interface PersistedSessionContext {
  sessionId: string;
  sessionDate: string;
  sessionStart: string | null;
  sessionEnd: string | null;
}

interface DiscordPipelineDependencies {
  persistence: Pick<DiscordPersistenceService, 'persistDiscordMessage'>;
  broadcaster: {
    broadcast: (signal: ParsedDiscordSignal) => Promise<void>;
  };
  logger: DiscordPersistenceLogger;
}

function parseTimestamp(timestamp: string): Date | null {
  const epochMs = Date.parse(timestamp);
  if (!Number.isFinite(epochMs)) return null;
  return new Date(epochMs);
}

function toSessionDateEt(timestamp: string): string {
  const parsed = parseTimestamp(timestamp);
  return toEasternTime(parsed ?? new Date()).dateStr;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function executeQuery<T>(
  query: unknown,
): Promise<{ data: T | null; error: unknown | null }> {
  const queryWithExec = query as { exec?: () => Promise<{ data: T | null; error: unknown | null }> };
  if (typeof queryWithExec.exec === 'function') {
    return queryWithExec.exec();
  }
  return await (query as Promise<{ data: T | null; error: unknown | null }>);
}

function isSignalForPersistence(signalType: ParsedDiscordSignal['signalType']): boolean {
  return signalType !== 'commentary';
}

function isOpenLifecycleSignal(signalType: DiscordSignalType): boolean {
  return signalType === 'prep' || signalType === 'ptf' || signalType === 'filled_avg'
    || signalType === 'trim' || signalType === 'stops' || signalType === 'breakeven'
    || signalType === 'trail';
}

function resolveDirection(signal: ParsedDiscordSignal): string | null {
  const content = signal.content.toLowerCase();
  if (/\bshort\b/.test(content)) return 'short';
  if (/\blong\b/.test(content)) return 'long';
  if (signal.fields.optionType === 'call' || signal.fields.optionType === 'put') return 'long';
  return null;
}

function resolveContractType(signal: ParsedDiscordSignal): string {
  return signal.fields.optionType === 'put' ? 'put' : 'call';
}

function resolveSymbol(signal: ParsedDiscordSignal): string {
  const symbol = toNullableString(signal.fields.symbol);
  return symbol ? symbol.toUpperCase() : 'SPX';
}

function resolveStrike(signal: ParsedDiscordSignal): number {
  return toFiniteNumber(signal.fields.strike) ?? 0;
}

function buildLifecycleEvent(signal: ParsedDiscordSignal): Record<string, unknown> {
  return {
    type: signal.signalType,
    at: signal.createdAt,
    price: toFiniteNumber(signal.fields.price),
    percent: toFiniteNumber(signal.fields.percent),
    level: toFiniteNumber(signal.fields.level),
    content: signal.content,
  };
}

function isTradeActiveFromRow(row: DiscordParsedTradeSelectRow): boolean {
  const fullyExited = row.fully_exited === true;
  const entryTimestamp = toNullableString(row.entry_timestamp);
  return !fullyExited && Boolean(entryTimestamp);
}

export class DiscordPersistenceService {
  private readonly deps: DiscordPersistenceDependencies;
  private readonly sessionLifecycle = new Map<string, DiscordSessionLifecycleContext>();

  constructor(dependencies?: Partial<DiscordPersistenceDependencies>) {
    this.deps = {
      db: dependencies?.db ?? (supabase as unknown as DiscordPersistenceDbClient),
      logger: dependencies?.logger ?? logger,
    };
  }

  async persistDiscordMessage(signal: ParsedDiscordSignal): Promise<PersistDiscordMessageResult> {
    const sessionDate = toSessionDateEt(signal.createdAt);
    const session = await this.upsertDiscordTradeSession(signal, sessionDate);
    const parsedTradeId = isSignalForPersistence(signal.signalType)
      ? await this.persistParsedTradeLifecycle(signal, session.sessionId)
      : null;

    await this.upsertDiscordMessageRow(signal, session.sessionId, parsedTradeId);
    await this.updateSessionRollups({
      sessionId: session.sessionId,
      persistedSessionStart: session.sessionStart,
      persistedSessionEnd: session.sessionEnd,
      incomingSentAt: signal.createdAt,
    });

    return {
      sessionId: session.sessionId,
      sessionDate,
      parsedTradeId,
    };
  }

  private getSessionKey(sessionId: string, channelId: string): string {
    return `${sessionId}:${channelId}`;
  }

  private async getOrInitializeLifecycleContext(
    signal: ParsedDiscordSignal,
    sessionId: string,
  ): Promise<DiscordSessionLifecycleContext> {
    const key = this.getSessionKey(sessionId, signal.channelId);
    const existing = this.sessionLifecycle.get(key);
    if (existing) return existing;

    const latestOpenTrade = await this.findLatestOpenTrade(sessionId);
    if (!latestOpenTrade) {
      const initialized: DiscordSessionLifecycleContext = { state: 'IDLE', currentTradeId: null };
      this.sessionLifecycle.set(key, initialized);
      return initialized;
    }

    const latestOpenTradeId = toNullableString(latestOpenTrade.id);
    const initialized: DiscordSessionLifecycleContext = {
      state: isTradeActiveFromRow(latestOpenTrade) ? 'ACTIVE' : 'STAGED',
      currentTradeId: latestOpenTradeId,
    };
    this.sessionLifecycle.set(key, initialized);
    return initialized;
  }

  private async persistParsedTradeLifecycle(signal: ParsedDiscordSignal, sessionId: string): Promise<string | null> {
    const context = await this.getOrInitializeLifecycleContext(signal, sessionId);

    switch (signal.signalType) {
      case 'prep': {
        if (context.currentTradeId && isOpenLifecycleSignal(signal.signalType)) {
          if (context.state === 'ACTIVE' || context.state === 'STAGED') {
            await this.closeTrade(context.currentTradeId, signal);
          }
        }
        const stagedTradeId = await this.createStagedTrade(signal, sessionId);
        context.state = 'STAGED';
        context.currentTradeId = stagedTradeId;
        return stagedTradeId;
      }

      case 'ptf':
      case 'filled_avg': {
        let tradeId = context.currentTradeId;
        if (!tradeId) {
          tradeId = await this.createStagedTrade(signal, sessionId);
        }
        if (!tradeId) return null;

        await this.activateTrade(tradeId, signal);
        context.state = 'ACTIVE';
        context.currentTradeId = tradeId;
        return tradeId;
      }

      case 'trim':
      case 'stops':
      case 'breakeven':
      case 'trail': {
        const tradeId = context.currentTradeId ?? await this.resolveLatestOpenTradeId(sessionId);
        if (!tradeId) return null;

        await this.appendLifecycleEvent(tradeId, signal);
        context.state = 'ACTIVE';
        context.currentTradeId = tradeId;
        return tradeId;
      }

      case 'exit_above':
      case 'exit_below':
      case 'fully_out': {
        const tradeId = context.currentTradeId ?? await this.resolveLatestOpenTradeId(sessionId);
        if (!tradeId) return null;

        await this.closeTrade(tradeId, signal);
        context.state = 'CLOSED';
        context.currentTradeId = null;
        return tradeId;
      }

      case 'commentary':
      default:
        return null;
    }
  }

  private async findLatestOpenTrade(sessionId: string): Promise<DiscordParsedTradeSelectRow | null> {
    const parsedTradesTable = this.deps.db.from('discord_parsed_trades') as DiscordParsedTradesTableClient;
    const { data, error } = await parsedTradesTable
      .select('id,trade_index,entry_timestamp,fully_exited,lifecycle_events')
      .eq('session_id', sessionId)
      .eq('fully_exited', false)
      .order('trade_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data ?? null;
  }

  private async resolveLatestOpenTradeId(sessionId: string): Promise<string | null> {
    const row = await this.findLatestOpenTrade(sessionId);
    return toNullableString(row?.id);
  }

  private async getNextTradeIndex(sessionId: string): Promise<number> {
    const maxTradeIndex = await this.getCurrentMaxTradeIndex(sessionId);
    return Math.max(1, maxTradeIndex + 1);
  }

  private async createStagedTrade(signal: ParsedDiscordSignal, sessionId: string): Promise<string | null> {
    const parsedTradesTable = this.deps.db.from('discord_parsed_trades') as DiscordParsedTradesTableClient;
    const tradeIndex = await this.getNextTradeIndex(sessionId);
    const row: DiscordParsedTradeInsertRow = {
      session_id: sessionId,
      trade_index: tradeIndex,
      symbol: resolveSymbol(signal),
      strike: resolveStrike(signal),
      contract_type: resolveContractType(signal),
      direction: resolveDirection(signal),
      entry_price: null,
      entry_timestamp: null,
      lifecycle_events: [],
      fully_exited: false,
    };

    const { data, error } = await parsedTradesTable
      .insert([row])
      .select('id,trade_index,entry_timestamp,fully_exited,lifecycle_events')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return toNullableString(data?.id);
  }

  private async activateTrade(tradeId: string, signal: ParsedDiscordSignal): Promise<void> {
    const parsedTradesTable = this.deps.db.from('discord_parsed_trades') as DiscordParsedTradesTableClient;
    const patch: Record<string, unknown> = {
      entry_timestamp: signal.createdAt,
    };

    const direction = resolveDirection(signal);
    const price = toFiniteNumber(signal.fields.price);
    const symbol = toNullableString(signal.fields.symbol);
    const strike = toFiniteNumber(signal.fields.strike);
    const optionType = signal.fields.optionType;

    if (direction) patch.direction = direction;
    if (price != null) patch.entry_price = price;
    if (symbol) patch.symbol = symbol.toUpperCase();
    if (strike != null) patch.strike = strike;
    if (optionType === 'call' || optionType === 'put') patch.contract_type = optionType;

    const { error } = await parsedTradesTable
      .update(patch)
      .eq('id', tradeId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }
  }

  private async appendLifecycleEvent(tradeId: string, signal: ParsedDiscordSignal): Promise<void> {
    const parsedTradesTable = this.deps.db.from('discord_parsed_trades') as DiscordParsedTradesTableClient;
    const { data: tradeRow, error: fetchError } = await parsedTradesTable
      .select('id,lifecycle_events')
      .eq('id', tradeId)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    const currentEvents = Array.isArray(tradeRow?.lifecycle_events)
      ? tradeRow?.lifecycle_events
      : [];
    const nextEvents = [...currentEvents, buildLifecycleEvent(signal)];

    const { error: updateError } = await parsedTradesTable
      .update({ lifecycle_events: nextEvents })
      .eq('id', tradeId)
      .select('id')
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }
  }

  private async closeTrade(tradeId: string, signal: ParsedDiscordSignal): Promise<void> {
    const parsedTradesTable = this.deps.db.from('discord_parsed_trades') as DiscordParsedTradesTableClient;
    const finalPnlPct = toFiniteNumber(signal.fields.percent);
    const patch: Record<string, unknown> = {
      fully_exited: true,
      exit_timestamp: signal.createdAt,
    };
    if (finalPnlPct != null) patch.final_pnl_pct = finalPnlPct;

    const { error } = await parsedTradesTable
      .update(patch)
      .eq('id', tradeId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }
  }

  private async upsertDiscordTradeSession(
    signal: ParsedDiscordSignal,
    sessionDate: string,
  ): Promise<PersistedSessionContext> {
    const sessionRow: DiscordTradeSessionUpsertRow = {
      session_date: sessionDate,
      channel_id: signal.channelId,
      channel_name: signal.channelId,
      guild_id: signal.guildId,
      caller_name: signal.authorId,
    };

    const tradeSessionsTable = this.deps.db.from('discord_trade_sessions') as DiscordTradeSessionsTableClient;
    const { data, error } = await tradeSessionsTable
      .upsert([sessionRow], { onConflict: 'session_date,channel_id' })
      .select('id,session_date,session_start,session_end,trade_count,net_pnl_pct')
      .maybeSingle();

    if (error) {
      throw error;
    }

    const sessionId = toNullableString(data?.id);
    if (!sessionId) {
      throw new Error('Discord session upsert did not return a session id');
    }

    return {
      sessionId,
      sessionDate,
      sessionStart: toNullableString(data?.session_start),
      sessionEnd: toNullableString(data?.session_end),
    };
  }

  private resolveBoundaryTimestamp(
    persisted: string | null,
    incoming: string,
    mode: 'min' | 'max',
  ): string {
    const persistedDate = persisted ? parseTimestamp(persisted) : null;
    const incomingDate = parseTimestamp(incoming);

    if (!persistedDate && !incomingDate) return incoming;
    if (!persistedDate && incomingDate) return incomingDate.toISOString();
    if (persistedDate && !incomingDate) return persistedDate.toISOString();

    const persistedMs = persistedDate!.getTime();
    const incomingMs = incomingDate!.getTime();
    if (mode === 'min') {
      return new Date(Math.min(persistedMs, incomingMs)).toISOString();
    }
    return new Date(Math.max(persistedMs, incomingMs)).toISOString();
  }

  private async getClosedTradeFinalPnlValues(sessionId: string): Promise<number[]> {
    const parsedTradesTable = this.deps.db.from('discord_parsed_trades') as DiscordParsedTradesTableClient;
    const query = parsedTradesTable
      .select('final_pnl_pct')
      .eq('session_id', sessionId)
      .eq('fully_exited', true);

    const { data, error } = await executeQuery<DiscordParsedTradeSelectRow[]>(query);
    if (error) {
      throw error;
    }

    return (Array.isArray(data) ? data : [])
      .map((row) => toFiniteNumber((row as { final_pnl_pct?: unknown }).final_pnl_pct))
      .filter((value): value is number => value != null);
  }

  private async getCurrentMaxTradeIndex(sessionId: string): Promise<number> {
    const parsedTradesTable = this.deps.db.from('discord_parsed_trades') as DiscordParsedTradesTableClient;
    const { data, error } = await parsedTradesTable
      .select('trade_index')
      .eq('session_id', sessionId)
      .order('trade_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const tradeIndex = toFiniteNumber(data?.trade_index);
    if (tradeIndex == null) return 0;
    return Math.max(0, Math.trunc(tradeIndex));
  }

  private async updateSessionRollups(input: {
    sessionId: string;
    persistedSessionStart: string | null;
    persistedSessionEnd: string | null;
    incomingSentAt: string;
  }): Promise<void> {
    const tradeCount = await this.getCurrentMaxTradeIndex(input.sessionId);
    const closedTradePnls = await this.getClosedTradeFinalPnlValues(input.sessionId);
    const netPnlPct = closedTradePnls.length > 0
      ? Math.round(closedTradePnls.reduce((sum, value) => sum + value, 0) * 100) / 100
      : null;

    const sessionStart = this.resolveBoundaryTimestamp(
      input.persistedSessionStart,
      input.incomingSentAt,
      'min',
    );
    const sessionEnd = this.resolveBoundaryTimestamp(
      input.persistedSessionEnd,
      input.incomingSentAt,
      'max',
    );

    const tradeSessionsTable = this.deps.db.from('discord_trade_sessions') as DiscordTradeSessionsTableClient;
    const { error } = await tradeSessionsTable
      .update({
        session_start: sessionStart,
        session_end: sessionEnd,
        trade_count: tradeCount,
        net_pnl_pct: netPnlPct,
      })
      .eq('id', input.sessionId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }
  }

  private async upsertDiscordMessageRow(
    signal: ParsedDiscordSignal,
    sessionId: string,
    parsedTradeId: string | null,
  ): Promise<void> {
    const messageRow: DiscordMessageUpsertRow = {
      session_id: sessionId,
      discord_msg_id: signal.messageId,
      author_name: signal.authorId,
      author_id: signal.authorId,
      content: signal.content,
      sent_at: signal.createdAt,
      is_signal: isSignalForPersistence(signal.signalType),
      signal_type: signal.signalType,
      parsed_trade_id: parsedTradeId,
    };

    const messagesTable = this.deps.db.from('discord_messages') as DiscordMessagesTableClient;
    const { error } = await messagesTable
      .upsert([messageRow], {
        onConflict: 'discord_msg_id',
        ignoreDuplicates: true,
      });

    if (error) {
      throw error;
    }
  }
}

export async function persistThenBroadcastDiscordSignal(
  signal: ParsedDiscordSignal,
  dependencies?: Partial<DiscordPipelineDependencies>,
): Promise<void> {
  const deps: DiscordPipelineDependencies = {
    persistence: dependencies?.persistence ?? discordPersistence,
    broadcaster: dependencies?.broadcaster ?? { broadcast: async () => undefined },
    logger: dependencies?.logger ?? logger,
  };

  try {
    await deps.persistence.persistDiscordMessage(signal);
  } catch (error) {
    deps.logger.warn('Discord persistence failed; continuing fail-open', {
      error: error instanceof Error ? error.message : String(error),
      messageId: signal.messageId,
      channelId: signal.channelId,
      guildId: signal.guildId,
    });
  }

  await deps.broadcaster.broadcast(signal);
}

export const discordPersistence = new DiscordPersistenceService();
