import { executeFunctionCall } from '../functionHandlers';

/**
 * Tests for WP8 function handlers
 * Tests the new long-term trend, LEAPS, swing, roll, and macro handlers
 */

// Mock dependencies
jest.mock('../../services/charts/chartDataService', () => ({
  analyzeLongTermTrend: jest.fn().mockResolvedValue({
    symbol: 'NDX',
    timeframe: 'weekly',
    currentPrice: 21000,
    trendDirection: 'bullish',
    ema50: 20500,
    ema200: 19000,
    ema50Status: 'above',
    ema200Status: 'above',
    nextResistance: { price: 22000, description: 'Weekly high', distance: 1000 },
    keySupport: { price: 20500, description: '50-week EMA', distance: -500 },
    interpretation: 'NDX is in a bullish trend on the weekly timeframe.',
  }),
}));

jest.mock('../../services/leaps/greeksProjection', () => ({
  generateGreeksProjection: jest.fn().mockReturnValue({
    symbol: 'NDX',
    optionType: 'call',
    strike: 20000,
    currentPrice: 21000,
    currentDte: 300,
    impliedVolatility: 0.25,
    projections: [
      { dte: 300, date: '2026-02-08', delta: 0.78, gamma: 0.008, theta: -4, vega: 180, projectedValue: 3600, notes: 'Current' },
      { dte: 293, date: '2026-02-15', delta: 0.79, gamma: 0.007, theta: -4.5, vega: 175, projectedValue: 3550, notes: '1 week out' },
      { dte: 270, date: '2026-03-10', delta: 0.81, gamma: 0.006, theta: -6, vega: 160, projectedValue: 3450, notes: '1 month out' },
    ],
  }),
  assessGreeksTrend: jest.fn().mockReturnValue('improving'),
}));

jest.mock('../../services/leaps/rollCalculator', () => ({
  calculateRoll: jest.fn().mockReturnValue({
    current: {
      strike: 20000,
      expiry: '2027-01-15',
      daysToExpiry: 340,
      value: 3680,
      greeks: { delta: 0.78, gamma: 0.008, theta: -4, vega: 180 },
    },
    new: {
      strike: 21000,
      expiry: '2027-01-15',
      daysToExpiry: 340,
      value: 2900,
      greeks: { delta: 0.65, gamma: 0.010, theta: -5, vega: 190 },
    },
    rollAnalysis: {
      netCreditDebit: 78000,
      capitalFreed: 78000,
      newBreakEven: 23900,
      recommendation: 'Good roll candidate',
      pros: ['Lock in gains'],
      cons: ['Higher theta'],
    },
  }),
}));

jest.mock('../../services/macro/macroContext', () => ({
  getMacroContext: jest.fn().mockResolvedValue({
    economicCalendar: [
      { date: '2026-02-10', event: 'CPI', expected: null, previous: null, actual: null, impact: 'HIGH', relevance: 'Key inflation' },
    ],
    fedPolicy: {
      currentRate: '4.25-4.50%',
      nextMeetingDate: '2026-03-18',
      marketImpliedProbabilities: { hold: 0.65, cut25: 0.30, hike25: 0.05 },
      currentTone: 'neutral',
      expectedOutcome: 'Hold expected',
    },
    sectorRotation: {
      sectors: [
        { name: 'Technology', returns: { oneDay: 0, oneWeek: 0, oneMonth: 0 }, relativeStrength: 'strong', trend: 'bullish' },
        { name: 'Energy', returns: { oneDay: 0, oneWeek: 0, oneMonth: 0 }, relativeStrength: 'weak', trend: 'bearish' },
      ],
      moneyFlowDirection: 'INTO Technology | OUT OF Energy',
    },
    earningsSeason: {
      currentPhase: 'Q4 2025 Earnings',
      beatRate: 0.78,
      upcomingEvents: [],
      implication: 'Strong earnings',
    },
    timestamp: new Date().toISOString(),
  }),
  assessMacroImpact: jest.fn().mockResolvedValue({
    upcomingCatalysts: [{ date: '2026-03-18', event: 'FOMC Meeting', expectedImpact: 'Rate decision' }],
    bullishFactors: ['Rate cuts possible'],
    bearishFactors: ['Hawkish rhetoric'],
    riskFactors: ['CPI volatility'],
    overallOutlook: 'bullish',
    adviceForLEAPS: 'Hold NDX LEAPS',
  }),
}));

