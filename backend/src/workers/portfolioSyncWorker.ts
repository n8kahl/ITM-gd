import { logger } from '../lib/logger';
import { syncAllActiveTradierPortfolioSnapshots } from '../services/portfolio/portfolioSync';
import {
  markWorkerCycleFailed,
  markWorkerCycleStarted,
  markWorkerCycleSucceeded,
  markWorkerNextRun,
  markWorkerStarted,
  markWorkerStopped,
  registerWorker,
} from '../services/workerHealth';

const WORKER_NAME = 'portfolio_sync_worker';
const ENABLED = String(process.env.TRADIER_PORTFOLIO_SYNC_ENABLED || 'false').toLowerCase() === 'true';
const INTERVAL_MS = (() => {
  const parsed = Number.parseInt(process.env.TRADIER_PORTFOLIO_SYNC_INTERVAL_MS || '60000', 10);
  if (!Number.isFinite(parsed)) return 60_000;
  return Math.max(15_000, parsed);
})();

let isRunning = false;
let timer: ReturnType<typeof setTimeout> | null = null;

registerWorker(WORKER_NAME);

async function runCycle(): Promise<void> {
  if (!isRunning) return;

  const cycleStartedAt = markWorkerCycleStarted(WORKER_NAME);
  try {
    const syncedUsers = await syncAllActiveTradierPortfolioSnapshots();
    logger.info('Portfolio sync worker cycle completed', {
      syncedUsers,
    });
    markWorkerCycleSucceeded(WORKER_NAME, cycleStartedAt);
  } catch (error) {
    markWorkerCycleFailed(WORKER_NAME, cycleStartedAt, error);
    logger.error('Portfolio sync worker cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    markWorkerNextRun(WORKER_NAME, INTERVAL_MS);
    timer = setTimeout(runCycle, INTERVAL_MS);
  }
}

export function startPortfolioSyncWorker(): void {
  if (!ENABLED) {
    logger.info('Portfolio sync worker disabled via TRADIER_PORTFOLIO_SYNC_ENABLED=false');
    return;
  }
  if (isRunning) {
    logger.warn('Portfolio sync worker already running');
    return;
  }

  isRunning = true;
  markWorkerStarted(WORKER_NAME);
  logger.info('Portfolio sync worker started', {
    intervalMs: INTERVAL_MS,
  });

  markWorkerNextRun(WORKER_NAME, INTERVAL_MS);
  timer = setTimeout(runCycle, INTERVAL_MS);
}

export function stopPortfolioSyncWorker(): void {
  isRunning = false;
  markWorkerStopped(WORKER_NAME);
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info('Portfolio sync worker stopped');
}
