/**
 * Background Alert Worker
 *
 * Periodically polls Massive.com for current prices and evaluates active alerts.
 * When an alert condition is met, the alert is marked as triggered in the database.
 *
 * Polling intervals:
 *   - During market hours (regular + extended): every 2 minutes
 *   - Market closed: every 15 minutes (catch up on pre/post-market moves)
 *
 * The worker groups alerts by symbol to minimize API calls and respects
 * Massive.com rate limits by processing symbols sequentially.
 */

import { logger } from '../lib/logger';
import { supabase } from '../config/database';
import { getMinuteAggregates, getDailyAggregates } from '../config/massive';
import { getMarketStatus } from '../services/marketHours';
import {
  markWorkerCycleFailed,
  markWorkerCycleStarted,
  markWorkerCycleSucceeded,
  markWorkerNextRun,
  markWorkerStarted,
  markWorkerStopped,
  registerWorker,
} from '../services/workerHealth';

// ============================================
// TYPES
// ============================================

interface ActiveAlert {
  id: string;
  user_id: string;
  symbol: string;
  alert_type: 'price_above' | 'price_below' | 'level_approach' | 'level_break' | 'volume_spike';
  target_value: number;
  notification_channels: string[];
  expires_at: string | null;
  notes: string | null;
}

interface PriceData {
  currentPrice: number;
  volume: number;
  avgVolume: number;
}

// ============================================
// CONFIGURATION
// ============================================

const POLL_INTERVAL_MARKET_OPEN = 2 * 60 * 1000;   // 2 minutes
const POLL_INTERVAL_MARKET_CLOSED = 15 * 60 * 1000; // 15 minutes
const LEVEL_APPROACH_THRESHOLD = 0.005;              // 0.5% proximity threshold
const VOLUME_SPIKE_MULTIPLIER = 2.0;                 // 2x average volume = spike
const WORKER_NAME = 'alert_worker';

// Symbols that get index prefix for Massive.com API
const INDEX_SYMBOLS = new Set(['SPX', 'NDX', 'DJI', 'RUT']);
registerWorker(WORKER_NAME);

function formatTicker(symbol: string): string {
  return INDEX_SYMBOLS.has(symbol) ? `I:${symbol}` : symbol;
}

// ============================================
// PRICE FETCHING
// ============================================

