import { supabase } from '../config/database';
import { logger } from '../lib/logger';
import { getSystemPrompt } from './systemPrompt';
import { getMarketStatus } from '../services/marketHours';
import { getMarketIndicesSnapshot } from '../services/marketIndices';
import { massiveClient, getTickerNews } from '../config/massive';
import { getEarningsCalendar } from '../services/earnings';
import { getEconomicCalendar } from '../services/economic';
import { getSPXSnapshot } from '../services/spx';

interface PromptProfile {
  tier?: string;
  experienceLevel?: string;
}

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const profileCache = new Map<string, { expiresAt: number; profile: PromptProfile }>();

const EXPERIENCE_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const TIER_CANONICAL_MAP: Record<string, string> = {
  free: 'free',
  basic: 'basic',
  lite: 'basic',
  pro: 'pro',
  premium: 'premium',
  elite: 'premium',
};

export type SessionPhase =
  | 'pre-market'
  | 'opening-drive'
  | 'mid-morning'
  | 'midday'
  | 'afternoon'
  | 'power-hour'
  | 'moc-imbalance'
  | 'after-hours'
  | 'closed';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

function normalizeExperienceLevel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (EXPERIENCE_LEVELS.has(normalized)) return normalized;
  if (normalized === 'new' || normalized === 'novice') return 'beginner';
  if (normalized === 'expert' || normalized === 'pro') return 'advanced';
  return undefined;
}

function normalizeTier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return TIER_CANONICAL_MAP[normalized];
}

function extractExperienceLevel(preferences: unknown): string | undefined {
  const record = asRecord(preferences);
  if (!record) return undefined;

  const candidate = record.experienceLevel
    ?? record.experience_level
    ?? record.traderExperience
    ?? record.trader_experience;

  return normalizeExperienceLevel(candidate);
}

function toETParts(now: Date = new Date()): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || '0');
  return { hour, minute };
}

export function getSessionContext(): { time: string; phase: SessionPhase; phaseNote: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const etTime = formatter.format(now);
  const { hour, minute } = toETParts(now);
  const totalMin = hour * 60 + minute;

  let phase: SessionPhase = 'closed';
  let phaseNote = 'Markets closed.';

  if (totalMin >= 240 && totalMin < 570) {
    phase = 'pre-market';
    phaseNote = 'Pre-market session. Thin liquidity and wider spreads.';
  } else if (totalMin >= 570 && totalMin < 600) {
    phase = 'opening-drive';
    phaseNote = 'Opening drive. Volatility and gap resolution are elevated.';
  } else if (totalMin >= 600 && totalMin < 690) {
    phase = 'mid-morning';
    phaseNote = 'Mid-morning. Watch continuation versus reversal behavior.';
  } else if (totalMin >= 690 && totalMin < 810) {
    phase = 'midday';
    phaseNote = 'Midday chop zone. Mean-reversion risk is higher.';
  } else if (totalMin >= 810 && totalMin < 900) {
    phase = 'afternoon';
    phaseNote = 'Afternoon session. Institutional flow starts building.';
  } else if (totalMin >= 900 && totalMin < 945) {
    phase = 'power-hour';
    phaseNote = 'Power hour. Volume and directional intent can increase.';
  } else if (totalMin >= 945 && totalMin < 960) {
    phase = 'moc-imbalance';
    phaseNote = 'MOC window. Closing-order imbalances can move price quickly.';
  } else if (totalMin >= 960 && totalMin < 1200) {
    phase = 'after-hours';
    phaseNote = 'After-hours session. Liquidity is thin and moves can be noisy.';
  }

  return { time: etTime, phase, phaseNote };
}

function formatAggLine(
  response: any,
  symbol: string,
  opts?: { asPercent?: boolean; omitDollar?: boolean },
): string | null {
  const row = response?.data?.results?.[0];
  if (!row) return null;
  const close = Number(row.c);
  const open = Number(row.o);
  if (!Number.isFinite(close) || !Number.isFinite(open) || open === 0) return null;
  const change = close - open;
  const pct = ((change / open) * 100).toFixed(2);
  const sign = change >= 0 ? '+' : '';
  const priceDisplay = opts?.omitDollar ? close.toFixed(2) : `$${close.toFixed(2)}`;
  return `${symbol}: ${priceDisplay} (${sign}${pct}%)`;
}

