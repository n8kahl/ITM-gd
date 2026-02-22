import { logger } from '../lib/logger';
import { getMarketStatus } from '../services/marketHours';
import {
  publishPositionAdvice,
  publishPositionLiveUpdate,
  publishPositionPushHeartbeat,
} from '../services/positionPushChannel';
import { ExitAdvisor } from '../services/positions/exitAdvisor';
import { LivePositionSnapshot, LivePositionTracker } from '../services/positions/liveTracker';
import {
  markWorkerCycleFailed,
  markWorkerCycleStarted,
  markWorkerCycleSucceeded,
  markWorkerNextRun,
  markWorkerStarted,
  markWorkerStopped,
  registerWorker,
} from '../services/workerHealth';
import { reconcileTradierBrokerLedger } from '../services/positions/brokerLedgerReconciliation';
import { applyExecutionSlippageGuardrail } from '../services/spx/optimizer';

export const POSITION_TRACKER_POLL_INTERVAL_MARKET_OPEN = 15_000;
export const POSITION_TRACKER_POLL_INTERVAL_MARKET_CLOSED = 60_000;
export const POSITION_TRACKER_INITIAL_DELAY = 15_000;
const POSITION_TRACKER_FETCH_LIMIT = 1000;
const POSITION_ADVICE_COOLDOWN_MS = 120_000;
const POSITION_RECONCILIATION_MIN_INTERVAL_MS = Math.max(
  15_000,
  Number.parseInt(process.env.TRADIER_POSITION_RECONCILIATION_INTERVAL_MS || '60000', 10) || 60_000,
);
const POSITION_SLIPPAGE_GUARDRAIL_MIN_INTERVAL_MS = Math.max(
  30_000,
  Number.parseInt(process.env.SPX_OPTIMIZER_SLIPPAGE_GUARDRAIL_INTERVAL_MS || '60000', 10) || 60_000,
);
const WORKER_NAME = 'position_tracker_worker';

registerWorker(WORKER_NAME);

let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
const lastAdvicePublishedAt = new Map<string, number>();
let lastPositionReconciliationAt = 0;
let lastSlippageGuardrailAt = 0;

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
  const nowMs = Date.now();

  if ((nowMs - lastPositionReconciliationAt) >= POSITION_RECONCILIATION_MIN_INTERVAL_MS) {
    lastPositionReconciliationAt = nowMs;
    try {
      const reconciliation = await reconcileTradierBrokerLedger();
      if (
        reconciliation.enabled
        && (reconciliation.positionsForceClosed > 0 || reconciliation.positionsQuantitySynced > 0 || reconciliation.usersWithBrokerErrors > 0)
      ) {
        logger.info('Position tracker broker reconciliation completed', {
          usersScanned: reconciliation.usersScanned,
          usersWithCredentials: reconciliation.usersWithCredentials,
          usersWithBrokerErrors: reconciliation.usersWithBrokerErrors,
          openPositionsScanned: reconciliation.openPositionsScanned,
          positionsForceClosed: reconciliation.positionsForceClosed,
          positionsQuantitySynced: reconciliation.positionsQuantitySynced,
        });
      }
    } catch (error) {
      logger.warn('Position tracker broker reconciliation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

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
        entryPrice: snapshot.entryPrice,
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

  if ((nowMs - lastSlippageGuardrailAt) >= POSITION_SLIPPAGE_GUARDRAIL_MIN_INTERVAL_MS) {
    lastSlippageGuardrailAt = nowMs;
    try {
      const slippageGuardrail = await applyExecutionSlippageGuardrail({
        actor: WORKER_NAME,
        reason: 'rolling execution slippage observed by position tracker',
      });
      if (slippageGuardrail.applied) {
        logger.warn('SPX optimizer slippage guardrail adjusted minEvR', {
          sampleCount: slippageGuardrail.sampleCount,
          avgEntrySlippagePts: slippageGuardrail.avgEntrySlippagePts,
          thresholdPts: slippageGuardrail.thresholdPts,
          previousMinEvR: slippageGuardrail.currentMinEvR,
          nextMinEvR: slippageGuardrail.nextMinEvR,
          historyEntryId: slippageGuardrail.historyEntryId,
          windowSignature: slippageGuardrail.windowSignature,
        });
      }
    } catch (error) {
      logger.warn('Position tracker slippage guardrail cycle failed', {
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
