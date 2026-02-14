jest.mock('../../../config/massive', () => ({
  getOptionsContracts: jest.fn(),
  getOptionsSnapshot: jest.fn(),
  getOptionsExpirations: jest.fn(),
  getDailyAggregates: jest.fn(),
}));

jest.mock('../../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

import {
  getDailyAggregates,
  getOptionsContracts,
  getOptionsExpirations,
  getOptionsSnapshot,
} from '../../../config/massive';
import { cacheGet, cacheSet } from '../../../config/redis';
import { fetchExpirationDates, fetchOptionContract, fetchOptionsChain } from '../optionsChainFetcher';

const mockGetDailyAggregates = getDailyAggregates as jest.MockedFunction<typeof getDailyAggregates>;
const mockGetOptionsContracts = getOptionsContracts as jest.MockedFunction<typeof getOptionsContracts>;
const mockGetOptionsExpirations = getOptionsExpirations as jest.MockedFunction<typeof getOptionsExpirations>;
const mockGetOptionsSnapshot = getOptionsSnapshot as jest.MockedFunction<typeof getOptionsSnapshot>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;

describe('optionsChainFetcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue();
    mockGetDailyAggregates.mockResolvedValue([
      {
        o: 499,
        h: 502,
        l: 497,
        c: 500,
        v: 1_000_000,
        t: Date.parse('2026-02-09T20:00:00.000Z'),
      },
    ] as any);
    mockGetOptionsExpirations.mockResolvedValue(['2026-02-13']);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds chain when single-contract snapshot payload is object-shaped', async () => {
    mockGetOptionsContracts.mockResolvedValue([
      {
        ticker: 'O:SPY260213C00500000',
        underlying_ticker: 'SPY',
        strike_price: 500,
        expiration_date: '2026-02-13',
        contract_type: 'call',
      },
      {
        ticker: 'O:SPY260213P00500000',
        underlying_ticker: 'SPY',
        strike_price: 500,
        expiration_date: '2026-02-13',
        contract_type: 'put',
      },
    ]);

    mockGetOptionsSnapshot
      .mockResolvedValueOnce({
        ticker: 'O:SPY260213C00500000',
        day: { open: 4.2, high: 5.3, low: 4.0, close: 5.0, volume: 1200 },
        last_quote: { bid: 4.9, ask: 5.1, bid_size: 10, ask_size: 12, last_updated: 0 },
        greeks: { delta: 0.53, gamma: 0.02, theta: -0.11, vega: 0.07 },
        implied_volatility: 0.19,
        open_interest: 5400,
      } as any)
      .mockResolvedValueOnce({
        ticker: 'O:SPY260213P00500000',
        day: { open: 4.1, high: 5.0, low: 3.9, close: 4.8, volume: 1100 },
        last_quote: { bid: 4.7, ask: 4.9, bid_size: 11, ask_size: 13, last_updated: 0 },
        greeks: { delta: -0.47, gamma: 0.021, theta: -0.1, vega: 0.068 },
        implied_volatility: 0.2,
        open_interest: 5100,
      } as any);

    const result = await fetchOptionsChain('SPY', '2026-02-13', 3);

    expect(result.options.calls).toHaveLength(1);
    expect(result.options.puts).toHaveLength(1);
    expect(result.options.calls[0].bid).toBe(4.9);
    expect(result.options.puts[0].ask).toBe(4.9);
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it('returns option contract for object-shaped single snapshot payload', async () => {
    mockGetOptionsContracts.mockResolvedValue([
      {
        ticker: 'O:SPY260213C00500000',
        underlying_ticker: 'SPY',
        strike_price: 500,
        expiration_date: '2026-02-13',
        contract_type: 'call',
      },
    ]);

    mockGetOptionsSnapshot.mockResolvedValue({
      ticker: 'O:SPY260213C00500000',
      day: { open: 4.2, high: 5.3, low: 4.0, close: 5.0, volume: 1200 },
      last_quote: { bid: 4.9, ask: 5.1, bid_size: 10, ask_size: 12, last_updated: 0 },
      greeks: { delta: 0.53, gamma: 0.02, theta: -0.11, vega: 0.07 },
      implied_volatility: 0.19,
      open_interest: 5400,
    } as any);

    const contract = await fetchOptionContract('SPY', 500, '2026-02-13', 'call');

    expect(contract).not.toBeNull();
    expect(contract?.type).toBe('call');
    expect(contract?.strike).toBe(500);
    expect(contract?.bid).toBe(4.9);
  });

  it('falls back to Black-Scholes greeks when provider greeks are missing but IV exists', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-10T15:00:00.000Z'));

    mockGetOptionsContracts.mockResolvedValue([
      {
        ticker: 'O:SPY260213C00500000',
        underlying_ticker: 'SPY',
        strike_price: 500,
        expiration_date: '2026-02-13',
        contract_type: 'call',
      },
      {
        ticker: 'O:SPY260213P00500000',
        underlying_ticker: 'SPY',
        strike_price: 500,
        expiration_date: '2026-02-13',
        contract_type: 'put',
      },
    ]);

    mockGetOptionsSnapshot
      .mockResolvedValueOnce({
        ticker: 'O:SPY260213C00500000',
        day: { open: 4.2, high: 5.3, low: 4.0, close: 5.0, volume: 1200 },
        last_quote: { bid: 4.9, ask: 5.1, bid_size: 10, ask_size: 12, last_updated: 0 },
        greeks: {},
        implied_volatility: 0.19,
        open_interest: 5400,
      } as any)
      .mockResolvedValueOnce({
        ticker: 'O:SPY260213P00500000',
        day: { open: 4.1, high: 5.0, low: 3.9, close: 4.8, volume: 1100 },
        last_quote: { bid: 4.7, ask: 4.9, bid_size: 11, ask_size: 13, last_updated: 0 },
        greeks: {},
        implied_volatility: 0.2,
        open_interest: 5100,
      } as any);

    const result = await fetchOptionsChain('SPY', '2026-02-13', 3);

    expect(result.options.calls[0].gamma).toBeGreaterThan(0);
    expect(result.options.puts[0].gamma).toBeGreaterThan(0);
  });

  it('keeps ET same-day expiration when UTC has crossed midnight', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-10T00:30:00.000Z')); // 2026-02-09 19:30 ET

    mockGetOptionsExpirations.mockResolvedValue(['2026-02-09', '2026-02-10']);

    const expirations = await fetchExpirationDates('SPX');

    expect(expirations).toEqual(['2026-02-09', '2026-02-10']);
    expect(mockCacheSet).toHaveBeenCalledWith(
      'options_expirations:SPX',
      ['2026-02-09', '2026-02-10'],
      3600,
    );
  });
});
