import type { Setup, SPXSnapshot } from '../types';

const mockGetPredictionState = jest.fn();
const mockGetCoachState = jest.fn();
const mockGetContractRecommendation = jest.fn();
const mockGetBasisState = jest.fn();
const mockGetSpyImpactState = jest.fn();
const mockGetFibLevels = jest.fn();
const mockGetFlowEvents = jest.fn();
const mockGetFlowWindowAggregation = jest.fn();
const mockCreateNeutralFlowWindowAggregation = jest.fn();
const mockComputeUnifiedGEXLandscape = jest.fn();
const mockGetMergedLevels = jest.fn();
const mockGetMultiTFConfluenceContext = jest.fn();
const mockDetectActiveSetups = jest.fn();
const mockGetLatestSetupEnvironmentState = jest.fn();
const mockApplyTickStateToSetups = jest.fn();
const mockEvaluateTickSetupTransitions = jest.fn();
const mockSyncTickEvaluatorSetups = jest.fn();
const mockPersistTickEvaluatorState = jest.fn();
const mockGetLatestTick = jest.fn();
const mockIsTickStreamHealthy = jest.fn();
const mockReplaySnapshotCapture = jest.fn();
const mockNowIso = jest.fn();

const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerDebug = jest.fn();

jest.mock('../aiPredictor', () => ({
  getPredictionState: (...args: unknown[]) => mockGetPredictionState(...args),
}));

jest.mock('../aiCoach', () => ({
  getCoachState: (...args: unknown[]) => mockGetCoachState(...args),
}));

jest.mock('../contractSelector', () => ({
  getContractRecommendation: (...args: unknown[]) => mockGetContractRecommendation(...args),
}));

jest.mock('../crossReference', () => ({
  getBasisState: (...args: unknown[]) => mockGetBasisState(...args),
  getSpyImpactState: (...args: unknown[]) => mockGetSpyImpactState(...args),
}));

jest.mock('../fibEngine', () => ({
  getFibLevels: (...args: unknown[]) => mockGetFibLevels(...args),
}));

jest.mock('../flowEngine', () => ({
  getFlowEvents: (...args: unknown[]) => mockGetFlowEvents(...args),
}));

jest.mock('../flowAggregator', () => ({
  getFlowWindowAggregation: (...args: unknown[]) => mockGetFlowWindowAggregation(...args),
  createNeutralFlowWindowAggregation: (...args: unknown[]) => mockCreateNeutralFlowWindowAggregation(...args),
}));

jest.mock('../gexEngine', () => ({
  computeUnifiedGEXLandscape: (...args: unknown[]) => mockComputeUnifiedGEXLandscape(...args),
}));

jest.mock('../levelEngine', () => ({
  getMergedLevels: (...args: unknown[]) => mockGetMergedLevels(...args),
}));

jest.mock('../multiTFConfluence', () => ({
  getMultiTFConfluenceContext: (...args: unknown[]) => mockGetMultiTFConfluenceContext(...args),
}));

jest.mock('../setupDetector', () => ({
  detectActiveSetups: (...args: unknown[]) => mockDetectActiveSetups(...args),
  getLatestSetupEnvironmentState: (...args: unknown[]) => mockGetLatestSetupEnvironmentState(...args),
}));

jest.mock('../tickEvaluator', () => ({
  applyTickStateToSetups: (...args: unknown[]) => mockApplyTickStateToSetups(...args),
  evaluateTickSetupTransitions: (...args: unknown[]) => mockEvaluateTickSetupTransitions(...args),
  syncTickEvaluatorSetups: (...args: unknown[]) => mockSyncTickEvaluatorSetups(...args),
  persistTickEvaluatorState: (...args: unknown[]) => mockPersistTickEvaluatorState(...args),
}));

jest.mock('../../tickCache', () => ({
  getLatestTick: (...args: unknown[]) => mockGetLatestTick(...args),
  isTickStreamHealthy: (...args: unknown[]) => mockIsTickStreamHealthy(...args),
}));

