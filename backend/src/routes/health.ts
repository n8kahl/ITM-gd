import { Router, Request, Response } from 'express';
import { testDatabaseConnection } from '../config/database';
import { testRedisConnection } from '../config/redis';
import { testMassiveConnection } from '../config/massive';

const router = Router();

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: false,
      redis: false,
      massive: false
    }
  };

  try {
    // Test all connections in parallel
    const [dbOk, redisOk, massiveOk] = await Promise.all([
      testDatabaseConnection(),
      testRedisConnection(),
      testMassiveConnection()
    ]);

    checks.services.database = dbOk;
    checks.services.redis = redisOk;
    checks.services.massive = massiveOk;

    // Overall status is ok only if all services are ok
    const allOk = dbOk && redisOk && massiveOk;
    checks.status = allOk ? 'ok' : 'degraded';

    const statusCode = allOk ? 200 : 503;
    res.status(statusCode).json(checks);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      services: checks.services,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