async function fetchCurrentPrice(symbol: string): Promise<PriceData | null> {
  try {
    const ticker = formatTicker(symbol);
    const today = new Date().toISOString().split('T')[0];

    // Try intraday data first
    const minuteData = await getMinuteAggregates(ticker, today);

    if (minuteData.length > 0) {
      const lastBar = minuteData[minuteData.length - 1];
      // Calculate average volume from available bars
      const totalVolume = minuteData.reduce((sum, bar) => sum + bar.v, 0);
      const avgVolume = totalVolume / minuteData.length;

      return {
        currentPrice: lastBar.c,
        volume: lastBar.v,
        avgVolume,
      };
    }

    // Fallback to daily data
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const dailyData = await getDailyAggregates(ticker, yesterday, today);

    if (dailyData.length > 0) {
      const lastBar = dailyData[dailyData.length - 1];
      return {
        currentPrice: lastBar.c,
        volume: lastBar.v,
        avgVolume: lastBar.v, // single bar, no average
      };
    }

    return null;
  } catch (error) {
    logger.error(`Alert worker: failed to fetch price for ${symbol}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================
// ALERT EVALUATION
// ============================================

function evaluateAlert(alert: ActiveAlert, priceData: PriceData): boolean {
  const { currentPrice, volume, avgVolume } = priceData;

  switch (alert.alert_type) {
    case 'price_above':
      return currentPrice > alert.target_value;

    case 'price_below':
      return currentPrice < alert.target_value;

    case 'level_approach':
      return Math.abs(currentPrice - alert.target_value) / alert.target_value < LEVEL_APPROACH_THRESHOLD;

    case 'level_break':
      // Price has crossed the target level (above or below)
      return Math.abs(currentPrice - alert.target_value) / alert.target_value < 0.001; // within 0.1%

    case 'volume_spike':
      return avgVolume > 0 && volume / avgVolume >= VOLUME_SPIKE_MULTIPLIER;

    default:
      return false;
  }
}

// ============================================
// TRIGGER ALERT
// ============================================

async function triggerAlert(alert: ActiveAlert, priceData: PriceData): Promise<void> {
  try {
    const { error } = await supabase
      .from('ai_coach_alerts')
      .update({
        status: 'triggered',
        condition_met: true,
        triggered_at: new Date().toISOString(),
        notification_sent: true, // In-app notification is the trigger itself
      })
      .eq('id', alert.id);

    if (error) {
      logger.error(`Alert worker: failed to trigger alert ${alert.id}`, { error: error.message });
      return;
    }

    logger.info(`Alert triggered: ${alert.alert_type} on ${alert.symbol}`, {
      alertId: alert.id,
      userId: alert.user_id,
      targetValue: alert.target_value,
      currentPrice: priceData.currentPrice,
      channels: alert.notification_channels,
    });
  } catch (error) {
    logger.error(`Alert worker: error triggering alert ${alert.id}`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================
// MAIN POLLING LOOP
// ============================================

async function pollAlerts(): Promise<void> {
  try {
    // Fetch all active, non-expired alerts
    const { data: alerts, error } = await supabase
      .from('ai_coach_alerts')
      .select('id, user_id, symbol, alert_type, target_value, notification_channels, expires_at, notes')
      .eq('status', 'active')
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    if (error) {
      logger.error('Alert worker: failed to fetch active alerts', { error: error.message });
      return;
    }

    if (!alerts || alerts.length === 0) {
      return; // No active alerts to check
    }

    // Group alerts by symbol to batch API calls
    const alertsBySymbol = new Map<string, ActiveAlert[]>();
    for (const alert of alerts) {
      const existing = alertsBySymbol.get(alert.symbol) || [];
      existing.push(alert as ActiveAlert);
      alertsBySymbol.set(alert.symbol, existing);
    }

    logger.info(`Alert worker: checking ${alerts.length} alerts across ${alertsBySymbol.size} symbols`);

    // Process each symbol sequentially to respect API rate limits
    for (const [symbol, symbolAlerts] of alertsBySymbol) {
      const priceData = await fetchCurrentPrice(symbol);

      if (!priceData) {
        logger.warn(`Alert worker: no price data for ${symbol}, skipping ${symbolAlerts.length} alerts`);
        continue;
      }

      // Evaluate each alert for this symbol
      for (const alert of symbolAlerts) {
        if (evaluateAlert(alert, priceData)) {
          await triggerAlert(alert, priceData);
        }
      }
    }
  } catch (error) {
    logger.error('Alert worker: poll cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================
// WORKER LIFECYCLE
// ============================================

let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

function getPollingInterval(): number {
  const status = getMarketStatus();
  // Poll more frequently during market hours (including extended hours)
  if (status.status === 'open' || status.status === 'pre-market' || status.status === 'after-hours') {
    return POLL_INTERVAL_MARKET_OPEN;
  }
  return POLL_INTERVAL_MARKET_CLOSED;
}

async function runCycle(): Promise<void> {
  if (!isRunning) return;

  const cycleStartedAt = markWorkerCycleStarted(WORKER_NAME);
  try {
    await pollAlerts();
    markWorkerCycleSucceeded(WORKER_NAME, cycleStartedAt);
  } catch (error) {
    markWorkerCycleFailed(WORKER_NAME, cycleStartedAt, error);
    logger.error('Alert worker: cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Schedule next cycle with adaptive interval
  const interval = getPollingInterval();
  markWorkerNextRun(WORKER_NAME, interval);
  pollingTimer = setTimeout(runCycle, interval);
}

/**
 * Start the background alert worker.
 * Called from server.ts during startup.
 */
export function startAlertWorker(): void {
  if (isRunning) {
    logger.warn('Alert worker is already running');
    return;
  }

  isRunning = true;
  markWorkerStarted(WORKER_NAME);
  logger.info('Alert worker started');

  // Initial delay of 10 seconds to let the server fully initialize
  markWorkerNextRun(WORKER_NAME, 10_000);
  pollingTimer = setTimeout(runCycle, 10_000);
}

/**
 * Stop the background alert worker.
 * Called during graceful shutdown.
 */
export function stopAlertWorker(): void {
  isRunning = false;
  markWorkerStopped(WORKER_NAME);
  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }
  logger.info('Alert worker stopped');
}
