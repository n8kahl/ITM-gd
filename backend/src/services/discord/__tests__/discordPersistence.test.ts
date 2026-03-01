import type { ParsedDiscordSignal, DiscordSignalType } from '../messageParser';
import {
  DiscordPersistenceService,
  persistThenBroadcastDiscordSignal,
} from '../discordPersistence';

type SessionRow = {
  id: string;
  session_date: string;
  channel_id: string;
  channel_name: string | null;
  guild_id: string;
  caller_name: string | null;
  session_start: string | null;
  session_end: string | null;
  trade_count: number;
  net_pnl_pct: number | null;
};

type MessageRow = {
  session_id: string;
  discord_msg_id: string;
  author_name: string;
  author_id: string;
  content: string;
  sent_at: string;
  is_signal: boolean;
  signal_type: string | null;
  parsed_trade_id: string | null;
};

type TradeRow = {
  id: string;
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
  exit_timestamp?: string;
  final_pnl_pct?: number;
};

function buildSignal(
  signalType: DiscordSignalType,
  overrides?: Partial<ParsedDiscordSignal>,
): ParsedDiscordSignal {
  return {
    messageId: 'msg-1',
    guildId: 'guild-1',
    channelId: 'channel-1',
    authorId: 'author-1',
    authorIsBot: false,
    content: 'prep SPX 6000c @ 1.10',
    createdAt: '2026-03-01T15:00:00.000Z',
    editedAt: null,
    signalType,
    fields: {
      symbol: 'SPX',
      strike: 6000,
      optionType: 'call',
      price: 1.1,
      percent: null,
      level: null,
    },
    ...overrides,
  };
}

class InMemoryDiscordDb {
  public readonly sessions: SessionRow[] = [];
  public readonly messages: MessageRow[] = [];
  public readonly trades: TradeRow[] = [];

  private sessionSeq = 0;
  private tradeSeq = 0;

