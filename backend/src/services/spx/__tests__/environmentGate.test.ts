import {
  applyEnvironmentGateToSetups,
  buildStandbyGuidance,
  calculateDynamicReadyThreshold,
  classifyVixRegime,
  evaluateEnvironmentGate,
} from '../environmentGate';
import type { Setup } from '../types';

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function buildBars(startPrice: number, count = 40): Array<{ t: number; o: number; h: number; l: number; c: number }> {
  const start = Date.parse('2026-02-20T14:30:00.000Z');
  return Array.from({ length: count }).map((_, index) => {
    const wave = Math.sin(index / 3) * 2.2;
    const drift = index * 0.12;
    const open = startPrice + drift + wave;
    const close = open + (index % 2 === 0 ? 0.9 : -0.7);
    const high = Math.max(open, close) + 0.8;
    const low = Math.min(open, close) - 0.8;

    return {
      t: start + (index * 60_000),
      o: Number(open.toFixed(2)),
      h: Number(high.toFixed(2)),
      l: Number(low.toFixed(2)),
      c: Number(close.toFixed(2)),
    };
  });
}

function buildSetup(overrides: Partial<Setup> = {}): Setup {
  return {
    id: 'setup-1',
    type: 'trend_pullback',
    direction: 'bullish',
    entryZone: { low: 5988, high: 5990 },
    stop: 5983.5,
    target1: { price: 5996.5, label: 'Target 1' },
    target2: { price: 6002.5, label: 'Target 2' },
    confluenceScore: 3,
    confluenceSources: ['ema_alignment', 'gex_alignment'],
    clusterZone: {
      id: 'cluster-1',
      priceLow: 5987.5,
      priceHigh: 5990.5,
      clusterScore: 4.1,
      type: 'defended',
      sources: [],
      testCount: 2,
      lastTestAt: '2026-02-20T14:45:00.000Z',
      held: true,
      holdRate: 66,
    },
    regime: 'trending',
    status: 'ready',
    probability: 64,
    recommendedContract: null,
    createdAt: '2026-02-20T14:45:00.000Z',
    triggeredAt: null,
    ...overrides,
  };
}

