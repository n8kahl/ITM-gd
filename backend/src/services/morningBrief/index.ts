import { supabase } from '../../config/database';
import { getMarketStatus } from '../marketHours';
import { calculateLevels, type LevelsResponse } from '../levels';
import { getMacroContext } from '../macro/macroContext';
import { getEarningsCalendar } from '../earnings';
import { logger } from '../../lib/logger';

const DEFAULT_WATCHLIST_SYMBOLS = ['SPX', 'NDX', 'SPY', 'QQQ'];
const MORNING_BRIEF_LEVEL_TIMEOUT_MS = 8000;
const MORNING_BRIEF_EARNINGS_TIMEOUT_MS = 6000;

export interface MorningBriefKeyLevels {
  symbol: string;
  pdh: number | null;
  pdl: number | null;
  pdc: number | null;
  pmh: number | null;
  pml: number | null;
  pivot: number | null;
  r1: number | null;
  r2: number | null;
  s1: number | null;
  s2: number | null;
  vwapYesterday: number | null;
  atr14: number | null;
  expectedMoveToday: number | null;
  currentPrice: number | null;
}

export interface MorningBrief {
  generatedAt: string;
  marketDate: string;
  marketStatus: ReturnType<typeof getMarketStatus>;
  watchlist: string[];
  overnightSummary: {
    futuresDirection: 'up' | 'down' | 'flat';
    futuresChange: number;
    futuresChangePct: number;
    gapAnalysis: Array<{
      symbol: string;
      gapSize: number;
      gapPct: number;
      gapType: 'up' | 'down' | 'flat';
      atrRatio: number | null;
      historicalFillRate: number | null;
    }>;
  };
  spxSpyCorrelation: {
    spxPrice: number;
    spyPrice: number;
    ratio: number;
    spxExpectedMove: number | null;
    spyExpectedMove: number | null;
  } | null;
  keyLevelsToday: MorningBriefKeyLevels[];
  economicEvents: Array<{
    time: string;
    event: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    expected: string;
    previous: string;
    tradingImplication: string;
  }>;
  earningsToday: Array<{
    symbol: string;
    time: 'BMO' | 'AMC' | 'DURING';
    expectedMove: number | null;
    ivRank: number | null;
    consensus: string;
    relevance: string;
  }>;
  openPositionStatus: Array<{
    symbol: string;
    type: string;
    strike: number | null;
    expiry: string | null;
    currentPnl: number | null;
    currentPnlPct: number | null;
    overnightChange: number | null;
    daysToExpiry: number | null;
    recommendation: string;
  }>;
  watchItems: string[];
  aiSummary: string;
}

