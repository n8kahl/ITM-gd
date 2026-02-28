import type { Request, Response } from 'express';
import type { Setup } from '../types';

const mockGetSPXSnapshot = jest.fn();

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../config/database', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user' };
    next();
  },
}));

jest.mock('../../../middleware/requireTier', () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../services/spx', () => ({
  getSPXSnapshot: (...args: unknown[]) => mockGetSPXSnapshot(...args),
}));

jest.mock('../../../services/spx/aiPredictor', () => ({
  getPredictionState: jest.fn(),
}));

jest.mock('../../../services/spx/aiCoach', () => ({
  getCoachState: jest.fn(),
  generateCoachStream: jest.fn(),
}));

jest.mock('../../../services/spx/coachDecisionEngine', () => ({
  generateCoachDecision: jest.fn(),
}));

jest.mock('../../../services/spx/contractSelector', () => ({
  getContractRecommendation: jest.fn(),
}));

jest.mock('../../../services/spx/crossReference', () => ({
  getBasisState: jest.fn(),
}));

jest.mock('../../../services/spx/fibEngine', () => ({
  getFibLevels: jest.fn(),
}));

jest.mock('../../../services/spx/flowEngine', () => ({
  getFlowEvents: jest.fn(),
}));

jest.mock('../../../services/spx/gexEngine', () => ({
  computeUnifiedGEXLandscape: jest.fn(),
}));

jest.mock('../../../services/spx/levelEngine', () => ({
  getMergedLevels: jest.fn(),
}));

jest.mock('../../../services/spx/outcomeTracker', () => ({
  getSPXWinRateAnalytics: jest.fn(),
}));

jest.mock('../../../services/spx/optimizer', () => ({
  getSPXOptimizerScorecard: jest.fn(),
  getActiveSPXOptimizationProfile: jest.fn(),
  runSPXOptimizerScan: jest.fn(),
  revertSPXOptimizationProfile: jest.fn(),
}));

jest.mock('../../../workers/spxOptimizerWorker', () => ({
  getSPXOptimizerWorkerStatus: jest.fn(),
}));

jest.mock('../../../services/spx/winRateBacktest', () => ({
  runSPXWinRateBacktest: jest.fn(),
}));

jest.mock('../../../services/spx/regimeClassifier', () => ({
  classifyCurrentRegime: jest.fn(),
}));

jest.mock('../../../services/spx/setupDetector', () => ({
  detectActiveSetups: jest.fn(),
  getLatestSetupEnvironmentState: jest.fn(),
  getSetupById: jest.fn(),
}));

jest.mock('../../../services/marketHours', () => ({
  toEasternTime: jest.fn(() => ({ dateStr: '2026-02-28' })),
}));

jest.mock('../../../services/broker/tradier/client', () => ({
  TradierClient: jest.fn(),
}));

jest.mock('../../../services/broker/tradier/credentials', () => ({
  decryptTradierAccessToken: jest.fn(),
  isTradierProductionRuntimeEnabled: jest.fn(),
}));

jest.mock('../../../services/broker/tradier/executionEngine', () => ({
  getTradierExecutionRuntimeStatus: jest.fn(),
}));

jest.mock('../../../services/spx/executionStateStore', () => ({
  loadOpenStatesWithOrders: jest.fn(),
  closeAllUserStates: jest.fn(),
}));

import spxRouter from '../../../routes/spx';

let setupSeed = 0;
type RouteTradeStreamSetup = Setup & { etaToTriggerMs?: number; momentPriority?: number };

function createSetup(overrides: Partial<RouteTradeStreamSetup> = {}): RouteTradeStreamSetup {
  const id = overrides.id ?? `setup-${setupSeed++}`;
  return {
    id,
    stableIdHash: overrides.stableIdHash ?? id,
    type: 'fade_at_wall',
    direction: 'bullish',
    entryZone: { low: 6020, high: 6022 },
    stop: 6016,
    target1: { price: 6028, label: 'T1' },
    target2: { price: 6034, label: 'T2' },
    confluenceScore: 4.1,
    confluenceSources: ['flow_confirmation'],
    clusterZone: {
      id: `cluster-${id}`,
      priceLow: 6018,
      priceHigh: 6024,
      clusterScore: 4,
      type: 'defended',
      sources: [],
      testCount: 0,
      lastTestAt: null,
      held: true,
      holdRate: 65,
    },
    regime: 'trending',
    status: 'forming',
    probability: 70,
    recommendedContract: null,
    createdAt: '2026-02-28T14:00:00.000Z',
    triggeredAt: null,
    ...overrides,
  };
}

