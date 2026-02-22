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
  getExecutionReconciliationHistory,
  recordExecutionFill,
  type ExecutionFillSide,
  type ExecutionFillSource,
  type ExecutionTransitionPhase,
} from '../services/spx/executionReconciliation';
import {
  getSPXOptimizerHistory,
  getSPXOptimizerScorecard,
  revertSPXOptimizerToHistory,
  getActiveSPXOptimizationProfile,
  runSPXOptimizerScan,
} from '../services/spx/optimizer';
import { getSPXOptimizerWorkerStatus } from '../workers/spxOptimizerWorker';
import {
  runSPXWinRateBacktest,
  type SPXBacktestExecutionBasis,
  type SPXBacktestPriceResolution,
  type SPXWinRateBacktestSource,
} from '../services/spx/winRateBacktest';
import { classifyCurrentRegime } from '../services/spx/regimeClassifier';
import { detectActiveSetups, getSetupById } from '../services/spx/setupDetector';
import type { CoachDecisionRequest, Setup } from '../services/spx/types';
import { toEasternTime } from '../services/marketHours';

const router = Router();

function parseBoolean(value: unknown): boolean {
  return String(value || '').toLowerCase() === 'true';
}

function parseFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
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

function parseBacktestExecutionBasis(value: unknown): SPXBacktestExecutionBasis {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'options_contract' || normalized === 'options' || normalized === 'contract') {
    return 'options_contract';
  }
  return 'underlying';
}

function parseExecutionFillSide(value: unknown): ExecutionFillSide | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'entry') return 'entry';
  if (normalized === 'partial') return 'partial';
  if (normalized === 'exit') return 'exit';
  return null;
}

function parseExecutionFillSource(value: unknown): ExecutionFillSource {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'proxy') return 'proxy';
  if (normalized === 'broker_tradier' || normalized === 'tradier') return 'broker_tradier';
  if (normalized === 'broker_other' || normalized === 'broker') return 'broker_other';
  if (normalized === 'manual') return 'manual';
  return 'manual';
}

function parseExecutionTransitionPhase(value: unknown): ExecutionTransitionPhase | undefined {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'triggered') return 'triggered';
  if (normalized === 'target1_hit') return 'target1_hit';
  if (normalized === 'target2_hit') return 'target2_hit';
  if (normalized === 'invalidated') return 'invalidated';
  if (normalized === 'expired') return 'expired';
  return undefined;
}

function parseSetupDirection(value: unknown): Setup['direction'] | undefined {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'bullish') return 'bullish';
  if (normalized === 'bearish') return 'bearish';
  return undefined;
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
    const executionBasis = parseBacktestExecutionBasis(req.query.executionBasis);
    const strictOptionsBars = req.query.strictOptionsBars == null
      ? true
      : parseBoolean(req.query.strictOptionsBars);

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
      executionBasis,
      executionModel: {
        partialAtT1Pct: optimizerProfile.tradeManagement.partialAtT1Pct,
        moveStopToBreakevenAfterT1: optimizerProfile.tradeManagement.moveStopToBreakeven,
      },
      optionsReplay: {
        strictBars: strictOptionsBars,
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

router.post('/execution/fills', async (req: Request, res: Response) => {
  try {
    const setupId = typeof req.body?.setupId === 'string' ? req.body.setupId.trim() : '';
    if (!setupId) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'setupId is required.',
      });
    }

    const side = parseExecutionFillSide(req.body?.side);
    if (!side) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'side must be one of entry, partial, or exit.',
      });
    }

    const fillPrice = Number(req.body?.fillPrice);
    if (!Number.isFinite(fillPrice) || fillPrice <= 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'fillPrice must be a positive number.',
      });
    }

    const fillQuantity = req.body?.fillQuantity == null ? undefined : Number(req.body.fillQuantity);
    if (fillQuantity != null && (!Number.isFinite(fillQuantity) || fillQuantity <= 0)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'fillQuantity must be a positive number when provided.',
      });
    }

    const source = parseExecutionFillSource(req.body?.source);
    const phase = parseExecutionTransitionPhase(req.body?.phase);
    const direction = parseSetupDirection(req.body?.direction);
    const executedAt = typeof req.body?.executedAt === 'string' ? req.body.executedAt : undefined;
    const transitionEventId = typeof req.body?.transitionEventId === 'string' && req.body.transitionEventId.trim().length > 0
      ? req.body.transitionEventId.trim()
      : undefined;
    const brokerOrderId = typeof req.body?.brokerOrderId === 'string' && req.body.brokerOrderId.trim().length > 0
      ? req.body.brokerOrderId.trim().slice(0, 120)
      : undefined;
    const brokerExecutionId = typeof req.body?.brokerExecutionId === 'string' && req.body.brokerExecutionId.trim().length > 0
      ? req.body.brokerExecutionId.trim().slice(0, 120)
      : undefined;
    const metadata = req.body?.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata)
      ? req.body.metadata as Record<string, unknown>
      : undefined;
    const userId = typeof req.user?.id === 'string' ? req.user.id : undefined;

    const reconciliation = await recordExecutionFill({
      setupId,
      side,
      fillPrice,
      fillQuantity,
      source,
      phase,
      direction,
      executedAt,
      transitionEventId,
      brokerOrderId,
      brokerExecutionId,
      userId,
      metadata,
    });

    return res.json(reconciliation);
  } catch (error) {
    logger.error('SPX execution fill ingestion endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to record SPX execution fill.',
      retryAfter: 10,
    });
  }
});

