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
import type {
  SwingSniperBriefResponse,
  SwingSniperDirection,
  SwingSniperDossierResponse,
  SwingSniperUniverseResponse,
  SwingSniperWatchlistUpdateInput,
} from '../services/swingSniper/types';

const router = Router();
const SWING_SNIPER_HEALTH_TIMEOUT_MS = 4500;
const SWING_SNIPER_LAUNCH_UNIVERSE_TARGET = 150;
const SWING_SNIPER_UNIVERSE_CACHE_TTL_SECONDS = 8 * 60;
const SWING_SNIPER_BRIEF_CACHE_TTL_SECONDS = 5 * 60;
const SWING_SNIPER_DOSSIER_CACHE_TTL_SECONDS = 4 * 60;
const SWING_SNIPER_MONITORING_CACHE_TTL_SECONDS = 4 * 60;
const SWING_SNIPER_BOARD_SURFACE_SIZE = 12;

interface SwingSniperBoardIdea {
  symbol: string;
  orc_score: number;
  view: 'Long vol' | 'Short vol' | 'Neutral';
  catalyst_label: string;
  window_days: number | null;
  blurb: string;
  factors: {
    volatility: number;
    catalyst: number;
    liquidity: number;
  };
}

interface SwingSniperBoardResponse {
  generated_at: string;
  regime: {
    label: string;
    market_posture: string;
    bias: string;
  };
  ideas: SwingSniperBoardIdea[];
}

interface SwingSniperMemoResponse {
  generated_at: string;
  regime: {
    label: string;
    market_posture: string;
  };
  desk_note: string;
  themes: string[];
  saved_theses: Array<{
    symbol: string;
    label: string;
    saved_at: string;
  }>;
  action_queue: string[];
}

