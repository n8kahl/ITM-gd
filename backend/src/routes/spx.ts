import { Router, Request, Response } from 'express';
import { supabase } from '../config/database';
import { logger } from '../lib/logger';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { requireTier } from '../middleware/requireTier';
import { getPredictionState } from '../services/spx/aiPredictor';
import { generateCoachResponse, getCoachState } from '../services/spx/aiCoach';
import { getContractRecommendation } from '../services/spx/contractSelector';
import { getBasisState } from '../services/spx/crossReference';
import { getFibLevels } from '../services/spx/fibEngine';
import { getFlowEvents } from '../services/spx/flowEngine';
import { computeUnifiedGEXLandscape } from '../services/spx/gexEngine';
import { getMergedLevels } from '../services/spx/levelEngine';
import { classifyCurrentRegime } from '../services/spx/regimeClassifier';
import { detectActiveSetups, getSetupById } from '../services/spx/setupDetector';

const router = Router();

function parseBoolean(value: unknown): boolean {
  return String(value || '').toLowerCase() === 'true';
}

router.use(authenticateToken, requireTier('pro'), checkQueryLimit);

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
    const recommendation = await getContractRecommendation({
      setupId,
      forceRefresh: parseBoolean(req.query.forceRefresh),
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

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const message = await generateCoachResponse({ prompt, setupId, forceRefresh });

    res.write(`event: coach_message\n`);
    res.write(`data: ${JSON.stringify(message)}\n\n`);
    res.write('event: done\n');
    res.write('data: {}\n\n');
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

export default router;
