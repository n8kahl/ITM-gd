import { calculateLevels } from '../services/levels';
import { fetchIntradayData, fetchDailyData } from '../services/levels/fetcher';
import {
  calculateFibonacciRetracement,
  findClosestFibLevel,
} from '../services/levels/calculators/fibonacciRetracement';
import { detectConfluence } from '../services/levels/confluenceDetector';
import { formatLevelTestSummary, type LevelTestHistory } from '../services/levels/levelTestTracker';
import { fetchOptionsChain } from '../services/options/optionsChainFetcher';
import { calculateGEXProfile } from '../services/options/gexCalculator';
import { analyzeZeroDTE } from '../services/options/zeroDTE';
import { analyzeIVProfile } from '../services/options/ivAnalysis';
import { getEarningsAnalysis, getEarningsCalendar } from '../services/earnings';
import {
  analyzePosition,
  analyzePortfolio,
  getPositionById,
  getUserPositions,
} from '../services/options/positionAnalyzer';
import { Position } from '../services/options/types';
import { supabase } from '../config/database';
import { getMarketStatus as getMarketStatusService } from '../services/marketHours';
import { scanOpportunities } from '../services/scanner';
import { analyzeLongTermTrend } from '../services/charts/chartDataService';
import { generateGreeksProjection, assessGreeksTrend } from '../services/leaps/greeksProjection';
import { calculateRoll } from '../services/leaps/rollCalculator';
import { getMacroContext, assessMacroImpact } from '../services/macro/macroContext';
import { daysToExpiry as calcDaysToExpiry } from '../services/options/blackScholes';
import { ExitAdvisor } from '../services/positions/exitAdvisor';
import { isValidSymbol, normalizeSymbol, POPULAR_SYMBOLS, sanitizeSymbols } from '../lib/symbols';
import { hasRequiredTierForUser } from '../middleware/requireTier';
// Note: Circuit breaker wraps OpenAI calls in chatService.ts; handlers use withTimeout for external APIs

/**
 * Function handlers - these execute when the AI calls a function
 * They return results that get fed back to the AI
 */

interface FunctionCall {
  name: string;
  arguments: string; // JSON string
}

interface FunctionCallContext {
  userId?: string;
}

/**
 * Execute a function with a timeout. Prevents hung external API calls.
 */
async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

const FUNCTION_TIMEOUT_MS = 10000; // 10 second timeout per function call
const PREMIUM_FUNCTIONS = new Set([
  'get_gamma_exposure',
  'get_zero_dte_analysis',
  'get_iv_analysis',
  'get_earnings_analysis',
]);

function toValidSymbol(symbol: unknown): string | null {
  if (typeof symbol !== 'string') return null;
  const normalized = normalizeSymbol(symbol);
  return isValidSymbol(normalized) ? normalized : null;
}

function invalidSymbolError(): { error: string; message: string } {
  return {
    error: 'Invalid symbol',
    message: 'Symbol must be 1-10 chars and may include letters, numbers, dot, underscore, colon, or hyphen',
  };
}

interface FreshnessMeta {
  asOf: string;
  source: string;
  delayed: boolean;
  staleAfterSeconds: number;
  warning?: string;
}

function withFreshness<T extends object>(payload: T, freshness: FreshnessMeta): T & { freshness: FreshnessMeta } {
  return {
    ...payload,
    freshness,
  };
}

export async function executeFunctionCall(functionCall: FunctionCall, context?: FunctionCallContext): Promise<any> {
  const { name, arguments: argsString } = functionCall;
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsString);
  } catch (parseError) {
    throw new Error(`Invalid function arguments JSON: ${(parseError as Error).message}`);
  }

  // Validate required fields based on function name
  if (!args || typeof args !== 'object') {
    throw new Error('Function arguments must be a JSON object');
  }

  if (context?.userId && PREMIUM_FUNCTIONS.has(name)) {
    try {
      const hasTier = await hasRequiredTierForUser(context.userId, ['pro']);
      if (!hasTier) {
        return {
          error: 'This feature requires a Pro subscription',
          requiredTier: 'pro',
        };
      }
    } catch (_error) {
      return {
        error: 'Subscription verification unavailable',
        message: 'Unable to verify subscription tier. Please try again shortly.',
      };
    }
  }

  // Cast args to `any` at the dispatch layer — each handler validates its own inputs
  const typedArgs = args as any;

  switch (name) {
    case 'get_key_levels':
      return await handleGetKeyLevels(typedArgs);

    case 'get_current_price':
      return await handleGetCurrentPrice(typedArgs);

    case 'get_fibonacci_levels':
      return await handleGetFibonacciLevels(typedArgs);

    case 'get_market_status':
      return await handleGetMarketStatus(typedArgs);

    case 'get_options_chain':
      return await handleGetOptionsChain(typedArgs);

    case 'get_gamma_exposure':
      return await handleGetGammaExposure(typedArgs);

    case 'get_zero_dte_analysis':
      return await handleGetZeroDTEAnalysis(typedArgs);

    case 'get_iv_analysis':
      return await handleGetIVAnalysis(typedArgs);

    case 'get_spx_game_plan':
      return await handleGetSPXGamePlan(typedArgs);

    case 'get_earnings_calendar':
      return await handleGetEarningsCalendar(typedArgs);

    case 'get_earnings_analysis':
      return await handleGetEarningsAnalysis(typedArgs);

    case 'analyze_position':
      return await handleAnalyzePosition(typedArgs);

    case 'get_position_advice':
      return await handleGetPositionAdvice(typedArgs, context?.userId);

    case 'get_journal_insights':
      return await handleGetJournalInsights(typedArgs, context?.userId);

    case 'get_trade_history_for_symbol':
    case 'get_trade_history':
      return await handleGetTradeHistory(typedArgs, context?.userId);

    case 'set_alert':
      return await handleSetAlert(typedArgs, context?.userId);

    case 'get_alerts':
      return await handleGetAlerts(typedArgs, context?.userId);

    case 'scan_opportunities':
      return await handleScanOpportunities(typedArgs, context?.userId);

    case 'show_chart':
      return await handleShowChart(typedArgs);

    case 'get_long_term_trend':
      return await handleGetLongTermTrend(typedArgs);

    case 'analyze_leaps_position':
      return await handleAnalyzeLeapsPosition(typedArgs);

    case 'analyze_swing_trade':
      return await handleAnalyzeSwingTrade(typedArgs);

    case 'calculate_roll_decision':
      return await handleCalculateRollDecision(typedArgs);

    case 'get_macro_context':
      return await handleGetMacroContext(typedArgs);

    default:
      throw new Error(`Unknown function: ${name}`);
  }
}

/**
 * Handler: get_key_levels
 * Calls the levels calculation engine
 */
