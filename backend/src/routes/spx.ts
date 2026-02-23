import { Router, Request, Response } from 'express';
import { supabase } from '../config/database';
import { logger } from '../lib/logger';
import { authenticateToken } from '../middleware/auth';
import { requireTier } from '../middleware/requireTier';
import { getPredictionState } from '../services/spx/aiPredictor';
import { generateCoachStream, getCoachState } from '../services/spx/aiCoach';
import { generateCoachDecision } from '../services/spx/coachDecisionEngine';
import { getContractRecommendation } from '../services/spx/contractSelector';
import { getBasisState } from '../services/spx/crossReference';
import { getFibLevels } from '../services/spx/fibEngine';
import { getFlowEvents } from '../services/spx/flowEngine';
import { computeUnifiedGEXLandscape } from '../services/spx/gexEngine';
import { getSPXSnapshot } from '../services/spx';
import { getMergedLevels } from '../services/spx/levelEngine';
import { getSPXWinRateAnalytics } from '../services/spx/outcomeTracker';
import {
  getSPXOptimizerScorecard,
  getActiveSPXOptimizationProfile,
  runSPXOptimizerScan,
} from '../services/spx/optimizer';
import { getSPXOptimizerWorkerStatus } from '../workers/spxOptimizerWorker';
import {
  runSPXWinRateBacktest,
  type SPXBacktestPriceResolution,
  type SPXWinRateBacktestSource,
} from '../services/spx/winRateBacktest';
import { classifyCurrentRegime } from '../services/spx/regimeClassifier';
import { detectActiveSetups, getSetupById } from '../services/spx/setupDetector';
import type { CoachDecisionRequest, Setup } from '../services/spx/types';
import { toEasternTime } from '../services/marketHours';
import { TradierClient } from '../services/broker/tradier/client';
import {
  decryptTradierAccessToken,
  isTradierProductionRuntimeEnabled,
} from '../services/broker/tradier/credentials';
import { getTradierExecutionRuntimeStatus } from '../services/broker/tradier/executionEngine';
import {
  loadOpenStatesWithOrders,
  closeAllUserStates,
} from '../services/spx/executionStateStore';

const router = Router();

