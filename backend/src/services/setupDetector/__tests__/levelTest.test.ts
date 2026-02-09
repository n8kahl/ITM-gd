import { detectLevelTest } from '../levelTest';
import { DetectorSnapshot } from '../types';

function minuteTs(offset: number): number {
  return Date.UTC(2026, 1, 9, 14, 30 + offset);
}

function createSnapshot(): DetectorSnapshot {
  const bars = Array.from({ length: 38 }, (_, i) => ({
    o: 98.2 + Math.sin(i / 4) * 0.12,
    h: 98.5 + Math.sin(i / 4) * 0.12,
    l: 97.9 + Math.sin(i / 4) * 0.12,
    c: 98.3 + Math.sin(i / 4) * 0.12,
    v: 1100,
    t: minuteTs(i),
  }));

  // Repeated resistance tests at 100+
  const testIndexes = [8, 16, 28, 34];
  for (const index of testIndexes) {
    bars[index] = {
      o: 99.6,
      h: 100.22,
      l: 99.45,
      c: 99.72,
      v: 1500,
      t: minuteTs(index),
    };
  }

  bars[37] = {
    o: 99.7,
    h: 100.18,
    l: 99.6,
    c: 99.95,
    v: 1700,
    t: minuteTs(37),
  };

  return {
    symbol: 'SPX',
    intradayBars: bars,
    dailyBars: [
      { o: 97, h: 100.5, l: 96.6, c: 99.7, v: 520000, t: Date.UTC(2026, 1, 6, 21, 0) },
      { o: 99.8, h: 100.4, l: 98.9, c: 99.95, v: 530000, t: Date.UTC(2026, 1, 9, 21, 0) },
    ],
    levels: {
      symbol: 'SPX',
      timestamp: new Date().toISOString(),
      currentPrice: 99.95,
      levels: {
        resistance: [
          { type: 'PDH', price: 100, distance: 0.05, distancePct: 0.05, distanceATR: 0.01, strength: 'critical', description: 'PDH' },
        ],
        support: [
          { type: 'PDC', price: 95, distance: -4.95, distancePct: -4.95, distanceATR: -1.24, strength: 'strong', description: 'PDC' },
        ],
        pivots: { standard: {}, camarilla: {}, fibonacci: {} },
        indicators: { vwap: 98.6, atr14: 4, atr7: 3.5 },
      },
      marketContext: { marketStatus: 'open', sessionType: 'regular' },
      cached: false,
      cacheExpiresAt: null,
    } as any,
    detectedAt: '2026-02-09T15:00:00.000Z',
  };
}

describe('detectLevelTest', () => {
  it('detects weakening level on repeated resistance tests', () => {
    const signal = detectLevelTest(createSnapshot());

    expect(signal).toBeTruthy();
    expect(signal?.type).toBe('level_test');
    expect(signal?.direction).toBe('long');
    expect(signal?.signalData.testCount).toBeGreaterThanOrEqual(3);
    expect(signal?.signalData.levelType).toBe('resistance');
    expect(signal?.signalData.weakening).toBe(true);
  });

  it('returns null when level has fewer than three tests', () => {
    const snapshot = createSnapshot();
    snapshot.intradayBars[28] = {
      o: 98.4,
      h: 98.7,
      l: 98.2,
      c: 98.5,
      v: 1000,
      t: minuteTs(28),
    };
    snapshot.intradayBars[34] = {
      o: 98.3,
      h: 98.6,
      l: 98.1,
      c: 98.4,
      v: 1000,
      t: minuteTs(34),
    };
    snapshot.intradayBars[37] = {
      o: 98.6,
      h: 99.1,
      l: 98.2,
      c: 98.8,
      v: 1000,
      t: minuteTs(37),
    };

    expect(detectLevelTest(snapshot)).toBeNull();
  });
});
