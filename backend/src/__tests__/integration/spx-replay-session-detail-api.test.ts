import request from 'supertest';
import express from 'express';
import { describeWithSockets } from '../../testUtils/socketDescribe';

const mockAuthenticateToken = jest.fn();
const mockHasBackendAdminAccess = jest.fn();

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (...args: unknown[]) => mockAuthenticateToken(...args),
  checkQueryLimit: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/requireTier', () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../lib/adminAccess', () => ({
  hasBackendAdminAccess: (...args: unknown[]) => mockHasBackendAdminAccess(...args),
}));

jest.mock('../../services/spx/levelEngine', () => ({ getMergedLevels: jest.fn() }));
jest.mock('../../services/spx/gexEngine', () => ({ computeUnifiedGEXLandscape: jest.fn() }));
jest.mock('../../services/spx/setupDetector', () => ({
  detectActiveSetups: jest.fn(),
  getLatestSetupEnvironmentState: jest.fn(),
  getSetupById: jest.fn(),
}));
jest.mock('../../services/spx/fibEngine', () => ({ getFibLevels: jest.fn() }));
jest.mock('../../services/spx/flowEngine', () => ({ getFlowEvents: jest.fn() }));
jest.mock('../../services/spx/regimeClassifier', () => ({ classifyCurrentRegime: jest.fn() }));
jest.mock('../../services/spx/aiPredictor', () => ({ getPredictionState: jest.fn() }));
jest.mock('../../services/spx/crossReference', () => ({ getBasisState: jest.fn() }));
jest.mock('../../services/spx/contractSelector', () => ({ getContractRecommendation: jest.fn() }));
jest.mock('../../services/spx/outcomeTracker', () => ({ getSPXWinRateAnalytics: jest.fn() }));
jest.mock('../../services/spx/winRateBacktest', () => ({ runSPXWinRateBacktest: jest.fn() }));
jest.mock('../../services/spx/optimizer', () => ({
  getActiveSPXOptimizationProfile: jest.fn(),
  getSPXOptimizerScorecard: jest.fn(),
  runSPXOptimizerScan: jest.fn(),
  revertSPXOptimizationProfile: jest.fn(),
}));
jest.mock('../../workers/spxOptimizerWorker', () => ({ getSPXOptimizerWorkerStatus: jest.fn() }));
jest.mock('../../services/spx/aiCoach', () => ({ getCoachState: jest.fn(), generateCoachStream: jest.fn() }));
jest.mock('../../services/spx/coachDecisionEngine', () => ({ generateCoachDecision: jest.fn() }));
jest.mock('../../services/spx', () => ({ getSPXSnapshot: jest.fn() }));

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn(),
  },
}));
jest.mock('../../config/massive', () => ({
  getMinuteAggregates: jest.fn(),
  getDailyAggregates: jest.fn(),
}));

import spxRouter from '../../routes/spx';
import { supabase } from '../../config/database';
import { getDailyAggregates, getMinuteAggregates } from '../../config/massive';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockGetMinuteAggregates = getMinuteAggregates as jest.MockedFunction<typeof getMinuteAggregates>;
const mockGetDailyAggregates = getDailyAggregates as jest.MockedFunction<typeof getDailyAggregates>;

const app = express();
app.use(express.json());
app.use('/api/spx', spxRouter);

