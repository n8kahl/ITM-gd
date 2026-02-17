import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import {
  getAggregates,
  getEMAIndicator,
  getRSIIndicator,
  getMACDIndicator,
  MassiveAggregate,
  MassiveIndicatorTimespan,
  MassiveMACDIndicatorValue,
  MassiveSingleIndicatorValue,
} from '../config/massive';
import { authenticateToken } from '../middleware/auth';
import { validateParams, validateQuery } from '../middleware/validate';
import { cacheGet, cacheSet } from '../config/redis';
import { getChartData } from '../services/charts/chartDataService';
import { getRecentTicks } from '../services/tickCache';
import { chartParamSchema, chartQuerySchema } from '../schemas/chartValidation';

const router = Router();

// Known index symbols that need the I: prefix for Massive.com aggregates
const INDEX_SYMBOLS = new Set(['SPX', 'NDX', 'DJI', 'VIX', 'RUT', 'COMP', 'DJIA']);

type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W' | '1M';

interface TimeframeConfig {
  multiplier: number;
  timespan: 'minute' | 'hour' | 'day';
  daysBack: number;
  cacheTTL: number;
}

interface DateRange {
  from: string;
  to: string;
}

interface IndicatorPoint {
  time: number;
  value: number;
}

interface MACDPoint extends IndicatorPoint {
  signal: number;
  histogram: number;
}

interface ProviderIndicatorsPayload {
  source: 'massive';
  timespan: MassiveIndicatorTimespan;
  ema8: IndicatorPoint[];
  ema21: IndicatorPoint[];
  rsi14: IndicatorPoint[];
  macd: MACDPoint[];
}

