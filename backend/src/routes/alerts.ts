import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { supabase } from '../config/database';

const router = Router();

/**
 * GET /api/alerts
 *
 * Get user's alerts with optional status filter
 */
router.get(
  '/',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const status = req.query.status as string;
      const symbol = req.query.symbol as string;

      let query = supabase
        .from('ai_coach_alerts')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (status) query = query.eq('status', status);
      if (symbol) query = query.eq('symbol', symbol.toUpperCase());

      const { data, error, count } = await query
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to fetch alerts: ${error.message}`);

      res.json({
        alerts: data || [],
        total: count || 0,
      });
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch alerts' });
    }
  }
);

/**
 * POST /api/alerts
 *
 * Create a new alert
 */
router.post(
  '/',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const {
        symbol,
        alert_type,
        target_value,
        notification_channels,
        notes,
        expires_at,
      } = req.body;

      // Validate required fields
      if (!symbol || !alert_type || target_value == null) {
        res.status(400).json({
          error: 'Missing fields',
          message: 'symbol, alert_type, and target_value are required',
        });
        return;
      }

      // Validate alert_type
      const validTypes = ['price_above', 'price_below', 'level_approach', 'level_break', 'volume_spike'];
      if (!validTypes.includes(alert_type)) {
        res.status(400).json({
          error: 'Invalid alert_type',
          message: `alert_type must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      // Check active alert count (limit to 20)
      const { count: activeCount } = await supabase
        .from('ai_coach_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'active');

      if ((activeCount || 0) >= 20) {
        res.status(400).json({
          error: 'Alert limit reached',
          message: 'Maximum 20 active alerts allowed. Cancel existing alerts to create new ones.',
        });
        return;
      }

      const { data, error } = await supabase
        .from('ai_coach_alerts')
        .insert({
          user_id: userId,
          symbol: symbol.toUpperCase(),
          alert_type,
          target_value,
          notification_channels: notification_channels || ['in-app'],
          notes: notes || null,
          expires_at: expires_at || null,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create alert: ${error.message}`);

      res.status(201).json(data);
    } catch (error: any) {
      console.error('Error creating alert:', error);
      res.status(500).json({ error: 'Internal server error', message: 'Failed to create alert' });
    }
  }
);

/**
 * PUT /api/alerts/:id
 *
 * Update an alert (e.g. change target, cancel)
 */
router.put(
  '/:id',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const updates = req.body;

      // Don't allow changing user_id
      delete updates.user_id;
      delete updates.id;

      const { data, error } = await supabase
        .from('ai_coach_alerts')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update alert: ${error.message}`);
      if (!data) {
        res.status(404).json({ error: 'Not found' });
        return;
      }

      res.json(data);
    } catch (error: any) {
      console.error('Error updating alert:', error);
      res.status(500).json({ error: 'Internal server error', message: 'Failed to update alert' });
    }
  }
);

/**
 * DELETE /api/alerts/:id
 *
 * Delete an alert
 */
router.delete(
  '/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const { error } = await supabase
        .from('ai_coach_alerts')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw new Error(`Failed to delete alert: ${error.message}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting alert:', error);
      res.status(500).json({ error: 'Internal server error', message: 'Failed to delete alert' });
    }
  }
);

/**
 * POST /api/alerts/:id/cancel
 *
 * Cancel an active alert
 */
router.post(
  '/:id/cancel',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const { data, error } = await supabase
        .from('ai_coach_alerts')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('user_id', userId)
        .eq('status', 'active')
        .select()
        .single();

      if (error) throw new Error(`Failed to cancel alert: ${error.message}`);
      if (!data) {
        res.status(404).json({ error: 'Alert not found or already cancelled/triggered' });
        return;
      }

      res.json(data);
    } catch (error: any) {
      console.error('Error cancelling alert:', error);
      res.status(500).json({ error: 'Internal server error', message: 'Failed to cancel alert' });
    }
  }
);

export default router;
