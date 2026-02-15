import { getPredictionState } from '../aiPredictor';
import { classifyCurrentRegime } from '../regimeClassifier';
import { getMergedLevels } from '../levelEngine';
import { computeUnifiedGEXLandscape } from '../gexEngine';
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

jest.mock('../regimeClassifier', () => ({
  classifyCurrentRegime: jest.fn(),
}));

jest.mock('../levelEngine', () => ({
  getMergedLevels: jest.fn(),
}));

jest.mock('../gexEngine', () => ({
  computeUnifiedGEXLandscape: jest.fn(),
}));

const mockClassifyCurrentRegime = classifyCurrentRegime as jest.MockedFunction<typeof classifyCurrentRegime>;
const mockGetMergedLevels = getMergedLevels as jest.MockedFunction<typeof getMergedLevels>;
const mockComputeUnifiedGEXLandscape = computeUnifiedGEXLandscape as jest.MockedFunction<typeof computeUnifiedGEXLandscape>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;

describe('spx/aiPredictor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null as never);
    mockCacheSet.mockResolvedValue(undefined as never);

    mockClassifyCurrentRegime.mockResolvedValue({
      regime: 'breakout',
      direction: 'bullish',
      probability: 68,
      magnitude: 'large',
      confidence: 79,
      timestamp: '2026-02-15T14:45:00.000Z',
    });

    mockGetMergedLevels.mockResolvedValue({
      levels: [],
      clusters: [
        { id: 'up', priceLow: 6050, priceHigh: 6052, clusterScore: 4, type: 'fortress', sources: [], testCount: 0, lastTestAt: null, held: null, holdRate: null },
        { id: 'down', priceLow: 6008, priceHigh: 6010, clusterScore: 4, type: 'fortress', sources: [], testCount: 0, lastTestAt: null, held: null, holdRate: null },
      ],
      generatedAt: '2026-02-15T14:45:00.000Z',
    });

    mockComputeUnifiedGEXLandscape.mockResolvedValue({
      spx: {
        symbol: 'SPX',
        spotPrice: 6032,
        netGex: 2100,
        flipPoint: 6024,
        callWall: 6060,
        putWall: 6002,
        zeroGamma: 6024,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-15T14:45:00.000Z',
      },
      spy: {
        symbol: 'SPY',
        spotPrice: 603,
        netGex: 900,
        flipPoint: 602,
        callWall: 606,
        putWall: 600,
        zeroGamma: 602,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-15T14:45:00.000Z',
      },
      combined: {
        symbol: 'COMBINED',
        spotPrice: 6032,
        netGex: 3000,
        flipPoint: 6024,
        callWall: 6060,
        putWall: 6002,
        zeroGamma: 6024,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-15T14:45:00.000Z',
      },
    });
  });

  it('produces normalized probability outputs and target structure', async () => {
    const prediction = await getPredictionState({ forceRefresh: true });

    expect(prediction.regime).toBe('breakout');
    expect(prediction.direction.bullish + prediction.direction.bearish + prediction.direction.neutral).toBeCloseTo(100, 0);
    expect(prediction.magnitude.small + prediction.magnitude.medium + prediction.magnitude.large).toBeCloseTo(100, 0);
    expect(prediction.nextTarget.upside.price).toBeGreaterThan(prediction.nextTarget.downside.price);
    expect(prediction.probabilityCone.length).toBe(5);
    expect(mockCacheSet).toHaveBeenCalled();
  });
});
