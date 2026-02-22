import { getDailyAggregates, getLastQuote, getLastTrade, getMinuteAggregates } from '../config/massive';
import { toEasternTime } from './marketHours';
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
const REALTIME_ENTITLEMENT_COOLDOWN_MS = 10 * 60 * 1000;
const realtimePriceInFlight = new Map<string, Promise<RealTimePrice>>();
const realtimeEntitlementCooldownUntil = new Map<string, number>();

function getCurrentEasternDate(now: Date = new Date()): string {
    return toEasternTime(now).dateStr;
}

function toMillisecondTimestamp(raw: unknown): number {
    const numeric = typeof raw === 'number' && Number.isFinite(raw) ? raw : NaN;
    if (!Number.isFinite(numeric) || numeric <= 0) return Date.now();
    if (numeric >= 1e15) return Math.floor(numeric / 1_000_000); // ns -> ms
    if (numeric >= 1e12) return Math.floor(numeric); // already ms
    if (numeric >= 1e10) return Math.floor(numeric); // ms-scale
    return Math.floor(numeric * 1000); // sec -> ms
}

function isRealtimeEntitlementError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const maybeAny = error as {
        message?: string;
        response?: {
            data?: {
                status?: string;
                message?: string;
            };
        };
    };

    const status = String(maybeAny.response?.data?.status || '').toUpperCase();
    const dataMessage = String(maybeAny.response?.data?.message || '').toUpperCase();
    const message = String(maybeAny.message || '').toUpperCase();
    return status === 'NOT_AUTHORIZED'
        || dataMessage.includes('NOT ENTITLED')
        || message.includes('NOT ENTITLED')
        || message.includes('NOT_AUTHORIZED');
}

async function getAggregateFallbackPrice(symbol: string): Promise<RealTimePrice | null> {
    const today = getCurrentEasternDate();
    const minuteData = await getMinuteAggregates(symbol, today);
    const minuteBars = Array.isArray(minuteData) ? minuteData : [];
    if (minuteBars.length > 0) {
        const lastBar = minuteBars[minuteBars.length - 1];

        return {
            symbol,
            price: lastBar.c,
            bid: lastBar.c,
            ask: lastBar.c,
            mid: lastBar.c,
            spread: 0,
            spreadPct: 0,
            size: 0,
            timestamp: toMillisecondTimestamp((lastBar as { t?: number }).t),
            exchange: 0,
            source: 'aggregate_fallback',
        };
    }

    const weekAgo = getCurrentEasternDate(new Date(Date.now() - 7 * 86400000));
    const dailyData = await getDailyAggregates(symbol, weekAgo, today);
    const dailyBars = Array.isArray(dailyData) ? dailyData : [];
    if (dailyBars.length === 0) return null;

    const lastBar = dailyBars[dailyBars.length - 1];

    return {
        symbol,
        price: lastBar.c,
        bid: lastBar.c,
        ask: lastBar.c,
        mid: lastBar.c,
        spread: 0,
        spreadPct: 0,
        size: 0,
        timestamp: toMillisecondTimestamp((lastBar as { t?: number }).t),
        exchange: 0,
        source: 'aggregate_fallback',
    };
}

export async function getRealTimePrice(symbol: string): Promise<RealTimePrice> {
    const cacheKey = `price:realtime:${symbol}`;
    const cached = await cacheGet<RealTimePrice>(cacheKey);

    if (cached) {
        return cached;
    }

    const inFlight = realtimePriceInFlight.get(symbol);
    if (inFlight) {
        return inFlight;
    }

    const run = (async () => {
        const cooldownUntil = realtimeEntitlementCooldownUntil.get(symbol) || 0;
        if (cooldownUntil > Date.now()) {
            const fallback = await getAggregateFallbackPrice(symbol);
            if (!fallback) {
                throw new Error('Real-time entitlement unavailable and no aggregate fallback data.');
            }
            await cacheSet(cacheKey, fallback, PRICE_CACHE_TTL);
            return fallback;
        }

        try {
            // Attempt to get last trade and quote in parallel
            const [tradePromise, quotePromise] = await Promise.allSettled([
                getLastTrade(symbol),
                getLastQuote(symbol)
            ]);

            const trade = tradePromise.status === 'fulfilled' ? tradePromise.value : null;
            const quote = quotePromise.status === 'fulfilled' ? quotePromise.value : null;

            // If both fail, fallback to aggregate bars and place a short cooldown for entitlement errors.
            if (!trade && !quote) {
                const tradeError = tradePromise.status === 'rejected' ? tradePromise.reason : null;
                const quoteError = quotePromise.status === 'rejected' ? quotePromise.reason : null;
                if (isRealtimeEntitlementError(tradeError) || isRealtimeEntitlementError(quoteError)) {
                    realtimeEntitlementCooldownUntil.set(symbol, Date.now() + REALTIME_ENTITLEMENT_COOLDOWN_MS);
                }
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
                timestamp: toMillisecondTimestamp(trade?.t),
                exchange: trade?.x || 0,
                source: trade ? 'last_trade' : 'last_quote',
            };

            await cacheSet(cacheKey, result, PRICE_CACHE_TTL);
            return result;

        } catch (error: any) {
            logger.error(`Failed to fetch real-time price for ${symbol}`, { error: error.message });

            const fallback = await getAggregateFallbackPrice(symbol);
            if (!fallback) {
                throw error;
            }

            await cacheSet(cacheKey, fallback, PRICE_CACHE_TTL);
            return fallback;
        }
    })();

    realtimePriceInFlight.set(symbol, run);
    try {
        return await run;
    } finally {
        realtimePriceInFlight.delete(symbol);
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
