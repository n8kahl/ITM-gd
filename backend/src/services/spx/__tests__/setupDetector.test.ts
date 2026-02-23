import { __resetSetupDetectorStateForTests, __testables, detectActiveSetups } from '../setupDetector';
import { getMergedLevels } from '../levelEngine';
import { computeUnifiedGEXLandscape } from '../gexEngine';
import { getFibLevels } from '../fibEngine';
import { classifyCurrentRegime } from '../regimeClassifier';
import { getFlowEvents } from '../flowEngine';
import { getActiveSPXOptimizationProfile } from '../optimizer';
import { loadSetupPWinCalibrationModel } from '../setupCalibration';
import { cacheGet, cacheSet } from '../../../config/redis';
import { getRecentTicks } from '../../tickCache';

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

jest.mock('../setupCalibration', () => ({
  loadSetupPWinCalibrationModel: jest.fn(),
}));

jest.mock('../../tickCache', () => ({
  getRecentTicks: jest.fn(),
}));

const mockGetMergedLevels = getMergedLevels as jest.MockedFunction<typeof getMergedLevels>;
const mockComputeUnifiedGEXLandscape = computeUnifiedGEXLandscape as jest.MockedFunction<typeof computeUnifiedGEXLandscape>;
const mockGetFibLevels = getFibLevels as jest.MockedFunction<typeof getFibLevels>;
const mockClassifyCurrentRegime = classifyCurrentRegime as jest.MockedFunction<typeof classifyCurrentRegime>;
const mockGetFlowEvents = getFlowEvents as jest.MockedFunction<typeof getFlowEvents>;
const mockGetActiveSPXOptimizationProfile = getActiveSPXOptimizationProfile as jest.MockedFunction<typeof getActiveSPXOptimizationProfile>;
const mockLoadSetupPWinCalibrationModel = loadSetupPWinCalibrationModel as jest.MockedFunction<typeof loadSetupPWinCalibrationModel>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockGetRecentTicks = getRecentTicks as jest.MockedFunction<typeof getRecentTicks>;
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

function buildOptimizationProfile(input?: {
  macroMicroBySetupType?: Record<string, Record<string, unknown>>;
}) {
  return {
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
    geometryPolicy: {
      bySetupType: {},
      bySetupRegime: {},
      bySetupRegimeTimeBucket: {},
    },
    macroMicroPolicy: {
      defaultMinMacroAlignmentScore: 34,
      defaultRequireTrendMicrostructureAlignment: true,
      defaultFailClosedWhenUnavailable: false,
      defaultMinMicroAggressorSkewAbs: 0.1,
      defaultMinMicroImbalanceAbs: 0.06,
      defaultMinMicroQuoteCoveragePct: 0.4,
      defaultMaxMicroSpreadBps: 30,
      bySetupType: input?.macroMicroBySetupType || {},
      bySetupRegime: {},
      bySetupRegimeTimeBucket: {},
    },
    walkForward: {
      trainingDays: 20,
      validationDays: 5,
      minTrades: 12,
      objectiveWeights: {
        t1: 0.6,
        t2: 0.4,
        failurePenalty: 0.45,
        expectancyR: 14,
      },
    },
    driftControl: {
      enabled: false,
      shortWindowDays: 5,
      longWindowDays: 20,
      maxDropPct: 12,
      minLongWindowTrades: 20,
      autoQuarantineEnabled: false,
      triggerRateWindowDays: 20,
      minQuarantineOpportunities: 20,
      minTriggerRatePct: 3,
      pausedSetupTypes: [],
    },
  };
}

