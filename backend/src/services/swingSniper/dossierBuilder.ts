import { getTickerDetails, getTickerNews, type MassiveNewsArticle } from '../../config/massive';
import { logger } from '../../lib/logger';
import { getEconomicCalendar } from '../economic';
import { getEarningsAnalysis } from '../earnings';
import { getMarketHealthSnapshot } from '../marketAnalytics';
import { analyzeIVProfile } from '../options/ivAnalysis';
import type { EconomicEvent } from '../macro/macroContext';
import { getSwingSniperWatchlistState } from './persistence';
import type {
  SwingSniperCatalystDensityPoint,
  SwingSniperCatalystEvent,
  SwingSniperDirection,
  SwingSniperDossierResponse,
  SwingSniperNarrativeMomentum,
} from './types';
import { buildSwingSniperStructureLab } from './structureLab';
import {
  clamp,
  daysUntil,
  describeDaysUntilLabel,
  getSwingSniperVolBenchmark,
  round,
} from './utils';
import {
  buildSwingSniperExpressionPreview,
  buildSwingSniperSetupLabel,
  buildSwingSniperThesis,
  resolveSwingSniperDirection,
  scoreSwingSniperOpportunity,
} from './universeScanner';

const POSITIVE_NEWS_TERMS = ['beat', 'growth', 'margin', 'upgrade', 'contract', 'record', 'strong', 'launch', 'ai'];
const NEGATIVE_NEWS_TERMS = ['miss', 'cut', 'downgrade', 'probe', 'lawsuit', 'decline', 'weak', 'concern', 'layoff'];

function summarizeNewsNarrative(articles: MassiveNewsArticle[]): {
  momentum: SwingSniperNarrativeMomentum;
  summary: string;
} {
  if (articles.length === 0) {
    return {
      momentum: 'quiet',
      summary: 'Headline tape is quiet. Catalyst read relies more on volatility shape and scheduled events than narrative momentum.',
    };
  }

  let positiveHits = 0;
  let negativeHits = 0;

  for (const article of articles) {
    const haystack = `${article.title} ${article.description || ''}`.toLowerCase();
    positiveHits += POSITIVE_NEWS_TERMS.filter((term) => haystack.includes(term)).length;
    negativeHits += NEGATIVE_NEWS_TERMS.filter((term) => haystack.includes(term)).length;
  }

  if (positiveHits > negativeHits + 1) {
    return {
      momentum: 'positive',
      summary: 'Recent headlines skew constructive, with the tape leaning toward growth, margin, or product-expansion language.',
    };
  }

  if (negativeHits > positiveHits + 1) {
    return {
      momentum: 'negative',
      summary: 'Recent headlines lean defensive, with concern-driven language outweighing constructive follow-through.',
    };
  }

  return {
    momentum: 'mixed',
    summary: 'Headline tone is mixed. The cleaner edge still comes from the vol surface and the upcoming event stack.',
  };
}

function toMacroImpact(impact: EconomicEvent['impact']): SwingSniperCatalystEvent['impact'] {
  if (impact === 'HIGH') return 'high';
  if (impact === 'MEDIUM') return 'medium';
  return 'low';
}

function buildDensityStrip(events: SwingSniperCatalystEvent[]): SwingSniperCatalystDensityPoint[] {
  const today = new Date();
  const counts = new Map<string, number>();

  for (const event of events) {
    if (event.daysUntil < 0 || event.daysUntil > 13) continue;
    counts.set(event.date, (counts.get(event.date) || 0) + 1);
  }

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today.getTime() + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const count = counts.get(date) || 0;
    return {
      date,
      label: index === 0 ? 'Now' : `${index}D`,
      count,
      emphasis: count >= 3 ? 'high' : count >= 2 ? 'medium' : 'low',
    };
  });
}