jest.mock('../replaySnapshotWriter', () => ({
  replaySnapshotWriter: {
    capture: (...args: unknown[]) => mockReplaySnapshotCapture(...args),
  },
}));

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    debug: (...args: unknown[]) => mockLoggerDebug(...args),
  },
}));

jest.mock('../utils', () => ({
  nowIso: (...args: unknown[]) => mockNowIso(...args),
}));

function buildSetup(status: Setup['status']): Setup {
  return {
    id: 'setup-1',
    type: 'trend_pullback',
    direction: 'bullish',
    entryZone: { low: 5998, high: 6000 },
    stop: 5994,
    target1: { price: 6010, label: 'T1' },
    target2: { price: 6016, label: 'T2' },
    confluenceScore: 4,
    confluenceSources: ['flow'],
    clusterZone: {
      id: 'cluster-1',
      priceLow: 5996,
      priceHigh: 6001,
      clusterScore: 3.8,
      type: 'defended',
      sources: [],
      testCount: 4,
      lastTestAt: '2026-03-01T14:40:00.000Z',
      held: true,
      holdRate: 67,
    },
    regime: 'trending',
    status,
    probability: 62,
    recommendedContract: null,
    createdAt: '2026-03-01T14:30:00.000Z',
    triggeredAt: null,
  };
}

