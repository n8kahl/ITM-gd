import { logger } from '../../../lib/logger';
import { publishCoachMessage } from '../../coachPushChannel';
import {
  updateExecutionState,
  markStateFailed,
} from '../../spx/executionStateStore';
import { TradierClient } from './client';

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
}): void {
  pollQueue.set(entry.orderId, {
    ...entry,
    placedAt: Date.now(),
    pollCount: 0,
  });

  ensurePollerRunning();
}

function ensurePollerRunning(): void {
  if (pollIntervalHandle) return;
  pollIntervalHandle = setInterval(pollCycle, POLL_INTERVAL_MS);
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
    }
    return;
  }

  if (status.status === 'partially_filled') {
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

/**
 * Get current poll queue size (for monitoring).
 */
export function getOrderPollQueueSize(): number {
  return pollQueue.size;
}