function buildKeyStats(input: {
  currentIV: number | null;
  rv20: number | null;
  ivRank: number | null;
  ivPercentile: number | null;
  expectedMovePct: number | null;
  earningsDaysUntil: number | null;
}): SwingSniperDossierResponse['keyStats'] {
  const gap = input.currentIV != null && input.rv20 != null
    ? round(input.currentIV - input.rv20, 1)
    : null;

  return [
    {
      label: 'Current IV',
      value: input.currentIV != null ? `${input.currentIV.toFixed(1)}%` : '--',
      tone: gap != null && gap < 0 ? 'positive' : gap != null && gap > 0 ? 'negative' : 'neutral',
    },
    {
      label: '20D RV',
      value: input.rv20 != null ? `${input.rv20.toFixed(1)}%` : '--',
      tone: 'neutral',
    },
    {
      label: 'IV Rank',
      value: input.ivRank != null ? `${input.ivRank.toFixed(0)}` : '--',
      tone: input.ivRank != null && input.ivRank < 40 ? 'positive' : input.ivRank != null && input.ivRank > 65 ? 'negative' : 'neutral',
    },
    {
      label: 'IV Percentile',
      value: input.ivPercentile != null ? `${input.ivPercentile.toFixed(0)}` : '--',
      tone: 'neutral',
    },
    {
      label: 'Expected Move',
      value: input.expectedMovePct != null ? `${input.expectedMovePct.toFixed(1)}%` : '--',
      tone: 'neutral',
    },
    {
      label: 'Next Catalyst',
      value: input.earningsDaysUntil != null ? describeDaysUntilLabel(input.earningsDaysUntil) : 'Macro-led',
      tone: 'neutral',
    },
  ];
}

function buildRiskBlock(input: {
  direction: SwingSniperDirection;
  regimeLabel: string;
  earningsDaysUntil: number | null;
  moveOverpricing: number | null;
  projectedIVCrushPct: number | null;
}): SwingSniperDossierResponse['risk'] {
  const invalidation: string[] = [];
  const watchItems: string[] = [];

  if (input.direction === 'long_vol') {
    invalidation.push('The thesis weakens if IV reprices sharply higher before the catalyst and the cheap-gamma edge disappears.');
    invalidation.push('A benign event resolution without range expansion leaves theta in control quickly.');
  } else if (input.direction === 'short_vol') {
    invalidation.push('The thesis breaks if realized movement expands into the event window and premium stays bid.');
    invalidation.push('A surprise macro shock can keep front-month vol elevated longer than expected.');
  } else {
    invalidation.push('This idea is still forming; avoid forcing a structure until IV vs RV separation becomes cleaner.');
  }

  watchItems.push(`Regime context is ${input.regimeLabel}. Read each setup through that lens before structuring risk.`);

  if (input.earningsDaysUntil != null) {
    watchItems.push(`Earnings are ${describeDaysUntilLabel(input.earningsDaysUntil)} away, so timing drift matters more than usual.`);
  }

  if (input.moveOverpricing != null) {
    watchItems.push(`Implied move is ${input.moveOverpricing >= 0 ? 'above' : 'below'} recent realized earnings history by ${Math.abs(input.moveOverpricing).toFixed(0)}%.`);
  }

  const notes = [
    input.projectedIVCrushPct != null
      ? `Projected post-event IV crush proxy: ${input.projectedIVCrushPct.toFixed(0)}%.`
      : 'IV crush estimate unavailable with current event data.',
    'Structure Lab now proposes exact contract sets with deterministic scenario and payoff context.',
  ];

  return {
    invalidation,
    watchItems,
    notes,
  };
}

function toNewsEvent(article: MassiveNewsArticle): SwingSniperCatalystEvent {
  const date = article.published_utc.slice(0, 10);
  return {
    id: article.id,
    type: 'news',
    title: article.title,
    date,
    daysUntil: Math.max(0, daysUntil(date)),
    impact: 'low',
    summary: article.description || 'Recent headline context',
    url: article.article_url,
  };
}