interface SwingSniperDossierContract {
  symbol: string;
  orc_score: number;
  view: 'Long vol' | 'Short vol' | 'Neutral';
  catalyst_label: string;
  headline: string;
  thesis: {
    summary: string;
    risks: string[];
    narrative_shifts: string[];
    factors: {
      volatility: number;
      catalyst: number;
      liquidity: number;
    };
  };
  vol_map: {
    surface_read: string;
    iv_rank: number | null;
    iv_percentile: number | null;
    rv_20d: number | null;
    iv_now: number | null;
    skew: string;
    term_shape: string;
    term_structure: Array<{
      label: string;
      iv: number;
    }>;
    iv_rv_history: Array<{
      date: string;
      iv: number | null;
      rv: number | null;
    }>;
  };
  catalysts: Array<{
    days_out: number;
    date: string;
    label: string;
    context: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  structures: Array<{
    name: string;
    fit_score: number;
    rationale: string;
    entry_type: string;
    max_loss: string;
    pop: string;
    style: string;
    contracts: unknown[] | null;
    scenario_distribution: unknown[] | null;
    payoff_diagram: unknown[] | null;
  }>;
  risk: {
    killers: string[];
    exit_framework: string;
  };
}

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

function toViewLabel(direction: SwingSniperDirection): 'Long vol' | 'Short vol' | 'Neutral' {
  if (direction === 'long_vol') return 'Long vol';
  if (direction === 'short_vol') return 'Short vol';
  return 'Neutral';
}

function toSkewLabel(skew: SwingSniperDossierResponse['volMap']['skewDirection']): string {
  if (skew === 'put_heavy') return 'Put heavy';
  if (skew === 'call_heavy') return 'Call heavy';
  if (skew === 'balanced') return 'Balanced';
  return 'Unknown';
}

function toTermLabel(termShape: SwingSniperDossierResponse['volMap']['termStructureShape']): string {
  if (termShape === 'backwardation') return 'Backwardation';
  if (termShape === 'contango') return 'Contango';
  return 'Flat';
}

function toStyleLabel(strategy: string): string {
  if (strategy === 'long_call' || strategy === 'long_put') return 'Single-leg';
  if (strategy === 'long_straddle' || strategy === 'long_strangle') return 'Long premium';
  if (strategy.includes('calendar')) return 'Calendar';
  if (strategy.includes('diagonal')) return 'Diagonal';
  if (strategy.includes('butterfly')) return 'Butterfly';
  if (strategy.includes('debit_spread')) return 'Debit spread';
  return 'Defined risk';
}

function toPopLabel(probability: number | null): string {
  if (probability == null) return 'Unknown';
  if (probability >= 65) return 'High';
  if (probability >= 45) return 'Medium';
  return 'Low';
}

function toMaxLossLabel(maxLoss: number | null): string {
  if (maxLoss == null) return 'Defined';
  if (maxLoss <= 0) return 'Defined';
  return `$${maxLoss.toFixed(0)}`;
}

function normalizeTermStructureBars(
  bars: SwingSniperDossierResponse['volMap']['termStructure'],
  currentIV: number | null,
): Array<{ label: string; iv: number }> {
  const targets = [7, 14, 21, 35, 49];
  if (!bars.length) {
    const fallback = currentIV ?? 0;
    return targets.map((target) => ({ label: `${target}D`, iv: Number(fallback.toFixed(1)) }));
  }

  return targets.map((target) => {
    const nearest = [...bars].sort((left, right) => (
      Math.abs(left.dte - target) - Math.abs(right.dte - target)
    ))[0];
    return {
      label: `${target}D`,
      iv: Number((nearest?.atmIV ?? currentIV ?? 0).toFixed(1)),
    };
  });
}

function buildBoardResponse(
  universe: SwingSniperUniverseResponse,
  brief: SwingSniperBriefResponse,
): SwingSniperBoardResponse {
  const ideas = universe.opportunities
    .slice(0, SWING_SNIPER_BOARD_SURFACE_SIZE)
    .map((opportunity): SwingSniperBoardIdea => ({
      symbol: opportunity.symbol,
      orc_score: opportunity.score,
      view: toViewLabel(opportunity.direction),
      catalyst_label: opportunity.catalystLabel,
      window_days: opportunity.catalystDaysUntil,
      blurb: opportunity.thesis,
      factors: {
        volatility: opportunity.orc.volMispricing,
        catalyst: opportunity.orc.catalystDensity,
        liquidity: opportunity.orc.liquidity,
      },
    }));

  const posture = brief.outlook?.summary || brief.regime.description;
  const bias = brief.outlook
    ? brief.outlook.bias === 'vol_expansion'
      ? 'Long vol favored in select names'
      : brief.outlook.bias === 'vol_compression'
        ? 'Selective short-vol setups favored'
        : 'Balanced long and short-vol mix'
    : 'Balanced opportunity set';

  return {
    generated_at: universe.generatedAt,
    regime: {
      label: brief.regime.label,
      market_posture: posture,
      bias,
    },
    ideas,
  };
}

function buildMemoThemes(brief: SwingSniperBriefResponse): string[] {
  const fromBoardThemes = brief.boardThemes
    .slice(0, 4)
    .map((theme) => `${theme.label}: ${theme.count} names clustering.`);

  if (fromBoardThemes.length > 0) {
    return fromBoardThemes;
  }

  const fallback: string[] = [];
  if (brief.outlook?.summary) fallback.push(brief.outlook.summary);
  fallback.push(...brief.outlook?.riskFlags.slice(0, 2) ?? []);
  return fallback.slice(0, 4);
}

function buildMemoResponse(brief: SwingSniperBriefResponse): SwingSniperMemoResponse {
  return {
    generated_at: brief.generatedAt,
    regime: {
      label: brief.regime.label,
      market_posture: brief.regime.description,
    },
    desk_note: brief.memo,
    themes: buildMemoThemes(brief),
    saved_theses: brief.savedTheses.map((saved) => ({
      symbol: saved.symbol,
      label: saved.setupLabel,
      saved_at: saved.savedAt,
    })),
    action_queue: brief.actionQueue.slice(0, 4),
  };
}

function buildDossierContract(payload: SwingSniperDossierResponse): SwingSniperDossierContract {
  const narrativeShifts = [
    payload.catalysts.narrative,
    ...payload.news.slice(0, 2).map((item) => item.title),
  ].filter(Boolean);

  const surfaceRead = payload.reasoning[0]
    || `Current IV is ${payload.volMap.currentIV?.toFixed(1) ?? '--'}% against RV20 ${payload.volMap.realizedVol20?.toFixed(1) ?? '--'}%.`;

  return {
    symbol: payload.symbol,
    orc_score: payload.score ?? 0,
    view: toViewLabel(payload.direction),
    catalyst_label: payload.catalysts.events[0]?.title ?? payload.setupLabel,
    headline: payload.thesis,
    thesis: {
      summary: payload.summary,
      risks: payload.risk.invalidation,
      narrative_shifts: narrativeShifts.slice(0, 4),
      factors: payload.factors,
    },
    vol_map: {
      surface_read: surfaceRead,
      iv_rank: payload.volMap.ivRank,
      iv_percentile: payload.volMap.ivPercentile,
      rv_20d: payload.volMap.realizedVol20,
      iv_now: payload.volMap.currentIV,
      skew: toSkewLabel(payload.volMap.skewDirection),
      term_shape: toTermLabel(payload.volMap.termStructureShape),
      term_structure: normalizeTermStructureBars(payload.volMap.termStructure, payload.volMap.currentIV),
      iv_rv_history: payload.volMap.overlayPoints.map((point) => ({
        date: point.date,
        iv: point.iv,
        rv: point.rv,
      })),
    },
    catalysts: payload.catalysts.events.map((event) => ({
      days_out: event.daysUntil,
      date: event.date,
      label: event.title,
      context: event.summary,
      severity: event.impact,
    })),
    structures: payload.structureLab.recommendations.map((recommendation) => ({
      name: recommendation.strategyLabel,
      fit_score: recommendation.thesisFit,
      rationale: recommendation.whyThisStructure[0] ?? recommendation.entryWindow,
      entry_type: recommendation.debitOrCredit === 'debit' ? 'Debit' : 'Credit',
      max_loss: toMaxLossLabel(recommendation.maxLoss),
      pop: toPopLabel(recommendation.probabilityOfProfit),
      style: toStyleLabel(recommendation.strategy),
      contracts: recommendation.contracts.length > 0 ? recommendation.contracts : null,
      scenario_distribution: recommendation.payoffDistribution.length > 0 ? recommendation.payoffDistribution : null,
      payoff_diagram: recommendation.payoffDiagram.length > 0 ? recommendation.payoffDiagram : null,
    })),
    risk: {
      killers: payload.risk.invalidation,
      exit_framework: payload.risk.exitFramework,
    },
  };
}

async function getCachedSwingSniperBrief(userId: string): Promise<SwingSniperBriefResponse> {
  const cacheKey = toCacheKey('brief', userId);
  const cached = await cacheGet<SwingSniperBriefResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const payload = await buildSwingSniperBrief(userId);
  await cacheSet(cacheKey, payload, SWING_SNIPER_BRIEF_CACHE_TTL_SECONDS);
  return payload;
}

async function loadUniversePayload(input: {
  userId: string;
  symbols: string[];
  limit: number;
  refresh: boolean;
}): Promise<SwingSniperUniverseResponse> {
  const watchlistState = await getSwingSniperWatchlistState(input.userId);
  const scanLimit = Math.max(25, Math.min(SWING_SNIPER_LAUNCH_UNIVERSE_TARGET, input.limit || SWING_SNIPER_LAUNCH_UNIVERSE_TARGET));
  const requestedSymbols = sanitizeSymbols(input.symbols || [], scanLimit);
  const universeSymbols = requestedSymbols.length > 0
    ? requestedSymbols
    : sanitizeSymbols([
      ...SWING_SNIPER_CORE_SCAN_SYMBOLS,
      ...watchlistState.symbols,
      ...watchlistState.savedTheses.map((item) => item.symbol),
    ], scanLimit);

  const symbolHash = hashSymbols(universeSymbols);
  const cacheKey = toCacheKey('universe', `${input.userId}:${scanLimit}:${symbolHash}`);
  if (!input.refresh) {
    const cached = await cacheGet<SwingSniperUniverseResponse>(cacheKey);
    if (cached) {
      return cached;
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
      input.userId,
      payload.opportunities.slice(0, SWING_SNIPER_BOARD_SURFACE_SIZE).map((opportunity) => ({
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
      userId: input.userId,
      error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
    });
  }

  return payload;
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
    const payload = await getCachedSwingSniperBrief(userId);
    res.json(payload);
  } catch (error) {
    logger.error('Failed to build Swing Sniper brief', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Market data unavailable',
      message: 'Unable to refresh Swing Sniper memo right now.',
      retryAfter: 30,
    });
  }
});

