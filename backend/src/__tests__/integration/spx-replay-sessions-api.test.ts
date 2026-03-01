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

import spxRouter from '../../routes/spx';
import { supabase } from '../../config/database';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const app = express();
app.use(express.json());
app.use('/api/spx', spxRouter);

const VALID_SESSION_ID_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VALID_SESSION_ID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VALID_SESSION_ID_3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function createSessionListBuilder(result: { data: Record<string, unknown>[] | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    order: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function createSymbolFilterBuilder(result: { data: Record<string, unknown>[] | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

describeWithSockets('SPX replay sessions list API integration', () => {
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
  });

  it('returns 400 for invalid date query format', async () => {
    const res = await request(app).get('/api/spx/replay-sessions?from=2026/02/27');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(String(res.body.message)).toContain('"from"');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 400 when from is after to', async () => {
    const res = await request(app).get('/api/spx/replay-sessions?from=2026-02-28&to=2026-02-27');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid date range');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 403 for authenticated non-admin users', async () => {
    mockHasBackendAdminAccess.mockResolvedValue(false);

    const res = await request(app).get('/api/spx/replay-sessions');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(mockHasBackendAdminAccess).toHaveBeenCalledWith('integration-user-1');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 200 with list metadata, count, and sessionId in rows', async () => {
    const sessionBuilder = createSessionListBuilder({
      data: [
        {
          id: VALID_SESSION_ID_1,
          session_date: '2026-02-27',
          channel_id: 'channel-123',
          channel_name: 'SPX Premium',
          caller_name: 'Nate',
          trade_count: 3,
          net_pnl_pct: '4.25',
          session_start: '2026-02-27T14:30:00.000Z',
          session_end: '2026-02-27T19:00:00.000Z',
          session_summary: 'Strong trend continuation day.',
        },
      ],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app)
      .get('/api/spx/replay-sessions?from=2026-02-20&to=2026-02-27&channelId=channel-123');

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({
      from: '2026-02-20',
      to: '2026-02-27',
      channelId: 'channel-123',
      symbol: null,
      defaultWindowDays: 30,
      usedDefaultFrom: false,
      usedDefaultTo: false,
    });
    expect(res.body.count).toBe(1);
    expect(res.body.sessions).toEqual([
      {
        sessionId: VALID_SESSION_ID_1,
        sessionDate: '2026-02-27',
        channel: {
          id: 'channel-123',
          name: 'SPX Premium',
        },
        caller: 'Nate',
        tradeCount: 3,
        netPnlPct: 4.25,
        sessionStart: '2026-02-27T14:30:00.000Z',
        sessionEnd: '2026-02-27T19:00:00.000Z',
        sessionSummary: 'Strong trend continuation day.',
      },
    ]);
    expect(typeof res.body.sessions[0].sessionId).toBe('string');
    expect(sessionBuilder.gte).toHaveBeenCalledWith('session_date', '2026-02-20');
    expect(sessionBuilder.lte).toHaveBeenCalledWith('session_date', '2026-02-27');
    expect(sessionBuilder.eq).toHaveBeenCalledWith('channel_id', 'channel-123');
    expect(sessionBuilder.order).toHaveBeenCalledWith('session_date', { ascending: false });
  });

  it('supports comma-separated multi-channel filtering with a single request', async () => {
    const sessionBuilder = createSessionListBuilder({
      data: [
        {
          id: VALID_SESSION_ID_1,
          session_date: '2026-02-27',
          channel_id: 'channel-123',
          channel_name: 'SPX Premium',
          caller_name: 'Nate',
          trade_count: 2,
          net_pnl_pct: '1.75',
          session_start: '2026-02-27T14:30:00.000Z',
          session_end: '2026-02-27T16:05:00.000Z',
          session_summary: null,
        },
      ],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app)
      .get('/api/spx/replay-sessions?from=2026-02-20&to=2026-02-27&channelId=channel-123,channel-456');

    expect(res.status).toBe(200);
    expect(res.body.meta.channelId).toBe('channel-123,channel-456');
    expect(sessionBuilder.eq).not.toHaveBeenCalled();
    expect(sessionBuilder.in).toHaveBeenCalledWith('channel_id', ['channel-123', 'channel-456']);
    expect(sessionBuilder.order).toHaveBeenCalledWith('session_date', { ascending: false });
  });

  it('surfaces rollup fields deterministically (tradeCount/sessionStart/sessionEnd/netPnlPct)', async () => {
    const sessionBuilder = createSessionListBuilder({
      data: [
        {
          id: VALID_SESSION_ID_1,
          session_date: '2026-02-28',
          channel_id: 'channel-111',
          channel_name: 'SPX A',
          caller_name: 'Caller A',
          trade_count: '1',
          net_pnl_pct: null,
          session_start: '2026-02-28T14:30:00.000Z',
          session_end: '2026-02-28T15:10:00.000Z',
          session_summary: null,
        },
        {
          id: VALID_SESSION_ID_3,
          session_date: '2026-02-27',
          channel_id: 'channel-333',
          channel_name: 'SPX C',
          caller_name: 'Caller C',
          trade_count: 5,
          net_pnl_pct: '-3.25',
          session_start: '2026-02-27T15:00:00.000Z',
          session_end: '2026-02-27T20:00:00.000Z',
          session_summary: 'Trend down session.',
        },
        {
          id: VALID_SESSION_ID_2,
          session_date: '2026-02-28',
          channel_id: 'channel-222',
          channel_name: 'SPX B',
          caller_name: 'Caller B',
          trade_count: 2,
          net_pnl_pct: '4.5',
          session_start: '2026-02-28T14:45:00.000Z',
          session_end: '2026-02-28T16:00:00.000Z',
          session_summary: null,
        },
      ],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app).get('/api/spx/replay-sessions?from=2026-02-27&to=2026-02-28');

    expect(res.status).toBe(200);
    expect(res.body.sessions.map((row: { sessionId: string }) => row.sessionId)).toEqual([
      VALID_SESSION_ID_2,
      VALID_SESSION_ID_1,
      VALID_SESSION_ID_3,
    ]);
    expect(res.body.sessions).toEqual([
      expect.objectContaining({
        sessionId: VALID_SESSION_ID_2,
        tradeCount: 2,
        netPnlPct: 4.5,
        sessionStart: '2026-02-28T14:45:00.000Z',
        sessionEnd: '2026-02-28T16:00:00.000Z',
      }),
      expect.objectContaining({
        sessionId: VALID_SESSION_ID_1,
        tradeCount: 1,
        netPnlPct: null,
        sessionStart: '2026-02-28T14:30:00.000Z',
        sessionEnd: '2026-02-28T15:10:00.000Z',
      }),
      expect.objectContaining({
        sessionId: VALID_SESSION_ID_3,
        tradeCount: 5,
        netPnlPct: -3.25,
        sessionStart: '2026-02-27T15:00:00.000Z',
        sessionEnd: '2026-02-27T20:00:00.000Z',
      }),
    ]);
  });

  it('applies uppercase symbol filter via discord_parsed_trades and limits sessions', async () => {
    const sessionBuilder = createSessionListBuilder({
      data: [
        {
          id: VALID_SESSION_ID_1,
          session_date: '2026-02-27',
          channel_id: 'channel-123',
          channel_name: 'SPX Premium',
          caller_name: 'Nate',
          trade_count: 2,
          net_pnl_pct: 2.1,
          session_start: '2026-02-27T14:30:00.000Z',
          session_end: '2026-02-27T16:00:00.000Z',
          session_summary: null,
        },
        {
          id: VALID_SESSION_ID_2,
          session_date: '2026-02-27',
          channel_id: 'channel-999',
          channel_name: 'SPX Runner',
          caller_name: 'Alex',
          trade_count: 1,
          net_pnl_pct: -1.3,
          session_start: '2026-02-27T15:30:00.000Z',
          session_end: '2026-02-27T17:00:00.000Z',
          session_summary: 'Choppy session.',
        },
      ],
      error: null,
    });
    const symbolBuilder = createSymbolFilterBuilder({
      data: [{ session_id: VALID_SESSION_ID_2 }],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'discord_parsed_trades') return symbolBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app)
      .get('/api/spx/replay-sessions?from=2026-02-20&to=2026-02-27&symbol=spx');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.meta.symbol).toBe('SPX');
    expect(res.body.sessions.map((row: { sessionId: string }) => row.sessionId)).toEqual([VALID_SESSION_ID_2]);
    expect(symbolBuilder.eq).toHaveBeenCalledWith('symbol', 'SPX');
    expect(symbolBuilder.in).toHaveBeenCalledWith('session_id', [VALID_SESSION_ID_1, VALID_SESSION_ID_2]);
  });
});