type RouteHandler = (req: Request, res: Response) => unknown;

function getTradeStreamRouteHandler(): RouteHandler {
  const stack = (spxRouter as unknown as {
    stack: Array<{
      route?: {
        path: string;
        methods: Record<string, boolean>;
        stack: Array<{ handle: RouteHandler }>;
      };
    }>;
  }).stack;

  const layer = stack.find((entry) => entry.route?.path === '/trade-stream' && entry.route.methods.get);
  if (!layer?.route?.stack?.[0]?.handle) {
    throw new Error('GET /trade-stream handler not found on SPX router');
  }

  return layer.route.stack[0].handle;
}

function createMockResponse(): Response {
  const res = {} as Response;
  const status = jest.fn().mockReturnValue(res);
  const json = jest.fn().mockReturnValue(res);
  (res as unknown as { status: unknown }).status = status;
  (res as unknown as { json: unknown }).json = json;
  return res;
}

describe('SPX Trade Stream Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-02-28T14:30:15.000Z'));
    setupSeed = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('GET /api/spx/trade-stream returns deterministic sorted stream contract from snapshot setups', async () => {
    mockGetSPXSnapshot.mockResolvedValue({
      generatedAt: '2026-02-28T14:30:00.000Z',
      setups: [
        createSetup({
          id: 'setup-past-b',
          stableIdHash: 'stable-past-b',
          status: 'expired',
          createdAt: '2026-02-28T14:05:00.000Z',
          statusUpdatedAt: '2026-02-28T14:22:00.000Z',
          probability: 61,
          confluenceScore: 3.7,
          evR: 1.4,
          alignmentScore: 0.62,
          momentPriority: 91,
          type: 'mean_reversion',
        }),
        createSetup({
          id: 'setup-triggered-b',
          stableIdHash: 'stable-triggered-b',
          status: 'triggered',
          triggeredAt: '2026-02-28T14:28:30.000Z',
          probability: 76,
          confluenceScore: 4.7,
          evR: 2.2,
          alignmentScore: 0.84,
          momentPriority: 93,
          direction: 'bearish',
          type: 'breakout_vacuum',
        }),
        createSetup({
          id: 'setup-forming-b',
          stableIdHash: 'stable-forming-b',
          status: 'forming',
          etaToTriggerMs: 420_000,
          probability: 70,
          confluenceScore: 4.2,
          evR: 2,
          alignmentScore: 0.77,
          momentPriority: 84,
        }),
        createSetup({
          id: 'setup-past-a',
          stableIdHash: 'stable-past-a',
          status: 'expired',
          createdAt: '2026-02-28T14:21:00.000Z',
          statusUpdatedAt: '2026-02-28T14:29:55.000Z',
          probability: 69,
          confluenceScore: 4,
          evR: 1.9,
          alignmentScore: 0.79,
          momentPriority: 99,
          direction: 'bearish',
          type: 'breakout_vacuum',
        }),
        createSetup({
          id: 'setup-forming-a',
          stableIdHash: 'stable-forming-a',
          status: 'ready',
          etaToTriggerMs: 180_000,
          probability: 72,
          confluenceScore: 4.3,
          evR: 2.1,
          alignmentScore: 0.81,
          momentPriority: 84,
          type: 'vwap_reclaim',
        }),
        createSetup({
          id: 'setup-triggered-a',
          stableIdHash: 'stable-triggered-a',
          status: 'triggered',
          triggeredAt: '2026-02-28T14:29:35.000Z',
          probability: 78,
          confluenceScore: 4.9,
          evR: 2.4,
          alignmentScore: 0.86,
          momentPriority: 93,
          direction: 'bearish',
          type: 'breakout_vacuum',
        }),
      ],
    } as any);

    const handler = getTradeStreamRouteHandler();
    const req = { query: {} } as unknown as Request;
    const res = createMockResponse();
    await handler(req, res);

    expect(mockGetSPXSnapshot).toHaveBeenCalledWith({ forceRefresh: false });
    expect((res.json as unknown as jest.Mock).mock.calls[0][0].items.map((item: { id: string }) => item.id)).toEqual([
      'setup-forming-a',
      'setup-forming-b',
      'setup-triggered-a',
      'setup-triggered-b',
      'setup-past-a',
      'setup-past-b',
    ]);
    expect((res.json as unknown as jest.Mock).mock.calls[0][0].nowFocusItemId).toBe('setup-past-a');
    expect((res.json as unknown as jest.Mock).mock.calls[0][0].countsByLifecycle).toEqual({
      forming: 2,
      triggered: 2,
      past: 2,
    });
    expect((res.json as unknown as jest.Mock).mock.calls[0][0].feedTrust).toEqual({
      source: 'live',
      generatedAt: '2026-02-28T14:30:00.000Z',
      ageMs: 15_000,
      degraded: false,
      stale: false,
      reason: null,
    });
    expect(typeof (res.json as unknown as jest.Mock).mock.calls[0][0].generatedAt).toBe('string');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 503 with retry hint when snapshot retrieval fails', async () => {
    mockGetSPXSnapshot.mockRejectedValue(new Error('snapshot unavailable'));

    const handler = getTradeStreamRouteHandler();
    const req = { query: {} } as unknown as Request;
    const res = createMockResponse();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect((res.json as unknown as jest.Mock).mock.calls[0][0]).toEqual({
      error: 'Data unavailable',
      message: 'Unable to load SPX expert trade stream.',
      retryAfter: 10,
    });
  });

  it('marks feed trust as stale fallback when snapshot is older than freshness threshold', async () => {
    mockGetSPXSnapshot.mockResolvedValue({
      generatedAt: '2026-02-28T14:29:30.000Z',
      setups: [createSetup({ id: 'stale-setup', status: 'ready', momentPriority: 80 })],
    } as any);

    const handler = getTradeStreamRouteHandler();
    const req = { query: {} } as unknown as Request;
    const res = createMockResponse();
    await handler(req, res);

    expect((res.json as unknown as jest.Mock).mock.calls[0][0].feedTrust).toEqual({
      source: 'fallback',
      generatedAt: '2026-02-28T14:29:30.000Z',
      ageMs: 45_000,
      degraded: true,
      stale: true,
      reason: 'Snapshot age 45000ms exceeds freshness threshold 30000ms.',
    });
  });

  it('uses fail-safe trust block when snapshot timestamp is invalid', async () => {
    mockGetSPXSnapshot.mockResolvedValue({
      generatedAt: 'not-an-iso-timestamp',
      setups: [createSetup({ id: 'invalid-ts-setup' })],
    } as any);

    const handler = getTradeStreamRouteHandler();
    const req = { query: {} } as unknown as Request;
    const res = createMockResponse();
    await handler(req, res);

    expect((res.json as unknown as jest.Mock).mock.calls[0][0].feedTrust).toEqual({
      source: 'unknown',
      generatedAt: 'not-an-iso-timestamp',
      ageMs: 0,
      degraded: true,
      stale: true,
      reason: 'Snapshot freshness timestamp is invalid.',
    });
  });

  it('passes through forceRefresh=true query to snapshot service call', async () => {
    mockGetSPXSnapshot.mockResolvedValue({
      generatedAt: '2026-02-28T14:30:00.000Z',
      setups: [],
    } as any);

    const handler = getTradeStreamRouteHandler();
    const req = { query: { forceRefresh: 'true' } } as unknown as Request;
    const res = createMockResponse();
    await handler(req, res);

    expect(mockGetSPXSnapshot).toHaveBeenCalledWith({ forceRefresh: true });
  });
});