export async function buildSwingSniperDossier(
  userId: string,
  symbol: string,
): Promise<SwingSniperDossierResponse> {
  const normalizedSymbol = symbol.trim().toUpperCase();

  const [
    ivProfile,
    volBenchmark,
    earningsAnalysisResult,
    marketHealth,
    tickerDetails,
    newsArticles,
    economicEvents,
    watchlistState,
  ] = await Promise.all([
    analyzeIVProfile(normalizedSymbol, {
      strikeRange: 16,
      maxExpirations: 4,
    }),
    getSwingSniperVolBenchmark(normalizedSymbol),
    getEarningsAnalysis(normalizedSymbol).catch((error) => {
      logger.warn('Swing Sniper earnings analysis unavailable for dossier', {
        symbol: normalizedSymbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }),
    getMarketHealthSnapshot().catch(() => null),
    getTickerDetails(normalizedSymbol).catch(() => null),
    getTickerNews(normalizedSymbol, 4).catch(() => [] as MassiveNewsArticle[]),
    getEconomicCalendar(14, 'HIGH').catch(() => [] as EconomicEvent[]),
    getSwingSniperWatchlistState(userId),
  ]);

  const currentIV = ivProfile.ivRank.currentIV;
  const rv20 = volBenchmark.rv20;
  const ivVsRvGap = currentIV != null && rv20 != null ? round(currentIV - rv20, 1) : null;
  const earningsDaysUntil = earningsAnalysisResult?.daysUntil ?? null;
  const direction = resolveSwingSniperDirection(ivVsRvGap, ivProfile.ivRank.ivRank, earningsDaysUntil);
  const macroDensity = economicEvents.filter((event) => {
    const delta = daysUntil(event.date);
    return delta >= 0 && delta <= 10;
  }).length;
  const catalystDensity = macroDensity + (earningsDaysUntil != null && earningsDaysUntil <= 14 ? 1 : 0);
  const score = scoreSwingSniperOpportunity({
    ivVsRvGap,
    ivRank: ivProfile.ivRank.ivRank,
    termStructureShape: ivProfile.termStructure.shape,
    skewDirection: ivProfile.skew.skewDirection,
    catalystDensity,
    earningsDaysUntil,
  });
  const setupLabel = buildSwingSniperSetupLabel(
    direction,
    earningsDaysUntil,
    ivProfile.termStructure.shape,
    ivProfile.skew.skewDirection,
  );
  const catalystLabel = earningsAnalysisResult?.earningsDate
    ? `Earnings ${describeDaysUntilLabel(earningsDaysUntil)}`
    : economicEvents[0]
      ? `${economicEvents[0].event} ${describeDaysUntilLabel(daysUntil(economicEvents[0].date))}`
      : 'No near-dated catalyst';
  const thesis = buildSwingSniperThesis(direction, currentIV, rv20, catalystLabel);
  const narrative = summarizeNewsNarrative(newsArticles);
  const savedSymbols = new Set(watchlistState.savedTheses.map((item) => item.symbol));

  const catalystEvents: SwingSniperCatalystEvent[] = [];

  if (earningsAnalysisResult?.earningsDate) {
    catalystEvents.push({
      id: `${normalizedSymbol}-earnings-${earningsAnalysisResult.earningsDate}`,
      type: 'earnings',
      title: `${normalizedSymbol} earnings`,
      date: earningsAnalysisResult.earningsDate,
      daysUntil: earningsDaysUntil ?? 0,
      impact: 'high',
      summary: `Implied move ${earningsAnalysisResult.expectedMove.pct.toFixed(1)}% with ${earningsAnalysisResult.straddlePricing.assessment} pricing.`,
      timing: earningsAnalysisResult.earningsDate ? `Expected ${describeDaysUntilLabel(earningsDaysUntil)}` : null,
      expectedMovePct: earningsAnalysisResult.expectedMove.pct,
    });
  }

  for (const event of economicEvents.slice(0, 4)) {
    catalystEvents.push({
      id: `macro-${event.event}-${event.date}`,
      type: 'macro',
      title: event.event,
      date: event.date,
      daysUntil: daysUntil(event.date),
      impact: toMacroImpact(event.impact),
      summary: event.relevance,
    });
  }

  for (const article of newsArticles.slice(0, 2)) {
    catalystEvents.push(toNewsEvent(article));
  }

  catalystEvents.sort((left, right) => {
    if (left.daysUntil !== right.daysUntil) return left.daysUntil - right.daysUntil;
    return left.date.localeCompare(right.date);
  });

  const densityStrip = buildDensityStrip(catalystEvents);
  const risk = buildRiskBlock({
    direction,
    regimeLabel: marketHealth?.regime.label || 'Neutral',
    earningsDaysUntil,
    moveOverpricing: earningsAnalysisResult?.moveOverpricing ?? null,
    projectedIVCrushPct: earningsAnalysisResult?.projectedIVCrushPct ?? null,
  });
  const structureLab = await buildSwingSniperStructureLab({
    symbol: normalizedSymbol,
    direction,
    currentPrice: ivProfile.currentPrice,
    currentIV,
    ivRank: ivProfile.ivRank.ivRank,
    skewDirection: ivProfile.skew.skewDirection,
    catalystDaysUntil: earningsDaysUntil ?? (economicEvents[0]?.date ? daysUntil(economicEvents[0].date) : null),
    termStructureShape: ivProfile.termStructure.shape,
    maxRecommendations: 4,
  });

  return {
    symbol: normalizedSymbol,
    companyName: tickerDetails?.name || null,
    currentPrice: ivProfile.currentPrice,
    score,
    direction,
    setupLabel,
    expressionPreview: buildSwingSniperExpressionPreview(direction, ivProfile.skew.skewDirection),
    thesis,
    summary: `${setupLabel}. ${thesis} Structure Lab now maps this setup to exact contract candidates with payoff tradeoffs.`,
    saved: savedSymbols.has(normalizedSymbol),
    asOf: ivProfile.asOf,
    reasoning: [
      currentIV != null && rv20 != null
        ? `IV benchmark is ${currentIV.toFixed(1)}% against 20D RV at ${rv20.toFixed(1)}%, which is ${ivVsRvGap != null && ivVsRvGap >= 0 ? 'rich' : 'cheap'} by ${Math.abs(ivVsRvGap || 0).toFixed(1)} vol points.`
        : 'IV versus realized comparison is limited by the current data available for this symbol.',
      `Term structure is ${ivProfile.termStructure.shape} and skew is ${ivProfile.skew.skewDirection.replace('_', ' ')}.`,
      earningsAnalysisResult?.earningsDate
        ? `The next earnings window is ${describeDaysUntilLabel(earningsDaysUntil)} away with a ${earningsAnalysisResult.expectedMove.pct.toFixed(1)}% implied move.`
        : 'No earnings window is currently in the near-term catalyst stack, so macro timing matters more.',
      narrative.summary,
    ],
    keyStats: buildKeyStats({
      currentIV,
      rv20,
      ivRank: ivProfile.ivRank.ivRank,
      ivPercentile: ivProfile.ivRank.ivPercentile,
      expectedMovePct: earningsAnalysisResult?.expectedMove.pct ?? null,
      earningsDaysUntil,
    }),
    volMap: {
      overlayMode: 'current_iv_benchmark',
      overlayPoints: volBenchmark.overlayBase.map((point) => ({
        date: point.date,
        label: point.label,
        iv: currentIV,
        rv: point.rv,
      })),
      currentIV,
      realizedVol10: volBenchmark.rv10,
      realizedVol20: volBenchmark.rv20,
      realizedVol30: volBenchmark.rv30,
      ivRank: ivProfile.ivRank.ivRank,
      ivPercentile: ivProfile.ivRank.ivPercentile,
      skewDirection: ivProfile.skew.skewDirection,
      termStructureShape: ivProfile.termStructure.shape,
      termStructure: ivProfile.termStructure.expirations.map((item) => ({
        date: item.date,
        dte: item.dte,
        atmIV: item.atmIV,
      })),
      note: 'The overlay uses the current IV benchmark against trailing realized volatility over the last 30 sessions so the premium gap is instantly visible.',
    },
    catalysts: {
      densityStrip,
      events: catalystEvents,
      narrative: narrative.summary,
    },
    risk,
    news: newsArticles.map((article) => ({
      id: article.id,
      title: article.title,
      publishedAt: article.published_utc,
      publisher: article.publisher?.name || 'Unknown source',
      summary: article.description || null,
      url: article.article_url,
    })),
    structureLab,
  };
}
