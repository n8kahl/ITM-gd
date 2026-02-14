import { getUpcomingSplits } from '../stockSplits';
import { massiveClient } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';

// Mock dependencies
jest.mock('../../config/massive');
jest.mock('../../config/redis');
jest.mock('../../lib/logger');

describe('Stock Splits Service', () => {
    const mockSplitsResponse = {
        data: {
            results: [
                {
                    ticker: 'AAPL',
                    execution_date: '2025-08-31',
                    payment_date: '2025-08-30',
                    split_from: 1,
                    split_to: 4
                }
            ]
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (cacheGet as jest.Mock).mockResolvedValue(null);
        (massiveClient.get as jest.Mock).mockResolvedValue(mockSplitsResponse);
    });

    it('should fetch upcoming splits from API', async () => {
        const splits = await getUpcomingSplits();

        expect(massiveClient.get).toHaveBeenCalledWith('/v3/reference/splits', expect.any(Object));
        expect(splits).toHaveLength(1);
        expect(splits[0].ticker).toBe('AAPL');
        expect(splits[0].ratio).toBe(4);
        expect(cacheSet).toHaveBeenCalled();
    });

    it('should return cached splits if available', async () => {
        const cachedSplits = [{ ticker: 'TSLA', ratio: 3 }];
        (cacheGet as jest.Mock).mockResolvedValue(cachedSplits);

        const splits = await getUpcomingSplits();

        expect(massiveClient.get).not.toHaveBeenCalled();
        expect(splits).toEqual(cachedSplits);
    });

    it('should handle API errors gracefully', async () => {
        (massiveClient.get as jest.Mock).mockRejectedValue(new Error('API Error'));

        const splits = await getUpcomingSplits();

        expect(splits).toEqual([]);
    });
});
