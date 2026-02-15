import request from 'supertest';
import express from 'express';
import http from 'http';

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'integration-user-1' };
    next();
  },
  checkQueryLimit: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/requireTier', () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/spx/levelEngine', () => ({
  getMergedLevels: jest.fn(),
}));

jest.mock('../../services/spx/gexEngine', () => ({
  computeUnifiedGEXLandscape: jest.fn(),
}));

jest.mock('../../services/spx/setupDetector', () => ({
  detectActiveSetups: jest.fn(),
  getSetupById: jest.fn(),
}));

jest.mock('../../services/spx/fibEngine', () => ({
  getFibLevels: jest.fn(),
}));

jest.mock('../../services/spx/flowEngine', () => ({
  getFlowEvents: jest.fn(),
}));

jest.mock('../../services/spx/regimeClassifier', () => ({
  classifyCurrentRegime: jest.fn(),
}));

jest.mock('../../services/spx/aiPredictor', () => ({
  getPredictionState: jest.fn(),
}));

jest.mock('../../services/spx/crossReference', () => ({
  getBasisState: jest.fn(),
}));

jest.mock('../../services/spx/contractSelector', () => ({
  getContractRecommendation: jest.fn(),
}));

jest.mock('../../services/spx/aiCoach', () => ({
  getCoachState: jest.fn(),
  generateCoachStream: jest.fn(),
}));

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
  },
}));

import spxRouter from '../../routes/spx';
import { getMergedLevels } from '../../services/spx/levelEngine';
import { computeUnifiedGEXLandscape } from '../../services/spx/gexEngine';
import { detectActiveSetups, getSetupById } from '../../services/spx/setupDetector';
import { getFibLevels } from '../../services/spx/fibEngine';
import { getFlowEvents } from '../../services/spx/flowEngine';
import { classifyCurrentRegime } from '../../services/spx/regimeClassifier';
import { getPredictionState } from '../../services/spx/aiPredictor';
import { getBasisState } from '../../services/spx/crossReference';
import { getContractRecommendation } from '../../services/spx/contractSelector';
import { getCoachState } from '../../services/spx/aiCoach';

const mockGetMergedLevels = getMergedLevels as jest.MockedFunction<typeof getMergedLevels>;
const mockComputeUnifiedGEXLandscape = computeUnifiedGEXLandscape as jest.MockedFunction<typeof computeUnifiedGEXLandscape>;
const mockDetectActiveSetups = detectActiveSetups as jest.MockedFunction<typeof detectActiveSetups>;
const mockGetSetupById = getSetupById as jest.MockedFunction<typeof getSetupById>;
const mockGetFibLevels = getFibLevels as jest.MockedFunction<typeof getFibLevels>;
const mockGetFlowEvents = getFlowEvents as jest.MockedFunction<typeof getFlowEvents>;
const mockClassifyCurrentRegime = classifyCurrentRegime as jest.MockedFunction<typeof classifyCurrentRegime>;
const mockGetPredictionState = getPredictionState as jest.MockedFunction<typeof getPredictionState>;
const mockGetBasisState = getBasisState as jest.MockedFunction<typeof getBasisState>;
const mockGetContractRecommendation = getContractRecommendation as jest.MockedFunction<typeof getContractRecommendation>;
const mockGetCoachState = getCoachState as jest.MockedFunction<typeof getCoachState>;

const app = express();
app.use(express.json());
app.use('/api/spx', spxRouter);
let server: http.Server;
let baseUrl = '';

