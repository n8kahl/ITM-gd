import { scoreMultiTFConfluence, type SPXMultiTFConfluenceContext } from '../multiTFConfluence';

function buildContext(overrides?: Partial<SPXMultiTFConfluenceContext>): SPXMultiTFConfluenceContext {
  return {
    asOf: '2026-02-20T15:30:00.000Z',
    source: 'computed',
    tf1m: {
      timeframe: '1m',
      ema21: 6012,
      ema55: 6008,
      slope21: 1.2,
      latestClose: 6013,
      trend: 'up',
      swingHigh: 6016,
      swingLow: 6006,
      bars: [],
    },
    tf5m: {
      timeframe: '5m',
      ema21: 6015,
      ema55: 6007,
      slope21: 1.5,
      latestClose: 6018,
      trend: 'up',
      swingHigh: 6022,
      swingLow: 6001,
      bars: [],
    },
    tf15m: {
      timeframe: '15m',
      ema21: 6017,
      ema55: 6004,
      slope21: 1.1,
      latestClose: 6019,
      trend: 'up',
      swingHigh: 6024,
      swingLow: 5998,
      bars: [],
    },
    tf1h: {
      timeframe: '1h',
      ema21: 6020,
      ema55: 6002,
      slope21: 0.9,
      latestClose: 6022,
      trend: 'up',
      swingHigh: 6030,
      swingLow: 5985,
      bars: [],
    },
    ...overrides,
  };
}

describe('spx/multiTFConfluence', () => {
  it('scores aligned bullish context as high quality', () => {
    const context = buildContext();
    const score = scoreMultiTFConfluence({
      context,
      direction: 'bullish',
      currentPrice: 6021,
    });

    expect(score.aligned).toBe(true);
    expect(score.composite).toBeGreaterThanOrEqual(60);
    expect(score.tf1hStructureAligned).toBeGreaterThanOrEqual(20);
    expect(score.tf5mMomentumAlignment).toBeGreaterThanOrEqual(12);
  });

  it('scores misaligned bearish context as weak', () => {
    const context = buildContext();
    const score = scoreMultiTFConfluence({
      context,
      direction: 'bearish',
      currentPrice: 6021,
    });

    expect(score.aligned).toBe(false);
    expect(score.composite).toBeLessThan(60);
    expect(score.tf1hStructureAligned).toBeLessThanOrEqual(11);
  });

  it('returns neutral fallback score when context is unavailable', () => {
    const score = scoreMultiTFConfluence({
      context: null,
      direction: 'bullish',
      currentPrice: 6000,
    });

    expect(score.aligned).toBe(false);
    expect(score.composite).toBe(24);
    expect(score.tf1mMicrostructure).toBe(4);
  });
});
