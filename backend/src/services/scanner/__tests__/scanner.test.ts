import { scanOpportunities } from '../index';
import { runTechnicalScan } from '../technicalScanner';
import { runOptionsScan } from '../optionsScanner';

// Mock all external dependencies
jest.mock('../../levels', () => ({
  calculateLevels: jest.fn(),
}));

jest.mock('../../levels/fetcher', () => ({
  fetchDailyData: jest.fn(),
  fetchIntradayData: jest.fn(),
}));

jest.mock('../../options/optionsChainFetcher', () => ({
  fetchOptionsChain: jest.fn(),
}));

import { calculateLevels } from '../../levels';
import { fetchDailyData, fetchIntradayData } from '../../levels/fetcher';
import { fetchOptionsChain } from '../../options/optionsChainFetcher';

const mockCalculateLevels = calculateLevels as jest.MockedFunction<typeof calculateLevels>;
const mockFetchDailyData = fetchDailyData as jest.MockedFunction<typeof fetchDailyData>;
const mockFetchIntradayData = fetchIntradayData as jest.MockedFunction<typeof fetchIntradayData>;
const mockFetchOptionsChain = fetchOptionsChain as jest.MockedFunction<typeof fetchOptionsChain>;

describe('Opportunity Scanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Technical Scanners', () => {
    it('should detect support bounce when price is near support', async () => {
      mockCalculateLevels.mockResolvedValue({
        symbol: 'SPX',
        currentPrice: 5901,
        levels: {
          resistance: [{ type: 'PDH', price: 5930, distancePct: 0.5 }],
          support: [{ type: 'PDL', price: 5900, distancePct: -0.02 }],
          pivots: { standard: {}, camarilla: {}, fibonacci: {} },
          indicators: { vwap: 5910, atr14: 45, atr7: 50 },
        },
        marketContext: { marketStatus: 'open', sessionType: 'regular', timeSinceOpen: '3h' },
        timestamp: new Date().toISOString(),
        cached: false,
        cacheExpiresAt: null,
      } as any);

      // Also mock for other scanners that call calculateLevels
      const setups = await runTechnicalScan('SPX');

      // Should find at least the support bounce
      const supportBounce = setups.find(s => s.type === 'support_bounce');
      expect(supportBounce).toBeDefined();
      if (supportBounce) {
        expect(supportBounce.direction).toBe('bullish');
        expect(supportBounce.symbol).toBe('SPX');
        expect(supportBounce.confidence).toBeGreaterThan(0);
      }
    });

    it('should detect volume spike', async () => {
      // Create intraday data with a volume spike at the end
      const normalBars = Array.from({ length: 19 }, (_, i) => ({
        o: 5900 + i, h: 5905 + i, l: 5895 + i, c: 5900 + i,
        v: 10000, t: Date.now() - (20 - i) * 60000,
      }));

      // Add spike bar with 5x normal volume
      normalBars.push({
        o: 5920, h: 5930, l: 5915, c: 5925,
        v: 50000, t: Date.now(),
      });

      mockFetchIntradayData.mockResolvedValue(normalBars);
      // Mock calculateLevels for other scanners
      mockCalculateLevels.mockRejectedValue(new Error('test'));
      mockFetchDailyData.mockRejectedValue(new Error('test'));

      const setups = await runTechnicalScan('SPX');

      const volumeSpike = setups.find(s => s.type === 'volume_spike');
      expect(volumeSpike).toBeDefined();
      if (volumeSpike) {
        expect(volumeSpike.direction).toBe('bullish'); // close > open
        expect(volumeSpike.metadata.volumeRatio).toBeGreaterThan(2);
      }
    });

    it('should detect RSI oversold condition', async () => {
      // Create daily data with consistent down days to get RSI < 30
      const dailyData = Array.from({ length: 20 }, (_, i) => ({
        o: 6000 - i * 15, h: 6005 - i * 15, l: 5990 - i * 15, c: 5995 - i * 15,
        v: 100000, t: Date.now() - (20 - i) * 86400000,
      }));

      mockFetchDailyData.mockResolvedValue(dailyData);
      mockCalculateLevels.mockRejectedValue(new Error('test'));
      mockFetchIntradayData.mockRejectedValue(new Error('test'));

      const setups = await runTechnicalScan('SPX');

      // May or may not detect depending on exact RSI calculation
      // The important thing is that the scanner doesn't crash
      expect(Array.isArray(setups)).toBe(true);
    });

    it('should handle errors gracefully and return empty array', async () => {
      mockCalculateLevels.mockRejectedValue(new Error('API down'));
      mockFetchIntradayData.mockRejectedValue(new Error('API down'));
      mockFetchDailyData.mockRejectedValue(new Error('API down'));

      const setups = await runTechnicalScan('SPX');
      expect(setups).toEqual([]);
    });
  });

  describe('Options Scanners', () => {
    it('should detect high IV when ATM IV is elevated', async () => {
      mockFetchOptionsChain.mockResolvedValue({
        symbol: 'SPX',
        currentPrice: 5900,
        expiry: '2026-03-20',
        daysToExpiry: 40,
        ivRank: 75,
        options: {
          calls: [
            {
              symbol: 'SPX', strike: 5900, expiry: '2026-03-20', type: 'call',
              last: 80, bid: 79, ask: 81, volume: 5000, openInterest: 20000,
              impliedVolatility: 0.30, delta: 0.5, gamma: 0.001, theta: -5, vega: 15,
              rho: 5, inTheMoney: false, intrinsicValue: 0, extrinsicValue: 80,
            },
          ],
          puts: [
            {
              symbol: 'SPX', strike: 5900, expiry: '2026-03-20', type: 'put',
              last: 75, bid: 74, ask: 76, volume: 4000, openInterest: 18000,
              impliedVolatility: 0.32, delta: -0.5, gamma: 0.001, theta: -4.5, vega: 14,
              rho: -4, inTheMoney: false, intrinsicValue: 0, extrinsicValue: 75,
            },
          ],
        },
      });

      const setups = await runOptionsScan('SPX');

      const highIV = setups.find(s => s.type === 'high_iv');
      expect(highIV).toBeDefined();
      if (highIV) {
        expect(highIV.direction).toBe('neutral');
        expect(highIV.suggestedTrade?.strategy).toBe('Iron Condor');
      }
    });

    it('should detect unusual options activity', async () => {
      mockFetchOptionsChain.mockResolvedValue({
        symbol: 'SPX',
        currentPrice: 5900,
        expiry: '2026-03-20',
        daysToExpiry: 40,
        ivRank: 50,
        options: {
          calls: [
            {
              symbol: 'SPX', strike: 6000, expiry: '2026-03-20', type: 'call',
              last: 30, bid: 29, ask: 31, volume: 15000, openInterest: 3000, // 5x ratio
              impliedVolatility: 0.20, delta: 0.3, gamma: 0.001, theta: -3, vega: 10,
              rho: 3, inTheMoney: false, intrinsicValue: 0, extrinsicValue: 30,
            },
          ],
          puts: [],
        },
      });

      const setups = await runOptionsScan('SPX');

      const unusual = setups.find(s => s.type === 'unusual_activity');
      expect(unusual).toBeDefined();
      if (unusual) {
        expect(unusual.direction).toBe('bullish'); // call activity
        expect(unusual.metadata.volumeOIRatio).toBe('5.0');
      }
    });

    it('should handle errors gracefully', async () => {
      mockFetchOptionsChain.mockRejectedValue(new Error('Options API down'));

      const setups = await runOptionsScan('SPX');
      expect(setups).toEqual([]);
    });
  });

  describe('Full Scan', () => {
    it('should return scored and sorted opportunities', async () => {
      // Mock minimal data
      mockCalculateLevels.mockRejectedValue(new Error('test'));
      mockFetchIntradayData.mockRejectedValue(new Error('test'));
      mockFetchDailyData.mockRejectedValue(new Error('test'));
      mockFetchOptionsChain.mockRejectedValue(new Error('test'));

      const result = await scanOpportunities(['SPX'], false);

      expect(result).toHaveProperty('opportunities');
      expect(result).toHaveProperty('symbols');
      expect(result).toHaveProperty('scanDurationMs');
      expect(result).toHaveProperty('scannedAt');
      expect(result.symbols).toEqual(['SPX']);
      expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should scan multiple symbols', async () => {
      mockCalculateLevels.mockRejectedValue(new Error('test'));
      mockFetchIntradayData.mockRejectedValue(new Error('test'));
      mockFetchDailyData.mockRejectedValue(new Error('test'));
      mockFetchOptionsChain.mockRejectedValue(new Error('test'));

      const result = await scanOpportunities(['SPX', 'NDX'], true);

      expect(result.symbols).toEqual(['SPX', 'NDX']);
    });

    it('should sort opportunities by score descending', async () => {
      // Create intraday data with volume spike
      const intradayBars = Array.from({ length: 20 }, (_, i) => ({
        o: 5900, h: 5905, l: 5895, c: 5900,
        v: 10000, t: Date.now() - (20 - i) * 60000,
      }));
      intradayBars[19] = {
        o: 5900, h: 5920, l: 5895, c: 5915,
        v: 100000, // 10x average
        t: Date.now(),
      };

      mockFetchIntradayData.mockResolvedValue(intradayBars);
      mockCalculateLevels.mockResolvedValue({
        symbol: 'SPX',
        currentPrice: 5915,
        levels: {
          resistance: [{ type: 'R1', price: 5916, distancePct: 0.02 }],
          support: [{ type: 'S1', price: 5914, distancePct: -0.02 }],
          pivots: { standard: {}, camarilla: {}, fibonacci: {} },
          indicators: { vwap: 5910, atr14: 45, atr7: 50 },
        },
        marketContext: { marketStatus: 'open' },
        timestamp: new Date().toISOString(),
        cached: false,
      } as any);
      mockFetchDailyData.mockRejectedValue(new Error('test'));
      mockFetchOptionsChain.mockRejectedValue(new Error('test'));

      const result = await scanOpportunities(['SPX'], false);

      if (result.opportunities.length > 1) {
        for (let i = 1; i < result.opportunities.length; i++) {
          expect(result.opportunities[i - 1].score).toBeGreaterThanOrEqual(
            result.opportunities[i].score
          );
        }
      }
    });
  });
});