function parseBoolean(value: unknown): boolean {
  return String(value || '').toLowerCase() === 'true';
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseISODateInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = Date.parse(`${trimmed}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return trimmed;
}

function dateDaysAgoET(days: number): string {
  return toEasternTime(new Date(Date.now() - (days * 86400000))).dateStr;
}

function parseBacktestSource(value: unknown): SPXWinRateBacktestSource {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'spx_setup_instances' || normalized === 'instances') return 'spx_setup_instances';
  if (normalized === 'ai_coach_tracked_setups' || normalized === 'legacy') return 'ai_coach_tracked_setups';
  return 'spx_setup_instances';
}

function parseBacktestResolution(value: unknown): SPXBacktestPriceResolution {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'second' || normalized === '1s') return 'second';
  if (normalized === 'minute' || normalized === '1m') return 'minute';
  return 'second';
}

function parseSetupPayload(value: unknown): Setup | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const setup = value as Partial<Setup>;
  if (typeof setup.id !== 'string' || setup.id.length === 0) return null;
  if (setup.entryZone == null || typeof setup.entryZone !== 'object') return null;
  if (typeof setup.entryZone.low !== 'number' || typeof setup.entryZone.high !== 'number') return null;
  if (typeof setup.stop !== 'number') return null;
  if (setup.target1 == null || typeof setup.target1 !== 'object') return null;
  if (setup.target2 == null || typeof setup.target2 !== 'object') return null;
  if (typeof setup.target1.price !== 'number' || typeof setup.target2.price !== 'number') return null;
  if (typeof setup.direction !== 'string' || typeof setup.type !== 'string') return null;
  return setup as Setup;
}

router.use(authenticateToken, requireTier('pro'));

router.get('/snapshot', async (req: Request, res: Response) => {
  try {
    const snapshot = await getSPXSnapshot({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json(snapshot);
  } catch (error) {
    logger.error('SPX snapshot endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX command center snapshot.',
      retryAfter: 10,
    });
  }
});

router.get('/analytics/win-rate', async (req: Request, res: Response) => {
  try {
    const to = parseISODateInput(req.query.to) || dateDaysAgoET(0);
    const from = parseISODateInput(req.query.from) || dateDaysAgoET(29);

    if (from > to) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: 'Query parameter "from" must be on or before "to" (YYYY-MM-DD).',
      });
    }

    const analytics = await getSPXWinRateAnalytics({ from, to });
    return res.json(analytics);
  } catch (error) {
    logger.error('SPX win-rate analytics endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to compute SPX win-rate analytics.',
      retryAfter: 10,
    });
  }
});

router.get('/analytics/win-rate/backtest', async (req: Request, res: Response) => {
  try {
    const to = parseISODateInput(req.query.to) || dateDaysAgoET(0);
    const from = parseISODateInput(req.query.from) || dateDaysAgoET(29);
    const source = parseBacktestSource(req.query.source);
    const resolution = parseBacktestResolution(req.query.resolution);

    if (from > to) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: 'Query parameter "from" must be on or before "to" (YYYY-MM-DD).',
      });
    }

    const optimizerProfile = await getActiveSPXOptimizationProfile();
    const backtest = await runSPXWinRateBacktest({
      from,
      to,
      source,
      resolution,
      executionModel: {
        partialAtT1Pct: optimizerProfile.tradeManagement.partialAtT1Pct,
        moveStopToBreakevenAfterT1: optimizerProfile.tradeManagement.moveStopToBreakeven,
      },
    });
    return res.json(backtest);
  } catch (error) {
    logger.error('SPX win-rate backtest endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to run SPX win-rate backtest.',
      retryAfter: 10,
    });
  }
});

router.get('/analytics/optimizer/scorecard', async (_req: Request, res: Response) => {
  try {
    const scorecard = await getSPXOptimizerScorecard();
    return res.json(scorecard);
  } catch (error) {
    logger.error('SPX optimizer scorecard endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX optimizer scorecard.',
      retryAfter: 10,
    });
  }
});

router.get('/analytics/optimizer/schedule', async (_req: Request, res: Response) => {
  try {
    const scorecard = await getSPXOptimizerScorecard();
    const schedule = getSPXOptimizerWorkerStatus();
    return res.json({
      ...schedule,
      lastOptimizationGeneratedAt: scorecard.generatedAt,
      lastOptimizationRange: scorecard.scanRange,
      lastOptimizationApplied: scorecard.optimizationApplied,
    });
  } catch (error) {
    logger.error('SPX optimizer schedule endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX optimizer schedule.',
      retryAfter: 10,
    });
  }
});

router.post('/analytics/optimizer/scan', async (req: Request, res: Response) => {
  try {
    const from = parseISODateInput(req.body?.from) || undefined;
    const to = parseISODateInput(req.body?.to) || undefined;

    const result = await runSPXOptimizerScan({ from, to });
    return res.json(result);
  } catch (error) {
    logger.error('SPX optimizer scan endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to run SPX optimizer scan.',
      retryAfter: 10,
    });
  }
});

router.get('/levels', async (req: Request, res: Response) => {
  try {
    const data = await getMergedLevels({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json({
      levels: data.levels,
      generatedAt: data.generatedAt,
    });
  } catch (error) {
    logger.error('SPX levels endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX levels at the moment.',
      retryAfter: 10,
    });
  }
});

router.get('/clusters', async (req: Request, res: Response) => {
  try {
    const data = await getMergedLevels({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json({
      zones: data.clusters,
      generatedAt: data.generatedAt,
    });
  } catch (error) {
    logger.error('SPX clusters endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX cluster zones right now.',
      retryAfter: 10,
    });
  }
});

router.get('/gex', async (req: Request, res: Response) => {
  try {
    const forceRefresh = parseBoolean(req.query.forceRefresh);
    const gex = await computeUnifiedGEXLandscape({ forceRefresh });
    return res.json(gex);
  } catch (error) {
    logger.error('SPX GEX endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to compute GEX profile.',
      retryAfter: 10,
    });
  }
});

router.get('/gex/history', async (req: Request, res: Response) => {
  try {
    const symbol = typeof req.query.symbol === 'string' ? req.query.symbol.toUpperCase() : 'SPX';
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 60)));

    const { data, error } = await supabase
      .from('spx_gex_snapshots')
      .select('*')
      .eq('symbol', symbol)
      .order('snapshot_time', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return res.json({
      symbol,
      snapshots: data || [],
      count: (data || []).length,
    });
  } catch (error) {
    logger.error('SPX GEX history endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load GEX history snapshots.',
      retryAfter: 10,
    });
  }
});

router.get('/setups', async (req: Request, res: Response) => {
  try {
    const setups = await detectActiveSetups({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json({
      setups,
      count: setups.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('SPX setups endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load active setups.',
      retryAfter: 10,
    });
  }
});

router.get('/setups/:id', async (req: Request, res: Response) => {
  try {
    const setup = await getSetupById(req.params.id, { forceRefresh: parseBoolean(req.query.forceRefresh) });
    if (!setup) {
      return res.status(404).json({
        error: 'Not found',
        message: `Setup ${req.params.id} was not found`,
      });
    }

    return res.json(setup);
  } catch (error) {
    logger.error('SPX setup detail endpoint failed', {
      setupId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load setup details.',
      retryAfter: 10,
    });
  }
});

router.get('/fibonacci', async (req: Request, res: Response) => {
  try {
    const levels = await getFibLevels({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json({
      levels,
      count: levels.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('SPX fibonacci endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load fibonacci levels.',
      retryAfter: 10,
    });
  }
});

router.get('/flow', async (req: Request, res: Response) => {
  try {
    const events = await getFlowEvents({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json({
      events,
      count: events.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('SPX flow endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load options flow feed.',
      retryAfter: 10,
    });
  }
});

router.get('/regime', async (req: Request, res: Response) => {
  try {
    const forceRefresh = parseBoolean(req.query.forceRefresh);
    const [regime, prediction] = await Promise.all([
      classifyCurrentRegime({ forceRefresh }),
      getPredictionState({ forceRefresh }),
    ]);

    return res.json({
      ...regime,
      prediction,
    });
  } catch (error) {
    logger.error('SPX regime endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to classify current regime.',
      retryAfter: 10,
    });
  }
});

router.get('/basis', async (req: Request, res: Response) => {
  try {
    const basis = await getBasisState({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json(basis);
  } catch (error) {
    logger.error('SPX basis endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX/SPY basis state.',
      retryAfter: 10,
    });
  }
});

router.get('/contract-select', async (req: Request, res: Response) => {
  try {
    const setupId = typeof req.query.setupId === 'string' ? req.query.setupId : undefined;
    const totalEquity = parseFiniteNumber(req.query.totalEquity);
    const dayTradeBuyingPower = parseFiniteNumber(req.query.dayTradeBuyingPower);
    const maxRiskPct = parseFiniteNumber(req.query.maxRiskPct);
    const buyingPowerUtilizationPct = parseFiniteNumber(req.query.buyingPowerUtilizationPct);
    const hasRiskOverride = [totalEquity, dayTradeBuyingPower, maxRiskPct, buyingPowerUtilizationPct]
      .some((value) => value != null);
    const recommendation = await getContractRecommendation({
      setupId,
      forceRefresh: parseBoolean(req.query.forceRefresh),
      userId: req.user?.id,
      riskContext: hasRiskOverride
        ? {
          totalEquity: totalEquity ?? undefined,
          dayTradeBuyingPower: dayTradeBuyingPower ?? undefined,
          maxRiskPct: maxRiskPct ?? undefined,
          buyingPowerUtilizationPct: buyingPowerUtilizationPct ?? undefined,
        }
        : undefined,
    });

    if (!recommendation) {
      return res.status(404).json({
        error: 'No recommendation',
        message: 'No qualifying setup/contract recommendation is currently available.',
      });
    }

    return res.json(recommendation);
  } catch (error) {
    logger.error('SPX contract selector endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to compute contract recommendation.',
      retryAfter: 10,
    });
  }
});

router.post('/contract-select', async (req: Request, res: Response) => {
  try {
    const setupId = typeof req.body?.setupId === 'string' ? req.body.setupId : undefined;
    const setup = parseSetupPayload(req.body?.setup);
    const totalEquity = parseFiniteNumber(req.body?.totalEquity);
    const dayTradeBuyingPower = parseFiniteNumber(req.body?.dayTradeBuyingPower);
    const maxRiskPct = parseFiniteNumber(req.body?.maxRiskPct);
    const buyingPowerUtilizationPct = parseFiniteNumber(req.body?.buyingPowerUtilizationPct);
    const hasRiskOverride = [totalEquity, dayTradeBuyingPower, maxRiskPct, buyingPowerUtilizationPct]
      .some((value) => value != null);
    const recommendation = await getContractRecommendation({
      setupId,
      setup,
      forceRefresh: parseBoolean(req.body?.forceRefresh),
      userId: req.user?.id,
      riskContext: hasRiskOverride
        ? {
          totalEquity: totalEquity ?? undefined,
          dayTradeBuyingPower: dayTradeBuyingPower ?? undefined,
          maxRiskPct: maxRiskPct ?? undefined,
          buyingPowerUtilizationPct: buyingPowerUtilizationPct ?? undefined,
        }
        : undefined,
    });

    if (!recommendation) {
      return res.status(404).json({
        error: 'No recommendation',
        message: 'No qualifying setup/contract recommendation is currently available.',
      });
    }

    return res.json(recommendation);
  } catch (error) {
    logger.error('SPX contract selector POST endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to compute contract recommendation.',
      retryAfter: 10,
    });
  }
});

router.get('/broker/tradier/status', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    const { data: credentialRow, error: credentialError } = await supabase
      .from('broker_credentials')
      .select('broker_name,account_id,is_active,metadata,updated_at')
      .eq('user_id', userId)
      .eq('broker_name', 'tradier')
      .maybeSingle();
    if (credentialError) {
      throw credentialError;
    }

    const { data: snapshotRow, error: snapshotError } = await supabase
      .from('portfolio_snapshots')
      .select('snapshot_time,total_equity,day_trade_buying_power,realized_pnl_daily')
      .eq('user_id', userId)
      .order('snapshot_time', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapshotError) {
      throw snapshotError;
    }

    const runtime = getTradierExecutionRuntimeStatus();
    const portfolioSyncRuntime = isTradierProductionRuntimeEnabled({
      baseEnabled: String(process.env.TRADIER_PORTFOLIO_SYNC_ENABLED || 'false').toLowerCase() === 'true',
      productionEnableEnv: process.env.TRADIER_PORTFOLIO_SYNC_PRODUCTION_ENABLED,
    });

    const metadata = (credentialRow as { metadata?: Record<string, unknown> } | null)?.metadata || {};
    const accountId = (credentialRow as { account_id?: string } | null)?.account_id;
    const maskedAccountId = typeof accountId === 'string' && accountId.length > 4
      ? `****${accountId.slice(-4)}`
      : accountId || null;

    return res.json({
      broker: 'tradier',
      credential: credentialRow
        ? {
          configured: true,
          isActive: Boolean((credentialRow as { is_active?: unknown }).is_active),
          accountIdMasked: maskedAccountId,
          sandbox: typeof metadata.tradier_sandbox === 'boolean' ? metadata.tradier_sandbox : null,
          autoExecute: typeof metadata.spx_auto_execute === 'boolean' ? metadata.spx_auto_execute : false,
          updatedAt: (credentialRow as { updated_at?: string }).updated_at || null,
        }
        : { configured: false },
      latestPortfolioSnapshot: snapshotRow || null,
      runtime: {
        execution: runtime,
        portfolioSync: portfolioSyncRuntime,
      },
    });
  } catch (error) {
    logger.error('SPX Tradier status endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load Tradier status.',
    });
  }
});

router.post('/broker/tradier/credentials', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    const accountId = typeof req.body?.accountId === 'string' ? req.body.accountId.trim() : '';
    const accessToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
    const isActive = parseBoolean(req.body?.isActive ?? true);
    const sandbox = parseBoolean(req.body?.sandbox ?? true);
    const autoExecute = parseBoolean(req.body?.autoExecute ?? false);

    if (!accountId || !accessToken) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Both accountId and accessToken are required.',
      });
    }

    const { data: existingRow } = await supabase
      .from('broker_credentials')
      .select('metadata')
      .eq('user_id', userId)
      .eq('broker_name', 'tradier')
      .maybeSingle();

    const existingMetadata = (
      existingRow && typeof (existingRow as { metadata?: unknown }).metadata === 'object'
        ? (existingRow as { metadata: Record<string, unknown> }).metadata
        : {}
    );

    const metadata = {
      ...existingMetadata,
      tradier_sandbox: sandbox,
      spx_auto_execute: autoExecute,
      credential_source: 'api',
    };

    const { error } = await supabase
      .from('broker_credentials')
      .upsert({
        user_id: userId,
        broker_name: 'tradier',
        account_id: accountId,
        access_token_ciphertext: accessToken,
        is_active: isActive,
        metadata,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      broker: 'tradier',
      accountIdMasked: accountId.length > 4 ? `****${accountId.slice(-4)}` : accountId,
      isActive,
      sandbox,
      autoExecute,
    });
  } catch (error) {
    logger.error('SPX Tradier credential upsert failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to store Tradier credentials.',
    });
  }
});

router.post('/broker/tradier/test-balance', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    const requestAccountId = typeof req.body?.accountId === 'string' ? req.body.accountId.trim() : '';
    const requestToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
    const requestSandbox = req.body?.sandbox;

    let accountId = requestAccountId;
    let token = requestToken;
    let sandbox = typeof requestSandbox === 'boolean'
      ? requestSandbox
      : String(process.env.TRADIER_EXECUTION_SANDBOX || 'true').toLowerCase() !== 'false';

    if (!accountId || !token) {
      const { data: credentialRow, error: credentialError } = await supabase
        .from('broker_credentials')
        .select('account_id,access_token_ciphertext,metadata')
        .eq('user_id', userId)
        .eq('broker_name', 'tradier')
        .eq('is_active', true)
        .maybeSingle();
      if (credentialError) throw credentialError;

      if (!credentialRow) {
        return res.status(400).json({
          error: 'Missing credentials',
          message: 'Provide accountId/accessToken or configure stored Tradier credentials first.',
        });
      }

      const row = credentialRow as {
        account_id: string;
        access_token_ciphertext: string;
        metadata?: Record<string, unknown> | null;
      };
      accountId = row.account_id;
      token = decryptTradierAccessToken(row.access_token_ciphertext);
      if (typeof requestSandbox !== 'boolean' && typeof row.metadata?.tradier_sandbox === 'boolean') {
        sandbox = row.metadata.tradier_sandbox;
      }
    }

    const tradier = new TradierClient({
      accountId,
      accessToken: token,
      sandbox,
    });
    const balances = await tradier.getBalances();

    return res.json({
      success: true,
      sandbox,
      accountIdMasked: accountId.length > 4 ? `****${accountId.slice(-4)}` : accountId,
      balances,
    });
  } catch (error) {
    logger.error('SPX Tradier balance test failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to fetch Tradier balances. Verify sandbox credentials and account settings.',
    });
  }
});

router.post('/broker/tradier/mode', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }

    const mode = req.body?.mode;
    if (!['off', 'manual', 'auto'].includes(mode)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Mode must be one of: off, manual, auto.',
      });
    }

    const isActive = mode !== 'off';
    const autoExecute = mode === 'auto';

    const { data: existingRow, error: fetchError } = await supabase
      .from('broker_credentials')
      .select('metadata')
      .eq('user_id', userId)
      .eq('broker_name', 'tradier')
      .maybeSingle();
    if (fetchError) throw fetchError;

    if (!existingRow) {
      return res.status(404).json({
        error: 'Not found',
        message: 'No Tradier credentials configured. Add credentials first.',
      });
    }

    const existingMetadata = (
      typeof (existingRow as { metadata?: unknown }).metadata === 'object'
        ? (existingRow as { metadata: Record<string, unknown> }).metadata
        : {}
    );

    const { error: updateError } = await supabase
      .from('broker_credentials')
      .update({
        is_active: isActive,
        metadata: { ...existingMetadata, spx_auto_execute: autoExecute, exec_mode: mode },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('broker_name', 'tradier');

    if (updateError) throw updateError;

    logger.info('Tradier execution mode updated', { userId, mode, isActive, autoExecute });
    return res.json({ success: true, mode, isActive, autoExecute });
  } catch (error) {
    logger.error('SPX Tradier mode update failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to update execution mode.',
    });
  }
});

router.post('/broker/tradier/kill', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }

    const { data: credentialRow, error: credentialError } = await supabase
      .from('broker_credentials')
      .select('account_id,access_token_ciphertext,metadata')
      .eq('user_id', userId)
      .eq('broker_name', 'tradier')
      .maybeSingle();
    if (credentialError) throw credentialError;

    if (!credentialRow) {
      return res.status(404).json({
        error: 'Not found',
        message: 'No Tradier credentials configured.',
      });
    }

    const row = credentialRow as {
      account_id: string;
      access_token_ciphertext: string;
      metadata?: Record<string, unknown> | null;
    };

    const sandbox = typeof row.metadata?.tradier_sandbox === 'boolean'
      ? row.metadata.tradier_sandbox
      : String(process.env.TRADIER_EXECUTION_SANDBOX || 'true').toLowerCase() !== 'false';

    const tradier = new TradierClient({
      accountId: row.account_id,
      accessToken: decryptTradierAccessToken(row.access_token_ciphertext),
      sandbox,
    });

    const existingMetadata = (
      typeof row.metadata === 'object' && row.metadata
        ? row.metadata
        : {}
    );

    const { error: updateError } = await supabase
      .from('broker_credentials')
      .update({
        is_active: false,
        metadata: { ...existingMetadata, spx_auto_execute: false, exec_mode: 'off', kill_switch_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('broker_name', 'tradier');

    if (updateError) {
      logger.error('Kill switch: failed to deactivate credentials', { userId, error: updateError.message });
    }

    // S2: Cancel all open orders for this user
    let cancelledOrders = 0;
    try {
      // Query persisted execution states for active order IDs
      const openStates = await loadOpenStatesWithOrders(userId);
      for (const state of openStates) {
        if (state.entryOrderId) {
          try {
            await tradier.cancelOrder(state.entryOrderId);
            cancelledOrders++;
          } catch {
            // Order may already be filled/cancelled
          }
        }
        if (state.runnerStopOrderId) {
          try {
            await tradier.cancelOrder(state.runnerStopOrderId);
            cancelledOrders++;
          } catch {
            // Order may already be filled/cancelled
          }
        }
      }

      // Fallback: query Tradier directly for any SPX-tagged pending orders we may have missed
      try {
        const pendingOrders = await tradier.getOpenOrders('spx:');
        for (const order of pendingOrders) {
          try {
            await tradier.cancelOrder(order.id);
            cancelledOrders++;
          } catch {
            // Already cancelled or filled
          }
        }
      } catch {
        logger.warn('Kill switch: Tradier open orders query failed (non-fatal)', { userId });
      }

      // Close all execution states in Supabase
      const closedCount = await closeAllUserStates(userId, 'kill_switch');
      logger.info('Kill switch: closed execution states', { userId, closedCount });
    } catch (posError) {
      logger.warn('Kill switch: order cancellation encountered errors (non-fatal)', {
        error: posError instanceof Error ? posError.message : String(posError),
      });
    }

    logger.info('Kill switch activated', { userId, cancelledOrders });
    return res.json({
      success: true,
      message: 'Kill switch activated. Execution disabled, all open orders cancelled.',
      cancelledOrders,
    });
  } catch (error) {
    logger.error('SPX Tradier kill switch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Kill switch encountered an error.',
    });
  }
});

router.get('/broker/tradier/positions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }

    const { data: credentialRow, error: credentialError } = await supabase
      .from('broker_credentials')
      .select('account_id,access_token_ciphertext,metadata,is_active')
      .eq('user_id', userId)
      .eq('broker_name', 'tradier')
      .maybeSingle();
    if (credentialError) throw credentialError;

    if (!credentialRow) {
      return res.status(404).json({
        error: 'Not found',
        message: 'No Tradier credentials configured.',
      });
    }

    const row = credentialRow as {
      account_id: string;
      access_token_ciphertext: string;
      metadata?: Record<string, unknown> | null;
      is_active?: boolean;
    };

    if (!row.is_active) {
      return res.json({ positions: [], isActive: false, message: 'Broker is not active.' });
    }

    const sandbox = typeof row.metadata?.tradier_sandbox === 'boolean'
      ? row.metadata.tradier_sandbox
      : String(process.env.TRADIER_EXECUTION_SANDBOX || 'true').toLowerCase() !== 'false';

    const tradier = new TradierClient({
      accountId: row.account_id,
      accessToken: decryptTradierAccessToken(row.access_token_ciphertext),
      sandbox,
    });

    const positions = await tradier.getPositions();
    return res.json({ positions, isActive: true, positionCount: positions.length });
  } catch (error) {
    logger.error('SPX Tradier positions endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to fetch Tradier positions.',
    });
  }
});

router.get('/coach/state', async (req: Request, res: Response) => {
  try {
    const state = await getCoachState({ forceRefresh: parseBoolean(req.query.forceRefresh) });
    return res.json(state);
  } catch (error) {
    logger.error('SPX coach state endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load coach state.',
      retryAfter: 10,
    });
  }
});

router.post('/coach/message', async (req: Request, res: Response) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
    const setupId = typeof req.body?.setupId === 'string' ? req.body.setupId : undefined;
    const forceRefresh = parseBoolean(req.body?.forceRefresh);
    const userId = req.user?.id;
    const coachTimeoutMs = 20_000;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const messages = await Promise.race([
      generateCoachStream({ prompt, setupId, forceRefresh, userId }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Coach stream timed out after ${coachTimeoutMs}ms`)), coachTimeoutMs);
      }),
    ]).catch((error) => {
      logger.error('SPX coach message generation failed; returning fallback message', {
        error: error instanceof Error ? error.message : String(error),
        setupId,
      });

      return [{
        id: `coach_stream_fallback_${Date.now()}`,
        type: 'alert',
        priority: 'alert',
        setupId: setupId || null,
        content: 'Coach is temporarily delayed. Retry in a few seconds or switch to risk-first execution rules.',
        structuredData: {
          source: 'route_fallback',
          failed: true,
          setupId: setupId || null,
        },
        timestamp: new Date().toISOString(),
      }];
    });

    for (const message of messages) {
      res.write(`event: coach_message\n`);
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    }

    res.write('event: done\n');
    res.write(`data: ${JSON.stringify({ count: messages.length })}\n\n`);
    res.end();
    return;
  } catch (error) {
    logger.error('SPX coach message endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    if (!res.headersSent) {
      res.status(503).json({
        error: 'Coach unavailable',
        message: 'AI coach is temporarily unavailable.',
        retryAfter: 10,
      });
      return;
    }

    res.write('event: error\n');
    res.write(`data: ${JSON.stringify({ message: 'AI coach unavailable' })}\n\n`);
    res.end();
    return;
  }
});

