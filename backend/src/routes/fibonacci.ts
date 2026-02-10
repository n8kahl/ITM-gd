import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { isValidSymbol, normalizeSymbol } from '../lib/symbols';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { fibonacciBodySchema } from '../schemas/fibonacciValidation';
import { fetchDailyData, fetchIntradayData } from '../services/levels/fetcher';
import { calculateFibonacciRetracement, findClosestFibLevel } from '../services/levels/calculators/fibonacciRetracement';

const router = Router();

/**
 * POST /api/fibonacci
 * Calculate Fibonacci retracement/extension levels for a symbol.
 */
router.post(
  '/',
  authenticateToken,
  checkQueryLimit,
  validateBody(fibonacciBodySchema),
  async (req: Request, res: Response) => {
    try {
      const { symbol: rawSymbol, timeframe, lookback } = (req as any).validatedBody as {
        symbol: string;
        timeframe: 'daily' | '1h' | '15m' | '5m';
        lookback: number;
      };

      const symbol = normalizeSymbol(rawSymbol);
      if (!isValidSymbol(symbol)) {
        return res.status(400).json({
          error: 'Invalid symbol format',
          message: 'Symbol must be 1-10 chars and may include letters, numbers, dot, underscore, colon, or hyphen',
        });
      }

      const bars = timeframe === 'daily'
        ? await fetchDailyData(symbol, lookback + 10)
        : await fetchIntradayData(symbol);

      if (bars.length < 2) {
        return res.status(404).json({
          error: 'Insufficient data',
          message: `Not enough price data for ${symbol}`,
        });
      }

      const calcStartMs = Date.now();
      const fib = calculateFibonacciRetracement(symbol, bars, timeframe, lookback);
      const calcDurationMs = Date.now() - calcStartMs;
      const currentPrice = bars[bars.length - 1].c;
      const closest = findClosestFibLevel(fib, currentPrice);

      logger.info('Fibonacci levels calculated', {
        symbol,
        timeframe,
        lookback,
        direction: fib.direction,
        durationMs: calcDurationMs,
        withinTarget: calcDurationMs < 100,
      });

      return res.json({
        ...fib,
        currentPrice: Number(currentPrice.toFixed(2)),
        closestLevel: {
          name: closest.level.replace('level_', ''),
          price: closest.price,
          distance: closest.distance,
        },
        performance: {
          calculationMs: calcDurationMs,
          withinTarget: calcDurationMs < 100,
        },
      });
    } catch (error: any) {
      logger.error('Fibonacci calculation failed', {
        error: error?.message || String(error),
      });

      return res.status(500).json({
        error: 'Calculation failed',
        message: error?.message || 'Unknown error',
      });
    }
  },
);

export default router;

