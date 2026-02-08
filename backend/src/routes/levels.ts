import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { calculateLevels } from '../services/levels';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { validateParams, validateQuery } from '../middleware/validate';
import { levelsParamSchema, levelsQuerySchema } from '../schemas/levelsValidation';

const router = Router();

// Supported symbols
const SUPPORTED_SYMBOLS = ['SPX', 'NDX'];

/**
 * GET /api/levels/:symbol
 *
 * Get key support/resistance levels for a symbol
 *
 * Query params:
 * - timeframe: 'intraday' | 'daily' | 'weekly' (default: 'intraday')
 */
router.get(
  '/:symbol',
  authenticateToken,
  checkQueryLimit,
  validateParams(levelsParamSchema),
  validateQuery(levelsQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const timeframe = (req.query.timeframe as string) || 'intraday';

      // Validate symbol
      if (!SUPPORTED_SYMBOLS.includes(symbol)) {
        return res.status(404).json({
          error: 'Symbol not found',
          message: `Symbol '${symbol}' is not supported. Supported symbols: ${SUPPORTED_SYMBOLS.join(', ')}`
        });
      }


      // Calculate levels
      const levels = await calculateLevels(symbol, timeframe);

      res.json(levels);
    } catch (error: any) {
      logger.error('Error in levels endpoint', { error: error?.message || String(error) });

      // Handle specific error types
      if (error.message.includes('Missing') || error.message.includes('environment')) {
        return res.status(500).json({
          error: 'Configuration error',
          message: 'Server is not properly configured. Please contact support.'
        });
      }

      if (error.message.includes('Massive.com') || error.message.includes('fetch')) {
        return res.status(503).json({
          error: 'Data provider error',
          message: 'Unable to fetch data from Massive.com. Please try again in a moment.',
          retryAfter: 30
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to calculate levels. Please try again.'
      });
    }
  }
);

export default router;