async function handleGetKeyLevels(args: { symbol: string; timeframe?: string }) {
  const { symbol, timeframe = 'intraday' } = args;
  const validSymbol = toValidSymbol(symbol);

  if (!validSymbol) {
    return invalidSymbolError();
  }

  try {
    // Call the levels service
    const levels = await withTimeout(
      () => calculateLevels(validSymbol, timeframe),
      FUNCTION_TIMEOUT_MS,
      'get_key_levels'
    );

    let fibonacci: ReturnType<typeof calculateFibonacciRetracement> | null = null;
    try {
      const fibBars = await withTimeout(
        () => fetchDailyData(validSymbol, 40),
        FUNCTION_TIMEOUT_MS,
        'get_key_levels.fibonacci',
      );
      if (fibBars.length >= 2) {
        fibonacci = calculateFibonacciRetracement(validSymbol, fibBars, 'daily', 20);
      }
    } catch (_error) {
      fibonacci = null;
    }

    const confluenceZones = detectConfluence(levels, fibonacci, null, levels.currentPrice);

    const testSummaries = [...levels.levels.resistance, ...levels.levels.support]
      .filter((level) => (level.testsToday || 0) > 0)
      .map((level) => {
        const history: LevelTestHistory = {
          level: `${level.type}_${level.price.toFixed(2)}`,
          levelType: level.type,
          levelPrice: level.price,
          side: level.side || (level.price >= levels.currentPrice ? 'resistance' : 'support'),
          testsToday: level.testsToday || 0,
          tests: [],
          holdRate: level.holdRate || 0,
          lastTest: level.lastTest || null,
          avgVolumeAtTest: null,
        };
        return formatLevelTestSummary(history);
      });

    // Return simplified response for AI (remove some metadata)
    return withFreshness({
      symbol: levels.symbol,
      currentPrice: levels.currentPrice,
      levels: {
        resistance: levels.levels.resistance.slice(0, 5).map((level) => ({
          ...level,
          name: level.type,
        })), // Top 5 resistance levels
        support: levels.levels.support.slice(0, 5).map((level) => ({
          ...level,
          name: level.type,
        })), // Top 5 support levels
        pivots: levels.levels.pivots,
        indicators: levels.levels.indicators
      },
      fibonacci,
      confluenceZones,
      testSummaries,
      aiGuidance: {
        strongestResistance: levels.levels.resistance[0] || null,
        strongestSupport: levels.levels.support[0] || null,
        nearestConfluence: confluenceZones[0] || null,
        criticalLevels: [...levels.levels.resistance, ...levels.levels.support]
          .filter((level) => level.strength === 'critical')
          .slice(0, 3),
      },
      marketContext: levels.marketContext,
      timestamp: levels.timestamp
    }, {
      asOf: levels.timestamp || new Date().toISOString(),
      source: 'key_levels',
      delayed: false,
      staleAfterSeconds: 300,
    });
  } catch (error: any) {
    return {
      error: 'Failed to fetch levels',
      message: error.message
    };
  }
}

/**
 * Handler: get_current_price
 * Gets the most recent price from intraday data
 */
async function handleGetCurrentPrice(args: { symbol: string }) {
  const { symbol } = args;
  const validSymbol = toValidSymbol(symbol);

  if (!validSymbol) {
    return invalidSymbolError();
  }

  try {
    // Fetch intraday data
    const intradayData = await withTimeout(
      () => fetchIntradayData(validSymbol),
      FUNCTION_TIMEOUT_MS,
      'get_current_price'
    );

    if (intradayData.length > 0) {
      // Market is open or has today's data
      const latestCandle = intradayData[intradayData.length - 1];
      return withFreshness({
        symbol: validSymbol,
        price: latestCandle.c,
        timestamp: new Date(latestCandle.t).toISOString(),
        high: latestCandle.h,
        low: latestCandle.l,
        volume: latestCandle.v,
        isDelayed: false
      }, {
        asOf: new Date(latestCandle.t).toISOString(),
        source: 'intraday',
        delayed: false,
        staleAfterSeconds: 90,
      });
    }

    // Fallback to daily data (covers weekends + holidays with 7-day lookback)
    const dailyData = await fetchDailyData(validSymbol, 7);
    if (dailyData.length > 0) {
      const latestBar = dailyData[dailyData.length - 1];
      const marketStatus = getMarketStatusService();
      const delayedAsOf = new Date(latestBar.t).toISOString();
      return withFreshness({
        symbol: validSymbol,
        price: latestBar.c,
        timestamp: delayedAsOf,
        high: latestBar.h,
        low: latestBar.l,
        volume: latestBar.v,
        isDelayed: true,
        priceAsOf: 'Last trading day close',
        marketStatusMessage: marketStatus.message || 'Market is currently closed'
      }, {
        asOf: delayedAsOf,
        source: 'daily_close',
        delayed: true,
        staleAfterSeconds: 24 * 60 * 60,
        warning: 'Using delayed daily close because intraday feed is unavailable.',
      });
    }

    return {
      error: 'No price data available',
      message: 'No market data found for the past 7 days'
    };
  } catch (error: any) {
    return {
      error: 'Failed to fetch current price',
      message: error.message
    };
  }
}

/**
 * Handler: get_fibonacci_levels
 * Calculates Fibonacci retracement/extension levels for the requested symbol.
 */
async function handleGetFibonacciLevels(args: {
  symbol: string;
  timeframe?: 'daily' | '1h' | '15m' | '5m';
  lookback?: number;
}) {
  const validSymbol = toValidSymbol(args.symbol);
  if (!validSymbol) {
    return invalidSymbolError();
  }

  const timeframe = args.timeframe || 'daily';
  const normalizedLookback = typeof args.lookback === 'number' && Number.isFinite(args.lookback)
    ? Math.max(2, Math.min(100, Math.floor(args.lookback)))
    : 20;

  try {
    const bars = timeframe === 'daily'
      ? await withTimeout(
          () => fetchDailyData(validSymbol, normalizedLookback + 10),
          FUNCTION_TIMEOUT_MS,
          'get_fibonacci_levels.daily',
        )
      : await withTimeout(
          () => fetchIntradayData(validSymbol),
          FUNCTION_TIMEOUT_MS,
          'get_fibonacci_levels.intraday',
        );

    if (bars.length < 2) {
      return {
        error: 'Insufficient data',
        message: `Not enough price data for ${validSymbol} to calculate Fibonacci levels`,
      };
    }

    const fibStartMs = Date.now();
    const fib = calculateFibonacciRetracement(validSymbol, bars, timeframe, normalizedLookback);
    const fibDurationMs = Date.now() - fibStartMs;
    const currentPrice = bars[bars.length - 1].c;
    const closest = findClosestFibLevel(fib, currentPrice);

    const closestRatio = closest.level.replace('level_', '');
    const interpretation = fib.direction === 'retracement'
      ? `Price pulled back from swing high $${fib.swingHigh.toFixed(2)}. Key support sits near 61.8% ($${fib.levels.level_618.toFixed(2)}).`
      : `Price rallied from swing low $${fib.swingLow.toFixed(2)}. Key resistance sits near 61.8% ($${fib.levels.level_618.toFixed(2)}).`;

    return withFreshness({
      ...fib,
      currentPrice: Number(currentPrice.toFixed(2)),
      closestLevel: {
        name: `${closestRatio}%`,
        price: closest.price,
        distance: closest.distance,
        distancePct: Number(((closest.distance / currentPrice) * 100).toFixed(2)),
      },
      interpretation,
      performance: {
        fibCalculationMs: fibDurationMs,
        withinTarget: fibDurationMs < 100,
      },
    }, {
      asOf: new Date().toISOString(),
      source: 'fibonacci_levels',
      delayed: false,
      staleAfterSeconds: 300,
    });
  } catch (error: any) {
    return {
      error: 'Calculation failed',
      message: error.message,
    };
  }
}

/**
 * Handler: get_market_status
 * Determines if market is open, pre-market, after-hours, or closed
 * Uses DST-aware market hours and holiday calendar
 */
async function handleGetMarketStatus(_args: any) {
  return getMarketStatusService();
}

/**
 * Handler: get_options_chain
 * Fetches options chain with Greeks and IV
 */
