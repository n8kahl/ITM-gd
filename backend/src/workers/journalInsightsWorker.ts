import { logger } from '../lib/logger';
import { toEasternTime } from '../services/marketHours';
import { journalPatternAnalyzer } from '../services/journal/patternAnalyzer';
import {
  markWorkerCycleFailed,
  markWorkerCycleStarted,
  markWorkerCycleSucceeded,
  markWorkerNextRun,
  markWorkerStarted,
  markWorkerStopped,
  registerWorker,
} from '../services/workerHealth';

const JOURNAL_INSIGHTS_TARGET_MINUTES_ET = 18 * 60; // Sunday 6:00 PM ET
const JOURNAL_INSIGHTS_CHECK_INTERVAL_MS = 5 * 60_000;
const WORKER_NAME = 'journal_insights_worker';

let workerTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let lastRunSundayDate: string | null = null;
registerWorker(WORKER_NAME);

export function shouldRunWeeklyJournalInsights(
  now: Date,
  lastRunDate: string | null,
): { shouldRun: boolean; sundayDate: string } {
  const et = toEasternTime(now);
  const sundayDate = et.dateStr;
  const minutes = (et.hour * 60) + et.minute;

  if (et.dayOfWeek !== 0) {
    return { shouldRun: false, sundayDate };
  }

  if (minutes < JOURNAL_INSIGHTS_TARGET_MINUTES_ET) {
    return { shouldRun: false, sundayDate };
  }

  if (lastRunDate === sundayDate) {
    return { shouldRun: false, sundayDate };
  }

  return { shouldRun: true, sundayDate };
}

async function runCycle(): Promise<void> {
  if (!isRunning) return;

  const cycleStartedAt = markWorkerCycleStarted(WORKER_NAME);
  try {
    const schedule = shouldRunWeeklyJournalInsights(new Date(), lastRunSundayDate);

    if (schedule.shouldRun) {
      const stats = await journalPatternAnalyzer.runWeeklyPatternAnalysis(30);
      lastRunSundayDate = schedule.sundayDate;

      logger.info('Journal insights worker run complete', {
        sundayDate: schedule.sundayDate,
        ...stats,
      });
    }

    markWorkerCycleSucceeded(WORKER_NAME, cycleStartedAt);
  } catch (error) {
    markWorkerCycleFailed(WORKER_NAME, cycleStartedAt, error);
    logger.error('Journal insights worker cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    markWorkerNextRun(WORKER_NAME, JOURNAL_INSIGHTS_CHECK_INTERVAL_MS);
    workerTimer = setTimeout(runCycle, JOURNAL_INSIGHTS_CHECK_INTERVAL_MS);
  }
}

export function startJournalInsightsWorker(): void {
  if (isRunning) {
    logger.warn('Journal insights worker is already running');
    return;
  }

  isRunning = true;
  markWorkerStarted(WORKER_NAME);
  logger.info('Journal insights worker started');

  markWorkerNextRun(WORKER_NAME, JOURNAL_INSIGHTS_CHECK_INTERVAL_MS);
  workerTimer = setTimeout(runCycle, JOURNAL_INSIGHTS_CHECK_INTERVAL_MS);
}

export function stopJournalInsightsWorker(): void {
  isRunning = false;
  markWorkerStopped(WORKER_NAME);

  if (workerTimer) {
    clearTimeout(workerTimer);
    workerTimer = null;
  }

  logger.info('Journal insights worker stopped');
}
