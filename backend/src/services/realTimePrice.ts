
import { getLastTrade, getLastQuote } from '../config/massive';
import { logger } from '../lib/logger';
import { cacheGet, cacheSet } from '../config/redis';

export interface RealTimePrice {
    symbol: string;
    price: number;           // Last trade price
    bid: number;             // Best bid
    ask: number;             // Best ask
    mid: number;             // Midpoint
    spread: number;          // Ask - Bid
    spreadPct: number;       // Spread as % of mid
    size: number;            // Last trade size
    timestamp: number;       // Trade timestamp (ms)
    exchange: number;        // Exchange ID
    source: 'last_trade' | 'last_quote' | 'aggregate_fallback';
}

const PRICE_CACHE_TTL = 5; // 5 seconds cache for real-time prices

export async function getRealTimePrice(symbol: string): Promise<RealTimePrice> {
    const cacheKey = `price:realtime:${symbol}`;
    const cached = await cacheGet<RealTimePrice>(cacheKey);

    if (cached) {
        return cached;
    }

    try {
        // Attempt to get last trade and quote in parallel
        const [tradePromise, quotePromise] = await Promise.allSettled([
            getLastTrade(symbol),
            getLastQuote(symbol)
        ]);

        let trade = tradePromise.status === 'fulfilled' ? tradePromise.value : null;
        let quote = quotePromise.status === 'fulfilled' ? quotePromise.value : null;

        // If both fail, fallback to daily aggregate (previous close or today's ohlc)
        if (!trade && !quote) {
            logger.warn(`Real-time price unavailable for ${symbol}`);
            throw new Error('Real-time data unavailable');
        }

        const price = trade?.p || quote?.P || 0; // Trade price > Bid price
        const bid = quote?.P || price;
        const ask = quote?.p || price;
        const mid = (bid + ask) / 2;
        const spread = ask - bid;
        const spreadPct = mid > 0 ? (spread / mid) * 100 : 0;

        const result: RealTimePrice = {
            symbol,
            price,
            bid,
            ask,
            mid,
            spread,
            spreadPct,
            size: trade?.s || 0,
            timestamp: (trade?.t || Date.now()) / 1000000, // Massive uses nanoseconds
            exchange: trade?.x || 0,
            source: trade ? 'last_trade' : 'last_quote',
        };

        await cacheSet(cacheKey, result, PRICE_CACHE_TTL);
        return result;

    } catch (error: any) {
        logger.error(`Failed to fetch real-time price for ${symbol}`, { error: error.message });
        // Fallback to simpler aggregation if needed, or propagate error
        throw error;
    }
}

export async function getRealTimePrices(symbols: string[]): Promise<Map<string, RealTimePrice>> {
    const results = new Map<string, RealTimePrice>();
    // In production, use Massive's snapshot endpoint or batching if available.
    // For now, parallel requests (rate limited by our client configuration)

    await Promise.all(symbols.map(async (symbol) => {
        try {
            const price = await getRealTimePrice(symbol);
            results.set(symbol, price);
        } catch (e) {
            logger.warn(`Failed to fetch batch price for ${symbol}`);
        }
    }));

    return results;
}