router.post('/coach/decision', async (req: Request, res: Response) => {
  try {
    const setupId = typeof req.body?.setupId === 'string' ? req.body.setupId : undefined;
    const forceRefresh = parseBoolean(req.body?.forceRefresh);
    const userId = req.user?.id;
    const coachTimeoutMs = 20_000;

    const tradeModeRaw = req.body?.tradeMode;
    const tradeMode = tradeModeRaw === 'scan' || tradeModeRaw === 'evaluate' || tradeModeRaw === 'in_trade'
      ? tradeModeRaw
      : undefined;

    const question = typeof req.body?.question === 'string'
      ? req.body.question
      : (typeof req.body?.prompt === 'string' ? req.body.prompt : undefined);

    const selectedContractRaw = req.body?.selectedContract;
    const selectedContract = selectedContractRaw
      && typeof selectedContractRaw === 'object'
      && typeof selectedContractRaw.description === 'string'
      && typeof selectedContractRaw.bid === 'number'
      && typeof selectedContractRaw.ask === 'number'
      && typeof selectedContractRaw.riskReward === 'number'
      ? {
        description: selectedContractRaw.description,
        bid: selectedContractRaw.bid,
        ask: selectedContractRaw.ask,
        riskReward: selectedContractRaw.riskReward,
      }
      : undefined;

    const clientContextRaw = req.body?.clientContext;
    const layoutModeRaw = clientContextRaw?.layoutMode;
    const layoutMode = layoutModeRaw === 'legacy'
      || layoutModeRaw === 'scan'
      || layoutModeRaw === 'evaluate'
      || layoutModeRaw === 'in_trade'
      ? layoutModeRaw
      : undefined;

    const clientContext = clientContextRaw
      && typeof clientContextRaw === 'object'
      ? {
        layoutMode,
        surface: typeof clientContextRaw.surface === 'string'
          ? clientContextRaw.surface
          : undefined,
      }
      : undefined;

    const decisionRequest: CoachDecisionRequest = {
      setupId,
      tradeMode,
      question,
      selectedContract,
      clientContext,
    };

    const decision = await Promise.race([
      generateCoachDecision({
        ...decisionRequest,
        forceRefresh,
        userId,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Coach decision timed out after ${coachTimeoutMs}ms`)), coachTimeoutMs);
      }),
    ]).catch((error) => {
      logger.error('SPX coach decision generation failed; returning fallback decision', {
        error: error instanceof Error ? error.message : String(error),
        setupId,
      });

      return {
        decisionId: `coach_decision_route_fallback_${Date.now()}`,
        setupId: setupId || null,
        verdict: 'WAIT',
        confidence: 0,
        primaryText: 'Coach decision is temporarily delayed. Use risk-first execution rules and retry shortly.',
        why: ['Fallback decision engaged while coach service recovers.'],
        actions: [
          {
            id: 'OPEN_HISTORY',
            label: 'Open Coach History',
            style: 'secondary',
          },
        ],
        severity: 'warning',
        freshness: {
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          stale: true,
        },
        source: 'fallback_v1',
      };
    });

    return res.json(decision);
  } catch (error) {
    logger.error('SPX coach decision endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Coach unavailable',
      message: 'AI coach decision service is temporarily unavailable.',
      retryAfter: 10,
    });
  }
});

export default router;
