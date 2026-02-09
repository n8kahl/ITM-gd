import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';

interface JournalTradeRow {
  id: string;
  symbol: string;
  strategy: string | null;
  trade_outcome: 'win' | 'loss' | 'breakeven' | null;
  pnl: number | null;
  hold_time_days: number | null;
  created_at: string;
  entry_date: string;
  entry_price: number;
  quantity: number;
  session_context: Record<string, unknown> | null;
  exit_reason: string | null;
}

interface PersistedInsightRow {
  id: string;
  insight_data: JournalInsights;
  created_at: string;
  period_start: string;
  period_end: string;
}

interface TimeBucketStats {
  bucket: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
}

interface SetupStats {
  setup: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
}

export interface JournalInsights {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  tradeCount: number;
  timeOfDay: {
    buckets: TimeBucketStats[];
    bestBucket: TimeBucketStats | null;
    worstBucket: TimeBucketStats | null;
    summary: string;
  };
  setupAnalysis: {
    setups: SetupStats[];
    bestSetup: SetupStats | null;
    worstSetup: SetupStats | null;
    summary: string;
  };
  behavioral: {
    revengeTradingIncidents: number;
    overtrading: {
      thresholdPerDay: number;
      highActivityDays: number;
      lowActivityDays: number;
      winRateHighActivity: number | null;
      winRateLowActivity: number | null;
      summary: string;
    };
    holdTime: {
      avgWinnerHoldDays: number;
      avgLoserHoldDays: number;
      summary: string;
    };
  };
  riskManagement: {
    avgRealizedRiskReward: number | null;
    stopAdherencePct: number | null;
    positionSizingCv: number | null;
    summary: string;
  };
  summary: string;
}

export interface JournalInsightsResult {
  userId: string;
  period: {
    start: string;
    end: string;
    days: number;
  };
  insights: JournalInsights;
  cached: boolean;
}

function parseFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function dateDaysAgo(days: number): string {
  const date = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
  return date.toISOString().slice(0, 10);
}

function currentEtDate(): string {
  return toEasternTime(new Date()).dateStr;
}

const TIME_BUCKETS: Array<{ label: string; start: number; end: number }> = [
  { label: '9:30-10:00', start: 570, end: 600 },
  { label: '10:00-11:00', start: 600, end: 660 },
  { label: '11:00-12:00', start: 660, end: 720 },
  { label: '12:00-13:00', start: 720, end: 780 },
  { label: '13:00-14:00', start: 780, end: 840 },
  { label: '14:00-15:00', start: 840, end: 900 },
  { label: '15:00-16:00', start: 900, end: 960 },
];

function bucketForTrade(createdAt: string): string {
  const et = toEasternTime(new Date(createdAt));
  const minutes = et.hour * 60 + et.minute;
  const bucket = TIME_BUCKETS.find((item) => minutes >= item.start && minutes < item.end);
  return bucket?.label || 'outside_session';
}

function setupTypeForTrade(trade: JournalTradeRow): string {
  if (trade.strategy && trade.strategy.trim().length > 0) {
    return trade.strategy;
  }

  const setupType = asRecord(trade.session_context).setupType;
  if (typeof setupType === 'string' && setupType.trim().length > 0) {
    return setupType;
  }

  return 'Unclassified';
}

function safeWinRate(wins: number, total: number): number {
  if (total === 0) return 0;
  return Number(((wins / total) * 100).toFixed(2));
}

function safeAvg(sum: number, count: number): number {
  if (count === 0) return 0;
  return Number((sum / count).toFixed(2));
}

function summarizeTimeOfDay(best: TimeBucketStats | null, worst: TimeBucketStats | null): string {
  if (!best && !worst) return 'Not enough data for time-of-day pattern analysis yet.';
  if (best && worst && best.bucket !== worst.bucket) {
    return `Best window: ${best.bucket} (${best.winRate.toFixed(1)}% win rate). Weakest window: ${worst.bucket} (${worst.winRate.toFixed(1)}%).`;
  }
  if (best) {
    return `Most active window: ${best.bucket} with ${best.winRate.toFixed(1)}% win rate.`;
  }
  return 'Time-of-day edge is not clear yet.';
}

function summarizeSetups(best: SetupStats | null, worst: SetupStats | null): string {
  if (!best && !worst) return 'No setup-level pattern detected yet.';
  if (best && worst && best.setup !== worst.setup) {
    return `Strongest setup: ${best.setup} (${best.winRate.toFixed(1)}% win rate). Weakest: ${worst.setup} (${worst.winRate.toFixed(1)}%).`;
  }
  if (best) {
    return `Most effective setup so far: ${best.setup} (${best.winRate.toFixed(1)}% win rate).`;
  }
  return 'Setup-level edge is not clear yet.';
}

