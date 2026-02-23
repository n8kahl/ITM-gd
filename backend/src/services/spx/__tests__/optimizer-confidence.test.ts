import { __optimizerTestUtils } from '../optimizer';

describe('optimizer confidence controls', () => {
  it('computes a bounded Wilson interval around the point estimate', () => {
    const interval = __optimizerTestUtils.wilsonIntervalPct(6, 10);

    expect(interval.sampleSize).toBe(10);
    expect(interval.pointPct).toBe(60);
    expect(interval.lowerPct).toBeLessThan(interval.pointPct);
    expect(interval.upperPct).toBeGreaterThan(interval.pointPct);
    expect(interval.lowerPct).toBeGreaterThanOrEqual(0);
    expect(interval.upperPct).toBeLessThanOrEqual(100);
  });

  it('tracks conservative objective below headline objective', () => {
    const rows = [
      {
        triggered: true,
        finalOutcome: 't2_before_stop',
      },
      {
        triggered: true,
        finalOutcome: 't1_before_stop',
      },
      {
        triggered: true,
        finalOutcome: 'stop_before_t1',
      },
      {
        triggered: true,
        finalOutcome: 'stop_before_t1',
      },
      {
        triggered: false,
        finalOutcome: null,
      },
    ] as any;

    const metrics = __optimizerTestUtils.toMetrics(rows, {
      t1: 0.6,
      t2: 0.4,
      failurePenalty: 0.45,
      expectancyR: 14,
    }, {
      partialAtT1Pct: 0.5,
      moveStopToBreakeven: true,
    });

    expect(metrics.tradeCount).toBe(4);
    expect(metrics.resolvedCount).toBe(4);
    expect(metrics.t1Confidence95.sampleSize).toBe(4);
    expect(metrics.objectiveScoreConservative).toBeLessThanOrEqual(metrics.objectiveScore);
  });

  it('pauses combos only when upper confidence bound is under floor', () => {
    const buckets = [
      {
        key: 'fade_at_wall|ranging',
        tradeCount: 20,
        resolvedCount: 20,
        t1WinRatePct: 45,
        t2WinRatePct: 10,
        failureRatePct: 55,
        t1Confidence95: { sampleSize: 20, pointPct: 45, lowerPct: 25, upperPct: 66 },
        t2Confidence95: { sampleSize: 20, pointPct: 10, lowerPct: 3, upperPct: 28 },
        failureConfidence95: { sampleSize: 20, pointPct: 55, lowerPct: 34, upperPct: 75 },
      },
      {
        key: 'breakout_vacuum|breakout',
        tradeCount: 20,
        resolvedCount: 20,
        t1WinRatePct: 40,
        t2WinRatePct: 8,
        failureRatePct: 60,
        t1Confidence95: { sampleSize: 20, pointPct: 40, lowerPct: 21, upperPct: 47 },
        t2Confidence95: { sampleSize: 20, pointPct: 8, lowerPct: 2, upperPct: 25 },
        failureConfidence95: { sampleSize: 20, pointPct: 60, lowerPct: 39, upperPct: 79 },
      },
    ] as any;

    const paused = __optimizerTestUtils.resolvePausedCombos(buckets, {
      regimeGate: {
        minTradesPerCombo: 12,
        minT1WinRatePct: 48,
      },
    } as any);

    expect(paused).toEqual(['breakout_vacuum|breakout']);
  });
});
