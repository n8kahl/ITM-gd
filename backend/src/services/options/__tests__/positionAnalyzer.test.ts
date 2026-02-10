// Mock the modules before importing
jest.mock('../../../config/massive');
jest.mock('../optionsChainFetcher');

import { analyzePosition, analyzePortfolio } from '../positionAnalyzer';
import { Position } from '../types';
import * as optionsChainFetcher from '../optionsChainFetcher';

const mockFetchOptionContract = optionsChainFetcher.fetchOptionContract as jest.MockedFunction<
  typeof optionsChainFetcher.fetchOptionContract
>;

describe('Position Analyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock response
    mockFetchOptionContract.mockResolvedValue({
      symbol: 'SPX',
      strike: 5900,
      expiry: '2026-03-31',
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
    });
  });

  describe('analyzePosition - Long Call', () => {
    it('should analyze a profitable long call', async () => {
      const position: Position = {
        symbol: 'SPX',
        type: 'call',
        strike: 5900,
        expiry: '2026-03-31',
        quantity: 2,
        entryPrice: 30,
        entryDate: '2026-02-01'
      };

      // Mock current price at $50 (up from $30 entry)
      mockFetchOptionContract.mockResolvedValue({
        symbol: 'SPX',
        strike: 5900,
        expiry: '2026-03-31',
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
      });

      const analysis = await analyzePosition(position);

      // Cost basis: $30 * 100 * 2 = $6,000
      expect(analysis.costBasis).toBe(6000);

      // Current value: $50 * 100 * 2 = $10,000
      expect(analysis.currentValue).toBe(10000);

      // P&L: $10,000 - $6,000 = $4,000 profit
      expect(analysis.pnl).toBe(4000);

      // P&L %: 4000 / 6000 = 66.67%
      expect(analysis.pnlPct).toBeCloseTo(66.67, 1);

      // Should have Greeks
      expect(analysis.greeks).toBeDefined();
      expect(analysis.greeks?.delta).toBeDefined();

      // Max loss should be premium paid
      expect(analysis.maxLoss).toBe(6000);

      // Max gain should be unlimited
      expect(analysis.maxGain).toBe('unlimited');

      // Breakeven should be strike + entry price
      expect(analysis.breakeven).toBe(5930);
    });

    it('should analyze a losing long call', async () => {
      const position: Position = {
        symbol: 'SPX',
        type: 'call',
        strike: 5900,
        expiry: '2026-03-31',
        quantity: 1,
        entryPrice: 50,
        entryDate: '2026-02-01'
      };

      // Mock current price at $20 (down from $50 entry)
      mockFetchOptionContract.mockResolvedValue({
        symbol: 'SPX',
        strike: 5900,
        expiry: '2026-03-31',
        type: 'call',
        last: 20,
        bid: 19,
        ask: 21,
        volume: 500,
        openInterest: 3000,
        impliedVolatility: 0.12,
        delta: 0.3,
        gamma: 0.001,
        theta: -3,
        vega: 8,
        rho: 3,
        inTheMoney: false,
        intrinsicValue: 0,
        extrinsicValue: 20
      });

      const analysis = await analyzePosition(position);

      // Cost basis: $50 * 100 = $5,000
      expect(analysis.costBasis).toBe(5000);

      // Current value: $20 * 100 = $2,000
      expect(analysis.currentValue).toBe(2000);

      // P&L: $2,000 - $5,000 = -$3,000 loss
      expect(analysis.pnl).toBe(-3000);

      // P&L %: -3000 / 5000 = -60%
      expect(analysis.pnlPct).toBeCloseTo(-60, 1);
    });
  });

  describe('analyzePosition - Short Put', () => {
    it('should analyze a profitable short put', async () => {
      const position: Position = {
        symbol: 'SPX',
        type: 'put',
        strike: 5800,
        expiry: '2026-03-31',
        quantity: -1, // Short position
        entryPrice: 40, // Premium collected
        entryDate: '2026-02-01'
      };

      // Mock current price at $20 (down from $40, good for short)
      mockFetchOptionContract.mockResolvedValue({
        symbol: 'SPX',
        strike: 5800,
        expiry: '2026-03-31',
        type: 'put',
        last: 20,
        bid: 19,
        ask: 21,
        volume: 800,
        openInterest: 4000,
        impliedVolatility: 0.14,
        delta: -0.3,
        gamma: 0.001,
        theta: -2,
        vega: 10,
        rho: -4,
        inTheMoney: false,
        intrinsicValue: 0,
        extrinsicValue: 20
      });

      const analysis = await analyzePosition(position);

      // Cost basis: $40 * 100 = $4,000 (credit received)
      expect(analysis.costBasis).toBe(4000);

      // Current value: $20 * 100 = $2,000 (to buy back)
      expect(analysis.currentValue).toBe(2000);

      // P&L: $4,000 - $2,000 = $2,000 profit (for short)
      expect(analysis.pnl).toBe(2000);

      // Max gain should be premium collected
      expect(analysis.maxGain).toBe(4000);

      // Max loss should be strike * 100 - premium
      expect(analysis.maxLoss).toBe(5800 * 100 - 4000); // $576,000
    });
  });

  describe('analyzePosition - Stock', () => {
    it('should analyze a stock position', async () => {
      const position: Position = {
        symbol: 'SPX',
        type: 'stock',
        quantity: 100,
        entryPrice: 5800,
        currentPrice: 5900,
        entryDate: '2026-01-15'
      };

      const analysis = await analyzePosition(position);

      // Cost basis: $5,800 * 100 = $580,000
      expect(analysis.costBasis).toBe(580000);

      // Current value: $5,900 * 100 = $590,000
      expect(analysis.currentValue).toBe(590000);

      // P&L: $10,000 profit
      expect(analysis.pnl).toBe(10000);

      // Max gain: unlimited
      expect(analysis.maxGain).toBe('unlimited');

      // Max loss: full cost basis for long stock
      expect(analysis.maxLoss).toBe(580000);

      // No expiry for stock
      expect(analysis.daysToExpiry).toBeUndefined();
    });

    it('should model short stock as unlimited risk with limited upside', async () => {
      const position: Position = {
        symbol: 'SPX',
        type: 'stock',
        quantity: -25,
        entryPrice: 5800,
        currentPrice: 5700,
        entryDate: '2026-01-15'
      };

      const analysis = await analyzePosition(position);

      // Short stock gains when price drops
      expect(analysis.pnl).toBe(2500);

      // Max gain capped if underlying goes to zero
      expect(analysis.maxGain).toBe(145000);

      // Short stock downside is theoretically unlimited
      expect(analysis.maxLoss).toBe('unlimited');
    });
  });

  describe('analyzePortfolio', () => {
    it('should analyze multiple positions', async () => {
      const positions: Position[] = [
        {
          symbol: 'SPX',
          type: 'call',
          strike: 5900,
          expiry: '2026-03-31',
          quantity: 2,
          entryPrice: 30,
          entryDate: '2026-02-01'
        },
        {
          symbol: 'SPX',
          type: 'put',
          strike: 5800,
          expiry: '2026-03-31',
          quantity: -1,
          entryPrice: 40,
          entryDate: '2026-02-01'
        }
      ];

      mockFetchOptionContract
        .mockResolvedValueOnce({
          symbol: 'SPX',
          strike: 5900,
          expiry: '2026-03-31',
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
        })
        .mockResolvedValueOnce({
          symbol: 'SPX',
          strike: 5800,
          expiry: '2026-03-31',
          type: 'put',
          last: 20,
          bid: 19,
          ask: 21,
          volume: 800,
          openInterest: 4000,
          impliedVolatility: 0.14,
          delta: -0.3,
          gamma: 0.001,
          theta: -2,
          vega: 10,
          rho: -4,
          inTheMoney: false,
          intrinsicValue: 0,
          extrinsicValue: 20
        });

      const analysis = await analyzePortfolio(positions);

      expect(analysis.positions).toHaveLength(2);
      expect(analysis.portfolio.totalValue).toBeDefined();
      expect(analysis.portfolio.totalPnl).toBeDefined();
      expect(analysis.portfolio.portfolioGreeks).toBeDefined();
      expect(analysis.portfolio.riskAssessment).toBeDefined();
    });

    it('should calculate portfolio Greeks', async () => {
      const positions: Position[] = [
        {
          symbol: 'SPX',
          type: 'call',
          strike: 5900,
          expiry: '2026-03-31',
          quantity: 1,
          entryPrice: 30,
          entryDate: '2026-02-01'
        }
      ];

      mockFetchOptionContract.mockResolvedValue({
        symbol: 'SPX',
        strike: 5900,
        expiry: '2026-03-31',
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
      });

      const analysis = await analyzePortfolio(positions);

      // Portfolio delta should be 0.5 * 100 = 50
      expect(analysis.portfolio.portfolioGreeks.delta).toBe(50);
    });

    it('should assess portfolio risk', async () => {
      // Create a risky portfolio with unlimited risk
      const positions: Position[] = [
        {
          symbol: 'SPX',
          type: 'call',
          strike: 5900,
          expiry: '2026-03-31',
          quantity: -10, // Short 10 calls (unlimited risk)
          entryPrice: 30,
          entryDate: '2026-02-01'
        }
      ];

      mockFetchOptionContract.mockResolvedValue({
        symbol: 'SPX',
        strike: 5900,
        expiry: '2026-03-31',
        type: 'call',
        last: 40,
        bid: 39,
        ask: 41,
        volume: 2000,
        openInterest: 8000,
        impliedVolatility: 0.18,
        delta: 0.6,
        gamma: 0.001,
        theta: -3,
        vega: 15,
        rho: 6,
        inTheMoney: true,
        intrinsicValue: 10,
        extrinsicValue: 30
      });

      const analysis = await analyzePortfolio(positions);

      // Should flag as extreme risk due to unlimited risk
      expect(analysis.portfolio.riskAssessment.overall).toBe('extreme');
      expect(analysis.portfolio.riskAssessment.warnings.length).toBeGreaterThan(0);
      expect(analysis.portfolio.risk.maxLoss).toBe('unlimited');
    });
  });

  describe('Edge cases', () => {
    it('should handle failed option data fetch gracefully', async () => {
      mockFetchOptionContract.mockResolvedValue(null);

      const position: Position = {
        symbol: 'SPX',
        type: 'call',
        strike: 5900,
        expiry: '2026-03-31',
        quantity: 1,
        entryPrice: 30,
        entryDate: '2026-02-01'
      };

      const analysis = await analyzePosition(position);

      // Should use entry price if current price unavailable
      expect(analysis.currentValue).toBe(3000); // entry price * 100
    });

    it('should calculate days held correctly', async () => {
      const position: Position = {
        symbol: 'SPX',
        type: 'call',
        strike: 5900,
        expiry: '2026-03-31',
        quantity: 1,
        entryPrice: 30,
        entryDate: '2026-02-01'
      };

      const analysis = await analyzePosition(position);

      expect(analysis.daysHeld).toBeGreaterThanOrEqual(0);
    });
  });
});
