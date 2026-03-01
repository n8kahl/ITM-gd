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

const VALID_SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createSessionLookupBuilder(result: { data: Record<string, unknown> | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue(result),
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

describeWithSockets('SPX replay session trades API integration', () => {
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

  it('returns 400 when sessionId is not a UUID', async () => {
    const res = await request(app).get('/api/spx/replay-sessions/not-a-uuid/trades');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(mockHasBackendAdminAccess).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 403 for authenticated non-admin users', async () => {
    mockHasBackendAdminAccess.mockResolvedValue(false);

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}/trades`);

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

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}/trades`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(sessionBuilder.eq).toHaveBeenCalledWith('id', VALID_SESSION_ID);
  });

  it('returns 200 with sorted trade order and replay drill-down fields', async () => {
    const sessionDate = '2026-02-27';
    const sessionBuilder = createSessionLookupBuilder({
      data: { id: VALID_SESSION_ID, session_date: sessionDate },
      error: null,
    });
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
        thesis_text: 'Breakout over opening range high.',
        entry_condition: 'Hold above 6028.',
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
        thesis_text: 'Momentum continuation.',
        entry_condition: 'Reclaim VWAP.',
        lifecycle_events: [{ type: 'stop' }],
        final_pnl_pct: -18.2,
        is_winner: false,
        fully_exited: true,
        exit_timestamp: '2026-02-27T15:42:00.000Z',
        entry_snapshot_id: null,
      },
    ];
    const tradesBuilder = createTradesLookupBuilder({ data: trades as any[], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'discord_parsed_trades') return tradesBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}/trades`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sessionId: VALID_SESSION_ID,
      sessionDate,
      symbol: null,
      trades: [
        {
          id: 'trade-1',
          tradeIndex: 1,
          contract: {
            symbol: 'SPX',
            strike: 6030,
            type: 'call',
            expiry: '2026-03-01',
          },
          entry: {
            direction: 'long',
            price: 1.25,
            timestamp: '2026-02-27T14:35:00.000Z',
            sizing: 'starter',
          },
          stop: { initial: 0.85 },
          targets: { target1: 1.8, target2: 2.4 },
          thesis: {
            text: 'Breakout over opening range high.',
            entryCondition: 'Hold above 6028.',
          },
          lifecycle: {
            events: [{ type: 'trim', pct: 50 }],
          },
          outcome: {
            finalPnlPct: 32.5,
            isWinner: true,
            fullyExited: true,
            exitTimestamp: '2026-02-27T15:10:00.000Z',
          },
          entrySnapshotId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        },
        {
          id: 'trade-2',
          tradeIndex: 2,
          contract: {
            symbol: 'SPX',
            strike: 6040,
            type: 'call',
            expiry: '2026-03-01',
          },
          entry: {
            direction: 'long',
            price: 0.95,
            timestamp: '2026-02-27T15:20:00.000Z',
            sizing: 'add',
          },
          stop: { initial: 0.65 },
          targets: { target1: 1.35, target2: 1.9 },
          thesis: {
            text: 'Momentum continuation.',
            entryCondition: 'Reclaim VWAP.',
          },
          lifecycle: {
            events: [{ type: 'stop' }],
          },
          outcome: {
            finalPnlPct: -18.2,
            isWinner: false,
            fullyExited: true,
            exitTimestamp: '2026-02-27T15:42:00.000Z',
          },
          entrySnapshotId: null,
        },
      ],
      count: 2,
    });
    expect(tradesBuilder.eq).toHaveBeenNthCalledWith(1, 'session_id', VALID_SESSION_ID);
    expect(tradesBuilder.order).toHaveBeenCalledWith('trade_index', { ascending: true });
  });

  it('returns 200 with symbol-filtered trades (uppercase normalization)', async () => {
    const sessionDate = '2026-02-27';
    const sessionBuilder = createSessionLookupBuilder({
      data: { id: VALID_SESSION_ID, session_date: sessionDate },
      error: null,
    });
    const tradesBuilder = createTradesLookupBuilder({
      data: [
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
          thesis_text: 'Breakout over opening range high.',
          entry_condition: 'Hold above 6028.',
          lifecycle_events: [],
          final_pnl_pct: 32.5,
          is_winner: true,
          fully_exited: true,
          exit_timestamp: '2026-02-27T15:10:00.000Z',
          entry_snapshot_id: null,
        },
      ] as any[],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'discord_parsed_trades') return tradesBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}/trades?symbol=spx`);

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe('SPX');
    expect(res.body.count).toBe(1);
    expect(tradesBuilder.eq).toHaveBeenNthCalledWith(1, 'session_id', VALID_SESSION_ID);
    expect(tradesBuilder.eq).toHaveBeenNthCalledWith(2, 'symbol', 'SPX');
  });

  it('returns 200 with empty trades when session exists but no matching trades', async () => {
    const sessionDate = '2026-02-27';
    const sessionBuilder = createSessionLookupBuilder({
      data: { id: VALID_SESSION_ID, session_date: sessionDate },
      error: null,
    });
    const tradesBuilder = createTradesLookupBuilder({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'discord_parsed_trades') return tradesBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}/trades?symbol=ndx`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sessionId: VALID_SESSION_ID,
      sessionDate,
      symbol: 'NDX',
      trades: [],
      count: 0,
    });
    expect(tradesBuilder.eq).toHaveBeenNthCalledWith(1, 'session_id', VALID_SESSION_ID);
    expect(tradesBuilder.eq).toHaveBeenNthCalledWith(2, 'symbol', 'NDX');
  });
});
