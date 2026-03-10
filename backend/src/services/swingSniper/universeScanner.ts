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

const SWING_SNIPER_SCAN_CONCURRENCY = 5;
const DEFAULT_SWING_SNIPER_SCAN_LIMIT = 150;

const SWING_SNIPER_LAUNCH_UNIVERSE = [
  'SPY',
  'QQQ',
  'IWM',
  'DIA',
  'TLT',
  'GLD',
  'SLV',
  'USO',
  'XLB',
  'XLC',
  'XLE',
  'XLF',
  'XLI',
  'XLK',
  'XLP',
  'XLRE',
  'XLU',
  'XRT',
  'KRE',
  'ARKK',
  'SMH',
  'SOXX',
  'NVDA',
  'AAPL',
  'MSFT',
  'AMZN',
  'META',
  'GOOGL',
  'TSLA',
  'MU',
  'QCOM',
  'INTC',
  'AMD',
  'AVGO',
  'ASML',
  'AMAT',
  'LRCX',
  'KLAC',
  'ARM',
  'MRVL',
  'SMCI',
  'TSM',
  'ADBE',
  'ORCL',
  'NOW',
  'SNOW',
  'PLTR',
  'NFLX',
  'CRM',
  'SHOP',
  'SQ',
  'PYPL',
  'UBER',
  'ABNB',
  'ROKU',
  'RBLX',
  'NET',
  'DDOG',
  'MDB',
  'TEAM',
  'SPOT',
  'DIS',
  'CMCSA',
  'TMUS',
  'VZ',
  'T',
  'JPM',
  'BAC',
  'WFC',
  'C',
  'GS',
  'MS',
  'BLK',
  'SCHW',
  'AXP',
  'V',
  'MA',
  'COIN',
  'MSTR',
  'HOOD',
  'XOM',
  'CVX',
  'COP',
  'OXY',
  'SLB',
  'HAL',
  'MPC',
  'PSX',
  'EOG',
  'APA',
  'FCX',
  'NEM',
  'UNH',
  'LLY',
  'JNJ',
  'MRK',
  'PFE',
  'ABBV',
  'TMO',
  'ISRG',
  'VRTX',
  'REGN',
  'AMGN',
  'GILD',
  'BIIB',
  'XBI',
  'XLV',
  'KO',
  'PEP',
  'PM',
  'MO',
  'COST',
  'WMT',
  'TGT',
  'HD',
  'LOW',
  'NKE',
  'SBUX',
  'MCD',
  'CMG',
  'DG',
  'DLTR',
  'BA',
  'CAT',
  'DE',
  'GE',
  'HON',
  'LMT',
  'NOC',
  'RTX',
  'ETN',
  'MMM',
  'AAL',
  'DAL',
  'UAL',
  'F',
  'GM',
  'RIVN',
  'LCID',
  'BABA',
  'PDD',
  'NIO',
  'RCL',
  'CCL',
  'MAR',
  'BKNG',
  'EXPE',
  'GME',
  'AMC',
] as const;

