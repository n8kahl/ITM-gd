import { detectVolumeClimax } from '../volumeClimax';
import { DetectorSnapshot } from '../types';

function minuteTs(offset: number): number {
  return Date.UTC(2026, 1, 9, 14, 30 + offset);
}

function createSnapshot(): DetectorSnapshot {
  const bars = Array.from({ length: 25 }, (_, i) => ({
    o: 100 + i * 0.1,
    h: 100.4 + i * 0.1,
    l: 99.8 + i * 0.1,
    c: 100.2 + i * 0.1,
    v: 1200,
    t: minuteTs(i),
  }));

  bars[24] = {
    o: 102.3,
    h: 104.2,
    l: 101.9,
    c: 103.0,
    v: 5200,
    t: minuteTs(24),
  };

  return {
    symbol: 'SPX',
    intradayBars: bars,
    dailyBars: [
      { o: 98, h: 103, l: 97, c: 101, v: 500000, t: Date.UTC(2026, 1, 6, 21, 0) },
      { o: 101, h: 104, l: 100, c: 103, v: 520000, t: Date.UTC(2026, 1, 9, 21, 0) },
    ],
    levels: {
      symbol: 'SPX',
      timestamp: new Date().toISOString(),
      currentPrice: 103,
      levels: {
        resistance: [],
        support: [],
        pivots: { standard: {}, camarilla: {}, fibonacci: {} },
        indicators: { vwap: 102.1, atr14: 5.5, atr7: 4.8 },
      },
      marketContext: { marketStatus: 'open', sessionType: 'regular' },
      cached: false,
      cacheExpiresAt: null,
    } as any,
    detectedAt: '2026-02-09T15:00:00.000Z',
  };
}

describe('detectVolumeClimax', () => {
  it('detects volume climax and marks potential exhaustion', () => {
    const signal = detectVolumeClimax(createSnapshot());

    expect(signal).toBeTruthy();
    expect(signal?.type).toBe('volume_climax');
    expect(signal?.signalData.volumeRatio).toBeGreaterThan(3);
    expect(signal?.signalData.potentialExhaustion).toBe(true);
    expect(signal?.direction).toBe('short');
  });

  it('returns null when volume does not exceed threshold', () => {
    const snapshot = createSnapshot();
    snapshot.intradayBars[snapshot.intradayBars.length - 1].v = 1500;

    expect(detectVolumeClimax(snapshot)).toBeNull();
  });
});
