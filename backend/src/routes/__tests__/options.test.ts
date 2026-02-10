import request from 'supertest';
import express from 'express';

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1' };
    next();
  },
  checkQueryLimit: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/requireTier', () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/options/optionsChainFetcher', () => ({
  fetchOptionsChain: jest.fn(),
  fetchExpirationDates: jest.fn(),
  fetchOptionsMatrix: jest.fn(),
}));

jest.mock('../../services/options/gexCalculator', () => ({
  calculateGEXProfile: jest.fn(),
}));

jest.mock('../../services/options/zeroDTE', () => ({
  analyzeZeroDTE: jest.fn(),
}));

jest.mock('../../services/options/ivAnalysis', () => ({
  analyzeIVProfile: jest.fn(),
}));

jest.mock('../../services/options/positionAnalyzer', () => ({
  analyzePosition: jest.fn(),
  analyzePortfolio: jest.fn(),
  getUserPositions: jest.fn(),
  getPositionById: jest.fn(),
}));

jest.mock('../../services/positions/liveTracker', () => ({
  LivePositionTracker: jest.fn(),
}));

jest.mock('../../services/positions/exitAdvisor', () => ({
  ExitAdvisor: jest.fn(),
}));

import optionsRouter from '../options';
import { calculateGEXProfile } from '../../services/options/gexCalculator';
import { analyzeZeroDTE } from '../../services/options/zeroDTE';
import { analyzeIVProfile } from '../../services/options/ivAnalysis';
import { fetchOptionsMatrix } from '../../services/options/optionsChainFetcher';
import {
  analyzePosition,
  getPositionById,
  getUserPositions,
} from '../../services/options/positionAnalyzer';
import { LivePositionTracker } from '../../services/positions/liveTracker';
import { ExitAdvisor } from '../../services/positions/exitAdvisor';

const mockCalculateGEXProfile = calculateGEXProfile as jest.MockedFunction<typeof calculateGEXProfile>;
const mockAnalyzeZeroDTE = analyzeZeroDTE as jest.MockedFunction<typeof analyzeZeroDTE>;
const mockAnalyzeIVProfile = analyzeIVProfile as jest.MockedFunction<typeof analyzeIVProfile>;
const mockFetchOptionsMatrix = fetchOptionsMatrix as jest.MockedFunction<typeof fetchOptionsMatrix>;
const mockAnalyzePosition = analyzePosition as jest.MockedFunction<typeof analyzePosition>;
const mockGetUserPositions = getUserPositions as jest.MockedFunction<typeof getUserPositions>;
const mockGetPositionById = getPositionById as jest.MockedFunction<typeof getPositionById>;
const MockLivePositionTracker = LivePositionTracker as unknown as jest.Mock;
const MockExitAdvisor = ExitAdvisor as unknown as jest.Mock;

const app = express();
app.use(express.json());
app.use('/api/options', optionsRouter);
app.use('/api/positions', optionsRouter);

