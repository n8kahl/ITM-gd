import { detectBreakRetest } from '../breakRetest';
import { detectGapFill } from '../gapFill';
import { detectOrbBreakout } from '../orb';
import { detectVWAPPlay } from '../vwap';
import { detectSetupsFromSnapshot } from '../detectors';
import { DetectorSnapshot } from '../types';

function minuteTs(offset: number): number {
  return Date.UTC(2026, 1, 9, 14, 30 + offset);
}

function createSnapshot(overrides?: Partial<DetectorSnapshot>): DetectorSnapshot {
  const intradayBars = Array.from({ length: 30 }, (_, i) => ({
    o: 100,
    h: 100.2,
    l: 99.8,
    c: 100,
    v: 1000,
    t: minuteTs(i),
  }));

  const dailyBars = [
    { o: 98, h: 101, l: 97.5, c: 100, v: 500000, t: Date.UTC(2026, 1, 6, 21, 0) },
    { o: 101, h: 103, l: 99, c: 102, v: 520000, t: Date.UTC(2026, 1, 9, 21, 0) },
  ];

  const levels = {
    symbol: 'SPX',
    timestamp: new Date().toISOString(),
    currentPrice: 100,
    levels: {
      resistance: [{ type: 'PDH', price: 100, distance: 0, distancePct: 0, distanceATR: 0, strength: 'critical', description: 'PDH' }],
      support: [{ type: 'PDC', price: 99.5, distance: -0.5, distancePct: -0.5, distanceATR: -0.12, strength: 'strong', description: 'PDC' }],
      pivots: { standard: {}, camarilla: {}, fibonacci: {} },
      indicators: { vwap: 100, atr14: 4, atr7: 3 },
    },
    marketContext: { marketStatus: 'open', sessionType: 'regular' },
    cached: false,
    cacheExpiresAt: null,
  } as any;

  return {
    symbol: 'SPX',
    intradayBars,
    dailyBars,
    levels,
    detectedAt: '2026-02-09T15:00:00.000Z',
    ...overrides,
  };
}

describe('setupDetector modules', () => {
  it('detects ORB breakout on high-volume upside break', () => {
    const bars = Array.from({ length: 18 }, (_, i) => ({
      o: 100,
      h: i < 15 ? 100.5 : 101,
      l: 99.5,
      c: i === 16 ? 100.45 : i === 17 ? 101.2 : 100,
      v: i === 17 ? 3200 : 900,
      t: minuteTs(i),
    }));

    const signal = detectOrbBreakout(createSnapshot({ intradayBars: bars }));

    expect(signal).toBeTruthy();
    expect(signal?.type).toBe('orb_breakout');
    expect(signal?.direction).toBe('long');
    expect(signal?.confidence).toBeGreaterThan(0);
  });

  it('detects break and retest continuation', () => {
    const bars = Array.from({ length: 35 }, (_, i) => ({
      o: 99.6,
      h: 99.9,
      l: 99.3,
      c: 99.7,
      v: 900,
      t: minuteTs(i),
    }));

    bars[20] = { o: 99.8, h: 101, l: 99.7, c: 100.8, v: 2400, t: minuteTs(20) };
    bars[22] = { o: 100.6, h: 100.9, l: 99.95, c: 100.2, v: 1200, t: minuteTs(22) };
    bars[34] = { o: 100.5, h: 101.2, l: 100.4, c: 100.95, v: 1300, t: minuteTs(34) };

    const signal = detectBreakRetest(createSnapshot({
      intradayBars: bars,
      levels: {
        ...createSnapshot().levels,
        levels: {
          ...createSnapshot().levels.levels,
          resistance: [{ type: 'PDH', price: 100, distance: 0, distancePct: 0, distanceATR: 0, strength: 'critical', description: 'PDH' }],
          support: [],
        },
      } as any,
    }));

    expect(signal).toBeTruthy();
    expect(signal?.type).toBe('break_retest');
    expect(signal?.direction).toBe('long');
  });

  it('detects VWAP cross', () => {
    const bars = Array.from({ length: 22 }, (_, i) => ({
      o: 100,
      h: 100.1,
      l: 99.8,
      c: i === 20 ? 99.7 : i === 21 ? 101.1 : 100,
      v: i === 21 ? 2800 : 900,
      t: minuteTs(i),
    }));

    const signal = detectVWAPPlay(createSnapshot({ intradayBars: bars }));

    expect(signal).toBeTruthy();
    expect(signal?.type).toBe('vwap_cross');
    expect(signal?.direction).toBe('long');
  });

  it('detects gap fill at 50% threshold', () => {
    const bars = [
      { o: 103, h: 103.5, l: 102.5, c: 102.7, v: 1200, t: minuteTs(0) },
      { o: 102.7, h: 102.8, l: 101.2, c: 101.4, v: 1500, t: minuteTs(1) },
    ];

    const signal = detectGapFill(createSnapshot({
      intradayBars: bars,
      dailyBars: [
        { o: 98, h: 101, l: 97.5, c: 100, v: 500000, t: Date.UTC(2026, 1, 6, 21, 0) },
        { o: 101, h: 103, l: 99, c: 102, v: 520000, t: Date.UTC(2026, 1, 9, 21, 0) },
      ],
    }));

    expect(signal).toBeTruthy();
    expect(signal?.type).toBe('gap_fill');
    expect(signal?.direction).toBe('short');
    expect((signal?.signalData.fillPct as number)).toBeGreaterThanOrEqual(50);
    expect(signal?.tradeSuggestion?.target).toBeCloseTo(100.75, 2);
  });

  it('aggregates and sorts detections by confidence', () => {
    const bars = Array.from({ length: 22 }, (_, i) => ({
      o: 100,
      h: 100.1,
      l: 99.8,
      c: i === 20 ? 99.7 : i === 21 ? 101.1 : 100,
      v: i === 21 ? 2800 : 900,
      t: minuteTs(i),
    }));

    const detections = detectSetupsFromSnapshot(createSnapshot({ intradayBars: bars }));

    expect(Array.isArray(detections)).toBe(true);
    if (detections.length > 1) {
      for (let i = 1; i < detections.length; i += 1) {
        expect(detections[i - 1].confidence).toBeGreaterThanOrEqual(detections[i].confidence);
      }
    }
  });
});