function inferRiskReward(trade: JournalTradeRow): number | null {
  const context = asRecord(trade.session_context);
  const suggested = asRecord(context.suggestedTrade);
  const entry = parseFiniteNumber(suggested.entry) ?? trade.entry_price;
  const stop = parseFiniteNumber(suggested.stopLoss);
  const target = parseFiniteNumber(suggested.target);

  if (!entry || !stop || !target) return null;

  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);

  if (!Number.isFinite(risk) || risk <= 0 || !Number.isFinite(reward)) return null;

  return Number((reward / risk).toFixed(2));
}

function getRevengeTradingIncidents(trades: JournalTradeRow[]): number {
  const bySymbol = new Map<string, JournalTradeRow[]>();
  for (const trade of trades) {
    const existing = bySymbol.get(trade.symbol) || [];
    existing.push(trade);
    bySymbol.set(trade.symbol, existing);
  }

  let incidents = 0;

  for (const symbolTrades of bySymbol.values()) {
    const sorted = [...symbolTrades].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const current = sorted[i];
      if (prev.trade_outcome !== 'loss' || current.trade_outcome !== 'loss') continue;

      const diffMs = new Date(current.created_at).getTime() - new Date(prev.created_at).getTime();
      if (diffMs <= 30 * 60 * 1000) {
        incidents += 1;
      }
    }
  }

  return incidents;
}

function computePositionSizingCv(trades: JournalTradeRow[]): number | null {
  const notionals = trades.map((trade) => {
    const multiplier = trade.session_context && asRecord(trade.session_context).positionType === 'stock' ? 1 : 100;
    return trade.entry_price * Math.abs(trade.quantity) * multiplier;
  }).filter((value) => Number.isFinite(value) && value > 0);

  if (notionals.length < 2) return null;

  const mean = notionals.reduce((sum, value) => sum + value, 0) / notionals.length;
  if (mean <= 0) return null;

  const variance = notionals.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / notionals.length;
  const stdDev = Math.sqrt(variance);

  return Number((stdDev / mean).toFixed(3));
}

