import { getDailyAggregates } from '../../config/massive';
import { logger } from '../../lib/logger';
import { formatMassiveTicker } from '../../lib/symbols';
import { listSwingSniperSignalSnapshots } from './persistence';
import type {
  SwingSniperBacktestOutcome,
  SwingSniperBacktestResponse,
  SwingSniperBacktestSummary,
  SwingSniperConfidenceOverlay,
  SwingSniperDirection,
  SwingSniperSignalSnapshotRecord,
} from './types';
import { clamp, round } from './utils';

const BACKTEST_WINDOW_DAYS = 360;
const MAX_SNAPSHOTS = 180;
const MAX_OUTCOME_ROWS = 40;

interface DailyClosePoint {
  date: string;
  close: number;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values
    .map((value) => (value - mean) ** 2)
    .reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(variance);
}

function resolveHorizonDays(snapshot: SwingSniperSignalSnapshotRecord): number {
  if (snapshot.catalystDaysUntil != null && Number.isFinite(snapshot.catalystDaysUntil)) {
    return Math.max(3, Math.min(15, snapshot.catalystDaysUntil + 2));
  }
  return 7;
}

function resolveMoveThresholdPct(
  direction: SwingSniperDirection,
  currentIV: number | null,
  horizonDays: number,
): number {
  const iv = currentIV != null && Number.isFinite(currentIV) ? currentIV : 32;
  const dailyMove = iv / Math.sqrt(252);
  const expectedMove = dailyMove * Math.sqrt(Math.max(1, horizonDays));

  if (direction === 'long_vol') {
    return round(Math.max(1.25, expectedMove * 0.55), 2);
  }
  if (direction === 'short_vol') {
    return round(Math.max(0.85, expectedMove * 0.35), 2);
  }
  return round(Math.max(1.0, expectedMove * 0.45), 2);
}

function evaluateSuccess(
  direction: SwingSniperDirection,
  absoluteMovePct: number,
  thresholdPct: number,
): boolean {
  if (direction === 'long_vol') return absoluteMovePct >= thresholdPct;
  if (direction === 'short_vol') return absoluteMovePct <= thresholdPct;
  return absoluteMovePct >= thresholdPct * 0.7 && absoluteMovePct <= thresholdPct * 1.35;
}

function recencyWeight(index: number, total: number): number {
  if (total <= 1) return 1;
  const rank = (index + 1) / total;
  return clamp(0.65 + (rank * 0.35), 0.65, 1);
}

function qualityWeight(snapshot: SwingSniperSignalSnapshotRecord): number {
  let score = 0.75;
  if (snapshot.score != null) score += 0.1;
  if (snapshot.ivRank != null) score += 0.1;
  if (snapshot.currentIV != null) score += 0.1;
  if (snapshot.ivVsRvGap != null) score += 0.05;
  return clamp(score, 0.75, 1.1);
}

function buildSummary(outcomes: SwingSniperBacktestOutcome[], snapshotsConsidered: number): SwingSniperBacktestSummary {
  const moveSeries = outcomes.map((outcome) => outcome.movePct);
  const wins = outcomes.filter((outcome) => outcome.success).length;
  const weightedDenominator = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
  const weightedWins = outcomes.reduce((sum, outcome) => (
    sum + (outcome.success ? outcome.weight : 0)
  ), 0);
  const horizonDays = outcomes.map((outcome) => outcome.horizonDays);

  return {
    sampleSize: snapshotsConsidered,
    resolvedSamples: outcomes.length,
    hitRatePct: outcomes.length > 0 ? round((wins / outcomes.length) * 100, 1) : null,
    weightedHitRatePct: weightedDenominator > 0 ? round((weightedWins / weightedDenominator) * 100, 1) : null,
    averageMovePct: outcomes.length > 0 ? round(average(moveSeries) || 0, 2) : null,
    medianMovePct: outcomes.length > 0 ? round(median(moveSeries) || 0, 2) : null,
    bestMovePct: outcomes.length > 0 ? round(Math.max(...moveSeries), 2) : null,
    worstMovePct: outcomes.length > 0 ? round(Math.min(...moveSeries), 2) : null,
    averageHorizonDays: outcomes.length > 0 ? round(average(horizonDays) || 0, 1) : null,
  };
}