const VALID_SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createSessionLookupBuilder(result: { data: Record<string, unknown> | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function createSnapshotLookupBuilder(result: { data: Record<string, unknown>[] | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function createTradesLookupBuilder(result: { data: Record<string, unknown>[] | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function createMessagesLookupBuilder(result: { data: Record<string, unknown>[] | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

describeWithSockets('SPX replay session detail API integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateToken.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { id: 'integration-user-1' };
      next();
    });
    mockHasBackendAdminAccess.mockResolvedValue(true);
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Unexpected supabase.from call');
    });
    mockGetMinuteAggregates.mockResolvedValue([]);
    mockGetDailyAggregates.mockResolvedValue([]);
  });

  it('returns 400 when sessionId is not a UUID', async () => {
    const res = await request(app).get('/api/spx/replay-sessions/not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(mockHasBackendAdminAccess).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 403 for authenticated non-admin users', async () => {
    mockHasBackendAdminAccess.mockResolvedValue(false);

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(mockHasBackendAdminAccess).toHaveBeenCalledWith('integration-user-1');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 404 when session id does not exist', async () => {
    const sessionBuilder = createSessionLookupBuilder({ data: null, error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(sessionBuilder.eq).toHaveBeenCalledWith('id', VALID_SESSION_ID);
  });

  it('returns 200 with deterministic ordering across snapshots, trades, and messages', async () => {
    const sessionDate = '2026-02-27';
    const sessionBuilder = createSessionLookupBuilder({
      data: {
        id: VALID_SESSION_ID,
        session_date: sessionDate,
        channel_id: 'channel-123',
        channel_name: 'SPX Premium',
        caller_name: 'Nate',
        trade_count: 2,
        net_pnl_pct: '3.4',
        session_start: '2026-02-27T14:30:00.000Z',
        session_end: '2026-02-27T19:00:00.000Z',
        session_summary: 'Strong trend day.',
      },
      error: null,
    });
    const snapshots = [
      { id: 'snap-1', session_date: sessionDate, symbol: 'SPX', captured_at: '2026-02-27T14:30:00.000Z' },
      { id: 'snap-2', session_date: sessionDate, symbol: 'SPX', captured_at: '2026-02-27T14:31:00.000Z' },
    ];
    const trades = [
      {
        id: 'trade-1',
        trade_index: 1,
        symbol: 'SPX',
        strike: 6030,
        contract_type: 'call',
        expiry: '2026-03-01',
        direction: 'long',
        entry_price: 1.25,
        entry_timestamp: '2026-02-27T14:35:00.000Z',
        sizing: 'starter',
        initial_stop: 0.85,
        target_1: 1.8,
        target_2: 2.4,
        thesis_text: 'Breakout.',
        entry_condition: 'Hold above range.',
        lifecycle_events: [{ type: 'trim', pct: 50 }],
        final_pnl_pct: 32.5,
        is_winner: true,
        fully_exited: true,
        exit_timestamp: '2026-02-27T15:10:00.000Z',
        entry_snapshot_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      {
        id: 'trade-2',
        trade_index: 2,
        symbol: 'SPX',
        strike: 6040,
        contract_type: 'call',
        expiry: '2026-03-01',
        direction: 'long',
        entry_price: 0.95,
        entry_timestamp: '2026-02-27T15:20:00.000Z',
        sizing: 'add',
        initial_stop: 0.65,
        target_1: 1.35,
        target_2: 1.9,
        thesis_text: 'Continuation.',
        entry_condition: 'Reclaim VWAP.',
        lifecycle_events: [{ type: 'stop' }],
        final_pnl_pct: -18.2,
        is_winner: false,
        fully_exited: true,
        exit_timestamp: '2026-02-27T15:42:00.000Z',
        entry_snapshot_id: null,
      },
    ];
    const messages = [
      {
        id: 'msg-1',
        discord_msg_id: '111',
        author_name: 'Nate',
        author_id: 'caller-1',
        content: 'Prep SPX calls',
        sent_at: '2026-02-27T14:29:00.000Z',
        is_signal: true,
        signal_type: 'prep',
        parsed_trade_id: null,
        created_at: '2026-02-27T14:29:01.000Z',
      },
      {
        id: 'msg-2',
        discord_msg_id: '222',
        author_name: 'Nate',
        author_id: 'caller-1',
        content: 'Trim 50%',
        sent_at: '2026-02-27T14:45:00.000Z',
        is_signal: true,
        signal_type: 'trim',
        parsed_trade_id: 'trade-1',
        created_at: '2026-02-27T14:45:01.000Z',
      },
    ];
    mockGetMinuteAggregates.mockResolvedValue([
      {
        t: Date.parse('2026-02-27T14:31:00.000Z'),
        o: 6011,
        h: 6014,
        l: 6009,
        c: 6013,
        v: 180,
      },
      {
        t: Date.parse('2026-02-27T14:30:00.000Z'),
        o: 6010,
        h: 6012,
        l: 6008,
        c: 6011,
        v: 150,
      },
    ] as any[]);
    mockGetDailyAggregates.mockResolvedValue([
      {
        t: Date.parse('2026-02-26T00:00:00.000Z'),
        o: 5982,
        h: 6020,
        l: 5968,
        c: 6007,
        v: 1000,
      },
    ] as any[]);

    const snapshotsBuilder = createSnapshotLookupBuilder({ data: snapshots as any[], error: null });
    const tradesBuilder = createTradesLookupBuilder({ data: trades as any[], error: null });
    const messagesBuilder = createMessagesLookupBuilder({ data: messages as any[], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'replay_snapshots') return snapshotsBuilder;
      if (table === 'discord_parsed_trades') return tradesBuilder;
      if (table === 'discord_messages') return messagesBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe(VALID_SESSION_ID);
    expect(res.body.sessionDate).toBe(sessionDate);
    expect(res.body.symbol).toBe('SPX');
    expect(res.body.session).toEqual({
      channel: { id: 'channel-123', name: 'SPX Premium' },
      caller: 'Nate',
      tradeCount: 2,
      netPnlPct: 3.4,
      sessionStart: '2026-02-27T14:30:00.000Z',
      sessionEnd: '2026-02-27T19:00:00.000Z',
      sessionSummary: 'Strong trend day.',
    });
    expect(res.body.counts).toEqual({ snapshots: 2, trades: 2, messages: 2 });
    expect(res.body.snapshots.map((row: { id: string }) => row.id)).toEqual(['snap-1', 'snap-2']);
    expect(res.body.trades.map((row: { tradeIndex: number }) => row.tradeIndex)).toEqual([1, 2]);
    expect(res.body.messages.map((row: { sentAt: string }) => row.sentAt)).toEqual([
      '2026-02-27T14:29:00.000Z',
      '2026-02-27T14:45:00.000Z',
    ]);
    expect(res.body.bars).toEqual([
      {
        time: Math.floor(Date.parse('2026-02-27T14:30:00.000Z') / 1000),
        open: 6010,
        high: 6012,
        low: 6008,
        close: 6011,
        volume: 150,
      },
      {
        time: Math.floor(Date.parse('2026-02-27T14:31:00.000Z') / 1000),
        open: 6011,
        high: 6014,
        low: 6009,
        close: 6013,
        volume: 180,
      },
    ]);
    expect(res.body.priorDayBar).toEqual({ high: 6020, low: 5968 });

    expect(snapshotsBuilder.eq).toHaveBeenNthCalledWith(1, 'session_date', sessionDate);
    expect(snapshotsBuilder.eq).toHaveBeenNthCalledWith(2, 'symbol', 'SPX');
    expect(snapshotsBuilder.order).toHaveBeenCalledWith('captured_at', { ascending: true });

    expect(tradesBuilder.eq).toHaveBeenNthCalledWith(1, 'session_id', VALID_SESSION_ID);
    expect(tradesBuilder.eq).toHaveBeenNthCalledWith(2, 'symbol', 'SPX');
    expect(tradesBuilder.order).toHaveBeenCalledWith('trade_index', { ascending: true });

    expect(messagesBuilder.eq).toHaveBeenCalledWith('session_id', VALID_SESSION_ID);
    expect(messagesBuilder.order).toHaveBeenCalledWith('sent_at', { ascending: true });
    expect(mockGetMinuteAggregates).toHaveBeenCalledWith('I:SPX', sessionDate);
    expect(mockGetDailyAggregates).toHaveBeenCalledWith('I:SPX', '2026-02-26', '2026-02-26');
  });

  it('returns 200 with symbol filter applied to snapshots/trades while messages remain session-scoped', async () => {
    const sessionDate = '2026-02-27';
    const sessionBuilder = createSessionLookupBuilder({
      data: {
        id: VALID_SESSION_ID,
        session_date: sessionDate,
        channel_id: 'channel-123',
        channel_name: 'SPX Premium',
        caller_name: 'Nate',
        trade_count: 1,
        net_pnl_pct: 1.2,
        session_start: '2026-02-27T14:30:00.000Z',
        session_end: '2026-02-27T16:00:00.000Z',
        session_summary: null,
      },
      error: null,
    });
    const snapshotsBuilder = createSnapshotLookupBuilder({
      data: [{ id: 'snap-ndx', session_date: sessionDate, symbol: 'NDX', captured_at: '2026-02-27T14:30:00.000Z' }],
      error: null,
    });
    const tradesBuilder = createTradesLookupBuilder({
      data: [{
        id: 'trade-ndx',
        trade_index: 1,
        symbol: 'NDX',
        strike: 21000,
        contract_type: 'call',
        expiry: '2026-03-01',
        direction: 'long',
        entry_price: 2.1,
        entry_timestamp: '2026-02-27T14:40:00.000Z',
        sizing: 'starter',
        initial_stop: 1.6,
        target_1: 2.8,
        target_2: 3.4,
        thesis_text: 'NDX breakout.',
        entry_condition: 'Hold reclaim.',
        lifecycle_events: [],
        final_pnl_pct: null,
        is_winner: null,
        fully_exited: false,
        exit_timestamp: null,
        entry_snapshot_id: null,
      }],
      error: null,
    });
    const messagesBuilder = createMessagesLookupBuilder({
      data: [
        {
          id: 'msg-1',
          discord_msg_id: '111',
          author_name: 'Nate',
          author_id: 'caller-1',
          content: 'NDX prep',
          sent_at: '2026-02-27T14:39:00.000Z',
          is_signal: true,
          signal_type: 'prep',
          parsed_trade_id: null,
          created_at: '2026-02-27T14:39:01.000Z',
        },
        {
          id: 'msg-2',
          discord_msg_id: '222',
          author_name: 'Nate',
          author_id: 'caller-1',
          content: 'NDX fill',
          sent_at: '2026-02-27T14:41:00.000Z',
          is_signal: true,
          signal_type: 'filled_avg',
          parsed_trade_id: 'trade-ndx',
          created_at: '2026-02-27T14:41:01.000Z',
        },
      ],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'replay_snapshots') return snapshotsBuilder;
      if (table === 'discord_parsed_trades') return tradesBuilder;
      if (table === 'discord_messages') return messagesBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}?symbol=ndx`);

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe('NDX');
    expect(res.body.counts).toEqual({ snapshots: 1, trades: 1, messages: 2 });
    expect(snapshotsBuilder.eq).toHaveBeenNthCalledWith(2, 'symbol', 'NDX');
    expect(tradesBuilder.eq).toHaveBeenNthCalledWith(2, 'symbol', 'NDX');
    expect(messagesBuilder.eq).toHaveBeenCalledTimes(1);
    expect(messagesBuilder.eq).toHaveBeenCalledWith('session_id', VALID_SESSION_ID);
    expect(mockGetMinuteAggregates).toHaveBeenCalledWith('I:NDX', sessionDate);
    expect(mockGetDailyAggregates).toHaveBeenCalledWith('I:NDX', '2026-02-26', '2026-02-26');
  });

  it('returns 200 with empty arrays and zero counts for existing session with no data', async () => {
    const sessionDate = '2026-02-27';
    const sessionBuilder = createSessionLookupBuilder({
      data: {
        id: VALID_SESSION_ID,
        session_date: sessionDate,
        channel_id: 'channel-123',
        channel_name: 'SPX Premium',
        caller_name: 'Nate',
        trade_count: 0,
        net_pnl_pct: null,
        session_start: null,
        session_end: null,
        session_summary: null,
      },
      error: null,
    });
    const snapshotsBuilder = createSnapshotLookupBuilder({ data: [], error: null });
    const tradesBuilder = createTradesLookupBuilder({ data: [], error: null });
    const messagesBuilder = createMessagesLookupBuilder({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'replay_snapshots') return snapshotsBuilder;
      if (table === 'discord_parsed_trades') return tradesBuilder;
      if (table === 'discord_messages') return messagesBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sessionId: VALID_SESSION_ID,
      sessionDate,
      symbol: 'SPX',
      session: {
        channel: { id: 'channel-123', name: 'SPX Premium' },
        caller: 'Nate',
        tradeCount: 0,
        netPnlPct: null,
        sessionStart: null,
        sessionEnd: null,
        sessionSummary: null,
      },
      snapshots: [],
      trades: [],
      messages: [],
      bars: [],
      priorDayBar: null,
      counts: {
        snapshots: 0,
        trades: 0,
        messages: 0,
      },
    });
  });

  it('returns 200 with bars/priorDayBar fail-open defaults when market enrichment throws', async () => {
    const sessionDate = '2026-02-27';
    const sessionBuilder = createSessionLookupBuilder({
      data: {
        id: VALID_SESSION_ID,
        session_date: sessionDate,
        channel_id: 'channel-123',
        channel_name: 'SPX Premium',
        caller_name: 'Nate',
        trade_count: 1,
        net_pnl_pct: 2.1,
        session_start: '2026-02-27T14:30:00.000Z',
        session_end: '2026-02-27T15:30:00.000Z',
        session_summary: 'Fail-open test',
      },
      error: null,
    });
    const snapshotsBuilder = createSnapshotLookupBuilder({
      data: [{ id: 'snap-1', session_date: sessionDate, symbol: 'SPX', captured_at: '2026-02-27T14:30:00.000Z' }],
      error: null,
    });
    const tradesBuilder = createTradesLookupBuilder({
      data: [{
        id: 'trade-1',
        trade_index: 1,
        symbol: 'SPX',
        strike: 6010,
        contract_type: 'call',
        expiry: '2026-03-01',
        direction: 'long',
        entry_price: 1.05,
        entry_timestamp: '2026-02-27T14:35:00.000Z',
        sizing: 'starter',
        initial_stop: 0.8,
        target_1: 1.4,
        target_2: 1.8,
        thesis_text: 'Breakout',
        entry_condition: 'Range break',
        lifecycle_events: [],
        final_pnl_pct: 21.5,
        is_winner: true,
        fully_exited: true,
        exit_timestamp: '2026-02-27T15:10:00.000Z',
        entry_snapshot_id: null,
      }],
      error: null,
    });
    const messagesBuilder = createMessagesLookupBuilder({
      data: [{
        id: 'msg-1',
        discord_msg_id: 'm1',
        author_name: 'Nate',
        author_id: 'caller-1',
        content: 'Prep',
        sent_at: '2026-02-27T14:34:00.000Z',
        is_signal: true,
        signal_type: 'prep',
        parsed_trade_id: null,
        created_at: '2026-02-27T14:34:01.000Z',
      }],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'replay_snapshots') return snapshotsBuilder;
      if (table === 'discord_parsed_trades') return tradesBuilder;
      if (table === 'discord_messages') return messagesBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });
    mockGetMinuteAggregates.mockRejectedValue(new Error('Massive minute fetch failed'));

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ snapshots: 1, trades: 1, messages: 1 });
    expect(res.body.bars).toEqual([]);
    expect(res.body.priorDayBar).toBeNull();
    expect(res.body.snapshots).toHaveLength(1);
    expect(res.body.trades).toHaveLength(1);
    expect(res.body.messages).toHaveLength(1);
  });
});