function buildInsights(trades: JournalTradeRow[], periodStart: string, periodEnd: string): JournalInsights {
  const bucketMap = new Map<string, { trades: number; wins: number; losses: number; pnlSum: number }>();
  for (const bucket of TIME_BUCKETS) {
    bucketMap.set(bucket.label, { trades: 0, wins: 0, losses: 0, pnlSum: 0 });
  }

  const setupMap = new Map<string, { trades: number; wins: number; losses: number; pnlSum: number }>();

  for (const trade of trades) {
    const bucket = bucketForTrade(trade.created_at);
    if (bucketMap.has(bucket)) {
      const stats = bucketMap.get(bucket)!;
      stats.trades += 1;
      if (trade.trade_outcome === 'win') stats.wins += 1;
      if (trade.trade_outcome === 'loss') stats.losses += 1;
      stats.pnlSum += trade.pnl || 0;
    }

    const setup = setupTypeForTrade(trade);
    const setupStats = setupMap.get(setup) || { trades: 0, wins: 0, losses: 0, pnlSum: 0 };
    setupStats.trades += 1;
    if (trade.trade_outcome === 'win') setupStats.wins += 1;
    if (trade.trade_outcome === 'loss') setupStats.losses += 1;
    setupStats.pnlSum += trade.pnl || 0;
    setupMap.set(setup, setupStats);
  }

  const timeBuckets: TimeBucketStats[] = Array.from(bucketMap.entries())
    .map(([bucket, stats]) => ({
      bucket,
      trades: stats.trades,
      wins: stats.wins,
      losses: stats.losses,
      winRate: safeWinRate(stats.wins, stats.trades),
      avgPnl: safeAvg(stats.pnlSum, stats.trades),
    }))
    .filter((item) => item.trades > 0)
    .sort((a, b) => b.trades - a.trades);

  const setupStats: SetupStats[] = Array.from(setupMap.entries())
    .map(([setup, stats]) => ({
      setup,
      trades: stats.trades,
      wins: stats.wins,
      losses: stats.losses,
      winRate: safeWinRate(stats.wins, stats.trades),
      avgPnl: safeAvg(stats.pnlSum, stats.trades),
    }))
    .sort((a, b) => b.trades - a.trades);

  const bestBucket = [...timeBuckets].sort((a, b) => b.winRate - a.winRate)[0] || null;
  const worstBucket = [...timeBuckets].sort((a, b) => a.winRate - b.winRate)[0] || null;

  const bestSetup = [...setupStats].sort((a, b) => b.winRate - a.winRate)[0] || null;
  const worstSetup = [...setupStats].sort((a, b) => a.winRate - b.winRate)[0] || null;

  const revengeTradingIncidents = getRevengeTradingIncidents(trades);

  const tradesByDate = new Map<string, JournalTradeRow[]>();
  for (const trade of trades) {
    const list = tradesByDate.get(trade.entry_date) || [];
    list.push(trade);
    tradesByDate.set(trade.entry_date, list);
  }

  const thresholdPerDay = 5;
  const highActivityDays = Array.from(tradesByDate.values()).filter((items) => items.length >= thresholdPerDay);
  const lowActivityDays = Array.from(tradesByDate.values()).filter((items) => items.length < thresholdPerDay && items.length > 0);

  const highActivityClosed = highActivityDays.flat().filter((trade) => trade.trade_outcome != null);
  const lowActivityClosed = lowActivityDays.flat().filter((trade) => trade.trade_outcome != null);

  const winRateHighActivity = highActivityClosed.length > 0
    ? safeWinRate(highActivityClosed.filter((trade) => trade.trade_outcome === 'win').length, highActivityClosed.length)
    : null;
  const winRateLowActivity = lowActivityClosed.length > 0
    ? safeWinRate(lowActivityClosed.filter((trade) => trade.trade_outcome === 'win').length, lowActivityClosed.length)
    : null;

  const winners = trades.filter((trade) => trade.trade_outcome === 'win');
  const losers = trades.filter((trade) => trade.trade_outcome === 'loss');

  const avgWinnerHoldDays = Number(safeAvg(
    winners.reduce((sum, trade) => sum + (trade.hold_time_days || 0), 0),
    winners.length,
  ).toFixed(2));

  const avgLoserHoldDays = Number(safeAvg(
    losers.reduce((sum, trade) => sum + (trade.hold_time_days || 0), 0),
    losers.length,
  ).toFixed(2));

  const realizedRiskRewards = trades
    .map((trade) => inferRiskReward(trade))
    .filter((value): value is number => value !== null);

  const avgRealizedRiskReward = realizedRiskRewards.length > 0
    ? Number(safeAvg(realizedRiskRewards.reduce((sum, value) => sum + value, 0), realizedRiskRewards.length).toFixed(2))
    : null;

  const stopTaggedTrades = trades.filter((trade) => (trade.exit_reason || '').trim().length > 0);
  const stopAdhered = stopTaggedTrades.filter((trade) => {
    const reason = (trade.exit_reason || '').toLowerCase();
    return reason.includes('stop') || reason.includes('invalidat');
  }).length;

  const stopAdherencePct = stopTaggedTrades.length > 0
    ? Number(((stopAdhered / stopTaggedTrades.length) * 100).toFixed(2))
    : null;

  const positionSizingCv = computePositionSizingCv(trades);

  const timeSummary = summarizeTimeOfDay(bestBucket, worstBucket);
  const setupSummary = summarizeSetups(bestSetup, worstSetup);

  const behavioralSummary = winRateHighActivity !== null && winRateLowActivity !== null
    ? `High-activity days (${thresholdPerDay}+ trades) win rate: ${winRateHighActivity.toFixed(1)}% vs ${winRateLowActivity.toFixed(1)}% on normal days.`
    : 'More data needed for overtrading correlation analysis.';

  const holdSummary = `Average hold time: winners ${avgWinnerHoldDays.toFixed(1)}d vs losers ${avgLoserHoldDays.toFixed(1)}d.`;

  const riskSummary = `Avg realized R/R ${avgRealizedRiskReward?.toFixed(2) ?? 'n/a'}, stop adherence ${stopAdherencePct?.toFixed(1) ?? 'n/a'}%, sizing CV ${positionSizingCv?.toFixed(3) ?? 'n/a'}.`;

  return {
    periodStart,
    periodEnd,
    generatedAt: new Date().toISOString(),
    tradeCount: trades.length,
    timeOfDay: {
      buckets: timeBuckets,
      bestBucket,
      worstBucket,
      summary: timeSummary,
    },
    setupAnalysis: {
      setups: setupStats,
      bestSetup,
      worstSetup,
      summary: setupSummary,
    },
    behavioral: {
      revengeTradingIncidents,
      overtrading: {
        thresholdPerDay,
        highActivityDays: highActivityDays.length,
        lowActivityDays: lowActivityDays.length,
        winRateHighActivity,
        winRateLowActivity,
        summary: behavioralSummary,
      },
      holdTime: {
        avgWinnerHoldDays,
        avgLoserHoldDays,
        summary: holdSummary,
      },
    },
    riskManagement: {
      avgRealizedRiskReward,
      stopAdherencePct,
      positionSizingCv,
      summary: riskSummary,
    },
    summary: `${timeSummary} ${setupSummary} Revenge incidents: ${revengeTradingIncidents}. ${behavioralSummary} ${riskSummary}`,
  };
}

