vi.mock('../../../config/massive', () => ({
  getOptionsContracts: vi.fn(),
  getOptionsSnapshot: vi.fn(),
  getOptionsExpirations: vi.fn(),
  getNearestOptionsExpiration: vi.fn(),
  getDailyAggregates: vi.fn(),
  getMinuteAggregates: vi.fn(),
  getLastTrade: vi.fn(),
  getLastQuote: vi.fn(),
}));

vi.mock('../../../config/redis', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

import {
  getDailyAggregates,
  getLastQuote,
  getLastTrade,
  getMinuteAggregates,
  getNearestOptionsExpiration,
  getOptionsContracts,
  getOptionsExpirations,
  getOptionsSnapshot,
} from '../../../config/massive';
import { cacheGet, cacheSet } from '../../../config/redis';
import { fetchExpirationDates, fetchOptionContract, fetchOptionsChain } from '../optionsChainFetcher';

const mockGetDailyAggregates = getDailyAggregates as vi.MockedFunction<typeof getDailyAggregates>;
const mockGetLastQuote = getLastQuote as vi.MockedFunction<typeof getLastQuote>;
const mockGetLastTrade = getLastTrade as vi.MockedFunction<typeof getLastTrade>;
const mockGetMinuteAggregates = getMinuteAggregates as vi.MockedFunction<typeof getMinuteAggregates>;
const mockGetNearestOptionsExpiration = getNearestOptionsExpiration as vi.MockedFunction<typeof getNearestOptionsExpiration>;
const mockGetOptionsContracts = getOptionsContracts as vi.MockedFunction<typeof getOptionsContracts>;
const mockGetOptionsExpirations = getOptionsExpirations as vi.MockedFunction<typeof getOptionsExpirations>;
const mockGetOptionsSnapshot = getOptionsSnapshot as vi.MockedFunction<typeof getOptionsSnapshot>;
const mockCacheGet = cacheGet as vi.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as vi.MockedFunction<typeof cacheSet>;

describe('optionsChainFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mockGetLastTrade.mockImplementation(async (ticker: string) => {
      const symbol = String(ticker || '').toUpperCase();
      const price = symbol.includes('SPX') ? 5900 : 500.1;
      return { p: price, t: Date.now() } as any;
    });
    mockGetLastQuote.mockImplementation(async (ticker: string) => {
      const symbol = String(ticker || '').toUpperCase();
      const mid = symbol.includes('SPX') ? 5900 : 500.1;
      return { p: mid + 0.1, P: mid - 0.1, t: Date.now() } as any;
    });
    mockGetMinuteAggregates.mockResolvedValue([
      {
        o: 499.5,
        h: 500.5,
        l: 499.2,
        c: 500.1,
        v: 12_000,
        t: Date.parse('2026-02-10T15:59:00.000Z'),
      },
    ] as any);
    mockGetOptionsExpirations.mockResolvedValue(['2026-02-13']);
    mockGetNearestOptionsExpiration.mockResolvedValue('2026-02-13');
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(result.options.calls[0].delta).toBe(0.53);
    expect(result.options.calls[0].gamma).toBe(0.02);
    expect(result.options.calls[0].theta).toBe(-0.11);
    expect(result.options.calls[0].vega).toBe(0.07);
    expect(result.options.puts[0].delta).toBe(-0.47);
    expect(result.options.puts[0].gamma).toBe(0.021);
    expect(result.options.puts[0].theta).toBe(-0.1);
    expect(result.options.puts[0].vega).toBe(0.068);
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T15:00:00.000Z'));

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

    expect(result.options.calls[0].delta).not.toBe(0);
    expect(result.options.calls[0].gamma).toBeGreaterThan(0);
    expect(result.options.calls[0].theta).not.toBe(0);
    expect(result.options.calls[0].vega).toBeGreaterThan(0);
    expect(result.options.puts[0].gamma).toBeGreaterThan(0);
  });

  it('returns zero greeks when provider greeks and IV are both unavailable', async () => {
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
      day: { open: 4.0, high: 4.8, low: 3.8, close: 4.4, volume: 900 },
      last_quote: { bid: 4.3, ask: 4.5, bid_size: 9, ask_size: 10, last_updated: 0 },
      greeks: {},
      open_interest: 4100,
    } as any);

    const result = await fetchOptionsChain('SPY', '2026-02-13', 3);
    const contract = result.options.calls[0];

    expect(contract.delta).toBe(0);
    expect(contract.gamma).toBe(0);
    expect(contract.theta).toBe(0);
    expect(contract.vega).toBe(0);
  });

  it('produces reasonable Black-Scholes ATM delta for SPX calls', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-25T15:00:00.000Z'));
    mockGetMinuteAggregates.mockResolvedValueOnce([
      {
        o: 5898,
        h: 5906,
        l: 5895,
        c: 5900,
        v: 18_000,
        t: Date.parse('2026-02-25T14:59:00.000Z'),
      },
    ] as any);
    mockGetOptionsContracts.mockResolvedValue([
      {
        ticker: 'O:SPX260320C05900000',
        underlying_ticker: 'SPX',
        strike_price: 5900,
        expiration_date: '2026-03-20',
        contract_type: 'call',
      },
    ]);
    mockGetOptionsSnapshot.mockResolvedValue({
      ticker: 'O:SPX260320C05900000',
      day: { open: 88, high: 96, low: 84, close: 92, volume: 2100 },
      last_quote: { bid: 91.5, ask: 92.5, bid_size: 8, ask_size: 9, last_updated: 0 },
      greeks: {},
      implied_volatility: 0.2,
      open_interest: 6700,
    } as any);

    const result = await fetchOptionsChain('SPX', '2026-03-20', 3);
    const call = result.options.calls[0];

    expect(call.strike).toBe(5900);
    expect(call.delta).toBeGreaterThanOrEqual(0.45);
    expect(call.delta).toBeLessThanOrEqual(0.55);
  });

  it('keeps ET same-day expiration when UTC has crossed midnight', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T00:30:00.000Z')); // 2026-02-09 19:30 ET

    mockGetOptionsExpirations.mockResolvedValue(['2026-02-09', '2026-02-10']);

    const expirations = await fetchExpirationDates('SPX');

    expect(expirations).toEqual(['2026-02-09', '2026-02-10']);
    expect(mockCacheSet).toHaveBeenCalledWith(
      'options_expirations:SPX',
      ['2026-02-09', '2026-02-10'],
      3600,
    );
  });

  it('filters stale cached expirations against current ET date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T14:00:00.000Z'));

    mockCacheGet.mockResolvedValueOnce(['2026-02-09', '2026-02-10', '2026-02-14']);

    const expirations = await fetchExpirationDates('SPX');

    expect(expirations).toEqual(['2026-02-10', '2026-02-14']);
    expect(mockGetOptionsExpirations).not.toHaveBeenCalled();
    expect(mockCacheSet).toHaveBeenCalledWith(
      'options_expirations:SPX',
      ['2026-02-10', '2026-02-14'],
      3600,
    );
  });

  it('falls back to nearest expiration when requested expiry has no contracts', async () => {
    mockGetNearestOptionsExpiration.mockResolvedValue('2026-02-13');
    mockGetOptionsContracts
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
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
      ] as any);

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

    const result = await fetchOptionsChain('SPY', '2026-02-12', 3);

    expect(result.expiry).toBe('2026-02-13');
    expect(mockGetOptionsContracts).toHaveBeenNthCalledWith(1, 'SPY', '2026-02-12');
    expect(mockGetOptionsContracts).toHaveBeenNthCalledWith(2, 'SPY', '2026-02-13');
  });
});