function buildConfidenceOverlay(
  summary: SwingSniperBacktestSummary,
  outcomes: SwingSniperBacktestOutcome[],
  latestScore: number | null,
): SwingSniperConfidenceOverlay {
  const rationale: string[] = [];
  const hitRate = summary.weightedHitRatePct;
  const resolved = summary.resolvedSamples;
  const absoluteMoves = outcomes.map((outcome) => outcome.absoluteMovePct);
  const dispersion = standardDeviation(absoluteMoves);

  let confidenceWeight = 0.9;

  if (hitRate != null) {
    const edgeStrength = ((hitRate - 50) / 50) * 0.24;
    const sampleBoost = clamp((resolved - 3) / 10, 0, 1) * 0.12;
    const dispersionPenalty = clamp(dispersion / 18, 0, 0.14);
    confidenceWeight = clamp(1 + edgeStrength + sampleBoost - dispersionPenalty, 0.72, 1.28);

    if (hitRate >= 60) {
      rationale.push(`Weighted hit rate is ${hitRate.toFixed(1)}%, supporting a confidence uplift.`);
    } else if (hitRate <= 45) {
      rationale.push(`Weighted hit rate is ${hitRate.toFixed(1)}%, so confidence is trimmed.`);
    } else {
      rationale.push(`Weighted hit rate is ${hitRate.toFixed(1)}%, so confidence remains near baseline.`);
    }
  } else {
    rationale.push('Insufficient resolved outcomes to compute a weighted hit rate.');
  }

  if (resolved < 8) {
    rationale.push(`Sample size is ${resolved}, so reweighting is intentionally conservative.`);
  }

  const stance: SwingSniperConfidenceOverlay['stance'] = confidenceWeight >= 1.05
    ? 'boost'
    : confidenceWeight <= 0.95
      ? 'trim'
      : 'neutral';

  return {
    confidenceWeight: round(confidenceWeight, 3),
    baseScore: latestScore,
    adjustedScore: latestScore == null ? null : Math.round(clamp(latestScore * confidenceWeight, 1, 99)),
    stance,
    rationale,
  };
}

function buildUnavailablePayload(
  symbol: string,
  caveat: string,
  snapshotsConsidered: number = 0,
): SwingSniperBacktestResponse {
  return {
    generatedAt: new Date().toISOString(),
    symbol,
    status: 'unavailable',
    windowDays: BACKTEST_WINDOW_DAYS,
    snapshotsConsidered,
    summary: {
      sampleSize: snapshotsConsidered,
      resolvedSamples: 0,
      hitRatePct: null,
      weightedHitRatePct: null,
      averageMovePct: null,
      medianMovePct: null,
      bestMovePct: null,
      worstMovePct: null,
      averageHorizonDays: null,
    },
    confidence: {
      confidenceWeight: 0.9,
      baseScore: null,
      adjustedScore: null,
      stance: 'neutral',
      rationale: ['Backtest confidence is unavailable until enough snapshot history exists.'],
    },
    outcomes: [],
    caveats: [caveat],
    notes: [
      'Backtest outputs are decision support, not trade guarantees.',
    ],
  };
}

function toDailyCloses(
  bars: Array<{
    t: number;
    c: number;
  }>,
): DailyClosePoint[] {
  return bars
    .filter((bar) => Number.isFinite(bar.t) && Number.isFinite(bar.c) && bar.c > 0)
    .map((bar) => ({
      date: new Date(bar.t).toISOString().slice(0, 10),
      close: bar.c,
    }));
}

