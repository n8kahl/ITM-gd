import { Router, Request, Response } from 'express';
import { testDatabaseConnection, supabase } from '../config/database';
import { testRedisConnection } from '../config/redis';
import { testMassiveConnection, getDailyAggregates, getMinuteAggregates, getOptionsContracts, getOptionsExpirations } from '../config/massive';
import { testOpenAIConnection, openaiClient, CHAT_MODEL } from '../config/openai';
import { logger } from '../lib/logger';
import { authenticateToken } from '../middleware/auth';
import { getWorkerHealthSnapshot } from '../services/workerHealth';
import { getMassiveTickStreamStatus } from '../services/massiveTickStream';
import { getLatestTick } from '../services/tickCache';
import { getMarketStatus } from '../services/marketHours';
import { getWebSocketHealth } from '../services/websocket';
import { TradierClient } from '../services/broker/tradier/client';
import { getTradierExecutionRuntimeStatus } from '../services/broker/tradier/executionEngine';

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

interface ReadinessResult {
  checks: NonNullable<HealthCheck['checks']>;
  overallHealthy: boolean;
  services: {
    database: boolean;
    redis: boolean;
    massive: boolean;
    massiveTick: boolean;
    openai: boolean;
    tradier: boolean;
  };
}

const TRADIER_HEALTHCHECK_TIMEOUT_MS = 5000;

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

