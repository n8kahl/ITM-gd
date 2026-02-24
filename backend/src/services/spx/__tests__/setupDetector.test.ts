import { __resetSetupDetectorStateForTests, detectActiveSetups, getLatestSetupEnvironmentState } from '../setupDetector';
import { getMergedLevels } from '../levelEngine';
import { computeUnifiedGEXLandscape } from '../gexEngine';
import { getFibLevels } from '../fibEngine';
import { classifyCurrentRegime } from '../regimeClassifier';
import { getFlowEvents } from '../flowEngine';
import { getActiveSPXOptimizationProfile } from '../optimizer';
import { cacheGet, cacheSet } from '../../../config/redis';

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

jest.mock('../levelEngine', () => ({
  getMergedLevels: jest.fn(),
}));

jest.mock('../gexEngine', () => ({
  computeUnifiedGEXLandscape: jest.fn(),
}));

jest.mock('../fibEngine', () => ({
  getFibLevels: jest.fn(),
}));

jest.mock('../regimeClassifier', () => ({
  classifyCurrentRegime: jest.fn(),
}));

jest.mock('../flowEngine', () => ({
  getFlowEvents: jest.fn(),
}));

jest.mock('../optimizer', () => ({
  getActiveSPXOptimizationProfile: jest.fn(),
}));

const mockGetMergedLevels = getMergedLevels as jest.MockedFunction<typeof getMergedLevels>;
const mockComputeUnifiedGEXLandscape = computeUnifiedGEXLandscape as jest.MockedFunction<typeof computeUnifiedGEXLandscape>;
const mockGetFibLevels = getFibLevels as jest.MockedFunction<typeof getFibLevels>;
const mockClassifyCurrentRegime = classifyCurrentRegime as jest.MockedFunction<typeof classifyCurrentRegime>;
const mockGetFlowEvents = getFlowEvents as jest.MockedFunction<typeof getFlowEvents>;
const mockGetActiveSPXOptimizationProfile = getActiveSPXOptimizationProfile as jest.MockedFunction<typeof getActiveSPXOptimizationProfile>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const originalEnv = { ...process.env };

function buildBaseMocks(currentPrice: number) {
  mockGetMergedLevels.mockResolvedValue({
    levels: [],
    clusters: [
      {
        id: 'cluster-1',
        priceLow: 100,
        priceHigh: 102,
        clusterScore: 4.2,
        type: 'defended',
        sources: [],
        testCount: 1,
        lastTestAt: '2026-02-15T14:40:00.000Z',
        held: true,
        holdRate: 70,
      },
    ],
    generatedAt: '2026-02-15T14:40:00.000Z',
  });

  mockComputeUnifiedGEXLandscape.mockResolvedValue({
    spx: {
      symbol: 'SPX',
      spotPrice: currentPrice,
      netGex: 2000,
      flipPoint: 101,
      callWall: 106,
      putWall: 96,
      zeroGamma: 101,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-15T14:40:00.000Z',
    },
    spy: {
      symbol: 'SPY',
      spotPrice: currentPrice / 10,
      netGex: 900,
      flipPoint: 101,
      callWall: 106,
      putWall: 96,
      zeroGamma: 101,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-15T14:40:00.000Z',
    },
    combined: {
      symbol: 'COMBINED',
      spotPrice: currentPrice,
      netGex: 2900,
      flipPoint: 101,
      callWall: 106,
      putWall: 96,
      zeroGamma: 101,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-15T14:40:00.000Z',
    },
  });

  mockGetFibLevels.mockResolvedValue([]);
  mockClassifyCurrentRegime.mockResolvedValue({
    regime: 'ranging',
    direction: 'neutral',
    probability: 62,
    magnitude: 'small',
    confidence: 71,
    timestamp: '2026-02-15T14:40:00.000Z',
  });
  mockGetFlowEvents.mockResolvedValue([]);
}

