import { analyzeIVProfile } from '../options/ivAnalysis';
import { getEarningsCalendar, type EarningsCalendarEvent } from '../earnings';
import { getEconomicCalendar } from '../economic';
import { logger } from '../../lib/logger';
import type { EconomicEvent } from '../macro/macroContext';
import type {
  SwingSniperDirection,
  SwingSniperOpportunity,
  SwingSniperUniverseResponse,
} from './types';
import {
  clamp,
  describeDaysUntilLabel,
  daysUntil,
  getSwingSniperVolBenchmark,
  mapConcurrent,
  round,
} from './utils';

const SWING_SNIPER_SCAN_CONCURRENCY = 3;

export const SWING_SNIPER_CORE_SCAN_SYMBOLS = [
  'SPY',
  'QQQ',
  'IWM',
  'NVDA',
  'AAPL',
  'TSLA',
  'MSFT',
  'AMZN',
  'META',
  'GOOGL',
  'AMD',
  'AVGO',
  'PLTR',
  'NFLX',
  'SMH',
  'XLF',
  'XLE',
  'XBI',
  'COIN',
  'MSTR',
  'JPM',
  'GS',
  'UBER',
  'CRM',
] as const;

function pickNearestMacroEvent(events: EconomicEvent[]): EconomicEvent | null {
  const today = new Date().toISOString().slice(0, 10);
  return events
    .filter((event) => event.date >= today)
    .sort((left, right) => left.date.localeCompare(right.date))[0] ?? null;
}

function countDenseMacroEvents(events: EconomicEvent[]): number {
  return events.filter((event) => {
    const delta = daysUntil(event.date);
    return delta >= 0 && delta <= 10;
  }).length;
}

export function resolveSwingSniperDirection(
  ivVsRvGap: number | null,
  ivRank: number | null,
  earningsDaysUntil: number | null,
): SwingSniperDirection {
  if (
    (ivVsRvGap != null && ivVsRvGap <= -4)
    || ((ivRank ?? 50) <= 38 && earningsDaysUntil != null && earningsDaysUntil <= 14)
  ) {
    return 'long_vol';
  }

  if (
    (ivVsRvGap != null && ivVsRvGap >= 6)
    || ((ivRank ?? 50) >= 68)
  ) {
    return 'short_vol';
  }

  return 'neutral';
}

export function buildSwingSniperSetupLabel(
  direction: SwingSniperDirection,
  earningsDaysUntil: number | null,
  termStructureShape: 'contango' | 'backwardation' | 'flat',
  skewDirection: 'put_heavy' | 'call_heavy' | 'balanced' | 'unknown',
): string {
  if (direction === 'long_vol' && earningsDaysUntil != null && earningsDaysUntil <= 10) {
    return 'Cheap event gamma into catalyst window';
  }
  if (direction === 'short_vol' && termStructureShape === 'contango') {
    return 'Rich front premium above realized tape';
  }
  if (termStructureShape === 'backwardation') {
    return 'Front-month term kink worth watching';
  }
  if (skewDirection === 'put_heavy') {
    return 'Downside hedge bid distorting the surface';
  }
  return 'Balanced surface with tradable catalyst timing';
}

export function buildSwingSniperExpressionPreview(
  direction: SwingSniperDirection,
  skewDirection: SwingSniperOpportunity['skewDirection'],
): string {
  if (direction === 'long_vol') {
    return skewDirection === 'call_heavy' ? 'Call diagonal / call spread compare' : 'Calendar / strangle compare';
  }
  if (direction === 'short_vol') {
    return 'Defined-risk premium sale after event';
  }
  return 'Wait for cleaner vol edge';
}

export function buildSwingSniperThesis(
  direction: SwingSniperDirection,
  catalystLabel: string,
): string {
  if (direction === 'long_vol') {
    return `Current IV sits below the recent realized tape while ${catalystLabel.toLowerCase()} can reprice premium quickly.`;
  }
  if (direction === 'short_vol') {
    return `Premium is already elevated versus realized movement, so the cleaner edge is to wait for post-catalyst decay or defined-risk premium sale.`;
  }
  return `Volatility is not obviously mispriced yet, but the setup is close enough to keep on deck while ${catalystLabel.toLowerCase()} develops.`;
}