  from(table: string): any {
    if (table === 'discord_trade_sessions') {
      return {
        upsert: (rows: Array<Omit<SessionRow, 'id'>>, _options: { onConflict: string }) => ({
          select: (_columns: string) => ({
            maybeSingle: async () => {
              const input = rows[0];
              if (!input) return { data: null, error: null };

              let row = this.sessions.find((session) => (
                session.session_date === input.session_date
                && session.channel_id === input.channel_id
              ));
              if (!row) {
                row = {
                  id: `session-${++this.sessionSeq}`,
                  session_date: input.session_date,
                  channel_id: input.channel_id,
                  channel_name: input.channel_name ?? null,
                  guild_id: input.guild_id,
                  caller_name: input.caller_name ?? null,
                  session_start: input.session_start ?? null,
                  session_end: input.session_end ?? null,
                  trade_count: input.trade_count ?? 0,
                  net_pnl_pct: input.net_pnl_pct ?? null,
                };
                this.sessions.push(row);
              } else {
                row.channel_name = input.channel_name ?? row.channel_name;
                row.guild_id = input.guild_id;
                row.caller_name = input.caller_name ?? row.caller_name;
              }
              return {
                data: {
                  id: row.id,
                  session_date: row.session_date,
                  session_start: row.session_start,
                  session_end: row.session_end,
                  trade_count: row.trade_count,
                  net_pnl_pct: row.net_pnl_pct,
                },
                error: null,
              };
            },
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          const filters: Array<{ column: string; value: unknown }> = [];
          const builder = {
            eq: (column: string, value: unknown) => {
              filters.push({ column, value });
              return builder;
            },
            select: (_columns: string) => ({
              maybeSingle: async () => {
                const row = this.sessions.find((candidate) => (
                  filters.every(({ column, value }) => (
                    (candidate as Record<string, unknown>)[column] === value
                  ))
                ));
                if (!row) return { data: null, error: null };
                Object.assign(row, patch);
                return { data: row, error: null };
              },
            }),
          };
          return builder;
        },
      };
    }

    if (table === 'discord_messages') {
      return {
        upsert: async (
          rows: MessageRow[],
          options: { onConflict: string; ignoreDuplicates?: boolean },
        ) => {
          const row = rows[0];
          if (!row) return { error: null };

          const existingIndex = this.messages.findIndex((message) => message.discord_msg_id === row.discord_msg_id);
          if (existingIndex >= 0) {
            if (!options.ignoreDuplicates) {
              this.messages[existingIndex] = { ...this.messages[existingIndex], ...row };
            }
            return { error: null };
          }

          this.messages.push({ ...row });
          return { error: null };
        },
      };
    }

    if (table === 'discord_parsed_trades') {
      return {
        select: (_columns: string) => {
          const filters: Array<{ column: string; value: unknown }> = [];
          let orderBy: { column: string; ascending: boolean } | null = null;
          let limitCount: number | null = null;

          const resolveRows = () => {
            let rows = [...this.trades];
            rows = rows.filter((row) => filters.every(({ column, value }) => {
              return (row as Record<string, unknown>)[column] === value;
            }));
            if (orderBy) {
              rows.sort((a, b) => {
                const left = (a as Record<string, unknown>)[orderBy!.column];
                const right = (b as Record<string, unknown>)[orderBy!.column];
                if (typeof left === 'number' && typeof right === 'number') {
                  return orderBy!.ascending ? left - right : right - left;
                }
                return orderBy!.ascending
                  ? String(left ?? '').localeCompare(String(right ?? ''))
                  : String(right ?? '').localeCompare(String(left ?? ''));
              });
            }
            if (limitCount != null) {
              rows = rows.slice(0, limitCount);
            }
            return rows;
          };

          const builder = {
            eq: (column: string, value: unknown) => {
              filters.push({ column, value });
              return builder;
            },
            order: (column: string, options: { ascending: boolean }) => {
              orderBy = { column, ascending: options.ascending };
              return builder;
            },
            limit: (count: number) => {
              limitCount = count;
              return builder;
            },
            maybeSingle: async () => {
              const rows = resolveRows();
              return { data: rows[0] ?? null, error: null };
            },
            exec: async () => ({ data: resolveRows(), error: null }),
          };
          return builder;
        },

        insert: (rows: Array<Omit<TradeRow, 'id'>>) => ({
          select: (_columns: string) => ({
            maybeSingle: async () => {
              const row = rows[0];
              if (!row) return { data: null, error: null };
              const inserted: TradeRow = {
                id: `trade-${++this.tradeSeq}`,
                session_id: row.session_id,
                trade_index: row.trade_index,
                symbol: row.symbol,
                strike: row.strike,
                contract_type: row.contract_type,
                direction: row.direction ?? null,
                entry_price: row.entry_price ?? null,
                entry_timestamp: row.entry_timestamp ?? null,
                lifecycle_events: Array.isArray(row.lifecycle_events) ? row.lifecycle_events : [],
                fully_exited: row.fully_exited === true,
              };
              this.trades.push(inserted);
              return { data: inserted, error: null };
            },
          }),
        }),

        update: (patch: Record<string, unknown>) => {
          const filters: Array<{ column: string; value: unknown }> = [];
          const builder = {
            eq: (column: string, value: unknown) => {
              filters.push({ column, value });
              return builder;
            },
            select: (_columns: string) => ({
              maybeSingle: async () => {
                const row = this.trades.find((candidate) => (
                  filters.every(({ column, value }) => (
                    (candidate as Record<string, unknown>)[column] === value
                  ))
                ));
                if (!row) return { data: null, error: null };
                Object.assign(row, patch);
                return { data: row, error: null };
              },
            }),
          };
          return builder;
        },
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }
}

describe('services/discord/discordPersistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('upserts discord_trade_sessions using ET session_date and unique session_date/channel_id key', async () => {
    const db = new InMemoryDiscordDb();
    const service = new DiscordPersistenceService({
      db: db as any,
      logger: { warn: jest.fn() },
    });

    const result = await service.persistDiscordMessage(buildSignal('commentary', {
      createdAt: '2026-03-01T03:30:00.000Z', // 2026-02-28 ET
      content: 'watching tape',
    }));

    expect(result.sessionDate).toBe('2026-02-28');
    expect(db.sessions).toHaveLength(1);
    expect(db.sessions[0]).toEqual(expect.objectContaining({
      session_date: '2026-02-28',
      channel_id: 'channel-1',
      session_start: '2026-03-01T03:30:00.000Z',
      session_end: '2026-03-01T03:30:00.000Z',
      trade_count: 0,
      net_pnl_pct: null,
    }));
  });

  it('creates staged parsed trade on PREP with deterministic trade_index and links message parsed_trade_id', async () => {
    const db = new InMemoryDiscordDb();
    const service = new DiscordPersistenceService({
      db: db as any,
      logger: { warn: jest.fn() },
    });

    const result = await service.persistDiscordMessage(buildSignal('prep'));

    expect(result.parsedTradeId).toBe('trade-1');
    expect(db.trades).toHaveLength(1);
    expect(db.trades[0]).toEqual(expect.objectContaining({
      id: 'trade-1',
      trade_index: 1,
      entry_timestamp: null,
      fully_exited: false,
      symbol: 'SPX',
      strike: 6000,
      contract_type: 'call',
    }));
    expect(db.messages[0].parsed_trade_id).toBe('trade-1');
    expect(db.messages[0].is_signal).toBe(true);
    expect(db.messages[0].signal_type).toBe('prep');
    expect(db.sessions[0]).toEqual(expect.objectContaining({
      trade_count: 1,
      net_pnl_pct: null,
    }));
  });

  it('activates staged trade on filled_avg and appends lifecycle events on trim', async () => {
    const db = new InMemoryDiscordDb();
    const service = new DiscordPersistenceService({
      db: db as any,
      logger: { warn: jest.fn() },
    });

    await service.persistDiscordMessage(buildSignal('prep', { messageId: 'm-prep' }));
    await service.persistDiscordMessage(buildSignal('filled_avg', {
      messageId: 'm-fill',
      createdAt: '2026-03-01T15:05:00.000Z',
      content: 'filled avg 1.23',
      fields: {
        symbol: 'SPX',
        strike: 6000,
        optionType: 'call',
        price: 1.23,
        percent: null,
        level: null,
      },
    }));
    await service.persistDiscordMessage(buildSignal('trim', {
      messageId: 'm-trim',
      createdAt: '2026-03-01T15:10:00.000Z',
      content: 'trim 25%',
      fields: {
        symbol: 'SPX',
        strike: 6000,
        optionType: 'call',
        price: null,
        percent: 25,
        level: null,
      },
    }));

    expect(db.trades).toHaveLength(1);
    expect(db.trades[0]).toEqual(expect.objectContaining({
      id: 'trade-1',
      entry_price: 1.23,
      entry_timestamp: '2026-03-01T15:05:00.000Z',
      fully_exited: false,
    }));
    expect(Array.isArray(db.trades[0].lifecycle_events)).toBe(true);
    expect(db.trades[0].lifecycle_events).toHaveLength(1);
    expect(db.trades[0].lifecycle_events[0]).toEqual(expect.objectContaining({
      type: 'trim',
      percent: 25,
      at: '2026-03-01T15:10:00.000Z',
    }));
    expect(db.messages.find((row) => row.discord_msg_id === 'm-fill')?.parsed_trade_id).toBe('trade-1');
    expect(db.messages.find((row) => row.discord_msg_id === 'm-trim')?.parsed_trade_id).toBe('trade-1');
    expect(db.sessions[0]).toEqual(expect.objectContaining({
      session_start: '2026-03-01T15:00:00.000Z',
      session_end: '2026-03-01T15:10:00.000Z',
      trade_count: 1,
      net_pnl_pct: null,
    }));
  });

  it('implicitly closes ACTIVE trade on new PREP and starts next staged trade', async () => {
    const db = new InMemoryDiscordDb();
    const service = new DiscordPersistenceService({
      db: db as any,
      logger: { warn: jest.fn() },
    });

    await service.persistDiscordMessage(buildSignal('prep', { messageId: 'm1' }));
    await service.persistDiscordMessage(buildSignal('ptf', {
      messageId: 'm2',
      createdAt: '2026-03-01T15:02:00.000Z',
      fields: {
        symbol: 'SPX',
        strike: 6000,
        optionType: 'call',
        price: 1.2,
        percent: null,
        level: null,
      },
    }));
    const result = await service.persistDiscordMessage(buildSignal('prep', {
      messageId: 'm3',
      createdAt: '2026-03-01T15:20:00.000Z',
      content: 'prep SPX 6010c @ 1.05',
      fields: {
        symbol: 'SPX',
        strike: 6010,
        optionType: 'call',
        price: 1.05,
        percent: null,
        level: null,
      },
    }));

    expect(result.parsedTradeId).toBe('trade-2');
    expect(db.trades).toHaveLength(2);
    expect(db.trades[0]).toEqual(expect.objectContaining({
      id: 'trade-1',
      trade_index: 1,
      fully_exited: true,
      exit_timestamp: '2026-03-01T15:20:00.000Z',
    }));
    expect(db.trades[1]).toEqual(expect.objectContaining({
      id: 'trade-2',
      trade_index: 2,
      strike: 6010,
      fully_exited: false,
      entry_timestamp: null,
    }));
    expect(db.messages.find((row) => row.discord_msg_id === 'm3')?.parsed_trade_id).toBe('trade-2');
    expect(db.sessions[0]).toEqual(expect.objectContaining({
      trade_count: 2,
      session_start: '2026-03-01T15:00:00.000Z',
      session_end: '2026-03-01T15:20:00.000Z',
      net_pnl_pct: null,
    }));
  });

  it('maintains rollups across PREP/FILL/TRIM/EXIT flow and sums parseable closed-trade pnl', async () => {
    const db = new InMemoryDiscordDb();
    const service = new DiscordPersistenceService({
      db: db as any,
      logger: { warn: jest.fn() },
    });

    await service.persistDiscordMessage(buildSignal('prep', { messageId: 'm-prep-1' }));
    await service.persistDiscordMessage(buildSignal('filled_avg', {
      messageId: 'm-fill-1',
      createdAt: '2026-03-01T15:02:00.000Z',
      content: 'filled avg 1.21',
      fields: {
        symbol: 'SPX',
        strike: 6000,
        optionType: 'call',
        price: 1.21,
        percent: null,
        level: null,
      },
    }));
    await service.persistDiscordMessage(buildSignal('trim', {
      messageId: 'm-trim-1',
      createdAt: '2026-03-01T15:05:00.000Z',
      content: 'trim 20%',
      fields: {
        symbol: 'SPX',
        strike: 6000,
        optionType: 'call',
        price: null,
        percent: 20,
        level: null,
      },
    }));
    await service.persistDiscordMessage(buildSignal('fully_out', {
      messageId: 'm-exit-1',
      createdAt: '2026-03-01T15:15:00.000Z',
      content: 'fully out +15%',
      fields: {
        symbol: 'SPX',
        strike: 6000,
        optionType: 'call',
        price: null,
        percent: 15,
        level: null,
      },
    }));

    await service.persistDiscordMessage(buildSignal('prep', {
      messageId: 'm-prep-2',
      createdAt: '2026-03-01T15:30:00.000Z',
      content: 'prep SPX 6010c @ 1.05',
      fields: {
        symbol: 'SPX',
        strike: 6010,
        optionType: 'call',
        price: 1.05,
        percent: null,
        level: null,
      },
    }));
    await service.persistDiscordMessage(buildSignal('ptf', {
      messageId: 'm-fill-2',
      createdAt: '2026-03-01T15:32:00.000Z',
      content: 'ptf 1.10',
      fields: {
        symbol: 'SPX',
        strike: 6010,
        optionType: 'call',
        price: 1.1,
        percent: null,
        level: null,
      },
    }));
    await service.persistDiscordMessage(buildSignal('fully_out', {
      messageId: 'm-exit-2',
      createdAt: '2026-03-01T15:40:00.000Z',
      content: 'fully out -5.5%',
      fields: {
        symbol: 'SPX',
        strike: 6010,
        optionType: 'call',
        price: null,
        percent: -5.5,
        level: null,
      },
    }));

    expect(db.sessions[0]).toEqual(expect.objectContaining({
      session_start: '2026-03-01T15:00:00.000Z',
      session_end: '2026-03-01T15:40:00.000Z',
      trade_count: 2,
      net_pnl_pct: 9.5,
    }));
  });

  it('keeps net_pnl_pct null-safe when exits omit parseable percent values', async () => {
    const db = new InMemoryDiscordDb();
    const service = new DiscordPersistenceService({
      db: db as any,
      logger: { warn: jest.fn() },
    });

    await service.persistDiscordMessage(buildSignal('prep', { messageId: 't1-prep' }));
    await service.persistDiscordMessage(buildSignal('ptf', {
      messageId: 't1-fill',
      createdAt: '2026-03-01T15:02:00.000Z',
      fields: {
        symbol: 'SPX',
        strike: 6000,
        optionType: 'call',
        price: 1.2,
        percent: null,
        level: null,
      },
    }));
    await service.persistDiscordMessage(buildSignal('fully_out', {
      messageId: 't1-exit',
      createdAt: '2026-03-01T15:10:00.000Z',
      content: 'fully out',
      fields: {
        symbol: 'SPX',
        strike: 6000,
        optionType: 'call',
        price: null,
        percent: null,
        level: null,
      },
    }));

    await service.persistDiscordMessage(buildSignal('prep', {
      messageId: 't2-prep',
      createdAt: '2026-03-01T15:20:00.000Z',
      fields: {
        symbol: 'SPX',
        strike: 6010,
        optionType: 'call',
        price: 1.05,
        percent: null,
        level: null,
      },
    }));
    await service.persistDiscordMessage(buildSignal('filled_avg', {
      messageId: 't2-fill',
      createdAt: '2026-03-01T15:21:00.000Z',
      fields: {
        symbol: 'SPX',
        strike: 6010,
        optionType: 'call',
        price: 1.07,
        percent: null,
        level: null,
      },
    }));
    await service.persistDiscordMessage(buildSignal('exit_above', {
      messageId: 't2-exit',
      createdAt: '2026-03-01T15:28:00.000Z',
      content: 'exit above +8%',
      fields: {
        symbol: 'SPX',
        strike: 6010,
        optionType: 'call',
        price: null,
        percent: 8,
        level: null,
      },
    }));

    expect(db.sessions[0]).toEqual(expect.objectContaining({
      trade_count: 2,
      net_pnl_pct: 8,
      session_start: '2026-03-01T15:00:00.000Z',
      session_end: '2026-03-01T15:28:00.000Z',
    }));
  });

  it('upserts discord_messages idempotently by discord_msg_id', async () => {
    const db = new InMemoryDiscordDb();
    const service = new DiscordPersistenceService({
      db: db as any,
      logger: { warn: jest.fn() },
    });
    const message = buildSignal('commentary', {
      messageId: 'same-id',
      content: 'watching price action',
    });

    await service.persistDiscordMessage(message);
    await service.persistDiscordMessage(message);

    expect(db.messages).toHaveLength(1);
    expect(db.messages[0]).toEqual(expect.objectContaining({
      discord_msg_id: 'same-id',
      is_signal: false,
      signal_type: 'commentary',
      parsed_trade_id: null,
    }));
  });

  it('keeps pipeline fail-open when persistence throws and still broadcasts parsed signal', async () => {
    const signal = buildSignal('trim');
    const warn = jest.fn();
    const persistDiscordMessage = jest.fn(async () => {
      throw new Error('db unavailable');
    });
    const broadcast = jest.fn(async () => undefined);

    await expect(
      persistThenBroadcastDiscordSignal(signal, {
        persistence: { persistDiscordMessage },
        broadcaster: { broadcast },
        logger: { warn },
      }),
    ).resolves.toBeUndefined();

    expect(persistDiscordMessage).toHaveBeenCalledWith(signal);
    expect(warn).toHaveBeenCalledWith(
      'Discord persistence failed; continuing fail-open',
      expect.objectContaining({
        error: 'db unavailable',
        messageId: 'msg-1',
        channelId: 'channel-1',
        guildId: 'guild-1',
      }),
    );
    expect(broadcast).toHaveBeenCalledWith(signal);
  });
});
