import { Router, Request, Response } from 'express';
import { testDatabaseConnection, supabase } from '../config/database';
import { testRedisConnection } from '../config/redis';
import { testMassiveConnection, getDailyAggregates, getMinuteAggregates, getOptionsContracts, getOptionsExpirations } from '../config/massive';
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

// Test all Massive.com data endpoints
router.get('/test-massive', async (_req: Request, res: Response) => {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    note: 'Market data may be empty on weekends/holidays',
    tests: {}
  };

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // 1. SPX Daily Aggregates (30 days)
  try {
    const bars = await getDailyAggregates('I:SPX', thirtyDaysAgo, today);
    results.tests.spx_daily = {
      ok: true,
      bars: bars.length,
      latestDate: bars.length > 0 ? new Date(bars[bars.length - 1].t).toISOString().split('T')[0] : null,
      latestClose: bars.length > 0 ? bars[bars.length - 1].c : null
    };
  } catch (e: any) {
    results.tests.spx_daily = { ok: false, error: e.message };
  }

  // 2. NDX Daily Aggregates (30 days)
  try {
    const bars = await getDailyAggregates('I:NDX', thirtyDaysAgo, today);
    results.tests.ndx_daily = {
      ok: true,
      bars: bars.length,
      latestDate: bars.length > 0 ? new Date(bars[bars.length - 1].t).toISOString().split('T')[0] : null,
      latestClose: bars.length > 0 ? bars[bars.length - 1].c : null
    };
  } catch (e: any) {
    results.tests.ndx_daily = { ok: false, error: e.message };
  }

  // 3. SPX Minute Aggregates (today - may be empty on weekends)
  try {
    const bars = await getMinuteAggregates('I:SPX', today);
    results.tests.spx_intraday_today = {
      ok: true,
      bars: bars.length,
      note: bars.length === 0 ? 'No intraday data (market may be closed)' : `${bars.length} minute bars`
    };
  } catch (e: any) {
    results.tests.spx_intraday_today = { ok: false, error: e.message };
  }

  // 4. SPX Minute Aggregates (last trading day - should always have data)
  try {
    const bars = await getMinuteAggregates('I:SPX', yesterday);
    results.tests.spx_intraday_yesterday = {
      ok: true,
      bars: bars.length,
      note: bars.length === 0 ? 'No data for yesterday (may be weekend/holiday)' : `${bars.length} minute bars`
    };
  } catch (e: any) {
    results.tests.spx_intraday_yesterday = { ok: false, error: e.message };
  }

  // 5. SPX Options Contracts
  try {
    const contracts = await getOptionsContracts('SPX');
    results.tests.spx_options_contracts = {
      ok: true,
      contractCount: contracts.length,
      sampleContract: contracts.length > 0 ? {
        ticker: contracts[0].ticker,
        strike: contracts[0].strike_price,
        expiry: contracts[0].expiration_date,
        type: contracts[0].contract_type
      } : null
    };
  } catch (e: any) {
    results.tests.spx_options_contracts = { ok: false, error: e.message };
  }

  // 6. SPX Options Expirations
  try {
    const expirations = await getOptionsExpirations('SPX');
    results.tests.spx_options_expirations = {
      ok: true,
      expirationCount: expirations.length,
      nearest: expirations.length > 0 ? expirations[0] : null,
      furthest: expirations.length > 0 ? expirations[expirations.length - 1] : null
    };
  } catch (e: any) {
    results.tests.spx_options_expirations = { ok: false, error: e.message };
  }

  // 7. NDX Options Contracts
  try {
    const contracts = await getOptionsContracts('NDX');
    results.tests.ndx_options_contracts = {
      ok: true,
      contractCount: contracts.length,
      sampleContract: contracts.length > 0 ? {
        ticker: contracts[0].ticker,
        strike: contracts[0].strike_price,
        expiry: contracts[0].expiration_date,
        type: contracts[0].contract_type
      } : null
    };
  } catch (e: any) {
    results.tests.ndx_options_contracts = { ok: false, error: e.message };
  }

  // Summary
  const allTests = Object.values(results.tests) as any[];
  const failedTests = allTests.filter(t => !t.ok);
  results.summary = {
    total: allTests.length,
    passed: allTests.length - failedTests.length,
    failed: failedTests.length,
    status: failedTests.length === 0 ? 'all_ok' : 'issues_found'
  };

  return res.json(results);
});

export default router;
