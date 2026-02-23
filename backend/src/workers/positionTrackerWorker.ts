import { logger } from '../lib/logger';
import { getMarketStatus } from '../services/marketHours';
import {
  publishPositionAdvice,
  publishPositionLiveUpdate,
  publishPositionPushHeartbeat,
} from '../services/positionPushChannel';
import { ExitAdvisor } from '../services/positions/exitAdvisor';
import { LivePositionSnapshot, LivePositionTracker } from '../services/positions/liveTracker';
import { reconcileTradierBrokerLedger } from '../services/positions/brokerLedgerReconciliation';
import { enforceTradierLateDayFlatten } from '../services/positions/tradierFlatten';
import {
  markWorkerCycleFailed,
  markWorkerCycleStarted,
  markWorkerCycleSucceeded,
  markWorkerNextRun,
  markWorkerStarted,
  markWorkerStopped,
  registerWorker,
} from '../services/workerHealth';

export const POSITION_TRACKER_POLL_INTERVAL_MARKET_OPEN = 15_000;
export const POSITION_TRACKER_POLL_INTERVAL_MARKET_CLOSED = 60_000;
export const POSITION_TRACKER_INITIAL_DELAY = 15_000;
const POSITION_TRACKER_FETCH_LIMIT = 1000;
const POSITION_ADVICE_COOLDOWN_MS = 120_000;
const BROKER_RECONCILIATION_COOLDOWN_MS = 60_000;
const FLATTEN_CHECK_COOLDOWN_MS = 30_000;
const WORKER_NAME = 'position_tracker_worker';

registerWorker(WORKER_NAME);

let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
const lastAdvicePublishedAt = new Map<string, number>();
let lastBrokerReconciliationAt = 0;
let lastFlattenCheckAt = 0;

function adviceCooldownKey(userId: string, adviceType: string, positionId: string): string {
  return `${userId}:${positionId}:${adviceType}`;
}

function shouldPublishAdvice(userId: string, adviceType: string, positionId: string): boolean {
  const key = adviceCooldownKey(userId, adviceType, positionId);
  const now = Date.now();
  const lastSentAt = lastAdvicePublishedAt.get(key);
  if (lastSentAt && (now - lastSentAt) < POSITION_ADVICE_COOLDOWN_MS) {
    return false;
  }
  lastAdvicePublishedAt.set(key, now);
  return true;
}

export function getPositionTrackerPollingInterval(): number {
  const market = getMarketStatus();
  if (market.status === 'open' || market.status === 'pre-market' || market.status === 'after-hours') {
    return POSITION_TRACKER_POLL_INTERVAL_MARKET_OPEN;
  }
  return POSITION_TRACKER_POLL_INTERVAL_MARKET_CLOSED;
}

function snapshotCountByUsers(userSnapshots: Map<string, LivePositionSnapshot[]>): number {
  let count = 0;
  for (const snapshots of userSnapshots.values()) {
    count += snapshots.length;
  }
  return count;
}

async function runPositionTrackingCycle(): Promise<void> {
  const tracker = new LivePositionTracker();
  const advisor = new ExitAdvisor();

  const userSnapshots = await tracker.recalculateAllOpenPositions(POSITION_TRACKER_FETCH_LIMIT);
  const activePositionCount = snapshotCountByUsers(userSnapshots);

  publishPositionPushHeartbeat({
    generatedAt: new Date().toISOString(),
    activePositionCount,
    uniqueUsers: userSnapshots.size,
  });

  for (const [userId, snapshots] of userSnapshots) {
    for (const snapshot of snapshots) {
      publishPositionLiveUpdate({
        userId,
        snapshot,
        updatedAt: snapshot.updatedAt,
      });
    }

    const advice = advisor.generateAdviceFromInputs(
      snapshots.map((snapshot) => ({
        positionId: snapshot.id,
        symbol: snapshot.symbol,
        type: snapshot.type,
        quantity: snapshot.quantity,
        strike: snapshot.strike,
        expiry: snapshot.expiry,
        currentPrice: snapshot.currentPrice,
        currentValue: snapshot.currentValue,
        pnl: snapshot.pnl,
        pnlPct: snapshot.pnlPct,
        daysToExpiry: snapshot.daysToExpiry,
        breakeven: snapshot.breakeven,
        maxLoss: snapshot.maxLoss,
        greeks: snapshot.greeks,
      })),
    );

    for (const item of advice) {
      if (!shouldPublishAdvice(userId, item.type, item.positionId)) continue;

      publishPositionAdvice({
        userId,
        advice: item,
        generatedAt: new Date().toISOString(),
      });
    }
  }

  if (userSnapshots.size > 0) {
    logger.info('Position tracker worker cycle completed', {
      activePositionCount,
      uniqueUsers: userSnapshots.size,
    });
  }

  const now = Date.now();
  if (now - lastBrokerReconciliationAt >= BROKER_RECONCILIATION_COOLDOWN_MS) {
    lastBrokerReconciliationAt = now;
    try {
      const reconciliation = await reconcileTradierBrokerLedger();
      if (reconciliation.enabled && (reconciliation.positionsForceClosed > 0 || reconciliation.positionsQuantitySynced > 0)) {
        logger.info('Position tracker broker reconciliation updated positions', {
          forceClosed: reconciliation.positionsForceClosed,
          quantitySynced: reconciliation.positionsQuantitySynced,
        });
      }
    } catch (error) {
      logger.warn('Position tracker broker reconciliation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (now - lastFlattenCheckAt >= FLATTEN_CHECK_COOLDOWN_MS) {
    lastFlattenCheckAt = now;
    try {
      const flattenSummary = await enforceTradierLateDayFlatten();
      if (flattenSummary.flattenedPositions > 0 || flattenSummary.failedPositions > 0) {
        logger.info('Position tracker late-day flatten cycle', {
          enabled: flattenSummary.enabled,
          disabledReason: flattenSummary.disabledReason,
          consideredPositions: flattenSummary.consideredPositions,
          flattenedPositions: flattenSummary.flattenedPositions,
          failedPositions: flattenSummary.failedPositions,
        });
      }
    } catch (error) {
      logger.warn('Position tracker late-day flatten failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function scheduleNextPoll(intervalMs: number): void {
  if (!isRunning) return;

  markWorkerNextRun(WORKER_NAME, intervalMs);
  pollingTimer = setTimeout(async () => {
    if (!isRunning) return;

    const startedAt = markWorkerCycleStarted(WORKER_NAME);

    try {
      await runPositionTrackingCycle();
      markWorkerCycleSucceeded(WORKER_NAME, startedAt);
    } catch (error) {
      markWorkerCycleFailed(WORKER_NAME, startedAt, error);
      logger.error('Position tracker worker cycle failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const nextInterval = getPositionTrackerPollingInterval();
    scheduleNextPoll(nextInterval);
  }, intervalMs);
}

export function startPositionTrackerWorker(): void {
  if (isRunning) return;

  isRunning = true;
  markWorkerStarted(WORKER_NAME);

  logger.info('Position tracker worker started', {
    initialDelayMs: POSITION_TRACKER_INITIAL_DELAY,
  });

  scheduleNextPoll(POSITION_TRACKER_INITIAL_DELAY);
}

export function stopPositionTrackerWorker(): void {
  if (!isRunning) return;

  isRunning = false;

  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }

  markWorkerStopped(WORKER_NAME);

  logger.info('Position tracker worker stopped');
}