export async function loadMarketContext(): Promise<string> {
  try {
    const [spxRes, ndxRes, vixRes, dxyRes, tnxRes] = await Promise.all([
      massiveClient.get('/v2/aggs/ticker/I:SPX/prev').catch(() => null),
      massiveClient.get('/v2/aggs/ticker/I:NDX/prev').catch(() => null),
      massiveClient.get('/v2/aggs/ticker/I:VIX/prev').catch(() => null),
      massiveClient.get('/v2/aggs/ticker/I:DXY/prev').catch(() => null),
      massiveClient.get('/v2/aggs/ticker/I:TNX/prev').catch(() => null),
    ]);

    const session = getSessionContext();
    const lines = [
      `Current time: ${session.time} ET (${session.phase})`,
      session.phaseNote,
      '',
      [
        formatAggLine(spxRes, 'SPX'),
        formatAggLine(ndxRes, 'NDX'),
        formatAggLine(vixRes, 'VIX'),
        formatAggLine(dxyRes, 'DXY', { omitDollar: true }),
        formatAggLine(tnxRes, '10Y', { omitDollar: true }),
      ].filter(Boolean).join(' | '),
    ];

    return lines.join('\n');
  } catch (_error) {
    return 'Market context temporarily unavailable.';
  }
}

function normalizeSymbols(symbols: string[]): string[] {
  return [...new Set(
    symbols
      .map((symbol) => String(symbol || '').trim().toUpperCase())
      .map((symbol) => symbol.replace(/^\$/, ''))
      .map((symbol) => symbol.replace(/^I:/, ''))
      .filter((symbol) => /^[A-Z0-9._:-]{1,10}$/.test(symbol)),
  )];
}

