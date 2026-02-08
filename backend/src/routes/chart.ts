import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { getAggregates, MassiveAggregate } from '../config/massive';
import { authenticateToken } from '../middleware/auth';
import { validateParams, validateQuery } from '../middleware/validate';
import { cacheGet, cacheSet } from '../config/redis';
import { getChartData } from '../services/charts/chartDataService';
import { chartParamSchema, chartQuerySchema } from '../schemas/chartValidation';

const router = Router();

const SUPPORTED_SYMBOLS = ['SPX', 'NDX'];

type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W' | '1M';

interface TimeframeConfig {
  multiplier: number;
  timespan: 'minute' | 'hour' | 'day';
  daysBack: number;
  cacheTTL: number;
}

const TIMEFRAME_CONFIG: Record<string, TimeframeConfig> = {
  '1m':  { multiplier: 1,  timespan: 'minute', daysBack: 1,   cacheTTL: 60 },
  '5m':  { multiplier: 5,  timespan: 'minute', daysBack: 5,   cacheTTL: 60 },
  '15m': { multiplier: 15, timespan: 'minute', daysBack: 10,  cacheTTL: 120 },
  '1h':  { multiplier: 1,  timespan: 'hour',   daysBack: 30,  cacheTTL: 300 },
  '4h':  { multiplier: 4,  timespan: 'hour',   daysBack: 60,  cacheTTL: 300 },
  '1D':  { multiplier: 1,  timespan: 'day',    daysBack: 180, cacheTTL: 600 },
};

function normalizeSymbol(symbol: string): string {
  if (symbol.startsWith('I:')) return symbol;
  if (symbol === 'SPX' || symbol === 'NDX') return `I:${symbol}`;
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
      const symbol = req.params.symbol.toUpperCase();
      const timeframe = (req.query.timeframe as ChartTimeframe) || '1D';

      // Validate symbol
      if (!SUPPORTED_SYMBOLS.includes(symbol)) {
        return res.status(404).json({
          error: 'Symbol not found',
          message: `Supported symbols: ${SUPPORTED_SYMBOLS.join(', ')}`
        });
      }

      // Handle weekly/monthly via chart data service
      if (timeframe === '1W' || timeframe === '1M') {
        const tf = timeframe === '1W' ? 'weekly' : 'monthly';
        const bars = parseInt(req.query.bars as string) || (tf === 'weekly' ? 260 : 60);
        const chartData = await getChartData(symbol, tf, bars);

        return res.json({
          symbol,
          timeframe,
          bars: chartData.candles,
          indicators: chartData.indicators,
          count: chartData.count,
          timestamp: chartData.timestamp,
          cached: chartData.cached,
        });
      }


      const config = TIMEFRAME_CONFIG[timeframe];
      const ticker = normalizeSymbol(symbol);
      const { from, to } = getDateRange(config.daysBack);

      // Check cache
      const cacheKey = `chart:${symbol}:${timeframe}`;
      const cached = await cacheGet<{ symbol: string; timeframe: string; bars: any[]; count: number; timestamp: string }>(cacheKey);
      if (cached) {
        return res.json({ ...cached, cached: true });
      }

      // Fetch from Massive.com
      const response = await getAggregates(ticker, config.multiplier, config.timespan, from, to);

      const bars = (response.results || []).map((bar: MassiveAggregate) => ({
        time: Math.floor(bar.t / 1000), // Convert ms to seconds for lightweight-charts
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      }));

      const result = {
        symbol,
        timeframe,
        bars,
        count: bars.length,
        timestamp: new Date().toISOString(),
        cached: false,
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
