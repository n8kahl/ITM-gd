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
const VALID_TRADE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VALID_RESULT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function createSessionLookupBuilder(result: { data: Record<string, unknown> | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function createTradeLookupBuilder(result: { data: Record<string, unknown> | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function createHistoryLookupBuilder(result: { data: Record<string, unknown>[] | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function createInLookupBuilder(result: { data: Record<string, unknown>[] | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    in: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

describeWithSockets('SPX drill results API integration', () => {
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

  it('returns 400 on invalid POST sessionId UUID', async () => {
    const res = await request(app)
      .post('/api/spx/drill-results')
      .send({
        sessionId: 'not-a-uuid',
        decisionAt: '2026-03-01T15:00:00.000Z',
        direction: 'long',
        strike: 6030,
        stopLevel: 6025,
        targetLevel: 6040,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 403 for non-admin POST requests', async () => {
    mockHasBackendAdminAccess.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/spx/drill-results')
      .send({
        sessionId: VALID_SESSION_ID,
        decisionAt: '2026-03-01T15:00:00.000Z',
        direction: 'long',
        strike: 6030,
        stopLevel: 6025,
        targetLevel: 6040,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(mockHasBackendAdminAccess).toHaveBeenCalledWith('integration-user-1');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 201 and persists deterministic score fields on POST', async () => {
    const sessionBuilder = createSessionLookupBuilder({
      data: { id: VALID_SESSION_ID },
      error: null,
    });
    const tradeBuilder = createTradeLookupBuilder({
      data: {
        id: VALID_TRADE_ID,
        session_id: VALID_SESSION_ID,
        direction: 'long',
        final_pnl_pct: 18.4,
      },
      error: null,
    });

    let insertedPayload: Record<string, unknown> | null = null;
    const insertBuilder: any = {
      insert: jest.fn((payload: Record<string, unknown>) => {
        insertedPayload = payload;
        return insertBuilder;
      }),
      select: jest.fn(() => insertBuilder),
      maybeSingle: jest.fn().mockImplementation(async () => ({
        data: {
          id: VALID_RESULT_ID,
          ...(insertedPayload || {}),
          created_at: '2026-03-01T15:10:00.000Z',
        },
        error: null,
      })),
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'discord_parsed_trades') return tradeBuilder;
      if (table === 'replay_drill_results') return insertBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app)
      .post('/api/spx/drill-results')
      .send({
        sessionId: VALID_SESSION_ID,
        parsedTradeId: VALID_TRADE_ID,
        decisionAt: '2026-03-01T15:00:00.000Z',
        direction: 'long',
        strike: 6030,
        stopLevel: 6025,
        targetLevel: 6040,
      });

    expect(res.status).toBe(201);
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'integration-user-1',
      session_id: VALID_SESSION_ID,
      parsed_trade_id: VALID_TRADE_ID,
      direction: 'long',
      learner_rr: 2,
      learner_pnl_pct: 18.4,
      actual_pnl_pct: 18.4,
      engine_direction: 'bullish',
      direction_match: true,
      score: 100,
    }));
    expect(res.body.result).toEqual(expect.objectContaining({
      id: VALID_RESULT_ID,
      sessionId: VALID_SESSION_ID,
      parsedTradeId: VALID_TRADE_ID,
      direction: 'long',
      learnerRr: 2,
      learnerPnlPct: 18.4,
      actualPnlPct: 18.4,
      engineDirection: 'bullish',
      directionMatch: true,
      score: 100,
    }));
  });

  it('returns 400 when parsedTradeId does not belong to the provided session', async () => {
    const sessionBuilder = createSessionLookupBuilder({
      data: { id: VALID_SESSION_ID },
      error: null,
    });
    const tradeBuilder = createTradeLookupBuilder({
      data: {
        id: VALID_TRADE_ID,
        session_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        direction: 'long',
        final_pnl_pct: 4.1,
      },
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'discord_parsed_trades') return tradeBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app)
      .post('/api/spx/drill-results')
      .send({
        sessionId: VALID_SESSION_ID,
        parsedTradeId: VALID_TRADE_ID,
        decisionAt: '2026-03-01T15:00:00.000Z',
        direction: 'long',
        strike: 6030,
        stopLevel: 6025,
        targetLevel: 6040,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 on invalid history sessionId filter', async () => {
    const res = await request(app).get('/api/spx/drill-results/history?sessionId=bad-uuid');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 200 history rows with deterministic enrichment payloads', async () => {
    const historyBuilder = createHistoryLookupBuilder({
      data: [
        {
          id: VALID_RESULT_ID,
          user_id: 'integration-user-1',
          session_id: VALID_SESSION_ID,
          parsed_trade_id: VALID_TRADE_ID,
          decision_at: '2026-03-01T15:00:00.000Z',
          direction: 'long',
          strike: 6030,
          stop_level: 6025,
          target_level: 6040,
          learner_rr: 2,
          learner_pnl_pct: 18.4,
          actual_pnl_pct: 18.4,
          engine_direction: 'bullish',
          direction_match: true,
          score: 100,
          feedback_summary: 'Strong replay read.',
          created_at: '2026-03-01T15:10:00.000Z',
        },
      ],
      error: null,
    });
    const sessionEnrichmentBuilder = createInLookupBuilder({
      data: [
        {
          id: VALID_SESSION_ID,
          session_date: '2026-03-01',
          channel_name: 'SPX Premium',
          caller_name: 'Nate',
        },
      ],
      error: null,
    });
    const tradeEnrichmentBuilder = createInLookupBuilder({
      data: [
        {
          id: VALID_TRADE_ID,
          symbol: 'SPX',
          trade_index: 3,
        },
      ],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'replay_drill_results') return historyBuilder;
      if (table === 'discord_trade_sessions') return sessionEnrichmentBuilder;
      if (table === 'discord_parsed_trades') return tradeEnrichmentBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app).get('/api/spx/drill-results/history?limit=5');

    expect(res.status).toBe(200);
    expect(historyBuilder.eq).toHaveBeenCalledWith('user_id', 'integration-user-1');
    expect(historyBuilder.order).toHaveBeenCalledWith('decision_at', { ascending: false });
    expect(historyBuilder.limit).toHaveBeenCalledWith(5);
    expect(res.body).toEqual({
      count: 1,
      history: [
        {
          id: VALID_RESULT_ID,
          userId: 'integration-user-1',
          sessionId: VALID_SESSION_ID,
          parsedTradeId: VALID_TRADE_ID,
          decisionAt: '2026-03-01T15:00:00.000Z',
          direction: 'long',
          strike: 6030,
          stopLevel: 6025,
          targetLevel: 6040,
          learnerRr: 2,
          learnerPnlPct: 18.4,
          actualPnlPct: 18.4,
          engineDirection: 'bullish',
          directionMatch: true,
          score: 100,
          feedbackSummary: 'Strong replay read.',
          createdAt: '2026-03-01T15:10:00.000Z',
          session: {
            sessionDate: '2026-03-01',
            channelName: 'SPX Premium',
            caller: 'Nate',
          },
          trade: {
            symbol: 'SPX',
            tradeIndex: 3,
          },
        },
      ],
    });
  });

  it('fails open when history enrichment queries fail', async () => {
    const historyBuilder = createHistoryLookupBuilder({
      data: [
        {
          id: VALID_RESULT_ID,
          user_id: 'integration-user-1',
          session_id: VALID_SESSION_ID,
          parsed_trade_id: VALID_TRADE_ID,
          decision_at: '2026-03-01T15:00:00.000Z',
          direction: 'flat',
          strike: null,
          stop_level: null,
          target_level: null,
          learner_rr: null,
          learner_pnl_pct: 0,
          actual_pnl_pct: 4,
          engine_direction: 'neutral',
          direction_match: true,
          score: 98,
          feedback_summary: 'Good restraint.',
          created_at: '2026-03-01T15:10:00.000Z',
        },
      ],
      error: null,
    });
    const sessionEnrichmentBuilder = createInLookupBuilder({
      data: null,
      error: { message: 'relation missing' },
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'replay_drill_results') return historyBuilder;
      if (table === 'discord_trade_sessions') return sessionEnrichmentBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app).get('/api/spx/drill-results/history');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.history[0].session).toBeNull();
    expect(res.body.history[0].trade).toBeNull();
  });
});
