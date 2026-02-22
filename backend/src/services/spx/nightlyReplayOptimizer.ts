import { logger } from '../../lib/logger';
import { isTradingDay, toEasternTime } from '../marketHours';
import {
  getActiveSPXOptimizationProfile,
  runSPXOptimizerScan,
  type SPXOptimizationScanResult,
  type SPXOptimizerMode,
} from './optimizer';
import {
  backfillHistoricalSPXSetupInstances,
  type HistoricalBackfillSummary,
} from './historicalReconstruction';

const DEFAULT_REPLAY_ENABLED = true;
const DEFAULT_REPLAY_FAIL_ON_ERRORS = true;
const DEFAULT_REPLAY_MAX_FAILED_DAYS = 0;

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function parseIntEnv(value: string | undefined, fallback: number, minimum: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, parsed);
}

function shiftDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayOffset(date: Date, days: number): Date {
  return new Date(date.getTime() + (days * 86_400_000));
}

function resolveMostRecentTradingDateEt(now: Date = new Date()): string {
  for (let offset = 0; offset <= 10; offset += 1) {
    const candidate = dayOffset(now, -offset);
    if (isTradingDay(candidate)) {
      return toEasternTime(candidate).dateStr;
    }
  }

  return toEasternTime(now).dateStr;
}

function resolveReplayWindow(input: {
  asOfDateEt: string;
  trainingDays: number;
  validationDays: number;
}): { from: string; to: string; lookbackDays: number } {
  const lookbackOverride = parseIntEnv(
    process.env.SPX_OPTIMIZER_NIGHTLY_REPLAY_LOOKBACK_DAYS,
    0,
    0,
  );
  const profileLookbackDays = Math.max(5, (input.trainingDays + input.validationDays) - 1);
  const lookbackDays = lookbackOverride > 0
    ? Math.max(5, lookbackOverride)
    : profileLookbackDays;

  return {
    from: shiftDate(input.asOfDateEt, -(lookbackDays - 1)),
    to: input.asOfDateEt,
    lookbackDays,
  };
}

function formatBackfillErrors(summary: HistoricalBackfillSummary): string {
  const failed = summary.rows
    .filter((row) => row.errors.length > 0)
    .slice(0, 4)
    .map((row) => `${row.date}:${row.errors[0]}`);

  return failed.join(' | ');
}

export interface SPXNightlyReplayOptimizerResult {
  asOfDateEt: string;
  replayEnabled: boolean;
  replayRange: {
    from: string;
    to: string;
    lookbackDays: number;
  };
  replaySummary: HistoricalBackfillSummary | null;
  optimizerResult: SPXOptimizationScanResult;
}

export async function runSPXNightlyReplayOptimizerCycle(input?: {
  asOfDateEt?: string;
  mode?: SPXOptimizerMode;
  actor?: string | null;
  reason?: string | null;
}): Promise<SPXNightlyReplayOptimizerResult> {
  const replayEnabled = parseBooleanEnv(
    process.env.SPX_OPTIMIZER_NIGHTLY_REPLAY_ENABLED,
    DEFAULT_REPLAY_ENABLED,
  );
  const failOnReplayErrors = parseBooleanEnv(
    process.env.SPX_OPTIMIZER_NIGHTLY_REPLAY_FAIL_ON_ERRORS,
    DEFAULT_REPLAY_FAIL_ON_ERRORS,
  );
  const maxFailedDays = parseIntEnv(
    process.env.SPX_OPTIMIZER_NIGHTLY_REPLAY_MAX_FAILED_DAYS,
    DEFAULT_REPLAY_MAX_FAILED_DAYS,
    0,
  );

  const profile = await getActiveSPXOptimizationProfile();
  const asOfDateEt = input?.asOfDateEt || resolveMostRecentTradingDateEt();
  const replayRange = resolveReplayWindow({
    asOfDateEt,
    trainingDays: profile.walkForward.trainingDays,
    validationDays: profile.walkForward.validationDays,
  });

  let replaySummary: HistoricalBackfillSummary | null = null;

  if (replayEnabled) {
    replaySummary = await backfillHistoricalSPXSetupInstances({
      from: replayRange.from,
      to: replayRange.to,
    });

    if (failOnReplayErrors && replaySummary.failedDays > maxFailedDays) {
      const details = formatBackfillErrors(replaySummary);
      throw new Error([
        'SPX nightly replay reconstruction failed quality gate.',
        `failedDays=${replaySummary.failedDays}`,
        `maxFailedDays=${maxFailedDays}`,
        details,
      ].filter((part) => part.length > 0).join(' '));
    }
  }

  const optimizerResult = await runSPXOptimizerScan({
    from: replayRange.from,
    to: replayRange.to,
    mode: input?.mode || 'nightly_auto',
    actor: input?.actor,
    reason: input?.reason,
  });

  logger.info('SPX nightly replay optimizer cycle complete', {
    asOfDateEt,
    replayEnabled,
    replayFrom: replayRange.from,
    replayTo: replayRange.to,
    replayLookbackDays: replayRange.lookbackDays,
    replayFailedDays: replaySummary?.failedDays ?? 0,
    optimizationApplied: optimizerResult.scorecard.optimizationApplied,
    validationTrades: optimizerResult.scorecard.optimized.tradeCount,
  });

  return {
    asOfDateEt,
    replayEnabled,
    replayRange,
    replaySummary,
    optimizerResult,
  };
}
