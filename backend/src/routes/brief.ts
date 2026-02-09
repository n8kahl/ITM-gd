import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { supabase } from '../config/database';
import { getMarketStatus } from '../services/marketHours';

const router = Router();

const DEFAULT_WATCHLIST_SYMBOLS = ['SPX', 'NDX', 'SPY', 'QQQ'];

function getEasternMarketDate(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

async function getUserDefaultWatchlistSymbols(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('ai_coach_watchlists')
    .select('symbols, is_default, created_at')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load watchlist: ${error.message}`);
  }

  const watchlists = data || [];
  if (watchlists.length === 0) return DEFAULT_WATCHLIST_SYMBOLS;

  const defaultWatchlist = watchlists.find((watchlist) => watchlist.is_default) || watchlists[0];
  const symbols = Array.isArray(defaultWatchlist.symbols)
    ? defaultWatchlist.symbols.filter((symbol) => typeof symbol === 'string')
    : [];

  return symbols.length > 0 ? symbols : DEFAULT_WATCHLIST_SYMBOLS;
}

async function buildFallbackBrief(userId: string, marketDate: string) {
  const watchlist = await getUserDefaultWatchlistSymbols(userId);
  const marketStatus = getMarketStatus();

  return {
    generatedAt: new Date().toISOString(),
    marketDate,
    marketStatus,
    watchlist,
    overnightSummary: {
      futuresDirection: 'flat' as const,
      futuresChange: 0,
      futuresChangePct: 0,
      gapAnalysis: [],
    },
    keyLevelsToday: [],
    economicEvents: [],
    earningsToday: [],
    openPositionStatus: [],
    watchItems: [
      `Review key levels and trend context for ${watchlist.join(', ')}`,
      'Run opportunity scanner after the opening range forms',
      'Confirm risk sizing before placing any trade',
    ],
    aiSummary: 'Morning brief placeholder generated. Connect live market context service to replace this fallback summary.',
  };
}

/**
 * GET /api/brief/today
 * Returns the user morning brief for the current market date.
 * If none exists, creates a fallback brief and stores it.
 */
router.get('/today', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const marketDate = getEasternMarketDate();
    const forceRefresh = req.query.force === 'true';

    if (!forceRefresh) {
      const { data: existing, error: existingError } = await supabase
        .from('ai_coach_morning_briefs')
        .select('*')
        .eq('user_id', userId)
        .eq('market_date', marketDate)
        .maybeSingle();

      if (existingError) {
        throw new Error(`Failed to fetch morning brief: ${existingError.message}`);
      }

      if (existing) {
        return res.json({
          brief: existing.brief_data,
          marketDate,
          viewed: existing.viewed,
          cached: true,
        });
      }
    }

    const briefData = await buildFallbackBrief(userId, marketDate);

    const { data: upserted, error: upsertError } = await supabase
      .from('ai_coach_morning_briefs')
      .upsert(
        {
          user_id: userId,
          market_date: marketDate,
          brief_data: briefData,
          viewed: false,
        },
        { onConflict: 'user_id,market_date' }
      )
      .select('*')
      .single();

    if (upsertError) {
      throw new Error(`Failed to save morning brief: ${upsertError.message}`);
    }

    return res.json({
      brief: upserted.brief_data,
      marketDate,
      viewed: upserted.viewed,
      cached: false,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to load morning brief', message: error.message });
  }
});

/**
 * PATCH /api/brief/today
 * Marks today's brief viewed/unviewed.
 */
router.patch('/today', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const marketDate = getEasternMarketDate();
    const viewed = req.body?.viewed;

    if (typeof viewed !== 'boolean') {
      res.status(400).json({ error: 'Invalid payload', message: 'viewed must be a boolean' });
      return;
    }

    const { data, error } = await supabase
      .from('ai_coach_morning_briefs')
      .update({ viewed })
      .eq('user_id', userId)
      .eq('market_date', marketDate)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update morning brief status: ${error.message}`);
    }

    if (!data) {
      res.status(404).json({ error: 'Not found', message: 'No brief exists for today' });
      return;
    }

    res.json({
      success: true,
      marketDate,
      viewed: data.viewed,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update morning brief', message: error.message });
  }
});

export default router;
