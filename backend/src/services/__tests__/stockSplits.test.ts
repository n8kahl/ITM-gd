
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { getUpcomingSplits } from '../stockSplits';
import { massiveClient } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';

// Mock dependencies
vi.mock('../../config/massive');
vi.mock('../../config/redis');
vi.mock('../../lib/logger');

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
        vi.clearAllMocks();
        (cacheGet as Mock).mockResolvedValue(null);
        (massiveClient.get as Mock).mockResolvedValue(mockSplitsResponse);
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
        (cacheGet as Mock).mockResolvedValue(cachedSplits);

        const splits = await getUpcomingSplits();

        expect(massiveClient.get).not.toHaveBeenCalled();
        expect(splits).toEqual(cachedSplits);
    });

    it('should handle API errors gracefully', async () => {
        (massiveClient.get as Mock).mockRejectedValue(new Error('API Error'));

        const splits = await getUpcomingSplits();

        expect(splits).toEqual([]);
    });
});
