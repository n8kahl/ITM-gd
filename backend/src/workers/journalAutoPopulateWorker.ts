import { logger } from '../lib/logger';
import { isTradingDay, toEasternTime } from '../services/marketHours';
import { journalAutoPopulateService } from '../services/journal/autoPopulate';
import {
  markWorkerCycleFailed,
  markWorkerCycleStarted,
  markWorkerCycleSucceeded,
  markWorkerNextRun,
  markWorkerStarted,
  markWorkerStopped,
  registerWorker,
} from '../services/workerHealth';

const JOURNAL_AUTOPOP_TARGET_MINUTES_ET = (16 * 60) + 5; // 4:05 PM ET
const JOURNAL_AUTOPOP_CHECK_INTERVAL_MS = 60_000;
const WORKER_NAME = 'journal_autopopulate_worker';

let workerTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let lastGeneratedMarketDate: string | null = null;
registerWorker(WORKER_NAME);

export function shouldGenerateAutoJournalDrafts(
  now: Date,
  lastGeneratedDate: string | null,
): { shouldRun: boolean; marketDate: string } {
  const et = toEasternTime(now);
  const marketDate = et.dateStr;
  const minutes = (et.hour * 60) + et.minute;

  if (!isTradingDay(now)) {
    return { shouldRun: false, marketDate };
  }

  if (lastGeneratedDate === marketDate) {
    return { shouldRun: false, marketDate };
  }

  if (minutes < JOURNAL_AUTOPOP_TARGET_MINUTES_ET) {
    return { shouldRun: false, marketDate };
  }

  return { shouldRun: true, marketDate };
}

async function runCycle(): Promise<void> {
  if (!isRunning) return;

  const cycleStartedAt = markWorkerCycleStarted(WORKER_NAME);
  try {
    const schedule = shouldGenerateAutoJournalDrafts(new Date(), lastGeneratedMarketDate);

    if (schedule.shouldRun) {
      const stats = await journalAutoPopulateService.runForMarketDate(schedule.marketDate);
      lastGeneratedMarketDate = schedule.marketDate;

      logger.info('Journal auto-populate worker run complete', {
        ...stats,
      });
    }

    markWorkerCycleSucceeded(WORKER_NAME, cycleStartedAt);
  } catch (error) {
    markWorkerCycleFailed(WORKER_NAME, cycleStartedAt, error);
    logger.error('Journal auto-populate worker cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    markWorkerNextRun(WORKER_NAME, JOURNAL_AUTOPOP_CHECK_INTERVAL_MS);
    workerTimer = setTimeout(runCycle, JOURNAL_AUTOPOP_CHECK_INTERVAL_MS);
  }
}

export function startJournalAutoPopulateWorker(): void {
  if (isRunning) {
    logger.warn('Journal auto-populate worker is already running');
    return;
  }

  isRunning = true;
  markWorkerStarted(WORKER_NAME);
  logger.info('Journal auto-populate worker started');

  markWorkerNextRun(WORKER_NAME, JOURNAL_AUTOPOP_CHECK_INTERVAL_MS);
  workerTimer = setTimeout(runCycle, JOURNAL_AUTOPOP_CHECK_INTERVAL_MS);
}

export function stopJournalAutoPopulateWorker(): void {
  isRunning = false;
  markWorkerStopped(WORKER_NAME);

  if (workerTimer) {
    clearTimeout(workerTimer);
    workerTimer = null;
  }

  logger.info('Journal auto-populate worker stopped');
}
