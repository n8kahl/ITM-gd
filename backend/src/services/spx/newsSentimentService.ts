import { getTickerNews, type MassiveNewsArticle } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { round } from './utils';

export type SPXNewsSentimentBias = 'bullish' | 'bearish' | 'neutral';

export interface SPXNewsSentimentArticle {
  id: string;
  title: string;
  publishedUtc: string;
  articleUrl: string;
  tickers: string[];
  marketMoving: boolean;
  sentimentScore: number;
  sentiment: SPXNewsSentimentBias;
}

export interface SPXNewsSentimentSnapshot {
  generatedAt: string;
  source: 'computed' | 'cached' | 'fallback';
  bias: SPXNewsSentimentBias;
  score: number;
  marketMovingCount: number;
  recentHighImpactCount: number;
  latestPublishedAt: string | null;
  articles: SPXNewsSentimentArticle[];
}

interface GetSPXNewsSentimentOptions {
  forceRefresh?: boolean;
  asOf?: Date;
}

const NEWS_SENTIMENT_CACHE_KEY = 'spx_command_center:news_sentiment:v1';
const NEWS_SENTIMENT_CACHE_TTL_SECONDS = 300;
const NEWS_SENTIMENT_MAX_ARTICLES = 60;
const NEWS_SENTIMENT_TICKERS = ['SPX', 'SPY', 'VIX'];
const NEWS_SENTIMENT_PER_TICKER_LIMIT = 25;

const POSITIVE_PHRASES = [
  'rally',
  'surge',
  'beats',
  'beat estimates',
  'upgrade',
  'optimism',
  'dovish',
  'cooling inflation',
  'risk-on',
  'strong demand',
];

const NEGATIVE_PHRASES = [
  'selloff',
  'plunge',
  'misses',
  'missed estimates',
  'downgrade',
  'concern',
  'hawkish',
  'hot inflation',
  'risk-off',
  'recession',
  'shock',
];

const HIGH_IMPACT_PHRASES = [
  'fomc',
  'federal reserve',
  'powell',
  'cpi',
  'inflation',
  'nfp',
  'nonfarm payroll',
  'employment',
  'jobless',
  'pce',
  'treasury yield',
  'earnings guidance',
  'volatility',
];

let pollerHandle: NodeJS.Timeout | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toSentimentBias(score: number): SPXNewsSentimentBias {
  if (score >= 12) return 'bullish';
  if (score <= -12) return 'bearish';
  return 'neutral';
}

function toTimestampMs(value: string): number | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function isSentimentSnapshot(value: unknown): value is SPXNewsSentimentSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SPXNewsSentimentSnapshot>;
  return (
    typeof candidate.generatedAt === 'string'
    && typeof candidate.source === 'string'
    && typeof candidate.bias === 'string'
    && Number.isFinite(candidate.score)
    && Number.isFinite(candidate.marketMovingCount)
    && Number.isFinite(candidate.recentHighImpactCount)
    && Array.isArray(candidate.articles)
  );
}

function textForArticle(article: MassiveNewsArticle): string {
  return [
    article.title || '',
    article.description || '',
    ...(Array.isArray(article.keywords) ? article.keywords : []),
  ].join(' ').toLowerCase();
}

function phraseHits(text: string, phrases: string[]): number {
  return phrases.reduce((count, phrase) => (text.includes(phrase) ? count + 1 : count), 0);
}

function scoreArticle(article: MassiveNewsArticle): {
  sentimentScore: number;
  sentiment: SPXNewsSentimentBias;
  marketMoving: boolean;
} {
  const text = textForArticle(article);
  const positiveHits = phraseHits(text, POSITIVE_PHRASES);
  const negativeHits = phraseHits(text, NEGATIVE_PHRASES);
  const impactHits = phraseHits(text, HIGH_IMPACT_PHRASES);

  const score = clamp((positiveHits * 16) - (negativeHits * 16), -100, 100);
  return {
    sentimentScore: round(score, 2),
    sentiment: toSentimentBias(score),
    marketMoving: impactHits > 0,
  };
}

function buildFallbackSnapshot(asOf: Date): SPXNewsSentimentSnapshot {
  return {
    generatedAt: asOf.toISOString(),
    source: 'fallback',
    bias: 'neutral',
    score: 0,
    marketMovingCount: 0,
    recentHighImpactCount: 0,
    latestPublishedAt: null,
    articles: [],
  };
}

function dedupeArticles(articles: MassiveNewsArticle[]): MassiveNewsArticle[] {
  const seen = new Set<string>();
  const deduped: MassiveNewsArticle[] = [];
  for (const article of articles) {
    const key = article.id || article.article_url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(article);
  }
  return deduped;
}