function toSafeNumber(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const TIMEFRAME_CONFIG: Record<string, TimeframeConfig> = {
  '1m':  { multiplier: 1,  timespan: 'minute', daysBack: 1,   cacheTTL: 60 },
  '5m':  { multiplier: 5,  timespan: 'minute', daysBack: 5,   cacheTTL: 60 },
  '15m': { multiplier: 15, timespan: 'minute', daysBack: 10,  cacheTTL: 120 },
  '1h':  { multiplier: 1,  timespan: 'hour',   daysBack: 30,  cacheTTL: 300 },
  '4h':  { multiplier: 4,  timespan: 'hour',   daysBack: 60,  cacheTTL: 300 },
  '1D':  { multiplier: 1,  timespan: 'day',    daysBack: 180, cacheTTL: 600 },
};

const TIMEFRAME_TO_INDICATOR_TIMESPAN: Record<ChartTimeframe, MassiveIndicatorTimespan> = {
  '1m': 'minute',
  '5m': 'minute',
  '15m': 'minute',
  '1h': 'hour',
  '4h': 'hour',
  '1D': 'day',
  '1W': 'week',
  '1M': 'month',
};

function normalizeSymbol(symbol: string): string {
  if (symbol.startsWith('I:')) return symbol;
  if (INDEX_SYMBOLS.has(symbol)) return `I:${symbol}`;
  return symbol;
}

function getDateRange(daysBack: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function getFallbackDateRangeForEmptyBars(timeframe: ChartTimeframe): DateRange | null {
  // Intraday windows can be empty around weekends/holidays/pre-market.
  // Broaden range only when initial fetch returns zero bars.
  if (timeframe === '1m') return getDateRange(21);
  if (timeframe === '5m') return getDateRange(10);
  if (timeframe === '15m') return getDateRange(14);
  return null;
}

function mapAggregatesToBars(aggregates: MassiveAggregate[]) {
  return (aggregates || [])
    .map((bar: MassiveAggregate) => ({
      time: Math.floor(toSafeNumber(bar.t) / 1000), // Convert ms to seconds for lightweight-charts
      open: toSafeNumber(bar.o),
      high: toSafeNumber(bar.h),
      low: toSafeNumber(bar.l),
      close: toSafeNumber(bar.c),
      // Index feeds (SPX/NDX) can omit volume; normalize to zero for chart compatibility.
      volume: toSafeNumber(bar.v),
    }))
    .filter((bar) => bar.time > 0 && bar.open > 0 && bar.high > 0 && bar.low > 0 && bar.close > 0);
}

function mapTicksToMinuteBars(ticks: Array<{ timestamp: number; price: number; size: number }>) {
  if (!Array.isArray(ticks) || ticks.length === 0) return [];

  const buckets = new Map<number, { time: number; open: number; high: number; low: number; close: number; volume: number }>();
  const sortedTicks = [...ticks]
    .filter((tick) => Number.isFinite(tick.timestamp) && Number.isFinite(tick.price) && tick.price > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  for (const tick of sortedTicks) {
    const bucketStartMs = Math.floor(tick.timestamp / 60_000) * 60_000;
    const existing = buckets.get(bucketStartMs);
    if (!existing) {
      buckets.set(bucketStartMs, {
        time: Math.floor(bucketStartMs / 1000),
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: Math.max(0, Math.floor(tick.size || 0)),
      });
      continue;
    }

    existing.high = Math.max(existing.high, tick.price);
    existing.low = Math.min(existing.low, tick.price);
    existing.close = tick.price;
    existing.volume += Math.max(0, Math.floor(tick.size || 0));
  }

  return Array.from(buckets.values())
    .filter((bar) => bar.time > 0 && bar.open > 0 && bar.high > 0 && bar.low > 0 && bar.close > 0)
    .sort((a, b) => a.time - b.time)
    .slice(-390);
}

function toIndicatorPoints(values: MassiveSingleIndicatorValue[]): IndicatorPoint[] {
  return values
    .map((point) => ({
      time: Math.floor(toSafeNumber(point.timestamp) / 1000),
      value: toSafeNumber(point.value),
    }))
    .filter((point) => point.time > 0 && Number.isFinite(point.value));
}

function toMACDPoints(values: MassiveMACDIndicatorValue[]): MACDPoint[] {
  return values
    .map((point) => ({
      time: Math.floor(toSafeNumber(point.timestamp) / 1000),
      value: toSafeNumber(point.value),
      signal: toSafeNumber(point.signal),
      histogram: toSafeNumber(point.histogram),
    }))
    .filter((point) => point.time > 0 && Number.isFinite(point.value));
}

async function fetchSafeIndicator<T>(
  label: string,
  request: () => Promise<T[]>,
): Promise<T[]> {
  try {
    return await request();
  } catch (error: any) {
    logger.warn(`Indicator request failed (${label})`, { error: error?.message || String(error) });
    return [];
  }
}

async function fetchProviderIndicators(
  ticker: string,
  timeframe: ChartTimeframe,
  chartBarCount: number,
  range?: {
    from?: string;
    to?: string;
  },
): Promise<ProviderIndicatorsPayload> {
  const timespan = TIMEFRAME_TO_INDICATOR_TIMESPAN[timeframe];
  const limit = Math.min(Math.max(chartBarCount + 60, 120), 5000);
  const indicatorRange = range?.from || range?.to
    ? {
      timestampGte: range?.from,
      timestampLte: range?.to,
    }
    : {};

  const [ema8Raw, ema21Raw, rsi14Raw, macdRaw] = await Promise.all([
    fetchSafeIndicator('EMA(8)', () => getEMAIndicator(ticker, { timespan, window: 8, limit, order: 'asc', ...indicatorRange })),
    fetchSafeIndicator('EMA(21)', () => getEMAIndicator(ticker, { timespan, window: 21, limit, order: 'asc', ...indicatorRange })),
    fetchSafeIndicator('RSI(14)', () => getRSIIndicator(ticker, { timespan, window: 14, limit, order: 'asc', ...indicatorRange })),
    fetchSafeIndicator('MACD(12,26,9)', () => getMACDIndicator(ticker, {
      timespan,
      shortWindow: 12,
      longWindow: 26,
      signalWindow: 9,
      limit,
      order: 'asc',
      ...indicatorRange,
    })),
  ]);

  return {
    source: 'massive',
    timespan,
    ema8: toIndicatorPoints(ema8Raw),
    ema21: toIndicatorPoints(ema21Raw),
    rsi14: toIndicatorPoints(rsi14Raw),
    macd: toMACDPoints(macdRaw),
  };
}

/**
 * GET /api/chart/:symbol
 *
 * Get OHLCV candlestick data for charting.
 *
 * Query params:
 * - timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1D' (default: '1D')
 */
router.get(
  '/:symbol',
  authenticateToken,
  validateParams(chartParamSchema),
  validateQuery(chartQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const validatedParams = ((req as any).validatedParams || {}) as { symbol?: string };
      const symbol = (validatedParams.symbol || req.params.symbol || '').toUpperCase();
      const validatedQuery = ((req as any).validatedQuery || {}) as {
        timeframe?: ChartTimeframe;
        bars?: number;
        includeIndicators?: boolean;
      };
      const timeframe = validatedQuery.timeframe || '1D';
      const includeIndicators = validatedQuery.includeIndicators === true;

      // Handle weekly/monthly via chart data service
      if (timeframe === '1W' || timeframe === '1M') {
        const tf = timeframe === '1W' ? 'weekly' : 'monthly';
        const bars = validatedQuery.bars || (tf === 'weekly' ? 260 : 60);
        const chartData = await getChartData(symbol, tf, bars);
        const ticker = normalizeSymbol(symbol);
        const providerIndicators = includeIndicators
          ? await fetchProviderIndicators(ticker, timeframe, chartData.candles.length, {
            from: chartData.candles.length > 0
              ? new Date(chartData.candles[0].time * 1000).toISOString().split('T')[0]
              : undefined,
            to: chartData.candles.length > 0
              ? new Date(chartData.candles[chartData.candles.length - 1].time * 1000).toISOString().split('T')[0]
              : undefined,
          })
          : undefined;

        return res.json({
          symbol,
          timeframe,
          bars: chartData.candles,
          indicators: chartData.indicators,
          count: chartData.count,
          timestamp: chartData.timestamp,
          cached: chartData.cached,
          providerIndicators,
        });
      }


      const config = TIMEFRAME_CONFIG[timeframe];
      const ticker = normalizeSymbol(symbol);
      const { from, to } = getDateRange(config.daysBack);

      // Check cache
      const cacheKey = `chart:${symbol}:${timeframe}:indicators:${includeIndicators ? '1' : '0'}`;
      const cached = await cacheGet<{
        symbol: string;
        timeframe: string;
        bars: any[];
        count: number;
        timestamp: string;
        providerIndicators?: ProviderIndicatorsPayload;
      }>(cacheKey);
      if (cached) {
        return res.json({ ...cached, cached: true });
      }

      // Fetch from Massive.com
      const response = await getAggregates(ticker, config.multiplier, config.timespan, from, to);
      let bars = mapAggregatesToBars(response.results || []);

      if (bars.length === 0) {
        const fallbackRange = getFallbackDateRangeForEmptyBars(timeframe);
        if (fallbackRange) {
          const fallbackResponse = await getAggregates(
            ticker,
            config.multiplier,
            config.timespan,
            fallbackRange.from,
            fallbackRange.to,
          );
          bars = mapAggregatesToBars(fallbackResponse.results || []);
        }
      }

      // Last-resort fallback for 1m: synthesize candles from the live tick cache.
      // This keeps the chart usable when provider minute aggregates are temporarily empty.
      if (timeframe === '1m' && bars.length === 0) {
        const ticks = getRecentTicks(symbol, 6_000);
        bars = mapTicksToMinuteBars(ticks);
        if (bars.length > 0) {
          logger.info('Chart route served 1m bars from tick-cache fallback', {
            symbol,
            bars: bars.length,
            ticks: ticks.length,
          });
        }
      }

      if (timeframe === '1m' && bars.length === 0) {
        logger.warn('Chart route has no 1m bars after provider and tick-cache fallback', {
          symbol,
          timeframe,
        });
      }

      const providerIndicators = includeIndicators
        ? await fetchProviderIndicators(ticker, timeframe, bars.length, { from, to })
        : undefined;

      const result = {
        symbol,
        timeframe,
        bars,
        count: bars.length,
        timestamp: new Date().toISOString(),
        cached: false,
        providerIndicators,
      };

      // Cache result
      await cacheSet(cacheKey, result, config.cacheTTL);

      return res.json(result);
    } catch (error: any) {
      logger.error('Chart data error', { error: error?.message || String(error) });

      if (error.message?.includes('Massive') || error.message?.includes('fetch')) {
        return res.status(503).json({
          error: 'Data provider error',
          message: 'Unable to fetch chart data from Massive.com. Please try again.',
          retryAfter: 30
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch chart data.'
      });
    }
  }
);

export default router;
