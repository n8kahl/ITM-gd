import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { supabase } from '../config/database';
import {
  createWatchlistSchema,
  updateWatchlistSchema,
  watchlistIdSchema,
} from '../schemas/watchlistValidation';

const router = Router();

const DEFAULT_WATCHLIST_SYMBOLS = ['SPX', 'NDX', 'SPY', 'QQQ'];

function normalizeSymbols(symbols: string[]): string[] {
  const normalized = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9._:-]{1,10}$/.test(symbol));

  return Array.from(new Set(normalized)).slice(0, 50);
}

async function fetchWatchlists(userId: string) {
  const { data, error } = await supabase
    .from('ai_coach_watchlists')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch watchlists: ${error.message}`);
  }

  return data || [];
}

async function createDefaultWatchlist(userId: string) {
  const { data, error } = await supabase
    .from('ai_coach_watchlists')
    .insert({
      user_id: userId,
      name: 'Default',
      symbols: DEFAULT_WATCHLIST_SYMBOLS,
      is_default: true,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create default watchlist: ${error.message}`);
  }

  return data;
}

async function ensureUserHasDefaultWatchlist(userId: string) {
  const watchlists = await fetchWatchlists(userId);

  if (watchlists.length === 0) {
    const created = await createDefaultWatchlist(userId);
    return [created];
  }

  const hasDefault = watchlists.some((watchlist) => watchlist.is_default === true);
  if (hasDefault) return watchlists;

  const firstWatchlist = watchlists[0];
  const { error } = await supabase
    .from('ai_coach_watchlists')
    .update({ is_default: true })
    .eq('id', firstWatchlist.id)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to recover default watchlist: ${error.message}`);
  }

  return watchlists.map((watchlist) => ({
    ...watchlist,
    is_default: watchlist.id === firstWatchlist.id,
  }));
}

/**
 * GET /api/watchlist
 * Returns all user watchlists and the active default watchlist.
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const watchlists = await ensureUserHasDefaultWatchlist(userId);
    const defaultWatchlist = watchlists.find((watchlist) => watchlist.is_default) || watchlists[0];

    res.json({
      watchlists,
      defaultWatchlist,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch watchlists', message: error.message });
  }
});

/**
 * POST /api/watchlist
 * Creates a new watchlist.
 */
router.post(
  '/',
  authenticateToken,
  validateBody(createWatchlistSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const body = (req as any).validatedBody as {
        name: string;
        symbols: string[];
        isDefault?: boolean;
      };

      const normalizedSymbols = normalizeSymbols(body.symbols);
      if (normalizedSymbols.length === 0) {
        res.status(400).json({
          error: 'Invalid symbols',
          message: 'At least one valid symbol is required',
        });
        return;
      }

      if (body.isDefault) {
        await supabase
          .from('ai_coach_watchlists')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { data, error } = await supabase
        .from('ai_coach_watchlists')
        .insert({
          user_id: userId,
          name: body.name.trim(),
          symbols: normalizedSymbols,
          is_default: body.isDefault === true,
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create watchlist: ${error.message}`);
      }

      const watchlists = await ensureUserHasDefaultWatchlist(userId);
      const defaultWatchlist = watchlists.find((watchlist) => watchlist.is_default) || watchlists[0];

      res.status(201).json({
        watchlist: data,
        watchlists,
        defaultWatchlist,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to create watchlist', message: error.message });
    }
  }
);

/**
 * PUT /api/watchlist/:id
 * Updates a watchlist.
 */
router.put(
  '/:id',
  authenticateToken,
  validateParams(watchlistIdSchema),
  validateBody(updateWatchlistSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = (req as any).validatedParams as { id: string };
      const updates = (req as any).validatedBody as {
        name?: string;
        symbols?: string[];
        isDefault?: boolean;
      };

      const updatePayload: Record<string, unknown> = {};

      if (updates.name !== undefined) {
        updatePayload.name = updates.name.trim();
      }

      if (updates.symbols !== undefined) {
        const normalizedSymbols = normalizeSymbols(updates.symbols);
        if (normalizedSymbols.length === 0) {
          res.status(400).json({
            error: 'Invalid symbols',
            message: 'At least one valid symbol is required',
          });
          return;
        }
        updatePayload.symbols = normalizedSymbols;
      }

      if (updates.isDefault !== undefined) {
        if (updates.isDefault) {
          await supabase
            .from('ai_coach_watchlists')
            .update({ is_default: false })
            .eq('user_id', userId)
            .neq('id', id);
        }
        updatePayload.is_default = updates.isDefault;
      }

      const { data, error } = await supabase
        .from('ai_coach_watchlists')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update watchlist: ${error.message}`);
      }

      if (!data) {
        res.status(404).json({ error: 'Not found', message: 'Watchlist not found' });
        return;
      }

      const watchlists = await ensureUserHasDefaultWatchlist(userId);
      const defaultWatchlist = watchlists.find((watchlist) => watchlist.is_default) || watchlists[0];

      res.json({
        watchlist: data,
        watchlists,
        defaultWatchlist,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update watchlist', message: error.message });
    }
  }
);

/**
 * DELETE /api/watchlist/:id
 * Deletes a watchlist and guarantees a default remains.
 */
router.delete(
  '/:id',
  authenticateToken,
  validateParams(watchlistIdSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = (req as any).validatedParams as { id: string };

      const { data, error } = await supabase
        .from('ai_coach_watchlists')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to delete watchlist: ${error.message}`);
      }

      if (!data) {
        res.status(404).json({ error: 'Not found', message: 'Watchlist not found' });
        return;
      }

      const watchlists = await ensureUserHasDefaultWatchlist(userId);
      const defaultWatchlist = watchlists.find((watchlist) => watchlist.is_default) || watchlists[0];

      res.json({
        success: true,
        watchlists,
        defaultWatchlist,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete watchlist', message: error.message });
    }
  }
);

export default router;
