import request from 'supertest';
import express from 'express';

const mockAuthenticateToken = jest.fn();
const mockMassiveGet = jest.fn();
const mockBuildSwingSniperBrief = jest.fn();
const mockBuildSwingSniperDossier = jest.fn();
const mockGetWatchlistState = jest.fn();
const mockSaveWatchlistState = jest.fn();
const mockSaveSignalSnapshots = jest.fn();
const mockScanUniverse = jest.fn();
const mockBuildStructureLab = jest.fn();
const mockBuildRiskSentinel = jest.fn();
const mockBuildBacktest = jest.fn();

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
}));

jest.mock('../../config/massive', () => ({
  massiveClient: {
    get: (...args: unknown[]) => mockMassiveGet(...args),
  },
}));

jest.mock('../../services/swingSniper/briefBuilder', () => ({
  buildSwingSniperBrief: (...args: unknown[]) => mockBuildSwingSniperBrief(...args),
}));

jest.mock('../../services/swingSniper/dossierBuilder', () => ({
  buildSwingSniperDossier: (...args: unknown[]) => mockBuildSwingSniperDossier(...args),
}));

jest.mock('../../services/swingSniper/persistence', () => ({
  getSwingSniperWatchlistState: (...args: unknown[]) => mockGetWatchlistState(...args),
  saveSwingSniperWatchlistState: (...args: unknown[]) => mockSaveWatchlistState(...args),
  saveSwingSniperSignalSnapshots: (...args: unknown[]) => mockSaveSignalSnapshots(...args),
}));

jest.mock('../../services/swingSniper/universeScanner', () => ({
  SWING_SNIPER_CORE_SCAN_SYMBOLS: ['SPY', 'QQQ', 'NVDA'],
  scanSwingSniperUniverse: (...args: unknown[]) => mockScanUniverse(...args),
}));

jest.mock('../../services/swingSniper/structureLab', () => ({
  buildSwingSniperStructureLab: (...args: unknown[]) => mockBuildStructureLab(...args),
}));

jest.mock('../../services/swingSniper/riskSentinel', () => ({
  buildSwingSniperRiskSentinel: (...args: unknown[]) => mockBuildRiskSentinel(...args),
}));

jest.mock('../../services/swingSniper/backtestService', () => ({
  buildSwingSniperBacktestReport: (...args: unknown[]) => mockBuildBacktest(...args),
}));

import swingSniperRouter from '../swing-sniper';

const app = express();
app.use(express.json());
app.use('/api/swing-sniper', swingSniperRouter);

