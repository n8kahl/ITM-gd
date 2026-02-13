
import { massiveClient } from '../config/massive';
import { logger } from '../lib/logger';
import { cacheGet, cacheSet } from '../config/redis';

interface IndexQuote {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
}

interface MarketIndicesResponse {
    quotes: IndexQuote[];
    metrics: {
        vwap: number | null;
    };
    source: 'massive';
}

const INDICES_CACHE_TTL = 15; // 15 seconds

export async function getMarketIndicesSnapshot(): Promise<MarketIndicesResponse> {
    const cacheKey = 'market:indices:snapshot';
    const cached = await cacheGet<MarketIndicesResponse>(cacheKey);

    if (cached) {
        return cached;
    }

    try {
        // Massive.com API calls
        // Using I: prefix for indices as per Massive docs
        const [spxRes, ndxRes] = await Promise.all([
            massiveClient.get('/v2/aggs/ticker/I:SPX/prev'),
            massiveClient.get('/v2/aggs/ticker/I:NDX/prev')
        ]);

        const spxResult = spxRes.data.results?.[0];
        const ndxResult = ndxRes.data.results?.[0];

        const quotes: IndexQuote[] = [];

        if (spxResult) {
            quotes.push({
                symbol: 'SPX',
                price: spxResult.c,
                change: spxResult.c - spxResult.o,
                changePercent: ((spxResult.c - spxResult.o) / spxResult.o) * 100,
            });
        }

        if (ndxResult) {
            quotes.push({
                symbol: 'NDX',
                price: ndxResult.c,
                change: ndxResult.c - ndxResult.o,
                changePercent: ((ndxResult.c - ndxResult.o) / ndxResult.o) * 100,
            });
        }

        const response: MarketIndicesResponse = {
            quotes,
            metrics: {
                vwap: spxResult?.vw || null,
            },
            source: 'massive',
        };

        await cacheSet(cacheKey, response, INDICES_CACHE_TTL);
        return response;

    } catch (error: any) {
        logger.error('Failed to fetch market indices', { error: error.message });
        throw error;
    }
}