router.get('/execution/reconciliation', async (req: Request, res: Response) => {
  try {
    const setupId = typeof req.query.setupId === 'string' ? req.query.setupId.trim() : '';
    if (!setupId) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'setupId query parameter is required.',
      });
    }

    const sessionDate = parseISODateInput(req.query.sessionDate) || undefined;
    const history = await getExecutionReconciliationHistory({
      setupId,
      sessionDate,
    });

    return res.json(history);
  } catch (error) {
    logger.error('SPX execution reconciliation endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX execution reconciliation.',
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
    const schedule = await getSPXOptimizerWorkerStatus();
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

router.get('/analytics/optimizer/history', async (req: Request, res: Response) => {
  try {
    const rawLimit = Number(req.query.limit || 20);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.trunc(rawLimit))) : 20;
    const history = await getSPXOptimizerHistory(limit);
    return res.json({
      history,
      count: history.length,
    });
  } catch (error) {
    logger.error('SPX optimizer history endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to load SPX optimizer history.',
      retryAfter: 10,
    });
  }
});

router.post('/analytics/optimizer/scan', async (req: Request, res: Response) => {
  try {
    const from = parseISODateInput(req.body?.from) || undefined;
    const to = parseISODateInput(req.body?.to) || undefined;
    const actor = typeof (req as Request & { user?: { id?: string } }).user?.id === 'string'
      ? (req as Request & { user?: { id?: string } }).user?.id || null
      : null;

    const result = await runSPXOptimizerScan({
      from,
      to,
      mode: 'manual',
      actor,
    });
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

router.post('/analytics/optimizer/revert', async (req: Request, res: Response) => {
  try {
    const historyIdRaw = Number(req.body?.historyId);
    const historyId = Number.isFinite(historyIdRaw) ? Math.trunc(historyIdRaw) : NaN;
    if (!Number.isFinite(historyId) || historyId <= 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'historyId must be a positive integer.',
      });
    }

    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim().length > 0
      ? req.body.reason.trim().slice(0, 240)
      : null;
    const actor = typeof (req as Request & { user?: { id?: string } }).user?.id === 'string'
      ? (req as Request & { user?: { id?: string } }).user?.id || null
      : null;
    const result = await revertSPXOptimizerToHistory({
      historyId,
      actor,
      reason,
    });

    return res.json({
      ...result,
      message: `Optimizer profile reverted to history entry ${historyId}.`,
    });
  } catch (error) {
    logger.error('SPX optimizer revert endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      error: 'Data unavailable',
      message: 'Unable to revert SPX optimizer profile.',
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
    const dayTradeBuyingPower = parseFiniteNumber(req.query.dayTradeBuyingPower);
    const maxRiskDollars = parseFiniteNumber(req.query.maxRiskDollars);
    const pdtQualified = typeof req.query.pdtQualified === 'undefined'
      ? undefined
      : parseBoolean(req.query.pdtQualified);
    const recommendation = await getContractRecommendation({
      setupId,
      forceRefresh: parseBoolean(req.query.forceRefresh),
      portfolioRisk: {
        dayTradeBuyingPower,
        maxRiskDollars,
        pdtQualified,
      },
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
    const dayTradeBuyingPower = parseFiniteNumber(req.body?.dayTradeBuyingPower);
    const maxRiskDollars = parseFiniteNumber(req.body?.maxRiskDollars);
    const pdtQualified = typeof req.body?.pdtQualified === 'boolean'
      ? req.body.pdtQualified
      : undefined;
    const recommendation = await getContractRecommendation({
      setupId,
      setup,
      forceRefresh: parseBoolean(req.body?.forceRefresh),
      portfolioRisk: {
        dayTradeBuyingPower,
        maxRiskDollars,
        pdtQualified,
      },
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
