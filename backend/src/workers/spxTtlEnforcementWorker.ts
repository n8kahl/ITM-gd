import { cacheGet, cacheSet } from '../config/redis';
import { logger } from '../lib/logger';
import type { Setup } from '../services/spx/types';

/**
 * SPX TTL Enforcement Worker
 *
 * Runs every 30 seconds and checks all cached setups for TTL expiration.
 * This is necessary because TTL enforcement normally only fires during
 * detectActiveSetups() API calls. If no one polls after market close,
 * triggered setups with expired TTLs linger indefinitely.
 *
 * Addresses audit CRITICAL-1: "TTL expiration only fires when
 * detectActiveSetups() is called."
 */

const SETUPS_CACHE_KEY = 'spx_command_center:setups';
const POLL_INTERVAL_MS = 30_000;

const ACTIVE_STATUSES = new Set<Setup['status']>(['forming', 'ready', 'triggered']);

// Default TTLs (matching setupDetector defaults)
const DEFAULT_TTL_FORMING_MS = 30 * 60_000;   // 30 minutes
const DEFAULT_TTL_READY_MS = 90 * 60_000;     // 90 minutes
const DEFAULT_TTL_TRIGGERED_MS = 90 * 60_000; // 90 minutes

let intervalHandle: ReturnType<typeof setInterval> | null = null;

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getTtlMsForStatus(status: Setup['status']): number | null {
  if (status === 'forming') {
    return parseIntEnv(process.env.SPX_SETUP_TTL_FORMING_MS, DEFAULT_TTL_FORMING_MS);
  }
  if (status === 'ready') {
    return parseIntEnv(process.env.SPX_SETUP_TTL_READY_MS, DEFAULT_TTL_READY_MS);
  }
  if (status === 'triggered') {
    return parseIntEnv(process.env.SPX_SETUP_TTL_TRIGGERED_MS, DEFAULT_TTL_TRIGGERED_MS);
  }
  return null;
}

function isExpiredByTtl(setup: Setup, nowMs: number): boolean {
  // If ttlExpiresAt is already set, use it directly
  if (setup.ttlExpiresAt) {
    const expiresAtMs = new Date(setup.ttlExpiresAt).getTime();
    return Number.isFinite(expiresAtMs) && nowMs > expiresAtMs;
  }

  // Otherwise compute from statusUpdatedAt + TTL for the status
  const ttlMs = getTtlMsForStatus(setup.status);
  if (!ttlMs) return false;

  const statusAnchor = setup.statusUpdatedAt || setup.createdAt;
  if (!statusAnchor) return false;

  const anchorMs = new Date(statusAnchor).getTime();
  if (!Number.isFinite(anchorMs)) return false;

  return nowMs > anchorMs + ttlMs;
}

export async function enforceSetupTtls(): Promise<{
  expiredCount: number;
  setupIds: string[];
}> {
  const result = { expiredCount: 0, setupIds: [] as string[] };

  try {
    const cachedSetups = await cacheGet<Setup[]>(SETUPS_CACHE_KEY);
    if (!cachedSetups || cachedSetups.length === 0) return result;

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    let modified = false;

    const updatedSetups = cachedSetups.map((setup) => {
      if (!ACTIVE_STATUSES.has(setup.status)) return setup;
      if (!isExpiredByTtl(setup, nowMs)) return setup;

      modified = true;
      result.expiredCount++;
      result.setupIds.push(setup.id);

      const nextStatus: Setup['status'] = setup.status === 'triggered'
        ? 'invalidated'
        : 'expired';

      return {
        ...setup,
        status: nextStatus,
        invalidationReason: nextStatus === 'invalidated' ? 'ttl_expired' as const : null,
        statusUpdatedAt: nowIso,
        ttlExpiresAt: null,
      };
    });

    if (modified) {
      await cacheSet(SETUPS_CACHE_KEY, updatedSetups, 60);
      logger.info('SPX TTL enforcement: expired stale setups', {
        count: result.expiredCount,
        setupIds: result.setupIds,
      });
    }
  } catch (error) {
    logger.error('SPX TTL enforcement failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

async function checkTtls(): Promise<void> {
  try {
    await enforceSetupTtls();
  } catch (error) {
    logger.error('SPX TTL enforcement check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startSpxTtlEnforcementWorker(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(checkTtls, POLL_INTERVAL_MS);
  logger.info('SPX TTL enforcement worker started', {
    pollIntervalMs: POLL_INTERVAL_MS,
  });
}

export function stopSpxTtlEnforcementWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('SPX TTL enforcement worker stopped');
  }
}
