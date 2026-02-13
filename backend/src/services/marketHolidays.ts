
import { massiveClient } from '../config/massive';
import { logger } from '../lib/logger';
import { cacheGet, cacheSet } from '../config/redis';

export interface UpcomingHoliday {
    name: string;
    date: string;           // YYYY-MM-DD
    status: 'closed' | 'early-close';
    closeTime?: string;     // "1:00 PM ET" for early closes
    daysUntil: number;      // Trading days until holiday
    affectsTrading: string; // Human-readable impact description
}

interface MassiveMarketHoliday {
    exchange: string;
    name: string;
    date: string;
    status: string;
    open?: string;
    close?: string;
}

const HOLIDAYS_CACHE_KEY = 'market:holidays:upcoming';
const HOLIDAYS_CACHE_TTL = 24 * 60 * 60; // 24 hours

export async function getUpcomingHolidays(limit: number = 5): Promise<UpcomingHoliday[]> {
    const cached = await cacheGet<UpcomingHoliday[]>(HOLIDAYS_CACHE_KEY);
    if (cached) {
        return cached.slice(0, limit);
    }

    try {
        const response = await massiveClient.get('/v1/marketstatus/upcoming', {
            params: { limit: 20 } // Fetch more to cache, slice on return
        });

        const rawHolidays: MassiveMarketHoliday[] = response.data || [];

        // Filter for US markets (NYSE/NASDAQ usually align)
        const usHolidays = rawHolidays.filter(h =>
            h.exchange === 'NYSE' || h.exchange === 'NASDAQ' || h.exchange === 'US'
        );

        // Deduplicate by date
        const uniqueHolidays = Array.from(new Map(usHolidays.map(item => [item.date, item])).values());
        uniqueHolidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const upcomingHolidays: UpcomingHoliday[] = uniqueHolidays.map(h => {
            const today = new Date();
            const holidayDate = new Date(h.date);
            const diffTime = Math.abs(holidayDate.getTime() - today.getTime());
            const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return {
                name: h.name,
                date: h.date,
                status: h.status === 'early-close' ? 'early-close' : 'closed',
                closeTime: h.close, // Massive API usually gives this for early close
                daysUntil,
                affectsTrading: h.status === 'early-close'
                    ? `Market closes early at ${h.close || '1:00 PM'} ET`
                    : 'Market closed all day'
            };
        });

        await cacheSet(HOLIDAYS_CACHE_KEY, upcomingHolidays, HOLIDAYS_CACHE_TTL);

        return upcomingHolidays.slice(0, limit);
    } catch (error: any) {
        logger.error('Failed to fetch upcoming holidays', { error: error.message });
        // Return empty array or fallback to hardcoded list (Phase 0 fallback logic)
        return [];
    }
}

export async function getNextHoliday(): Promise<UpcomingHoliday | null> {
    const holidays = await getUpcomingHolidays(1);
    return holidays.length > 0 ? holidays[0] : null;
}

/**
 * Check if a specific date is a holiday or early close.
 * Checks against the cached upcoming holidays list.
 */
export async function isHolidayOrEarlyClose(date: string): Promise<{
    isHoliday: boolean;
    isEarlyClose: boolean;
    details?: UpcomingHoliday;
}> {
    const holidays = await getUpcomingHolidays(50); // Fetch enough to cover near future
    const match = holidays.find(h => h.date === date);

    if (match) {
        return {
            isHoliday: match.status === 'closed',
            isEarlyClose: match.status === 'early-close',
            details: match
        };
    }

    // Fallback: check weekend
    const dayOfWeek = new Date(date).getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return { isHoliday: true, isEarlyClose: false };
    }

    return { isHoliday: false, isEarlyClose: false };
}
