import { executeFunctionCall } from '../functionHandlers';

// Mock the services
jest.mock('../../services/levels', () => ({
  calculateLevels: jest.fn()
}));

jest.mock('../../services/levels/fetcher', () => ({
  fetchIntradayData: jest.fn()
}));

jest.mock('../../services/options/optionsChainFetcher', () => ({
  fetchOptionsChain: jest.fn()
}));

jest.mock('../../services/options/positionAnalyzer', () => ({
  analyzePosition: jest.fn(),
  analyzePortfolio: jest.fn()
}));

import { calculateLevels } from '../../services/levels';
import { fetchIntradayData } from '../../services/levels/fetcher';
import { fetchOptionsChain } from '../../services/options/optionsChainFetcher';
import { analyzePosition, analyzePortfolio } from '../../services/options/positionAnalyzer';

const mockCalculateLevels = calculateLevels as jest.MockedFunction<typeof calculateLevels>;
const mockFetchIntradayData = fetchIntradayData as jest.MockedFunction<typeof fetchIntradayData>;
const mockFetchOptionsChain = fetchOptionsChain as jest.MockedFunction<typeof fetchOptionsChain>;
const mockAnalyzePosition = analyzePosition as jest.MockedFunction<typeof analyzePosition>;
const mockAnalyzePortfolio = analyzePortfolio as jest.MockedFunction<typeof analyzePortfolio>;

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

  describe('get_options_chain', () => {
    it('should return options chain', async () => {
      mockFetchOptionsChain.mockResolvedValue({
        symbol: 'SPX',
        currentPrice: 5900,
        expiry: '2026-02-28',
        daysToExpiry: 26,
        ivRank: 25,
        options: {
          calls: [
            {
              symbol: 'SPX',
              strike: 5900,
              expiry: '2026-02-28',
              type: 'call',
              last: 50,
              bid: 49,
              ask: 51,
              volume: 1000,
              openInterest: 5000,
              impliedVolatility: 0.15,
              delta: 0.5,
              gamma: 0.001,
              theta: -2.5,
              vega: 12,
              rho: 5,
              inTheMoney: false,
              intrinsicValue: 0,
              extrinsicValue: 50
            }
          ],
          puts: [
            {
              symbol: 'SPX',
              strike: 5900,
              expiry: '2026-02-28',
              type: 'put',
              last: 45,
              bid: 44,
              ask: 46,
              volume: 800,
              openInterest: 4500,
              impliedVolatility: 0.16,
              delta: -0.5,
              gamma: 0.001,
              theta: -2.3,
              vega: 11,
              rho: -4,
              inTheMoney: false,
              intrinsicValue: 0,
              extrinsicValue: 45
            }
          ]
        }
      });

      const result = await executeFunctionCall({
        name: 'get_options_chain',
        arguments: JSON.stringify({ symbol: 'SPX', strikeRange: 10 })
      });

      expect(result).toHaveProperty('symbol', 'SPX');
      expect(result).toHaveProperty('currentPrice', 5900);
      expect(result).toHaveProperty('calls');
      expect(result).toHaveProperty('puts');
      expect(result.calls).toHaveLength(1);
      expect(result.puts).toHaveLength(1);
      expect(result.calls[0]).toHaveProperty('strike', 5900);
      expect(result.calls[0]).toHaveProperty('delta');
      expect(result.calls[0]).toHaveProperty('iv');
      expect(mockFetchOptionsChain).toHaveBeenCalledWith('SPX', undefined, 10);
    });

    it('should handle errors gracefully', async () => {
      mockFetchOptionsChain.mockRejectedValue(new Error('No options found'));

      const result = await executeFunctionCall({
        name: 'get_options_chain',
        arguments: JSON.stringify({ symbol: 'SPX' })
      });

      expect(result).toHaveProperty('error', 'Failed to fetch options chain');
      expect(result).toHaveProperty('message', 'No options found');
    });
  });

  describe('analyze_position', () => {
    it('should analyze a single position', async () => {
      mockAnalyzePosition.mockResolvedValue({
        position: {
          symbol: 'SPX',
          type: 'call',
          strike: 5900,
          expiry: '2026-02-28',
          quantity: 2,
          entryPrice: 30,
          entryDate: '2026-02-01'
        },
        currentValue: 10000,
        costBasis: 6000,
        pnl: 4000,
        pnlPct: 66.67,
        daysHeld: 1,
        daysToExpiry: 27,
        breakeven: 5930,
        maxGain: 'unlimited',
        maxLoss: 6000,
        riskRewardRatio: undefined,
        greeks: {
          delta: 100,
          gamma: 0.2,
          theta: -5,
          vega: 24,
          rho: 10
        }
      });

      const result = await executeFunctionCall({
        name: 'analyze_position',
        arguments: JSON.stringify({
          position: {
            symbol: 'SPX',
            type: 'call',
            strike: 5900,
            expiry: '2026-02-28',
            quantity: 2,
            entryPrice: 30,
            entryDate: '2026-02-01'
          }
        })
      });

      expect(result).toHaveProperty('position');
      expect(result).toHaveProperty('currentValue', '$10000.00');
      expect(result).toHaveProperty('costBasis', '$6000.00');
      expect(result).toHaveProperty('pnl', '$4000.00');
      expect(result).toHaveProperty('pnlPct', '66.67%');
      expect(result).toHaveProperty('maxGain', 'unlimited');
      expect(result).toHaveProperty('maxLoss', '$6000.00');
      expect(result).toHaveProperty('greeks');
      expect(mockAnalyzePosition).toHaveBeenCalled();
    });

    it('should analyze a portfolio', async () => {
      mockAnalyzePortfolio.mockResolvedValue({
        positions: [
          {
            position: {
              symbol: 'SPX',
              type: 'call',
              strike: 5900,
              expiry: '2026-02-28',
              quantity: 1,
              entryPrice: 30,
              entryDate: '2026-02-01'
            },
            currentValue: 5000,
            costBasis: 3000,
            pnl: 2000,
            pnlPct: 66.67,
            daysHeld: 1,
            daysToExpiry: 27,
            breakeven: 5930,
            maxGain: 'unlimited',
            maxLoss: 3000,
            riskRewardRatio: undefined,
            greeks: {
              delta: 50,
              gamma: 0.1,
              theta: -2.5,
              vega: 12
            }
          }
        ],
        portfolio: {
          totalValue: 5000,
          totalCostBasis: 3000,
          totalPnl: 2000,
          totalPnlPct: 66.67,
          portfolioGreeks: {
            delta: 50,
            gamma: 0.1,
            theta: -2.5,
            vega: 12
          },
          risk: {
            maxLoss: 'unlimited',
            maxGain: 3000,
            buyingPowerUsed: 3000
          },
          riskAssessment: {
            overall: 'moderate',
            warnings: ['1 position(s) with unlimited risk']
          }
        }
      });

      const result = await executeFunctionCall({
        name: 'analyze_position',
        arguments: JSON.stringify({
          positions: [
            {
              symbol: 'SPX',
              type: 'call',
              strike: 5900,
              expiry: '2026-02-28',
              quantity: 1,
              entryPrice: 30,
              entryDate: '2026-02-01'
            }
          ]
        })
      });

      expect(result).toHaveProperty('positionCount', 1);
      expect(result).toHaveProperty('portfolio');
      expect(result.portfolio).toHaveProperty('totalValue', '$5000.00');
      expect(result.portfolio).toHaveProperty('totalPnl', '$2000.00');
      expect(result.portfolio).toHaveProperty('portfolioGreeks');
      expect(result.portfolio).toHaveProperty('riskAssessment');
      expect(result.portfolio.riskAssessment).toHaveProperty('level', 'moderate');
      expect(mockAnalyzePortfolio).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockAnalyzePosition.mockRejectedValue(new Error('Failed to fetch data'));

      const result = await executeFunctionCall({
        name: 'analyze_position',
        arguments: JSON.stringify({
          position: {
            symbol: 'SPX',
            type: 'call',
            strike: 5900,
            expiry: '2026-02-28',
            quantity: 1,
            entryPrice: 30,
            entryDate: '2026-02-01'
          }
        })
      });

      expect(result).toHaveProperty('error', 'Failed to analyze position');
      expect(result).toHaveProperty('message', 'Failed to fetch data');
    });
  });

  describe('show_chart', () => {
    it('should return chart config with levels', async () => {
      mockCalculateLevels.mockResolvedValue({
        symbol: 'SPX',
        currentPrice: 5950,
        timestamp: '2026-02-07T15:30:00Z',
        levels: {
          resistance: [
            { name: 'PDH', price: 5960, distance: '+$10' },
            { name: 'R1', price: 5975, distance: '+$25' }
          ],
          support: [
            { name: 'PDL', price: 5920, distance: '-$30' },
            { name: 'S1', price: 5910, distance: '-$40' }
          ],
          pivots: { standard: {} },
          indicators: { vwap: 5945, atr14: 25 }
        },
        marketContext: { marketStatus: 'open', sessionType: 'regular', timeSinceOpen: '6h 0m' },
        cached: false
      } as any);

      const result = await executeFunctionCall({
        name: 'show_chart',
        arguments: JSON.stringify({ symbol: 'SPX', timeframe: '1D' })
      });

      expect(result).toHaveProperty('action', 'show_chart');
      expect(result).toHaveProperty('symbol', 'SPX');
      expect(result).toHaveProperty('timeframe', '1D');
      expect(result).toHaveProperty('currentPrice', 5950);
      expect(result.levels.resistance).toHaveLength(2);
      expect(result.levels.support).toHaveLength(2);
      expect(result.levels.indicators).toHaveProperty('vwap', 5945);
      expect(mockCalculateLevels).toHaveBeenCalledWith('SPX', 'intraday');
    });

    it('should handle levels fetch error gracefully', async () => {
      mockCalculateLevels.mockRejectedValue(new Error('API unavailable'));

      const result = await executeFunctionCall({
        name: 'show_chart',
        arguments: JSON.stringify({ symbol: 'NDX' })
      });

      expect(result).toHaveProperty('action', 'show_chart');
      expect(result).toHaveProperty('symbol', 'NDX');
      expect(result).toHaveProperty('timeframe', '1D');
      expect(result).toHaveProperty('error');
    });

    it('should default timeframe to 1D', async () => {
      mockCalculateLevels.mockRejectedValue(new Error('test'));

      const result = await executeFunctionCall({
        name: 'show_chart',
        arguments: JSON.stringify({ symbol: 'SPX' })
      });

      expect(result.timeframe).toBe('1D');
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
