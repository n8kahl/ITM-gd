import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { supabase } from '../config/database';
import { generateGreeksProjection } from '../services/leaps/greeksProjection';
import { calculateRoll } from '../services/leaps/rollCalculator';

const router = Router();

/**
 * GET /api/leaps
 * Get all LEAPS positions for the authenticated user
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('ai_coach_leaps_positions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    res.json({ positions: data || [], count: (data || []).length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch LEAPS positions', message: error.message });
  }
});

/**
 * GET /api/leaps/:id
 * Get a single LEAPS position with Greeks projection
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('ai_coach_leaps_positions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ error: 'Position not found' });

    // Calculate Greeks projection
    const daysToExpiry = Math.max(0, Math.ceil(
      (new Date(data.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));

    const projection = generateGreeksProjection(
      data.symbol,
      data.option_type.toLowerCase() as 'call' | 'put',
      data.strike,
      data.current_underlying || data.strike, // fallback
      daysToExpiry,
      data.current_iv || 0.25 // fallback IV
    );

    res.json({
      position: data,
      daysToExpiry,
      daysHeld: Math.ceil((Date.now() - new Date(data.entry_date).getTime()) / (1000 * 60 * 60 * 24)),
      greeksProjection: projection.projections,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch LEAPS position', message: error.message });
  }
});

/**
 * POST /api/leaps
 * Create a new LEAPS position
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      symbol, option_type, strike, entry_price, entry_date,
      expiry_date, quantity, notes,
      entry_delta, entry_gamma, entry_vega, entry_theta,
    } = req.body;

    // Validate required fields
    if (!symbol || !option_type || !strike || !entry_price || !entry_date || !expiry_date || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate option_type
    if (!['CALL', 'PUT'].includes(option_type.toUpperCase())) {
      return res.status(400).json({ error: 'option_type must be CALL or PUT' });
    }

    // Check position limit (10 LEAPS max)
    const { count } = await supabase
      .from('ai_coach_leaps_positions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (count !== null && count >= 10) {
      return res.status(400).json({ error: 'Maximum 10 LEAPS positions allowed' });
    }

    const { data, error } = await supabase
      .from('ai_coach_leaps_positions')
      .insert({
        user_id: userId,
        symbol: symbol.toUpperCase(),
        option_type: option_type.toUpperCase(),
        strike,
        entry_price,
        entry_date,
        expiry_date,
        quantity,
        notes: notes || null,
        entry_delta: entry_delta || null,
        entry_gamma: entry_gamma || null,
        entry_vega: entry_vega || null,
        entry_theta: entry_theta || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    res.status(201).json({ position: data });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create LEAPS position', message: error.message });
  }
});

/**
 * PUT /api/leaps/:id
 * Update a LEAPS position (current value, Greeks, notes)
 */
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const updateFields: Record<string, any> = {};
    const allowed = [
      'current_value', 'current_underlying', 'current_iv',
      'current_delta', 'current_gamma', 'current_vega', 'current_theta',
      'notes',
    ];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('ai_coach_leaps_positions')
      .update(updateFields)
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ error: 'Position not found' });

    res.json({ position: data });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update LEAPS position', message: error.message });
  }
});

/**
 * DELETE /api/leaps/:id
 * Delete a LEAPS position
 */
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { error } = await supabase
      .from('ai_coach_leaps_positions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete LEAPS position', message: error.message });
  }
});

/**
 * POST /api/leaps/:id/roll-calculation
 * Calculate a roll analysis for a LEAPS position
 */
router.post('/:id/roll-calculation', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch the position
    const { data: position, error } = await supabase
      .from('ai_coach_leaps_positions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (error) throw new Error(error.message);
    if (!position) return res.status(404).json({ error: 'Position not found' });

    const { newStrike, newExpiry } = req.body;
    if (!newStrike) {
      return res.status(400).json({ error: 'newStrike is required' });
    }

    const rollAnalysis = calculateRoll({
      currentStrike: position.strike,
      currentExpiry: position.expiry_date,
      newStrike,
      newExpiry: newExpiry || position.expiry_date,
      optionType: position.option_type.toLowerCase() as 'call' | 'put',
      currentPrice: position.current_underlying || position.strike,
      impliedVolatility: position.current_iv || 0.25,
      quantity: position.quantity,
    });

    res.json(rollAnalysis);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to calculate roll', message: error.message });
  }
});

/**
 * POST /api/leaps/:id/greeks-projection
 * Get Greeks projection for a LEAPS position
 */
router.post('/:id/greeks-projection', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data: position, error } = await supabase
      .from('ai_coach_leaps_positions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (error) throw new Error(error.message);
    if (!position) return res.status(404).json({ error: 'Position not found' });

    const daysToExpiry = Math.max(0, Math.ceil(
      (new Date(position.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));

    const projection = generateGreeksProjection(
      position.symbol,
      position.option_type.toLowerCase() as 'call' | 'put',
      position.strike,
      position.current_underlying || position.strike,
      daysToExpiry,
      position.current_iv || 0.25
    );

    res.json(projection);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate projection', message: error.message });
  }
});

export default router;
