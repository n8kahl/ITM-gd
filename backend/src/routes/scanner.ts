import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { scanOpportunities } from '../services/scanner';

const router = Router();

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
      const symbolsParam = (req.query.symbols as string) || 'SPX,NDX';
      const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      const includeOptions = req.query.include_options !== 'false';

      // Validate symbols
      const validSymbols = ['SPX', 'NDX', 'QQQ', 'SPY', 'IWM', 'DIA'];
      const filtered = symbols.filter(s => validSymbols.includes(s));
      if (filtered.length === 0) {
        return res.status(400).json({
          error: 'Invalid symbols',
          message: `Supported symbols: ${validSymbols.join(', ')}`,
        });
      }

      const result = await scanOpportunities(filtered, includeOptions);

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