function buildReasons(
  currentIV: number | null,
  realizedVol20: number | null,
  ivRank: number | null,
  termStructureShape: SwingSniperOpportunity['termStructureShape'],
  skewDirection: SwingSniperOpportunity['skewDirection'],
  catalystLabel: string,
): string[] {
  const reasons: string[] = [];

  if (currentIV != null && realizedVol20 != null) {
    const gap = round(currentIV - realizedVol20, 1);
    reasons.push(`IV ${currentIV.toFixed(1)}% vs 20D RV ${realizedVol20.toFixed(1)}% (${gap >= 0 ? '+' : ''}${gap} pts).`);
  }

  if (ivRank != null) {
    reasons.push(`IV rank ${ivRank.toFixed(0)} with a ${termStructureShape} term structure.`);
  }

  if (skewDirection !== 'unknown') {
    reasons.push(`Surface skew is ${skewDirection.replace('_', ' ')}.`);
  }

  reasons.push(catalystLabel);
  return reasons.slice(0, 4);
}

export function scoreSwingSniperOpportunity(input: {
  ivVsRvGap: number | null;
  ivRank: number | null;
  termStructureShape: SwingSniperOpportunity['termStructureShape'];
  skewDirection: SwingSniperOpportunity['skewDirection'];
  catalystDensity: number;
  earningsDaysUntil: number | null;
}): number {
  const gapScore = input.ivVsRvGap == null ? 8 : Math.min(24, Math.abs(input.ivVsRvGap) * 2.4);
  const rankScore = input.ivRank == null ? 10 : Math.min(18, Math.abs(input.ivRank - 50) * 0.45);
  const catalystScore = Math.min(18, input.catalystDensity * 4) + (
    input.earningsDaysUntil != null && input.earningsDaysUntil <= 10 ? 8 : 0
  );
  const surfaceScore = (
    (input.termStructureShape === 'backwardation' ? 10 : input.termStructureShape === 'contango' ? 6 : 3)
    + (input.skewDirection === 'balanced' ? 2 : 5)
  );

  return Math.round(clamp(32 + gapScore + rankScore + catalystScore + surfaceScore, 35, 98));
}

function toCatalystLabel(
  earningsEvent: EarningsCalendarEvent | null,
  macroEvent: EconomicEvent | null,
  macroDensity: number,
): { label: string; date: string | null; daysUntil: number | null; density: number } {
  if (earningsEvent?.date) {
    const earningsDays = daysUntil(earningsEvent.date);
    return {
      label: `Earnings ${describeDaysUntilLabel(earningsDays)} with ${macroDensity} macro event${macroDensity === 1 ? '' : 's'} nearby`,
      date: earningsEvent.date,
      daysUntil: earningsDays,
      density: macroDensity + 1,
    };
  }

  if (macroEvent?.date) {
    const macroDays = daysUntil(macroEvent.date);
    return {
      label: `${macroEvent.event} ${describeDaysUntilLabel(macroDays)} with a ${macroDensity}-event macro stack`,
      date: macroEvent.date,
      daysUntil: macroDays,
      density: Math.max(1, macroDensity),
    };
  }

  return {
    label: 'Catalyst tape is light; keep this as a watchlist candidate.',
    date: null,
    daysUntil: null,
    density: 0,
  };
}

