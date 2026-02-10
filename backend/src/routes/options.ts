import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import {
  fetchOptionsChain,
  fetchExpirationDates,
  fetchOptionsMatrix,
} from '../services/options/optionsChainFetcher';
import { calculateGEXProfile } from '../services/options/gexCalculator';
import { analyzeZeroDTE } from '../services/options/zeroDTE';
import { analyzeIVProfile } from '../services/options/ivAnalysis';
import {
  analyzePosition,
  analyzePortfolio,
  getPositionById,
  getUserPositions,
} from '../services/options/positionAnalyzer';
import { LivePositionTracker } from '../services/positions/liveTracker';
import { ExitAdvisor } from '../services/positions/exitAdvisor';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { requireTier } from '../middleware/requireTier';
import { validateParams, validateQuery, validateBody } from '../middleware/validate';
import {
  symbolParamSchema,
  optionsChainQuerySchema,
  optionsMatrixQuerySchema,
  gexQuerySchema,
  zeroDTEQuerySchema,
  ivAnalysisQuerySchema,
  analyzePositionSchema,
  positionAdviceQuerySchema,
} from '../schemas/optionsValidation';

const router = Router();

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
  '/:symbol/matrix',
  authenticateToken,
  checkQueryLimit,
  validateParams(symbolParamSchema),
  validateQuery(optionsMatrixQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const validatedQuery = (req as any).validatedQuery as {
        expirations: number;
        strikes: number;
      };

      const matrix = await fetchOptionsMatrix(symbol, {
        expirations: validatedQuery.expirations,
        strikes: validatedQuery.strikes,
      });

      return res.json(matrix);
    } catch (error: any) {
      logger.error('Error in options matrix endpoint', { error: error?.message || String(error) });
      if (error.message.includes('No options')) {
        return res.status(404).json({ error: 'No options found', message: error.message });
      }
      if (error.message.includes('No price data')) {
        return res.status(503).json({
          error: 'Data unavailable',
          message: 'Unable to fetch current price data. Please try again.',
          retryAfter: 30,
        });
      }
      if (error.message.includes('Massive.com') || error.message.includes('fetch')) {
        return res.status(503).json({
          error: 'Data provider error',
          message: 'Unable to fetch options matrix right now. Please try again in a moment.',
          retryAfter: 30,
        });
      }
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch options matrix. Please try again.',
      });
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
      const expirations = await fetchExpirationDates(symbol);
      return res.json({ symbol, expirations, count: expirations.length });
    } catch (error: any) {
      logger.error('Error in expirations endpoint', { error: error?.message || String(error) });
      if (error.message.includes('fetch')) { return res.status(503).json({ error: 'Data provider error', message: 'Unable to fetch expiration dates. Please try again.', retryAfter: 30 }); }
      return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch expirations. Please try again.' });
    }
  }
);

router.get(
  '/:symbol/0dte',
  authenticateToken,
  requireTier('pro'),
  checkQueryLimit,
  validateParams(symbolParamSchema),
  validateQuery(zeroDTEQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const validatedQuery = (req as any).validatedQuery as {
        strike?: number;
        type?: 'call' | 'put';
      };

      const analysis = await analyzeZeroDTE(symbol, {
        strike: validatedQuery?.strike,
        type: validatedQuery?.type,
      });

      return res.json(analysis);
    } catch (error: any) {
      logger.error('Error in options 0DTE endpoint', { error: error?.message || String(error) });
      if (error.message.includes('No options') || error.message.includes('No price data')) {
        return res.status(503).json({
          error: 'Data unavailable',
          message: 'Unable to run 0DTE analysis right now. Please try again shortly.',
          retryAfter: 30,
        });
      }
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to analyze 0DTE structure. Please try again.',
      });
    }
  }
);

