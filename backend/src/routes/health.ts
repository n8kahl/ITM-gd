import { Router, Request, Response } from 'express';
import { testDatabaseConnection } from '../config/database';
import { testRedisConnection } from '../config/redis';
import { testOpenAIConnection } from '../config/openai';
import { logger } from '../lib/logger';

const router = Router();

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks?: Record<string, {
    status: 'pass' | 'fail';
    latency?: number;
    message?: string;
  }>;
}

/**
 * GET /health - Basic liveness check
 * Used by load balancers and container orchestration.
 */
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

/**
 * GET /health/ready - Readiness check with dependency verification
 * Returns 503 if critical dependencies are down.
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: HealthCheck['checks'] = {};
  let overallHealthy = true;

  // Check Database
  const dbStart = Date.now();
  try {
    const dbOk = await testDatabaseConnection();
    checks.database = {
      status: dbOk ? 'pass' : 'fail',
      latency: Date.now() - dbStart,
    };
    if (!dbOk) overallHealthy = false;
  } catch (err) {
    checks.database = { status: 'fail', latency: Date.now() - dbStart, message: 'Connection failed' };
    overallHealthy = false;
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    const redisOk = await testRedisConnection();
    checks.redis = {
      status: redisOk ? 'pass' : 'fail',
      latency: Date.now() - redisStart,
    };
    if (!redisOk) overallHealthy = false;
  } catch (err) {
    checks.redis = { status: 'fail', latency: Date.now() - redisStart, message: 'Connection failed' };
    overallHealthy = false;
  }

  // Check OpenAI (non-critical - degrades but doesn't fail)
  const aiStart = Date.now();
  try {
    const aiOk = await testOpenAIConnection();
    checks.openai = {
      status: aiOk ? 'pass' : 'fail',
      latency: Date.now() - aiStart,
    };
  } catch (err) {
    checks.openai = { status: 'fail', latency: Date.now() - aiStart, message: 'Connection failed' };
  }

  const response: HealthCheck = {
    status: overallHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks,
  };

  const statusCode = overallHealthy ? 200 : 503;

  if (!overallHealthy) {
    logger.warn('Health check failed', { checks });
  }

  res.status(statusCode).json(response);
});

export default router;
