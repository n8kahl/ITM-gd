import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import {
  fetchOptionsChain,
  fetchExpirationDates
} from '../services/options/optionsChainFetcher';
import {
  analyzePosition,
  analyzePortfolio
} from '../services/options/positionAnalyzer';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { validateParams, validateQuery, validateBody } from '../middleware/validate';
import {
  symbolParamSchema,
  optionsChainQuerySchema,
  analyzePositionSchema,
} from '../schemas/optionsValidation';

const router = Router();

const SUPPORTED_SYMBOLS = ['SPX', 'NDX'];

router.get(
  '/:symbol/chain',
  authenticateToken,
  checkQueryLimit,
  validateParams(symbolParamSchema),
  validateQuery(optionsChainQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const expiry = req.query.expiry as string | undefined;
      const strikeRange = req.query.strikeRange ? parseInt(req.query.strikeRange as string) : 10;

      if (!SUPPORTED_SYMBOLS.includes(symbol)) {
        return res.status(404).json({ error: 'Symbol not found', message: `Symbol '${symbol}' is not supported. Supported symbols: ${SUPPORTED_SYMBOLS.join(', ')}` });
      }

      const chain = await fetchOptionsChain(symbol, expiry, strikeRange);
      return res.json(chain);
    } catch (error: any) {
      logger.error('Error in options chain endpoint', { error: error?.message || String(error) });
      if (error.message.includes('No options')) { return res.status(404).json({ error: 'No options found', message: error.message }); }
      if (error.message.includes('No price data')) { return res.status(503).json({ error: 'Data unavailable', message: 'Unable to fetch current price data. Please try again.', retryAfter: 30 }); }
      if (error.message.includes('Massive.com') || error.message.includes('fetch')) { return res.status(503).json({ error: 'Data provider error', message: 'Unable to fetch options data. Please try again in a moment.', retryAfter: 30 }); }
      return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch options chain. Please try again.' });
    }
  }
);

router.get(
  '/:symbol/expirations',
  authenticateToken,
  checkQueryLimit,
  validateParams(symbolParamSchema),
  async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      if (!SUPPORTED_SYMBOLS.includes(symbol)) {
        return res.status(404).json({ error: 'Symbol not found', message: `Symbol '${symbol}' is not supported. Supported symbols: ${SUPPORTED_SYMBOLS.join(', ')}` });
      }
      const expirations = await fetchExpirationDates(symbol);
      return res.json({ symbol, expirations, count: expirations.length });
    } catch (error: any) {
      logger.error('Error in expirations endpoint', { error: error?.message || String(error) });
      if (error.message.includes('fetch')) { return res.status(503).json({ error: 'Data provider error', message: 'Unable to fetch expiration dates. Please try again.', retryAfter: 30 }); }
      return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch expirations. Please try again.' });
    }
  }
);

router.post(
  '/analyze',
  authenticateToken,
  checkQueryLimit,
  validateBody(analyzePositionSchema),
  async (req: Request, res: Response) => {
    try {
      const { position, positions } = req.body;
      if (position) {
        if (!validatePosition(position)) { return res.status(400).json({ error: 'Invalid position', message: 'Position is missing required fields' }); }
        const analysis = await analyzePosition(position);
        return res.json(analysis);
      }
      if (positions) {
        const analysis = await analyzePortfolio(positions);
        return res.json(analysis);
      }
      return res.status(400).json({ error: 'Invalid request', message: 'Must provide either "position" or "positions" in request body' });
    } catch (error: any) {
      logger.error('Error in position analysis endpoint', { error: error?.message || String(error) });
      if (error.message.includes('fetch') || error.message.includes('Massive.com')) { return res.status(503).json({ error: 'Data provider error', message: 'Unable to fetch current market data. Analysis may be incomplete.', retryAfter: 30 }); }
      return res.status(500).json({ error: 'Internal server error', message: 'Failed to analyze position(s). Please try again.' });
    }
  }
);

function validatePosition(position: any): boolean {
  if (!position || typeof position !== 'object') return false;
  const required = ['symbol', 'type', 'quantity', 'entryPrice', 'entryDate'];
  for (const field of required) { if (!(field in position)) return false; }
  if (!SUPPORTED_SYMBOLS.includes(position.symbol.toUpperCase())) return false;
  const validTypes = ['call', 'put', 'call_spread', 'put_spread', 'iron_condor', 'stock'];
  if (!validTypes.includes(position.type)) return false;
  if (position.type !== 'stock' && (!position.strike || !position.expiry)) return false;
  if (typeof position.quantity !== 'number' || position.quantity === 0) return false;
  if (typeof position.entryPrice !== 'number' || position.entryPrice <= 0) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(position.entryDate)) return false;
  return true;
}

export default router;
