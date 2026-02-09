jest.mock('../../../config/massive', () => ({
  massiveClient: { get: jest.fn() },
  getDailyAggregates: jest.fn(),
}));

jest.mock('../../../config/database', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

jest.mock('../../options/optionsChainFetcher', () => ({
  fetchExpirationDates: jest.fn(),
  fetchOptionsChain: jest.fn(),
}));

jest.mock('../../options/ivAnalysis', () => ({
  analyzeIVProfile: jest.fn(),
}));

import { __testables } from '../index';

describe('earnings service helpers', () => {
  it('classifies earnings timing tokens correctly', () => {
    expect(__testables.classifyEarningsTiming({ time: 'After Market Close' } as any)).toBe('AMC');
    expect(__testables.classifyEarningsTiming({ session: 'BMO' } as any)).toBe('BMO');
    expect(__testables.classifyEarningsTiming({} as any)).toBe('DURING');
  });

  it('builds premium-selling strategies when move is overpriced', () => {
    const strategies = __testables.buildSuggestedStrategies({
      symbol: 'SPX',
      moveOverpricing: 28,
      expectedMovePct: 2.1,
      ivRank: 83,
      directionalBias: 'neutral',
      currentPrice: 6020,
    });

    expect(strategies.length).toBeGreaterThan(0);
    expect(strategies.some((strategy) => strategy.name.toLowerCase().includes('iron condor'))).toBe(true);
  });

  it('builds directional spread when bearish bias exists', () => {
    const strategies = __testables.buildSuggestedStrategies({
      symbol: 'AAPL',
      moveOverpricing: -5,
      expectedMovePct: 4,
      ivRank: 45,
      directionalBias: 'bearish',
      currentPrice: 220,
    });

    expect(strategies.some((strategy) => strategy.name === 'Bear Put Spread')).toBe(true);
  });

  it('maps days to Alpha Vantage horizon buckets', () => {
    expect(__testables.getAlphaVantageHorizon(14)).toBe('3month');
    expect(__testables.getAlphaVantageHorizon(120)).toBe('6month');
    expect(__testables.getAlphaVantageHorizon(220)).toBe('12month');
  });

  it('parses CSV rows including quoted commas', () => {
    const rows = __testables.parseCsvRows(`symbol,name,reportDate
AAPL,"Apple, Inc.",2026-04-30`);
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe('Apple, Inc.');
  });

  it('extracts Alpha Vantage calendar events from CSV', () => {
    const events = __testables.extractAlphaCalendarEvents(
      `symbol,name,reportDate
AAPL,Apple Inc,2026-04-30
NVDA,NVIDIA,2026-05-22`,
    );
    expect(events).toEqual([
      { symbol: 'AAPL', reportDate: '2026-04-30' },
      { symbol: 'NVDA', reportDate: '2026-05-22' },
    ]);
  });

  it('classifies alpha surprise numbers into beat/miss/in-line', () => {
    expect(__testables.parseAlphaSurprise('0.12')).toBe('beat');
    expect(__testables.parseAlphaSurprise('-0.04')).toBe('miss');
    expect(__testables.parseAlphaSurprise('0')).toBe('in-line');
    expect(__testables.parseAlphaSurprise('n/a')).toBe('unknown');
  });
});
