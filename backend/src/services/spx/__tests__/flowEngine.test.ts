import { cacheGet, cacheSet } from '../../../config/redis';
import { getAggregates, getOptionsSnapshot } from '../../../config/massive';
import { getFlowEvents } from '../flowEngine';

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

jest.mock('../../../config/massive', () => ({
  getAggregates: jest.fn(),
  getOptionsSnapshot: jest.fn(),
}));

const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockGetAggregates = getAggregates as jest.MockedFunction<typeof getAggregates>;
const mockGetOptionsSnapshot = getOptionsSnapshot as jest.MockedFunction<typeof getOptionsSnapshot>;

function buildProfile(overrides?: {
  symbol?: string;
  crossSymbol?: string;
  minPremium?: number;
  minVolume?: number;
  directionalMinPremium?: number;
}) {
  return {
    symbol: overrides?.symbol || 'SPX',
    displayName: 'Profile',
    level: {
      roundNumberInterval: 50,
      openingRangeMinutes: 30,
      clusterRadiusPoints: 3,
    },
    gex: {
      scalingFactor: 0.1,
      crossSymbol: overrides?.crossSymbol || 'SPY',
      strikeWindowPoints: 220,
    },
    flow: {
      minPremium: overrides?.minPremium ?? 10_000,
      minVolume: overrides?.minVolume ?? 10,
      directionalMinPremium: overrides?.directionalMinPremium ?? 50_000,
    },
    multiTF: {
      emaFast: 21,
      emaSlow: 55,
      weight1h: 0.55,
      weight15m: 0.2,
      weight5m: 0.15,
      weight1m: 0.1,
    },
    regime: {
      breakoutThreshold: 0.7,
      compressionThreshold: 0.65,
    },
    tickers: {
      massiveTicker: 'I:SPX',
      massiveOptionsTicker: 'O:SPX*',
    },
    isActive: true,
    createdAt: null,
    updatedAt: null,
  };
}

function buildSnapshot(input: {
  ticker: string;
  strike: number;
  expiry: string;
  type: 'call' | 'put';
  volume: number;
  close: number;
}) {
  return {
    ticker: input.ticker,
    details: {
      strike_price: input.strike,
      expiration_date: input.expiry,
      contract_type: input.type,
    },
    day: {
      volume: input.volume,
      close: input.close,
    },
    open_interest: 100,
    last_quote: {
      bid: input.close,
      ask: input.close,
      last_updated: Date.now() * 1_000_000,
    },
  } as any;
}

describe('spx/flowEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null as never);
    mockCacheSet.mockResolvedValue(undefined as never);
    mockGetAggregates.mockResolvedValue({
      results: [],
    } as never);
  });

  it('applies symbol-profile min volume and min premium overrides to snapshot flow filtering', async () => {
    const profile = buildProfile({
      symbol: 'SPX',
      crossSymbol: 'SPY',
      minPremium: 20_000,
      minVolume: 20,
    });

    mockGetOptionsSnapshot.mockImplementation(async (symbol) => {
      if (symbol === 'SPX') {
        return [
          buildSnapshot({ ticker: 'O:SPX260320C06000000', strike: 6000, expiry: '2026-03-20', type: 'call', volume: 15, close: 8 }),
          buildSnapshot({ ticker: 'O:SPX260320C06010000', strike: 6010, expiry: '2026-03-20', type: 'call', volume: 30, close: 8 }),
        ] as never;
      }
      return [] as never;
    });

    const events = await getFlowEvents({
      forceRefresh: true,
      profile,
    });

    expect(mockGetOptionsSnapshot).toHaveBeenCalledWith('SPX');
    expect(mockGetOptionsSnapshot).toHaveBeenCalledWith('SPY');
    expect(events).toHaveLength(1);
    expect(events[0].strike).toBe(6010);
    expect(events[0].premium).toBeGreaterThanOrEqual(20_000);
  });

  it('maps seeded directional premium into legacy interval threshold behavior', async () => {
    const expiryInWindow = new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);

    const profile = buildProfile({
      symbol: 'SPX',
      crossSymbol: 'SPY',
      minPremium: 10_000,
      minVolume: 10,
      directionalMinPremium: 50_000,
    });

    mockGetOptionsSnapshot.mockImplementation(async (symbol) => {
      if (symbol === 'SPX') {
        return [
          buildSnapshot({
            ticker: 'O:SPX260320C06000000',
            strike: 6000,
            expiry: expiryInWindow,
            type: 'call',
            volume: 30,
            close: 6,
          }),
        ] as never;
      }
      return [] as never;
    });

    mockGetAggregates.mockResolvedValue({
      results: [
        { t: Date.now() - 60_000, c: 1, v: 50 },
        { t: Date.now(), c: 6, v: 50 },
      ],
    } as never);

    const events = await getFlowEvents({
      forceRefresh: true,
      profile,
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events.some((event) => event.premium >= 30_000)).toBe(true);
  });
});