function getEasternMarketDate(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

function normalizeSymbols(input?: string[]): string[] {
  if (!Array.isArray(input)) return [];

  const normalized = input
    .map((symbol) => (typeof symbol === 'string' ? symbol.trim().toUpperCase() : ''))
    .filter((symbol) => /^[A-Z0-9._:-]{1,10}$/.test(symbol));

  return Array.from(new Set(normalized)).slice(0, 20);
}

function findLevel(levels: LevelsResponse, type: string): number | null {
  const upperType = type.toUpperCase();
  const inResistance = levels.levels.resistance.find((level) => level.type.toUpperCase() === upperType);
  if (inResistance) return inResistance.price;

  const inSupport = levels.levels.support.find((level) => level.type.toUpperCase() === upperType);
  if (inSupport) return inSupport.price;

  return null;
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function daysUntil(dateValue: string | null): number | null {
  if (!dateValue) return null;
  const now = new Date();
  const then = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.ceil((then.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(2));
}

function buildPositionRecommendation(pnlPct: number | null, daysToExpiry: number | null): string {
  if (pnlPct !== null && pnlPct <= -20) {
    return 'At risk: consider reducing exposure or enforcing stop discipline.';
  }
  if (pnlPct !== null && pnlPct >= 30) {
    return 'In profit: evaluate partial profit-taking or trailing protection.';
  }
  if (daysToExpiry !== null && daysToExpiry <= 7) {
    return 'Near expiry: review assignment/gamma risk and exit criteria.';
  }
  return 'Monitor with plan discipline and predefined invalidation.';
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export class MorningBriefService {
  async getDefaultWatchlist(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('ai_coach_watchlists')
      .select('symbols, is_default, created_at')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      logger.warn('Morning brief: failed to load watchlist, using defaults', { error: error.message, userId });
      return DEFAULT_WATCHLIST_SYMBOLS;
    }

    const watchlists = data || [];
    if (watchlists.length === 0) return DEFAULT_WATCHLIST_SYMBOLS;

    const defaultWatchlist = watchlists.find((watchlist) => watchlist.is_default) || watchlists[0];
    const symbols = normalizeSymbols(defaultWatchlist.symbols);
    return symbols.length > 0 ? symbols : DEFAULT_WATCHLIST_SYMBOLS;
  }

  async getOpenPositions(userId: string): Promise<MorningBrief['openPositionStatus']> {
    const { data, error } = await supabase
      .from('ai_coach_positions')
      .select('symbol, position_type, strike, expiry, pnl, pnl_pct')
      .eq('user_id', userId)
      .eq('status', 'open')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) {
      logger.warn('Morning brief: failed to load open positions', { error: error.message, userId });
      return [];
    }

    return (data || []).map((position: any) => {
      const currentPnl = parseNullableNumber(position.pnl);
      const currentPnlPct = parseNullableNumber(position.pnl_pct);
      const expiry = toIsoDate(position.expiry);
      const dte = daysUntil(expiry);

      return {
        symbol: String(position.symbol || '').toUpperCase(),
        type: String(position.position_type || ''),
        strike: parseNullableNumber(position.strike),
        expiry,
        currentPnl,
        currentPnlPct,
        overnightChange: null,
        daysToExpiry: dte,
        recommendation: buildPositionRecommendation(currentPnlPct, dte),
      };
    });
  }

  private async getKeyLevelsForWatchlist(watchlist: string[]): Promise<MorningBriefKeyLevels[]> {
    const results = await Promise.allSettled(
      watchlist.map(async (symbol) => withTimeout(calculateLevels(symbol, 'intraday'), MORNING_BRIEF_LEVEL_TIMEOUT_MS, `levels:${symbol}`))
    );

    const keyLevels: MorningBriefKeyLevels[] = [];
    for (const result of results) {
      if (result.status !== 'fulfilled') {
        logger.warn('Morning brief: level generation failed', { error: result.reason instanceof Error ? result.reason.message : String(result.reason) });
        continue;
      }

      const levels = result.value;
      const atr14 = levels.levels.indicators.atr14 ?? null;

      keyLevels.push({
        symbol: levels.symbol,
        pdh: findLevel(levels, 'PDH'),
        pdl: findLevel(levels, 'PDL'),
        pdc: findLevel(levels, 'PDC'),
        pmh: findLevel(levels, 'PMH'),
        pml: findLevel(levels, 'PML'),
        pivot: levels.levels.pivots.standard?.pp ?? null,
        r1: levels.levels.pivots.standard?.r1 ?? null,
        r2: levels.levels.pivots.standard?.r2 ?? null,
        s1: levels.levels.pivots.standard?.s1 ?? null,
        s2: levels.levels.pivots.standard?.s2 ?? null,
        vwapYesterday: levels.levels.indicators.vwap ?? null,
        atr14,
        expectedMoveToday: atr14,
        currentPrice: levels.currentPrice ?? null,
      });
    }

    return keyLevels;
  }

  private buildOvernightSummary(keyLevels: MorningBriefKeyLevels[]): MorningBrief['overnightSummary'] {
    if (keyLevels.length === 0) {
      return {
        futuresDirection: 'flat',
        futuresChange: 0,
        futuresChangePct: 0,
        gapAnalysis: [],
      };
    }

    const primary = keyLevels[0];
    const pdc = primary.pdc ?? primary.currentPrice ?? 0;
    const current = primary.currentPrice ?? pdc;
    const change = Number((current - pdc).toFixed(2));
    const changePct = pdc > 0 ? Number(((change / pdc) * 100).toFixed(2)) : 0;

    let futuresDirection: 'up' | 'down' | 'flat' = 'flat';
    if (change > 0.25) futuresDirection = 'up';
    if (change < -0.25) futuresDirection = 'down';

    const gapAnalysis = keyLevels.map((item) => {
      const anchor = item.pdc ?? item.currentPrice ?? 0;
      const gapSize = Number(((item.currentPrice ?? anchor) - anchor).toFixed(2));
      const gapPct = anchor > 0 ? Number(((gapSize / anchor) * 100).toFixed(2)) : 0;
      const atrRatio = item.atr14 ? Number((gapSize / item.atr14).toFixed(2)) : null;
      const gapType: 'up' | 'down' | 'flat' = gapSize > 0 ? 'up' : gapSize < 0 ? 'down' : 'flat';

      return {
        symbol: item.symbol,
        gapSize,
        gapPct,
        gapType,
        atrRatio,
        historicalFillRate: null,
      };
    });

    return {
      futuresDirection,
      futuresChange: change,
      futuresChangePct: changePct,
      gapAnalysis,
    };
  }

  private buildWatchItems(
    watchlist: string[],
    keyLevels: MorningBriefKeyLevels[],
    openPositions: MorningBrief['openPositionStatus'],
  ): string[] {
    const items: string[] = [];

    for (const level of keyLevels.slice(0, 3)) {
      const anchor = level.pivot ?? level.pdc;
      if (anchor !== null && level.currentPrice !== null) {
        const distancePct = Math.abs(((level.currentPrice - anchor) / anchor) * 100);
        if (distancePct <= 0.4) {
          items.push(`${level.symbol}: trading within ${distancePct.toFixed(2)}% of pivot/PDC. Watch for rejection or continuation.`);
        }
      }
    }

    const riskPositions = openPositions.filter((position) => (position.currentPnlPct ?? 0) <= -20);
    if (riskPositions.length > 0) {
      items.push(`Open risk: ${riskPositions.map((position) => position.symbol).join(', ')} below -20% P&L. Recheck invalidation levels.`);
    }

    if (items.length === 0) {
      items.push(`Review opening structure for ${watchlist.join(', ')} before entering new risk.`);
    }
    items.push('Run scanner after the opening range forms and only take setups with predefined risk.');

    return items.slice(0, 5);
  }

  async generateBrief(userId: string, watchlistOverride?: string[]): Promise<MorningBrief> {
    const watchlist = normalizeSymbols(watchlistOverride);
    const symbols = watchlist.length > 0 ? watchlist : await this.getDefaultWatchlist(userId);
    const marketStatus = getMarketStatus();
    const keyLevelsToday = await this.getKeyLevelsForWatchlist(symbols);
    const macro = await getMacroContext();
    const openPositionStatus = await this.getOpenPositions(userId);
    const overnightSummary = this.buildOvernightSummary(keyLevelsToday);
    const watchItems = this.buildWatchItems(symbols, keyLevelsToday, openPositionStatus);
    let spxSpyCorrelation: MorningBrief['spxSpyCorrelation'] = null;

    const spxLevels = keyLevelsToday.find((item) => item.symbol === 'SPX');
    const spyLevels = keyLevelsToday.find((item) => item.symbol === 'SPY');
    if (spxLevels?.currentPrice && spyLevels?.currentPrice) {
      const ratio = spxLevels.currentPrice / spyLevels.currentPrice;
      const spxExpectedMove = spxLevels.expectedMoveToday;

      spxSpyCorrelation = {
        spxPrice: Number(spxLevels.currentPrice.toFixed(2)),
        spyPrice: Number(spyLevels.currentPrice.toFixed(2)),
        ratio: Number(ratio.toFixed(2)),
        spxExpectedMove: spxExpectedMove !== null ? Number(spxExpectedMove.toFixed(2)) : null,
        spyExpectedMove: spxExpectedMove !== null ? Number((spxExpectedMove / ratio).toFixed(2)) : null,
      };
    }

    const economicEvents = macro.economicCalendar.slice(0, 8).map((event) => ({
      time: '08:30 ET',
      event: event.event,
      impact: event.impact,
      expected: event.expected || 'N/A',
      previous: event.previous || 'N/A',
      tradingImplication: event.relevance,
    }));

    const fallbackEarnings = macro.earningsSeason.upcomingEvents
      .filter((event) => symbols.includes(event.symbol))
      .map((event) => ({
        symbol: event.symbol,
        time: 'AMC' as const,
        expectedMove: Number((event.expectedMoveIV * 100).toFixed(2)),
        ivRank: null,
        consensus: event.beatEstimate === null ? 'No consensus yet' : event.beatEstimate ? 'Beat expected' : 'Miss risk',
        relevance: `${event.company} earnings can impact index volatility.`,
      }));

    let earningsToday: MorningBrief['earningsToday'] = [];
    try {
      const liveEarnings = await withTimeout(
        getEarningsCalendar(symbols, 30),
        MORNING_BRIEF_EARNINGS_TIMEOUT_MS,
        'earnings_calendar',
      );
      earningsToday = liveEarnings.slice(0, 8).map((event) => ({
        symbol: event.symbol,
        time: event.time,
        expectedMove: null,
        ivRank: null,
        consensus: event.epsEstimate != null
          ? `EPS est ${event.epsEstimate.toFixed(2)}`
          : 'Estimate pending',
        relevance: event.name
          ? `${event.name} earnings event in watch window.`
          : `${event.symbol} earnings event in watch window.`,
      }));
    } catch (error: any) {
      logger.warn('Morning brief earnings calendar unavailable; using fallback context', {
        error: error?.message || String(error),
      });
    }

    if (earningsToday.length === 0) {
      earningsToday = fallbackEarnings;
    }

    const marketLabel = marketStatus.status.replace('-', ' ');
    const aiSummary = `Market is ${marketLabel}. Monitoring ${symbols.join(', ')} with ${keyLevelsToday.length} symbols mapped for levels and ${openPositionStatus.length} open positions requiring risk review.`;

    return {
      generatedAt: new Date().toISOString(),
      marketDate: getEasternMarketDate(),
      marketStatus,
      watchlist: symbols,
      overnightSummary,
      spxSpyCorrelation,
      keyLevelsToday,
      economicEvents,
      earningsToday,
      openPositionStatus,
      watchItems,
      aiSummary,
    };
  }
}

export const morningBriefService = new MorningBriefService();
