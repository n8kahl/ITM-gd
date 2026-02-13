
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { getUpcomingHolidays, isHolidayOrEarlyClose } from '../marketHolidays';
import { massiveClient } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';

// Mock dependencies
vi.mock('../../config/massive');
vi.mock('../../config/redis');
vi.mock('../../lib/logger');

describe('Market Holidays Service', () => {
    const mockHolidaysResponse = {
        data: [
            {
                exchange: 'NYSE',
                name: 'New Year\'s Day',
                date: '2025-01-01',
                status: 'closed'
            },
            {
                exchange: 'NYSE',
                name: 'Early Close Test',
                date: '2025-07-03',
                status: 'early-close',
                close: '1:00 PM'
            }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (cacheGet as Mock).mockResolvedValue(null);
        (massiveClient.get as Mock).mockResolvedValue(mockHolidaysResponse);
    });

    describe('getUpcomingHolidays', () => {
        it('should fetch holidays from API if not cached', async () => {
            const holidays = await getUpcomingHolidays();

            expect(massiveClient.get).toHaveBeenCalledWith('/v1/marketstatus/upcoming', expect.any(Object));
            expect(holidays).toHaveLength(2);
            expect(holidays[0].name).toBe('New Year\'s Day');
            expect(cacheSet).toHaveBeenCalled();
        });

        it('should return cached holidays if available', async () => {
            const cachedHolidays = [{ name: 'Cached Holiday', date: '2025-12-25' }];
            (cacheGet as Mock).mockResolvedValue(cachedHolidays);

            const holidays = await getUpcomingHolidays();

            expect(massiveClient.get).not.toHaveBeenCalled();
            expect(holidays).toEqual(cachedHolidays);
        });

        it('should handle API errors gracefully', async () => {
            (massiveClient.get as Mock).mockRejectedValue(new Error('API Error'));

            const holidays = await getUpcomingHolidays();

            expect(holidays).toEqual([]);
        });

        it('should deduplicate holidays by date', async () => {
            (massiveClient.get as Mock).mockResolvedValue({
                data: [
                    { exchange: 'NYSE', name: 'Xmas', date: '2025-12-25', status: 'closed' },
                    { exchange: 'NASDAQ', name: 'Christmas', date: '2025-12-25', status: 'closed' }
                ]
            });

            const holidays = await getUpcomingHolidays();
            expect(holidays).toHaveLength(1);
        });
    });

    describe('isHolidayOrEarlyClose', () => {
        it('should identify a holiday', async () => {
            const result = await isHolidayOrEarlyClose('2025-01-01');
            expect(result.isHoliday).toBe(true);
            expect(result.details?.name).toBe('New Year\'s Day');
        });

        it('should identify an early close', async () => {
            const result = await isHolidayOrEarlyClose('2025-07-03');
            expect(result.isEarlyClose).toBe(true);
            expect(result.details?.closeTime).toBe('1:00 PM');
        });

        it('should identify a weekend as a holiday', async () => {
            // 2024-02-17 is a Saturday
            const result = await isHolidayOrEarlyClose('2024-02-17');
            expect(result.isHoliday).toBe(true);
            expect(result.details).toBeUndefined(); // No holiday details, just weekend
        });

        it('should return false for a regular trading day', async () => {
            // 2025-01-02 is a Thursday (assuming 2025-01-01 is Weds)
            const result = await isHolidayOrEarlyClose('2025-01-02');
            expect(result.isHoliday).toBe(false);
            expect(result.isEarlyClose).toBe(false);
        });
    });
});