router.get('/memo', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const briefPayload = await getCachedSwingSniperBrief(userId);
    res.json(buildMemoResponse(briefPayload));
  } catch (error) {
    logger.error('Failed to build Swing Sniper memo', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({
      error: 'Market data unavailable',
      message: 'Unable to refresh the desk memo right now.',
      retryAfter: 30,
    });
  }
});

router.get(
  '/board',
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

      const [universePayload, briefPayload] = await Promise.all([
        loadUniversePayload({
          userId,
          symbols: validated.symbols,
          limit: validated.limit,
          refresh: validated.refresh,
        }),
        getCachedSwingSniperBrief(userId),
      ]);

      res.json(buildBoardResponse(universePayload, briefPayload));
    } catch (error) {
      logger.error('Failed to build Swing Sniper board', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(503).json({
        error: 'Market data unavailable',
        message: 'Unable to refresh the signal board right now.',
        retryAfter: 30,
      });
    }
  },
);

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

      const payload = await loadUniversePayload({
        userId,
        symbols: validated.symbols,
        limit: validated.limit,
        refresh: validated.refresh,
      });

      res.json(payload);
    } catch (error) {
      logger.error('Failed to build Swing Sniper universe', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(503).json({
        error: 'Market data unavailable',
        message: 'Unable to refresh Swing Sniper board data right now.',
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

      const [dossier, watchlistState] = await Promise.all([
        buildSwingSniperDossier(req.user!.id, validatedBody.symbol),
        getSwingSniperWatchlistState(req.user!.id),
      ]);
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
        riskMode: watchlistState.filters.riskMode,
        swingWindow: watchlistState.filters.swingWindow,
        preferredSetups: watchlistState.filters.preferredSetups,
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
      error: 'Market data unavailable',
      message: 'Unable to refresh thesis monitoring right now.',
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
        error: 'Market data unavailable',
        message: 'Unable to refresh backtest context right now.',
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
      const normalizedSymbol = sanitizeSymbols([symbol], 1)[0] || symbol.toUpperCase();
      const cacheKey = toCacheKey('dossier', `${req.user!.id}:${normalizedSymbol}`);
      const cached = await cacheGet<SwingSniperDossierContract>(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const legacyPayload = await buildSwingSniperDossier(req.user!.id, normalizedSymbol);
      const payload = buildDossierContract(legacyPayload);

      try {
        await saveSwingSniperSignalSnapshots(req.user!.id, [
          {
            symbol: legacyPayload.symbol,
            asOf: legacyPayload.asOf,
            capturedFrom: 'dossier',
            score: legacyPayload.score,
            direction: legacyPayload.direction,
            setupLabel: legacyPayload.setupLabel,
            thesis: legacyPayload.thesis,
            currentPrice: legacyPayload.currentPrice,
            currentIV: legacyPayload.volMap.currentIV,
            realizedVol20: legacyPayload.volMap.realizedVol20,
            ivRank: legacyPayload.volMap.ivRank,
            ivPercentile: legacyPayload.volMap.ivPercentile,
            ivVsRvGap: legacyPayload.volMap.currentIV != null && legacyPayload.volMap.realizedVol20 != null
              ? legacyPayload.volMap.currentIV - legacyPayload.volMap.realizedVol20
              : null,
            catalystDate: legacyPayload.catalysts.events[0]?.date || null,
            catalystDaysUntil: legacyPayload.catalysts.events[0]?.daysUntil ?? null,
            snapshot: {
              reasoning: legacyPayload.reasoning,
              setupLabel: legacyPayload.setupLabel,
              expressionPreview: legacyPayload.expressionPreview,
              topStructure: legacyPayload.structureLab.recommendations[0]?.strategyLabel || null,
              riskNotes: legacyPayload.risk.notes,
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

      await cacheSet(cacheKey, payload, SWING_SNIPER_DOSSIER_CACHE_TTL_SECONDS);
      res.json(payload);
    } catch (error) {
      logger.error('Failed to build Swing Sniper dossier', {
        userId: req.user?.id,
        symbol: req.params.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(503).json({
        error: 'Market data unavailable',
        message: 'Unable to refresh this dossier right now.',
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
        removeThesisSymbol: payload.removeThesisSymbol
          ? sanitizeSymbols([payload.removeThesisSymbol], 1)[0] || null
          : payload.removeThesisSymbol,
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