jest.mock('../../services/levels/fetcher', () => ({
  fetchIntradayData: jest.fn().mockResolvedValue([
    { o: 21000, h: 21100, l: 20900, c: 21050, v: 1000000, t: Date.now() },
  ]),
}));

jest.mock('../../services/levels', () => ({
  calculateLevels: jest.fn().mockResolvedValue({
    symbol: 'SPX',
    currentPrice: 5900,
    levels: {
      resistance: [{ name: 'R1', price: 5950 }, { name: 'R2', price: 6000 }],
      support: [{ name: 'S1', price: 5850 }, { name: 'S2', price: 5800 }],
      pivots: { pp: 5900, r1: 5950, r2: 6000, s1: 5850, s2: 5800 },
      indicators: { vwap: 5890, atr14: 30 },
    },
    marketContext: {},
    timestamp: new Date().toISOString(),
  }),
}));

jest.mock('../../services/options/blackScholes', () => ({
  daysToExpiry: jest.fn().mockReturnValue(300),
  daysToYears: jest.fn().mockReturnValue(0.822),
  calculateBlackScholes: jest.fn().mockReturnValue({
    price: 3600,
    greeks: { delta: 0.78, gamma: 0.008, theta: -4, vega: 180, rho: 50 },
  }),
}));

jest.mock('../../config/database', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('../../services/options/optionsChainFetcher', () => ({
  fetchOptionsChain: jest.fn(),
}));

jest.mock('../../services/options/positionAnalyzer', () => ({
  analyzePosition: jest.fn(),
  analyzePortfolio: jest.fn(),
}));

jest.mock('../../services/marketHours', () => ({
  getMarketStatus: jest.fn(),
}));

jest.mock('../../services/scanner', () => ({
  scanOpportunities: jest.fn(),
}));

describe('WP8 Function Handlers', () => {
  describe('get_long_term_trend', () => {
    it('returns trend analysis for NDX weekly', async () => {
      const result = await executeFunctionCall({
        name: 'get_long_term_trend',
        arguments: JSON.stringify({ symbol: 'NDX', timeframe: 'weekly' }),
      });

      expect(result.symbol).toBe('NDX');
      expect(result.trendDirection).toBe('bullish');
      expect(result.ema50).toBe(20500);
      expect(result.ema200).toBe(19000);
      expect(result.ema50Status).toBe('above');
      expect(result.interpretation).toBeTruthy();
    });

    it('defaults to weekly timeframe', async () => {
      const result = await executeFunctionCall({
        name: 'get_long_term_trend',
        arguments: JSON.stringify({ symbol: 'SPX' }),
      });

      expect(result.timeframe).toBe('weekly');
    });
  });

  describe('analyze_leaps_position', () => {
    it('returns comprehensive LEAPS analysis', async () => {
      const result = await executeFunctionCall({
        name: 'analyze_leaps_position',
        arguments: JSON.stringify({
          symbol: 'NDX',
          option_type: 'call',
          strike: 20000,
          entry_price: 2500,
          entry_date: '2025-06-01',
          expiry_date: '2027-01-15',
        }),
      });

      expect(result.symbol).toBe('NDX');
      expect(result.strike).toBe(20000);
      expect(result.daysToExpiry).toBe(300);
      expect(result.greeks).toBeDefined();
      expect(result.greeksTrend).toBe('improving');
      expect(result.macroOutlook).toBe('bullish');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('includes Greeks projection', async () => {
      const result = await executeFunctionCall({
        name: 'analyze_leaps_position',
        arguments: JSON.stringify({
          symbol: 'NDX',
          option_type: 'call',
          strike: 20000,
          entry_price: 2500,
          entry_date: '2025-06-01',
          expiry_date: '2027-01-15',
        }),
      });

      expect(result.greeksProjection).toBeDefined();
      expect(result.greeksProjection.length).toBeGreaterThan(0);
    });

    it('includes macro highlights', async () => {
      const result = await executeFunctionCall({
        name: 'analyze_leaps_position',
        arguments: JSON.stringify({
          symbol: 'NDX',
          option_type: 'call',
          strike: 20000,
          entry_price: 2500,
          entry_date: '2025-06-01',
          expiry_date: '2027-01-15',
        }),
      });

      expect(result.macroHighlights).toBeDefined();
      expect(result.macroHighlights.bullish).toBeDefined();
      expect(result.macroHighlights.bearish).toBeDefined();
      expect(result.macroHighlights.catalysts).toBeDefined();
    });
  });

  describe('analyze_swing_trade', () => {
    it('returns swing trade analysis with targets', async () => {
      const result = await executeFunctionCall({
        name: 'analyze_swing_trade',
        arguments: JSON.stringify({
          symbol: 'SPX',
          entry_price: 5850,
          current_price: 5900,
          entry_date: '2026-02-01',
          direction: 'long',
        }),
      });

      expect(result.symbol).toBe('SPX');
      expect(result.direction).toBe('long');
      expect(result.pnlPct).toBeTruthy();
      expect(result.technicalSetup).toBeTruthy();
      expect(result.nextTargets).toBeDefined();
      expect(result.stopLevelRecommendation).toBeDefined();
      expect(result.riskRewardRatio).toBeDefined();
      expect(result.timeHorizon).toBeTruthy();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('calculates correct P&L for long trade', async () => {
      const result = await executeFunctionCall({
        name: 'analyze_swing_trade',
        arguments: JSON.stringify({
          symbol: 'SPX',
          entry_price: 5800,
          current_price: 5900,
          entry_date: '2026-02-01',
          direction: 'long',
        }),
      });

      // (5900 - 5800) / 5800 * 100 ≈ 1.7%
      const pnl = parseFloat(result.pnlPct);
      expect(pnl).toBeGreaterThan(0);
    });

    it('identifies stop level for long trade', async () => {
      const result = await executeFunctionCall({
        name: 'analyze_swing_trade',
        arguments: JSON.stringify({
          symbol: 'SPX',
          entry_price: 5850,
          current_price: 5900,
          entry_date: '2026-02-01',
          direction: 'long',
        }),
      });

      // Stop should be below current price for long
      expect(result.stopLevelRecommendation).toBeLessThan(5900);
    });
  });

  describe('calculate_roll_decision', () => {
    it('returns roll analysis', async () => {
      const result = await executeFunctionCall({
        name: 'calculate_roll_decision',
        arguments: JSON.stringify({
          symbol: 'NDX',
          option_type: 'call',
          current_strike: 20000,
          current_expiry: '2027-01-15',
          new_strike: 21000,
          current_price: 21500,
        }),
      });

      expect(result.current).toBeDefined();
      expect(result.new).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.analysis.netCreditDebit).toBeTruthy();
      expect(result.analysis.recommendation).toBeTruthy();
      expect(result.analysis.pros).toBeDefined();
      expect(result.analysis.cons).toBeDefined();
    });
  });

  describe('get_macro_context', () => {
    it('returns macro context without symbol', async () => {
      const result = await executeFunctionCall({
        name: 'get_macro_context',
        arguments: JSON.stringify({}),
      });

      expect(result.economicCalendar).toBeDefined();
      expect(result.fedPolicy).toBeDefined();
      expect(result.earningsSeason).toBeDefined();
      expect(result.sectorRotation).toBeDefined();
    });

    it('includes symbol-specific impact when symbol provided', async () => {
      const result = await executeFunctionCall({
        name: 'get_macro_context',
        arguments: JSON.stringify({ symbol: 'NDX' }),
      });

      expect(result.symbolImpact).toBeDefined();
      expect(result.symbolImpact.symbol).toBe('NDX');
      expect(result.symbolImpact.outlook).toBe('bullish');
      expect(result.symbolImpact.advice).toBeTruthy();
    });

    it('returns Fed policy data', async () => {
      const result = await executeFunctionCall({
        name: 'get_macro_context',
        arguments: JSON.stringify({}),
      });

      expect(result.fedPolicy.currentRate).toBe('4.25-4.50%');
      expect(result.fedPolicy.tone).toBe('neutral');
      expect(result.fedPolicy.probabilities).toBeDefined();
    });
  });
});
