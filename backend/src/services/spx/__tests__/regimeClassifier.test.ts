import { classifyCurrentRegime } from '../regimeClassifier';

jest.mock('../../../config/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../config/massive', () => ({
  getMinuteAggregates: jest.fn().mockResolvedValue([]),
}));

jest.mock('../gexEngine', () => ({
  computeUnifiedGEXLandscape: jest.fn(),
}));

jest.mock('../levelEngine', () => ({
  getMergedLevels: jest.fn(),
}));

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('spx/regimeClassifier', () => {
  it('does not fetch current-session minute bars when trend inputs are provided', async () => {
    const { getMinuteAggregates } = await import('../../../config/massive');

    const gexLandscape = {
      spx: {
        spotPrice: 6100,
      },
      combined: {
        netGex: 125000,
        flipPoint: 6095,
      },
    } as any;
    const levelData = {
      levels: [],
      clusters: [],
      generatedAt: '2026-02-20T20:00:00.000Z',
    } as any;

    const state = await classifyCurrentRegime({
      forceRefresh: true,
      gexLandscape,
      levelData,
      volumeTrend: 'rising',
      trendStrength: 0.55,
    });

    expect(getMinuteAggregates).not.toHaveBeenCalled();
    expect(state.regime).toBeTruthy();
    expect(state.timestamp).toBeTruthy();
  });
});

