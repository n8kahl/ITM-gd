import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { supabase } from '../config/database';
import {
  createTrackedSetupSchema,
  updateTrackedSetupSchema,
  trackedSetupIdSchema,
  getTrackedSetupsQuerySchema,
} from '../schemas/trackedSetupsValidation';

const router = Router();

/**
 * GET /api/tracked-setups
 * Returns tracked setups for current user.
 */
router.get(
  '/',
  authenticateToken,
  validateQuery(getTrackedSetupsQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { status } = (req as any).validatedQuery as { status?: string };

      let query = supabase
        .from('ai_coach_tracked_setups')
        .select('*')
        .eq('user_id', userId)
        .order('tracked_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch tracked setups: ${error.message}`);
      }

      return res.json({
        trackedSetups: data || [],
      });
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to fetch tracked setups', message: error.message });
    }
  }
);

/**
 * POST /api/tracked-setups
 * Tracks a scanner setup for follow-up.
 */
router.post(
  '/',
  authenticateToken,
  validateBody(createTrackedSetupSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const body = (req as any).validatedBody as {
        source_opportunity_id?: string;
        symbol: string;
        setup_type: string;
        direction: 'bullish' | 'bearish' | 'neutral';
        opportunity_data: Record<string, unknown>;
        notes?: string | null;
      };

      const payload = {
        user_id: userId,
        source_opportunity_id: body.source_opportunity_id || null,
        symbol: body.symbol.toUpperCase(),
        setup_type: body.setup_type.trim(),
        direction: body.direction,
        status: 'active',
        opportunity_data: body.opportunity_data,
        notes: body.notes ?? null,
      };

      const { data, error } = await supabase
        .from('ai_coach_tracked_setups')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505' && payload.source_opportunity_id) {
          const { data: existing } = await supabase
            .from('ai_coach_tracked_setups')
            .select('*')
            .eq('user_id', userId)
            .eq('source_opportunity_id', payload.source_opportunity_id)
            .eq('status', 'active')
            .maybeSingle();

          res.status(200).json({
            trackedSetup: existing,
            duplicate: true,
          });
          return;
        }

        throw new Error(`Failed to track setup: ${error.message}`);
      }

      res.status(201).json({
        trackedSetup: data,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to track setup', message: error.message });
    }
  }
);

/**
 * PATCH /api/tracked-setups/:id
 * Updates setup status/notes.
 */
router.patch(
  '/:id',
  authenticateToken,
  validateParams(trackedSetupIdSchema),
  validateBody(updateTrackedSetupSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = (req as any).validatedParams as { id: string };
      const updates = (req as any).validatedBody as {
        status?: 'active' | 'triggered' | 'invalidated' | 'archived';
        notes?: string | null;
      };

      const updatePayload: Record<string, unknown> = {};

      if (updates.notes !== undefined) {
        updatePayload.notes = updates.notes;
      }

      if (updates.status !== undefined) {
        updatePayload.status = updates.status;

        if (updates.status === 'triggered') {
          updatePayload.triggered_at = new Date().toISOString();
          updatePayload.invalidated_at = null;
        } else if (updates.status === 'invalidated') {
          updatePayload.invalidated_at = new Date().toISOString();
          updatePayload.triggered_at = null;
        } else if (updates.status === 'active' || updates.status === 'archived') {
          updatePayload.triggered_at = null;
          updatePayload.invalidated_at = null;
        }
      }

      const { data, error } = await supabase
        .from('ai_coach_tracked_setups')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update tracked setup: ${error.message}`);
      }

      if (!data) {
        res.status(404).json({ error: 'Not found', message: 'Tracked setup not found' });
        return;
      }

      res.json({
        trackedSetup: data,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update tracked setup', message: error.message });
    }
  }
);

/**
 * DELETE /api/tracked-setups/:id
 * Permanently deletes a tracked setup for the user.
 */
router.delete(
  '/:id',
  authenticateToken,
  validateParams(trackedSetupIdSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = (req as any).validatedParams as { id: string };

      const { data, error } = await supabase
        .from('ai_coach_tracked_setups')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to delete tracked setup: ${error.message}`);
      }

      if (!data) {
        res.status(404).json({ error: 'Not found', message: 'Tracked setup not found' });
        return;
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete tracked setup', message: error.message });
    }
  }
);

export default router;
