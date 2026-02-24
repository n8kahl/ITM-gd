import {
  calculateAdaptiveStop,
  deriveNearestGEXDistanceBp,
  resolveGEXDirectionalScale,
  resolveGEXMagnitudeScale,
  resolveVixStopScale,
} from '../stopEngine';

describe('spx/stopEngine', () => {
  it('classifies VIX stop scales by regime', () => {
    expect(resolveVixStopScale('normal')).toBe(1);
    expect(resolveVixStopScale('elevated')).toBe(1.3);
    expect(resolveVixStopScale('extreme')).toBe(1.6);
    expect(resolveVixStopScale('unknown')).toBe(1);
  });

  it('computes nearest GEX distance in basis points', () => {
    const distance = deriveNearestGEXDistanceBp({
      referencePrice: 5000,
      callWall: 5050,
      putWall: 4920,
      flipPoint: 4988,
    });

    expect(distance).toBe(24);
  });

  it('applies directional GEX scaling for mean reversion in negative GEX', () => {
    const scale = resolveGEXDirectionalScale({
      netGex: -1,
      setupType: 'mean_reversion',
    });

    expect(scale).toBe(1.1);
  });

  it('applies magnitude scaling by GEX distance buckets', () => {
    expect(resolveGEXMagnitudeScale(650)).toBe(1.2);
    expect(resolveGEXMagnitudeScale(250)).toBe(1);
    expect(resolveGEXMagnitudeScale(120)).toBe(0.7);
  });

  it('returns adaptive stop with ATR floor and volatility scaling', () => {
    const output = calculateAdaptiveStop({
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
      vixRegime: 'elevated',
      gexDistanceBp: 700,
      vixStopScalingEnabled: true,
      gexMagnitudeScalingEnabled: true,
    });

    expect(output.stop).toBeLessThan(4996);
    expect(output.atrFloorPoints).toBe(3);
    expect(output.scale.vix).toBe(1.3);
    expect(output.scale.gexDirectional).toBe(1.1);
    expect(output.scale.gexMagnitude).toBe(1.2);
  });
});
