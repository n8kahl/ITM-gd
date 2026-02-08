import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getMacroContext, assessMacroImpact } from '../services/macro/macroContext';

const router = Router();

/**
 * GET /api/macro
 * Get comprehensive macro context (economic calendar, Fed policy, sectors, earnings)
 */
router.get('/', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const context = getMacroContext();
    res.json(context);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch macro context', message: error.message });
  }
});

/**
 * GET /api/macro/impact/:symbol
 * Get macro impact assessment for a specific symbol
 */
router.get('/impact/:symbol', authenticateToken, async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    if (!['SPX', 'NDX'].includes(symbol)) {
      return res.status(400).json({ error: 'Supported symbols: SPX, NDX' });
    }

    const impact = assessMacroImpact(symbol);
    return res.json({ symbol, ...impact });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to assess macro impact', message: error.message });
  }
});

export default router;
