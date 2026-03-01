import { logger } from '../../../lib/logger';
import { publishCoachMessage } from '../../coachPushChannel';
import {
  updateExecutionState,
  closeExecutionState,
  markStateFailed,
} from '../../spx/executionStateStore';
import {
  type ExecutionFillSide,
  type ExecutionTransitionPhase,
  recordExecutionFill,
} from '../../spx/executionReconciliation';
import type { Setup } from '../../spx/types';
import { TradierClient } from './client';
import { buildTradierRunnerStopOrder } from './orderRouter';

interface PollEntry {
  orderId: string;
  userId: string;
  setupId: string;
  sessionDate: string;
  phase: 'entry' | 't1' | 'runner_stop' | 'terminal';
  placedAt: number;
  pollCount: number;
  tradier: TradierClient;
  totalQuantity: number;
  lastRecordedFillQty: number;
  transitionEventId?: string;
  direction?: Setup['direction'];
  referencePrice?: number;
  symbol?: string;
  protectiveStopPrice?: number;
  activeStopOrderId?: string | null;
  stopCoverageQuantity: number;
  remainingBeforeOrder?: number;
  postFillStopPrice?: number;
  fillSide?: ExecutionFillSide;
  fillPhase?: ExecutionTransitionPhase;
}

const POLL_INTERVAL_MS = 5_000;
const MAX_PENDING_AGE_MS = 2 * 60 * 1000; // 2 minutes before timeout
const MAX_POLL_COUNT = 60; // 5 minutes max (5s * 60)

const pollQueue: Map<string, PollEntry> = new Map();
let pollIntervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Enqueue an order for status polling after placement.
 */
export function enqueueOrderForPolling(entry: {
  orderId: string;
  userId: string;
  setupId: string;
  sessionDate: string;
  phase: PollEntry['phase'];
  tradier: TradierClient;
  totalQuantity: number;
  transitionEventId?: string;
  direction?: Setup['direction'];
  referencePrice?: number;
  symbol?: string;
  protectiveStopPrice?: number;
  activeStopOrderId?: string | null;
  remainingBeforeOrder?: number;
  postFillStopPrice?: number;
  initialStopCoverageQuantity?: number;
  fillSide?: ExecutionFillSide;
  fillPhase?: ExecutionTransitionPhase;
}): void {
  const resolvedFillMeta = resolveFillMeta(entry.phase, entry.fillSide, entry.fillPhase);
  const initialStopCoverage = Number.isFinite(entry.initialStopCoverageQuantity)
    ? Math.max(0, entry.initialStopCoverageQuantity ?? 0)
    : entry.phase === 't1'
      ? Math.max(0, entry.remainingBeforeOrder ?? 0)
      : 0;

  pollQueue.set(entry.orderId, {
    ...entry,
    fillSide: resolvedFillMeta.side,
    fillPhase: resolvedFillMeta.phase,
    placedAt: Date.now(),
    pollCount: 0,
    lastRecordedFillQty: 0,
    activeStopOrderId: entry.activeStopOrderId ?? null,
    stopCoverageQuantity: initialStopCoverage,
  });

  ensurePollerRunning();
}

function ensurePollerRunning(): void {
  if (pollIntervalHandle) return;
  pollIntervalHandle = setInterval(pollCycle, POLL_INTERVAL_MS);
  if (typeof pollIntervalHandle.unref === 'function') {
    pollIntervalHandle.unref();
  }
}

/**
 * Stop the polling loop. Call on shutdown.
 */
export function stopOrderPoller(): void {
  if (pollIntervalHandle) {
    clearInterval(pollIntervalHandle);
    pollIntervalHandle = null;
  }
}