function mapAndScoreArticles(articles: MassiveNewsArticle[]): SPXNewsSentimentArticle[] {
  return dedupeArticles(articles)
    .map((article) => {
      const scored = scoreArticle(article);
      return {
        id: article.id || article.article_url,
        title: article.title,
        publishedUtc: article.published_utc,
        articleUrl: article.article_url,
        tickers: Array.isArray(article.tickers) ? article.tickers : [],
        marketMoving: scored.marketMoving,
        sentimentScore: scored.sentimentScore,
        sentiment: scored.sentiment,
      } satisfies SPXNewsSentimentArticle;
    })
    .filter((article) => typeof article.id === 'string' && article.id.length > 0)
    .sort((a, b) => (Date.parse(b.publishedUtc) || 0) - (Date.parse(a.publishedUtc) || 0))
    .slice(0, NEWS_SENTIMENT_MAX_ARTICLES);
}

function aggregateSnapshot(input: {
  asOf: Date;
  articles: SPXNewsSentimentArticle[];
}): SPXNewsSentimentSnapshot {
  const nowMs = input.asOf.getTime();
  let totalWeight = 0;
  let weightedScore = 0;
  let marketMovingCount = 0;
  let recentHighImpactCount = 0;

  for (const article of input.articles) {
    const publishedMs = toTimestampMs(article.publishedUtc);
    const ageMinutes = publishedMs == null ? 999 : Math.max(0, (nowMs - publishedMs) / 60_000);
    let weight = ageMinutes <= 30 ? 1.25 : ageMinutes <= 120 ? 1 : 0.65;
    if (article.marketMoving) weight += 0.35;

    totalWeight += weight;
    weightedScore += article.sentimentScore * weight;
    if (article.marketMoving) marketMovingCount += 1;
    if (article.marketMoving && ageMinutes <= 60) recentHighImpactCount += 1;
  }

  const score = totalWeight > 0 ? clamp(weightedScore / totalWeight, -100, 100) : 0;
  return {
    generatedAt: input.asOf.toISOString(),
    source: 'computed',
    bias: toSentimentBias(score),
    score: round(score, 2),
    marketMovingCount,
    recentHighImpactCount,
    latestPublishedAt: input.articles[0]?.publishedUtc || null,
    articles: input.articles,
  };
}

export async function getSPXNewsSentiment(
  options: GetSPXNewsSentimentOptions = {},
): Promise<SPXNewsSentimentSnapshot> {
  const asOf = options.asOf || new Date();

  if (!options.forceRefresh) {
    const cached = await cacheGet<SPXNewsSentimentSnapshot>(NEWS_SENTIMENT_CACHE_KEY);
    if (isSentimentSnapshot(cached)) {
      return {
        ...cached,
        source: 'cached',
      };
    }
  }

  try {
    const fetched = await Promise.all(
      NEWS_SENTIMENT_TICKERS.map((ticker) => getTickerNews(ticker, NEWS_SENTIMENT_PER_TICKER_LIMIT)),
    );
    const articles = mapAndScoreArticles(fetched.flat());
    const snapshot = aggregateSnapshot({
      asOf,
      articles,
    });
    await cacheSet(NEWS_SENTIMENT_CACHE_KEY, snapshot, NEWS_SENTIMENT_CACHE_TTL_SECONDS);
    return snapshot;
  } catch (error) {
    logger.warn('Failed to compute SPX news sentiment snapshot', {
      error: error instanceof Error ? error.message : String(error),
    });
    const cached = await cacheGet<SPXNewsSentimentSnapshot>(NEWS_SENTIMENT_CACHE_KEY);
    if (isSentimentSnapshot(cached)) {
      return {
        ...cached,
        source: 'cached',
      };
    }
    return buildFallbackSnapshot(asOf);
  }
}

export function startSPXNewsSentimentPolling(options?: {
  intervalMs?: number;
}): () => void {
  if (pollerHandle) {
    clearInterval(pollerHandle);
    pollerHandle = null;
  }

  const intervalMs = Math.max(30_000, options?.intervalMs ?? 5 * 60_000);
  pollerHandle = setInterval(async () => {
    try {
      await getSPXNewsSentiment({
        forceRefresh: true,
      });
    } catch (error) {
      logger.warn('SPX news sentiment polling iteration failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, intervalMs);

  return () => {
    if (!pollerHandle) return;
    clearInterval(pollerHandle);
    pollerHandle = null;
  };
}