describe('spx/setupDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined as never);
    mockGetActiveSPXOptimizationProfile.mockResolvedValue({
      source: 'default',
      generatedAt: new Date().toISOString(),
      qualityGate: {
        minConfluenceScore: 0,
        minPWinCalibrated: 0,
        minEvR: -10,
        actionableStatuses: ['forming', 'ready', 'triggered', 'invalidated', 'expired'],
      },
      flowGate: {
        requireFlowConfirmation: false,
        minAlignmentPct: 0,
      },
      indicatorGate: {
        requireEmaAlignment: false,
        requireVolumeRegimeAlignment: false,
      },
      timingGate: {
        enabled: false,
        maxFirstSeenMinuteBySetupType: {},
      },
      regimeGate: {
        minTradesPerCombo: 999,
        minT1WinRatePct: 0,
        pausedCombos: [],
      },
      tradeManagement: {
        partialAtT1Pct: 0.5,
        moveStopToBreakeven: true,
      },
      walkForward: {
        trainingDays: 20,
        validationDays: 5,
        minTrades: 12,
        objectiveWeights: {
          t1: 0.6,
          t2: 0.4,
          failurePenalty: 0.45,
        },
      },
      driftControl: {
        enabled: false,
        shortWindowDays: 5,
        longWindowDays: 20,
        maxDropPct: 12,
        minLongWindowTrades: 20,
        pausedSetupTypes: [],
      },
    } as never);
    __resetSetupDetectorStateForTests();
    process.env = {
      ...originalEnv,
      SPX_SETUP_LIFECYCLE_ENABLED: 'true',
      SPX_SETUP_DEMOTION_STREAK: '2',
      SPX_SETUP_INVALIDATION_STREAK: '3',
      SPX_SETUP_STOP_CONFIRMATION_TICKS: '2',
      SPX_SETUP_TTL_FORMING_MS: String(20 * 60 * 1000),
      SPX_SETUP_TTL_READY_MS: String(25 * 60 * 1000),
      SPX_SETUP_TTL_TRIGGERED_MS: String(90 * 60 * 1000),
      SPX_SETUP_SPECIFIC_GATES_ENABLED: 'false',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('marks previously triggered setups as invalidated only after confirmed stop breach streak', async () => {
    buildBaseMocks(101);
    mockCacheGet.mockResolvedValueOnce(null as never);

    const initial = await detectActiveSetups({ forceRefresh: true });
    expect(initial[0].status).toBe('triggered');

    const previousTriggered = {
      ...initial[0],
      status: 'triggered' as const,
      direction: 'bullish' as const,
      stop: 98.5,
      triggeredAt: '2026-02-15T14:30:00.000Z',
      statusUpdatedAt: new Date().toISOString(),
    };

    buildBaseMocks(97);
    mockCacheGet.mockResolvedValue([previousTriggered] as never);

    const firstBreach = await detectActiveSetups({ forceRefresh: true });
    const secondBreach = await detectActiveSetups({ forceRefresh: true });
    const firstSameSetup = firstBreach.find((setup) => setup.id === previousTriggered.id);
    const secondSameSetup = secondBreach.find((setup) => setup.id === previousTriggered.id);

    expect(firstSameSetup).toBeTruthy();
    expect(firstSameSetup?.status).toBe('triggered');
    expect(secondSameSetup).toBeTruthy();
    expect(secondSameSetup?.status).toBe('invalidated');
    expect(secondSameSetup?.invalidationReason).toBe('stop_breach_confirmed');
    expect(secondSameSetup?.triggeredAt).toBe(previousTriggered.triggeredAt);
  });

  it('carries forward missing active setups as expired', async () => {
    const previous = {
      id: 'spx_setup_prev',
      type: 'fade_at_wall' as const,
      direction: 'bullish' as const,
      entryZone: { low: 100, high: 101 },
      stop: 98,
      target1: { price: 104, label: 'Target 1' },
      target2: { price: 107, label: 'Target 2' },
      confluenceScore: 4,
      confluenceSources: ['gex_alignment'],
      clusterZone: {
        id: 'cluster-1',
        priceLow: 100,
        priceHigh: 101,
        clusterScore: 4,
        type: 'defended' as const,
        sources: [],
        testCount: 1,
        lastTestAt: null,
        held: true,
        holdRate: 60,
      },
      regime: 'ranging' as const,
      status: 'ready' as const,
      probability: 71,
      recommendedContract: null,
      createdAt: '2026-02-15T13:00:00.000Z',
      triggeredAt: null,
      statusUpdatedAt: '2026-02-15T13:05:00.000Z',
      ttlExpiresAt: '2026-02-15T13:30:00.000Z',
      invalidationReason: null,
    };

    mockGetMergedLevels.mockResolvedValue({ levels: [], clusters: [], generatedAt: '2026-02-15T14:40:00.000Z' });
    mockComputeUnifiedGEXLandscape.mockResolvedValue({
      spx: { symbol: 'SPX', spotPrice: 101, netGex: 0, flipPoint: 100, callWall: 104, putWall: 96, zeroGamma: 100, gexByStrike: [], keyLevels: [], expirationBreakdown: {}, timestamp: '2026-02-15T14:40:00.000Z' },
      spy: { symbol: 'SPY', spotPrice: 10.1, netGex: 0, flipPoint: 100, callWall: 104, putWall: 96, zeroGamma: 100, gexByStrike: [], keyLevels: [], expirationBreakdown: {}, timestamp: '2026-02-15T14:40:00.000Z' },
      combined: { symbol: 'COMBINED', spotPrice: 101, netGex: 0, flipPoint: 100, callWall: 104, putWall: 96, zeroGamma: 100, gexByStrike: [], keyLevels: [], expirationBreakdown: {}, timestamp: '2026-02-15T14:40:00.000Z' },
    });
    mockGetFibLevels.mockResolvedValue([]);
    mockClassifyCurrentRegime.mockResolvedValue({
      regime: 'ranging',
      direction: 'neutral',
      probability: 60,
      magnitude: 'small',
      confidence: 70,
      timestamp: '2026-02-15T14:40:00.000Z',
    });
    mockGetFlowEvents.mockResolvedValue([]);
    mockCacheGet.mockResolvedValueOnce([previous] as never);

    const setups = await detectActiveSetups({ forceRefresh: true });

    expect(setups.length).toBe(1);
    expect(setups[0].id).toBe(previous.id);
    expect(setups[0].status).toBe('expired');
    expect(setups[0].statusUpdatedAt).toBeTruthy();
    expect(setups[0].ttlExpiresAt).toBeNull();
  });

  it('invalidates triggered setups after persistent regime conflict', async () => {
    buildBaseMocks(101);
    mockClassifyCurrentRegime.mockResolvedValue({
      regime: 'ranging',
      direction: 'bearish',
      probability: 70,
      magnitude: 'small',
      confidence: 75,
      timestamp: '2026-02-15T14:40:00.000Z',
    });
    mockCacheGet.mockResolvedValue(null as never);

    const first = await detectActiveSetups({ forceRefresh: true });
    const second = await detectActiveSetups({ forceRefresh: true });
    const third = await detectActiveSetups({ forceRefresh: true });

    expect(first[0]?.status).toBe('triggered');
    expect(second[0]?.status).toBe('triggered');
    expect(third[0]?.status).toBe('invalidated');
    expect(third[0]?.invalidationReason).toBe('regime_conflict');
  });

  it('demotes ready setups to forming on persistent directional divergence', async () => {
    buildBaseMocks(99);
    mockClassifyCurrentRegime.mockResolvedValue({
      regime: 'ranging',
      direction: 'bullish',
      probability: 72,
      magnitude: 'small',
      confidence: 81,
      timestamp: '2026-02-15T14:40:00.000Z',
    });
    mockCacheGet.mockResolvedValue(null as never);

    const first = await detectActiveSetups({ forceRefresh: true });
    const second = await detectActiveSetups({ forceRefresh: true });

    expect(first[0]?.status).toBe('ready');
    expect(second[0]?.status).toBe('forming');
  });

  it('assigns deterministic score, ev, tier, and rank metadata', async () => {
    buildBaseMocks(101);
    mockCacheGet.mockResolvedValueOnce(null as never);

    const setups = await detectActiveSetups({ forceRefresh: true });
    expect(setups.length).toBeGreaterThan(0);

    const setup = setups[0];
    expect(typeof setup.score).toBe('number');
    expect(typeof setup.evR).toBe('number');
    expect(typeof setup.pWinCalibrated).toBe('number');
    expect(typeof setup.rank).toBe('number');
    expect(setup.rank).toBe(1);
    expect(['sniper_primary', 'sniper_secondary', 'watchlist', 'hidden']).toContain(setup.tier);
  });

  it('invalidates triggered setups with ttl_expired reason when triggered ttl is exceeded', async () => {
    buildBaseMocks(101);
    mockCacheGet.mockResolvedValueOnce(null as never);
    const initial = await detectActiveSetups({ forceRefresh: true });
    const setup = initial[0];

    const staleTriggered = {
      ...setup,
      status: 'triggered' as const,
      statusUpdatedAt: '2020-01-01T00:00:00.000Z',
      triggeredAt: setup.triggeredAt || '2020-01-01T00:00:00.000Z',
    };

    buildBaseMocks(101);
    mockCacheGet.mockResolvedValueOnce([staleTriggered] as never);
    const next = await detectActiveSetups({ forceRefresh: true });
    const sameSetup = next.find((candidate) => candidate.id === setup.id);

    expect(sameSetup?.status).toBe('invalidated');
    expect(sameSetup?.invalidationReason).toBe('ttl_expired');
    expect(sameSetup?.ttlExpiresAt).toBeNull();
  });

  it('demotes actionable setups and exposes standby guidance when environment gate is blocked', async () => {
    buildBaseMocks(101);
    mockCacheGet.mockResolvedValueOnce(null as never);
    process.env.SPX_ENVIRONMENT_GATE_ENABLED = 'true';

    const blockedGate = {
      passed: false,
      reason: 'VIX 34 above actionable cap (30)',
      reasons: ['VIX 34 above actionable cap (30)'],
      vixRegime: 'extreme' as const,
      dynamicReadyThreshold: 3.8,
      caution: false,
      breakdown: {
        vixRegime: {
          passed: false,
          regime: 'extreme' as const,
          value: 34,
          reason: 'VIX 34 above actionable cap (30)',
        },
        expectedMoveConsumption: {
          passed: true,
          value: 42,
          expectedMovePoints: 12,
        },
        macroCalendar: {
          passed: true,
          caution: false,
          nextEvent: null,
        },
        sessionTime: {
          passed: true,
          minuteEt: 620,
          minutesUntilClose: 340,
          source: 'local' as const,
        },
        compression: {
          passed: true,
          realizedVolPct: 16,
          impliedVolPct: 34,
          spreadPct: 18,
        },
      },
    };

    const setups = await detectActiveSetups({
      forceRefresh: true,
      environmentGateOverride: blockedGate,
    });
    const actionableCount = setups.filter((setup) => setup.status === 'ready' || setup.status === 'triggered').length;

    expect(actionableCount).toBe(0);
    expect(setups.some((setup) => setup.gateReasons?.some((reason) => reason.startsWith('environment_gate:')))).toBe(true);

    const environmentState = await getLatestSetupEnvironmentState({ forceRefresh: true });
    expect(environmentState?.gate?.passed).toBe(false);
    expect(environmentState?.standbyGuidance?.status).toBe('STANDBY');
  });

  it('uses flow window signal to confirm setups when local flow is sparse', async () => {
    buildBaseMocks(101);
    mockCacheGet.mockResolvedValueOnce(null as never);

    const setups = await detectActiveSetups({
      forceRefresh: true,
      flowEvents: [
        {
          id: 'flow-1',
          type: 'sweep',
          symbol: 'SPX',
          strike: 150,
          expiry: '2026-02-20',
          size: 120,
          direction: 'bullish',
          premium: 220_000,
          timestamp: '2026-02-20T15:29:00.000Z',
        },
      ],
      flowAggregationOverride: {
        generatedAt: '2026-02-20T15:30:00.000Z',
        source: 'computed',
        directionalBias: 'bullish',
        primaryWindow: '5m',
        latestEventAt: '2026-02-20T15:29:00.000Z',
        windows: {
          '5m': {
            window: '5m',
            startAt: '2026-02-20T15:25:00.000Z',
            endAt: '2026-02-20T15:30:00.000Z',
            eventCount: 3,
            sweepCount: 2,
            blockCount: 1,
            bullishPremium: 280_000,
            bearishPremium: 70_000,
            totalPremium: 350_000,
            flowScore: 80,
            bias: 'bullish',
          },
          '15m': {
            window: '15m',
            startAt: '2026-02-20T15:15:00.000Z',
            endAt: '2026-02-20T15:30:00.000Z',
            eventCount: 4,
            sweepCount: 2,
            blockCount: 2,
            bullishPremium: 320_000,
            bearishPremium: 120_000,
            totalPremium: 440_000,
            flowScore: 72.73,
            bias: 'bullish',
          },
          '30m': {
            window: '30m',
            startAt: '2026-02-20T15:00:00.000Z',
            endAt: '2026-02-20T15:30:00.000Z',
            eventCount: 6,
            sweepCount: 3,
            blockCount: 3,
            bullishPremium: 430_000,
            bearishPremium: 190_000,
            totalPremium: 620_000,
            flowScore: 69.35,
            bias: 'bullish',
          },
        },
      },
    });

    expect(setups.length).toBeGreaterThan(0);
    expect(setups[0].flowConfirmed).toBe(true);
    expect(setups[0].decisionDrivers?.some((driver) => driver.includes('Flow window 5m aligned'))).toBe(true);
  });

  it('adds multi-timeframe confluence metadata when enabled', async () => {
    buildBaseMocks(101);
    mockCacheGet.mockResolvedValueOnce(null as never);
    process.env.SPX_MULTI_TF_CONFLUENCE_ENABLED = 'true';

    const setups = await detectActiveSetups({
      forceRefresh: true,
      multiTFConfluenceOverride: {
        asOf: '2026-02-20T15:30:00.000Z',
        source: 'computed',
        tf1m: {
          timeframe: '1m',
          ema21: 101.2,
          ema55: 100.9,
          slope21: 0.06,
          latestClose: 101.4,
          trend: 'up',
          swingHigh: 101.8,
          swingLow: 100.7,
          bars: [],
        },
        tf5m: {
          timeframe: '5m',
          ema21: 101.6,
          ema55: 100.8,
          slope21: 0.08,
          latestClose: 101.9,
          trend: 'up',
          swingHigh: 102.5,
          swingLow: 100.4,
          bars: [],
        },
        tf15m: {
          timeframe: '15m',
          ema21: 101.4,
          ema55: 100.7,
          slope21: 0.05,
          latestClose: 101.6,
          trend: 'up',
          swingHigh: 103.0,
          swingLow: 99.5,
          bars: [],
        },
        tf1h: {
          timeframe: '1h',
          ema21: 102.0,
          ema55: 100.6,
          slope21: 0.11,
          latestClose: 102.2,
          trend: 'up',
          swingHigh: 104.5,
          swingLow: 98.8,
          bars: [],
        },
      },
    });

    expect(setups.length).toBeGreaterThan(0);
    expect(setups[0].multiTFConfluence).toBeTruthy();
    expect(setups[0].multiTFConfluence?.aligned).toBe(true);
    expect(setups[0].confluenceSources).toContain('multi_tf_alignment');
    expect(setups[0].decisionDrivers?.some((driver) => driver.includes('Multi-TF aligned'))).toBe(true);
  });

  it('adds weighted confluence breakdown when weighted model is enabled', async () => {
    buildBaseMocks(101);
    mockCacheGet.mockResolvedValueOnce(null as never);
    process.env.SPX_MULTI_TF_CONFLUENCE_ENABLED = 'true';
    process.env.SPX_WEIGHTED_CONFLUENCE_ENABLED = 'true';

    const setups = await detectActiveSetups({
      forceRefresh: true,
      multiTFConfluenceOverride: {
        asOf: '2026-02-20T15:30:00.000Z',
        source: 'computed',
        tf1m: {
          timeframe: '1m',
          ema21: 101.2,
          ema55: 100.9,
          slope21: 0.06,
          latestClose: 101.4,
          trend: 'up',
          swingHigh: 101.8,
          swingLow: 100.7,
          bars: [],
        },
        tf5m: {
          timeframe: '5m',
          ema21: 101.6,
          ema55: 100.8,
          slope21: 0.08,
          latestClose: 101.9,
          trend: 'up',
          swingHigh: 102.5,
          swingLow: 100.4,
          bars: [],
        },
        tf15m: {
          timeframe: '15m',
          ema21: 101.4,
          ema55: 100.7,
          slope21: 0.05,
          latestClose: 101.6,
          trend: 'up',
          swingHigh: 103.0,
          swingLow: 99.5,
          bars: [],
        },
        tf1h: {
          timeframe: '1h',
          ema21: 102.0,
          ema55: 100.6,
          slope21: 0.11,
          latestClose: 102.2,
          trend: 'up',
          swingHigh: 104.5,
          swingLow: 98.8,
          bars: [],
        },
      },
    });

    expect(setups.length).toBeGreaterThan(0);
    expect(setups[0].confluenceBreakdown).toBeTruthy();
    expect(setups[0].confluenceBreakdown?.composite).toBeGreaterThan(0);
    expect(setups[0].confluenceBreakdown?.threshold).toBeGreaterThan(0);
    expect(setups[0].confluenceSources).toContain('weighted_confluence');
    expect(setups[0].decisionDrivers?.some((driver) => driver.includes('Weighted confluence'))).toBe(true);
  });

  it('uses adaptive EV model when enabled', async () => {
    buildBaseMocks(101);
    mockCacheGet.mockResolvedValueOnce(null as never);
    process.env.SPX_ADAPTIVE_EV_ENABLED = 'true';
    process.env.SPX_EV_SLIPPAGE_R = '0.07';

    const setups = await detectActiveSetups({
      forceRefresh: true,
      indicatorContext: {
        emaFast: 101.2,
        emaSlow: 100.8,
        emaFastSlope: 0.04,
        emaSlowSlope: 0.02,
        atr14: 1.4,
        volumeTrend: 'rising',
        sessionOpenPrice: 100.2,
        orbHigh: 102.3,
        orbLow: 99.6,
        minutesSinceOpen: 320,
        sessionOpenTimestamp: '2026-02-20T14:30:00.000Z',
        asOfTimestamp: '2026-02-20T19:40:00.000Z',
        vwapPrice: 100.9,
        vwapDeviation: 0.2,
        latestBar: null,
        priorBar: null,
        avgRecentVolume: null,
      },
    });

    expect(setups.length).toBeGreaterThan(0);
    expect(setups[0].evContext).toBeTruthy();
    expect(setups[0].evContext?.model).toBe('adaptive');
    expect(setups[0].evContext?.slippageR).toBe(0.07);
    expect(setups[0].decisionDrivers?.some((driver) => driver.includes('Adaptive EV'))).toBe(true);
  });

  it('keeps stable setup identity and records morph history when zone IDs shift', async () => {
    buildBaseMocks(101);
    mockCacheGet.mockResolvedValue(null as never);

    const initial = await detectActiveSetups({
      forceRefresh: true,
      previousSetups: [],
    });

    expect(initial.length).toBeGreaterThan(0);
    expect(initial[0].stableIdHash).toBeTruthy();

    mockGetMergedLevels.mockResolvedValue({
      levels: [],
      clusters: [
        {
          id: 'cluster-2',
          priceLow: 100.4,
          priceHigh: 102.4,
          clusterScore: 4.25,
          type: 'defended',
          sources: [],
          testCount: 2,
          lastTestAt: '2026-02-15T14:45:00.000Z',
          held: true,
          holdRate: 71,
        },
      ],
      generatedAt: '2026-02-15T14:45:00.000Z',
    });

    const shifted = await detectActiveSetups({
      forceRefresh: true,
      previousSetups: initial,
    });

    expect(shifted.length).toBeGreaterThan(0);
    expect(shifted[0].stableIdHash).toBe(initial[0].stableIdHash);
    expect(shifted[0].id).toBe(initial[0].id);
    expect((shifted[0].morphHistory || []).length).toBeGreaterThan(0);
    expect(shifted.some((setup) => setup.status === 'expired' && setup.id === initial[0].id)).toBe(false);
  });

  it('captures trigger bar context and updates trigger latency on subsequent refreshes', async () => {
    buildBaseMocks(101);
    mockCacheGet.mockResolvedValue(null as never);

    const nowMs = Date.now();
    const firstEvalIso = new Date(nowMs).toISOString();
    const secondEvalIso = new Date(nowMs + (65 * 1000)).toISOString();
    const priorBarTs = nowMs - (2 * 60 * 1000);
    const latestBarTs = nowMs - (60 * 1000);

    const indicatorContext = {
      emaFast: 101.0,
      emaSlow: 100.9,
      emaFastSlope: 0.01,
      emaSlowSlope: 0.01,
      atr14: 1.6,
      volumeTrend: 'flat' as const,
      sessionOpenPrice: 100.4,
      orbHigh: 102.4,
      orbLow: 99.9,
      minutesSinceOpen: 250,
      sessionOpenTimestamp: new Date(nowMs - (250 * 60 * 1000)).toISOString(),
      asOfTimestamp: firstEvalIso,
      vwapPrice: null,
      vwapDeviation: null,
      latestBar: {
        t: latestBarTs,
        o: 100.7,
        h: 102.5,
        l: 100.3,
        c: 102.2,
        v: 1800,
      },
      priorBar: {
        t: priorBarTs,
        o: 101.8,
        h: 102.0,
        l: 100.6,
        c: 100.9,
        v: 1200,
      },
      avgRecentVolume: 950,
    };

    const first = await detectActiveSetups({
      forceRefresh: true,
      indicatorContext,
      asOfTimestamp: firstEvalIso,
    });

    expect(first.length).toBeGreaterThan(0);
    const firstTriggered = first.find((setup) => setup.status === 'triggered') || first[0];
    expect(firstTriggered.triggerContext).toBeTruthy();
    expect(firstTriggered.triggerContext?.triggerBarPatternType).toBe('engulfing_bull');
    expect(firstTriggered.triggerContext?.triggerBarVolume).toBe(1800);

    const second = await detectActiveSetups({
      forceRefresh: true,
      previousSetups: first,
      indicatorContext: {
        ...indicatorContext,
        asOfTimestamp: secondEvalIso,
      },
      asOfTimestamp: secondEvalIso,
    });

    expect(second.length).toBeGreaterThan(0);
    const secondMatched = second.find((setup) => setup.id === firstTriggered.id) || second[0];
    expect(secondMatched.triggerContext).toBeTruthy();
    expect(secondMatched.triggerContext?.triggerBarPatternType).toBe(firstTriggered.triggerContext?.triggerBarPatternType);
    expect(secondMatched.triggerContext?.triggerBarTimestamp).toBe(firstTriggered.triggerContext?.triggerBarTimestamp);
    expect((secondMatched.triggerContext?.triggerLatencyMs || 0)).toBeGreaterThanOrEqual(firstTriggered.triggerContext?.triggerLatencyMs || 0);
  });
});