describe('SPX API integration schema', () => {
  beforeAll(async () => {
    server = await new Promise<http.Server>((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind SPX API integration test server');
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetMergedLevels.mockResolvedValue({ levels: [], clusters: [], generatedAt: '2026-02-15T15:00:00.000Z' });
    mockComputeUnifiedGEXLandscape.mockResolvedValue({
      spx: {
        symbol: 'SPX',
        spotPrice: 6032,
        netGex: 2000,
        flipPoint: 6025,
        callWall: 6050,
        putWall: 6000,
        zeroGamma: 6025,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-15T15:00:00.000Z',
      },
      spy: {
        symbol: 'SPY',
        spotPrice: 603,
        netGex: 1000,
        flipPoint: 602,
        callWall: 604,
        putWall: 600,
        zeroGamma: 602,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-15T15:00:00.000Z',
      },
      combined: {
        symbol: 'COMBINED',
        spotPrice: 6032,
        netGex: 3000,
        flipPoint: 6024,
        callWall: 6050,
        putWall: 6000,
        zeroGamma: 6024,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-15T15:00:00.000Z',
      },
    });

    mockDetectActiveSetups.mockResolvedValue([]);
    mockGetSetupById.mockResolvedValue({
      id: 'setup-1',
      type: 'fade_at_wall',
      direction: 'bullish',
      entryZone: { low: 6010, high: 6012 },
      stop: 6007,
      target1: { price: 6020, label: 'Target 1' },
      target2: { price: 6028, label: 'Target 2' },
      confluenceScore: 4,
      confluenceSources: ['gex_alignment'],
      clusterZone: {
        id: 'cluster-1',
        priceLow: 6010,
        priceHigh: 6012,
        clusterScore: 4,
        type: 'defended',
        sources: [],
        testCount: 1,
        lastTestAt: null,
        held: true,
        holdRate: 60,
      },
      regime: 'ranging',
      status: 'ready',
      probability: 72,
      recommendedContract: null,
      createdAt: '2026-02-15T14:00:00.000Z',
      triggeredAt: null,
    });

    mockGetFibLevels.mockResolvedValue([]);
    mockGetFlowEvents.mockResolvedValue([]);
    mockClassifyCurrentRegime.mockResolvedValue({
      regime: 'ranging',
      direction: 'neutral',
      probability: 60,
      magnitude: 'small',
      confidence: 70,
      timestamp: '2026-02-15T15:00:00.000Z',
    });
    mockGetPredictionState.mockResolvedValue({
      regime: 'ranging',
      direction: { bullish: 34, bearish: 33, neutral: 33 },
      magnitude: { small: 50, medium: 40, large: 10 },
      timingWindow: { description: 'test', actionable: true },
      nextTarget: {
        upside: { price: 6042, zone: 'projected' },
        downside: { price: 6020, zone: 'projected' },
      },
      probabilityCone: [],
      confidence: 70,
    });
    mockGetBasisState.mockResolvedValue({
      current: 1.9,
      trend: 'stable',
      leading: 'neutral',
      ema5: 1.8,
      ema20: 1.7,
      zscore: 0.4,
      spxPrice: 6032,
      spyPrice: 603,
      timestamp: '2026-02-15T15:00:00.000Z',
    });
    mockGetContractRecommendation.mockResolvedValue({
      description: '6030C 2026-03-20',
      strike: 6030,
      expiry: '2026-03-20',
      type: 'call',
      delta: 0.32,
      gamma: 0.02,
      theta: -0.03,
      vega: 0.08,
      bid: 24,
      ask: 24.5,
      riskReward: 2.1,
      expectedPnlAtTarget1: 180,
      expectedPnlAtTarget2: 330,
      maxLoss: 2450,
      reasoning: 'test',
    });
    mockGetCoachState.mockResolvedValue({ messages: [], generatedAt: '2026-02-15T15:00:00.000Z' });
  });

  it('returns expected schemas for SPX endpoints', async () => {
    const levels = await request(baseUrl).get('/api/spx/levels');
    expect(levels.status).toBe(200);
    expect(levels.body).toEqual(expect.objectContaining({ levels: expect.any(Array), generatedAt: expect.any(String) }));

    const clusters = await request(baseUrl).get('/api/spx/clusters');
    expect(clusters.status).toBe(200);
    expect(clusters.body).toEqual(expect.objectContaining({ zones: expect.any(Array), generatedAt: expect.any(String) }));

    const gex = await request(baseUrl).get('/api/spx/gex');
    expect(gex.status).toBe(200);
    expect(gex.body).toEqual(expect.objectContaining({ spx: expect.any(Object), spy: expect.any(Object), combined: expect.any(Object) }));

    const setups = await request(baseUrl).get('/api/spx/setups');
    expect(setups.status).toBe(200);
    expect(setups.body).toEqual(expect.objectContaining({ setups: expect.any(Array), count: expect.any(Number) }));

    const setup = await request(baseUrl).get('/api/spx/setups/setup-1');
    expect(setup.status).toBe(200);
    expect(setup.body).toEqual(expect.objectContaining({ id: 'setup-1', entryZone: expect.any(Object) }));

    const fibonacci = await request(baseUrl).get('/api/spx/fibonacci');
    expect(fibonacci.status).toBe(200);
    expect(fibonacci.body).toEqual(expect.objectContaining({ levels: expect.any(Array), count: expect.any(Number) }));

    const flow = await request(baseUrl).get('/api/spx/flow');
    expect(flow.status).toBe(200);
    expect(flow.body).toEqual(expect.objectContaining({ events: expect.any(Array), count: expect.any(Number) }));

    const regime = await request(baseUrl).get('/api/spx/regime');
    expect(regime.status).toBe(200);
    expect(regime.body).toEqual(expect.objectContaining({ regime: expect.any(String), prediction: expect.any(Object) }));

    const basis = await request(baseUrl).get('/api/spx/basis');
    expect(basis.status).toBe(200);
    expect(basis.body).toEqual(expect.objectContaining({ current: expect.any(Number), trend: expect.any(String) }));

    const contract = await request(baseUrl).get('/api/spx/contract-select?setupId=setup-1');
    expect(contract.status).toBe(200);
    expect(contract.body).toEqual(expect.objectContaining({ strike: expect.any(Number), expiry: expect.any(String) }));

    const coach = await request(baseUrl).get('/api/spx/coach/state');
    expect(coach.status).toBe(200);
    expect(coach.body).toEqual(expect.objectContaining({ messages: expect.any(Array), generatedAt: expect.any(String) }));
  });
});