describe('Options Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockLivePositionTracker.mockImplementation(() => ({
      recalculateForUser: jest.fn().mockResolvedValue([]),
    }));
    MockExitAdvisor.mockImplementation(() => ({
      generateAdvice: jest.fn().mockReturnValue([]),
    }));
  });

  describe('GET /api/options/:symbol/matrix', () => {
    it('returns options matrix for valid symbol/query', async () => {
      mockFetchOptionsMatrix.mockResolvedValue({
        symbol: 'SPY',
        currentPrice: 512.4,
        expirations: ['2026-02-20', '2026-02-27'],
        strikes: [500, 505, 510],
        cells: [],
        generatedAt: '2026-02-09T18:00:00.000Z',
        cacheKey: 'options_matrix:SPY',
      } as any);

      const res = await request(app).get('/api/options/spy/matrix?expirations=2&strikes=50');

      expect(res.status).toBe(200);
      expect(res.body.symbol).toBe('SPY');
      expect(mockFetchOptionsMatrix).toHaveBeenCalledWith('SPY', {
        expirations: 2,
        strikes: 50,
      });
    });

    it('returns 400 for invalid matrix query', async () => {
      const res = await request(app).get('/api/options/spy/matrix?expirations=0&strikes=8');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(mockFetchOptionsMatrix).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/options/:symbol/gex', () => {
    it('returns gamma exposure profile for any valid symbol', async () => {
      mockCalculateGEXProfile.mockResolvedValue({
        symbol: 'AAPL',
        spotPrice: 6010,
        gexByStrike: [],
        flipPoint: 6000,
        maxGEXStrike: 6020,
        keyLevels: [],
        regime: 'positive_gamma',
        implication: 'test',
        calculatedAt: '2026-02-09T17:00:00.000Z',
        expirationsAnalyzed: ['2026-02-10'],
      });

      const res = await request(app)
        .get('/api/options/aapl/gex?strikeRange=20&maxExpirations=4&forceRefresh=true');

      expect(res.status).toBe(200);
      expect(res.body.symbol).toBe('AAPL');
      expect(mockCalculateGEXProfile).toHaveBeenCalledWith('AAPL', {
        expiry: undefined,
        strikeRange: 20,
        maxExpirations: 4,
        forceRefresh: true,
      });
    });

    it('returns 400 for invalid query parameters', async () => {
      const res = await request(app).get('/api/options/spx/gex?strikeRange=3');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(mockCalculateGEXProfile).not.toHaveBeenCalled();
    });

    it('maps insufficient options data to 503', async () => {
      mockCalculateGEXProfile.mockRejectedValue(new Error('Insufficient options data to calculate GEX for SPX'));

      const res = await request(app).get('/api/options/spx/gex');

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Data unavailable');
    });
  });

  describe('GET /api/options/:symbol/0dte', () => {
    it('returns 0DTE analysis for valid symbol and query', async () => {
      mockAnalyzeZeroDTE.mockResolvedValue({
        symbol: 'SPX',
        marketDate: '2026-02-09',
        hasZeroDTE: true,
        message: 'ok',
        expectedMove: {
          totalExpectedMove: 25,
          usedMove: 10,
          usedPct: 40,
          remainingMove: 18,
          remainingPct: 72,
          minutesLeft: 120,
          openPrice: 6000,
          currentPrice: 6010,
          atmStrike: 6010,
        },
        thetaClock: null,
        gammaProfile: null,
        topContracts: [],
      });

      const res = await request(app).get('/api/options/spx/0dte?strike=6000&type=call');

      expect(res.status).toBe(200);
      expect(res.body.symbol).toBe('SPX');
      expect(mockAnalyzeZeroDTE).toHaveBeenCalledWith('SPX', {
        strike: 6000,
        type: 'call',
      });
    });

    it('returns 400 when type query is invalid', async () => {
      const res = await request(app).get('/api/options/spx/0dte?type=invalid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(mockAnalyzeZeroDTE).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/options/:symbol/iv', () => {
    it('returns IV analysis profile for valid symbol/query', async () => {
      mockAnalyzeIVProfile.mockResolvedValue({
        symbol: 'SPX',
        currentPrice: 6012.5,
        asOf: '2026-02-09T15:00:00.000Z',
        ivRank: {
          currentIV: 22.1,
          ivRank: 48.3,
          ivPercentile: 52.7,
          iv52wkHigh: 41.2,
          iv52wkLow: 11.4,
          ivTrend: 'stable',
        },
        skew: {
          skew25delta: 2.8,
          skew10delta: 4.6,
          skewDirection: 'put_heavy',
          interpretation: 'Put-side IV is elevated versus calls, suggesting downside hedge demand.',
        },
        termStructure: {
          expirations: [{ date: '2026-02-10', dte: 1, atmIV: 21.8 }],
          shape: 'flat',
        },
      });

      const res = await request(app)
        .get('/api/options/spx/iv?strikeRange=15&maxExpirations=3&forceRefresh=true');

      expect(res.status).toBe(200);
      expect(res.body.symbol).toBe('SPX');
      expect(mockAnalyzeIVProfile).toHaveBeenCalledWith('SPX', {
        expiry: undefined,
        strikeRange: 15,
        maxExpirations: 3,
        forceRefresh: true,
      });
    });

    it('returns 400 for invalid IV query params', async () => {
      const res = await request(app).get('/api/options/spx/iv?strikeRange=2');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(mockAnalyzeIVProfile).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/positions/live', () => {
    it('returns live snapshots for authenticated user', async () => {
      const recalculateForUser = jest.fn().mockResolvedValue([
        {
          id: 'pos-1',
          symbol: 'SPX',
          type: 'call',
          quantity: 1,
          entryPrice: 24.5,
          entryDate: '2026-02-01',
          currentPrice: 36.1,
          currentValue: 3610,
          costBasis: 2450,
          pnl: 1160,
          pnlPct: 47.35,
          daysHeld: 8,
          daysToExpiry: 5,
          updatedAt: '2026-02-09T16:00:00.000Z',
        },
      ]);

      MockLivePositionTracker.mockImplementation(() => ({
        recalculateForUser,
      }));

      const res = await request(app).get('/api/positions/live');

      expect(res.status).toBe(200);
      expect(recalculateForUser).toHaveBeenCalledWith('user-1');
      expect(res.body.count).toBe(1);
      expect(res.body.positions[0].id).toBe('pos-1');
    });
  });

  describe('GET /api/positions/advice', () => {
    it('returns advice for all open positions', async () => {
      mockGetUserPositions.mockResolvedValue([
        {
          id: 'pos-1',
          symbol: 'SPX',
          type: 'call',
          strike: 6000,
          expiry: '2026-02-20',
          quantity: 1,
          entryPrice: 20,
          entryDate: '2026-02-07',
        } as any,
      ]);

      mockAnalyzePosition.mockResolvedValue({
        position: {
          id: 'pos-1',
          symbol: 'SPX',
          type: 'call',
          strike: 6000,
          expiry: '2026-02-20',
          quantity: 1,
          entryPrice: 20,
          entryDate: '2026-02-07',
        },
        currentValue: 3200,
        costBasis: 2000,
        pnl: 1200,
        pnlPct: 60,
        daysHeld: 2,
        daysToExpiry: 11,
        maxGain: 'unlimited',
        maxLoss: 2000,
        greeks: {
          delta: 45,
          gamma: 0.2,
          theta: -65,
          vega: 22,
        },
      } as any);

      const generateAdvice = jest.fn().mockReturnValue([
        {
          positionId: 'pos-1',
          type: 'take_profit',
          urgency: 'medium',
          message: 'Consider taking partial profits.',
          suggestedAction: { action: 'take_partial_profit', closePct: 50 },
        },
      ]);
      MockExitAdvisor.mockImplementation(() => ({
        generateAdvice,
      }));

      const res = await request(app).get('/api/positions/advice');

      expect(res.status).toBe(200);
      expect(mockGetUserPositions).toHaveBeenCalledWith('user-1');
      expect(generateAdvice).toHaveBeenCalled();
      expect(res.body.count).toBe(1);
      expect(res.body.advice[0].type).toBe('take_profit');
    });

    it('returns 400 for invalid positionId query', async () => {
      const res = await request(app).get('/api/positions/advice?positionId=not-a-uuid');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('looks up a single position when positionId is provided', async () => {
      mockGetPositionById.mockResolvedValue({
        id: 'fae5e8d7-c7a2-4de7-b8df-4e23f4aabcf1',
        symbol: 'NDX',
        type: 'put',
        strike: 21000,
        expiry: '2026-03-20',
        quantity: 1,
        entryPrice: 120,
        entryDate: '2026-02-01',
      } as any);
      mockAnalyzePosition.mockResolvedValue({
        position: {
          id: 'fae5e8d7-c7a2-4de7-b8df-4e23f4aabcf1',
          symbol: 'NDX',
          type: 'put',
          strike: 21000,
          expiry: '2026-03-20',
          quantity: 1,
          entryPrice: 120,
          entryDate: '2026-02-01',
        },
        currentValue: 8000,
        costBasis: 12000,
        pnl: -4000,
        pnlPct: -33.3,
        daysHeld: 8,
        daysToExpiry: 40,
        maxGain: 2100000,
        maxLoss: 12000,
        greeks: {
          delta: -35,
          gamma: 0.08,
          theta: -40,
          vega: 30,
        },
      } as any);

      const generateAdvice = jest.fn().mockReturnValue([]);
      MockExitAdvisor.mockImplementation(() => ({
        generateAdvice,
      }));

      const positionId = 'fae5e8d7-c7a2-4de7-b8df-4e23f4aabcf1';
      const res = await request(app).get(`/api/positions/advice?positionId=${positionId}`);

      expect(res.status).toBe(200);
      expect(mockGetPositionById).toHaveBeenCalledWith(positionId, 'user-1');
      expect(mockGetUserPositions).not.toHaveBeenCalled();
      expect(res.body.count).toBe(0);
    });
  });
});
