import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { supabase } from '../config/database';
import { getEnv } from '../config/env';
import { publishSetupDetected, publishSetupStatusUpdate } from '../services/setupPushChannel';
import {
  createTrackedSetupSchema,
  updateTrackedSetupSchema,
  trackedSetupIdSchema,
  getTrackedSetupsQuerySchema,
  simulateDetectedSetupSchema,
} from '../schemas/trackedSetupsValidation';

const router = Router();

function toDetectedDirection(direction: 'bullish' | 'bearish' | 'neutral'): 'long' | 'short' | 'neutral' {
  if (direction === 'bullish') return 'long';
  if (direction === 'bearish') return 'short';
  return 'neutral';
}

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
      const { status, view } = (req as any).validatedQuery as { status?: string; view?: 'active' | 'history' };

      let query = supabase
        .from('ai_coach_tracked_setups')
        .select('*')
        .eq('user_id', userId);

      if (status) {
        query = query.eq('status', status);
      } else if (view === 'history') {
        query = query.in('status', ['invalidated', 'archived']);
      } else if (view === 'active') {
        query = query.in('status', ['active', 'triggered']);
      } else {
        query = query.neq('status', 'invalidated');
      }

      query = query.order('tracked_at', { ascending: false });

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
 * POST /api/tracked-setups/e2e/simulate-detected
 * Non-production helper for deterministic detector auto-track E2E validation.
 */
router.post(
  '/e2e/simulate-detected',
  authenticateToken,
  validateBody(simulateDetectedSetupSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const env = getEnv();
      const e2eRouteEnabled = env.E2E_BYPASS_AUTH
        && (env.NODE_ENV !== 'production' || env.E2E_BYPASS_ALLOW_IN_PRODUCTION);
      if (!e2eRouteEnabled) {
        res.status(404).json({ error: 'Not found', message: 'Route not found' });
        return;
      }

      const userId = req.user!.id;
      const body = (req as any).validatedBody as {
        symbol: string;
        setup_type: string;
        direction: 'bullish' | 'bearish' | 'neutral';
        confidence: number;
        current_price?: number;
        description?: string;
        notes?: string;
        trade_suggestion?: Record<string, unknown>;
      };

      const symbol = body.symbol.toUpperCase();
      const detectedAt = new Date().toISOString();
      const description = body.description || `${symbol} ${body.setup_type.replace(/_/g, ' ')}`;

      const { data: detectedSetup, error: detectedError } = await supabase
        .from('ai_coach_detected_setups')
        .insert({
          symbol,
          setup_type: body.setup_type,
          direction: toDetectedDirection(body.direction),
          signal_data: {
            source: 'e2e_simulated_detector',
            description,
            currentPrice: body.current_price ?? null,
          },
          trade_suggestion: body.trade_suggestion ?? null,
          confidence: body.confidence,
          detected_at: detectedAt,
        })
        .select('id, symbol, setup_type, direction, confidence, detected_at, signal_data, trade_suggestion')
        .single();

      if (detectedError || !detectedSetup) {
        throw new Error(`Failed to create detected setup: ${detectedError?.message || 'unknown error'}`);
      }

      const opportunityData: Record<string, unknown> = {
        id: `det-${detectedSetup.id}`,
        type: 'technical',
        setupType: body.setup_type,
        symbol,
        direction: body.direction,
        score: body.confidence,
        confidence: Number((body.confidence / 100).toFixed(2)),
        currentPrice: body.current_price ?? null,
        description,
        suggestedTrade: body.trade_suggestion ?? null,
        metadata: {
          source: 'setup_detector_e2e_simulation',
          detectedSetupId: detectedSetup.id,
        },
        scannedAt: detectedAt,
      };

      const { data: trackedSetup, error: trackedError } = await supabase
        .from('ai_coach_tracked_setups')
        .insert({
          user_id: userId,
          source_opportunity_id: detectedSetup.id,
          symbol,
          setup_type: body.setup_type,
          direction: body.direction,
          status: 'active',
          opportunity_data: opportunityData,
          notes: body.notes || 'Auto-detected by AI Coach setup engine (E2E simulated event)',
        })
        .select('*')
        .single();

      if (trackedError || !trackedSetup) {
        await supabase
          .from('ai_coach_detected_setups')
          .delete()
          .eq('id', detectedSetup.id);
        throw new Error(`Failed to create tracked setup from detected setup: ${trackedError?.message || 'unknown error'}`);
      }

      publishSetupDetected({
        trackedSetupId: trackedSetup.id,
        detectedSetupId: detectedSetup.id,
        userId,
        symbol,
        setupType: body.setup_type,
        direction: body.direction,
        confidence: body.confidence,
        currentPrice: body.current_price ?? null,
        detectedAt,
      });

      res.status(201).json({
        detectedSetup,
        trackedSetup,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to simulate detected setup',
        message: error.message,
      });
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

      const { data: existingSetup, error: existingError } = await supabase
        .from('ai_coach_tracked_setups')
        .select('id, symbol, setup_type, status')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingError) {
        throw new Error(`Failed to load tracked setup before update: ${existingError.message}`);
      }

      if (!existingSetup) {
        res.status(404).json({ error: 'Not found', message: 'Tracked setup not found' });
        return;
      }

      const previousStatus = existingSetup.status as 'active' | 'triggered' | 'invalidated' | 'archived';
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

      if (updates.status !== undefined && updates.status !== previousStatus) {
        publishSetupStatusUpdate({
          setupId: data.id,
          userId,
          symbol: data.symbol || existingSetup.symbol,
          setupType: data.setup_type || existingSetup.setup_type,
          previousStatus,
          status: updates.status,
          currentPrice: null,
          reason: 'manual_update',
          evaluatedAt: new Date().toISOString(),
        });
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