describe('Swing Sniper Route', () => {
  const originalMassiveApiKey = process.env.MASSIVE_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MASSIVE_API_KEY = 'massive-test-key';

    mockAuthenticateToken.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { id: 'member-1' };
      next();
    });

    mockGetWatchlistState.mockResolvedValue({
      symbols: ['NVDA'],
      selectedSymbol: 'NVDA',
      filters: { preset: 'all', minScore: 0 },
      savedTheses: [],
    });
    mockSaveSignalSnapshots.mockResolvedValue(undefined);

    mockBuildStructureLab.mockResolvedValue({
      generatedAt: '2026-03-09T12:00:00.000Z',
      symbol: 'NVDA',
      direction: 'long_vol',
      recommendations: [],
      notes: ['Evaluated contract candidates.'],
    });

    mockBuildRiskSentinel.mockResolvedValue({
      generatedAt: '2026-03-09T12:00:00.000Z',
      savedTheses: [],
      portfolio: {
        openPositions: 0,
        totalPnl: 0,
        totalPnlPct: 0,
        riskLevel: 'low',
        warnings: ['No open positions found.'],
        netGreeks: { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
        symbolExposure: [],
      },
      positionAdvice: [],
      alerts: [],
      notes: ['Risk Sentinel ready.'],
    });

    mockBuildBacktest.mockResolvedValue({
      generatedAt: '2026-03-09T12:00:00.000Z',
      symbol: 'NVDA',
      status: 'ready',
      windowDays: 360,
      snapshotsConsidered: 12,
      summary: {
        sampleSize: 12,
        resolvedSamples: 9,
        hitRatePct: 66.7,
        weightedHitRatePct: 64.1,
        averageMovePct: 2.8,
        medianMovePct: 2.2,
        bestMovePct: 8.6,
        worstMovePct: -4.4,
        averageHorizonDays: 8.3,
      },
      confidence: {
        confidenceWeight: 1.08,
        baseScore: 88,
        adjustedScore: 95,
        stance: 'boost',
        rationale: ['Weighted hit rate is 64.1%.'],
      },
      outcomes: [],
      caveats: [],
      notes: ['Backtest is advisory only.'],
    });
  });

  afterAll(() => {
    process.env.MASSIVE_API_KEY = originalMassiveApiKey;
  });

  it('returns ready health when required Massive probes succeed', async () => {
    mockMassiveGet.mockImplementation((url: string) => {
      if (url === '/v1/marketstatus/now') return Promise.resolve({ data: { market: 'open' } });
      if (url === '/v3/reference/options/contracts') return Promise.resolve({ data: { results: [{}] } });
      if (url === '/v2/reference/news') return Promise.resolve({ data: { results: [{}] } });
      if (url === '/benzinga/v1/earnings') return Promise.resolve({ data: { results: [{}] } });
      throw new Error(`Unexpected url ${url}`);
    });

    const res = await request(app)
      .get('/api/swing-sniper/health')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe('ready');
    expect(res.body.capabilities.routeShell).toBe(true);
    expect(res.body.capabilities.opportunityBoard).toBe(true);
    expect(res.body.capabilities.dossier).toBe(true);
    expect(res.body.capabilities.structureLab).toBe(true);
    expect(res.body.capabilities.monitoring).toBe(true);
    expect(res.body.capabilities.backtesting).toBe(true);
  });

  it('keeps health ready when the optional Benzinga add-on is unavailable', async () => {
    mockMassiveGet.mockImplementation((url: string) => {
      if (url === '/benzinga/v1/earnings') {
        const error = new Error('Forbidden') as Error & { response?: { status: number } };
        error.response = { status: 403 };
        return Promise.reject(error);
      }
      return Promise.resolve({ data: { results: [{}] } });
    });

    const res = await request(app)
      .get('/api/swing-sniper/health')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe('ready');
    expect(res.body.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'benzinga-earnings',
          status: 'optional',
        }),
      ]),
    );
  });

  it('returns the authenticated member watchlist state', async () => {
    mockGetWatchlistState.mockResolvedValue({
      symbols: ['NVDA', 'AAPL'],
      selectedSymbol: 'NVDA',
      filters: { preset: 'all', minScore: 0 },
      savedTheses: [
        {
          symbol: 'NVDA',
          savedAt: '2026-03-09T12:00:00.000Z',
          score: 88,
          setupLabel: 'Cheap event gamma into catalyst window',
          direction: 'long_vol',
          thesis: 'IV is below realized into earnings.',
          ivRankAtSave: 42,
          catalystLabel: 'NVDA earnings',
          catalystDate: '2026-03-17',
          monitorNote: 'Waiting for earnings window.',
        },
      ],
    });

    const res = await request(app)
      .get('/api/swing-sniper/watchlist')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.selectedSymbol).toBe('NVDA');
    expect(res.body.savedTheses).toHaveLength(1);
  });

  it('persists a saved thesis for an authenticated member', async () => {
    mockSaveWatchlistState.mockResolvedValue({
      symbols: ['NVDA'],
      selectedSymbol: 'NVDA',
      filters: { preset: 'all', minScore: 0 },
      savedTheses: [
        {
          symbol: 'NVDA',
          savedAt: '2026-03-09T12:00:00.000Z',
          score: 88,
          setupLabel: 'Cheap event gamma into catalyst window',
          direction: 'long_vol',
          thesis: 'IV is below realized into earnings.',
          ivRankAtSave: 42,
          catalystLabel: 'NVDA earnings',
          catalystDate: '2026-03-17',
          monitorNote: 'Waiting for earnings window.',
        },
      ],
    });

    const res = await request(app)
      .post('/api/swing-sniper/watchlist')
      .set('Authorization', 'Bearer test-token')
      .send({
        selectedSymbol: 'NVDA',
        filters: { preset: 'all', minScore: 0 },
        thesis: {
          symbol: 'NVDA',
          score: 88,
          setupLabel: 'Cheap event gamma into catalyst window',
          direction: 'long_vol',
          thesis: 'IV is below realized into earnings.',
          ivRankAtSave: 42,
          catalystLabel: 'NVDA earnings',
          catalystDate: '2026-03-17',
          monitorNote: 'Waiting for earnings window.',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSaveWatchlistState).toHaveBeenCalledWith('member-1', expect.objectContaining({
      selectedSymbol: 'NVDA',
      thesis: expect.objectContaining({
        symbol: 'NVDA',
      }),
    }));
  });

  it('returns structure recommendations for a symbol', async () => {
    mockBuildSwingSniperDossier.mockResolvedValue({
      symbol: 'NVDA',
      currentPrice: 918.44,
      direction: 'long_vol',
      catalysts: { events: [{ daysUntil: 8 }] },
      volMap: {
        currentIV: 34.6,
        ivRank: 39,
        skewDirection: 'balanced',
        termStructureShape: 'backwardation',
      },
    });

    mockBuildStructureLab.mockResolvedValue({
      generatedAt: '2026-03-09T12:00:00.000Z',
      symbol: 'NVDA',
      direction: 'long_vol',
      recommendations: [
        {
          id: 'long-call',
          strategy: 'long_call',
        },
      ],
      notes: ['Evaluated contract candidates.'],
    });

    const res = await request(app)
      .post('/api/swing-sniper/structure/recommend')
      .set('Authorization', 'Bearer test-token')
      .send({
        symbol: 'NVDA',
        maxRecommendations: 3,
      });

    expect(res.status).toBe(200);
    expect(mockBuildStructureLab).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'NVDA',
      direction: 'long_vol',
      maxRecommendations: 3,
    }));
    expect(res.body.symbol).toBe('NVDA');
    expect(Array.isArray(res.body.recommendations)).toBe(true);
  });

  it('returns monitoring payload for the authenticated member', async () => {
    const res = await request(app)
      .get('/api/swing-sniper/monitoring')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(mockBuildRiskSentinel).toHaveBeenCalledWith('member-1');
    expect(res.body.portfolio.openPositions).toBe(0);
  });

  it('returns backtest payload for the authenticated member symbol', async () => {
    const res = await request(app)
      .get('/api/swing-sniper/backtest/NVDA')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(mockBuildBacktest).toHaveBeenCalledWith('member-1', 'NVDA');
    expect(res.body.symbol).toBe('NVDA');
    expect(res.body.confidence).toEqual(expect.objectContaining({
      confidenceWeight: expect.any(Number),
    }));
  });

  it('returns a 401 when auth middleware rejects the request', async () => {
    mockAuthenticateToken.mockImplementation((_req: any, res: any) => {
      res.status(401).json({ error: 'Unauthorized' });
    });

    const res = await request(app).get('/api/swing-sniper/watchlist');

    expect(res.status).toBe(401);
  });
});
