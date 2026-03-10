import axios from 'axios';
import { createHash } from 'crypto';
import { Router, type Request, type Response } from 'express';
import { cacheDelete, cacheGet, cacheSet } from '../config/redis';
import { massiveClient } from '../config/massive';
import { sanitizeSymbols } from '../lib/symbols';
import { logger } from '../lib/logger';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { symbolParamSchema } from '../schemas/optionsValidation';
import {
  swingSniperUniverseQuerySchema,
  swingSniperStructureRecommendBodySchema,
  swingSniperWatchlistBodySchema,
} from '../schemas/swingSniperValidation';
import { buildSwingSniperBrief } from '../services/swingSniper/briefBuilder';
import { buildSwingSniperDossier } from '../services/swingSniper/dossierBuilder';
import {
  getSwingSniperWatchlistState,
  saveSwingSniperSignalSnapshots,
  saveSwingSniperWatchlistState,
} from '../services/swingSniper/persistence';
import {
  scanSwingSniperUniverse,
  SWING_SNIPER_CORE_SCAN_SYMBOLS,
} from '../services/swingSniper/universeScanner';
import { buildSwingSniperStructureLab } from '../services/swingSniper/structureLab';
import { buildSwingSniperRiskSentinel } from '../services/swingSniper/riskSentinel';
import { buildSwingSniperBacktestReport } from '../services/swingSniper/backtestService';
import type { SwingSniperWatchlistUpdateInput } from '../services/swingSniper/types';

const router = Router();
const SWING_SNIPER_HEALTH_TIMEOUT_MS = 4500;
const SWING_SNIPER_LAUNCH_UNIVERSE_TARGET = 150;
const SWING_SNIPER_UNIVERSE_CACHE_TTL_SECONDS = 8 * 60;
const SWING_SNIPER_BRIEF_CACHE_TTL_SECONDS = 5 * 60;
const SWING_SNIPER_MONITORING_CACHE_TTL_SECONDS = 4 * 60;

type DependencyStatus = 'ready' | 'degraded' | 'blocked' | 'optional';

interface HealthDependency {
  key: string;
  label: string;
  status: DependencyStatus;
  message: string;
  optional?: boolean;
}

function makeDependency(
  key: string,
  label: string,
  status: DependencyStatus,
  message: string,
  optional: boolean = false,
): HealthDependency {
  return { key, label, status, message, optional };
}

function getAxiosStatus(error: unknown): number | null {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? null;
  }

  if (
    typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof (error as { response?: { status?: unknown } }).response?.status === 'number'
  ) {
    return (error as { response: { status: number } }).response.status;
  }

  return null;
}

function getAxiosMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (typeof status === 'number') {
      return `${fallback} (${status})`;
    }
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function toCacheKey(key: string, suffix: string): string {
  return `swing-sniper:${key}:${suffix}`;
}

function hashSymbols(symbols: string[]): string {
  return createHash('sha1').update(symbols.join(',')).digest('hex').slice(0, 12);
}

async function probeMarketStatus(): Promise<HealthDependency> {
  try {
    await massiveClient.get('/v1/marketstatus/now', {
      timeout: SWING_SNIPER_HEALTH_TIMEOUT_MS,
    });

    return makeDependency(
      'massive-core',
      'Massive core market data',
      'ready',
      'Core connectivity is healthy for market status and regime context.',
    );
  } catch (error) {
    const status = getAxiosStatus(error);
    const blocked = status === 401 || status === 403;
    return makeDependency(
      'massive-core',
      'Massive core market data',
      blocked ? 'blocked' : 'degraded',
      getAxiosMessage(error, 'Unable to confirm Massive core connectivity'),
    );
  }
}

async function probeOptionsReference(): Promise<HealthDependency> {
  try {
    await massiveClient.get('/v3/reference/options/contracts', {
      params: {
        underlying_ticker: 'SPY',
        limit: 1,
      },
      timeout: SWING_SNIPER_HEALTH_TIMEOUT_MS,
    });

    return makeDependency(
      'options-reference',
      'Options chain reference',
      'ready',
      'Options reference access is available for contract discovery.',
    );
  } catch (error) {
    const status = getAxiosStatus(error);
    const blocked = status === 401 || status === 403;
    return makeDependency(
      'options-reference',
      'Options chain reference',
      blocked ? 'blocked' : 'degraded',
      getAxiosMessage(error, 'Unable to confirm options reference access'),
    );
  }
}

async function probeNewsFeed(): Promise<HealthDependency> {
  try {
    await massiveClient.get('/v2/reference/news', {
      params: {
        ticker: 'SPY',
        limit: 1,
      },
      timeout: SWING_SNIPER_HEALTH_TIMEOUT_MS,
    });

    return makeDependency(
      'news-feed',
      'Massive news feed',
      'ready',
      'News summaries are reachable for narrative-shift analysis.',
      true,
    );
  } catch (error) {
    const status = getAxiosStatus(error);
    const state = status === 401 || status === 403 ? 'optional' : 'degraded';
    return makeDependency(
      'news-feed',
      'Massive news feed',
      state,
      getAxiosMessage(error, 'News feed probe failed; dossier narrative will need fallback copy'),
      true,
    );
  }
}

