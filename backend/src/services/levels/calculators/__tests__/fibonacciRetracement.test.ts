import type { MassiveAggregate } from '../../../../config/massive';
import { calculateFibonacciRetracement, findClosestFibLevel } from '../fibonacciRetracement';

function createBar(
  high: number,
  low: number,
  close: number,
  timestamp: number,
): MassiveAggregate {
  return {
    o: Number(((high + low) / 2).toFixed(2)),
    h: high,
    l: low,
    c: close,
    v: 1_000_000,
    t: timestamp,
    n: 100,
    vw: close,
  };
}

describe('Fibonacci Retracement Calculator', () => {
  describe('calculateFibonacciRetracement', () => {
    it('calculates retracement levels when swing high occurs after swing low', () => {
      const start = Date.now();
      const bars: MassiveAggregate[] = [
        createBar(105, 100, 102, start + 0),
        createBar(110, 105, 108, start + 60_000),
        createBar(115, 110, 113, start + 120_000),
        createBar(120, 115, 118, start + 180_000),
        createBar(118, 113, 115, start + 240_000),
        createBar(116, 111, 112, start + 300_000),
      ];

      const fib = calculateFibonacciRetracement('TEST', bars, 'daily', 10);
      const range = 120 - 100;

      expect(fib.direction).toBe('retracement');
      expect(fib.swingHigh).toBe(120);
      expect(fib.swingLow).toBe(100);
      expect(fib.levels.level_0).toBe(120);
      expect(fib.levels.level_100).toBe(100);
      expect(fib.levels.level_236).toBeCloseTo(120 - (range * 0.236), 2);
      expect(fib.levels.level_382).toBeCloseTo(120 - (range * 0.382), 2);
      expect(fib.levels.level_500).toBeCloseTo(120 - (range * 0.5), 2);
      expect(fib.levels.level_618).toBeCloseTo(120 - (range * 0.618), 2);
      expect(fib.levels.level_786).toBeCloseTo(120 - (range * 0.786), 2);
    });

    it('calculates extension levels when swing low occurs after swing high', () => {
      const start = Date.now();
      const bars: MassiveAggregate[] = [
        createBar(120, 115, 118, start + 0),
        createBar(115, 110, 112, start + 60_000),
        createBar(110, 105, 107, start + 120_000),
        createBar(105, 100, 102, start + 180_000),
        createBar(108, 103, 106, start + 240_000),
        createBar(112, 107, 110, start + 300_000),
        createBar(117, 112, 115, start + 360_000),
      ];

      const fib = calculateFibonacciRetracement('TEST', bars, 'daily', 10);
      const range = 120 - 100;

      expect(fib.direction).toBe('extension');
      expect(fib.swingHigh).toBe(120);
      expect(fib.swingLow).toBe(100);
      expect(fib.levels.level_0).toBe(100);
      expect(fib.levels.level_100).toBe(120);
      expect(fib.levels.level_236).toBeCloseTo(100 + (range * 0.236), 2);
      expect(fib.levels.level_382).toBeCloseTo(100 + (range * 0.382), 2);
      expect(fib.levels.level_500).toBeCloseTo(100 + (range * 0.5), 2);
      expect(fib.levels.level_618).toBeCloseTo(100 + (range * 0.618), 2);
      expect(fib.levels.level_786).toBeCloseTo(100 + (range * 0.786), 2);
    });

    it('throws with insufficient data', () => {
      const bars: MassiveAggregate[] = [createBar(100, 95, 98, Date.now())];

      expect(() => calculateFibonacciRetracement('TEST', bars)).toThrow(
        'Insufficient data for Fibonacci calculation',
      );
    });

    it('respects lookback when finding swing points', () => {
      const start = Date.now();
      const bars: MassiveAggregate[] = Array.from({ length: 50 }, (_, index) => (
        createBar(100 + index, 90 + index, 95 + index, start + (index * 60_000))
      ));

      const fib = calculateFibonacciRetracement('TEST', bars, 'daily', 10);

      expect(fib.lookbackBars).toBe(10);
      expect(fib.swingHighIndex).toBeGreaterThanOrEqual(40);
      expect(fib.swingLowIndex).toBeGreaterThanOrEqual(40);
    });
  });

  describe('findClosestFibLevel', () => {
    it('returns closest level details', () => {
      const start = Date.now();
      const fib = calculateFibonacciRetracement(
        'TEST',
        [
          createBar(120, 100, 118, start + 0),
          createBar(119, 110, 112, start + 60_000),
        ],
        'daily',
        10,
      );

      const closest = findClosestFibLevel(fib, 112);

      expect(closest.level).toBe('level_618');
      expect(closest.price).toBe(fib.levels.level_618);
      expect(closest.distance).toBeCloseTo(-0.36, 2);
    });
  });
});