async function scanSymbol(
  symbol: string,
  earningsMap: Map<string, EarningsCalendarEvent>,
  macroEvents: EconomicEvent[],
  savedSymbols: Set<string>,
): Promise<SwingSniperOpportunity | null> {
  try {
    const [ivProfile, volBenchmark] = await Promise.all([
      analyzeIVProfile(symbol, {
        strikeRange: 12,
        maxExpirations: 3,
      }),
      getSwingSniperVolBenchmark(symbol),
    ]);

    const earningsEvent = earningsMap.get(symbol) ?? null;
    const earningsDaysUntil = earningsEvent?.date ? daysUntil(earningsEvent.date) : null;
    const macroDensity = countDenseMacroEvents(macroEvents);
    const nearestMacroEvent = pickNearestMacroEvent(macroEvents);
    const catalyst = toCatalystLabel(earningsEvent, nearestMacroEvent, macroDensity);

    const currentIV = ivProfile.ivRank.currentIV;
    const realizedVol20 = volBenchmark.rv20;
    const ivVsRvGap = currentIV != null && realizedVol20 != null
      ? round(currentIV - realizedVol20, 1)
      : null;
    const direction = resolveSwingSniperDirection(ivVsRvGap, ivProfile.ivRank.ivRank, earningsDaysUntil);
    const score = scoreSwingSniperOpportunity({
      ivVsRvGap,
      ivRank: ivProfile.ivRank.ivRank,
      termStructureShape: ivProfile.termStructure.shape,
      skewDirection: ivProfile.skew.skewDirection,
      catalystDensity: catalyst.density,
      earningsDaysUntil,
    });
    const setupLabel = buildSwingSniperSetupLabel(
      direction,
      earningsDaysUntil,
      ivProfile.termStructure.shape,
      ivProfile.skew.skewDirection,
    );

    return {
      symbol,
      score,
      direction,
      setupLabel,
      thesis: buildSwingSniperThesis(direction, catalyst.label),
      currentPrice: ivProfile.currentPrice,
      currentIV,
      realizedVol20,
      ivRank: ivProfile.ivRank.ivRank,
      ivPercentile: ivProfile.ivRank.ivPercentile,
      ivVsRvGap,
      skewDirection: ivProfile.skew.skewDirection,
      termStructureShape: ivProfile.termStructure.shape,
      catalystLabel: catalyst.label,
      catalystDate: catalyst.date,
      catalystDaysUntil: catalyst.daysUntil,
      catalystDensity: catalyst.density,
      narrativeMomentum: catalyst.density >= 3 ? 'mixed' : 'quiet',
      expressionPreview: buildSwingSniperExpressionPreview(direction, ivProfile.skew.skewDirection),
      reasons: buildReasons(
        currentIV,
        realizedVol20,
        ivProfile.ivRank.ivRank,
        ivProfile.termStructure.shape,
        ivProfile.skew.skewDirection,
        catalyst.label,
      ),
      saved: savedSymbols.has(symbol),
      asOf: ivProfile.asOf,
    };
  } catch (error) {
    logger.warn('Swing Sniper symbol scan failed', {
      symbol,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function scanSwingSniperUniverse(
  symbols: string[],
  savedSymbols: string[] = [],
): Promise<SwingSniperUniverseResponse> {
  const dedupedSymbols = Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()))).filter(Boolean);
  const savedSymbolSet = new Set(savedSymbols.map((symbol) => symbol.trim().toUpperCase()));

  const [earningsEvents, macroEvents] = await Promise.all([
    getEarningsCalendar(dedupedSymbols, 21).catch(() => [] as EarningsCalendarEvent[]),
    getEconomicCalendar(14, 'HIGH').catch(() => [] as EconomicEvent[]),
  ]);

  const earningsMap = new Map<string, EarningsCalendarEvent>();
  for (const event of earningsEvents) {
    if (!earningsMap.has(event.symbol)) {
      earningsMap.set(event.symbol, event);
    }
  }

  const results = await mapConcurrent(
    dedupedSymbols,
    SWING_SNIPER_SCAN_CONCURRENCY,
    async (symbol) => scanSymbol(symbol, earningsMap, macroEvents, savedSymbolSet),
  );

  const opportunities = results
    .filter((item): item is SwingSniperOpportunity => item != null)
    .sort((left, right) => right.score - left.score);

  return {
    generatedAt: new Date().toISOString(),
    universeSize: dedupedSymbols.length,
    symbolsScanned: opportunities.length,
    opportunities,
    notes: [
      'Phase 1 ranks a focused liquid universe and saved symbols while the broader batched sweep is still pending.',
      'Current IV is compared against trailing realized volatility to make the mispricing story visual and fast to parse.',
    ],
  };
}
