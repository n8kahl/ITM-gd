import { logger } from '../lib/logger';
import { isTradingDay, toEasternTime } from '../services/marketHours';
import {
  getSPXOptimizerNightlyStatus,
  persistSPXOptimizerNightlyStatus,
} from '../services/spx/optimizer';
import { runSPXNightlyReplayOptimizerCycle } from '../services/spx/nightlyReplayOptimizer';
import {
  markWorkerCycleFailed,
  markWorkerCycleStarted,
  markWorkerCycleSucceeded,
  markWorkerNextRun,
  markWorkerStarted,
  markWorkerStopped,
  registerWorker,
} from '../services/workerHealth';

const WORKER_NAME = 'spx_optimizer_worker';
const DEFAULT_TARGET_MINUTE_ET = 19 * 60 + 10;
const DEFAULT_CHECK_INTERVAL_MS = 60_000;

const NIGHTLY_ENABLED = String(process.env.SPX_OPTIMIZER_NIGHTLY_ENABLED || 'true').toLowerCase() !== 'false';
const TARGET_MINUTE_ET = (() => {
  const parsed = Number.parseInt(process.env.SPX_OPTIMIZER_TARGET_MINUTE_ET || '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_TARGET_MINUTE_ET;
  return Math.max(0, Math.min(23 * 60 + 59, parsed));
})();
const CHECK_INTERVAL_MS = (() => {
  const parsed = Number.parseInt(process.env.SPX_OPTIMIZER_CHECK_INTERVAL_MS || '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_CHECK_INTERVAL_MS;
  return Math.max(10_000, parsed);
})();

let workerTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let lastRunDateEt: string | null = null;
let lastAttemptAt: string | null = null;
let lastSuccessAt: string | null = null;
let lastErrorMessage: string | null = null;

registerWorker(WORKER_NAME);

function formatMinuteEt(minuteEt: number): string {
  const hours = Math.floor(minuteEt / 60);
  const minutes = minuteEt % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatIsoToEtLabel(value: string): string {
  const et = toEasternTime(new Date(value));
  return `${et.dateStr} ${et.hour.toString().padStart(2, '0')}:${et.minute.toString().padStart(2, '0')} ET`;
}

function dayOffset(date: Date, days: number): Date {
  return new Date(date.getTime() + (days * 86_400_000));
}

function computeNextEligibleRun(now: Date, priorRunDateEt: string | null): { date: string; atEt: string } | null {
  for (let offset = 0; offset <= 10; offset += 1) {
    const candidate = dayOffset(now, offset);
    if (!isTradingDay(candidate)) continue;

    const et = toEasternTime(candidate);
    if (offset === 0) {
      const nowEt = toEasternTime(now);
      const nowMinute = nowEt.hour * 60 + nowEt.minute;
      const alreadyRan = priorRunDateEt === nowEt.dateStr;
      if (!alreadyRan && nowMinute < TARGET_MINUTE_ET) {
        return { date: nowEt.dateStr, atEt: `${nowEt.dateStr} ${formatMinuteEt(TARGET_MINUTE_ET)} ET` };
      }
      if (!alreadyRan && nowMinute >= TARGET_MINUTE_ET) {
        return { date: nowEt.dateStr, atEt: `${nowEt.dateStr} ${formatMinuteEt(TARGET_MINUTE_ET)} ET` };
      }
      continue;
    }

    return {
      date: et.dateStr,
      atEt: `${et.dateStr} ${formatMinuteEt(TARGET_MINUTE_ET)} ET`,
    };
  }

  return null;
}

export function shouldRunSPXOptimizerNightly(
  now: Date,
  lastRunDate: string | null,
): { shouldRun: boolean; dateEt: string; minuteEt: number } {
  const et = toEasternTime(now);
  const minuteEt = et.hour * 60 + et.minute;

  if (!NIGHTLY_ENABLED) {
    return { shouldRun: false, dateEt: et.dateStr, minuteEt };
  }

  if (!isTradingDay(now)) {
    return { shouldRun: false, dateEt: et.dateStr, minuteEt };
  }

  if (lastRunDate === et.dateStr) {
    return { shouldRun: false, dateEt: et.dateStr, minuteEt };
  }

  if (minuteEt < TARGET_MINUTE_ET) {
    return { shouldRun: false, dateEt: et.dateStr, minuteEt };
  }

  return {
    shouldRun: true,
    dateEt: et.dateStr,
    minuteEt,
  };
}

async function runCycle(): Promise<void> {
  if (!isRunning) return;

  const cycleStartedAt = markWorkerCycleStarted(WORKER_NAME);
  try {
    const now = new Date();
    const schedule = shouldRunSPXOptimizerNightly(now, lastRunDateEt);

    if (schedule.shouldRun) {
      lastAttemptAt = now.toISOString();
      lastErrorMessage = null;
      await persistSPXOptimizerNightlyStatus({
        lastRunDateEt,
        lastAttemptAt,
        lastSuccessAt,
        lastErrorMessage,
      });

      const cycleResult = await runSPXNightlyReplayOptimizerCycle({
        asOfDateEt: schedule.dateEt,
        mode: 'nightly_auto',
      });
      lastRunDateEt = schedule.dateEt;
      const result = cycleResult.optimizerResult;

      const dataQuality = result.scorecard.dataQuality;
      if (dataQuality?.failClosedActive && !dataQuality.gatePassed) {
        throw new Error([
          'SPX optimizer fail-closed guardrail blocked nightly promotion.',
          ...dataQuality.reasons.slice(0, 4),
        ].join(' '));
      }

      lastSuccessAt = new Date().toISOString();
      lastErrorMessage = null;
      await persistSPXOptimizerNightlyStatus({
        lastRunDateEt,
        lastAttemptAt,
        lastSuccessAt,
        lastErrorMessage,
      });

      logger.info('SPX optimizer nightly run complete', {
        dateEt: schedule.dateEt,
        replayEnabled: cycleResult.replayEnabled,
        replayFrom: cycleResult.replayRange.from,
        replayTo: cycleResult.replayRange.to,
        replayFailedDays: cycleResult.replaySummary?.failedDays ?? 0,
        applied: result.scorecard.optimizationApplied,
        validationTrades: result.scorecard.optimized.tradeCount,
        t1Delta: result.scorecard.improvementPct.t1WinRateDelta,
        t2Delta: result.scorecard.improvementPct.t2WinRateDelta,
      });
    }

    markWorkerCycleSucceeded(WORKER_NAME, cycleStartedAt);
  } catch (error) {
    lastAttemptAt = new Date().toISOString();
    lastErrorMessage = error instanceof Error ? error.message : String(error);
    await persistSPXOptimizerNightlyStatus({
      lastRunDateEt,
      lastAttemptAt,
      lastSuccessAt,
      lastErrorMessage,
    });
    markWorkerCycleFailed(WORKER_NAME, cycleStartedAt, error);
    logger.error('SPX optimizer nightly cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    markWorkerNextRun(WORKER_NAME, CHECK_INTERVAL_MS);
    workerTimer = setTimeout(runCycle, CHECK_INTERVAL_MS);
  }
}

export function startSPXOptimizerWorker(): void {
  if (!NIGHTLY_ENABLED) {
    logger.info('SPX optimizer nightly worker is disabled via SPX_OPTIMIZER_NIGHTLY_ENABLED=false');
    return;
  }

  if (isRunning) {
    logger.warn('SPX optimizer nightly worker is already running');
    return;
  }

  isRunning = true;
  markWorkerStarted(WORKER_NAME);
  logger.info('SPX optimizer nightly worker started', {
    targetTimeEt: formatMinuteEt(TARGET_MINUTE_ET),
    checkIntervalMs: CHECK_INTERVAL_MS,
  });

  markWorkerNextRun(WORKER_NAME, CHECK_INTERVAL_MS);
  workerTimer = setTimeout(runCycle, CHECK_INTERVAL_MS);
}

export function stopSPXOptimizerWorker(): void {
  isRunning = false;
  markWorkerStopped(WORKER_NAME);

  if (workerTimer) {
    clearTimeout(workerTimer);
    workerTimer = null;
  }

  logger.info('SPX optimizer nightly worker stopped');
}

export interface SPXOptimizerWorkerStatus {
  enabled: boolean;
  isRunning: boolean;
  mode: 'nightly_auto';
  timezone: 'America/New_York';
  targetMinuteEt: number;
  targetTimeEt: string;
  checkIntervalMs: number;
  lastRunDateEt: string | null;
  lastAttemptAt: string | null;
  lastAttemptAtEt: string | null;
  lastSuccessAt: string | null;
  lastSuccessAtEt: string | null;
  lastErrorMessage: string | null;
  nextEligibleRunDateEt: string | null;
  nextEligibleRunAtEt: string | null;
}

export async function getSPXOptimizerWorkerStatus(now: Date = new Date()): Promise<SPXOptimizerWorkerStatus> {
  const persisted = await getSPXOptimizerNightlyStatus();
  const effectiveLastRunDateEt = lastRunDateEt ?? persisted.lastRunDateEt;
  const effectiveLastAttemptAt = lastAttemptAt ?? persisted.lastAttemptAt;
  const effectiveLastSuccessAt = lastSuccessAt ?? persisted.lastSuccessAt;
  const effectiveLastErrorMessage = lastErrorMessage ?? persisted.lastErrorMessage;
  const nextEligible = NIGHTLY_ENABLED ? computeNextEligibleRun(now, effectiveLastRunDateEt) : null;
  const lastAttemptAtEt = effectiveLastAttemptAt
    ? formatIsoToEtLabel(effectiveLastAttemptAt)
    : null;
  const lastSuccessAtEt = effectiveLastSuccessAt
    ? formatIsoToEtLabel(effectiveLastSuccessAt)
    : null;

  return {
    enabled: NIGHTLY_ENABLED,
    isRunning,
    mode: 'nightly_auto',
    timezone: 'America/New_York',
    targetMinuteEt: TARGET_MINUTE_ET,
    targetTimeEt: formatMinuteEt(TARGET_MINUTE_ET),
    checkIntervalMs: CHECK_INTERVAL_MS,
    lastRunDateEt: effectiveLastRunDateEt,
    lastAttemptAt: effectiveLastAttemptAt,
    lastAttemptAtEt,
    lastSuccessAt: effectiveLastSuccessAt,
    lastSuccessAtEt,
    lastErrorMessage: effectiveLastErrorMessage,
    nextEligibleRunDateEt: nextEligible?.date || null,
    nextEligibleRunAtEt: nextEligible?.atEt || null,
  };
}
