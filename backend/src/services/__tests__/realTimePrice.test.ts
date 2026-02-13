
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { getRealTimePrice } from '../realTimePrice';
import { getLastTrade, getLastQuote } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';

// Mock dependencies
vi.mock('../../config/massive');
vi.mock('../../config/redis');
vi.mock('../../lib/logger');

describe('RealTimePrice Service', () => {
    const mockTrade = {
        T: 'AAPL', t: 1620000000000000, p: 150.00, s: 100, x: 1, c: [], y: 1620000000000000, q: 1, i: '1', z: 1
    };
    const mockQuote = {
        T: 'AAPL', t: 1620000000000000, P: 149.90, p: 150.10, S: 100, s: 100, x: 1, X: 1, c: [], y: 1620000000000000, q: 1, z: 1
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (cacheGet as Mock).mockResolvedValue(null);
    });

    it('should return cached price if available', async () => {
        const cachedPrice = { symbol: 'AAPL', price: 155.00 };
        (cacheGet as Mock).mockResolvedValue(cachedPrice);

        const result = await getRealTimePrice('AAPL');

        expect(result).toEqual(cachedPrice);
        expect(getLastTrade).not.toHaveBeenCalled();
    });

    it('should fetch from API and return aggregated data', async () => {
        (getLastTrade as Mock).mockResolvedValue(mockTrade);
        (getLastQuote as Mock).mockResolvedValue(mockQuote);

        const result = await getRealTimePrice('AAPL');

        expect(result.symbol).toBe('AAPL');
        expect(result.price).toBe(150.00);
        expect(result.bid).toBe(149.90);
        expect(result.ask).toBe(150.10);
        expect(result.source).toBe('last_trade');
        expect(cacheSet).toHaveBeenCalled();
    });

    it('should handle missing trade but present quote', async () => {
        (getLastTrade as Mock).mockRejectedValue(new Error('No trade'));
        (getLastQuote as Mock).mockResolvedValue(mockQuote);

        const result = await getRealTimePrice('AAPL');

        expect(result.price).toBe(149.90); // Fallback to bid or ask (logic: price || bid)? logic says trade?.p || quote?.P. So 149.90
        expect(result.source).toBe('last_quote');
    });

    it('should throw if both unavailable', async () => {
        (getLastTrade as Mock).mockRejectedValue(new Error('No trade'));
        (getLastQuote as Mock).mockRejectedValue(new Error('No quote'));

        await expect(getRealTimePrice('AAPL')).rejects.toThrow('Real-time data unavailable');
    });
});
