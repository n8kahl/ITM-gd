import { Router, Request, Response } from 'express';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { validateParams, validateQuery } from '../middleware/validate';
import { getEarningsAnalysis, getEarningsCalendar } from '../services/earnings';
import { earningsCalendarQuerySchema, earningsSymbolParamSchema } from '../schemas/earningsValidation';
import { supabase } from '../config/database';
import { POPULAR_SYMBOLS, sanitizeSymbols } from '../lib/symbols';
import { logger } from '../lib/logger';
import { requireTier } from '../middleware/requireTier';

const router = Router();
const DEFAULT_WATCHLIST = [...POPULAR_SYMBOLS].slice(0, 6);

async function loadUserWatchlistSymbols(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('ai_coach_watchlists')
    .select('symbols, is_default, updated_at')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load user watchlist: ${error.message}`);
  }

  const watchlists = data || [];
  if (watchlists.length === 0) return DEFAULT_WATCHLIST;

  const preferred = watchlists.find((watchlist) => watchlist.is_default) || watchlists[0];
  if (!Array.isArray(preferred.symbols)) return DEFAULT_WATCHLIST;

  const symbols = sanitizeSymbols(preferred.symbols, 25);
  return symbols.length > 0 ? symbols : DEFAULT_WATCHLIST;
}

router.get(
  '/calendar',
  authenticateToken,
  checkQueryLimit,
  validateQuery(earningsCalendarQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const validated = (req as any).validatedQuery as {
        watchlist: string[];
        days: number;
      };

      let watchlist = sanitizeSymbols(validated.watchlist || [], 25);
      if (watchlist.length === 0 && req.user?.id) {
        watchlist = await loadUserWatchlistSymbols(req.user.id);
      }
      if (watchlist.length === 0) {
        watchlist = DEFAULT_WATCHLIST;
      }

      const events = await getEarningsCalendar(watchlist, validated.days);

      return res.json({
        watchlist,
        daysAhead: validated.days,
        count: events.length,
        events,
      });
    } catch (error: any) {
      logger.error('Error in earnings calendar endpoint', {
        error: error?.message || String(error),
      });

      if (String(error?.message || '').includes('Massive.com')) {
        return res.status(503).json({
          error: 'Data provider error',
          message: 'Unable to fetch earnings calendar right now. Please retry shortly.',
          retryAfter: 30,
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch earnings calendar.',
      });
    }
  },
);

router.get(
  '/:symbol/analysis',
  authenticateToken,
  requireTier('pro'),
  checkQueryLimit,
  validateParams(earningsSymbolParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { symbol } = (req as any).validatedParams as { symbol: string };
      const analysis = await getEarningsAnalysis(symbol);
      return res.json(analysis);
    } catch (error: any) {
      logger.error('Error in earnings analysis endpoint', {
        error: error?.message || String(error),
      });

      if (String(error?.message || '').includes('No options')) {
        return res.status(503).json({
          error: 'Data unavailable',
          message: 'Unable to compute earnings analysis right now. Please retry shortly.',
          retryAfter: 30,
        });
      }

      if (String(error?.message || '').includes('Invalid symbol')) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid symbol format.',
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch earnings analysis.',
      });
    }
  },
);

export default router;