export async function buildSwingSniperBacktestReport(
  userId: string,
  symbol: string,
): Promise<SwingSniperBacktestResponse> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  let snapshots: SwingSniperSignalSnapshotRecord[] = [];
  try {
    snapshots = await listSwingSniperSignalSnapshots(userId, normalizedSymbol, MAX_SNAPSHOTS);
  } catch (error) {
    logger.warn('Swing Sniper backtest snapshot archive unavailable', {
      userId,
      symbol: normalizedSymbol,
      error: error instanceof Error ? error.message : String(error),
    });
    return buildUnavailablePayload(
      normalizedSymbol,
      'Signal snapshot archive is currently unavailable in this environment.',
    );
  }

  if (snapshots.length === 0) {
    return buildUnavailablePayload(normalizedSymbol, 'No archived signal snapshots were found for this symbol yet.');
  }

  const now = new Date();
  const from = new Date(now.getTime() - (BACKTEST_WINDOW_DAYS * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);

  let bars: Array<{ t: number; c: number }> = [];
  try {
    bars = await getDailyAggregates(formatMassiveTicker(normalizedSymbol), from, to);
  } catch (error) {
    logger.warn('Swing Sniper backtest failed to load historical bars', {
      symbol: normalizedSymbol,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const closes = toDailyCloses(bars);
  if (closes.length < 25) {
    return buildUnavailablePayload(
      normalizedSymbol,
      'Historical bars are insufficient for reliable backtest output in the current window.',
      snapshots.length,
    );
  }

  const snapshotsAscending = [...snapshots].sort((left, right) => left.asOfDate.localeCompare(right.asOfDate));
  const closeDates = closes.map((point) => point.date);
  const outcomes: SwingSniperBacktestOutcome[] = [];

  for (let index = 0; index < snapshotsAscending.length; index += 1) {
    const snapshot = snapshotsAscending[index];
    const horizonDays = resolveHorizonDays(snapshot);
    const firstDateAtOrAfter = closeDates.findIndex((date) => date >= snapshot.asOfDate);
    if (firstDateAtOrAfter < 0) continue;

    const entryIndex = firstDateAtOrAfter;
    const exitIndex = entryIndex + horizonDays;
    if (exitIndex >= closes.length) continue;

    const entry = closes[entryIndex];
    const exit = closes[exitIndex];
    if (!entry || !exit || entry.close <= 0 || exit.close <= 0) continue;

    const movePct = ((exit.close - entry.close) / entry.close) * 100;
    const absoluteMovePct = Math.abs(movePct);
    const thresholdPct = resolveMoveThresholdPct(snapshot.direction, snapshot.currentIV, horizonDays);
    const success = evaluateSuccess(snapshot.direction, absoluteMovePct, thresholdPct);
    const weight = round(
      clamp(recencyWeight(index, snapshotsAscending.length) * qualityWeight(snapshot), 0.5, 1.2),
      3,
    );

    outcomes.push({
      snapshotDate: snapshot.asOfDate,
      direction: snapshot.direction,
      entryPrice: round(entry.close, 4),
      exitPrice: round(exit.close, 4),
      horizonDays,
      movePct: round(movePct, 3),
      absoluteMovePct: round(absoluteMovePct, 3),
      thresholdPct,
      success,
      weight,
    });
  }

  if (outcomes.length === 0) {
    return buildUnavailablePayload(
      normalizedSymbol,
      'Snapshot archive exists, but no snapshots currently have complete horizon outcomes.',
      snapshotsAscending.length,
    );
  }

  const latestSnapshot = snapshots[0] || null;
  const summary = buildSummary(outcomes, snapshotsAscending.length);
  const confidence = buildConfidenceOverlay(summary, outcomes, latestSnapshot?.score ?? null);
  const caveats: string[] = [];

  if (summary.resolvedSamples < 8) {
    caveats.push('Sample size is small, so confidence overlays should be treated as provisional.');
  }
  if (summary.averageHorizonDays != null && summary.averageHorizonDays < 5) {
    caveats.push('Most resolved samples use short horizons and may underrepresent slower catalysts.');
  }
  if (confidence.stance === 'trim') {
    caveats.push('Recent outcomes reduced confidence weight; prioritize tighter risk controls.');
  }

  return {
    generatedAt: new Date().toISOString(),
    symbol: normalizedSymbol,
    status: summary.resolvedSamples >= 6 ? 'ready' : 'limited',
    windowDays: BACKTEST_WINDOW_DAYS,
    snapshotsConsidered: snapshotsAscending.length,
    summary,
    confidence,
    outcomes: outcomes
      .sort((left, right) => right.snapshotDate.localeCompare(left.snapshotDate))
      .slice(0, MAX_OUTCOME_ROWS),
    caveats,
    notes: [
      'Outcomes are based on archived Swing Sniper signal snapshots and daily close replay.',
      'Backtest confidence reweights score context; it is not a guarantee of future performance.',
    ],
  };
}