async function probeBenzingaEarnings(): Promise<HealthDependency> {
  try {
    await massiveClient.get('/benzinga/v1/earnings', {
      params: {
        ticker: 'AAPL',
        limit: 1,
      },
      timeout: SWING_SNIPER_HEALTH_TIMEOUT_MS,
    });

    return makeDependency(
      'benzinga-earnings',
      'Benzinga earnings add-on',
      'ready',
      'Partner earnings feed is reachable for richer catalyst timing.',
      true,
    );
  } catch (error) {
    const status = getAxiosStatus(error);

    if (status === 401 || status === 403) {
      return makeDependency(
        'benzinga-earnings',
        'Benzinga earnings add-on',
        'optional',
        'Partner add-on is not enabled on this Massive plan. Swing Sniper stays Massive-only with a reduced catalyst layer.',
        true,
      );
    }

    return makeDependency(
      'benzinga-earnings',
      'Benzinga earnings add-on',
      'degraded',
      getAxiosMessage(error, 'Partner earnings probe failed'),
      true,
    );
  }
}

function buildCapabilities(overallStatus: 'ready' | 'degraded' | 'blocked') {
  const dataReady = overallStatus !== 'blocked';
  return {
    routeShell: true,
    opportunityBoard: dataReady,
    dossier: dataReady,
    structureLab: dataReady,
    monitoring: dataReady,
    backtesting: dataReady,
  };
}

router.get('/health', authenticateToken, async (_req: Request, res: Response) => {
  if (!process.env.MASSIVE_API_KEY) {
    res.status(503).json({
      ok: false,
      status: 'blocked',
      generatedAt: new Date().toISOString(),
      launchUniverseTarget: SWING_SNIPER_LAUNCH_UNIVERSE_TARGET,
      dependencies: [
        makeDependency(
          'massive-core',
          'Massive core market data',
          'blocked',
          'MASSIVE_API_KEY is not configured on the backend.',
        ),
      ],
      capabilities: buildCapabilities('blocked'),
      notes: [
        'Swing Sniper shell is mounted, but required Massive credentials are missing.',
        'The ranked board and dossier stay disabled until backend market-data credentials are restored.',
      ],
    });
    return;
  }

  try {
    const dependencies = await Promise.all([
      probeMarketStatus(),
      probeOptionsReference(),
      probeNewsFeed(),
      probeBenzingaEarnings(),
    ]);

    const hasBlockedDependency = dependencies.some((dependency) => !dependency.optional && dependency.status === 'blocked');
    const hasRequiredDegradedDependency = dependencies.some((dependency) => !dependency.optional && dependency.status === 'degraded');
    const overallStatus = hasBlockedDependency
      ? 'blocked'
      : hasRequiredDegradedDependency
        ? 'degraded'
        : 'ready';

    res.status(overallStatus === 'blocked' ? 503 : 200).json({
      ok: overallStatus !== 'blocked',
      status: overallStatus,
      generatedAt: new Date().toISOString(),
      launchUniverseTarget: SWING_SNIPER_LAUNCH_UNIVERSE_TARGET,
      dependencies,
      capabilities: buildCapabilities(overallStatus),
      notes: [
        'Swing Sniper now includes the ranked board, dossier, Structure Lab contract candidates, catalyst density strip, and saved thesis continuity.',
        'Risk Sentinel monitoring and adaptive backtest confidence are now available in the launch route.',
      ],
    });
  } catch (error) {
    logger.error('Swing Sniper health preflight failed unexpectedly', {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      ok: false,
      status: 'blocked',
      generatedAt: new Date().toISOString(),
      launchUniverseTarget: SWING_SNIPER_LAUNCH_UNIVERSE_TARGET,
      dependencies: [],
      capabilities: buildCapabilities('blocked'),
      notes: [
        'Swing Sniper health preflight hit an unexpected backend error.',
      ],
      message: 'Failed to build Swing Sniper health payload.',
    });
  }
});

