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
  authenticateToken: (_req: any, _res: any, next: any) => next(),
  checkQueryLimit: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/options/optionsChainFetcher', () => ({
  fetchOptionsChain: jest.fn(),
  fetchExpirationDates: jest.fn(),
}));

jest.mock('../../services/options/gexCalculator', () => ({
  calculateGEXProfile: jest.fn(),
}));

jest.mock('../../services/options/zeroDTE', () => ({
  analyzeZeroDTE: jest.fn(),
}));

jest.mock('../../services/options/positionAnalyzer', () => ({
  analyzePosition: jest.fn(),
  analyzePortfolio: jest.fn(),
}));

import optionsRouter from '../options';
import { calculateGEXProfile } from '../../services/options/gexCalculator';
import { analyzeZeroDTE } from '../../services/options/zeroDTE';

const mockCalculateGEXProfile = calculateGEXProfile as jest.MockedFunction<typeof calculateGEXProfile>;
const mockAnalyzeZeroDTE = analyzeZeroDTE as jest.MockedFunction<typeof analyzeZeroDTE>;

const app = express();
app.use(express.json());
app.use('/api/options', optionsRouter);

describe('Options Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
