import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { supabase } from '../config/database';
import { toEasternTime } from '../services/marketHours';
import { journalAutoPopulateService } from '../services/journal/autoPopulate';
import { journalPatternAnalyzer } from '../services/journal/patternAnalyzer';
import {
  createTradeSchema,
  updateTradeSchema,
  tradeIdSchema,
  getTradesQuerySchema,
  getDraftTradesQuerySchema,
  generateDraftsSchema,
  updateDraftStatusSchema,
  getJournalInsightsQuerySchema,
  importTradesSchema,
} from '../schemas/journalValidation';

const router = Router();

/**
 * GET /api/journal/trades
 *
 * Get user's trade history with filtering
 */
router.get(
  '/trades',
  authenticateToken,
  validateQuery(getTradesQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const validatedQuery = (req as any).validatedQuery as {
        limit: number;
        offset: number;
        symbol?: string;
        strategy?: string;
        outcome?: 'win' | 'loss' | 'breakeven';
        draft_status?: 'draft' | 'reviewed' | 'published';
      };
      const {
        limit,
        offset,
        symbol,
        strategy,
        outcome,
        draft_status,
      } = validatedQuery;

      let query = supabase
        .from('ai_coach_trades')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('entry_date', { ascending: false });

      if (symbol) query = query.eq('symbol', symbol.toUpperCase());
      if (strategy) query = query.eq('strategy', strategy);
      if (outcome) query = query.eq('trade_outcome', outcome);
      if (draft_status) query = query.eq('draft_status', draft_status);

      const { data, error, count } = await query.range(offset, offset + limit - 1);

      if (error) throw new Error(`Failed to fetch trades: ${error.message}`);

      res.json({
        trades: data || [],
        total: count || 0,
        hasMore: (count || 0) > offset + limit,
      });
    } catch (error: any) {
      logger.error('Error fetching trades', { error: error?.message || String(error) });
      res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch trades' });
    }
  }
);

/**
 * GET /api/journal/drafts
 *
 * List auto-generated journal drafts (or reviewed/published with status filter).
 */
router.get(
  '/drafts',
  authenticateToken,
  validateQuery(getDraftTradesQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const validatedQuery = (req as any).validatedQuery as {
        limit: number;
        status: 'draft' | 'reviewed' | 'published' | 'all';
      };

      const { limit, status } = validatedQuery;

      let query = supabase
        .from('ai_coach_trades')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('auto_generated', true)
        .order('created_at', { ascending: false });

      if (status !== 'all') {
        query = query.eq('draft_status', status);
      }

      const { data, error, count } = await query.range(0, limit - 1);
      if (error) throw new Error(`Failed to fetch draft trades: ${error.message}`);

      res.json({
        drafts: data || [],
        total: count || 0,
      });
    } catch (error: any) {
      logger.error('Error fetching draft trades', { error: error?.message || String(error) });
      res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch draft trades' });
    }
  },
);

/**
 * POST /api/journal/drafts/generate
 *
 * Manually trigger draft generation for today's ET date (or provided marketDate).
 */
router.post(
  '/drafts/generate',
  authenticateToken,
  validateBody(generateDraftsSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const validatedBody = (req as any).validatedBody as { marketDate?: string };
      const marketDate = validatedBody.marketDate || toEasternTime(new Date()).dateStr;

      const result = await journalAutoPopulateService.generateDraftsForUser(userId, marketDate);

      res.status(201).json(result);
    } catch (error: any) {
      logger.error('Error generating draft trades', { error: error?.message || String(error) });
      res.status(500).json({ error: 'Internal server error', message: 'Failed to generate draft trades' });
    }
  },
);

/**
 * POST /api/journal/trades
 *
 * Create a new trade entry
 */