async function fetchTradesForPeriod(userId: string, startDate: string, endDate: string): Promise<JournalTradeRow[]> {
  const { data, error } = await supabase
    .from('ai_coach_trades')
    .select('id, symbol, strategy, trade_outcome, pnl, hold_time_days, created_at, entry_date, entry_price, quantity, session_context, exit_reason')
    .eq('user_id', userId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .not('trade_outcome', 'is', null)
    .order('entry_date', { ascending: true })
    .limit(5000);

  if (error) {
    throw new Error(`Failed to load trades for insights: ${error.message}`);
  }

  return (data || []) as JournalTradeRow[];
}

async function loadLatestStoredInsight(
  userId: string,
  periodStart: string,
  periodEnd: string,
): Promise<PersistedInsightRow | null> {
  const { data, error } = await supabase
    .from('ai_coach_journal_insights')
    .select('id, insight_data, created_at, period_start, period_end')
    .eq('user_id', userId)
    .eq('insight_type', 'pattern_analysis')
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn('Pattern analyzer: failed to load cached insight', {
      userId,
      periodStart,
      periodEnd,
      error: error.message,
      code: (error as { code?: string }).code,
    });
    return null;
  }

  if (!data) return null;
  return data as PersistedInsightRow;
}

async function persistInsight(userId: string, periodStart: string, periodEnd: string, insightData: JournalInsights): Promise<void> {
  const { error } = await supabase
    .from('ai_coach_journal_insights')
    .insert({
      user_id: userId,
      insight_type: 'pattern_analysis',
      insight_data: insightData,
      period_start: periodStart,
      period_end: periodEnd,
    });

  if (error) {
    throw new Error(`Failed to persist journal insights: ${error.message}`);
  }
}

async function loadActiveInsightUsers(): Promise<string[]> {
  const sinceDate = dateDaysAgo(90);

  const { data, error } = await supabase
    .from('ai_coach_trades')
    .select('user_id')
    .gte('entry_date', sinceDate)
    .limit(5000);

  if (error) {
    logger.warn('Pattern analyzer: failed to load active users', {
      error: error.message,
      code: (error as { code?: string }).code,
    });
    return [];
  }

  const userIds = new Set<string>();
  for (const row of data || []) {
    const value = (row as { user_id?: string }).user_id;
    if (value) userIds.add(value);
  }

  return Array.from(userIds);
}

export class JournalPatternAnalyzer {
  async getJournalInsightsForUser(
    userId: string,
    periodDays: number = 30,
    options?: { forceRefresh?: boolean },
  ): Promise<JournalInsightsResult> {
    const days = Math.max(1, Math.min(365, Math.trunc(periodDays)));
    const periodEnd = currentEtDate();
    const periodStart = dateDaysAgo(days - 1);

    if (!options?.forceRefresh) {
      const cached = await loadLatestStoredInsight(userId, periodStart, periodEnd);
      if (cached) {
        return {
          userId,
          period: {
            start: periodStart,
            end: periodEnd,
            days,
          },
          insights: cached.insight_data,
          cached: true,
        };
      }
    }

    const trades = await fetchTradesForPeriod(userId, periodStart, periodEnd);
    const insights = buildInsights(trades, periodStart, periodEnd);

    await persistInsight(userId, periodStart, periodEnd, insights);

    return {
      userId,
      period: {
        start: periodStart,
        end: periodEnd,
        days,
      },
      insights,
      cached: false,
    };
  }

  async runWeeklyPatternAnalysis(periodDays: number = 30): Promise<{
    candidates: number;
    generated: number;
    failed: number;
  }> {
    const userIds = await loadActiveInsightUsers();
    let generated = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        await this.getJournalInsightsForUser(userId, periodDays, { forceRefresh: true });
        generated += 1;
      } catch (error) {
        failed += 1;
        logger.warn('Pattern analyzer: user insight generation failed', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      candidates: userIds.length,
      generated,
      failed,
    };
  }
}

export const journalPatternAnalyzer = new JournalPatternAnalyzer();
