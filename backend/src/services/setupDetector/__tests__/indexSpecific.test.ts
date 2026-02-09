import { detectIndexOpeningDrive } from '../indexSpecific';
import { DetectorSnapshot } from '../types';

function minuteTs(offset: number): number {
  return Date.UTC(2026, 1, 9, 14, 30 + offset);
}

function createIndexSnapshot(symbol: 'SPX' | 'NDX', direction: 'long' | 'short'): DetectorSnapshot {
  const bars = Array.from({ length: 26 }, (_, i) => {
    const base = symbol === 'SPX' ? 6000 : 21000;
    const drift = direction === 'long' ? i * 1.2 : -i * 1.2;
    const open = base + drift;
    return {
      o: open,
      h: open + 1.8,
      l: open - 1.8,
      c: open + (direction === 'long' ? 0.8 : -0.8),
      v: i >= 20 ? 4200 : 2200,
      t: minuteTs(i),
    };
  });

  if (direction === 'long') {
    bars[25] = {
      o: bars[24].c + 1,
      h: bars[24].c + 5,
      l: bars[24].c + 0.5,
      c: bars[24].c + 4,
      v: 6200,
      t: minuteTs(25),
    };
  } else {
    bars[25] = {
      o: bars[24].c - 1,
      h: bars[24].c - 0.4,
      l: bars[24].c - 5,
      c: bars[24].c - 4,
      v: 6200,
      t: minuteTs(25),
    };
  }

  return {
    symbol,
    intradayBars: bars,
    dailyBars: [
      { o: 5980, h: 6030, l: 5950, c: 6010, v: 520000, t: Date.UTC(2026, 1, 6, 21, 0) },
      { o: 6012, h: 6050, l: 6000, c: 6030, v: 540000, t: Date.UTC(2026, 1, 9, 21, 0) },
    ],
    levels: {
      symbol,
      timestamp: new Date().toISOString(),
      currentPrice: bars[bars.length - 1].c,
      levels: {
        resistance: [],
        support: [],
        pivots: { standard: {}, camarilla: {}, fibonacci: {} },
        indicators: {
          vwap: direction === 'long'
            ? bars[bars.length - 1].c - 6
            : bars[bars.length - 1].c + 6,
          atr14: symbol === 'SPX' ? 35 : 90,
          atr7: symbol === 'SPX' ? 32 : 86,
        },
      },
      marketContext: { marketStatus: 'open', sessionType: 'regular' },
      cached: false,
      cacheExpiresAt: null,
    } as any,
    detectedAt: '2026-02-09T15:00:00.000Z',
  };
}

describe('detectIndexOpeningDrive', () => {
  it('detects SPX opening drive continuation', () => {
    const signal = detectIndexOpeningDrive(createIndexSnapshot('SPX', 'long'));

    expect(signal).toBeTruthy();
    expect(signal?.type).toBe('spx_opening_drive');
    expect(signal?.direction).toBe('long');
  });

  it('detects NDX downside opening drive', () => {
    const signal = detectIndexOpeningDrive(createIndexSnapshot('NDX', 'short'));

    expect(signal).toBeTruthy();
    expect(signal?.type).toBe('ndx_opening_drive');
    expect(signal?.direction).toBe('short');
  });
});
