import { Router, Request, Response } from 'express';
import { testDatabaseConnection, supabase } from '../config/database';
import { testRedisConnection } from '../config/redis';
import { testMassiveConnection } from '../config/massive';
import { testOpenAIConnection, openaiClient, CHAT_MODEL } from '../config/openai';

const router = Router();

// Basic health check
router.get('/', async (_req: Request, res: Response) => {
  return res.json({ status: 'ok' });
});

// Detailed health check
router.get('/detailed', async (_req: Request, res: Response) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: false,
      redis: false,
      massive: false,
      openai: false
    }
  };

  try {
    // Test all connections in parallel
    const [dbOk, redisOk, massiveOk, openaiOk] = await Promise.all([
      testDatabaseConnection(),
      testRedisConnection(),
      testMassiveConnection(),
      testOpenAIConnection()
    ]);

    checks.services.database = dbOk;
    checks.services.redis = redisOk;
    checks.services.massive = massiveOk;
    checks.services.openai = openaiOk;

    // Redis is optional - don't degrade overall status if missing
    const coreOk = dbOk && massiveOk && openaiOk;
    checks.status = coreOk ? (redisOk ? 'ok' : 'degraded') : 'unhealthy';

    const statusCode = coreOk ? 200 : 503;
    return res.status(statusCode).json(checks);
  } catch (error) {
    console.error('Health check failed:', error);
    return res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      services: checks.services,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Diagnostic endpoint - tests each component individually with details
router.get('/diagnose', async (_req: Request, res: Response) => {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // 1. Test Supabase connection
  try {
    const { error } = await supabase
      .from('ai_coach_sessions')
      .select('count')
      .limit(1);
    results.checks.supabase_sessions_table = error
      ? { ok: false, error: error.message, code: error.code }
      : { ok: true };
  } catch (e: any) {
    results.checks.supabase_sessions_table = { ok: false, error: e.message };
  }

  // 2. Test ai_coach_messages table
  try {
    const { error } = await supabase
      .from('ai_coach_messages')
      .select('count')
      .limit(1);
    results.checks.supabase_messages_table = error
      ? { ok: false, error: error.message, code: error.code }
      : { ok: true };
  } catch (e: any) {
    results.checks.supabase_messages_table = { ok: false, error: e.message };
  }

  // 3. Test ai_coach_users table
  try {
    const { error } = await supabase
      .from('ai_coach_users')
      .select('count')
      .limit(1);
    results.checks.supabase_users_table = error
      ? { ok: false, error: error.message, code: error.code }
      : { ok: true };
  } catch (e: any) {
    results.checks.supabase_users_table = { ok: false, error: e.message };
  }

  // 4. Test OpenAI API with a minimal completion
  try {
    const completion = await openaiClient.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: 'user', content: 'Say "ok"' }],
      max_tokens: 5
    });
    results.checks.openai_completion = {
      ok: true,
      model: CHAT_MODEL,
      response: completion.choices[0]?.message?.content,
      tokens: completion.usage?.total_tokens
    };
  } catch (e: any) {
    results.checks.openai_completion = {
      ok: false,
      error: e.message,
      status: e.status,
      code: e.code,
      type: e.type
    };
  }

  // 5. Test Redis
  try {
    const redisOk = await testRedisConnection();
    results.checks.redis = { ok: redisOk, note: redisOk ? 'connected' : 'not configured or unavailable' };
  } catch (e: any) {
    results.checks.redis = { ok: false, error: e.message };
  }

  // 6. Test Massive.com
  try {
    const massiveOk = await testMassiveConnection();
    results.checks.massive = { ok: massiveOk };
  } catch (e: any) {
    results.checks.massive = { ok: false, error: e.message };
  }

  // Summary
  const allChecks = Object.values(results.checks) as any[];
  const failedChecks = allChecks.filter(c => !c.ok);
  results.summary = {
    total: allChecks.length,
    passed: allChecks.length - failedChecks.length,
    failed: failedChecks.length,
    status: failedChecks.length === 0 ? 'all_ok' : 'issues_found'
  };

  return res.json(results);
});

export default router;
