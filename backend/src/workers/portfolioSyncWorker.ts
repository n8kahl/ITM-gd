import { logger } from '../lib/logger';
import { syncAllActiveTradierPortfolioSnapshots } from '../services/portfolio/portfolioSync';
import { isTradierProductionRuntimeEnabled } from '../services/broker/tradier/credentials';
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
const RUNTIME_ENABLEMENT = isTradierProductionRuntimeEnabled({
  baseEnabled: ENABLED,
  productionEnableEnv: process.env.TRADIER_PORTFOLIO_SYNC_PRODUCTION_ENABLED,
});
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
  if (!RUNTIME_ENABLEMENT.enabled) {
    logger.info('Portfolio sync worker disabled by runtime guard', {
      reason: RUNTIME_ENABLEMENT.reason,
    });
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
