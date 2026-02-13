
import { massiveClient } from '../config/massive';
import { logger } from '../lib/logger';
import { cacheGet, cacheSet } from '../config/redis';

export interface MarketMover {
    ticker: string;
    price: number;
    change: number;
    changePercent: number;
}

export interface MarketMoversResponse {
    gainers: MarketMover[];
    losers: MarketMover[];
}

const MOVERS_CACHE_TTL = 60; // 1 minute

export async function getMarketMovers(limit: number = 10): Promise<MarketMoversResponse> {
    const cacheKey = `market:movers:${limit}`;
    const cached = await cacheGet<MarketMoversResponse>(cacheKey);

    if (cached) {
        return cached;
    }

    try {
        const [gainersParams, losersParams] = [
            { sort: 'todaysChangePerc', order: 'desc', limit },
            { sort: 'todaysChangePerc', order: 'asc', limit }
        ];

        const [gainersRes, losersRes] = await Promise.all([
            massiveClient.get('/v2/snapshot/locale/us/markets/stocks/tickers', { params: gainersParams }),
            massiveClient.get('/v2/snapshot/locale/us/markets/stocks/tickers', { params: losersParams })
        ]);

        const formatMover = (item: any): MarketMover => ({
            ticker: item.ticker,
            price: item.day.close || item.lastTrade.p,
            change: item.todaysChange,
            changePercent: item.todaysChangePerc
        });

        const gainers = (gainersRes.data.tickers || []).map(formatMover);
        const losers = (losersRes.data.tickers || []).map(formatMover);

        const result = { gainers, losers };

        await cacheSet(cacheKey, result, MOVERS_CACHE_TTL);

        return result;
    } catch (error: any) {
        logger.error('Failed to fetch market movers', { error: error.message });
        return { gainers: [], losers: [] };
    }
}
