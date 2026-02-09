import { executeFunctionCall } from '../functionHandlers';

// Mock logger
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock circuit breaker
jest.mock('../../lib/circuitBreaker', () => ({
  openaiCircuit: {
    execute: jest.fn((fn) => fn()),
  },
  massiveCircuit: {
    execute: jest.fn((fn) => fn()),
  },
}));

// Mock Supabase
const mockSupabaseFrom = jest.fn();
jest.mock('../../config/database', () => ({
  supabase: {
    from: (...args: any[]) => mockSupabaseFrom(...args),
  },
}));

// Mock the services
jest.mock('../../services/levels', () => ({
  calculateLevels: jest.fn()
}));

jest.mock('../../services/levels/fetcher', () => ({
  fetchIntradayData: jest.fn(),
  fetchDailyData: jest.fn()
}));

jest.mock('../../services/options/optionsChainFetcher', () => ({
  fetchOptionsChain: jest.fn()
}));

jest.mock('../../services/options/gexCalculator', () => ({
  calculateGEXProfile: jest.fn()
}));

jest.mock('../../services/options/positionAnalyzer', () => ({
  analyzePosition: jest.fn(),
  analyzePortfolio: jest.fn()
}));

import { calculateLevels } from '../../services/levels';
import { fetchIntradayData, fetchDailyData } from '../../services/levels/fetcher';
import { fetchOptionsChain } from '../../services/options/optionsChainFetcher';
import { calculateGEXProfile } from '../../services/options/gexCalculator';
import { analyzePosition, analyzePortfolio } from '../../services/options/positionAnalyzer';