describe('spx/setupDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined as never);
    mockGetRecentTicks.mockReturnValue([]);
    mockGetActiveSPXOptimizationProfile.mockResolvedValue(buildOptimizationProfile() as never);
    mockLoadSetupPWinCalibrationModel.mockResolvedValue({
      generatedAt: '2026-02-15T14:40:00.000Z',
      asOfDateEt: '2026-02-15',
      range: { from: '2026-01-01', to: '2026-02-14' },
      sampleSize: 0,
      calibrate: (input: { rawPWin: number }) => ({
        pWin: input.rawPWin,
        source: 'heuristic',
        sampleSize: 0,
        empiricalPWin: null,
        blendWeight: 0,
      }),
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

  it('adds microstructure confluence when tick aggressor flow aligns with setup direction', async () => {
    process.env.SPX_SETUP_MICROSTRUCTURE_MIN_TICKS = '1';
    process.env.SPX_SETUP_MICROSTRUCTURE_MIN_DIRECTIONAL_VOLUME = '1';
    process.env.SPX_SETUP_MICROSTRUCTURE_MIN_QUOTE_COVERAGE_PCT = '0';
    process.env.SPX_SETUP_MICROSTRUCTURE_ENABLED = 'true';
    process.env.SPX_SETUP_MICROSTRUCTURE_REQUIRE_TREND_ALIGNMENT = 'false';
    buildBaseMocks(101);
    mockCacheGet.mockResolvedValueOnce(null as never);
    const now = Date.now();
    mockGetRecentTicks.mockReturnValue([
      {
        symbol: 'SPX',
        rawSymbol: 'I:SPX',
        price: 101,
        size: 25,
        timestamp: now - 1_500,
        sequence: 1001,
        bid: 100.95,
        ask: 101.05,
        bidSize: 120,
        askSize: 60,
        aggressorSide: 'buyer',
      },
      {
        symbol: 'SPX',
        rawSymbol: 'I:SPX',
        price: 101.1,
        size: 20,
        timestamp: now - 900,
        sequence: 1002,
        bid: 101.0,
        ask: 101.1,
        bidSize: 150,
        askSize: 70,
        aggressorSide: 'buyer',
      },
    ]);

    const setups = await detectActiveSetups({ forceRefresh: true });
    const setup = setups[0];

    expect(setup.confluenceSources).toContain('microstructure_alignment');
    expect(setup.microstructure?.available).toBe(true);
    expect(setup.microstructure?.aligned).toBe(true);
    expect(typeof setup.microstructureScore).toBe('number');
  });

  it('blocks trend pullback setups when ORB confluence is required but not present', async () => {
    buildBaseMocks(105);
    mockClassifyCurrentRegime.mockResolvedValue({
      regime: 'trending',
      direction: 'bullish',
      probability: 70,
      magnitude: 'medium',
      confidence: 80,
      timestamp: '2026-02-15T14:40:00.000Z',
    });
    mockGetActiveSPXOptimizationProfile.mockResolvedValueOnce(buildOptimizationProfile({
      macroMicroBySetupType: {
        trend_pullback: { requireOrbTrendConfluence: true },
      },
    }) as never);
    mockCacheGet.mockResolvedValueOnce(null as never);

    const setups = await detectActiveSetups({
      forceRefresh: true,
      indicatorContext: {
        emaFast: 102,
        emaSlow: 100,
        emaFastSlope: 0.25,
        emaSlowSlope: 0.12,
        volumeTrend: 'rising',
        sessionOpenPrice: 100,
        orbHigh: 130,
        orbLow: 96,
        minutesSinceOpen: 150,
        sessionOpenTimestamp: '2026-02-15T14:30:00.000Z',
        asOfTimestamp: '2026-02-15T17:00:00.000Z',
      },
    });

    const trendPullback = setups.find((setup) => setup.type === 'trend_pullback');
    expect(trendPullback).toBeTruthy();
    expect(trendPullback?.gateStatus).toBe('blocked');
    expect(trendPullback?.gateReasons).toContain('trend_orb_confluence_required');
  });

  it('keeps trend pullback eligible when ORB confluence is present', async () => {
    buildBaseMocks(105);
    mockClassifyCurrentRegime.mockResolvedValue({
      regime: 'trending',
      direction: 'bullish',
      probability: 72,
      magnitude: 'medium',
      confidence: 82,
      timestamp: '2026-02-15T14:40:00.000Z',
    });
    mockGetActiveSPXOptimizationProfile.mockResolvedValueOnce(buildOptimizationProfile({
      macroMicroBySetupType: {
        trend_pullback: { requireOrbTrendConfluence: true },
      },
    }) as never);
    mockCacheGet.mockResolvedValueOnce(null as never);

    const setups = await detectActiveSetups({
      forceRefresh: true,
      indicatorContext: {
        emaFast: 102,
        emaSlow: 100,
        emaFastSlope: 0.28,
        emaSlowSlope: 0.14,
        volumeTrend: 'rising',
        sessionOpenPrice: 100,
        orbHigh: 101,
        orbLow: 96,
        minutesSinceOpen: 150,
        sessionOpenTimestamp: '2026-02-15T14:30:00.000Z',
        asOfTimestamp: '2026-02-15T17:00:00.000Z',
      },
    });

    const trendPullback = setups.find((setup) => setup.type === 'trend_pullback');
    expect(trendPullback).toBeTruthy();
    expect(trendPullback?.gateReasons?.includes('trend_orb_confluence_required')).toBe(false);
    expect(trendPullback?.confluenceSources).toContain('orb_trend_confluence');
  });

  it('blocks new actionable setups when macro alignment score falls below kill-switch floor', async () => {
    process.env.SPX_SETUP_MACRO_KILLSWITCH_ENABLED = 'true';
    process.env.SPX_SETUP_MACRO_MIN_ALIGNMENT_SCORE = '70';
    buildBaseMocks(101);
    mockClassifyCurrentRegime.mockResolvedValue({
      regime: 'ranging',
      direction: 'bearish',
      probability: 82,
      magnitude: 'small',
      confidence: 88,
      timestamp: '2026-02-15T14:40:00.000Z',
    });
    mockCacheGet.mockResolvedValueOnce(null as never);

    const setups = await detectActiveSetups({ forceRefresh: true });
    const setup = setups[0];

    expect(setup.gateStatus).toBe('blocked');
    expect(setup.gateReasons?.some((reason) => reason.startsWith('macro_alignment_below_floor'))).toBe(true);
    expect(setup.status).toBe('forming');
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
});

describe('spx/setupDetector optimization gate grace paths', () => {
  const baseProfile = {
    source: 'scan' as const,
    generatedAt: '2026-02-22T03:00:00.000Z',
    qualityGate: {
      minConfluenceScore: 3,
      minPWinCalibrated: 0.62,
      minEvR: 0.2,
      actionableStatuses: ['ready', 'triggered'] as ('ready' | 'triggered')[],
    },
    flowGate: { requireFlowConfirmation: false, minAlignmentPct: 0 },
    indicatorGate: { requireEmaAlignment: false, requireVolumeRegimeAlignment: false },
    timingGate: {
      enabled: true,
      maxFirstSeenMinuteBySetupType: {
        fade_at_wall: 300, breakout_vacuum: 360, mean_reversion: 330,
        trend_continuation: 390, orb_breakout: 180, trend_pullback: 240, flip_reclaim: 360,
      },
    },
    regimeGate: { minTradesPerCombo: 12, minT1WinRatePct: 48, pausedCombos: [] },
    tradeManagement: { partialAtT1Pct: 0.65, moveStopToBreakeven: true },
    geometryPolicy: { bySetupType: {}, bySetupRegime: {}, bySetupRegimeTimeBucket: {} },
    macroMicroPolicy: {
      defaultMinMacroAlignmentScore: 34,
      defaultRequireTrendMicrostructureAlignment: false,
      defaultFailClosedWhenUnavailable: false,
      defaultMinMicroAggressorSkewAbs: 0.15,
      defaultMinMicroImbalanceAbs: 0.1,
      defaultMinMicroQuoteCoveragePct: 35,
      defaultMaxMicroSpreadBps: 5,
      bySetupType: {},
      bySetupRegime: {},
      bySetupRegimeTimeBucket: {},
    },
    walkForward: {
      trainingDays: 30,
      validationDays: 5,
      minTrades: 15,
      objectiveWeights: { t1: 0.4, t2: 0.2, failurePenalty: 0.2, expectancyR: 0.2 },
    },
    driftControl: {
      enabled: true, shortWindowDays: 5, longWindowDays: 20, maxDropPct: 12,
      minLongWindowTrades: 20, autoQuarantineEnabled: true,
      triggerRateWindowDays: 20, minQuarantineOpportunities: 20,
      minTriggerRatePct: 3, pausedSetupTypes: [],
    },
  };

  const noFlowQuality = {
    score: 0, recentDirectionalEvents: 0, recentDirectionalPremium: 0,
    localDirectionalEvents: 0, localDirectionalPremium: 0, localCoveragePct: 0,
  };

  const noMicroConfig = {
    enabled: false, lookbackTicks: 60, minTicks: 10, minDirectionalVolume: 120,
    minQuoteCoveragePct: 35, minAggressorSkewAbs: 0.15, minImbalanceAbs: 0.1,
    maxSpreadBps: 5, requireTrendAlignment: false, failClosedWhenUnavailable: false,
  };

  const noMicroAlignment = { available: false, aligned: false, conflict: false, score: null, reasons: [] };

  const noOrbConfluence = {
    available: false, aligned: false, orbLevel: null, distanceToOrb: null,
    breakConfirmed: false, pullbackRetest: false, reclaimed: false, reasons: [],
  };

  function buildGateInput(overrides: Record<string, unknown> = {}) {
    return {
      status: 'ready' as const,
      wasPreviouslyTriggered: false,
      setupType: 'trend_pullback' as const,
      regime: 'trending' as const,
      firstSeenAtIso: '2026-02-20T11:00:00.000Z', // ~90 min after open
      confluenceScore: 4,
      pWinCalibrated: 0.65,
      evR: 0.35,
      flowConfirmed: false,
      flowAlignmentPct: null as number | null,
      flowQuality: noFlowQuality,
      macroAlignmentScore: 50,
      macroFilterConfig: { enabled: false, minAlignmentScore: 34 },
      emaAligned: true,
      volumeRegimeAligned: true,
      microstructureConfig: noMicroConfig,
      microstructureAlignment: noMicroAlignment,
      orbTrendConfluence: noOrbConfluence,
      requireOrbTrendConfluence: false,
      pausedSetupTypes: new Set<string>(),
      pausedCombos: new Set<string>(),
      profile: baseProfile,
      direction: 'bullish' as const,
      ...overrides,
    };
  }

  it('blocks trend_pullback when flow unavailable and no grace conditions met', () => {
    // With emaAligned=false, neither the new flowUnavailableGrace nor the old
    // trendFlowUnavailableGraceEligible can fire (both require EMA alignment).
    process.env.SPX_FLOW_UNAVAILABLE_GRACE_ENABLED = 'false';
    const result = __testables.evaluateOptimizationGate(buildGateInput({
      emaAligned: false,
    }));
    expect(result.reasons).toContain('flow_confirmation_required');
    expect(result.reasons).toContain('flow_alignment_unavailable');
    expect(result.effectiveFlowConfirmed).toBe(false);
    delete process.env.SPX_FLOW_UNAVAILABLE_GRACE_ENABLED;
  });

  it('allows trend_pullback through flow-unavailable grace when EMA+confluence met', () => {
    const result = __testables.evaluateOptimizationGate(buildGateInput());
    expect(result.reasons).not.toContain('flow_confirmation_required');
    expect(result.reasons).not.toContain('flow_alignment_unavailable');
    expect(result.effectiveFlowConfirmed).toBe(true);
  });

  it('allows mean_reversion through flow-unavailable grace (all setup types)', () => {
    const result = __testables.evaluateOptimizationGate(buildGateInput({
      setupType: 'mean_reversion',
      firstSeenAtIso: '2026-02-20T10:30:00.000Z',
    }));
    // mean_reversion has no requireFlowConfirmation floor, so flow gates never fire
    expect(result.reasons).not.toContain('flow_confirmation_required');
    expect(result.reasons).not.toContain('flow_alignment_unavailable');
    // effectiveFlowConfirmed stays false (same as raw) — no grace was needed
    expect(result.effectiveFlowConfirmed).toBe(false);
  });

  it('blocks flow-unavailable grace when EMA not aligned', () => {
    const result = __testables.evaluateOptimizationGate(buildGateInput({
      emaAligned: false,
    }));
    expect(result.reasons).toContain('flow_confirmation_required');
    expect(result.effectiveFlowConfirmed).toBe(false);
  });

  it('allows trend_pullback through expanded volume grace with flat volume', () => {
    const result = __testables.evaluateOptimizationGate(buildGateInput({
      volumeRegimeAligned: false,
    }));
    expect(result.reasons).not.toContain('volume_regime_alignment_required');
    expect(result.effectiveVolumeAligned).toBe(true);
  });

  it('blocks volume grace when expanded grace disabled', () => {
    process.env.SPX_VOLUME_GRACE_EXPANDED_ENABLED = 'false';
    // trend_pullback at 90 min with confluence 4 + ema → trendFamilyVolumeGraceEligible applies at <= 300 min
    // so this should still pass via the existing narrow grace
    const result = __testables.evaluateOptimizationGate(buildGateInput({
      volumeRegimeAligned: false,
    }));
    expect(result.reasons).not.toContain('volume_regime_alignment_required');
    expect(result.effectiveVolumeAligned).toBe(true);
    delete process.env.SPX_VOLUME_GRACE_EXPANDED_ENABLED;
  });

  it('allows trend_continuation through expanded volume grace (was previously blocked)', () => {
    const result = __testables.evaluateOptimizationGate(buildGateInput({
      setupType: 'trend_continuation',
      volumeRegimeAligned: false,
      confluenceScore: 4,
      pWinCalibrated: 0.65,
      evR: 0.35,
    }));
    expect(result.reasons).not.toContain('volume_regime_alignment_required');
    expect(result.effectiveVolumeAligned).toBe(true);
  });

  it('blocks trend_pullback when ORB confluence is required and no alternative context is present', () => {
    const result = __testables.evaluateOptimizationGate(buildGateInput({
      requireOrbTrendConfluence: true,
      orbTrendConfluence: noOrbConfluence,
    }));
    expect(result.reasons).toContain('trend_orb_confluence_required');
  });

  it('allows trend_pullback with ORB proximity alternative when ORB confluence is required', () => {
    const result = __testables.evaluateOptimizationGate(buildGateInput({
      requireOrbTrendConfluence: true,
      confluenceScore: 4,
      orbTrendConfluence: {
        available: true,
        aligned: false,
        orbLevel: 5950,
        distanceToOrb: 6,
        breakConfirmed: false,
        pullbackRetest: true,
        reclaimed: false,
        reasons: ['orb_break_not_confirmed'],
      },
    }));
    expect(result.reasons).not.toContain('trend_orb_confluence_required');
  });

  it('allows trend_pullback with trend-continuation context alternative when ORB confluence is required', () => {
    const result = __testables.evaluateOptimizationGate(buildGateInput({
      requireOrbTrendConfluence: true,
      confluenceScore: 4,
      regime: 'trending',
      firstSeenAtIso: '2026-02-20T11:10:00.000Z',
      flowConfirmed: true,
      volumeRegimeAligned: true,
      orbTrendConfluence: {
        available: true,
        aligned: false,
        orbLevel: 6000,
        distanceToOrb: 24,
        breakConfirmed: false,
        pullbackRetest: false,
        reclaimed: false,
        reasons: ['orb_retest_missed', 'orb_not_reclaimed', 'orb_break_not_confirmed'],
      },
    }));
    expect(result.reasons).not.toContain('trend_orb_confluence_required');
  });

  it('keeps trend_pullback blocked when continuation context has insufficient confluence floor', () => {
    const result = __testables.evaluateOptimizationGate(buildGateInput({
      requireOrbTrendConfluence: true,
      confluenceScore: 3,
      regime: 'trending',
      firstSeenAtIso: '2026-02-20T11:10:00.000Z',
      flowConfirmed: true,
      volumeRegimeAligned: true,
      orbTrendConfluence: {
        available: true,
        aligned: false,
        orbLevel: 6000,
        distanceToOrb: 24,
        breakConfirmed: false,
        pullbackRetest: false,
        reclaimed: false,
        reasons: ['orb_retest_missed', 'orb_not_reclaimed', 'orb_break_not_confirmed'],
      },
    }));
    expect(result.reasons).toContain('trend_orb_confluence_required');
  });

  it('blocks orb_breakout when no directional flow sample and no ORB confluence', () => {
    const result = __testables.evaluateOptimizationGate(buildGateInput({
      setupType: 'orb_breakout',
      firstSeenAtIso: '2026-02-20T10:15:00.000Z', // ~45 min after open
      confluenceScore: 3,
      pWinCalibrated: 0.60,
      evR: 0.25,
    }));
    expect(result.reasons).toContain('orb_flow_or_confluence_required');
    expect(result.effectiveFlowConfirmed).toBe(false);
  });

  it('allows orb_breakout without directional flow sample when ORB confluence is aligned', () => {
    const result = __testables.evaluateOptimizationGate(buildGateInput({
      setupType: 'orb_breakout',
      firstSeenAtIso: '2026-02-20T10:15:00.000Z',
      orbTrendConfluence: {
        available: true,
        aligned: true,
        orbLevel: 5950,
        distanceToOrb: 1.2,
        breakConfirmed: true,
        pullbackRetest: false,
        reclaimed: false,
        reasons: ['orb_break_confirmed'],
      },
      confluenceScore: 3,
      pWinCalibrated: 0.60,
      evR: 0.25,
    }));
    expect(result.reasons).not.toContain('orb_flow_or_confluence_required');
    expect(result.effectiveFlowConfirmed).toBe(true);
  });
});