async function handleGetOptionsChain(args: {
  symbol: string;
  expiry?: string;
  strikeRange?: number;
}) {
  const { symbol, expiry, strikeRange = 10 } = args;
  const validSymbol = toValidSymbol(symbol);

  if (!validSymbol) {
    return invalidSymbolError();
  }

  try {
    const chain = await withTimeout(
      () => fetchOptionsChain(validSymbol, expiry, strikeRange),
      FUNCTION_TIMEOUT_MS,
      'get_options_chain'
    );

    // Simplify for AI - return only most relevant data
    return withFreshness({
      symbol: chain.symbol,
      currentPrice: chain.currentPrice,
      expiry: chain.expiry,
      daysToExpiry: chain.daysToExpiry,
      ivRank: chain.ivRank,
      calls: chain.options.calls.map(c => ({
        strike: c.strike,
        last: c.last,
        bid: c.bid,
        ask: c.ask,
        volume: c.volume,
        openInterest: c.openInterest,
        iv: (c.impliedVolatility * 100).toFixed(1) + '%',
        delta: c.delta?.toFixed(2),
        gamma: c.gamma?.toFixed(4),
        theta: c.theta?.toFixed(2),
        vega: c.vega?.toFixed(2),
        inTheMoney: c.inTheMoney
      })),
      puts: chain.options.puts.map(p => ({
        strike: p.strike,
        last: p.last,
        bid: p.bid,
        ask: p.ask,
        volume: p.volume,
        openInterest: p.openInterest,
        iv: (p.impliedVolatility * 100).toFixed(1) + '%',
        delta: p.delta?.toFixed(2),
        gamma: p.gamma?.toFixed(4),
        theta: p.theta?.toFixed(2),
        vega: p.vega?.toFixed(2),
        inTheMoney: p.inTheMoney
      }))
    }, {
      asOf: new Date().toISOString(),
      source: 'options_chain',
      delayed: false,
      staleAfterSeconds: 300,
    });
  } catch (error: any) {
    return {
      error: 'Failed to fetch options chain',
      message: error.message
    };
  }
}

/**
 * Handler: get_gamma_exposure
 * Calculates options gamma exposure profile for SPX/NDX
 */
async function handleGetGammaExposure(args: {
  symbol: string;
  expiry?: string;
  strikeRange?: number;
  maxExpirations?: number;
  forceRefresh?: boolean;
}) {
  const {
    symbol,
    expiry,
    strikeRange,
    maxExpirations,
    forceRefresh = false,
  } = args;
  const validSymbol = toValidSymbol(symbol);

  if (!validSymbol) {
    return invalidSymbolError();
  }

  try {
    const profile = await withTimeout(
      () => calculateGEXProfile(validSymbol, { expiry, strikeRange, maxExpirations, forceRefresh }),
      FUNCTION_TIMEOUT_MS,
      'get_gamma_exposure',
    );

    return withFreshness({
      symbol: profile.symbol,
      spotPrice: profile.spotPrice,
      regime: profile.regime,
      flipPoint: profile.flipPoint,
      maxGEXStrike: profile.maxGEXStrike,
      keyLevels: profile.keyLevels,
      implication: profile.implication,
      expirationsAnalyzed: profile.expirationsAnalyzed,
      calculatedAt: profile.calculatedAt,
      gexByStrike: profile.gexByStrike,
    }, {
      asOf: profile.calculatedAt || new Date().toISOString(),
      source: 'gamma_exposure',
      delayed: false,
      staleAfterSeconds: 300,
    });
  } catch (error: any) {
    return {
      error: 'Failed to calculate gamma exposure',
      message: error.message,
    };
  }
}

/**
 * Handler: get_zero_dte_analysis
 * Returns expected move usage, theta clock, and gamma profile for current-day expiration.
 */
async function handleGetZeroDTEAnalysis(args: {
  symbol: string;
  strike?: number;
  type?: 'call' | 'put';
}) {
  const { symbol, strike, type } = args;
  const validSymbol = toValidSymbol(symbol);

  if (!validSymbol) {
    return invalidSymbolError();
  }

  try {
    const analysis = await withTimeout(
      () => analyzeZeroDTE(validSymbol, { strike, type }),
      FUNCTION_TIMEOUT_MS,
      'get_zero_dte_analysis',
    );

    return withFreshness(analysis, {
      asOf: new Date().toISOString(),
      source: 'zero_dte_analysis',
      delayed: false,
      staleAfterSeconds: 300,
    });
  } catch (error: any) {
    return {
      error: 'Failed to analyze 0DTE structure',
      message: error.message,
    };
  }
}

/**
 * Handler: get_iv_analysis
 * Returns IV rank, skew, and term-structure profile for a symbol.
 */