async function runReadinessChecks(): Promise<ReadinessResult> {
  const checks: NonNullable<HealthCheck['checks']> = {};
  let overallHealthy = true;

  const dbStart = Date.now();
  try {
    const dbOk = await testDatabaseConnection();
    checks.database = { status: dbOk ? 'pass' : 'fail', latency: Date.now() - dbStart };
    if (!dbOk) overallHealthy = false;
  } catch (_err) {
    checks.database = { status: 'fail', latency: Date.now() - dbStart, message: 'Connection failed' };
    overallHealthy = false;
  }

  const redisStart = Date.now();
  try {
    const redisOk = await testRedisConnection();
    checks.redis = { status: redisOk ? 'pass' : 'fail', latency: Date.now() - redisStart };
  } catch (_err) {
    checks.redis = { status: 'fail', latency: Date.now() - redisStart, message: 'Connection failed' };
  }

  const massiveStart = Date.now();
  try {
    const massiveOk = await testMassiveConnection();
    checks.massive = { status: massiveOk ? 'pass' : 'fail', latency: Date.now() - massiveStart };
    if (!massiveOk) overallHealthy = false;
  } catch (_err) {
    checks.massive = { status: 'fail', latency: Date.now() - massiveStart, message: 'Connection failed' };
    overallHealthy = false;
  }

  const aiStart = Date.now();
  try {
    const aiOk = await testOpenAIConnection();
    checks.openai = { status: aiOk ? 'pass' : 'fail', latency: Date.now() - aiStart };
    if (!aiOk) overallHealthy = false;
  } catch (_err) {
    checks.openai = { status: 'fail', latency: Date.now() - aiStart, message: 'Connection failed' };
    overallHealthy = false;
  }

  const tradierStart = Date.now();
  const tradierRuntime = getTradierExecutionRuntimeStatus();
  const tradierAccountId = (
    process.env.TRADIER_HEALTHCHECK_ACCOUNT_ID
    || process.env.TRADIER_ACCOUNT_ID
    || ''
  ).trim();
  const tradierAccessToken = (
    process.env.TRADIER_HEALTHCHECK_ACCESS_TOKEN
    || process.env.TRADIER_ACCESS_TOKEN
    || ''
  ).trim();
  const tradierSandbox = parseBooleanEnv(
    process.env.TRADIER_HEALTHCHECK_SANDBOX
      || process.env.TRADIER_SANDBOX
      || process.env.TRADIER_EXECUTION_SANDBOX,
    true,
  );
  const tradierCredentialsConfigured = Boolean(tradierAccountId && tradierAccessToken);
  const tradierCheckRequired = tradierRuntime.enabled || tradierCredentialsConfigured;

  if (!tradierCheckRequired) {
    checks.tradier = {
      status: 'pass',
      latency: Date.now() - tradierStart,
      message: 'check skipped (runtime disabled and no healthcheck credentials configured)',
    };
  } else if (!tradierCredentialsConfigured) {
    checks.tradier = {
      status: 'fail',
      latency: Date.now() - tradierStart,
      message: 'runtime enabled but TRADIER_HEALTHCHECK_ACCOUNT_ID/TRADIER_HEALTHCHECK_ACCESS_TOKEN are not configured',
    };
    overallHealthy = false;
  } else {
    try {
      const tradier = new TradierClient({
        accountId: tradierAccountId,
        accessToken: tradierAccessToken,
        sandbox: tradierSandbox,
        timeoutMs: TRADIER_HEALTHCHECK_TIMEOUT_MS,
      });
      await tradier.getBalances();
      checks.tradier = {
        status: 'pass',
        latency: Date.now() - tradierStart,
        message: `account connectivity ok (${tradierSandbox ? 'sandbox' : 'production'})`,
      };
    } catch (_err) {
      checks.tradier = {
        status: 'fail',
        latency: Date.now() - tradierStart,
        message: 'Tradier account connectivity failed',
      };
      overallHealthy = false;
    }
  }

  const tickStream = getMassiveTickStreamStatus();
  const tickConnected = tickStream.enabled && tickStream.connected;
  const latestSpxTick = getLatestTick('SPX');
  const latestSpyTick = getLatestTick('SPY');
  const latestTick = latestSpxTick || latestSpyTick;
  const latestTickAgeMs = latestTick ? Math.max(0, Date.now() - latestTick.timestamp) : null;
  const marketStatus = getMarketStatus();
  const marketActive = marketStatus.status === 'open' || marketStatus.status === 'pre-market' || marketStatus.status === 'after-hours';
  const tickFresh = latestTickAgeMs != null && latestTickAgeMs <= 15_000;
  const tickHealthy = tickConnected && (!marketActive || tickFresh);
  checks.massive_tick_stream = {
    status: tickHealthy ? 'pass' : 'fail',
    latency: 0,
    message: tickHealthy
      ? `connected (${tickStream.subscribedSymbols.join(', ') || 'no symbols'})${latestTickAgeMs != null ? ` · tick age ${Math.floor(latestTickAgeMs / 1000)}s` : ''}`
      : tickConnected
        ? `connected but stale ticks${latestTickAgeMs != null ? ` (${Math.floor(latestTickAgeMs / 1000)}s old)` : ''}`
      : tickStream.enabled
        ? 'enabled but disconnected'
        : 'disabled',
  };
  if (process.env.NODE_ENV === 'production' && !tickHealthy) {
    overallHealthy = false;
  }

  return {
    checks,
    overallHealthy,
    services: {
      database: checks.database?.status === 'pass',
      redis: checks.redis?.status === 'pass',
      massive: checks.massive?.status === 'pass',
      massiveTick: tickHealthy,
      openai: checks.openai?.status === 'pass',
      tradier: checks.tradier?.status === 'pass',
    },
  };
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
  const { checks, overallHealthy } = await runReadinessChecks();

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

router.get('/detailed', async (_req: Request, res: Response) => {
  const { checks, overallHealthy, services } = await runReadinessChecks();
  const response = {
    status: overallHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services,
    checks,
  };

  const statusCode = overallHealthy ? 200 : 503;
  if (!overallHealthy) {
    logger.warn('Detailed health check failed', { checks });
  }
  return res.status(statusCode).json(response);
});

router.get('/ws', authenticateToken, (_req: Request, res: Response) => {
  return res.status(200).json(getWebSocketHealth());
});

router.get('/workers', (_req: Request, res: Response) => {
  const workers = getWorkerHealthSnapshot();
  const nowMs = Date.now();
  const staleThresholdMs = 20 * 60 * 1000; // 20 minutes

  const staleWorkers = workers.filter((worker) => {
    if (!worker.isRunning) return false;
    if (!worker.lastCycleCompletedAt) return false;

    const lastCycleMs = Date.parse(worker.lastCycleCompletedAt);
    return Number.isFinite(lastCycleMs) && nowMs - lastCycleMs > staleThresholdMs;
  });

  const response = {
    status: staleWorkers.length === 0 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    summary: {
      total: workers.length,
      running: workers.filter((worker) => worker.isRunning).length,
      stale: staleWorkers.length,
    },
    staleThresholdMs,
    workers,
  };

  return res.status(staleWorkers.length === 0 ? 200 : 503).json(response);
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
  try { const expirations = await getOptionsExpirations('SPX', { maxDaysAhead: 45, maxPages: 6 }); results.tests.spx_options_expirations = { ok: true, expirationCount: expirations.length, nearest: expirations.length > 0 ? expirations[0] : null, furthest: expirations.length > 0 ? expirations[expirations.length - 1] : null }; } catch (e: any) { results.tests.spx_options_expirations = { ok: false, error: e.message }; }
  try { const contracts = await getOptionsContracts('NDX'); results.tests.ndx_options_contracts = { ok: true, contractCount: contracts.length, sampleContract: contracts.length > 0 ? { ticker: contracts[0].ticker, strike: contracts[0].strike_price, expiry: contracts[0].expiration_date, type: contracts[0].contract_type } : null }; } catch (e: any) { results.tests.ndx_options_contracts = { ok: false, error: e.message }; }

  const allTests = Object.values(results.tests) as any[];
  const failedTests = allTests.filter(t => !t.ok);
  results.summary = { total: allTests.length, passed: allTests.length - failedTests.length, failed: failedTests.length, status: failedTests.length === 0 ? 'all_ok' : 'issues_found' };
  return res.json(results);
});

export default router;