export const SWING_SNIPER_CORE_SCAN_SYMBOLS = Array.from(new Set(SWING_SNIPER_LAUNCH_UNIVERSE)).slice(0, DEFAULT_SWING_SNIPER_SCAN_LIMIT);

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
  liquidityScore: number | null;
}): SwingSniperOpportunity['orc'] {
  const gapIntensity = input.ivVsRvGap == null ? 36 : Math.abs(input.ivVsRvGap) * 6.4;
  const rankIntensity = input.ivRank == null ? 10 : Math.abs(input.ivRank - 50) * 0.72;
  const termShapeBonus = input.termStructureShape === 'backwardation'
    ? 8
    : input.termStructureShape === 'contango'
      ? 4
      : 2;
  const skewBonus = input.skewDirection === 'balanced' ? 3 : 6;
  const volMispricing = round(clamp(gapIntensity + rankIntensity + termShapeBonus + skewBonus, 0, 100), 1);

  const catalystDensity = round(clamp(
    (input.catalystDensity * 16)
    + (input.earningsDaysUntil != null && input.earningsDaysUntil <= 10 ? 20 : 0),
    0,
    100,
  ), 1);
  const liquidity = round(clamp(input.liquidityScore ?? 42, 0, 100), 1);
  const total = round(clamp((volMispricing * 0.45) + (catalystDensity * 0.30) + (liquidity * 0.25), 1, 99), 0);

  return {
    volMispricing,
    catalystDensity,
    liquidity,
    total,
  };
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
    const orc = scoreSwingSniperOpportunity({
      ivVsRvGap,
      ivRank: ivProfile.ivRank.ivRank,
      termStructureShape: ivProfile.termStructure.shape,
      skewDirection: ivProfile.skew.skewDirection,
      catalystDensity: catalyst.density,
      earningsDaysUntil,
      liquidityScore: volBenchmark.liquidityScore,
    });
    const score = orc.total;
    const setupLabel = buildSwingSniperSetupLabel(
      direction,
      earningsDaysUntil,
      ivProfile.termStructure.shape,
      ivProfile.skew.skewDirection,
    );

    return {
      symbol,
      score,
      orc,
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
      liquidityScore: volBenchmark.liquidityScore,
      liquidityTier: volBenchmark.liquidityTier,
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

function buildBoardThemes(opportunities: SwingSniperOpportunity[]): SwingSniperUniverseResponse['boardThemes'] {
  const themes = [
    {
      key: 'long-vol-cluster',
      label: 'Long-vol dislocations',
      match: (item: SwingSniperOpportunity) => item.direction === 'long_vol',
    },
    {
      key: 'short-vol-cluster',
      label: 'Short-vol premium sales',
      match: (item: SwingSniperOpportunity) => item.direction === 'short_vol',
    },
    {
      key: 'catalyst-dense',
      label: 'Catalyst-dense window',
      match: (item: SwingSniperOpportunity) => item.catalystDaysUntil != null && item.catalystDaysUntil <= 10,
    },
    {
      key: 'deep-liquidity',
      label: 'Deep-liquidity candidates',
      match: (item: SwingSniperOpportunity) => item.liquidityScore != null && item.liquidityScore >= 72,
    },
    {
      key: 'put-skew',
      label: 'Put-skew pressure',
      match: (item: SwingSniperOpportunity) => item.skewDirection === 'put_heavy',
    },
    {
      key: 'term-kink',
      label: 'Backwardation pockets',
      match: (item: SwingSniperOpportunity) => item.termStructureShape === 'backwardation',
    },
  ];

  return themes
    .map((theme) => {
      const members = opportunities.filter(theme.match);
      const avgScore = members.length > 0
        ? round(members.reduce((sum, member) => sum + member.score, 0) / members.length, 1)
        : 0;
      return {
        key: theme.key,
        label: theme.label,
        count: members.length,
        avgScore,
      };
    })
    .filter((theme) => theme.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return right.avgScore - left.avgScore;
    })
    .slice(0, 5);
}

export async function scanSwingSniperUniverse(
  symbols: string[],
  savedSymbols: string[] = [],
  scanLimit: number = DEFAULT_SWING_SNIPER_SCAN_LIMIT,
): Promise<SwingSniperUniverseResponse> {
  const dedupedSymbols = Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()))).filter(Boolean);
  const boundedScanLimit = Math.max(25, Math.min(DEFAULT_SWING_SNIPER_SCAN_LIMIT, Math.floor(scanLimit)));
  const activeUniverse = dedupedSymbols.slice(0, boundedScanLimit);
  const savedSymbolSet = new Set(savedSymbols.map((symbol) => symbol.trim().toUpperCase()));

  const [earningsEvents, macroEvents] = await Promise.all([
    getEarningsCalendar(activeUniverse, 21).catch(() => [] as EarningsCalendarEvent[]),
    getEconomicCalendar(14, 'HIGH').catch(() => [] as EconomicEvent[]),
  ]);

  const earningsMap = new Map<string, EarningsCalendarEvent>();
  for (const event of earningsEvents) {
    if (!earningsMap.has(event.symbol)) {
      earningsMap.set(event.symbol, event);
    }
  }

  const results = await mapConcurrent(
    activeUniverse,
    SWING_SNIPER_SCAN_CONCURRENCY,
    async (symbol) => scanSymbol(symbol, earningsMap, macroEvents, savedSymbolSet),
  );

  const opportunities = results
    .filter((item): item is SwingSniperOpportunity => item != null)
    .sort((left, right) => right.score - left.score);
  const boardThemes = buildBoardThemes(opportunities);

  return {
    generatedAt: new Date().toISOString(),
    universeSize: dedupedSymbols.length,
    scanLimit: boundedScanLimit,
    symbolsScanned: opportunities.length,
    opportunities,
    boardThemes,
    notes: [
      'ORC score blends volatility mispricing, catalyst density, and liquidity into a ranked board.',
      `Scan budget is capped at ${boundedScanLimit} symbols per refresh to control upstream usage and latency.`,
    ],
  };
}
