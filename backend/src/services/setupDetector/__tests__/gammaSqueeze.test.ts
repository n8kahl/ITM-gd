import { OptionsChainResponse } from '../../options/types';
import { detectGammaSqueeze } from '../gammaSqueeze';
import { DetectorSnapshot } from '../types';

function minuteTs(offset: number): number {
  return Date.UTC(2026, 1, 9, 14, 30 + offset);
}

function createSnapshot(symbol: string): DetectorSnapshot {
  const bars = Array.from({ length: 24 }, (_, i) => ({
    o: 6010 + i * 0.2,
    h: 6011 + i * 0.2,
    l: 6008 + i * 0.2,
    c: 6010 + i * 0.25,
    v: i === 23 ? 4200 : 1800,
    t: minuteTs(i),
  }));

  bars[23] = {
    o: 6031,
    h: 6038,
    l: 6030.5,
    c: 6037,
    v: 6800,
    t: minuteTs(23),
  };

  return {
    symbol,
    intradayBars: bars,
    dailyBars: [
      { o: 5960, h: 6020, l: 5940, c: 6015, v: 510000, t: Date.UTC(2026, 1, 6, 21, 0) },
      { o: 6016, h: 6042, l: 6000, c: 6032, v: 530000, t: Date.UTC(2026, 1, 9, 21, 0) },
    ],
    levels: {
      symbol,
      timestamp: new Date().toISOString(),
      currentPrice: 6037,
      levels: {
        resistance: [],
        support: [],
        pivots: { standard: {}, camarilla: {}, fibonacci: {} },
        indicators: { vwap: 6029, atr14: 28, atr7: 24 },
      },
      marketContext: { marketStatus: 'open', sessionType: 'regular' },
      cached: false,
      cacheExpiresAt: null,
    } as any,
    detectedAt: '2026-02-09T15:00:00.000Z',
  };
}

function createGammaChain(symbol: string): OptionsChainResponse {
  return {
    symbol,
    currentPrice: 6036,
    expiry: '2026-02-09',
    daysToExpiry: 0,
    ivRank: 46,
    options: {
      calls: [
        {
          symbol,
          strike: 6025,
          expiry: '2026-02-09',
          type: 'call',
          last: 18,
          bid: 17.8,
          ask: 18.2,
          volume: 10000,
          openInterest: 22000,
          impliedVolatility: 0.21,
          delta: 0.56,
          gamma: 0.0052,
          theta: -4,
          vega: 2,
          rho: 0,
          inTheMoney: true,
          intrinsicValue: 11,
          extrinsicValue: 7,
        },
        {
          symbol,
          strike: 6030,
          expiry: '2026-02-09',
          type: 'call',
          last: 15,
          bid: 14.8,
          ask: 15.2,
          volume: 12000,
          openInterest: 24000,
          impliedVolatility: 0.2,
          delta: 0.52,
          gamma: 0.0056,
          theta: -3.9,
          vega: 1.9,
          rho: 0,
          inTheMoney: true,
          intrinsicValue: 6,
          extrinsicValue: 9,
        },
        {
          symbol,
          strike: 6035,
          expiry: '2026-02-09',
          type: 'call',
          last: 12,
          bid: 11.8,
          ask: 12.2,
          volume: 8000,
          openInterest: 18000,
          impliedVolatility: 0.2,
          delta: 0.49,
          gamma: 0.0048,
          theta: -3.8,
          vega: 1.8,
          rho: 0,
          inTheMoney: true,
          intrinsicValue: 1,
          extrinsicValue: 11,
        },
      ],
      puts: [
        {
          symbol,
          strike: 6025,
          expiry: '2026-02-09',
          type: 'put',
          last: 8,
          bid: 7.8,
          ask: 8.2,
          volume: 3500,
          openInterest: 8500,
          impliedVolatility: 0.22,
          delta: -0.44,
          gamma: 0.002,
          theta: -3.6,
          vega: 2,
          rho: 0,
          inTheMoney: false,
          intrinsicValue: 0,
          extrinsicValue: 8,
        },
        {
          symbol,
          strike: 6030,
          expiry: '2026-02-09',
          type: 'put',
          last: 9,
          bid: 8.8,
          ask: 9.2,
          volume: 3200,
          openInterest: 7600,
          impliedVolatility: 0.22,
          delta: -0.46,
          gamma: 0.0021,
          theta: -3.7,
          vega: 2,
          rho: 0,
          inTheMoney: false,
          intrinsicValue: 0,
          extrinsicValue: 9,
        },
        {
          symbol,
          strike: 6035,
          expiry: '2026-02-09',
          type: 'put',
          last: 10,
          bid: 9.8,
          ask: 10.2,
          volume: 3000,
          openInterest: 7000,
          impliedVolatility: 0.22,
          delta: -0.48,
          gamma: 0.0022,
          theta: -3.8,
          vega: 2,
          rho: 0,
          inTheMoney: false,
          intrinsicValue: 0,
          extrinsicValue: 10,
        },
      ],
    },
  };
}

describe('detectGammaSqueeze', () => {
  it('detects long gamma squeeze for SPX with call gamma dominance and upside breakout', () => {
    const snapshot = createSnapshot('SPX');
    const chain = createGammaChain('SPX');

    const signal = detectGammaSqueeze(snapshot, chain);

    expect(signal).toBeTruthy();
    expect(signal?.type).toBe('gamma_squeeze');
    expect(signal?.direction).toBe('long');
    expect(signal?.confidence).toBeGreaterThanOrEqual(70);
    expect(signal?.signalData).toHaveProperty('gammaRegime');
    expect(signal?.signalData).toHaveProperty('maxPositiveGexStrike');
  });

  it('returns null for non-index symbols', () => {
    const snapshot = createSnapshot('AAPL');
    const chain = createGammaChain('AAPL');

    expect(detectGammaSqueeze(snapshot, chain)).toBeNull();
  });
});
