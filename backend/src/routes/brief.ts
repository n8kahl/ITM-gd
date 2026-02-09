import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { supabase } from '../config/database';
import { morningBriefService } from '../services/morningBrief';

const router = Router();

const BRIEF_CACHE_TTL_MS = 30 * 60 * 1000;

function getEasternMarketDate(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

function parseWatchlistQuery(value: string | undefined): string[] {
  if (!value) return [];

  const symbols = value
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9._:-]{1,10}$/.test(symbol));

  return Array.from(new Set(symbols)).slice(0, 20);
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
    const watchlistOverride = parseWatchlistQuery(
      typeof req.query.watchlist === 'string' ? req.query.watchlist : undefined
    );

    // On-demand custom watchlist preview: generate but do not persist user daily cache.
    if (watchlistOverride.length > 0) {
      const brief = await morningBriefService.generateBrief(userId, watchlistOverride);
      return res.json({
        brief,
        marketDate,
        viewed: false,
        cached: false,
      });
    }

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
        const createdAt = new Date(existing.created_at).getTime();
        const isFresh = Number.isFinite(createdAt)
          ? (Date.now() - createdAt) < BRIEF_CACHE_TTL_MS
          : false;

        if (isFresh) {
          return res.json({
            brief: existing.brief_data,
            marketDate,
            viewed: existing.viewed,
            cached: true,
          });
        }
      }
    }

    const briefData = await morningBriefService.generateBrief(userId);

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
