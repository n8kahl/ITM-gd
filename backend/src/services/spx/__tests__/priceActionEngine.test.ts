import {
  buildTriggerContext,
  calculatePenetrationDepth,
  classifyApproachSpeed,
  detectCandlePattern,
  isVolumeSpike,
} from '../priceActionEngine';

describe('spx/priceActionEngine', () => {
  it('detects bullish engulfing candles', () => {
    const pattern = detectCandlePattern({
      currentBar: { t: Date.UTC(2026, 1, 23, 14, 31), o: 99, h: 102, l: 98.5, c: 101, v: 1200 },
      priorBar: { t: Date.UTC(2026, 1, 23, 14, 30), o: 100.5, h: 101, l: 98, c: 99.2, v: 900 },
    });

    expect(pattern).toBe('engulfing_bull');
  });

  it('calculates penetration depth relative to zone boundaries', () => {
    const bullishDepth = calculatePenetrationDepth({
      direction: 'bullish',
      zone: {
        id: 'zone-a',
        priceLow: 100,
        priceHigh: 102,
        clusterScore: 4,
        type: 'defended',
        sources: [],
        testCount: 0,
        lastTestAt: null,
        held: null,
        holdRate: null,
      },
      triggerBar: {
        t: Date.UTC(2026, 1, 23, 14, 35),
        o: 100.5,
        h: 101,
        l: 99.3,
        c: 100.8,
        v: 1200,
      },
    });

    expect(bullishDepth).toBe(0.7);
  });

  it('updates latency from prior trigger context for triggered setup', () => {
    const context = buildTriggerContext({
      previous: {
        triggerBarTimestamp: '2026-02-23T14:30:00.000Z',
        triggerBarPatternType: 'hammer',
        triggerBarVolume: 1000,
        penetrationDepth: 0.5,
        triggerLatencyMs: 0,
      },
      setupStatus: 'triggered',
      triggeredAt: '2026-02-23T14:30:00.000Z',
      evaluationTimestamp: '2026-02-23T14:31:05.000Z',
      direction: 'bullish',
      zone: {
        id: 'zone-a',
        priceLow: 100,
        priceHigh: 102,
        clusterScore: 4,
        type: 'defended',
        sources: [],
        testCount: 0,
        lastTestAt: null,
        held: null,
        holdRate: null,
      },
      latestBar: null,
      priorBar: null,
    });

    expect(context?.triggerLatencyMs).toBe(65_000);
    expect(context?.triggerBarPatternType).toBe('hammer');
  });

  it('classifies approach speed and volume spike', () => {
    expect(classifyApproachSpeed({ pointsMoved: 6, secondsToLevel: 20 })).toBe('fast');
    expect(classifyApproachSpeed({ pointsMoved: 2, secondsToLevel: 20 })).toBe('moderate');
    expect(classifyApproachSpeed({ pointsMoved: 0.8, secondsToLevel: 20 })).toBe('slow');

    expect(isVolumeSpike({ currentVolume: 2100, priorVolumes: [900, 1000, 1100] })).toBe(true);
    expect(isVolumeSpike({ currentVolume: 1200, priorVolumes: [900, 1000, 1100] })).toBe(false);
  });
});