const mockCalculateLevels = calculateLevels as jest.MockedFunction<typeof calculateLevels>;
const mockFetchIntradayData = fetchIntradayData as jest.MockedFunction<typeof fetchIntradayData>;
const mockFetchDailyData = fetchDailyData as jest.MockedFunction<typeof fetchDailyData>;
const mockFetchOptionsChain = fetchOptionsChain as jest.MockedFunction<typeof fetchOptionsChain>;
const mockCalculateGEXProfile = calculateGEXProfile as jest.MockedFunction<typeof calculateGEXProfile>;
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
      mockFetchDailyData.mockResolvedValue([]);

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

  describe('get_gamma_exposure', () => {
    it('should return gamma exposure profile', async () => {
      mockCalculateGEXProfile.mockResolvedValue({
        symbol: 'SPX',
        spotPrice: 6012.5,
        gexByStrike: [
          {
            strike: 6000,
            gexValue: 1500000,
            callGamma: 0.0042,
            putGamma: 0.0039,
            callOI: 12000,
            putOI: 10500,
          },
        ],
        flipPoint: 5990,
        maxGEXStrike: 6000,
        keyLevels: [{ strike: 6000, gexValue: 1500000, type: 'magnet' }],
        regime: 'positive_gamma',
        implication: 'Positive gamma regime.',
        calculatedAt: '2026-02-09T17:00:00.000Z',
        expirationsAnalyzed: ['2026-02-10', '2026-02-11'],
      });

      const result = await executeFunctionCall({
        name: 'get_gamma_exposure',
        arguments: JSON.stringify({ symbol: 'SPX', strikeRange: 25 }),
      });

      expect(result).toHaveProperty('symbol', 'SPX');
      expect(result).toHaveProperty('spotPrice', 6012.5);
      expect(result).toHaveProperty('regime', 'positive_gamma');
      expect(result).toHaveProperty('flipPoint', 5990);
      expect(result).toHaveProperty('maxGEXStrike', 6000);
      expect(result.keyLevels).toHaveLength(1);
      expect(result.gexByStrike).toHaveLength(1);
      expect(mockCalculateGEXProfile).toHaveBeenCalledWith('SPX', {
        expiry: undefined,
        strikeRange: 25,
        maxExpirations: undefined,
        forceRefresh: false,
      });
    });

    it('should handle calculation errors gracefully', async () => {
      mockCalculateGEXProfile.mockRejectedValue(new Error('Symbol not supported'));

      const result = await executeFunctionCall({
        name: 'get_gamma_exposure',
        arguments: JSON.stringify({ symbol: 'AAPL' }),
      });

      expect(result).toHaveProperty('error', 'Failed to calculate gamma exposure');
      expect(result).toHaveProperty('message', 'Symbol not supported');
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

  describe('get_trade_history', () => {
    it('should return trades and summary for authenticated user', async () => {
      const mockTrades = [
        {
          symbol: 'SPX',
          position_type: 'call',
          strategy: '0DTE Scalp',
          entry_date: '2026-02-01',
          entry_price: 5.50,
          exit_date: '2026-02-01',
          exit_price: 8.20,
          quantity: 2,
          pnl: 540,
          pnl_pct: 49.09,
          trade_outcome: 'win',
        },
        {
          symbol: 'SPX',
          position_type: 'put',
          strategy: 'Credit Spread',
          entry_date: '2026-01-28',
          entry_price: 3.00,
          exit_date: '2026-01-28',
          exit_price: 1.50,
          quantity: 1,
          pnl: -150,
          pnl_pct: -50,
          trade_outcome: 'loss',
        },
      ];

      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockTrades, error: null }),
      };
      const selectFn = jest.fn().mockReturnValue(chain);
      mockSupabaseFrom.mockReturnValue({ select: selectFn });

      const result = await executeFunctionCall(
        { name: 'get_trade_history', arguments: JSON.stringify({ limit: 10 }) },
        { userId: 'user-123' }
      );

      expect(result.trades).toHaveLength(2);
      expect(result.trades[0].symbol).toBe('SPX');
      expect(result.summary.totalTrades).toBe(2);
      expect(result.summary.closedTrades).toBe(2);
      expect(result.summary.wins).toBe(1);
      expect(result.summary.losses).toBe(1);
      expect(result.summary.winRate).toBe('50.0%');
      expect(result.summary.totalPnl).toBe('$390.00');
    });

    it('should filter by symbol when provided', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      const selectFn = jest.fn().mockReturnValue(chain);
      mockSupabaseFrom.mockReturnValue({ select: selectFn });

      await executeFunctionCall(
        { name: 'get_trade_history', arguments: JSON.stringify({ symbol: 'NDX', limit: 5 }) },
        { userId: 'user-123' }
      );

      // eq is called with user_id first, then symbol
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(chain.eq).toHaveBeenCalledWith('symbol', 'NDX');
    });

    it('should return error when userId is not provided', async () => {
      const result = await executeFunctionCall(
        { name: 'get_trade_history', arguments: JSON.stringify({}) }
      );

      expect(result).toHaveProperty('error', 'User not authenticated');
    });

    it('should handle database errors gracefully', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      };
      const selectFn = jest.fn().mockReturnValue(chain);
      mockSupabaseFrom.mockReturnValue({ select: selectFn });

      const result = await executeFunctionCall(
        { name: 'get_trade_history', arguments: JSON.stringify({}) },
        { userId: 'user-123' }
      );

      expect(result).toHaveProperty('error', 'Failed to fetch trade history');
    });
  });

  describe('set_alert', () => {
    it('should create an alert for authenticated user', async () => {
      const mockAlert = {
        id: 'alert-1',
        symbol: 'SPX',
        alert_type: 'price_above',
        target_value: 6000,
        status: 'active',
        created_at: '2026-02-01T10:00:00Z',
      };

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockAlert, error: null }),
      };
      mockSupabaseFrom.mockReturnValue({ insert: jest.fn().mockReturnValue(chain) });

      const result = await executeFunctionCall(
        {
          name: 'set_alert',
          arguments: JSON.stringify({
            symbol: 'SPX',
            alert_type: 'price_above',
            target_value: 6000,
            notes: 'Watch resistance',
          }),
        },
        { userId: 'user-123' }
      );

      expect(result.success).toBe(true);
      expect(result.alert.id).toBe('alert-1');
      expect(result.alert.symbol).toBe('SPX');
      expect(result.alert.type).toBe('Price Above');
      expect(result.message).toContain('Price Above');
      expect(result.message).toContain('6000');
    });

    it('should return error when userId is not provided', async () => {
      const result = await executeFunctionCall({
        name: 'set_alert',
        arguments: JSON.stringify({
          symbol: 'SPX',
          alert_type: 'price_above',
          target_value: 6000,
        }),
      });

      expect(result).toHaveProperty('error', 'User not authenticated');
    });

    it('should handle database errors gracefully', async () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      };
      mockSupabaseFrom.mockReturnValue({ insert: jest.fn().mockReturnValue(chain) });

      const result = await executeFunctionCall(
        {
          name: 'set_alert',
          arguments: JSON.stringify({
            symbol: 'SPX',
            alert_type: 'price_above',
            target_value: 6000,
          }),
        },
        { userId: 'user-123' }
      );

      expect(result).toHaveProperty('error', 'Failed to create alert');
    });
  });

  describe('get_alerts', () => {
    it('should return alerts for authenticated user', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          symbol: 'SPX',
          alert_type: 'price_above',
          target_value: 6000,
          status: 'active',
          condition_met: null,
          triggered_at: null,
          notes: null,
          created_at: '2026-02-01T10:00:00Z',
        },
        {
          id: 'alert-2',
          symbol: 'NDX',
          alert_type: 'price_below',
          target_value: 20000,
          status: 'triggered',
          condition_met: true,
          triggered_at: '2026-02-02T14:30:00Z',
          notes: 'Support break',
          created_at: '2026-02-01T09:00:00Z',
        },
      ];

      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockAlerts, error: null }),
      };
      const selectFn = jest.fn().mockReturnValue(chain);
      mockSupabaseFrom.mockReturnValue({ select: selectFn });

      const result = await executeFunctionCall(
        { name: 'get_alerts', arguments: JSON.stringify({ status: 'active' }) },
        { userId: 'user-123' }
      );

      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0].symbol).toBe('SPX');
      expect(result.alerts[0].type).toBe('Price Above');
      expect(result.alerts[1].type).toBe('Price Below');
      expect(result.count).toBe(2);
    });

    it('should filter by symbol when provided', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      const selectFn = jest.fn().mockReturnValue(chain);
      mockSupabaseFrom.mockReturnValue({ select: selectFn });

      await executeFunctionCall(
        { name: 'get_alerts', arguments: JSON.stringify({ symbol: 'NDX' }) },
        { userId: 'user-123' }
      );

      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(chain.eq).toHaveBeenCalledWith('symbol', 'NDX');
    });

    it('should return error when userId is not provided', async () => {
      const result = await executeFunctionCall({
        name: 'get_alerts',
        arguments: JSON.stringify({}),
      });

      expect(result).toHaveProperty('error', 'User not authenticated');
    });

    it('should handle database errors gracefully', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      };
      const selectFn = jest.fn().mockReturnValue(chain);
      mockSupabaseFrom.mockReturnValue({ select: selectFn });

      const result = await executeFunctionCall(
        { name: 'get_alerts', arguments: JSON.stringify({}) },
        { userId: 'user-123' }
      );

      expect(result).toHaveProperty('error', 'Failed to fetch alerts');
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