function applyDefaultMocks(): void {
  mockNowIso.mockReturnValue('2026-03-01T15:00:00.000Z');
  mockComputeUnifiedGEXLandscape.mockResolvedValue({
    spx: {
      symbol: 'SPX',
      spotPrice: 6000,
      netGex: 100000,
      flipPoint: 5980,
      callWall: 6030,
      putWall: 5950,
      zeroGamma: 5980,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-03-01T15:00:00.000Z',
    },
    spy: {
      symbol: 'SPY',
      spotPrice: 600,
      netGex: 10000,
      flipPoint: 598,
      callWall: 603,
      putWall: 595,
      zeroGamma: 598,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-03-01T15:00:00.000Z',
    },
    combined: {
      symbol: 'COMBINED',
      spotPrice: 6000,
      netGex: 110000,
      flipPoint: 5981,
      callWall: 6031,
      putWall: 5949,
      zeroGamma: 5981,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-03-01T15:00:00.000Z',
    },
  });
  mockGetFlowEvents.mockResolvedValue([]);
  mockGetFlowWindowAggregation.mockResolvedValue({
    generatedAt: '2026-03-01T15:00:00.000Z',
    source: 'computed',
    directionalBias: 'neutral',
    primaryWindow: '30m',
    latestEventAt: null,
    windows: {
      '5m': {
        window: '5m',
        startAt: '2026-03-01T14:55:00.000Z',
        endAt: '2026-03-01T15:00:00.000Z',
        eventCount: 0,
        sweepCount: 0,
        blockCount: 0,
        bullishPremium: 0,
        bearishPremium: 0,
        totalPremium: 0,
        flowScore: 0,
        bias: 'neutral',
      },
      '15m': {
        window: '15m',
        startAt: '2026-03-01T14:45:00.000Z',
        endAt: '2026-03-01T15:00:00.000Z',
        eventCount: 0,
        sweepCount: 0,
        blockCount: 0,
        bullishPremium: 0,
        bearishPremium: 0,
        totalPremium: 0,
        flowScore: 0,
        bias: 'neutral',
      },
      '30m': {
        window: '30m',
        startAt: '2026-03-01T14:30:00.000Z',
        endAt: '2026-03-01T15:00:00.000Z',
        eventCount: 0,
        sweepCount: 0,
        blockCount: 0,
        bullishPremium: 0,
        bearishPremium: 0,
        totalPremium: 0,
        flowScore: 0,
        bias: 'neutral',
      },
    },
  });
  mockCreateNeutralFlowWindowAggregation.mockReturnValue({
    generatedAt: '2026-03-01T15:00:00.000Z',
    source: 'fallback',
    directionalBias: 'neutral',
    primaryWindow: '30m',
    latestEventAt: null,
    windows: {
      '5m': { window: '5m', startAt: '', endAt: '', eventCount: 0, sweepCount: 0, blockCount: 0, bullishPremium: 0, bearishPremium: 0, totalPremium: 0, flowScore: 0, bias: 'neutral' },
      '15m': { window: '15m', startAt: '', endAt: '', eventCount: 0, sweepCount: 0, blockCount: 0, bullishPremium: 0, bearishPremium: 0, totalPremium: 0, flowScore: 0, bias: 'neutral' },
      '30m': { window: '30m', startAt: '', endAt: '', eventCount: 0, sweepCount: 0, blockCount: 0, bullishPremium: 0, bearishPremium: 0, totalPremium: 0, flowScore: 0, bias: 'neutral' },
    },
  });
  mockGetBasisState.mockResolvedValue({
    current: 0.5,
    trend: 'stable',
    leading: 'neutral',
    ema5: 0.4,
    ema20: 0.3,
    zscore: 0.1,
    spxPrice: 6000,
    spyPrice: 600,
    timestamp: '2026-03-01T15:00:00.000Z',
  });
  mockGetSpyImpactState.mockResolvedValue({
    beta: 10,
    correlation: 0.8,
    basisUsed: 0.5,
    spot: { spx: 6000, spy: 600 },
    levels: [],
    timestamp: '2026-03-01T15:00:00.000Z',
  });
  mockGetFibLevels.mockResolvedValue([]);
  mockGetMergedLevels.mockResolvedValue({
    levels: [],
    clusters: [],
    generatedAt: '2026-03-01T15:00:00.000Z',
  });
  mockGetMultiTFConfluenceContext.mockResolvedValue({
    asOf: '2026-03-01T15:00:00.000Z',
    source: 'computed',
    tf1m: { timeframe: '1m', ema21: 1, emaReliable: true, ema55: 1, slope21: 0, latestClose: 1, trend: 'flat', swingHigh: 1, swingLow: 1, bars: [] },
    tf5m: { timeframe: '5m', ema21: 1, emaReliable: true, ema55: 1, slope21: 0, latestClose: 1, trend: 'up', swingHigh: 1, swingLow: 1, bars: [] },
    tf15m: { timeframe: '15m', ema21: 1, emaReliable: true, ema55: 1, slope21: 0, latestClose: 1, trend: 'up', swingHigh: 1, swingLow: 1, bars: [] },
    tf1h: { timeframe: '1h', ema21: 1, emaReliable: true, ema55: 1, slope21: 0, latestClose: 1, trend: 'up', swingHigh: 1, swingLow: 1, bars: [] },
  });
  mockDetectActiveSetups.mockResolvedValue([buildSetup('forming')]);
  mockApplyTickStateToSetups.mockImplementation((setups: Setup[]) => setups);
  mockGetPredictionState.mockResolvedValue({
    regime: 'trending',
    direction: { bullish: 50, bearish: 20, neutral: 30 },
    magnitude: { small: 50, medium: 40, large: 10 },
    timingWindow: { description: 'now', actionable: true },
    nextTarget: {
      upside: { price: 6010, zone: 'r1' },
      downside: { price: 5990, zone: 's1' },
    },
    probabilityCone: [],
    confidence: 60,
  });
  mockGetCoachState.mockResolvedValue({
    messages: [],
    generatedAt: '2026-03-01T15:00:00.000Z',
  });
  mockGetLatestSetupEnvironmentState.mockResolvedValue({
    gate: null,
    standbyGuidance: null,
  });
  mockGetContractRecommendation.mockResolvedValue(null);
  mockGetLatestTick.mockReturnValue(null);
  mockIsTickStreamHealthy.mockReturnValue({
    healthy: true,
    reason: null,
    ageMs: 0,
  });
  mockEvaluateTickSetupTransitions.mockReturnValue([]);
  mockPersistTickEvaluatorState.mockResolvedValue(undefined);
  mockSyncTickEvaluatorSetups.mockImplementation(() => undefined);
  mockReplaySnapshotCapture.mockResolvedValue(undefined);
}

