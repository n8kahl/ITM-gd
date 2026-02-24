import { calculateAdaptiveEV } from '../evCalculator';

describe('spx/evCalculator', () => {
  it('applies high-vix weights and produces finite EV', () => {
    const result = calculateAdaptiveEV({
      pWin: 0.62,
      target1R: 1.2,
      target2R: 2.1,
      vixValue: 29,
      minutesSinceOpen: 120,
    });

    expect(result.t1Weight).toBeGreaterThan(result.t2Weight);
    expect(result.t1Weight).toBeCloseTo(0.72, 2);
    expect(Number.isFinite(result.evR)).toBe(true);
  });

  it('applies post-2pm pWin decay', () => {
    const early = calculateAdaptiveEV({
      pWin: 0.6,
      target1R: 1.1,
      target2R: 1.9,
      vixValue: 20,
      minutesSinceOpen: 180,
    });
    const late = calculateAdaptiveEV({
      pWin: 0.6,
      target1R: 1.1,
      target2R: 1.9,
      vixValue: 20,
      minutesSinceOpen: 320,
    });

    expect(late.adjustedPWin).toBeLessThan(early.adjustedPWin);
    expect(early.adjustedPWin - late.adjustedPWin).toBeCloseTo(0.05, 4);
  });

  it('normalizes custom loss distribution and slippage', () => {
    const result = calculateAdaptiveEV({
      pWin: 0.57,
      target1R: 1.0,
      target2R: 2.0,
      slippageR: 0.08,
      lossDistribution: [
        { rLoss: 0.5, probability: 2 },
        { rLoss: 1.0, probability: 1 },
      ],
    });

    expect(result.expectedLossR).toBeCloseTo((0.5 * (2 / 3)) + (1.0 * (1 / 3)), 3);
    expect(result.slippageR).toBe(0.08);
  });
});
