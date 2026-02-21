import { __resetSetupDetectorStateForTests, detectActiveSetups } from '../setupDetector';
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
});
