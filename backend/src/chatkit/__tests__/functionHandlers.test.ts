import { executeFunctionCall } from '../functionHandlers';

// Mock the services
jest.mock('../../services/levels', () => ({
  calculateLevels: jest.fn()
}));

jest.mock('../../services/levels/fetcher', () => ({
  fetchIntradayData: jest.fn()
}));

import { calculateLevels } from '../../services/levels';
import { fetchIntradayData } from '../../services/levels/fetcher';

const mockCalculateLevels = calculateLevels as jest.MockedFunction<typeof calculateLevels>;
const mockFetchIntradayData = fetchIntradayData as jest.MockedFunction<typeof fetchIntradayData>;

describe('Function Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get_key_levels', () => {
    it('should return levels for SPX', async () => {
      // Mock response
      mockCalculateLevels.mockResolvedValue({
        symbol: 'SPX',
        currentPrice: 5912.50,
        levels: {
          resistance: [
            {
              type: 'PDH',
              price: 5930.00,
              distance: 17.50,
              distancePct: 0.30,
              distanceATR: 0.4,
              strength: 'strong',
              description: 'Previous Day High',
              testsToday: 3,
              lastTest: null
            }
          ],
          support: [],
          pivots: {
            standard: { pp: 5900.00, r1: 5910.00, r2: 5920.00, r3: 5930.00, s1: 5890.00, s2: 5880.00, s3: 5870.00 },
            camarilla: { h4: 5920.00, h3: 5915.00, l3: 5885.00, l4: 5880.00 },
            fibonacci: { r3: 5930.00, r2: 5920.00, r1: 5910.00, s1: 5890.00, s2: 5880.00, s3: 5870.00 }
          },
          indicators: {
            vwap: 5900.00,
            atr14: 47.25,
            atr7: 52.30
          }
        },
        marketContext: {
          marketStatus: 'open',
          sessionType: 'regular',
          timeSinceOpen: '2h 35m'
        },
        timestamp: '2026-02-03T12:05:30.123Z',
        cached: false,
        cacheExpiresAt: null
      });

      const result = await executeFunctionCall({
        name: 'get_key_levels',
        arguments: JSON.stringify({ symbol: 'SPX', timeframe: 'intraday' })
      });

      expect(result).toHaveProperty('symbol', 'SPX');
      expect(result).toHaveProperty('currentPrice', 5912.50);
      expect(result.levels).toHaveProperty('resistance');
      expect(result.levels).toHaveProperty('support');
      expect(result.levels).toHaveProperty('pivots');
      expect(result.levels).toHaveProperty('indicators');
      expect(mockCalculateLevels).toHaveBeenCalledWith('SPX', 'intraday');
    });

    it('should handle errors gracefully', async () => {
      mockCalculateLevels.mockRejectedValue(new Error('API failed'));

      const result = await executeFunctionCall({
        name: 'get_key_levels',
        arguments: JSON.stringify({ symbol: 'SPX' })
      });

      expect(result).toHaveProperty('error', 'Failed to fetch levels');
      expect(result).toHaveProperty('message', 'API failed');
    });
  });

  describe('get_current_price', () => {
    it('should return current price', async () => {
      mockFetchIntradayData.mockResolvedValue([
        {
          o: 5900,
          h: 5915,
          l: 5895,
          c: 5910,
          v: 1000000,
          t: Date.now()
        },
        {
          o: 5910,
          h: 5920,
          l: 5905,
          c: 5912.50,
          v: 1200000,
          t: Date.now() + 60000
        }
      ]);

      const result = await executeFunctionCall({
        name: 'get_current_price',
        arguments: JSON.stringify({ symbol: 'SPX' })
      });

      expect(result).toHaveProperty('symbol', 'SPX');
      expect(result).toHaveProperty('price', 5912.50);
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('high', 5920);
      expect(result).toHaveProperty('low', 5905);
      expect(mockFetchIntradayData).toHaveBeenCalledWith('SPX');
    });

    it('should handle no data available', async () => {
      mockFetchIntradayData.mockResolvedValue([]);

      const result = await executeFunctionCall({
        name: 'get_current_price',
        arguments: JSON.stringify({ symbol: 'SPX' })
      });

      expect(result).toHaveProperty('error', 'No price data available');
    });
  });

  describe('get_market_status', () => {
    it('should return market status', async () => {
      const result = await executeFunctionCall({
        name: 'get_market_status',
        arguments: JSON.stringify({})
      });

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('message');
      // Status should be one of: closed, pre-market, open, after-hours
      expect(['closed', 'pre-market', 'open', 'after-hours']).toContain(result.status);
    });
  });

  describe('unknown function', () => {
    it('should throw error for unknown function', async () => {
      await expect(
        executeFunctionCall({
          name: 'unknown_function',
          arguments: JSON.stringify({})
        })
      ).rejects.toThrow('Unknown function: unknown_function');
    });
  });
});