router.get('/brief', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const cacheKey = toCacheKey('brief', userId);
    const cached = await cacheGet<Awaited<ReturnType<typeof buildSwingSniperBrief>>>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const payload = await buildSwingSniperBrief(userId);
    await cacheSet(cacheKey, payload, SWING_SNIPER_BRIEF_CACHE_TTL_SECONDS);
    res.json(payload);
  } catch (error) {
    logger.error('Failed to build Swing Sniper brief', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to build Swing Sniper brief',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get(
  '/universe',
  authenticateToken,
  validateQuery(swingSniperUniverseQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const validated = (req as unknown as {
        validatedQuery: {
          symbols: string[];
          limit: number;
          refresh: boolean;
        };
      }).validatedQuery;

      const watchlistState = await getSwingSniperWatchlistState(userId);
      const scanLimit = Math.max(25, Math.min(SWING_SNIPER_LAUNCH_UNIVERSE_TARGET, validated.limit || SWING_SNIPER_LAUNCH_UNIVERSE_TARGET));
      const requestedSymbols = sanitizeSymbols(validated.symbols || [], scanLimit);
      const universeSymbols = requestedSymbols.length > 0
        ? requestedSymbols
        : sanitizeSymbols([
          ...SWING_SNIPER_CORE_SCAN_SYMBOLS,
          ...watchlistState.symbols,
          ...watchlistState.savedTheses.map((item) => item.symbol),
        ], scanLimit);

      const symbolHash = hashSymbols(universeSymbols);
      const cacheKey = toCacheKey('universe', `${userId}:${scanLimit}:${symbolHash}`);
      if (!validated.refresh) {
        const cached = await cacheGet<Awaited<ReturnType<typeof scanSwingSniperUniverse>>>(cacheKey);
        if (cached) {
          res.json(cached);
          return;
        }
      }

      const payload = await scanSwingSniperUniverse(
        universeSymbols,
        watchlistState.savedTheses.map((item) => item.symbol),
        scanLimit,
      );

      await cacheSet(cacheKey, payload, SWING_SNIPER_UNIVERSE_CACHE_TTL_SECONDS);

      try {
        await saveSwingSniperSignalSnapshots(
          userId,
          payload.opportunities.slice(0, 12).map((opportunity) => ({
            symbol: opportunity.symbol,
            asOf: opportunity.asOf,
            capturedFrom: 'universe',
            score: opportunity.score,
            direction: opportunity.direction,
            setupLabel: opportunity.setupLabel,
            thesis: opportunity.thesis,
            currentPrice: opportunity.currentPrice,
            currentIV: opportunity.currentIV,
            realizedVol20: opportunity.realizedVol20,
            ivRank: opportunity.ivRank,
            ivPercentile: opportunity.ivPercentile,
            ivVsRvGap: opportunity.ivVsRvGap,
            catalystDate: opportunity.catalystDate,
            catalystDaysUntil: opportunity.catalystDaysUntil,
            snapshot: {
              catalystLabel: opportunity.catalystLabel,
              reasons: opportunity.reasons,
              expressionPreview: opportunity.expressionPreview,
              skewDirection: opportunity.skewDirection,
              termStructureShape: opportunity.termStructureShape,
              liquidityScore: opportunity.liquidityScore,
              liquidityTier: opportunity.liquidityTier,
              orc: opportunity.orc,
            },
          })),
          {
            ignoreDuplicates: true,
            prune: true,
          },
        );
      } catch (snapshotError) {
        logger.warn('Failed to archive Swing Sniper universe signal snapshot', {
          userId,
          error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        });
      }

      res.json(payload);
    } catch (error) {
      logger.error('Failed to build Swing Sniper universe', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(503).json({
        error: 'Failed to build Swing Sniper universe',
        message: error instanceof Error ? error.message : 'Unexpected error',
        retryAfter: 30,
      });
    }
  },
);

router.post(
  '/structure/recommend',
  authenticateToken,
  validateBody(swingSniperStructureRecommendBodySchema),
  async (req: Request, res: Response) => {
    try {
      const validatedBody = (req as unknown as {
        validatedBody: {
          symbol: string;
          direction?: 'long_vol' | 'short_vol' | 'neutral';
          maxRecommendations?: number;
        };
      }).validatedBody;

      const dossier = await buildSwingSniperDossier(req.user!.id, validatedBody.symbol);
      const targetDirection = validatedBody.direction ?? dossier.direction;

      const payload = await buildSwingSniperStructureLab({
        symbol: dossier.symbol,
        direction: targetDirection,
        currentPrice: dossier.currentPrice ?? 0,
        currentIV: dossier.volMap.currentIV,
        ivRank: dossier.volMap.ivRank,
        skewDirection: dossier.volMap.skewDirection,
        catalystDaysUntil: dossier.catalysts.events[0]?.daysUntil ?? null,
        termStructureShape: dossier.volMap.termStructureShape,
        maxRecommendations: validatedBody.maxRecommendations ?? 4,
      });

      res.json(payload);
    } catch (error) {
      logger.error('Failed to build Swing Sniper structure recommendations', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(503).json({
        error: 'Failed to build Swing Sniper structure recommendations',
        message: error instanceof Error ? error.message : 'Unexpected error',
        retryAfter: 30,
      });
    }
  },
);

router.get('/monitoring', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const cacheKey = toCacheKey('monitoring', userId);
    const cached = await cacheGet<Awaited<ReturnType<typeof buildSwingSniperRiskSentinel>>>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const payload = await buildSwingSniperRiskSentinel(userId);
    await cacheSet(cacheKey, payload, SWING_SNIPER_MONITORING_CACHE_TTL_SECONDS);
    res.json(payload);
  } catch (error) {
    logger.error('Failed to build Swing Sniper monitoring payload', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({
      error: 'Failed to build Swing Sniper monitoring payload',
      message: error instanceof Error ? error.message : 'Unexpected error',
      retryAfter: 30,
    });
  }
});

router.get(
  '/backtest/:symbol',
  authenticateToken,
  validateParams(symbolParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { symbol } = (req as unknown as { validatedParams: { symbol: string } }).validatedParams;
      const payload = await buildSwingSniperBacktestReport(req.user!.id, symbol);
      res.json(payload);
    } catch (error) {
      logger.error('Failed to build Swing Sniper backtest payload', {
        userId: req.user?.id,
        symbol: req.params.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(503).json({
        error: 'Failed to build Swing Sniper backtest payload',
        message: error instanceof Error ? error.message : 'Unexpected error',
        retryAfter: 30,
      });
    }
  },
);

router.get(
  '/dossier/:symbol',
  authenticateToken,
  validateParams(symbolParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { symbol } = (req as unknown as { validatedParams: { symbol: string } }).validatedParams;
      const payload = await buildSwingSniperDossier(req.user!.id, symbol);

      try {
        await saveSwingSniperSignalSnapshots(req.user!.id, [
          {
            symbol: payload.symbol,
            asOf: payload.asOf,
            capturedFrom: 'dossier',
            score: payload.score,
            direction: payload.direction,
            setupLabel: payload.setupLabel,
            thesis: payload.thesis,
            currentPrice: payload.currentPrice,
            currentIV: payload.volMap.currentIV,
            realizedVol20: payload.volMap.realizedVol20,
            ivRank: payload.volMap.ivRank,
            ivPercentile: payload.volMap.ivPercentile,
            ivVsRvGap: payload.volMap.currentIV != null && payload.volMap.realizedVol20 != null
              ? payload.volMap.currentIV - payload.volMap.realizedVol20
              : null,
            catalystDate: payload.catalysts.events[0]?.date || null,
            catalystDaysUntil: payload.catalysts.events[0]?.daysUntil ?? null,
            snapshot: {
              reasoning: payload.reasoning,
              setupLabel: payload.setupLabel,
              expressionPreview: payload.expressionPreview,
              topStructure: payload.structureLab.recommendations[0]?.strategyLabel || null,
              riskNotes: payload.risk.notes,
            },
          },
        ]);
      } catch (snapshotError) {
        logger.warn('Failed to archive Swing Sniper dossier signal snapshot', {
          userId: req.user?.id,
          symbol,
          error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        });
      }

      res.json(payload);
    } catch (error) {
      logger.error('Failed to build Swing Sniper dossier', {
        userId: req.user?.id,
        symbol: req.params.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(503).json({
        error: 'Failed to build Swing Sniper dossier',
        message: error instanceof Error ? error.message : 'Unexpected error',
        retryAfter: 30,
      });
    }
  },
);

router.get('/watchlist', authenticateToken, async (req: Request, res: Response) => {
  try {
    const payload = await getSwingSniperWatchlistState(req.user!.id);
    res.json(payload);
  } catch (error) {
    logger.error('Failed to load Swing Sniper watchlist', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to load Swing Sniper watchlist',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.post(
  '/watchlist',
  authenticateToken,
  validateBody(swingSniperWatchlistBodySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const payload = (req as unknown as { validatedBody: SwingSniperWatchlistUpdateInput }).validatedBody;
      const saved = await saveSwingSniperWatchlistState(userId, {
        ...payload,
        symbols: payload.symbols ? sanitizeSymbols(payload.symbols, 50) : undefined,
        selectedSymbol: payload.selectedSymbol ? sanitizeSymbols([payload.selectedSymbol], 1)[0] || null : payload.selectedSymbol,
        thesis: payload.thesis
          ? {
            ...payload.thesis,
            symbol: sanitizeSymbols([payload.thesis.symbol], 1)[0] || payload.thesis.symbol.toUpperCase(),
          }
          : undefined,
      });

      await Promise.all([
        cacheDelete(toCacheKey('brief', userId)),
        cacheDelete(toCacheKey('monitoring', userId)),
      ]);

      res.json({
        success: true,
        data: saved,
      });
    } catch (error) {
      logger.error('Failed to save Swing Sniper watchlist', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: 'Failed to save Swing Sniper watchlist',
        message: error instanceof Error ? error.message : 'Unexpected error',
      });
    }
  },
);

export default router;