export async function getEarningsProximityWarnings(symbols: string[]): Promise<string | null> {
  const normalized = normalizeSymbols(symbols).slice(0, 10);
  if (normalized.length === 0) return null;

  try {
    const events = await getEarningsCalendar(normalized, 5);
    if (!events.length) return null;

    const today = new Date().toISOString().slice(0, 10);
    const warnings = events.map((event) => {
      const daysText = event.date === today
        ? 'TODAY'
        : `in ${Math.max(1, Math.ceil((new Date(event.date).getTime() - Date.now()) / 86400000))} days`;
      return `⚠ ${event.symbol} reports earnings ${daysText} (${event.time}). Factor IV crush risk into options analysis.`;
    });

    return warnings.join('\n');
  } catch (error) {
    logger.warn('Failed to build earnings proximity warnings', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function getNewsDigest(symbols: string[]): Promise<string | null> {
  const normalized = normalizeSymbols(symbols);
  if (normalized.length === 0) return null;

  try {
    const primarySymbol = normalized[0];
    const articles = await getTickerNews(primarySymbol, 3);
    if (articles.length === 0) return null;

    const lines = articles.map((article) => (
      `- "${article.title}" (${article.publisher?.name || 'Unknown'}, ${new Date(article.published_utc).toLocaleDateString()})`
    ));
    return `Recent ${primarySymbol} headlines:\n${lines.join('\n')}`;
  } catch {
    return null;
  }
}

export async function getEconomicEventWarnings(daysAhead: number = 2): Promise<string | null> {
  try {
    const events = await getEconomicCalendar(daysAhead, 'HIGH');
    if (events.length === 0) return null;

    const warnings = events.slice(0, 4).map((event) => (
      `⚠ ${event.event} on ${event.date} (${event.impact}) may increase volatility and IV sensitivity.`
    ));
    return warnings.join('\n');
  } catch (error) {
    logger.warn('Failed to build economic event warnings', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function loadPromptProfile(userId: string): Promise<PromptProfile> {
  const cached = profileCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.profile;
  }

  const { data, error } = await supabase
    .from('ai_coach_users')
    .select('subscription_tier, preferences')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.warn('Failed to load AI Coach user profile for prompt context', {
      userId,
      error: error.message,
    });
    return {};
  }

  const profile: PromptProfile = {
    tier: normalizeTier(data?.subscription_tier),
    experienceLevel: extractExperienceLevel(data?.preferences),
  };

  profileCache.set(userId, {
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
    profile,
  });

  return profile;
}

async function loadSPXCommandCenterContext(): Promise<string | null> {
  try {
    const snapshot = await getSPXSnapshot({ forceRefresh: false });
    if (!snapshot) return null;

    const lines: string[] = [];
    const freshness = snapshot.generatedAt
      ? `Data as of: ${snapshot.generatedAt}`
      : `Data as of: ${new Date().toISOString()}`;
    lines.push(freshness);

    // Regime
    if (snapshot.regime) {
      const r = snapshot.regime;
      lines.push(`Regime: ${r.label || r.regime || 'unknown'} (confidence: ${typeof r.confidence === 'number' ? `${(r.confidence * 100).toFixed(0)}%` : 'N/A'})`);
    }

    // Key levels (top 8 by strength)
    if (snapshot.levels?.length > 0) {
      const topLevels = snapshot.levels
        .filter((l) => l.price > 0)
        .sort((a, b) => {
          const strengthOrder = { strong: 0, moderate: 1, weak: 2 };
          return (strengthOrder[a.strength] ?? 2) - (strengthOrder[b.strength] ?? 2);
        })
        .slice(0, 8);
      if (topLevels.length > 0) {
        lines.push('Key levels: ' + topLevels.map((l) => `${l.label || l.type} ${l.price.toFixed(2)} (${l.strength})`).join(', '));
      }
    }

    // GEX
    if (snapshot.gex?.spx) {
      const g = snapshot.gex.spx;
      const parts = [`spot ${g.spotPrice?.toFixed(2) || 'N/A'}`];
      if (g.flipPoint) parts.push(`flip ${g.flipPoint.toFixed(2)}`);
      if (g.callWall) parts.push(`call wall ${g.callWall.toFixed(2)}`);
      if (g.putWall) parts.push(`put wall ${g.putWall.toFixed(2)}`);
      lines.push('GEX: ' + parts.join(', '));
    }

    // Active setups summary
    if (snapshot.setups?.length > 0) {
      const active = snapshot.setups.filter((s) => ['ready', 'triggered', 'forming'].includes(s.status));
      if (active.length > 0) {
        lines.push(`Active setups: ${active.length} (${active.map((s) => `${s.direction} ${s.status} @ ${s.entryZone?.low?.toFixed(2)}-${s.entryZone?.high?.toFixed(2)}`).join('; ')})`);
      }
    }

    // Prediction pWin
    if (snapshot.prediction) {
      const p = snapshot.prediction;
      if (typeof p.pWin === 'number') {
        lines.push(`Prediction pWin: ${(p.pWin * 100).toFixed(1)}% (bias: ${p.bias || 'neutral'})`);
      }
    }

    return lines.join('\n');
  } catch (error) {
    logger.debug('Failed to load SPX command center context for coach', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function buildSystemPromptForUser(
  userId: string,
  options?: { isMobile?: boolean; recentSymbols?: string[]; activeChartSymbol?: string },
): Promise<string> {
  const marketStatus = getMarketStatus();
  const symbols = normalizeSymbols([
    ...(options?.activeChartSymbol ? [options.activeChartSymbol] : []),
    ...(options?.recentSymbols || []),
  ]);

  const [profile, indicesResponse, marketContextText, earningsWarnings, economicWarnings, newsDigest, spxContext] = await Promise.all([
    loadPromptProfile(userId),
    getMarketIndicesSnapshot().catch((err) => {
      logger.warn('Failed to fetch indices for prompt context', { error: err });
      return null;
    }),
    loadMarketContext(),
    getEarningsProximityWarnings(symbols),
    getEconomicEventWarnings(2),
    getNewsDigest(symbols),
    loadSPXCommandCenterContext(),
  ]);

  const spxQuote = indicesResponse?.quotes?.find((quote) => quote.symbol === 'SPX');
  const ndxQuote = indicesResponse?.quotes?.find((quote) => quote.symbol === 'NDX');

  return getSystemPrompt({
    tier: profile.tier,
    experienceLevel: profile.experienceLevel,
    isMobile: options?.isMobile === true,
    activeChartSymbol: options?.activeChartSymbol,
    marketContext: {
      isMarketOpen: marketStatus.status === 'open',
      marketStatus: marketStatus.status === 'open'
        ? 'Open'
        : marketStatus.status === 'pre-market'
          ? 'Pre-market'
          : marketStatus.status === 'after-hours'
            ? 'After-hours'
            : 'Closed',
      indices: {
        spx: spxQuote?.price,
        ndx: ndxQuote?.price,
        spxChange: spxQuote?.changePercent,
        ndxChange: ndxQuote?.changePercent,
      },
    },
    marketContextText,
    earningsWarnings,
    economicWarnings,
    newsDigest,
    spxCommandCenterContext: spxContext,
  });
}
