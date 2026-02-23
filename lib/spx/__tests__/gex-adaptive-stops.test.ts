import { describe, it, expect, vi } from 'vitest';

vi.mock('@/backend/src/services/marketHours', () => ({
  toEasternTime: vi.fn().mockReturnValue({ dateStr: '2026-02-23', hour: 10, minute: 30 }),
}));

import { getGEXAdaptiveStopMultiplier } from '@/backend/src/services/spx/calendarService';

describe('GEX-Adaptive Stops (S10)', () => {
  describe('Positive GEX environment', () => {
    it('tightens stops by ~12.5%', () => {
      const multiplier = getGEXAdaptiveStopMultiplier(500000, 'fade_at_wall');
      expect(multiplier).toBe(0.875);
    });

    it('produces 10-15% tighter stops', () => {
      const multiplier = getGEXAdaptiveStopMultiplier(100000, 'trend_continuation');
      expect(multiplier).toBeGreaterThanOrEqual(0.85);
      expect(multiplier).toBeLessThanOrEqual(0.90);
    });

    it('applies same tightening to all strategy types', () => {
      const fade = getGEXAdaptiveStopMultiplier(500000, 'fade_at_wall');
      const trend = getGEXAdaptiveStopMultiplier(500000, 'trend_continuation');
      expect(fade).toBe(trend);
    });
  });

  describe('Negative GEX environment', () => {
    it('widens stops for mean_reversion', () => {
      const multiplier = getGEXAdaptiveStopMultiplier(-300000, 'mean_reversion');
      expect(multiplier).toBe(1.125);
      expect(multiplier).toBeGreaterThan(1.0);
    });

    it('widens stops for fade_at_wall', () => {
      const multiplier = getGEXAdaptiveStopMultiplier(-300000, 'fade_at_wall');
      expect(multiplier).toBe(1.125);
    });

    it('widens stops less for trend strategies', () => {
      const multiplier = getGEXAdaptiveStopMultiplier(-300000, 'trend_continuation');
      expect(multiplier).toBe(1.10);
      expect(multiplier).toBeLessThan(1.125);
    });

    it('produces 10-15% wider stops', () => {
      const multiplier = getGEXAdaptiveStopMultiplier(-100000, 'orb_breakout');
      expect(multiplier).toBeGreaterThanOrEqual(1.0);
      expect(multiplier).toBeLessThanOrEqual(1.15);
    });
  });

  describe('Neutral GEX', () => {
    it('returns 1.0 (no adjustment)', () => {
      expect(getGEXAdaptiveStopMultiplier(0, 'fade_at_wall')).toBe(1.0);
    });
  });

  describe('Edge cases', () => {
    it('handles NaN GEX', () => {
      expect(getGEXAdaptiveStopMultiplier(NaN, 'fade_at_wall')).toBe(1.0);
    });

    it('handles Infinity GEX', () => {
      expect(getGEXAdaptiveStopMultiplier(Infinity, 'fade_at_wall')).toBe(1.0);
    });
  });

  describe('Stop price verification', () => {
    it('positive GEX produces tighter stop in geometry output', () => {
      const baseStop = 5790;
      const entryMid = 5810;
      const stopDistance = entryMid - baseStop; // 20 points
      const multiplier = getGEXAdaptiveStopMultiplier(500000, 'fade_at_wall');
      const adjustedStopDistance = stopDistance * multiplier;
      const adjustedStop = entryMid - adjustedStopDistance;
      expect(adjustedStop).toBeGreaterThan(baseStop);
      expect(adjustedStopDistance).toBeLessThan(stopDistance);
    });

    it('negative GEX produces wider stop in geometry output', () => {
      const baseStop = 5790;
      const entryMid = 5810;
      const stopDistance = entryMid - baseStop;
      const multiplier = getGEXAdaptiveStopMultiplier(-300000, 'mean_reversion');
      const adjustedStopDistance = stopDistance * multiplier;
      const adjustedStop = entryMid - adjustedStopDistance;
      expect(adjustedStop).toBeLessThan(baseStop);
      expect(adjustedStopDistance).toBeGreaterThan(stopDistance);
    });
  });
});