async function pollCycle(): Promise<void> {
  if (pollQueue.size === 0) {
    stopOrderPoller();
    return;
  }

  const entries = Array.from(pollQueue.entries());
  for (const [orderId, entry] of entries) {
    try {
      await pollSingleOrder(orderId, entry);
    } catch (error) {
      logger.warn('Order poll cycle error', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      entry.pollCount++;
      if (entry.pollCount >= MAX_POLL_COUNT) {
        logger.error('Order poll max count exceeded; removing from queue', { orderId });
        pollQueue.delete(orderId);
      }
    }
  }
}

async function pollSingleOrder(orderId: string, entry: PollEntry): Promise<void> {
  entry.pollCount++;

  const status = await entry.tradier.getOrderStatus(orderId);
  const terminalStatuses = ['filled', 'expired', 'canceled', 'cancelled', 'rejected'];
  const isTerminal = terminalStatuses.includes(status.status);

  if (status.status === 'filled') {
    await recordFillDelta(entry, status);
    // Full fill
    pollQueue.delete(orderId);
    logger.info('Order filled', {
      orderId,
      userId: entry.userId,
      setupId: entry.setupId,
      filledQty: status.filledQuantity,
      avgPrice: status.avgFillPrice,
      phase: entry.phase,
    });

    if (entry.phase === 'entry') {
      await updateExecutionState(entry.userId, entry.setupId, entry.sessionDate, {
        actualFillQty: status.filledQuantity,
        avgFillPrice: status.avgFillPrice,
        status: 'filled',
        remainingQuantity: status.filledQuantity,
      }).catch(() => undefined);
    } else if (entry.phase === 'runner_stop') {
      await closeExecutionState(entry.userId, entry.setupId, entry.sessionDate, 'stop').catch(() => undefined);
    }
    return;
  }

  if (status.status === 'partially_filled') {
    await recordFillDelta(entry, status);
    logger.info('Order partially filled', {
      orderId,
      userId: entry.userId,
      filledQty: status.filledQuantity,
      remainingQty: status.remainingQuantity,
    });

    if (entry.phase === 'entry') {
      await updateExecutionState(entry.userId, entry.setupId, entry.sessionDate, {
        actualFillQty: status.filledQuantity,
        avgFillPrice: status.avgFillPrice,
        status: 'partial_fill',
        remainingQuantity: status.filledQuantity,
      }).catch(() => undefined);
    } else if (entry.phase === 'runner_stop') {
      const remainingAfterStopFill = Math.max(0, entry.totalQuantity - status.filledQuantity);
      await updateExecutionState(entry.userId, entry.setupId, entry.sessionDate, {
        remainingQuantity: remainingAfterStopFill,
        status: remainingAfterStopFill > 0 ? 'partial_fill' : 'filled',
      }).catch(() => undefined);
    }
    // Keep polling for remaining fill
    return;
  }

  if (status.status === 'rejected') {
    pollQueue.delete(orderId);
    logger.warn('Order rejected', { orderId, userId: entry.userId, setupId: entry.setupId });

    await markStateFailed(entry.userId, entry.setupId, entry.sessionDate, 'rejected');

    publishCoachMessage({
      userId: entry.userId,
      generatedAt: new Date().toISOString(),
      source: 'broker_execution',
      message: {
        id: `tradier_rejected_${entry.userId}_${orderId}`,
        type: 'alert',
        priority: 'alert',
        setupId: entry.setupId,
        timestamp: new Date().toISOString(),
        content: `Order ${orderId} was rejected by Tradier. No position opened for setup ${entry.setupId}.`,
        structuredData: {
          source: 'tradier_execution',
          orderId,
          status: 'rejected',
        },
      },
    });
    return;
  }

  if (status.status === 'canceled' || status.status === 'cancelled' || status.status === 'expired') {
    pollQueue.delete(orderId);
    logger.info('Order cancelled/expired', { orderId, status: status.status });
    return;
  }

  // Still pending - check timeout
  const age = Date.now() - entry.placedAt;
  if (age > MAX_PENDING_AGE_MS && entry.phase === 'entry') {
    logger.warn('Order pending timeout; cancelling', { orderId, ageMs: age });
    try {
      await entry.tradier.cancelOrder(orderId);
    } catch {
      // May already be filled
    }
    pollQueue.delete(orderId);
    await markStateFailed(entry.userId, entry.setupId, entry.sessionDate, 'expired');

    publishCoachMessage({
      userId: entry.userId,
      generatedAt: new Date().toISOString(),
      source: 'broker_execution',
      message: {
        id: `tradier_timeout_${entry.userId}_${orderId}`,
        type: 'alert',
        priority: 'alert',
        setupId: entry.setupId,
        timestamp: new Date().toISOString(),
        content: `Order ${orderId} timed out after ${Math.round(age / 1000)}s without fill. Cancelled.`,
        structuredData: {
          source: 'tradier_execution',
          orderId,
          status: 'timeout',
        },
      },
    });
  }

  if (isTerminal) {
    pollQueue.delete(orderId);
  }
}

async function recordFillDelta(
  entry: PollEntry,
  status: {
    filledQuantity: number;
    avgFillPrice: number;
  },
): Promise<void> {
  if (!entry.fillSide || !entry.fillPhase) return;

  const cumulativeFilledQty = Math.max(0, status.filledQuantity);
  const deltaQty = Math.max(0, cumulativeFilledQty - entry.lastRecordedFillQty);
  if (deltaQty <= 0) return;

  const fillPrice = Number.isFinite(status.avgFillPrice) && status.avgFillPrice > 0
    ? status.avgFillPrice
    : entry.referencePrice;
  if (!fillPrice || !Number.isFinite(fillPrice) || fillPrice <= 0) {
    logger.warn('Order lifecycle: unable to resolve fill price for broker fill record', {
      orderId: entry.orderId,
      userId: entry.userId,
      setupId: entry.setupId,
      cumulativeFilledQty,
      lastRecordedFillQty: entry.lastRecordedFillQty,
    });
    entry.lastRecordedFillQty = cumulativeFilledQty;
    return;
  }

  try {
    await recordExecutionFill({
      setupId: entry.setupId,
      side: entry.fillSide,
      phase: entry.fillPhase,
      source: 'broker_tradier',
      fillPrice,
      fillQuantity: deltaQty,
      executedAt: new Date().toISOString(),
      transitionEventId: entry.transitionEventId,
      brokerOrderId: entry.orderId,
      userId: entry.userId,
      direction: entry.direction,
      metadata: {
        source: 'order_status_poll',
        cumulativeFilledQty,
        priorRecordedFillQty: entry.lastRecordedFillQty,
        referencePrice: entry.referencePrice ?? null,
      },
    });
  } catch (error) {
    logger.warn('Order lifecycle: failed to record broker fill delta', {
      orderId: entry.orderId,
      userId: entry.userId,
      setupId: entry.setupId,
      deltaQty,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (entry.phase === 'entry') {
    await ensureEntryProtectiveStopCoverage(entry, cumulativeFilledQty);
  }
  if (entry.phase === 't1') {
    await ensureT1RunnerStopCoverage(entry, cumulativeFilledQty);
  }
  entry.lastRecordedFillQty = cumulativeFilledQty;
}

/**
 * Get current poll queue size (for monitoring).
 */
export function getOrderPollQueueSize(): number {
  return pollQueue.size;
}

export function resetOrderPollerState(): void {
  pollQueue.clear();
  stopOrderPoller();
}

export async function pollOrderLifecycleQueueOnceForTests(): Promise<void> {
  await pollCycle();
}

async function ensureEntryProtectiveStopCoverage(
  entry: PollEntry,
  cumulativeFilledQty: number,
): Promise<void> {
  if (entry.phase !== 'entry') return;
  if (!entry.symbol) return;
  if (!Number.isFinite(entry.protectiveStopPrice) || (entry.protectiveStopPrice ?? 0) <= 0) return;
  if (cumulativeFilledQty <= 0) return;
  if (cumulativeFilledQty <= entry.stopCoverageQuantity) return;

  try {
    if (entry.activeStopOrderId) {
      await entry.tradier.cancelOrder(entry.activeStopOrderId).catch(() => false);
    }

    const stopOrder = await entry.tradier.placeOrder(buildTradierRunnerStopOrder({
      symbol: entry.symbol,
      quantity: cumulativeFilledQty,
      stopPrice: entry.protectiveStopPrice!,
      tag: `spx:${entry.setupId}:${entry.sessionDate}:entry_stop`,
    }));

    entry.activeStopOrderId = stopOrder.id;
    entry.stopCoverageQuantity = cumulativeFilledQty;

    await updateExecutionState(entry.userId, entry.setupId, entry.sessionDate, {
      runnerStopOrderId: stopOrder.id,
    }).catch(() => undefined);
  } catch (error) {
    logger.warn('Order lifecycle: failed to attach/update entry protective stop', {
      orderId: entry.orderId,
      userId: entry.userId,
      setupId: entry.setupId,
      cumulativeFilledQty,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function ensureT1RunnerStopCoverage(
  entry: PollEntry,
  cumulativeFilledQty: number,
): Promise<void> {
  if (entry.phase !== 't1') return;
  if (!entry.symbol) return;
  if (!Number.isFinite(entry.postFillStopPrice) || (entry.postFillStopPrice ?? 0) <= 0) return;
  const startingRemaining = Math.max(0, entry.remainingBeforeOrder ?? 0);
  if (startingRemaining <= 0) return;

  const boundedFilledQty = Math.min(startingRemaining, Math.max(0, cumulativeFilledQty));
  const nextRemaining = Math.max(0, startingRemaining - boundedFilledQty);
  if (nextRemaining === entry.stopCoverageQuantity) return;

  try {
    if (entry.activeStopOrderId) {
      await entry.tradier.cancelOrder(entry.activeStopOrderId).catch(() => false);
      entry.activeStopOrderId = null;
    }

    if (nextRemaining > 0) {
      const runnerStopOrder = await entry.tradier.placeOrder(buildTradierRunnerStopOrder({
        symbol: entry.symbol,
        quantity: nextRemaining,
        stopPrice: entry.postFillStopPrice!,
        tag: `spx:${entry.setupId}:${entry.sessionDate}:runner_stop`,
      }));
      entry.activeStopOrderId = runnerStopOrder.id;
    }

    entry.stopCoverageQuantity = nextRemaining;
    await updateExecutionState(entry.userId, entry.setupId, entry.sessionDate, {
      remainingQuantity: nextRemaining,
      runnerStopOrderId: entry.activeStopOrderId ?? null,
    }).catch(() => undefined);
  } catch (error) {
    logger.warn('Order lifecycle: failed to update T1 runner stop coverage', {
      orderId: entry.orderId,
      userId: entry.userId,
      setupId: entry.setupId,
      cumulativeFilledQty,
      startingRemaining,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function resolveFillMeta(
  pollPhase: PollEntry['phase'],
  side?: ExecutionFillSide,
  phase?: ExecutionTransitionPhase,
): { side: ExecutionFillSide | undefined; phase: ExecutionTransitionPhase | undefined } {
  if (side && phase) {
    return { side, phase };
  }

  if (pollPhase === 'entry') {
    return { side: 'entry', phase: 'triggered' };
  }
  if (pollPhase === 't1') {
    return { side: 'partial', phase: 'target1_hit' };
  }
  if (pollPhase === 'terminal') {
    return { side: 'exit', phase: 'target2_hit' };
  }
  if (pollPhase === 'runner_stop') {
    return { side: 'exit', phase: 'invalidated' };
  }

  return { side: undefined, phase: undefined };
}
