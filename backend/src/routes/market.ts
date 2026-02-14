import { Router, Request, Response } from 'express';
import { getMarketIndicesSnapshot } from '../services/marketIndices';
import { getMarketStatus } from '../services/marketHours';
import { getUpcomingHolidays } from '../services/marketHolidays';
import { getMarketMovers } from '../services/marketMovers';
import { getUpcomingSplits } from '../services/stockSplits';
import { getMarketHealthSnapshot } from '../services/marketAnalytics';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /api/market/indices
 * Get snapshot of major market indices (SPX, NDX)
 */
router.get('/indices', async (_req: Request, res: Response) => {
    try {
        const indices = await getMarketIndicesSnapshot();
        res.json(indices);
    } catch (error) {
        logger.error('Error fetching market indices:', { error });
        res.status(500).json({ error: 'Failed to fetch market indices' });
    }
});

router.get('/status', async (_req: Request, res: Response) => {
    try {
        const status = getMarketStatus();
        res.json(status);
    } catch (error) {
        logger.error('Error fetching market status:', { error });
        res.status(500).json({ error: 'Failed to fetch market status' });
    }
});

router.get('/holidays', async (_req: Request, res: Response) => {
    try {
        const holidays = await getUpcomingHolidays();
        res.json(holidays);
    } catch (error) {
        logger.error('Error fetching market holidays:', { error });
        res.status(500).json({ error: 'Failed to fetch market holidays' });
    }
});

router.get('/movers', async (req: Request, res: Response) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
        const movers = await getMarketMovers(limit);
        res.json(movers);
    } catch (error) {
        logger.error('Error fetching market movers:', { error });
        res.status(500).json({ error: 'Failed to fetch market movers' });
    }
});

router.get('/splits', async (_req: Request, res: Response) => {
    try {
        const splits = await getUpcomingSplits();
        res.json(splits);
    } catch (error) {
        logger.error('Error fetching stock splits:', { error });
        res.status(500).json({ error: 'Failed to fetch stock splits' });
    }
});

/**
 * GET /api/market/analytics
 * Market health snapshot: regime, breadth, and index summary
 */
router.get('/analytics', async (_req: Request, res: Response) => {
    try {
        const snapshot = await getMarketHealthSnapshot();
        res.json(snapshot);
    } catch (error) {
        logger.error('Error fetching market analytics:', { error });
        res.status(500).json({ error: 'Failed to fetch market analytics' });
    }
});

export default router;
