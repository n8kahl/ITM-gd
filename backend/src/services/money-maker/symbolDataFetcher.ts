import { massiveClient } from '../../config/massive'

export interface SymbolDataFetcherOptions {
    symbol: string
    timeframe: '1Min' | '2Min' | '5Min' | '10Min' | '1H' | '1D'
    limit?: number
}

/**
 * Fetches historical/intraday bars for a given symbol from Massive.com.
 * This function integrates with the data provider defined in `config/massive.ts`.
 */
export async function fetchSymbolBars(options: SymbolDataFetcherOptions): Promise<any[]> {
    const { symbol, timeframe, limit = 500 } = options

    try {
        // We use the existing getAggregates helper to hit massive.com in a unified way if possible,
        // or just use massiveClient if the exact endpoint differs.
        // Spec indicates hitting bars endpoint. `massiveClient` handles the base URL and Auth headers via interceptor.

        // Convert timeframe to multiplier/timespan
        let multiplier = 1
        let timespan = 'minute'

        switch (timeframe) {
            case '1Min': multiplier = 1; timespan = 'minute'; break;
            case '2Min': multiplier = 2; timespan = 'minute'; break;
            case '5Min': multiplier = 5; timespan = 'minute'; break;
            case '10Min': multiplier = 10; timespan = 'minute'; break;
            case '1H': multiplier = 1; timespan = 'hour'; break;
            case '1D': multiplier = 1; timespan = 'day'; break;
        }

        // Defaulting to hitting the aggregates endpoint over a generous recent window since date isn't explicitly passed
        // We fetch a 15-day range to guarantee enough bars for a 200 SMA on 15m/1H charts
        const toDate = new Date()
        const fromDate = new Date(toDate.getTime() - 15 * 24 * 60 * 60 * 1000)

        const fromStr = fromDate.toISOString().split('T')[0]
        const toStr = toDate.toISOString().split('T')[0]

        // E.g. /v2/aggs/ticker/TSLA/range/5/minute/2026-02-23/2026-03-10
        // Request the newest bars first so `limit` captures recent market state,
        // then sort ascending locally for indicator computations.
        const response = await massiveClient.get(
            `/v2/aggs/ticker/${symbol.toUpperCase()}/range/${multiplier}/${timespan}/${fromStr}/${toStr}`,
            {
                params: {
                    adjusted: true,
                    sort: 'desc',
                    limit
                }
            }
        )

        if (!response.data || !Array.isArray(response.data.results)) {
            console.warn(`[SymbolDataFetcher] No bars returned for ${symbol} at ${timeframe}`)
            return []
        }

        // Map Massive's aggregate format (v2/aggs) to our internal CandleBar format
        // v2/aggs format: o, h, l, c, v, t
        const bars: Array<{
            timestamp: number
            open: number
            high: number
            low: number
            close: number
            volume: number
        }> = response.data.results.map((b: any) => ({
                timestamp: b.t,
                open: Number(b.o),
                high: Number(b.h),
                low: Number(b.l),
                close: Number(b.c),
                volume: Number(b.v)
            }))

        return bars.sort((left, right) => left.timestamp - right.timestamp)
    } catch (error) {
        console.error(`[SymbolDataFetcher] Failed to fetch bars for ${symbol}:`, error)
        return []
    }
}

/**
 * Convenience method to fetch multiple symbols and multiple timeframes in parallel.
 * This represents Slice 2.2 of the execution spec.
 */
export async function fetchAllSymbolData(symbols: string[]) {
    // We need 5-min, 10-min, 1-hour, and 1-day (for previous day range) for the strategy engine.
    const timeframes: SymbolDataFetcherOptions['timeframe'][] = ['2Min', '5Min', '10Min', '1H', '1D']

    const results: Record<string, Record<string, any[]>> = {}

    for (const symbol of symbols) {
        results[symbol] = {}
        const fetchPromises = timeframes.map(async (tf) => {
            // Limit to enough bars for 200 SMA (200 bars + buffer)
            const bars = await fetchSymbolBars({ symbol, timeframe: tf, limit: 250 })
            results[symbol][tf] = bars
        })

        await Promise.all(fetchPromises)
    }

    return results
}
