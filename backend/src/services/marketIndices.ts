
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
        vixLevel: number | null;
        vixChange: number | null;
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
        const [spxRes, ndxRes, vixRes, dxyRes, tnxRes] = await Promise.all([
            massiveClient.get('/v2/aggs/ticker/I:SPX/prev'),
            massiveClient.get('/v2/aggs/ticker/I:NDX/prev'),
            massiveClient.get('/v2/aggs/ticker/I:VIX/prev').catch(() => null),
            massiveClient.get('/v2/aggs/ticker/I:DXY/prev').catch(() => null),
            massiveClient.get('/v2/aggs/ticker/I:TNX/prev').catch(() => null),
        ]);

        const spxResult = spxRes.data.results?.[0];
        const ndxResult = ndxRes.data.results?.[0];
        const vixResult = vixRes?.data?.results?.[0];
        const dxyResult = dxyRes?.data?.results?.[0];
        const tnxResult = tnxRes?.data?.results?.[0];

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

        if (vixResult) {
            quotes.push({
                symbol: 'VIX',
                price: vixResult.c,
                change: vixResult.c - vixResult.o,
                changePercent: ((vixResult.c - vixResult.o) / vixResult.o) * 100,
            });
        }

        if (dxyResult) {
            quotes.push({
                symbol: 'DXY',
                price: dxyResult.c,
                change: dxyResult.c - dxyResult.o,
                changePercent: ((dxyResult.c - dxyResult.o) / dxyResult.o) * 100,
            });
        }

        if (tnxResult) {
            quotes.push({
                symbol: 'TNX',
                price: tnxResult.c,
                change: tnxResult.c - tnxResult.o,
                changePercent: ((tnxResult.c - tnxResult.o) / tnxResult.o) * 100,
            });
        }

        const response: MarketIndicesResponse = {
            quotes,
            metrics: {
                vwap: spxResult?.vw || null,
                vixLevel: vixResult?.c || null,
                vixChange: vixResult?.o ? ((vixResult.c - vixResult.o) / vixResult.o) * 100 : null,
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
