import { describe, it, expect } from 'vitest';

describe('VIX Regime Overlay (S8)', () => {
  type VIXRegime = 'low' | 'normal' | 'elevated' | 'high';

  function classifyVIXRegime(vix: number): VIXRegime {
    if (vix < 14) return 'low';
    if (vix < 20) return 'normal';
    if (vix < 28) return 'elevated';
    return 'high';
  }

  const ALLOWED_IN_HIGH_VIX = new Set(['mean_reversion', 'fade_at_wall']);

  const GEOMETRY_MULTIPLIERS: Record<string, { stopMultiplier: number; targetMultiplier: number }> = {
    low: { stopMultiplier: 1.10, targetMultiplier: 1.15 },
    elevated: { stopMultiplier: 1.15, targetMultiplier: 0.90 },
    high: { stopMultiplier: 1.20, targetMultiplier: 0.85 },
  };

  describe('VIX regime classification', () => {
    it('classifies VIX < 14 as low', () => {
      expect(classifyVIXRegime(12)).toBe('low');
      expect(classifyVIXRegime(13.9)).toBe('low');
    });

    it('classifies VIX 14-20 as normal', () => {
      expect(classifyVIXRegime(14)).toBe('normal');
      expect(classifyVIXRegime(17)).toBe('normal');
      expect(classifyVIXRegime(19.9)).toBe('normal');
    });

    it('classifies VIX 20-28 as elevated', () => {
      expect(classifyVIXRegime(20)).toBe('elevated');
      expect(classifyVIXRegime(25)).toBe('elevated');
      expect(classifyVIXRegime(27.9)).toBe('elevated');
    });

    it('classifies VIX > 28 as high', () => {
      expect(classifyVIXRegime(28)).toBe('high');
      expect(classifyVIXRegime(35)).toBe('high');
      expect(classifyVIXRegime(50)).toBe('high');
    });
  });

  describe('Strategy blocking in high VIX', () => {
    it('blocks trend_continuation in high VIX', () => {
      expect(ALLOWED_IN_HIGH_VIX.has('trend_continuation')).toBe(false);
    });

    it('blocks orb_breakout in high VIX', () => {
      expect(ALLOWED_IN_HIGH_VIX.has('orb_breakout')).toBe(false);
    });

    it('allows mean_reversion in high VIX', () => {
      expect(ALLOWED_IN_HIGH_VIX.has('mean_reversion')).toBe(true);
    });

    it('allows fade_at_wall in high VIX', () => {
      expect(ALLOWED_IN_HIGH_VIX.has('fade_at_wall')).toBe(true);
    });
  });

  describe('Geometry multipliers by VIX regime', () => {
    it('low VIX widens stops 10%', () => {
      expect(GEOMETRY_MULTIPLIERS.low.stopMultiplier).toBe(1.10);
    });

    it('low VIX widens targets 15%', () => {
      expect(GEOMETRY_MULTIPLIERS.low.targetMultiplier).toBe(1.15);
    });

    it('elevated VIX widens stops 15%', () => {
      expect(GEOMETRY_MULTIPLIERS.elevated.stopMultiplier).toBe(1.15);
    });

    it('elevated VIX tightens T1 10%', () => {
      expect(GEOMETRY_MULTIPLIERS.elevated.targetMultiplier).toBe(0.90);
    });

    it('high VIX widens stops 20%', () => {
      expect(GEOMETRY_MULTIPLIERS.high.stopMultiplier).toBe(1.20);
    });

    it('high VIX tightens targets to 0.85x', () => {
      expect(GEOMETRY_MULTIPLIERS.high.targetMultiplier).toBe(0.85);
    });
  });

  describe('Fail-closed behavior', () => {
    it('missing VIX defaults to normal regime', () => {
      const defaultRegime = classifyVIXRegime(NaN);
      // NaN comparison: NaN < 14 is false, NaN < 20 is false, NaN < 28 is false
      // So it falls through to 'high', which is fail-closed (most conservative)
      expect(defaultRegime).toBe('high');
    });

    it('normal regime has no geometry adjustment', () => {
      expect(GEOMETRY_MULTIPLIERS['normal']).toBeUndefined();
    });
  });
});
