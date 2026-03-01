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

function createSnapshotLookupBuilder(result: { data: Record<string, unknown>[] | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

describeWithSockets('SPX replay session snapshots API integration', () => {
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
    const res = await request(app).get('/api/spx/replay-sessions/not-a-uuid/snapshots');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(mockHasBackendAdminAccess).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 403 for authenticated non-admin users', async () => {
    mockHasBackendAdminAccess.mockResolvedValue(false);

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}/snapshots`);

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

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}/snapshots`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(sessionBuilder.eq).toHaveBeenCalledWith('id', VALID_SESSION_ID);
  });

  it('returns 200 with sorted snapshots payload', async () => {
    const sessionDate = '2026-02-27';
    const sessionBuilder = createSessionLookupBuilder({
      data: { id: VALID_SESSION_ID, session_date: sessionDate },
      error: null,
    });
    const snapshots = [
      {
        id: 'snap-1',
        session_date: sessionDate,
        symbol: 'SPX',
        captured_at: '2026-02-27T14:30:00.000Z',
      },
      {
        id: 'snap-2',
        session_date: sessionDate,
        symbol: 'SPX',
        captured_at: '2026-02-27T14:31:00.000Z',
      },
    ];
    const snapshotBuilder = createSnapshotLookupBuilder({ data: snapshots as any[], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'replay_snapshots') return snapshotBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app).get(`/api/spx/replay-sessions/${VALID_SESSION_ID}/snapshots`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sessionId: VALID_SESSION_ID,
      sessionDate,
      symbol: 'SPX',
      snapshots,
      count: 2,
    });
    expect(snapshotBuilder.eq).toHaveBeenNthCalledWith(1, 'session_date', sessionDate);
    expect(snapshotBuilder.eq).toHaveBeenNthCalledWith(2, 'symbol', 'SPX');
    expect(snapshotBuilder.order).toHaveBeenCalledWith('captured_at', { ascending: true });
  });
});