async function handleGetIVAnalysis(args: {
  symbol: string;
  expiry?: string;
  strikeRange?: number;
  maxExpirations?: number;
  forceRefresh?: boolean;
}) {
  const {
    symbol,
    expiry,
    strikeRange,
    maxExpirations,
    forceRefresh = false,
  } = args;
  const validSymbol = toValidSymbol(symbol);

  if (!validSymbol) {
    return invalidSymbolError();
  }

  try {
    const profile = await withTimeout(
      () => analyzeIVProfile(validSymbol, { expiry, strikeRange, maxExpirations, forceRefresh }),
      FUNCTION_TIMEOUT_MS,
      'get_iv_analysis',
    );
    const asOf = typeof profile.asOf === 'string' ? profile.asOf : new Date().toISOString();
    return withFreshness(profile, {
      asOf,
      source: 'iv_analysis',
      delayed: false,
      staleAfterSeconds: 300,
    });
  } catch (error: any) {
    return {
      error: 'Failed to analyze implied volatility',
      message: error.message,
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function findNamedLevel(levels: Record<string, unknown> | null, target: string): number | null {
  if (!levels) return null;
  const sections: unknown[] = [levels.resistance, levels.support];
  const upperTarget = target.toUpperCase();

  for (const section of sections) {
    if (!Array.isArray(section)) continue;
    for (const item of section) {
      const rec = asRecord(item);
      if (!rec) continue;
      const type = String(rec.type ?? rec.name ?? '').toUpperCase();
      if (type === upperTarget) {
        return toFiniteNumber(rec.price);
      }
    }
  }

  return null;
}

function buildSetupContext(
  currentPrice: number,
  keyLevels: Record<string, unknown> | null,
  gexProfile: Record<string, unknown> | null,
  gammaRegime: 'positive' | 'negative' | 'neutral',
): string {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return 'SPX setup context unavailable due to missing live price data.';
  }

  const indicators = asRecord(keyLevels?.indicators);
  const pivots = asRecord(keyLevels?.pivots);
  const standardPivots = asRecord(pivots?.standard);
  const pivot = toFiniteNumber(standardPivots?.pp);
  const vwap = toFiniteNumber(indicators?.vwap);
  const pdh = findNamedLevel(keyLevels, 'PDH');
  const pdl = findNamedLevel(keyLevels, 'PDL');
  const flipPoint = toFiniteNumber(gexProfile?.flipPoint);
  const maxGEXStrike = toFiniteNumber(gexProfile?.maxGEXStrike);

  const anchors = [vwap, pivot, pdh, pdl].filter((value): value is number => value !== null);
  const nearestAnchor = anchors.length > 0
    ? anchors.reduce((closest, level) =>
      Math.abs(level - currentPrice) < Math.abs(closest - currentPrice) ? level : closest, anchors[0])
    : null;

  const distanceText = nearestAnchor !== null
    ? `${Math.abs(currentPrice - nearestAnchor).toFixed(1)} pts from key anchor ${nearestAnchor.toFixed(1)}`
    : 'key anchors unavailable';

  const regimeText = gammaRegime === 'positive'
    ? 'positive gamma (mean-reversion favored)'
    : gammaRegime === 'negative'
      ? 'negative gamma (trend-extension risk elevated)'
      : 'neutral gamma (mixed dealer hedging pressure)';

  const gexReference = maxGEXStrike !== null
    ? `max GEX strike ${maxGEXStrike.toFixed(0)}`
    : flipPoint !== null
      ? `gamma flip ${flipPoint.toFixed(0)}`
      : 'no dominant GEX reference';

  return `SPX is ${distanceText} in a ${regimeText} regime. Watch ${gexReference} for intraday control shifts and confirm direction with reclaim/reject behavior around VWAP and pivot.`;
}

/**
 * Handler: get_spx_game_plan
 * Composite SPX workflow to minimize multi-tool latency for high-frequency prompts.
 */
async function handleGetSPXGamePlan(args: { include_spy?: boolean }) {
  const includeSpy = args.include_spy !== false;

  try {
    const [spxLevelsRaw, spxGexRaw, spxZeroDTERaw, spxPriceRaw, spyPriceRaw] = await withTimeout(
      () => Promise.all([
        handleGetKeyLevels({ symbol: 'SPX', timeframe: 'intraday' }),
        handleGetGammaExposure({ symbol: 'SPX' }),
        handleGetZeroDTEAnalysis({ symbol: 'SPX' }),
        handleGetCurrentPrice({ symbol: 'SPX' }),
        includeSpy ? handleGetCurrentPrice({ symbol: 'SPY' }) : Promise.resolve(null),
      ]),
      FUNCTION_TIMEOUT_MS,
      'get_spx_game_plan',
    );

    const spxLevels = asRecord(spxLevelsRaw);
    const spxGex = asRecord(spxGexRaw);
    const spxZeroDTE = asRecord(spxZeroDTERaw);
    const spxPrice = asRecord(spxPriceRaw);
    const spyPrice = asRecord(spyPriceRaw);

    const spxPriceVal = toFiniteNumber(spxPrice?.price)
      ?? toFiniteNumber(spxLevels?.currentPrice)
      ?? toFiniteNumber(spxGex?.spotPrice)
      ?? 0;
    const spyPriceVal = toFiniteNumber(spyPrice?.price) ?? 0;
    const ratio = spyPriceVal > 0 ? spxPriceVal / spyPriceVal : null;

    const flipPoint = toFiniteNumber(spxGex?.flipPoint);
    const maxGEXStrike = toFiniteNumber(spxGex?.maxGEXStrike);

    const gammaRegime: 'positive' | 'negative' | 'neutral' = flipPoint !== null && spxPriceVal > 0
      ? (spxPriceVal > flipPoint ? 'positive' : 'negative')
      : 'neutral';

    const levelsData = asRecord(spxLevels?.levels);
    const indicators = asRecord(levelsData?.indicators);
    const expectedMove = toFiniteNumber(indicators?.expectedMove)
      ?? toFiniteNumber(indicators?.atr14)
      ?? toFiniteNumber(asRecord(spxZeroDTE?.expectedMove)?.totalExpectedMove);

    const spyExpectedMove = expectedMove !== null && ratio !== null && ratio > 0
      ? expectedMove / ratio
      : null;

    return withFreshness({
      symbol: 'SPX',
      currentPrice: spxPriceVal > 0 ? Number(spxPriceVal.toFixed(2)) : null,
      spyPrice: includeSpy && spyPriceVal > 0 ? Number(spyPriceVal.toFixed(2)) : null,
      spxSpyRatio: ratio !== null ? Number(ratio.toFixed(2)) : null,
      gammaRegime,
      flipPoint: flipPoint !== null ? Number(flipPoint.toFixed(2)) : null,
      maxGEXStrike: maxGEXStrike !== null ? Number(maxGEXStrike.toFixed(2)) : null,
      expectedMove: expectedMove !== null ? Number(expectedMove.toFixed(2)) : null,
      spyExpectedMove: spyExpectedMove !== null ? Number(spyExpectedMove.toFixed(2)) : null,
      keyLevels: levelsData,
      gexProfile: spxGex,
      zeroDTE: spxZeroDTE,
      setupContext: buildSetupContext(spxPriceVal, levelsData, spxGex, gammaRegime),
    }, {
      asOf: new Date().toISOString(),
      source: 'spx_game_plan',
      delayed: false,
      staleAfterSeconds: 120,
    });
  } catch (error: any) {
    return {
      error: 'Failed to generate SPX game plan',
      message: error.message,
    };
  }
}

/**
 * Handler: get_earnings_calendar
 * Returns upcoming earnings for a watchlist.
 */
async function handleGetEarningsCalendar(args: {
  watchlist?: string[];
  days_ahead?: number;
}) {
  const watchlist = Array.isArray(args.watchlist) ? sanitizeSymbols(args.watchlist, 25) : [];
  const daysAheadRaw = typeof args.days_ahead === 'number' ? args.days_ahead : 14;
  const daysAhead = Math.max(1, Math.min(60, Math.round(daysAheadRaw)));

  try {
    const events = await withTimeout(
      () => getEarningsCalendar(watchlist, daysAhead),
      FUNCTION_TIMEOUT_MS,
      'get_earnings_calendar',
    );

    return withFreshness({
      watchlist,
      daysAhead,
      count: events.length,
      events,
    }, {
      asOf: new Date().toISOString(),
      source: 'earnings_calendar',
      delayed: false,
      staleAfterSeconds: 6 * 60 * 60,
    });
  } catch (error: any) {
    return {
      error: 'Failed to fetch earnings calendar',
      message: error.message,
    };
  }
}

/**
 * Handler: get_earnings_analysis
 * Returns expected move + historical earnings move context for one symbol.
 */
async function handleGetEarningsAnalysis(args: { symbol: string }) {
  const { symbol } = args;
  const validSymbol = toValidSymbol(symbol);

  if (!validSymbol) {
    return invalidSymbolError();
  }

  try {
    const analysis = await withTimeout(
      () => getEarningsAnalysis(validSymbol),
      FUNCTION_TIMEOUT_MS,
      'get_earnings_analysis',
    );

    const asOf = typeof analysis.asOf === 'string' ? analysis.asOf : new Date().toISOString();
    return withFreshness(analysis, {
      asOf,
      source: 'earnings_analysis',
      delayed: false,
      staleAfterSeconds: 30 * 60,
    });
  } catch (error: any) {
    return {
      error: 'Failed to fetch earnings analysis',
      message: error.message,
    };
  }
}

/**
 * Handler: analyze_position
 * Analyzes position(s) for P&L, Greeks, and risk
 */
async function handleAnalyzePosition(args: {
  position?: Position;
  positions?: Position[];
}) {
  const { position, positions } = args;

  try {
    // Single position analysis
    if (position) {
      const analysis = await analyzePosition(position);

      return {
        position: {
          symbol: analysis.position.symbol,
          type: analysis.position.type,
          strike: analysis.position.strike,
          expiry: analysis.position.expiry,
          quantity: analysis.position.quantity,
          entryPrice: analysis.position.entryPrice,
          entryDate: analysis.position.entryDate
        },
        currentValue: `$${analysis.currentValue.toFixed(2)}`,
        costBasis: `$${analysis.costBasis.toFixed(2)}`,
        pnl: `$${analysis.pnl.toFixed(2)}`,
        pnlPct: `${analysis.pnlPct.toFixed(2)}%`,
        daysHeld: analysis.daysHeld,
        daysToExpiry: analysis.daysToExpiry,
        breakeven: analysis.breakeven,
        maxGain: typeof analysis.maxGain === 'number'
          ? `$${analysis.maxGain.toFixed(2)}`
          : analysis.maxGain,
        maxLoss: typeof analysis.maxLoss === 'number'
          ? `$${analysis.maxLoss.toFixed(2)}`
          : analysis.maxLoss,
        riskRewardRatio: analysis.riskRewardRatio?.toFixed(2),
        greeks: analysis.greeks
      };
    }

    // Portfolio analysis
    if (positions && positions.length > 0) {
      const analysis = await analyzePortfolio(positions);

      return {
        positionCount: analysis.positions.length,
        portfolio: {
          totalValue: `$${analysis.portfolio.totalValue.toFixed(2)}`,
          totalCostBasis: `$${analysis.portfolio.totalCostBasis.toFixed(2)}`,
          totalPnl: `$${analysis.portfolio.totalPnl.toFixed(2)}`,
          totalPnlPct: `${analysis.portfolio.totalPnlPct.toFixed(2)}%`,
          portfolioGreeks: {
            delta: analysis.portfolio.portfolioGreeks.delta,
            gamma: analysis.portfolio.portfolioGreeks.gamma,
            theta: analysis.portfolio.portfolioGreeks.theta,
            vega: analysis.portfolio.portfolioGreeks.vega
          },
          risk: {
            maxLoss: typeof analysis.portfolio.risk.maxLoss === 'number'
              ? `$${analysis.portfolio.risk.maxLoss.toFixed(2)}`
              : analysis.portfolio.risk.maxLoss,
            maxGain: typeof analysis.portfolio.risk.maxGain === 'number'
              ? `$${analysis.portfolio.risk.maxGain.toFixed(2)}`
              : analysis.portfolio.risk.maxGain
          },
          riskAssessment: {
            level: analysis.portfolio.riskAssessment.overall,
            warnings: analysis.portfolio.riskAssessment.warnings
          }
        },
        positions: analysis.positions.map(p => ({
          symbol: p.position.symbol,
          type: p.position.type,
          pnl: `$${p.pnl.toFixed(2)}`,
          pnlPct: `${p.pnlPct.toFixed(2)}%`
        }))
      };
    }

    return {
      error: 'No position or positions provided'
    };
  } catch (error: any) {
    return {
      error: 'Failed to analyze position',
      message: error.message
    };
  }
}

/**
 * Handler: get_position_advice
 * Generates proactive management advice for open positions
 */
async function handleGetPositionAdvice(
  args: { position_id?: string; positionId?: string },
  userId?: string,
) {
  if (!userId) {
    return { error: 'User not authenticated' };
  }

  try {
    const positionId = typeof args.position_id === 'string'
      ? args.position_id
      : typeof args.positionId === 'string'
        ? args.positionId
        : undefined;

    const positions = positionId
      ? await (async () => {
          const one = await getPositionById(positionId, userId);
          return one ? [one] : [];
        })()
      : await getUserPositions(userId);

    if (positions.length === 0) {
      return {
        adviceCount: 0,
        advice: [],
        message: positionId
          ? 'No open position found for the provided position_id.'
          : 'No open positions available for advice.',
      };
    }

    const analyses = await Promise.all(positions.map((position) => analyzePosition(position)));
    const advisor = new ExitAdvisor();
    const advice = advisor.generateAdvice(analyses);

    return {
      adviceCount: advice.length,
      generatedAt: new Date().toISOString(),
      advice,
    };
  } catch (error: any) {
    return {
      error: 'Failed to generate position advice',
      message: error.message,
    };
  }
}

/**
 * Handler: get_journal_insights
 * Returns pattern-analysis insights for journal performance
 */
async function handleGetJournalInsights(
  args: { period?: '7d' | '30d' | '90d' },
  userId?: string,
) {
  if (!userId) {
    return { error: 'User not authenticated' };
  }

  try {
    const period = args.period || '30d';
    const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const periodStart = new Date(Date.now() - (periodDays * 24 * 60 * 60 * 1000)).toISOString();

    const { data, error } = await supabase
      .from('journal_entries')
      .select('trade_date,pnl,is_winner,followed_plan,discipline_score')
      .eq('user_id', userId)
      .gte('trade_date', periodStart);

    if (error) {
      throw new Error(error.message);
    }

    const trades = (data ?? []).filter((row) => typeof row.trade_date === 'string');
    const closedTrades = trades.filter((row) => toFiniteNumber(row.pnl) !== null);
    const wins = closedTrades.filter((row) => {
      if (row.is_winner === true) return true;
      const pnl = toFiniteNumber(row.pnl);
      return pnl !== null && pnl > 0;
    });
    const losses = closedTrades.filter((row) => {
      if (row.is_winner === false) return true;
      const pnl = toFiniteNumber(row.pnl);
      return pnl !== null && pnl < 0;
    });

    const totalPnl = closedTrades.reduce((sum, row) => sum + (toFiniteNumber(row.pnl) ?? 0), 0);
    const avgPnl = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;

    const hourly = new Map<number, { pnl: number; count: number }>();
    for (const row of closedTrades) {
      const date = new Date(String(row.trade_date));
      if (Number.isNaN(date.getTime())) continue;
      const hour = date.getHours();
      const pnl = toFiniteNumber(row.pnl) ?? 0;
      const bucket = hourly.get(hour) ?? { pnl: 0, count: 0 };
      bucket.pnl += pnl;
      bucket.count += 1;
      hourly.set(hour, bucket);
    }

    const bestHour = [...hourly.entries()]
      .map(([hour, bucket]) => ({
        hour,
        avgPnl: bucket.count > 0 ? bucket.pnl / bucket.count : 0,
        trades: bucket.count,
      }))
      .sort((a, b) => b.avgPnl - a.avgPnl)[0] ?? null;

    const followedPlanKnown = trades.filter((row) => typeof row.followed_plan === 'boolean');
    const followedPlanRate = followedPlanKnown.length > 0
      ? (followedPlanKnown.filter((row) => row.followed_plan === true).length / followedPlanKnown.length) * 100
      : null;

    const disciplineValues = trades
      .map((row) => toFiniteNumber(row.discipline_score))
      .filter((value): value is number => value !== null);
    const avgDiscipline = disciplineValues.length > 0
      ? disciplineValues.reduce((sum, value) => sum + value, 0) / disciplineValues.length
      : null;

    const summary = closedTrades.length === 0
      ? 'No closed trades found in the selected period.'
      : `Closed trades: ${closedTrades.length}. Win rate: ${winRate.toFixed(1)}%. Avg P&L: $${avgPnl.toFixed(2)}.`;

    return {
      period,
      cached: false,
      tradeCount: closedTrades.length,
      summary,
      timeOfDay: {
        bestHour: bestHour ? `${String(bestHour.hour).padStart(2, '0')}:00` : null,
        avgPnl: bestHour ? Number(bestHour.avgPnl.toFixed(2)) : null,
        trades: bestHour?.trades ?? 0,
      },
      setupAnalysis: {
        summary: 'Setup-level pattern analysis is disabled in Journal V2.',
      },
      behavioral: {
        followedPlanRate: followedPlanRate != null ? Number(followedPlanRate.toFixed(1)) : null,
        avgDiscipline: avgDiscipline != null ? Number(avgDiscipline.toFixed(2)) : null,
      },
      riskManagement: {
        summary: losses.length > 0
          ? `Loss count: ${losses.length}. Review stop placement consistency and position sizing on losing trades.`
          : 'No losing trades in this period. Maintain risk discipline.',
      },
    };
  } catch (error: any) {
    return {
      error: 'Failed to fetch journal insights',
      message: error.message,
    };
  }
}

/**
 * Handler: get_trade_history_for_symbol
 * Queries the user's journal entries for recent trades and performance stats
 */
async function handleGetTradeHistory(
  args: { symbol?: string; limit?: number },
  userId?: string
) {
  if (!userId) {
    return { error: 'User not authenticated' };
  }

  const normalizedSymbol = typeof args.symbol === 'string'
    ? args.symbol.trim().toUpperCase()
    : '';
  const symbol = normalizedSymbol && /^[A-Z0-9._:-]{1,16}$/.test(normalizedSymbol)
    ? normalizedSymbol
    : undefined;
  const safeLimit = Number.isFinite(args.limit)
    ? Math.min(100, Math.max(1, Math.round(Number(args.limit))))
    : 10;

  try {
    let query = supabase
      .from('journal_entries')
      .select('symbol, direction, contract_type, strategy, trade_date, entry_price, exit_price, position_size, pnl, pnl_percentage, is_open, is_winner')
      .eq('user_id', userId);

    if (symbol) {
      query = query.eq('symbol', symbol);
    }

    const { data: trades, error } = await query
      .order('trade_date', { ascending: false })
      .limit(safeLimit);

    if (error) throw new Error(error.message);

    const allTrades = trades || [];
    const closedTrades = allTrades.filter((trade) => {
      const isOpen = Boolean(trade.is_open);
      return !isOpen;
    });
    const wins = closedTrades.filter((trade) => {
      if (trade.is_winner === true) return true;
      const pnl = toFiniteNumber(trade.pnl);
      return pnl !== null && pnl > 0;
    });
    const losses = closedTrades.filter((trade) => {
      if (trade.is_winner === false) return true;
      const pnl = toFiniteNumber(trade.pnl);
      return pnl !== null && pnl < 0;
    });
    const totalPnl = closedTrades.reduce((sum, trade) => {
      const pnl = toFiniteNumber(trade.pnl);
      return sum + (pnl || 0);
    }, 0);

    return {
      symbol,
      trades: allTrades.map((trade) => {
        const pnl = toFiniteNumber(trade.pnl);
        const pnlPct = toFiniteNumber(trade.pnl_percentage);
        const outcome = trade.is_open
          ? 'open'
          : trade.is_winner === true
            ? 'win'
            : trade.is_winner === false
              ? 'loss'
              : pnl !== null && pnl > 0
                ? 'win'
                : pnl !== null && pnl < 0
                  ? 'loss'
                  : 'closed';

        return {
          symbol: trade.symbol,
          direction: trade.direction,
          type: trade.contract_type || 'stock',
          strategy: trade.strategy,
          tradeDate: trade.trade_date,
          entryPrice: toFiniteNumber(trade.entry_price),
          exitPrice: toFiniteNumber(trade.exit_price),
          quantity: toFiniteNumber(trade.position_size),
          pnl: pnl != null ? `$${pnl.toFixed(2)}` : trade.is_open ? 'Open' : '—',
          pnlPct: pnlPct != null ? `${pnlPct.toFixed(1)}%` : null,
          outcome,
        };
      }),
      summary: {
        totalTrades: allTrades.length,
        closedTrades: closedTrades.length,
        openTrades: allTrades.length - closedTrades.length,
        wins: wins.length,
        losses: losses.length,
        winRate: closedTrades.length > 0
          ? `${((wins.length / closedTrades.length) * 100).toFixed(1)}%`
          : 'N/A',
        totalPnl: `$${totalPnl.toFixed(2)}`,
      },
    };
  } catch (error: any) {
    return {
      error: 'Failed to fetch trade history',
      message: error.message,
    };
  }
}

/**
 * Handler: set_alert
 * Creates a price alert for a symbol
 */
async function handleSetAlert(
  args: { symbol: string; alert_type: string; target_value: number; notes?: string },
  userId?: string
) {
  if (!userId) {
    return { error: 'User not authenticated' };
  }

  const { symbol, alert_type, target_value, notes } = args;

  try {
    const { data, error } = await supabase
      .from('ai_coach_alerts')
      .insert({
        user_id: userId,
        symbol: symbol.toUpperCase(),
        alert_type,
        target_value,
        notification_channels: ['in-app'],
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const typeLabels: Record<string, string> = {
      price_above: 'Price Above',
      price_below: 'Price Below',
      level_approach: 'Level Approach',
      level_break: 'Level Break',
      volume_spike: 'Volume Spike',
    };

    return {
      success: true,
      alert: {
        id: data.id,
        symbol: data.symbol,
        type: typeLabels[data.alert_type] || data.alert_type,
        targetValue: data.target_value,
        status: data.status,
        createdAt: data.created_at,
      },
      message: `Alert set: ${typeLabels[alert_type] || alert_type} ${target_value} for ${symbol}`,
    };
  } catch (error: any) {
    return {
      error: 'Failed to create alert',
      message: error.message,
    };
  }
}

/**
 * Handler: get_alerts
 * Gets the user's alerts with optional filtering
 */
async function handleGetAlerts(
  args: { status?: string; symbol?: string },
  userId?: string
) {
  if (!userId) {
    return { error: 'User not authenticated' };
  }

  const { status = 'active', symbol } = args;

  try {
    let query = supabase
      .from('ai_coach_alerts')
      .select('*')
      .eq('user_id', userId);

    if (status) query = query.eq('status', status);
    if (symbol) query = query.eq('symbol', symbol.toUpperCase());

    const { data: alerts, error } = await query
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const typeLabels: Record<string, string> = {
      price_above: 'Price Above',
      price_below: 'Price Below',
      level_approach: 'Level Approach',
      level_break: 'Level Break',
      volume_spike: 'Volume Spike',
    };

    return {
      alerts: (alerts || []).map(a => ({
        id: a.id,
        symbol: a.symbol,
        type: typeLabels[a.alert_type] || a.alert_type,
        targetValue: a.target_value,
        status: a.status,
        conditionMet: a.condition_met,
        triggeredAt: a.triggered_at,
        notes: a.notes,
        createdAt: a.created_at,
      })),
      count: (alerts || []).length,
    };
  } catch (error: any) {
    return {
      error: 'Failed to fetch alerts',
      message: error.message,
    };
  }
}

function normalizeScannerSymbols(symbols?: string[]): string[] {
  if (!Array.isArray(symbols)) return [];
  return sanitizeSymbols(symbols, 20);
}

async function getDefaultScannerSymbols(userId?: string): Promise<string[]> {
  if (!userId) return [...POPULAR_SYMBOLS];

  const { data } = await supabase
    .from('ai_coach_watchlists')
    .select('symbols, is_default, updated_at')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  const watchlists = data || [];
  if (watchlists.length === 0) return [...POPULAR_SYMBOLS];

  const defaultWatchlist = watchlists.find((watchlist) => watchlist.is_default) || watchlists[0];
  const symbols = Array.isArray(defaultWatchlist.symbols)
    ? normalizeScannerSymbols(defaultWatchlist.symbols)
    : [];

  return symbols.length > 0 ? symbols : [...POPULAR_SYMBOLS];
}

/**
 * Handler: scan_opportunities
 * Scans for trading opportunities across symbols
 */
async function handleScanOpportunities(args: {
  symbols?: string[];
  include_options?: boolean;
}, userId?: string) {
  const { symbols: inputSymbols, include_options = true } = args;

  try {
    const normalizedSymbols = normalizeScannerSymbols(inputSymbols);
    const scanSymbols = normalizedSymbols.length > 0
      ? normalizedSymbols
      : await getDefaultScannerSymbols(userId);

    const result = await withTimeout(
      () => scanOpportunities(scanSymbols, include_options),
      15000, // Scanner needs more time
      'scan_opportunities'
    );

    return {
      opportunities: result.opportunities.map(opp => ({
        type: opp.type,
        setupType: opp.setupType.replace(/_/g, ' '),
        symbol: opp.symbol,
        direction: opp.direction,
        score: opp.score,
        currentPrice: opp.currentPrice,
        description: opp.description,
        suggestedTrade: opp.suggestedTrade,
        metadata: opp.metadata,
      })),
      count: result.opportunities.length,
      symbols: result.symbols,
      scanDurationMs: result.scanDurationMs,
      message: result.opportunities.length > 0
        ? `Found ${result.opportunities.length} opportunity${result.opportunities.length > 1 ? 'ies' : 'y'} across ${scanSymbols.join(', ')}`
        : `No opportunities found across ${scanSymbols.join(', ')} at this time`,
    };
  } catch (error: any) {
    return {
      error: 'Failed to scan opportunities',
      message: error.message,
    };
  }
}

/**
 * Handler: show_chart
 * Returns chart configuration for the frontend to render.
 * Also fetches current levels so they can be annotated on the chart.
 */
async function handleShowChart(args: { symbol: string; timeframe?: string }) {
  const { symbol, timeframe = '1D' } = args;
  const validSymbol = toValidSymbol(symbol);

  if (!validSymbol) {
    return invalidSymbolError();
  }

  try {
    // Fetch levels to include as annotations
    const levels = await calculateLevels(validSymbol, 'intraday');
    let fibonacciLevels: Array<{ name: string; price: number; isMajor?: boolean }> = [];

    try {
      const dailyBars = await fetchDailyData(validSymbol, 40);
      if (dailyBars.length >= 2) {
        const fib = calculateFibonacciRetracement(validSymbol, dailyBars, 'daily', 20);
        fibonacciLevels = [
          { name: '0%', price: fib.levels.level_0 },
          { name: '23.6%', price: fib.levels.level_236 },
          { name: '38.2%', price: fib.levels.level_382, isMajor: true },
          { name: '50%', price: fib.levels.level_500 },
          { name: '61.8%', price: fib.levels.level_618, isMajor: true },
          { name: '78.6%', price: fib.levels.level_786 },
          { name: '100%', price: fib.levels.level_100 },
        ];
      }
    } catch (_fibError) {
      fibonacciLevels = [];
    }

    const normalizedResistance = levels.levels.resistance.slice(0, 5).map((level) => ({
      ...level,
      name: level.type,
    }));
    const normalizedSupport = levels.levels.support.slice(0, 5).map((level) => ({
      ...level,
      name: level.type,
    }));

    return {
      action: 'show_chart',
      symbol: validSymbol,
      timeframe,
      currentPrice: levels.currentPrice,
      levels: {
        resistance: normalizedResistance,
        support: normalizedSupport,
        fibonacci: fibonacciLevels,
        indicators: levels.levels.indicators,
      },
      message: `Displaying ${validSymbol} chart (${timeframe}) with key levels in the center panel.`
    };
  } catch (error: any) {
    return {
      action: 'show_chart',
      symbol: validSymbol,
      timeframe,
      error: 'Could not fetch levels for chart annotations',
      message: `Displaying ${validSymbol} chart (${timeframe}) in the center panel.`
    };
  }
}

/**
 * Handler: get_long_term_trend
 * Analyzes weekly/monthly trend with EMAs and support/resistance
 */
async function handleGetLongTermTrend(args: {
  symbol: string;
  timeframe?: 'weekly' | 'monthly';
}) {
  const { symbol, timeframe = 'weekly' } = args;

  try {
    const trend = await analyzeLongTermTrend(symbol, timeframe);
    return trend;
  } catch (error: any) {
    return {
      error: 'Failed to analyze long-term trend',
      message: error.message,
    };
  }
}

/**
 * Handler: analyze_leaps_position
 * Comprehensive LEAPS analysis with Greeks projection + macro context
 */
async function handleAnalyzeLeapsPosition(args: {
  symbol: string;
  option_type: 'call' | 'put';
  strike: number;
  entry_price: number;
  entry_date: string;
  expiry_date: string;
  quantity?: number;
  current_iv?: number;
}) {
  const {
    symbol, option_type, strike, entry_price,
    entry_date, expiry_date, quantity = 1, current_iv = 0.25,
  } = args;

  try {
    const dte = calcDaysToExpiry(expiry_date);
    const daysHeld = Math.ceil(
      (Date.now() - new Date(entry_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get current price via intraday data, falling back to daily
    let currentPrice = strike; // last resort fallback
    try {
      const intradayData = await fetchIntradayData(symbol);
      if (intradayData.length > 0) {
        currentPrice = intradayData[intradayData.length - 1].c;
      } else {
        // Fallback to daily data (covers weekends + holidays)
        const dailyData = await fetchDailyData(symbol, 7);
        if (dailyData.length > 0) {
          currentPrice = dailyData[dailyData.length - 1].c;
        }
      }
    } catch {
      // Use strike as last resort fallback
    }

    // Greeks projection
    const projection = generateGreeksProjection(
      symbol, option_type, strike, currentPrice, dte, current_iv
    );

    // Current vs entry comparison
    const currentSnapshot = projection.projections[0];
    const greeksTrend = assessGreeksTrend(
      currentSnapshot?.delta || 0,
      0.5, // approximate entry delta
      currentSnapshot?.theta || 0,
      dte
    );

    // P&L estimate
    const currentValue = currentSnapshot?.projectedValue || 0;
    const pnl = (currentValue - entry_price) * quantity * 100;
    const pnlPct = entry_price > 0 ? ((currentValue - entry_price) / entry_price * 100) : 0;

    // Macro context
    const macroImpact = assessMacroImpact(symbol);

    // Roll recommendation
    let rollRecommendation: 'yes' | 'no' | 'optional' = 'no';
    if (dte < 60) rollRecommendation = 'yes';
    else if (dte < 120 && pnlPct > 30) rollRecommendation = 'optional';

    // Suggestions
    const suggestions: string[] = [];
    if (dte < 90) suggestions.push('Consider rolling to extend duration - theta acceleration is approaching');
    if (pnlPct > 50) suggestions.push('Position has significant gains - consider taking partial profits');
    if (pnlPct < -30) suggestions.push('Position is significantly underwater - reassess thesis');
    if (greeksTrend === 'improving') suggestions.push('Greeks trend is favorable - position becoming more efficient');
    if (rollRecommendation === 'optional') suggestions.push('Rolling to lock in gains is an option worth evaluating');
    if (suggestions.length === 0) suggestions.push('Position is healthy - no immediate action needed');

    return {
      symbol,
      optionType: option_type,
      strike,
      entryPrice: entry_price,
      currentValue: Number(currentValue.toFixed(2)),
      pnl: `$${pnl.toFixed(2)}`,
      pnlPct: `${pnlPct.toFixed(1)}%`,
      daysHeld,
      daysToExpiry: dte,
      currentUnderlying: currentPrice,
      greeks: currentSnapshot ? {
        delta: currentSnapshot.delta,
        gamma: currentSnapshot.gamma,
        theta: currentSnapshot.theta,
        vega: currentSnapshot.vega,
      } : null,
      greeksTrend,
      greeksProjection: projection.projections.slice(0, 6), // First 6 timepoints
      rollRecommendation,
      macroOutlook: macroImpact.overallOutlook,
      macroHighlights: {
        bullish: macroImpact.bullishFactors.slice(0, 3),
        bearish: macroImpact.bearishFactors.slice(0, 3),
        catalysts: macroImpact.upcomingCatalysts.slice(0, 3),
      },
      suggestions,
      timelineRisk: dte > 180 ? 'low' : dte > 90 ? 'medium' : 'high',
    };
  } catch (error: any) {
    return {
      error: 'Failed to analyze LEAPS position',
      message: error.message,
    };
  }
}

/**
 * Handler: analyze_swing_trade
 * Multi-day swing trade analysis with targets and management
 */
async function handleAnalyzeSwingTrade(args: {
  symbol: string;
  position_type?: string;
  entry_price: number;
  current_price: number;
  entry_date: string;
  direction: 'long' | 'short';
}) {
  const { symbol, entry_price, current_price, entry_date, direction } = args;

  try {
    const daysHeld = Math.ceil(
      (Date.now() - new Date(entry_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    const pnlPct = direction === 'long'
      ? ((current_price - entry_price) / entry_price) * 100
      : ((entry_price - current_price) / entry_price) * 100;

    // Get levels for targets
    let technicalSetup = 'Unable to fetch technical data';
    let nextTargets: number[] = [];
    let stopLevel = 0;

    try {
      const levels = await calculateLevels(symbol, 'intraday');
      const resistance = levels.levels.resistance.map(r => r.price);
      const support = levels.levels.support.map(s => s.price);

      if (direction === 'long') {
        nextTargets = resistance.filter(r => r > current_price).slice(0, 3);
        stopLevel = support.find(s => s < current_price) || entry_price * 0.98;
      } else {
        nextTargets = support.filter(s => s < current_price).slice(0, 3);
        stopLevel = resistance.find(r => r > current_price) || entry_price * 1.02;
      }

      const vwap = levels.levels.indicators?.vwap;
      const priceVsVwap = vwap ? (current_price > vwap ? 'above VWAP' : 'below VWAP') : '';
      technicalSetup = `Price at $${current_price.toFixed(2)}, ${priceVsVwap}. ${direction === 'long' ? 'Next resistance' : 'Next support'}: ${nextTargets.map(t => `$${t.toFixed(0)}`).join(', ') || 'none identified'}`;
    } catch {
      // Continue without levels
    }

    // Risk/reward
    const riskPerShare = Math.abs(current_price - stopLevel);
    const rewardPerShare = nextTargets.length > 0 ? Math.abs(nextTargets[0] - current_price) : riskPerShare;
    const riskRewardRatio = riskPerShare > 0 ? Number((rewardPerShare / riskPerShare).toFixed(2)) : 0;

    // Time horizon
    let timeHorizon: string;
    if (daysHeld <= 3) timeHorizon = '1-3 days';
    else if (daysHeld <= 7) timeHorizon = '3-7 days';
    else timeHorizon = '1-2 weeks';

    // Management suggestions
    const suggestions: string[] = [];
    if (pnlPct > 8) {
      suggestions.push(`Position is up ${pnlPct.toFixed(1)}% - consider taking partial profits`);
    }
    if (pnlPct > 15) {
      suggestions.push('Strong gains achieved - trail stop to lock in profits');
    }
    if (pnlPct < -5) {
      suggestions.push('Position moving against you - review thesis and stop level');
    }
    if (daysHeld > 10) {
      suggestions.push('Extended hold period - evaluate if the setup is still valid');
    }
    if (riskRewardRatio < 1) {
      suggestions.push('Risk/reward ratio is unfavorable - consider tightening stop or taking profits');
    }
    if (suggestions.length === 0) {
      suggestions.push('Position is within normal parameters - continue monitoring');
    }

    return {
      symbol,
      direction,
      entryPrice: entry_price,
      currentPrice: current_price,
      pnlPct: `${pnlPct.toFixed(1)}%`,
      daysHeld,
      technicalSetup,
      nextTargets,
      stopLevelRecommendation: Number(stopLevel.toFixed(2)),
      riskRewardRatio,
      timeHorizon,
      suggestions,
    };
  } catch (error: any) {
    return {
      error: 'Failed to analyze swing trade',
      message: error.message,
    };
  }
}

/**
 * Handler: calculate_roll_decision
 * Calculates roll cost/benefit for LEAPS
 */
async function handleCalculateRollDecision(args: {
  symbol: string;
  option_type: 'call' | 'put';
  current_strike: number;
  current_expiry: string;
  new_strike: number;
  new_expiry?: string;
  current_price: number;
  implied_volatility?: number;
  quantity?: number;
}) {
  const {
    current_strike, current_expiry, new_strike,
    new_expiry, option_type, current_price,
    implied_volatility = 0.25, quantity = 1,
  } = args;

  try {
    const result = calculateRoll({
      currentStrike: current_strike,
      currentExpiry: current_expiry,
      newStrike: new_strike,
      newExpiry: new_expiry,
      optionType: option_type,
      currentPrice: current_price,
      impliedVolatility: implied_volatility,
      quantity,
    });

    return {
      current: {
        strike: result.current.strike,
        expiry: result.current.expiry,
        daysToExpiry: result.current.daysToExpiry,
        value: `$${result.current.value.toFixed(2)}`,
        greeks: result.current.greeks,
      },
      new: {
        strike: result.new.strike,
        expiry: result.new.expiry,
        daysToExpiry: result.new.daysToExpiry,
        value: `$${result.new.value.toFixed(2)}`,
        greeks: result.new.greeks,
      },
      analysis: {
        netCreditDebit: result.rollAnalysis.netCreditDebit > 0
          ? `+$${result.rollAnalysis.netCreditDebit.toFixed(2)} credit`
          : `-$${Math.abs(result.rollAnalysis.netCreditDebit).toFixed(2)} debit`,
        newBreakEven: `$${result.rollAnalysis.newBreakEven.toFixed(2)}`,
        recommendation: result.rollAnalysis.recommendation,
        pros: result.rollAnalysis.pros,
        cons: result.rollAnalysis.cons,
      },
    };
  } catch (error: any) {
    return {
      error: 'Failed to calculate roll',
      message: error.message,
    };
  }
}

/**
 * Handler: get_macro_context
 * Returns macro-economic context with optional symbol-specific impact
 */
async function handleGetMacroContext(args: { symbol?: string }) {
  const { symbol } = args;

  try {
    const macro = getMacroContext();

    const result: any = {
      economicCalendar: macro.economicCalendar.slice(0, 5),
      fedPolicy: {
        currentRate: macro.fedPolicy.currentRate,
        nextMeeting: macro.fedPolicy.nextMeetingDate,
        rateOutlook: macro.fedPolicy.expectedOutcome,
        tone: macro.fedPolicy.currentTone,
        probabilities: macro.fedPolicy.marketImpliedProbabilities,
      },
      earningsSeason: {
        phase: macro.earningsSeason.currentPhase,
        beatRate: `${(macro.earningsSeason.beatRate * 100).toFixed(0)}%`,
        implication: macro.earningsSeason.implication,
      },
      sectorRotation: {
        moneyFlow: macro.sectorRotation.moneyFlowDirection,
        sectors: macro.sectorRotation.sectors
          .filter(s => s.relativeStrength !== 'neutral')
          .map(s => ({
            name: s.name,
            strength: s.relativeStrength,
            trend: s.trend,
          })),
      },
    };

    // Add symbol-specific impact if requested
    if (symbol) {
      const impact = assessMacroImpact(symbol);
      result.symbolImpact = {
        symbol,
        outlook: impact.overallOutlook,
        bullishFactors: impact.bullishFactors,
        bearishFactors: impact.bearishFactors,
        riskFactors: impact.riskFactors,
        advice: impact.adviceForLEAPS,
        catalysts: impact.upcomingCatalysts.slice(0, 3),
      };
    }

    return withFreshness(result, {
      asOf: new Date().toISOString(),
      source: 'macro_context',
      delayed: false,
      staleAfterSeconds: 6 * 60 * 60,
    });
  } catch (error: any) {
    return {
      error: 'Failed to fetch macro context',
      message: error.message,
    };
  }
}
