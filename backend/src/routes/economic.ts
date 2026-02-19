import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';
import { getEconomicCalendar } from '../services/economic';

const router = Router();

const economicCalendarQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).default(14),
  impact: z.enum(['HIGH', 'MEDIUM', 'ALL']).default('ALL'),
});

/**
 * GET /api/economic/calendar
 * Full economic calendar with configurable window and impact filter.
 */
router.get(
  '/calendar',
  authenticateToken,
  validateQuery(economicCalendarQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { days, impact } = (req as any).validatedQuery as {
        days: number;
        impact: 'HIGH' | 'MEDIUM' | 'ALL';
      };

      const events = await getEconomicCalendar(days, impact);

      return res.json({
        daysAhead: days,
        impactFilter: impact,
        count: events.length,
        events,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: 'Failed to fetch economic calendar',
        message: error.message,
      });
    }
  },
);

/**
 * GET /api/economic/calendar/upcoming
 * Convenience endpoint for next 7 days, HIGH impact only.
 */
router.get('/calendar/upcoming', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const events = await getEconomicCalendar(7, 'HIGH');

    return res.json({
      daysAhead: 7,
      impactFilter: 'HIGH',
      count: events.length,
      events,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to fetch upcoming economic events',
      message: error.message,
    });
  }
});

export default router;