describe('spx/environmentGate', () => {
  it('classifies VIX regimes', () => {
    expect(classifyVixRegime(14)).toBe('normal');
    expect(classifyVixRegime(22)).toBe('elevated');
    expect(classifyVixRegime(29)).toBe('extreme');
    expect(classifyVixRegime(null)).toBe('unknown');
  });

  it('increases ready threshold in high-risk environments', () => {
    const threshold = calculateDynamicReadyThreshold({
      vixValue: 31,
      minuteEt: 15 * 60 + 35,
      compressionSpreadPct: 9,
      macroCaution: true,
      regimeState: {
        regime: 'compression',
        direction: 'neutral',
        probability: 54,
        magnitude: 'small',
        confidence: 70,
        timestamp: '2026-02-20T20:35:00.000Z',
      },
    });

    expect(threshold).toBeGreaterThanOrEqual(3.8);
  });

  it('passes environment gate in normal session conditions', async () => {
    const decision = await evaluateEnvironmentGate({
      evaluationDate: new Date('2026-02-20T15:00:00.000Z'),
      currentPrice: 6001,
      sessionOpenPrice: 5996,
      atr14: 1.8,
      vixValue: 16,
      bars1m: buildBars(5996),
      marketSession: {
        status: 'open',
        market: 'open',
        minuteEt: 600,
        minutesUntilClose: 360,
        sessionProgress: 10,
        source: 'local',
        asOf: '2026-02-20T15:00:00.000Z',
      },
      regimeState: {
        regime: 'trending',
        direction: 'bullish',
        probability: 66,
        magnitude: 'medium',
        confidence: 78,
        timestamp: '2026-02-20T15:00:00.000Z',
      },
      disableMacroCalendar: true,
    });

    expect(decision.passed).toBe(true);
    expect(decision.breakdown.sessionTime.passed).toBe(true);
    expect(decision.breakdown.vixRegime.passed).toBe(true);
    expect(decision.dynamicReadyThreshold).toBeGreaterThanOrEqual(2.5);
  });

  it('blocks environment gate when VIX is extreme', async () => {
    const decision = await evaluateEnvironmentGate({
      evaluationDate: new Date('2026-02-20T15:00:00.000Z'),
      currentPrice: 6000,
      sessionOpenPrice: 5996,
      atr14: 1.6,
      vixValue: 35,
      bars1m: buildBars(5996),
      marketSession: {
        status: 'open',
        market: 'open',
        minuteEt: 600,
        minutesUntilClose: 360,
        sessionProgress: 10,
        source: 'local',
        asOf: '2026-02-20T15:00:00.000Z',
      },
      disableMacroCalendar: true,
    });

    expect(decision.passed).toBe(false);
    expect(decision.breakdown.vixRegime.passed).toBe(false);
    expect(decision.reason?.toLowerCase()).toContain('vix');
  });

  it('blocks when event risk gate override is in blackout', async () => {
    const decision = await evaluateEnvironmentGate({
      evaluationDate: new Date('2026-02-20T15:00:00.000Z'),
      currentPrice: 6000,
      sessionOpenPrice: 5996,
      atr14: 1.7,
      vixValue: 18,
      bars1m: buildBars(5996),
      marketSession: {
        status: 'open',
        market: 'open',
        minuteEt: 600,
        minutesUntilClose: 360,
        sessionProgress: 10,
        source: 'local',
        asOf: '2026-02-20T15:00:00.000Z',
      },
      disableMacroCalendar: true,
      eventRiskOverride: {
        passed: false,
        caution: true,
        blackout: true,
        riskScore: 92,
        reason: 'Breaking high-impact news flow (bearish -70)',
        source: 'news',
        nextEvent: null,
        newsSentimentScore: -70,
        marketMovingArticleCount: 4,
        recentHighImpactCount: 3,
        latestArticleAt: '2026-02-20T14:59:00.000Z',
      },
    });

    expect(decision.passed).toBe(false);
    expect(decision.breakdown.eventRisk?.passed).toBe(false);
    expect(decision.breakdown.eventRisk?.source).toBe('news');
    expect(decision.breakdown.eventRisk?.reason?.toLowerCase()).toContain('breaking high-impact news flow');
    expect(decision.reasons.some((reason) => reason.toLowerCase().includes('breaking high-impact news flow'))).toBe(true);
  });

  it('demotes actionable setups and returns standby guidance when gate is blocked', async () => {
    const blockedGate = await evaluateEnvironmentGate({
      evaluationDate: new Date('2026-02-20T15:00:00.000Z'),
      currentPrice: 6000,
      sessionOpenPrice: 5996,
      atr14: 1.4,
      vixValue: 34,
      bars1m: buildBars(5996),
      marketSession: {
        status: 'open',
        market: 'open',
        minuteEt: 600,
        minutesUntilClose: 360,
        sessionProgress: 10,
        source: 'local',
        asOf: '2026-02-20T15:00:00.000Z',
      },
      disableMacroCalendar: true,
    });

    expect(blockedGate.passed).toBe(false);

    const setups = [
      buildSetup(),
      buildSetup({
        id: 'setup-2',
        status: 'forming',
        confluenceScore: 2,
        probability: 51,
      }),
    ];

    const gated = applyEnvironmentGateToSetups({
      setups,
      gate: blockedGate,
    });

    expect(gated[0]?.status).toBe('forming');
    expect(gated[0]?.gateStatus).toBe('blocked');

    const guidance = buildStandbyGuidance({
      gate: blockedGate,
      setups,
      asOfTimestamp: '2026-02-20T15:00:00.000Z',
    });

    expect(guidance?.status).toBe('STANDBY');
    expect(guidance?.nearestSetup?.setupId).toBe('setup-1');
    expect(guidance?.waitingFor.length).toBeGreaterThan(0);
    expect(guidance?.watchZones.length).toBeGreaterThan(0);
  });
});
