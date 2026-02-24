import { __testables } from '../setupDetector';

function buildGexLandscape() {
  return {
    spx: {
      symbol: 'SPX' as const,
      spotPrice: 5000,
      netGex: 1200,
      flipPoint: 4980,
      callWall: 5050,
      putWall: 4950,
      zeroGamma: 4980,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-24T15:00:00.000Z',
    },
    spy: {
      symbol: 'SPY' as const,
      spotPrice: 500,
      netGex: 600,
      flipPoint: 4980,
      callWall: 5050,
      putWall: 4950,
      zeroGamma: 4980,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-24T15:00:00.000Z',
    },
    combined: {
      symbol: 'COMBINED' as const,
      spotPrice: 5000,
      netGex: 1800,
      flipPoint: 4980,
      callWall: 5050,
      putWall: 4950,
      zeroGamma: 4980,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-24T15:00:00.000Z',
    },
  };
}

function buildIndicatorContext(overrides?: Record<string, unknown>) {
  return {
    emaFast: 100,
    emaSlow: 95,
    emaFastSlope: 0.2,
    emaSlowSlope: 0.1,
    atr14: 2,
    volumeTrend: 'rising' as const,
    sessionOpenPrice: 98,
    orbHigh: 102,
    orbLow: 94,
    minutesSinceOpen: 200,
    sessionOpenTimestamp: '2026-02-24T14:30:00.000Z',
    asOfTimestamp: '2026-02-24T15:00:00.000Z',
    vwapPrice: 100,
    vwapDeviation: 0.2,
    vwapBand1SD: { upper: 101, lower: 99 },
    vwapBand15SD: { upper: 102, lower: 98 },
    vwapBand2SD: { upper: 103, lower: 97 },
    latestBar: { t: Date.parse('2026-02-24T15:00:00.000Z'), o: 100, h: 101, l: 99, c: 100, v: 1000 },
    priorBar: { t: Date.parse('2026-02-24T14:59:00.000Z'), o: 99.5, h: 100.5, l: 99, c: 99.8, v: 900 },
    avgRecentVolume: 950,
    ...(overrides || {}),
  };
}

describe('spx/trend pullback EMA source', () => {
  it('classifies trend pullback when latest bar close is near EMA even if live price drifts', () => {
    const setupType = __testables.inferSetupTypeForZone({
      regime: 'trending',
      direction: 'bullish',
      currentPrice: 130,
      zoneCenter: 120,
      gexLandscape: buildGexLandscape(),
      indicatorContext: buildIndicatorContext({
        emaFast: 100,
        latestBar: { t: Date.parse('2026-02-24T15:00:00.000Z'), o: 99, h: 102, l: 98, c: 105, v: 1200 },
      }),
      emaAligned: true,
      volumeRegimeAligned: true,
    });

    expect(setupType).toBe('trend_pullback');
  });

  it('does not classify trend pullback when latest bar close is far from EMA', () => {
    const setupType = __testables.inferSetupTypeForZone({
      regime: 'trending',
      direction: 'bullish',
      currentPrice: 104,
      zoneCenter: 110,
      gexLandscape: buildGexLandscape(),
      indicatorContext: buildIndicatorContext({
        emaFast: 100,
        latestBar: { t: Date.parse('2026-02-24T15:00:00.000Z'), o: 118, h: 121, l: 117, c: 120, v: 1200 },
      }),
      emaAligned: true,
      volumeRegimeAligned: true,
    });

    expect(setupType).toBe('trend_continuation');
  });
});
