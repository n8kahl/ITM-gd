import { Router, Request, Response } from 'express';
import {
  fetchOptionsChain,
  fetchExpirationDates
} from '../services/options/optionsChainFetcher';
import {
  analyzePosition,
  analyzePortfolio
} from '../services/options/positionAnalyzer';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { Position } from '../services/options/types';

const router = Router();

// Supported symbols
const SUPPORTED_SYMBOLS = ['SPX', 'NDX'];

/**
 * GET /api/options/:symbol/chain
 *
 * Get options chain for a symbol
 *
 * Query params:
 * - expiry: Specific expiry date (YYYY-MM-DD) or omit for nearest
 * - strikeRange: Number of strikes above/below current price (default: 10)
 *
 * Example:
 * GET /api/options/SPX/chain?expiry=2026-02-28&strikeRange=15
 */
router.get(
  '/:symbol/chain',
  authenticateToken,
  checkQueryLimit,
  async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const expiry = req.query.expiry as string | undefined;
      const strikeRange = req.query.strikeRange
        ? parseInt(req.query.strikeRange as string)
        : 10;

      // Validate symbol
      if (!SUPPORTED_SYMBOLS.includes(symbol)) {
        return res.status(404).json({
          error: 'Symbol not found',
          message: `Symbol '${symbol}' is not supported. Supported symbols: ${SUPPORTED_SYMBOLS.join(', ')}`
        });
      }

      // Validate strike range
      if (isNaN(strikeRange) || strikeRange < 1 || strikeRange > 50) {
        return res.status(400).json({
          error: 'Invalid strike range',
          message: 'Strike range must be between 1 and 50'
        });
      }

      // Validate expiry format if provided
      if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
        return res.status(400).json({
          error: 'Invalid expiry format',
          message: 'Expiry must be in YYYY-MM-DD format'
        });
      }

      // Fetch options chain
      const chain = await fetchOptionsChain(symbol, expiry, strikeRange);

      res.json(chain);
    } catch (error: any) {
      console.error('Error in options chain endpoint:', error);

      // Handle specific error types
      if (error.message.includes('No options')) {
        return res.status(404).json({
          error: 'No options found',
          message: error.message
        });
      }

      if (error.message.includes('No price data')) {
        return res.status(503).json({
          error: 'Data unavailable',
          message: 'Unable to fetch current price data. Please try again.',
          retryAfter: 30
        });
      }

      if (error.message.includes('Polygon.io') || error.message.includes('fetch')) {
        return res.status(503).json({
          error: 'Data provider error',
          message: 'Unable to fetch options data. Please try again in a moment.',
          retryAfter: 30
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch options chain. Please try again.'
      });
    }
  }
);

/**
 * GET /api/options/:symbol/expirations
 *
 * Get available expiration dates for a symbol
 *
 * Example:
 * GET /api/options/SPX/expirations
 */
router.get(
  '/:symbol/expirations',
  authenticateToken,
  checkQueryLimit,
  async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol.toUpperCase();

      // Validate symbol
      if (!SUPPORTED_SYMBOLS.includes(symbol)) {
        return res.status(404).json({
          error: 'Symbol not found',
          message: `Symbol '${symbol}' is not supported. Supported symbols: ${SUPPORTED_SYMBOLS.join(', ')}`
        });
      }

      // Fetch expirations
      const expirations = await fetchExpirationDates(symbol);

      res.json({
        symbol,
        expirations,
        count: expirations.length
      });
    } catch (error: any) {
      console.error('Error in expirations endpoint:', error);

      if (error.message.includes('fetch')) {
        return res.status(503).json({
          error: 'Data provider error',
          message: 'Unable to fetch expiration dates. Please try again.',
          retryAfter: 30
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch expirations. Please try again.'
      });
    }
  }
);

/**
 * POST /api/positions/analyze
 *
 * Analyze a position or portfolio
 *
 * Request body (single position):
 * {
 *   "position": {
 *     "symbol": "SPX",
 *     "type": "call",
 *     "strike": 5900,
 *     "expiry": "2026-02-28",
 *     "quantity": 2,
 *     "entryPrice": 25.50,
 *     "entryDate": "2026-02-01"
 *   }
 * }
 *
 * Request body (portfolio):
 * {
 *   "positions": [
 *     { ... },
 *     { ... }
 *   ]
 * }
 */
router.post(
  '/analyze',
  authenticateToken,
  checkQueryLimit,
  async (req: Request, res: Response) => {
    try {
      const { position, positions } = req.body;

      // Validate request
      if (!position && !positions) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Must provide either "position" or "positions" in request body'
        });
      }

      if (position && positions) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Cannot provide both "position" and "positions". Choose one.'
        });
      }

      // Analyze single position
      if (position) {
        // Validate position structure
        if (!validatePosition(position)) {
          return res.status(400).json({
            error: 'Invalid position',
            message: 'Position is missing required fields'
          });
        }

        const analysis = await analyzePosition(position);
        return res.json(analysis);
      }

      // Analyze portfolio
      if (positions) {
        // Validate positions array
        if (!Array.isArray(positions) || positions.length === 0) {
          return res.status(400).json({
            error: 'Invalid positions',
            message: 'Positions must be a non-empty array'
          });
        }

        // Validate each position
        for (let i = 0; i < positions.length; i++) {
          if (!validatePosition(positions[i])) {
            return res.status(400).json({
              error: 'Invalid position',
              message: `Position at index ${i} is missing required fields`
            });
          }
        }

        const analysis = await analyzePortfolio(positions);
        return res.json(analysis);
      }
    } catch (error: any) {
      console.error('Error in position analysis endpoint:', error);

      if (error.message.includes('fetch') || error.message.includes('Polygon.io')) {
        return res.status(503).json({
          error: 'Data provider error',
          message: 'Unable to fetch current market data. Analysis may be incomplete.',
          retryAfter: 30
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to analyze position(s). Please try again.'
      });
    }
  }
);

/**
 * Validate position structure
 */
function validatePosition(position: any): boolean {
  if (!position || typeof position !== 'object') {
    return false;
  }

  const required = ['symbol', 'type', 'quantity', 'entryPrice', 'entryDate'];

  for (const field of required) {
    if (!(field in position)) {
      return false;
    }
  }

  // Validate symbol
  if (!SUPPORTED_SYMBOLS.includes(position.symbol.toUpperCase())) {
    return false;
  }

  // Validate type
  const validTypes = ['call', 'put', 'call_spread', 'put_spread', 'iron_condor', 'stock'];
  if (!validTypes.includes(position.type)) {
    return false;
  }

  // Options must have strike and expiry
  if (position.type !== 'stock') {
    if (!position.strike || !position.expiry) {
      return false;
    }
  }

  // Validate quantity (must be non-zero)
  if (typeof position.quantity !== 'number' || position.quantity === 0) {
    return false;
  }

  // Validate entry price (must be positive)
  if (typeof position.entryPrice !== 'number' || position.entryPrice <= 0) {
    return false;
  }

  // Validate entry date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(position.entryDate)) {
    return false;
  }

  return true;
}

export default router;
