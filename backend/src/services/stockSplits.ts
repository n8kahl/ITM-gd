
import { massiveClient } from '../config/massive';
import { logger } from '../lib/logger';
import { cacheGet, cacheSet } from '../config/redis';

export interface StockSplit {
    ticker: string;
    exDate: string;
    paymentDate: string;
    recordDate: string;
    declaredDate: string;
    ratio: number;
    toFactor: number;
    fromFactor: number;
}

const SPLITS_CACHE_TTL = 3600; // 1 hour

export async function getUpcomingSplits(): Promise<StockSplit[]> {
    const cacheKey = 'market:splits:upcoming';
    const cached = await cacheGet<StockSplit[]>(cacheKey);

    if (cached) {
        return cached;
    }

    try {
        // Massive API endpoint for splits - checking reference/splits
        // Note: ensure this endpoint exists in your Massive API tier/docs.
        // Assuming /v3/reference/splits
        const response = await massiveClient.get('/v3/reference/splits', {
            params: {
                limit: 50,
                'execution_date.gte': new Date().toISOString().split('T')[0]
            }
        });

        const splits: StockSplit[] = (response.data.results || []).map((s: any) => ({
            ticker: s.ticker,
            exDate: s.execution_date,
            paymentDate: s.payment_date, // Massive sometimes called this valid_from/to?
            recordDate: s.record_date || s.execution_date,
            declaredDate: s.declared_date || s.execution_date,
            ratio: s.split_to / s.split_from,
            toFactor: s.split_to,
            fromFactor: s.split_from
        }));

        await cacheSet(cacheKey, splits, SPLITS_CACHE_TTL);
        return splits;
    } catch (error: any) {
        logger.error('Failed to fetch stock splits', { error: error.message });
        return [];
    }
}
