import { getMarketIndicesSnapshot } from '../marketIndices';
import { massiveClient } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';

jest.mock('../../config/massive');
jest.mock('../../config/redis');
jest.mock('../../lib/logger');

describe('Market Indices Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cacheGet as jest.Mock).mockResolvedValue(null);
    (cacheSet as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns cached snapshot when available', async () => {
    (cacheGet as jest.Mock).mockResolvedValue({
      quotes: [{ symbol: 'SPX', price: 6000, change: 0, changePercent: 0 }],
      metrics: { vwap: null, vixLevel: null, vixChange: null },
      source: 'massive',
    });

    const snapshot = await getMarketIndicesSnapshot();

    expect(snapshot.quotes[0].symbol).toBe('SPX');
    expect(massiveClient.get).not.toHaveBeenCalled();
  });

  it('builds quotes using previous session candles', async () => {
    (massiveClient.get as jest.Mock)
      .mockResolvedValueOnce({ data: { results: [{ c: 6000, o: 5950, vw: 6020 }] } })
      .mockResolvedValueOnce({ data: { results: [{ c: 21000, o: 20900, vw: 0 }] } })
      .mockRejectedValueOnce(new Error('VIX unavailable'))
      .mockRejectedValueOnce(new Error('DXY unavailable'))
      .mockRejectedValueOnce(new Error('TNX unavailable'));

    const snapshot = await getMarketIndicesSnapshot();

    expect(snapshot.quotes).toHaveLength(2);
    expect(snapshot.quotes[0].symbol).toBe('SPX');
    expect(snapshot.quotes[0].change).toBe(50);
    expect(snapshot.quotes[0].changePercent).toBeCloseTo((50 / 5950) * 100, 6);
    expect(snapshot.source).toBe('massive');
    expect(cacheSet).toHaveBeenCalled();
  });

  it('returns only available index results when one payload is missing', async () => {
    (massiveClient.get as jest.Mock)
      .mockResolvedValueOnce({ data: { results: [{ c: 6000, o: 5950, vw: 6020 }] } })
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockRejectedValueOnce(new Error('VIX unavailable'))
      .mockRejectedValueOnce(new Error('DXY unavailable'))
      .mockRejectedValueOnce(new Error('TNX unavailable'));

    const snapshot = await getMarketIndicesSnapshot();

    expect(snapshot.quotes).toHaveLength(1);
    expect(snapshot.quotes[0].symbol).toBe('SPX');
  });
});
