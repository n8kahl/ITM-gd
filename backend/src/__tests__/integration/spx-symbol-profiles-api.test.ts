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

jest.mock('../../services/spx/symbolProfile', () => ({
  listSymbolProfiles: jest.fn(),
  getSymbolProfileBySymbol: jest.fn(),
  summarizeSymbolProfile: jest.fn((profile: any) => ({
    symbol: profile.symbol,
    displayName: profile.displayName,
    isActive: profile.isActive,
    massiveTicker: profile.tickers?.massiveTicker || 'I:SPX',
    crossSymbol: profile.gex?.crossSymbol || 'SPY',
    updatedAt: profile.updatedAt || null,
  })),
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
import { getSymbolProfileBySymbol, listSymbolProfiles } from '../../services/spx/symbolProfile';

const mockGetSymbolProfileBySymbol = getSymbolProfileBySymbol as jest.MockedFunction<typeof getSymbolProfileBySymbol>;
const mockListSymbolProfiles = listSymbolProfiles as jest.MockedFunction<typeof listSymbolProfiles>;

const app = express();
app.use(express.json());
app.use('/api/spx', spxRouter);

function buildProfile(symbol: string) {
  return {
    symbol,
    displayName: symbol === 'SPX' ? 'S&P 500 Index' : symbol,
    level: {
      roundNumberInterval: 50,
      openingRangeMinutes: 30,
      clusterRadiusPoints: 3,
    },
    gex: {
      scalingFactor: 0.1,
      crossSymbol: symbol === 'SPX' ? 'SPY' : symbol,
      strikeWindowPoints: 220,
    },
    flow: {
      minPremium: 10_000,
      minVolume: 10,
      directionalMinPremium: 50_000,
    },
    multiTF: {
      emaFast: 21,
      emaSlow: 55,
      weight1h: 0.55,
      weight15m: 0.2,
      weight5m: 0.15,
      weight1m: 0.1,
    },
    regime: {
      breakoutThreshold: 0.7,
      compressionThreshold: 0.65,
    },
    tickers: {
      massiveTicker: `I:${symbol}`,
      massiveOptionsTicker: `O:${symbol}*`,
    },
    isActive: true,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T01:00:00.000Z',
  } as any;
}

describeWithSockets('SPX symbol profiles API integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateToken.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { id: 'integration-user-1' };
      next();
    });
    mockHasBackendAdminAccess.mockResolvedValue(true);
    mockListSymbolProfiles.mockResolvedValue([] as never);
    mockGetSymbolProfileBySymbol.mockResolvedValue(null as never);
  });

  it('returns 403 for non-admin users on profile list', async () => {
    mockHasBackendAdminAccess.mockResolvedValue(false);

    const res = await request(app).get('/api/spx/symbol-profiles');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(mockListSymbolProfiles).not.toHaveBeenCalled();
  });

  it('returns profile summary list for admins', async () => {
    mockListSymbolProfiles.mockResolvedValue([
      buildProfile('SPX'),
      { ...buildProfile('NDX'), isActive: false },
    ] as never);

    const res = await request(app).get('/api/spx/symbol-profiles?includeInactive=true');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.includeInactive).toBe(true);
    expect(res.body.profiles).toEqual([
      expect.objectContaining({ symbol: 'SPX', isActive: true, massiveTicker: 'I:SPX' }),
      expect.objectContaining({ symbol: 'NDX', isActive: false, massiveTicker: 'I:NDX' }),
    ]);
    expect(mockListSymbolProfiles).toHaveBeenCalledWith(expect.objectContaining({
      includeInactive: true,
      failOpen: false,
    }));
  });

  it('returns 404 when requested symbol profile is missing', async () => {
    mockGetSymbolProfileBySymbol.mockResolvedValue(null as never);

    const res = await request(app).get('/api/spx/symbol-profiles/QQQ');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
    expect(mockGetSymbolProfileBySymbol).toHaveBeenCalledWith('QQQ', expect.objectContaining({
      includeInactive: true,
      failOpen: false,
    }));
  });

  it('returns detail payload for a specific symbol profile', async () => {
    mockGetSymbolProfileBySymbol.mockResolvedValue(buildProfile('SPX') as never);

    const res = await request(app).get('/api/spx/symbol-profiles/SPX?forceRefresh=true');

    expect(res.status).toBe(200);
    expect(res.body.profile.symbol).toBe('SPX');
    expect(res.body.summary.symbol).toBe('SPX');
    expect(mockGetSymbolProfileBySymbol).toHaveBeenCalledWith('SPX', expect.objectContaining({
      includeInactive: true,
      failOpen: false,
      bypassCache: true,
    }));
  });
});
