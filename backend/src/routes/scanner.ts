import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { scanOpportunities } from '../services/scanner';
import { supabase } from '../config/database';
import { POPULAR_SYMBOLS, sanitizeSymbols } from '../lib/symbols';

const router = Router();
const DEFAULT_SYMBOLS = [...POPULAR_SYMBOLS];

async function loadUserWatchlistSymbols(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('ai_coach_watchlists')
    .select('symbols, is_default, updated_at')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load watchlist symbols: ${error.message}`);
  }

  const watchlists = data || [];
  if (watchlists.length === 0) return DEFAULT_SYMBOLS;

  const defaultWatchlist = watchlists.find((watchlist) => watchlist.is_default) || watchlists[0];
  if (!Array.isArray(defaultWatchlist.symbols)) return DEFAULT_SYMBOLS;

  const symbols = sanitizeSymbols(defaultWatchlist.symbols);
  return symbols.length > 0 ? symbols : DEFAULT_SYMBOLS;
}

/**
 * GET /api/scanner/scan
 *
 * Direct scanning endpoint — runs technical + options scanning
 * without going through the AI chat layer.
 */
router.get(
  '/scan',
  authenticateToken,
  checkQueryLimit,
  async (req: Request, res: Response) => {
    try {
      const symbolsParam = (req.query.symbols as string | undefined)?.trim();
      const includeOptions = req.query.include_options !== 'false';
      let symbols: string[] = [];

      if (symbolsParam) {
        symbols = sanitizeSymbols(symbolsParam.split(','));
      } else if (req.user?.id) {
        symbols = await loadUserWatchlistSymbols(req.user.id);
      }

      if (symbols.length === 0) {
        symbols = DEFAULT_SYMBOLS;
      }

      const result = await scanOpportunities(symbols, includeOptions);

      return res.json(result);
    } catch (error: any) {
      logger.error('Scanner endpoint error', { error: error?.message || String(error) });
      return res.status(500).json({
        error: 'Scan failed',
        message: 'Failed to run opportunity scan. Please try again.',
      });
    }
  }
);

export default router;
