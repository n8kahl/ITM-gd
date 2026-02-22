import { detectVWAPPlay } from '../vwap';
import { DetectorSnapshot } from '../types';

function minuteTs(offset: number): number {
  return Date.UTC(2026, 1, 9, 14, 30 + offset);
}

function createCrossSnapshot(): DetectorSnapshot {
  const bars = Array.from({ length: 22 }, (_, i) => ({
    o: 100,
    h: 100.2,
    l: 99.8,
    c: i === 20 ? 99.7 : i === 21 ? 101.1 : 100,
    v: i === 21 ? 2800 : 900,
    t: minuteTs(i),
  }));

  return {
    symbol: 'SPX',
    intradayBars: bars,
    dailyBars: [
      { o: 98, h: 101, l: 97.5, c: 100, v: 500000, t: Date.UTC(2026, 1, 6, 21, 0) },
      { o: 101, h: 103, l: 99, c: 102, v: 520000, t: Date.UTC(2026, 1, 9, 21, 0) },
    ],
    levels: {
      symbol: 'SPX',
      timestamp: new Date().toISOString(),
      currentPrice: 101.1,
      levels: {
        resistance: [],
        support: [],
        pivots: { standard: {}, camarilla: {}, fibonacci: {} },
        indicators: { vwap: 100, atr14: 4, atr7: 3 },
      },
      marketContext: { marketStatus: 'open', sessionType: 'regular' },
      cached: false,
      cacheExpiresAt: null,
    } as any,
    detectedAt: '2026-02-09T15:00:00.000Z',
  };
}

describe('detectVWAPPlay microstructure gating', () => {
  it('detects VWAP cross when microstructure is unavailable (fail-open)', () => {
    const signal = detectVWAPPlay(createCrossSnapshot());
    expect(signal).toBeTruthy();
    expect(signal?.type).toBe('vwap_cross');
    expect(signal?.direction).toBe('long');
  });

  it('blocks long cross when microstructure conflicts', () => {
    const snapshot = createCrossSnapshot();
    snapshot.microstructure = {
      source: 'tick_cache',
      available: true,
      sampleCount: 120,
      quoteCoveragePct: 92,
      buyVolume: 900,
      sellVolume: 2600,
      neutralVolume: 300,
      aggressorSkew: -0.49,
      bidAskImbalance: -0.42,
      askBidSizeRatio: 2.6,
      avgSpreadBps: 9.8,
      bidSizeAtClose: 80,
      askSizeAtClose: 208,
    };

    expect(detectVWAPPlay(snapshot)).toBeNull();
  });

  it('allows long cross when microstructure confirms', () => {
    const snapshot = createCrossSnapshot();
    snapshot.microstructure = {
      source: 'tick_cache',
      available: true,
      sampleCount: 140,
      quoteCoveragePct: 93,
      buyVolume: 3100,
      sellVolume: 1200,
      neutralVolume: 250,
      aggressorSkew: 0.44,
      bidAskImbalance: 0.18,
      askBidSizeRatio: 0.74,
      avgSpreadBps: 7.6,
      bidSizeAtClose: 230,
      askSizeAtClose: 170,
    };

    const signal = detectVWAPPlay(snapshot);
    expect(signal).toBeTruthy();
    expect(signal?.type).toBe('vwap_cross');
    expect(signal?.direction).toBe('long');
  });
});