async function loadSnapshotService(): Promise<{ getSPXSnapshot: (options?: { forceRefresh?: boolean }) => Promise<SPXSnapshot> }> {
  return import('../index') as Promise<{ getSPXSnapshot: (options?: { forceRefresh?: boolean }) => Promise<SPXSnapshot> }>;
}

describe('spx/index replay snapshot integration', () => {
  const originalMultiTFEnv = process.env.SPX_MULTI_TF_CONFLUENCE_ENABLED;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.SPX_MULTI_TF_CONFLUENCE_ENABLED = 'true';
    applyDefaultMocks();
  });

  afterAll(() => {
    if (originalMultiTFEnv == null) {
      delete process.env.SPX_MULTI_TF_CONFLUENCE_ENABLED;
      return;
    }
    process.env.SPX_MULTI_TF_CONFLUENCE_ENABLED = originalMultiTFEnv;
  });

  it('invokes interval capture on successful snapshot build', async () => {
    const { getSPXSnapshot } = await loadSnapshotService();

    const snapshot = await getSPXSnapshot({ forceRefresh: true });

    expect(snapshot.dataQuality).toEqual(expect.objectContaining({
      degraded: expect.any(Boolean),
      degradedReasons: expect.any(Array),
      stages: expect.objectContaining({
        gex: expect.objectContaining({ ok: true }),
        flow: expect.objectContaining({ ok: true }),
        levels: expect.objectContaining({ ok: true }),
      }),
    }));
    expect(snapshot.levelsDataQuality).toEqual(expect.objectContaining({
      integrity: expect.stringMatching(/^(full|degraded)$/),
      warnings: expect.any(Array),
    }));

    expect(mockReplaySnapshotCapture).toHaveBeenCalledWith(expect.objectContaining({
      captureMode: 'interval',
      snapshot: expect.objectContaining({
        generatedAt: '2026-03-01T15:00:00.000Z',
      }),
      multiTFContext: expect.objectContaining({
        tf1h: expect.objectContaining({ trend: 'up' }),
      }),
    }));
  });

  it('invokes setup_transition capture when setup status transitions by id', async () => {
    mockDetectActiveSetups
      .mockResolvedValueOnce([buildSetup('forming')])
      .mockResolvedValueOnce([buildSetup('ready')]);

    const { getSPXSnapshot } = await loadSnapshotService();

    await getSPXSnapshot({ forceRefresh: true });
    await getSPXSnapshot({ forceRefresh: true });

    const captureModes = mockReplaySnapshotCapture.mock.calls.map((call) => call[0]?.captureMode);
    const intervalCount = captureModes.filter((mode) => mode === 'interval').length;
    const transitionCount = captureModes.filter((mode) => mode === 'setup_transition').length;

    expect(intervalCount).toBe(2);
    expect(transitionCount).toBe(1);
  });

  it('does not throw or block snapshot build when replay writer capture rejects', async () => {
    mockReplaySnapshotCapture.mockRejectedValue(new Error('replay writer unavailable'));

    const { getSPXSnapshot } = await loadSnapshotService();

    await expect(getSPXSnapshot({ forceRefresh: true })).resolves.toEqual(expect.objectContaining({
      generatedAt: '2026-03-01T15:00:00.000Z',
    }));

    await Promise.resolve();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });

  it('marks snapshot data quality degraded when a stage falls back', async () => {
    mockGetFlowEvents.mockRejectedValueOnce(new Error('flow backend timeout'));

    const { getSPXSnapshot } = await loadSnapshotService();
    const snapshot = await getSPXSnapshot({ forceRefresh: true });

    expect(snapshot.dataQuality?.degraded).toBe(true);
    expect(snapshot.dataQuality?.degradedReasons).toContain('flow:flow backend timeout');
    expect(snapshot.dataQuality?.stages?.flow).toEqual(expect.objectContaining({
      ok: false,
      source: 'fallback',
      degradedReason: 'flow backend timeout',
    }));
    expect(snapshot.levelsDataQuality).toEqual(expect.objectContaining({
      integrity: 'degraded',
    }));
  });
});