router.get(
  '/:symbol/iv',
  authenticateToken,
  requireTier('pro'),
  checkQueryLimit,
  validateParams(symbolParamSchema),
  validateQuery(ivAnalysisQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const validatedQuery = (req as any).validatedQuery as {
        expiry?: string;
        strikeRange: number;
        maxExpirations: number;
        forceRefresh: boolean;
      };

      const profile = await analyzeIVProfile(symbol, {
        expiry: validatedQuery?.expiry,
        strikeRange: validatedQuery?.strikeRange,
        maxExpirations: validatedQuery?.maxExpirations,
        forceRefresh: validatedQuery?.forceRefresh,
      });

      return res.json(profile);
    } catch (error: any) {
      logger.error('Error in options IV endpoint', { error: error?.message || String(error) });

      if (error.message.includes('No options') || error.message.includes('No price data')) {
        return res.status(503).json({
          error: 'Data unavailable',
          message: 'Unable to analyze implied volatility right now. Please try again shortly.',
          retryAfter: 30,
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to analyze implied volatility. Please try again.',
      });
    }
  }
);

router.get(
  '/:symbol/gex',
  authenticateToken,
  requireTier('pro'),
  checkQueryLimit,
  validateParams(symbolParamSchema),
  validateQuery(gexQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol.toUpperCase();

      const validatedQuery = (req as any).validatedQuery as {
        expiry?: string;
        strikeRange: number;
        maxExpirations: number;
        forceRefresh: boolean;
      };

      const profile = await calculateGEXProfile(symbol, {
        expiry: validatedQuery?.expiry,
        strikeRange: validatedQuery?.strikeRange,
        maxExpirations: validatedQuery?.maxExpirations,
        forceRefresh: validatedQuery?.forceRefresh,
      });

      return res.json(profile);
    } catch (error: any) {
      logger.error('Error in options GEX endpoint', { error: error?.message || String(error) });

      if (error.message.includes('not supported')) {
        return res.status(404).json({ error: 'Symbol not found', message: error.message });
      }
      if (
        error.message.includes('No options')
        || error.message.includes('No price data')
        || error.message.includes('Insufficient options data')
      ) {
        return res.status(503).json({
          error: 'Data unavailable',
          message: 'Unable to calculate GEX right now. Please try again shortly.',
          retryAfter: 30,
        });
      }
      if (error.message.includes('Massive.com') || error.message.includes('fetch')) {
        return res.status(503).json({
          error: 'Data provider error',
          message: 'Unable to fetch options data. Please try again in a moment.',
          retryAfter: 30,
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to calculate gamma exposure. Please try again.',
      });
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

router.get(
  '/live',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      }

      const tracker = new LivePositionTracker();
      const positions = await tracker.recalculateForUser(userId);

      return res.json({
        positions,
        count: positions.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Error in live positions endpoint', {
        error: error?.message || String(error),
      });
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to refresh live positions. Please try again.',
      });
    }
  },
);

router.get(
  '/advice',
  authenticateToken,
  validateQuery(positionAdviceQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      }

      const validatedQuery = (req as any).validatedQuery as {
        positionId?: string;
        position_id?: string;
      };
      const positionId = validatedQuery.positionId || validatedQuery.position_id;

      const positions = positionId
        ? await (async () => {
            const one = await getPositionById(positionId, userId);
            return one ? [one] : [];
          })()
        : await getUserPositions(userId);

      if (positions.length === 0) {
        return res.json({
          advice: [],
          count: 0,
          generatedAt: new Date().toISOString(),
        });
      }

      const analyses = await Promise.all(positions.map((position) => analyzePosition(position)));
      const advisor = new ExitAdvisor();
      const advice = advisor.generateAdvice(analyses);

      return res.json({
        advice,
        count: advice.length,
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Error in position advice endpoint', {
        error: error?.message || String(error),
      });
      if (error.message.includes('fetch') || error.message.includes('Massive.com')) {
        return res.status(503).json({
          error: 'Data provider error',
          message: 'Unable to fetch latest market data for advice. Please try again shortly.',
          retryAfter: 30,
        });
      }
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to generate position advice. Please try again.',
      });
    }
  },
);

function validatePosition(position: any): boolean {
  if (!position || typeof position !== 'object') return false;
  const required = ['symbol', 'type', 'quantity', 'entryPrice', 'entryDate'];
  for (const field of required) { if (!(field in position)) return false; }
  const validTypes = ['call', 'put', 'stock'];
  if (!validTypes.includes(position.type)) return false;
  if (position.type !== 'stock' && (!position.strike || !position.expiry)) return false;
  if (typeof position.quantity !== 'number' || position.quantity === 0) return false;
  if (typeof position.entryPrice !== 'number' || position.entryPrice <= 0) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(position.entryDate)) return false;
  return true;
}

export default router;
