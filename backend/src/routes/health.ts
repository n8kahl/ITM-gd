import { Router, Request, Response } from 'express';
import { testDatabaseConnection, supabase } from '../config/database';
import { testRedisConnection } from '../config/redis';
import { testMassiveConnection, getDailyAggregates, getMinuteAggregates, getOptionsContracts, getOptionsExpirations } from '../config/massive';
import { testOpenAIConnection, openaiClient, CHAT_MODEL } from '../config/openai';
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

router.get('/', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

router.get('/ready', async (_req: Request, res: Response) => {
  const checks: HealthCheck['checks'] = {};
  let overallHealthy = true;

  const dbStart = Date.now();
  try {
    const dbOk = await testDatabaseConnection();
    checks.database = { status: dbOk ? 'pass' : 'fail', latency: Date.now() - dbStart };
    if (!dbOk) overallHealthy = false;
  } catch (err) {
    checks.database = { status: 'fail', latency: Date.now() - dbStart, message: 'Connection failed' };
    overallHealthy = false;
  }

  const redisStart = Date.now();
  try {
    const redisOk = await testRedisConnection();
    checks.redis = { status: redisOk ? 'pass' : 'fail', latency: Date.now() - redisStart };
  } catch (err) {
    checks.redis = { status: 'fail', latency: Date.now() - redisStart, message: 'Connection failed' };
  }

  const massiveStart = Date.now();
  try {
    const massiveOk = await testMassiveConnection();
    checks.massive = { status: massiveOk ? 'pass' : 'fail', latency: Date.now() - massiveStart };
    if (!massiveOk) overallHealthy = false;
  } catch (err) {
    checks.massive = { status: 'fail', latency: Date.now() - massiveStart, message: 'Connection failed' };
    overallHealthy = false;
  }

  const aiStart = Date.now();
  try {
    const aiOk = await testOpenAIConnection();
    checks.openai = { status: aiOk ? 'pass' : 'fail', latency: Date.now() - aiStart };
    if (!aiOk) overallHealthy = false;
  } catch (err) {
    checks.openai = { status: 'fail', latency: Date.now() - aiStart, message: 'Connection failed' };
    overallHealthy = false;
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
  return res.status(statusCode).json(response);
});

router.get('/diagnose', async (_req: Request, res: Response) => {
  const results: Record<string, any> = { timestamp: new Date().toISOString(), checks: {} };

  try {
    const { error } = await supabase.from('ai_coach_sessions').select('count').limit(1);
    results.checks.supabase_sessions_table = error ? { ok: false, error: error.message, code: error.code } : { ok: true };
  } catch (e: any) { results.checks.supabase_sessions_table = { ok: false, error: e.message }; }

  try {
    const { error } = await supabase.from('ai_coach_messages').select('count').limit(1);
    results.checks.supabase_messages_table = error ? { ok: false, error: error.message, code: error.code } : { ok: true };
  } catch (e: any) { results.checks.supabase_messages_table = { ok: false, error: e.message }; }

  try {
    const { error } = await supabase.from('ai_coach_users').select('count').limit(1);
    results.checks.supabase_users_table = error ? { ok: false, error: error.message, code: error.code } : { ok: true };
  } catch (e: any) { results.checks.supabase_users_table = { ok: false, error: e.message }; }

  try {
    const completion = await openaiClient.chat.completions.create({ model: CHAT_MODEL, messages: [{ role: 'user', content: 'Say "ok"' }], max_tokens: 5 });
    results.checks.openai_completion = { ok: true, model: CHAT_MODEL, response: completion.choices[0]?.message?.content, tokens: completion.usage?.total_tokens };
  } catch (e: any) { results.checks.openai_completion = { ok: false, error: e.message, status: e.status, code: e.code, type: e.type }; }

  try {
    const redisOk = await testRedisConnection();
    results.checks.redis = { ok: redisOk, note: redisOk ? 'connected' : 'not configured or unavailable' };
  } catch (e: any) { results.checks.redis = { ok: false, error: e.message }; }

  try {
    const massiveOk = await testMassiveConnection();
    results.checks.massive = { ok: massiveOk };
  } catch (e: any) { results.checks.massive = { ok: false, error: e.message }; }

  const allChecks = Object.values(results.checks) as any[];
  const failedChecks = allChecks.filter(c => !c.ok);
  results.summary = { total: allChecks.length, passed: allChecks.length - failedChecks.length, failed: failedChecks.length, status: failedChecks.length === 0 ? 'all_ok' : 'issues_found' };
  return res.json(results);
});

router.get('/test-massive', async (_req: Request, res: Response) => {
  const results: Record<string, any> = { timestamp: new Date().toISOString(), note: 'Market data may be empty on weekends/holidays', tests: {} };
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  try { const bars = await getDailyAggregates('I:SPX', thirtyDaysAgo, today); results.tests.spx_daily = { ok: true, bars: bars.length, latestDate: bars.length > 0 ? new Date(bars[bars.length - 1].t).toISOString().split('T')[0] : null, latestClose: bars.length > 0 ? bars[bars.length - 1].c : null }; } catch (e: any) { results.tests.spx_daily = { ok: false, error: e.message }; }
  try { const bars = await getDailyAggregates('I:NDX', thirtyDaysAgo, today); results.tests.ndx_daily = { ok: true, bars: bars.length, latestDate: bars.length > 0 ? new Date(bars[bars.length - 1].t).toISOString().split('T')[0] : null, latestClose: bars.length > 0 ? bars[bars.length - 1].c : null }; } catch (e: any) { results.tests.ndx_daily = { ok: false, error: e.message }; }
  try { const bars = await getMinuteAggregates('I:SPX', today); results.tests.spx_intraday_today = { ok: true, bars: bars.length, note: bars.length === 0 ? 'No intraday data (market may be closed)' : `${bars.length} minute bars` }; } catch (e: any) { results.tests.spx_intraday_today = { ok: false, error: e.message }; }
  try { const bars = await getMinuteAggregates('I:SPX', yesterday); results.tests.spx_intraday_yesterday = { ok: true, bars: bars.length, note: bars.length === 0 ? 'No data for yesterday (may be weekend/holiday)' : `${bars.length} minute bars` }; } catch (e: any) { results.tests.spx_intraday_yesterday = { ok: false, error: e.message }; }
  try { const contracts = await getOptionsContracts('SPX'); results.tests.spx_options_contracts = { ok: true, contractCount: contracts.length, sampleContract: contracts.length > 0 ? { ticker: contracts[0].ticker, strike: contracts[0].strike_price, expiry: contracts[0].expiration_date, type: contracts[0].contract_type } : null }; } catch (e: any) { results.tests.spx_options_contracts = { ok: false, error: e.message }; }
  try { const expirations = await getOptionsExpirations('SPX'); results.tests.spx_options_expirations = { ok: true, expirationCount: expirations.length, nearest: expirations.length > 0 ? expirations[0] : null, furthest: expirations.length > 0 ? expirations[expirations.length - 1] : null }; } catch (e: any) { results.tests.spx_options_expirations = { ok: false, error: e.message }; }
  try { const contracts = await getOptionsContracts('NDX'); results.tests.ndx_options_contracts = { ok: true, contractCount: contracts.length, sampleContract: contracts.length > 0 ? { ticker: contracts[0].ticker, strike: contracts[0].strike_price, expiry: contracts[0].expiration_date, type: contracts[0].contract_type } : null }; } catch (e: any) { results.tests.ndx_options_contracts = { ok: false, error: e.message }; }

  const allTests = Object.values(results.tests) as any[];
  const failedTests = allTests.filter(t => !t.ok);
  results.summary = { total: allTests.length, passed: allTests.length - failedTests.length, failed: failedTests.length, status: failedTests.length === 0 ? 'all_ok' : 'issues_found' };
  return res.json(results);
});

export default router;
