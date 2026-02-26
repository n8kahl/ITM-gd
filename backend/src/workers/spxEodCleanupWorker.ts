import { cacheGet, cacheSet, cacheDel } from '../config/redis';
import { logger } from '../lib/logger';
import { toEasternTime } from '../services/marketHours';
import type { Setup } from '../services/spx/types';

/**
 * SPX End-of-Day Cleanup Worker
 *
 * Runs every 30 seconds and checks if it's 4:01 PM ET (minute 961).
 * At that time, it invalidates all active setups (forming/ready/triggered)
 * with reason 'market_closed'. This prevents zombie setups from persisting
 * overnight and confusing next-day trading.
 *
 * Also supports early close days (1:01 PM ET, minute 781).
 */

const SETUPS_CACHE_KEY = 'spx_command_center:setups';
const EOD_RAN_KEY = 'spx:eod_cleanup:last_run_date';
const POLL_INTERVAL_MS = 30_000;
const REGULAR_CLOSE_CLEANUP_MINUTE_ET = 16 * 60 + 1; // 4:01 PM ET = 961
const EARLY_CLOSE_CLEANUP_MINUTE_ET = 13 * 60 + 1;   // 1:01 PM ET = 781

const ACTIVE_STATUSES = new Set(['forming', 'ready', 'triggered']);

let intervalHandle: ReturnType<typeof setInterval> | null = null;

function isEarlyCloseDay(): boolean {
  // Could be extended to check market holidays calendar.
  // For now, use env var override.
  return String(process.env.SPX_EARLY_CLOSE_TODAY || 'false').toLowerCase() === 'true';
}

function getCleanupMinuteET(): number {
  return isEarlyCloseDay() ? EARLY_CLOSE_CLEANUP_MINUTE_ET : REGULAR_CLOSE_CLEANUP_MINUTE_ET;
}

async function hasAlreadyRunToday(dateKey: string): Promise<boolean> {
  const lastRun = await cacheGet<string>(EOD_RAN_KEY);
  return lastRun === dateKey;
}

async function markRunComplete(dateKey: string): Promise<void> {
  // TTL of 18 hours covers overnight and well into next trading day
  await cacheSet(EOD_RAN_KEY, dateKey, 18 * 3600);
}

export async function runEodCleanup(): Promise<{
  invalidatedCount: number;
  setupIds: string[];
}> {
  const result = { invalidatedCount: 0, setupIds: [] as string[] };

  try {
    const cachedSetups = await cacheGet<Setup[]>(SETUPS_CACHE_KEY);
    if (!cachedSetups || cachedSetups.length === 0) {
      logger.info('SPX EOD cleanup: no cached setups found, nothing to clean');
      return result;
    }

    const now = new Date().toISOString();
    let modified = false;

    const updatedSetups = cachedSetups.map((setup) => {
      if (ACTIVE_STATUSES.has(setup.status)) {
        modified = true;
        result.invalidatedCount++;
        result.setupIds.push(setup.id);
        return {
          ...setup,
          status: 'invalidated' as const,
          invalidationReason: 'market_closed' as const,
          statusUpdatedAt: now,
          ttlExpiresAt: null,
        };
      }
      return setup;
    });

    if (modified) {
      await cacheSet(SETUPS_CACHE_KEY, updatedSetups, 60);
      logger.info('SPX EOD cleanup: invalidated active setups', {
        count: result.invalidatedCount,
        setupIds: result.setupIds,
      });
    } else {
      logger.info('SPX EOD cleanup: no active setups to invalidate');
    }
  } catch (error) {
    logger.error('SPX EOD cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

async function checkEodCleanup(): Promise<void> {
  try {
    const now = toEasternTime(new Date());
    const currentMinuteET = now.hour * 60 + now.minute;
    const cleanupMinute = getCleanupMinuteET();
    const dateKey = now.dateStr;

    if (currentMinuteET !== cleanupMinute) return;

    const alreadyRan = await hasAlreadyRunToday(dateKey);
    if (alreadyRan) return;

    logger.info('SPX EOD cleanup: triggering market close cleanup', {
      minuteET: currentMinuteET,
      dateKey,
      earlyClose: isEarlyCloseDay(),
    });

    await runEodCleanup();
    await markRunComplete(dateKey);
  } catch (error) {
    logger.error('SPX EOD cleanup check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startSpxEodCleanupWorker(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(checkEodCleanup, POLL_INTERVAL_MS);
  logger.info('SPX EOD cleanup worker started', {
    regularCleanupMinuteET: REGULAR_CLOSE_CLEANUP_MINUTE_ET,
    earlyCleanupMinuteET: EARLY_CLOSE_CLEANUP_MINUTE_ET,
  });
}

export function stopSpxEodCleanupWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('SPX EOD cleanup worker stopped');
  }
}
