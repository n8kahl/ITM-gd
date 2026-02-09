/**
 * Setup Push Worker (V2 Scaffolding)
 *
 * Purpose:
 * - Establish production-safe timing controls for future setup push delivery.
 * - Monitor active tracked setups and publish heartbeat telemetry.
 * - Provide lifecycle hooks (start/stop) so deployment can validate worker stability
 *   before enabling full detection and push logic.
 */

import { supabase } from '../config/database';
import { logger } from '../lib/logger';
import { getMarketStatus } from '../services/marketHours';
import { publishSetupPushHeartbeat } from '../services/setupPushChannel';

interface ActiveTrackedSetupRow {
  id: string;
  user_id: string;
  symbol: string;
  setup_type: string;
  tracked_at: string;
}

export const SETUP_PUSH_POLL_INTERVAL_MARKET_OPEN = 15_000; // 15 seconds
export const SETUP_PUSH_POLL_INTERVAL_MARKET_CLOSED = 60_000; // 60 seconds
export const SETUP_PUSH_INITIAL_DELAY = 15_000; // 15 seconds
const SETUP_PUSH_FETCH_LIMIT = 200;

let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

export function getSetupPushPollingInterval(): number {
  const status = getMarketStatus();
  if (status.status === 'open' || status.status === 'pre-market' || status.status === 'after-hours') {
    return SETUP_PUSH_POLL_INTERVAL_MARKET_OPEN;
  }
  return SETUP_PUSH_POLL_INTERVAL_MARKET_CLOSED;
}

async function pollTrackedSetups(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('ai_coach_tracked_setups')
      .select('id, user_id, symbol, setup_type, tracked_at')
      .eq('status', 'active')
      .limit(SETUP_PUSH_FETCH_LIMIT);

    if (error) {
      logger.error('Setup push worker: failed to fetch tracked setups', {
        error: error.message,
        code: (error as any).code,
      });
      return;
    }

    const rows = (data || []) as ActiveTrackedSetupRow[];
    const uniqueUsers = new Set(rows.map((row) => row.user_id)).size;

    publishSetupPushHeartbeat({
      generatedAt: new Date().toISOString(),
      activeSetupCount: rows.length,
      uniqueUsers,
    });

    logger.debug('Setup push worker heartbeat', {
      activeSetupCount: rows.length,
      uniqueUsers,
    });
  } catch (error) {
    logger.error('Setup push worker: poll cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runCycle(): Promise<void> {
  if (!isRunning) return;

  await pollTrackedSetups();
  pollingTimer = setTimeout(runCycle, getSetupPushPollingInterval());
}

export function startSetupPushWorker(): void {
  if (isRunning) {
    logger.warn('Setup push worker is already running');
    return;
  }

  isRunning = true;
  logger.info('Setup push worker started');
  pollingTimer = setTimeout(runCycle, SETUP_PUSH_INITIAL_DELAY);
}

export function stopSetupPushWorker(): void {
  isRunning = false;

  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }

  logger.info('Setup push worker stopped');
}
