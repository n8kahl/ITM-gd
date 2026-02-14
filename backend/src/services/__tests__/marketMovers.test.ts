import { getMarketMovers } from '../marketMovers';
import { massiveClient } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';

// Mock dependencies
jest.mock('../../config/massive');
jest.mock('../../config/redis');
jest.mock('../../lib/logger');

describe('Market Movers Service', () => {
    const mockSnapshot = {
        data: {
            tickers: [
                { ticker: 'AAPL', day: { close: 150 }, lastTrade: { p: 150 }, todaysChange: 5, todaysChangePerc: 3.5 },
                { ticker: 'TSLA', day: { close: 200 }, lastTrade: { p: 200 }, todaysChange: 10, todaysChangePerc: 5.0 }
            ]
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (cacheGet as jest.Mock).mockResolvedValue(null);
        (massiveClient.get as jest.Mock).mockResolvedValue(mockSnapshot);
    });

    it('should fetch gainers and losers', async () => {
        const result = await getMarketMovers(5);

        expect(massiveClient.get).toHaveBeenCalledTimes(2);
        expect(result.gainers).toHaveLength(2);
        expect(result.losers).toHaveLength(2);
        expect(result.gainers[0].ticker).toBe('AAPL');
        expect(cacheSet).toHaveBeenCalled();
    });

    it('should return cached movers if available', async () => {
        const cachedMovers = { gainers: [], losers: [] };
        (cacheGet as jest.Mock).mockResolvedValue(cachedMovers);

        const result = await getMarketMovers(5);

        expect(massiveClient.get).not.toHaveBeenCalled();
        expect(result).toEqual(cachedMovers);
    });

    it('should handle API errors gracefully', async () => {
        (massiveClient.get as jest.Mock).mockRejectedValue(new Error('API Error'));

        const result = await getMarketMovers(5);

        expect(result.gainers).toEqual([]);
        expect(result.losers).toEqual([]);
    });
});
