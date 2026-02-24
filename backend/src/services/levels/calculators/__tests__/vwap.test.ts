import {
  getRunningVWAP,
  getRunningVWAPBandSet,
  resetRunningVWAP,
  updateRunningVWAPForSymbol,
  updateVWAP,
} from '../vwap';

describe('levels/vwap incremental updates', () => {
  beforeEach(() => {
    resetRunningVWAP();
  });

  it('updates VWAP incrementally in O(1) state form', () => {
    const first = updateVWAP(null, {
      price: 100,
      volume: 10,
      timestampMs: Date.parse('2026-02-24T15:00:00.000Z'),
      sessionDate: '2026-02-24',
    });
    const second = updateVWAP(first, {
      price: 102,
      volume: 10,
      timestampMs: Date.parse('2026-02-24T15:00:05.000Z'),
      sessionDate: '2026-02-24',
    });

    expect(first?.value).toBe(100);
    expect(second?.value).toBe(101);
    expect(second?.cumulativeVolume).toBe(20);
  });

  it('derives 1SD/1.5SD/2SD bands from running variance', () => {
    updateRunningVWAPForSymbol('SPX', {
      price: 100,
      volume: 10,
      timestampMs: Date.parse('2026-02-24T15:00:00.000Z'),
    });
    updateRunningVWAPForSymbol('SPX', {
      price: 102,
      volume: 10,
      timestampMs: Date.parse('2026-02-24T15:00:05.000Z'),
    });

    const bands = getRunningVWAPBandSet('SPX');
    expect(bands?.vwap).toBe(101);
    expect(bands?.band1SD).toEqual({ upper: 102, lower: 100 });
    expect(bands?.band2SD).toEqual({ upper: 103, lower: 99 });
  });

  it('clears running state outside regular session (pre-open reset)', () => {
    updateRunningVWAPForSymbol('SPX', {
      price: 100,
      volume: 10,
      timestampMs: Date.parse('2026-02-24T15:00:00.000Z'),
    });
    expect(getRunningVWAP('SPX')).not.toBeNull();

    const offSession = updateRunningVWAPForSymbol('SPX', {
      price: 101,
      volume: 10,
      timestampMs: Date.parse('2026-02-24T13:00:00.000Z'),
    });

    expect(offSession).toBeNull();
    expect(getRunningVWAP('SPX')).toBeNull();
  });

  it('resets cumulative state on session date rollover', () => {
    updateRunningVWAPForSymbol('SPX', {
      price: 100,
      volume: 10,
      timestampMs: Date.parse('2026-02-24T15:00:00.000Z'),
    });
    const nextSession = updateRunningVWAPForSymbol('SPX', {
      price: 110,
      volume: 5,
      timestampMs: Date.parse('2026-02-25T15:00:00.000Z'),
    });

    expect(nextSession?.sessionDate).toBe('2026-02-25');
    expect(nextSession?.cumulativeVolume).toBe(5);
    expect(nextSession?.value).toBe(110);
  });
});
