import { detectActiveSetups } from '../setupDetector';
import { getMergedLevels } from '../levelEngine';
import { computeUnifiedGEXLandscape } from '../gexEngine';
import { getFibLevels } from '../fibEngine';
import { classifyCurrentRegime } from '../regimeClassifier';
import { getFlowEvents } from '../flowEngine';
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

const mockGetMergedLevels = getMergedLevels as jest.MockedFunction<typeof getMergedLevels>;
const mockComputeUnifiedGEXLandscape = computeUnifiedGEXLandscape as jest.MockedFunction<typeof computeUnifiedGEXLandscape>;
const mockGetFibLevels = getFibLevels as jest.MockedFunction<typeof getFibLevels>;
const mockClassifyCurrentRegime = classifyCurrentRegime as jest.MockedFunction<typeof classifyCurrentRegime>;
const mockGetFlowEvents = getFlowEvents as jest.MockedFunction<typeof getFlowEvents>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;

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
  });

  it('marks previously triggered setups as invalidated when stop is breached', async () => {
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
    };

    buildBaseMocks(97);
    mockCacheGet.mockResolvedValueOnce([previousTriggered] as never);

    const next = await detectActiveSetups({ forceRefresh: true });
    const sameSetup = next.find((setup) => setup.id === previousTriggered.id);

    expect(sameSetup).toBeTruthy();
    expect(sameSetup?.status).toBe('invalidated');
    expect(sameSetup?.triggeredAt).toBe(previousTriggered.triggeredAt);
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
  });
});
