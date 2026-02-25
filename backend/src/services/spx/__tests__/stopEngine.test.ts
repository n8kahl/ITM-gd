import * as stopEngine from '../stopEngine';
import type { Regime } from '../types';

type StopEngineWithProposedExports = typeof stopEngine & {
  getRegimeBaseAtrMultiplier?: (regime: Regime | null | undefined) => number;
};

const getRegimeBaseAtrMultiplier = (stopEngine as StopEngineWithProposedExports)
  .getRegimeBaseAtrMultiplier;

describe('spx/stopEngine', () => {
  it('classifies VIX stop scales by regime', () => {
    expect(stopEngine.resolveVixStopScale('normal')).toBe(1);
    expect(stopEngine.resolveVixStopScale('elevated')).toBe(1.3);
    expect(stopEngine.resolveVixStopScale('extreme')).toBe(1.6);
    expect(stopEngine.resolveVixStopScale('unknown')).toBe(1);
  });

  it('computes nearest GEX distance in basis points', () => {
    const distance = stopEngine.deriveNearestGEXDistanceBp({
      referencePrice: 5000,
      callWall: 5050,
      putWall: 4920,
      flipPoint: 4988,
    });

    expect(distance).toBe(24);
  });

  it('applies directional GEX scaling for mean reversion in negative GEX', () => {
    const scale = stopEngine.resolveGEXDirectionalScale({
      netGex: -1,
      setupType: 'mean_reversion',
    });

    expect(scale).toBe(1.1);
  });

  it('applies magnitude scaling by GEX distance buckets', () => {
    expect(stopEngine.resolveGEXMagnitudeScale(650)).toBe(1.2);
    expect(stopEngine.resolveGEXMagnitudeScale(250)).toBe(1);
    expect(stopEngine.resolveGEXMagnitudeScale(120)).toBe(0.7);
  });

  it('returns adaptive stop with ATR floor and volatility scaling', () => {
    const output = stopEngine.calculateAdaptiveStop({
      direction: 'bullish',
      entryLow: 5000,
      entryHigh: 5001,
      baseStop: 4998.5,
      geometryStopScale: 1,
      atr14: 3,
      atrStopFloorEnabled: true,
      atrStopMultiplier: 1,
      netGex: -1,
      setupType: 'mean_reversion',
      regime: 'ranging',
      vixRegime: 'elevated',
      gexDistanceBp: 700,
      vixStopScalingEnabled: true,
      gexMagnitudeScalingEnabled: true,
    });

    expect(output.stop).toBe(4997.5);
    expect(output.riskPoints).toBe(3);
    expect(output.atrFloorPoints).toBe(3);
    expect(output.scale.vix).toBe(1.3);
    expect(output.scale.gexDirectional).toBe(1.1);
    expect(output.scale.gexMagnitude).toBe(1.2);
  });

  describe('getRegimeBaseAtrMultiplier (workstream 2 contract)', () => {
    it('returns 1.3 for trending regime', () => {
      expect(getRegimeBaseAtrMultiplier?.('trending')).toBe(1.3);
    });

    it('returns 1.5 for breakout regime', () => {
      expect(getRegimeBaseAtrMultiplier?.('breakout')).toBe(1.5);
    });

    it('returns 1.0 for ranging regime', () => {
      expect(getRegimeBaseAtrMultiplier?.('ranging')).toBe(1);
    });

    it('returns 0.85 for compression regime', () => {
      expect(getRegimeBaseAtrMultiplier?.('compression')).toBe(0.85);
    });

    it('returns fallback 1.0 for null or undefined regime', () => {
      expect(getRegimeBaseAtrMultiplier?.(null)).toBe(1);
      expect(getRegimeBaseAtrMultiplier?.(undefined)).toBe(1);
    });
  });

  describe('calculateAdaptiveStop regime-aware behavior (workstream 2 contract)', () => {
    const baseInput: stopEngine.AdaptiveStopInput = {
      direction: 'bullish',
      entryLow: 5000,
      entryHigh: 5000,
      baseStop: 4999.65,
      geometryStopScale: 1,
      atr14: 2,
      atrStopFloorEnabled: true,
      netGex: 0,
      vixStopScalingEnabled: false,
      gexMagnitudeScalingEnabled: false,
    };

    it('uses 1.3 effective ATR multiplier for trending with no explicit atrStopMultiplier', () => {
      const output = stopEngine.calculateAdaptiveStop({
        ...baseInput,
        regime: 'trending',
      });

      expect(output.atrFloorPoints).toBe(2.6);
      expect(output.riskPoints).toBe(2.6);
    });

    it('uses 0.85 effective ATR multiplier for compression with no explicit atrStopMultiplier', () => {
      const output = stopEngine.calculateAdaptiveStop({
        ...baseInput,
        regime: 'compression',
      });

      expect(output.atrFloorPoints).toBe(1.7);
      expect(output.riskPoints).toBe(1.7);
    });

    it('prefers explicit atrStopMultiplier over regime default', () => {
      const output = stopEngine.calculateAdaptiveStop({
        ...baseInput,
        regime: 'trending',
        atrStopMultiplier: 2,
      });

      expect(output.atrFloorPoints).toBe(4);
      expect(output.riskPoints).toBe(4);
    });

    it('treats explicit legacy default 0.9 as unset when regime is available', () => {
      const output = stopEngine.calculateAdaptiveStop({
        ...baseInput,
        regime: 'trending',
        atrStopMultiplier: 0.9,
      });

      expect(output.atrFloorPoints).toBe(2.6);
      expect(output.riskPoints).toBe(2.6);
    });

    it('falls back to 1.0 when regime is null and no explicit atrStopMultiplier is provided', () => {
      const output = stopEngine.calculateAdaptiveStop({
        ...baseInput,
        regime: null,
      });

      expect(output.atrFloorPoints).toBe(2);
      expect(output.riskPoints).toBe(2);
    });
  });

  describe('calculateAdaptiveStop post-composition ATR ceiling (workstream 2 contract)', () => {
    it('caps riskPoints at 3.0 × ATR14 when compounded scales exceed the ceiling', () => {
      const output = stopEngine.calculateAdaptiveStop({
        direction: 'bullish',
        entryLow: 5000,
        entryHigh: 5000,
        baseStop: 4999.65,
        geometryStopScale: 4,
        atr14: 2,
        atrStopFloorEnabled: true,
        regime: 'breakout',
        vixRegime: 'extreme',
        gexDistanceBp: 700,
        setupType: 'trend_continuation',
        vixStopScalingEnabled: true,
        gexMagnitudeScalingEnabled: true,
      });

      expect(output.riskPoints).toBe(6);
    });

    it('does not cap riskPoints when value is below 3.0 × ATR14', () => {
      const output = stopEngine.calculateAdaptiveStop({
        direction: 'bullish',
        entryLow: 5000,
        entryHigh: 5000,
        baseStop: 4999.65,
        geometryStopScale: 1,
        atr14: 2,
        atrStopFloorEnabled: true,
        atrStopMultiplier: 1,
        regime: 'breakout',
        vixStopScalingEnabled: false,
        gexMagnitudeScalingEnabled: false,
      });

      expect(output.riskPoints).toBe(2);
    });

    it('does not apply ceiling when ATR14 is missing', () => {
      const output = stopEngine.calculateAdaptiveStop({
        direction: 'bullish',
        entryLow: 5000,
        entryHigh: 5000,
        baseStop: 4995,
        geometryStopScale: 4,
        atr14: null,
        atrStopFloorEnabled: true,
        regime: 'breakout',
        vixRegime: 'extreme',
        gexDistanceBp: 700,
        setupType: 'trend_continuation',
        vixStopScalingEnabled: true,
        gexMagnitudeScalingEnabled: true,
      });

      expect(output.riskPoints).toBe(25);
    });
  });

  describe('MEAN_REVERSION_STOP_CONFIG maxPoints calibrated values (workstream 2 contract)', () => {
    const inferMaxPoints = (regime: Regime): number => (
      5000 - stopEngine.calculateMeanReversionStop(5000, 'bullish', 100, regime)
    );

    it('uses compression maxPoints of 10', () => {
      const maxPoints = inferMaxPoints('compression');
      expect(maxPoints).toBe(10);
    });

    it('uses ranging maxPoints of 15', () => {
      const maxPoints = inferMaxPoints('ranging');
      expect(maxPoints).toBe(15);
    });

    it('uses trending maxPoints of 15', () => {
      const maxPoints = inferMaxPoints('trending');
      expect(maxPoints).toBe(15);
    });

    it('uses breakout maxPoints of 18', () => {
      const maxPoints = inferMaxPoints('breakout');
      expect(maxPoints).toBe(18);
    });
  });
});
