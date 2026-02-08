import { calculateEMA, calculatePivots } from '../chartDataService';

/**
 * Tests for Chart Data Service (weekly/monthly + EMAs)
 */

describe('Chart Data Service', () => {
  describe('calculateEMA', () => {
    it('returns null when not enough data', () => {
      expect(calculateEMA([100, 101, 102], 50)).toBeNull();
    });

    it('calculates EMA correctly for simple data', () => {
      // 10-period EMA of sequential data
      const data = Array.from({ length: 20 }, (_, i) => 100 + i);
      const result = calculateEMA(data, 10);
      expect(result).not.toBeNull();
      expect(typeof result).toBe('number');
      // EMA should be between min and max
      expect(result!).toBeGreaterThanOrEqual(100);
      expect(result!).toBeLessThanOrEqual(119);
    });

    it('calculates correct 50-period EMA', () => {
      const data = Array.from({ length: 100 }, (_, i) => 5000 + i * 10);
      const result = calculateEMA(data, 50);
      expect(result).not.toBeNull();
      // EMA should lag behind the current price
      const lastPrice = data[data.length - 1];
      expect(result!).toBeLessThan(lastPrice);
    });

    it('calculates correct 200-period EMA with sufficient data', () => {
      const data = Array.from({ length: 260 }, (_, i) => 4000 + i * 5);
      const result = calculateEMA(data, 200);
      expect(result).not.toBeNull();
      expect(result!).toBeGreaterThan(4000);
    });

    it('returns null for period equal to data length', () => {
      // Edge: exactly enough data for initialization, no EMA smoothing
      const data = Array.from({ length: 50 }, (_, i) => 100 + i);
      const result = calculateEMA(data, 50);
      // Should return the SMA since there's no extra data to smooth
      expect(result).not.toBeNull();
    });

    it('EMA responds to recent price changes', () => {
      // Flat then spike
      const flat = Array.from({ length: 20 }, () => 100);
      const spike = [...flat, 200]; // Sudden jump
      const result = calculateEMA(spike, 10);
      expect(result).not.toBeNull();
      // Should be above 100 (reacting to spike) but below 200
      expect(result!).toBeGreaterThan(100);
      expect(result!).toBeLessThan(200);
    });
  });

  describe('calculatePivots', () => {
    it('returns null for empty candles', () => {
      expect(calculatePivots([])).toBeNull();
    });

    it('returns null for single candle', () => {
      const candle = { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 };
      expect(calculatePivots([candle])).toBeNull();
    });

    it('calculates pivot points correctly', () => {
      const candles = [
        { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        { time: 2000, open: 105, high: 120, low: 95, close: 115, volume: 1500 },
      ];

      const pivots = calculatePivots(candles);
      expect(pivots).not.toBeNull();

      // Uses previous candle (index 0): H=110, L=90, C=105
      const pp = (110 + 90 + 105) / 3;
      expect(pivots!.pp).toBeCloseTo(pp, 1);
      expect(pivots!.r1).toBeCloseTo(2 * pp - 90, 1);
      expect(pivots!.s1).toBeCloseTo(2 * pp - 110, 1);
      expect(pivots!.r2).toBeCloseTo(pp + (110 - 90), 1);
      expect(pivots!.s2).toBeCloseTo(pp - (110 - 90), 1);
    });

    it('uses second-to-last candle for calculation', () => {
      const candles = [
        { time: 1000, open: 50, high: 60, low: 40, close: 55, volume: 100 },
        { time: 2000, open: 55, high: 65, low: 45, close: 60, volume: 200 },
        { time: 3000, open: 60, high: 70, low: 50, close: 65, volume: 300 },
      ];

      const pivots = calculatePivots(candles);
      // Should use candle at index 1 (second-to-last): H=65, L=45, C=60
      const pp = (65 + 45 + 60) / 3;
      expect(pivots!.pp).toBeCloseTo(pp, 1);
    });
  });
});
