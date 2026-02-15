
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
const MOVERS_STALE_CACHE_TTL = 60 * 60 * 24; // 24 hours
const MASSIVE_MOVERS_TIMEOUT_MS = 8000;

export async function getMarketMovers(limit: number = 10): Promise<MarketMoversResponse> {
    const cacheKey = `market:movers:${limit}`;
    const staleCacheKey = `market:movers:lastgood:${limit}`;
    const cached = await cacheGet<MarketMoversResponse>(cacheKey);

    if (cached) {
        return cached;
    }

    const stale = await cacheGet<MarketMoversResponse>(staleCacheKey);

    try {
        const [gainersParams, losersParams] = [
            { sort: 'todaysChangePerc', order: 'desc', limit },
            { sort: 'todaysChangePerc', order: 'asc', limit }
        ];

        const [gainersRes, losersRes] = await Promise.all([
            massiveClient.get('/v2/snapshot/locale/us/markets/stocks/tickers', { params: gainersParams, timeout: MASSIVE_MOVERS_TIMEOUT_MS }),
            massiveClient.get('/v2/snapshot/locale/us/markets/stocks/tickers', { params: losersParams, timeout: MASSIVE_MOVERS_TIMEOUT_MS })
        ]);

        const formatMover = (item: any): MarketMover => ({
            ticker: typeof item?.ticker === 'string' ? item.ticker : '',
            price: Number(item?.day?.close ?? item?.lastTrade?.p ?? 0),
            change: Number(item?.todaysChange ?? 0),
            changePercent: Number(item?.todaysChangePerc ?? 0)
        });

        const gainers = (gainersRes.data.tickers || []).map(formatMover).filter((item: MarketMover) => Boolean(item.ticker));
        const losers = (losersRes.data.tickers || []).map(formatMover).filter((item: MarketMover) => Boolean(item.ticker));

        const result = { gainers, losers };

        await cacheSet(cacheKey, result, MOVERS_CACHE_TTL);
        await cacheSet(staleCacheKey, result, MOVERS_STALE_CACHE_TTL);

        return result;
    } catch (error: any) {
        logger.error('Failed to fetch market movers', { error: error.message });
        if (stale) {
            return stale;
        }
        return { gainers: [], losers: [] };
    }
}
