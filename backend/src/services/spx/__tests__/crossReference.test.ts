import { convertSpyPriceToSpx, convertSpxPriceToSpy, getBasisState } from '../crossReference';
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

jest.mock('../gexEngine', () => ({
  computeUnifiedGEXLandscape: jest.fn(),
}));

const mockComputeUnifiedGEXLandscape = computeUnifiedGEXLandscape as jest.MockedFunction<typeof computeUnifiedGEXLandscape>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;

describe('spx/crossReference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null as never);
    mockCacheSet.mockResolvedValue(undefined as never);
    mockComputeUnifiedGEXLandscape.mockResolvedValue({
      spx: {
        symbol: 'SPX',
        spotPrice: 6032.4,
        netGex: 0,
        flipPoint: 6030,
        callWall: 6050,
        putWall: 6000,
        zeroGamma: 6030,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-15T14:45:00.000Z',
      },
      spy: {
        symbol: 'SPY',
        spotPrice: 603.05,
        netGex: 0,
        flipPoint: 603,
        callWall: 605,
        putWall: 600,
        zeroGamma: 603,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-15T14:45:00.000Z',
      },
      combined: {
        symbol: 'COMBINED',
        spotPrice: 6032.4,
        netGex: 0,
        flipPoint: 6030,
        callWall: 6050,
        putWall: 6000,
        zeroGamma: 6030,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-15T14:45:00.000Z',
      },
    });
  });

  it('converts prices across SPX/SPY basis correctly', () => {
    expect(convertSpyPriceToSpx(603.1, 1.8)).toBe(6032.8);
    expect(convertSpxPriceToSpy(6032.8, 1.8)).toBe(603.1);
  });

  it('computes basis state from unified gex prices', async () => {
    const basis = await getBasisState({ forceRefresh: true });

    expect(basis.current).toBeCloseTo(1.9, 1);
    expect(['expanding', 'contracting', 'stable']).toContain(basis.trend);
    expect(['SPX', 'SPY', 'neutral']).toContain(basis.leading);
    expect(mockCacheSet).toHaveBeenCalled();
  });
});
