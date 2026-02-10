import { supabase } from '../config/database';
import { logger } from '../lib/logger';

const ANALYTICS_REFRESH_DEBOUNCE_MS = 5000;

const pendingUserIds = new Set<string>();
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight = false;

function scheduleRefresh(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(() => {
    void flushAnalyticsRefreshQueue();
  }, ANALYTICS_REFRESH_DEBOUNCE_MS);

  refreshTimer.unref?.();
}

async function flushAnalyticsRefreshQueue(): Promise<void> {
  refreshTimer = null;

  if (pendingUserIds.size === 0) {
    return;
  }

  if (refreshInFlight) {
    scheduleRefresh();
    return;
  }

  const queuedUsers = Array.from(pendingUserIds);
  pendingUserIds.clear();
  refreshInFlight = true;

  try {
    const { error } = await supabase.rpc('refresh_journal_analytics_cache');
    if (error) {
      throw new Error(error.message);
    }

    logger.info('Journal analytics cache refreshed', {
      queuedUserCount: queuedUsers.length,
    });
  } catch (error) {
    logger.error('Failed to refresh journal analytics cache', {
      queuedUserCount: queuedUsers.length,
      error: error instanceof Error ? error.message : String(error),
    });

    for (const userId of queuedUsers) {
      pendingUserIds.add(userId);
    }
  } finally {
    refreshInFlight = false;
    if (pendingUserIds.size > 0) {
      scheduleRefresh();
    }
  }
}

/**
 * Enqueue a materialized-view refresh after journal writes.
 * Jobs are debounced for 5s and deduplicated by userId.
 */
export function enqueueAnalyticsRefresh(userId: string): void {
  if (!userId) return;
  pendingUserIds.add(userId);
  scheduleRefresh();
}