router.post(
  '/trades',
  authenticateToken,
  validateBody(createTradeSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const {
        symbol, position_type, strategy,
        entry_date, entry_price, exit_date, exit_price,
        quantity, exit_reason, lessons_learned, tags,
      } = req.body;


      // Calculate P&L if exit data provided
      let pnl = null;
      let pnl_pct = null;
      let trade_outcome: 'win' | 'loss' | 'breakeven' | null = null;
      let hold_time_days = null;

      if (exit_price != null && exit_date) {
        const multiplier = position_type === 'stock' ? 1 : 100;
        pnl = (exit_price - entry_price) * quantity * multiplier;
        pnl_pct = ((exit_price - entry_price) / entry_price) * 100;
        trade_outcome = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven';
        hold_time_days = Math.ceil(
          (new Date(exit_date).getTime() - new Date(entry_date).getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      const { data, error } = await supabase
        .from('ai_coach_trades')
        .insert({
          user_id: userId,
          symbol: symbol.toUpperCase(),
          position_type,
          strategy: strategy || null,
          entry_date,
          entry_price,
          exit_date: exit_date || null,
          exit_price: exit_price || null,
          quantity,
          pnl,
          pnl_pct,
          trade_outcome,
          hold_time_days,
          exit_reason: exit_reason || null,
          lessons_learned: lessons_learned || null,
          tags: tags || [],
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create trade: ${error.message}`);

      res.status(201).json(data);
    } catch (error: any) {
      logger.error('Error creating trade', { error: error?.message || String(error) });
      res.status(500).json({ error: 'Internal server error', message: 'Failed to create trade' });
    }
  }
);

/**
 * PUT /api/journal/trades/:id
 *
 * Update a trade entry
 */
router.put(
  '/trades/:id',
  authenticateToken,
  validateParams(tradeIdSchema),
  validateBody(updateTradeSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const updates = req.body;

      // Recalculate P&L if exit data changed
      if (updates.exit_price != null && updates.entry_price != null) {
        const multiplier = updates.position_type === 'stock' ? 1 : 100;
        const qty = updates.quantity || 1;
        updates.pnl = (updates.exit_price - updates.entry_price) * qty * multiplier;
        updates.pnl_pct = ((updates.exit_price - updates.entry_price) / updates.entry_price) * 100;
        updates.trade_outcome = updates.pnl > 0 ? 'win' : updates.pnl < 0 ? 'loss' : 'breakeven';
      }

      const { data, error } = await supabase
        .from('ai_coach_trades')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update trade: ${error.message}`);
      if (!data) {
        res.status(404).json({ error: 'Not found' });
        return;
      }

      res.json(data);
    } catch (error: any) {
      logger.error('Error updating trade', { error: error?.message || String(error) });
      res.status(500).json({ error: 'Internal server error', message: 'Failed to update trade' });
    }
  }
);

/**
 * PATCH /api/journal/trades/:id/draft-status
 *
 * Update draft workflow status (draft -> reviewed -> published).
 */
router.patch(
  '/trades/:id/draft-status',
  authenticateToken,
  validateParams(tradeIdSchema),
  validateBody(updateDraftStatusSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { draft_status } = req.body as {
        draft_status: 'draft' | 'reviewed' | 'published';
      };

      const { data, error } = await supabase
        .from('ai_coach_trades')
        .update({ draft_status })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update draft status: ${error.message}`);

      res.json(data);
    } catch (error: any) {
      logger.error('Error updating draft status', { error: error?.message || String(error) });
      res.status(500).json({ error: 'Internal server error', message: 'Failed to update draft status' });
    }
  },
);

/**
 * DELETE /api/journal/trades/:id
 */
router.delete(
  '/trades/:id',
  authenticateToken,
  validateParams(tradeIdSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const { error } = await supabase
        .from('ai_coach_trades')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw new Error(`Failed to delete trade: ${error.message}`);

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error deleting trade', { error: error?.message || String(error) });
      res.status(500).json({ error: 'Internal server error', message: 'Failed to delete trade' });
    }
  }
);

/**
 * GET /api/journal/analytics
 *
 * Get trade performance analytics
 */
router.get(
  '/analytics',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      // Fetch all closed trades
      const { data: trades, error } = await supabase
        .from('ai_coach_trades')
        .select('*')
        .eq('user_id', userId)
        .not('trade_outcome', 'is', null)
        .order('entry_date', { ascending: true });

      if (error) throw new Error(`Failed to fetch trades: ${error.message}`);

      const allTrades = trades || [];
      const wins = allTrades.filter(t => t.trade_outcome === 'win');
      const losses = allTrades.filter(t => t.trade_outcome === 'loss');

      const totalPnl = allTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const avgWin = wins.length > 0
        ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length
        : 0;
      const avgLoss = losses.length > 0
        ? losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length
        : 0;
      const profitFactor = avgLoss !== 0
        ? Math.abs(avgWin * wins.length) / Math.abs(avgLoss * losses.length)
        : 0;

      // Equity curve
      let runningPnl = 0;
      const equityCurve = allTrades.map(t => {
        runningPnl += t.pnl || 0;
        return { date: t.exit_date || t.entry_date, pnl: runningPnl };
      });

      // By strategy
      const byStrategy: Record<string, { count: number; pnl: number; winRate: number }> = {};
      for (const trade of allTrades) {
        const strat = trade.strategy || 'Unclassified';
        if (!byStrategy[strat]) byStrategy[strat] = { count: 0, pnl: 0, winRate: 0 };
        byStrategy[strat].count++;
        byStrategy[strat].pnl += trade.pnl || 0;
      }
      for (const strat of Object.keys(byStrategy)) {
        const stratTrades = allTrades.filter(t => (t.strategy || 'Unclassified') === strat);
        const stratWins = stratTrades.filter(t => t.trade_outcome === 'win');
        byStrategy[strat].winRate = stratTrades.length > 0
          ? (stratWins.length / stratTrades.length) * 100
          : 0;
      }

      res.json({
        summary: {
          totalTrades: allTrades.length,
          wins: wins.length,
          losses: losses.length,
          breakeven: allTrades.filter(t => t.trade_outcome === 'breakeven').length,
          winRate: allTrades.length > 0 ? (wins.length / allTrades.length) * 100 : 0,
          totalPnl,
          avgWin,
          avgLoss,
          profitFactor,
          avgHoldDays: allTrades.reduce((sum, t) => sum + (t.hold_time_days || 0), 0) / (allTrades.length || 1),
        },
        equityCurve,
        byStrategy,
      });
    } catch (error: any) {
      logger.error('Error fetching analytics', { error: error?.message || String(error) });
      res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch analytics' });
    }
  }
);

/**
 * GET /api/journal/insights
 *
 * Returns journal pattern insights for the requested period.
 */
router.get(
  '/insights',
  authenticateToken,
  validateQuery(getJournalInsightsQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const validatedQuery = (req as any).validatedQuery as {
        period: '7d' | '30d' | '90d';
        forceRefresh: boolean;
      };

      const periodDays = validatedQuery.period === '7d'
        ? 7
        : validatedQuery.period === '90d'
          ? 90
          : 30;

      const insightResult = await journalPatternAnalyzer.getJournalInsightsForUser(
        userId,
        periodDays,
        { forceRefresh: validatedQuery.forceRefresh },
      );

      res.json(insightResult);
    } catch (error: any) {
      logger.error('Error fetching journal insights', { error: error?.message || String(error) });
      res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch journal insights' });
    }
  },
);

/**
 * POST /api/journal/import
 *
 * Import trades from CSV
 */
router.post(
  '/import',
  authenticateToken,
  validateBody(importTradesSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { trades: importedTrades } = req.body;


      // Map imported trades to our schema
      const mapped = importedTrades.map((t: any) => ({
        user_id: userId,
        symbol: String(t.symbol || '').toUpperCase(),
        position_type: t.position_type || t.type || 'call',
        strategy: t.strategy || null,
        entry_date: t.entry_date || t.entryDate,
        entry_price: Number(t.entry_price || t.entryPrice || 0),
        exit_date: t.exit_date || t.exitDate || null,
        exit_price: t.exit_price != null ? Number(t.exit_price) : (t.exitPrice != null ? Number(t.exitPrice) : null),
        quantity: Number(t.quantity || 1),
        pnl: t.pnl != null ? Number(t.pnl) : null,
        pnl_pct: t.pnl_pct != null ? Number(t.pnl_pct) : null,
        trade_outcome: t.trade_outcome || null,
        hold_time_days: t.hold_time_days || null,
        tags: t.tags || [],
      }));

      const { data, error } = await supabase
        .from('ai_coach_trades')
        .insert(mapped)
        .select();

      if (error) throw new Error(`Failed to import trades: ${error.message}`);

      res.status(201).json({
        imported: data?.length || 0,
        total: mapped.length,
      });
    } catch (error: any) {
      logger.error('Error importing trades', { error: error?.message || String(error) });
      res.status(500).json({ error: 'Internal server error', message: 'Failed to import trades' });
    }
  }
);

export default router;
