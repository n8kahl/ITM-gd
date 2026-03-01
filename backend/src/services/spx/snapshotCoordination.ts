import { cacheGet, cacheSet, redisClient } from '../../config/redis';
import { logger } from '../../lib/logger';
import type { SPXSnapshot } from './types';

const SNAPSHOT_SHARED_CACHE_KEY = 'spx_command_center:snapshot:shared:v1';
const SNAPSHOT_SHARED_CACHE_TTL_SECONDS = 20;
const SNAPSHOT_BUILD_LOCK_KEY = 'spx_command_center:snapshot:build:lock:v1';
const SNAPSHOT_BUILD_LOCK_TTL_SECONDS = 15;
const SNAPSHOT_BUILD_LOCK_WAIT_TIMEOUT_MS = 1_800;
const SNAPSHOT_BUILD_LOCK_WAIT_POLL_MS = 120;

const RELEASE_LOCK_IF_OWNER_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

function canUseDistributedCoordination(): boolean {
  return Boolean(redisClient?.isOpen);
}

export async function readSharedSnapshot(): Promise<SPXSnapshot | null> {
  return cacheGet<SPXSnapshot>(SNAPSHOT_SHARED_CACHE_KEY);
}

export async function writeSharedSnapshot(snapshot: SPXSnapshot): Promise<void> {
  await cacheSet(SNAPSHOT_SHARED_CACHE_KEY, snapshot, SNAPSHOT_SHARED_CACHE_TTL_SECONDS);
}

export async function tryAcquireSnapshotBuildLock(): Promise<string | null> {
  if (!canUseDistributedCoordination()) return null;

  const ownerToken = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  try {
    const result = await redisClient!.set(SNAPSHOT_BUILD_LOCK_KEY, ownerToken, {
      NX: true,
      EX: SNAPSHOT_BUILD_LOCK_TTL_SECONDS,
    });
    return result === 'OK' ? ownerToken : null;
  } catch (error) {
    logger.warn('SPX snapshot build lock acquisition failed', {
      lockKey: SNAPSHOT_BUILD_LOCK_KEY,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function releaseSnapshotBuildLock(ownerToken: string | null): Promise<void> {
  if (!ownerToken || !canUseDistributedCoordination()) return;

  try {
    await redisClient!.eval(RELEASE_LOCK_IF_OWNER_SCRIPT, {
      keys: [SNAPSHOT_BUILD_LOCK_KEY],
      arguments: [ownerToken],
    });
  } catch (error) {
    logger.warn('SPX snapshot build lock release failed', {
      lockKey: SNAPSHOT_BUILD_LOCK_KEY,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForSharedSnapshot(options?: {
  timeoutMs?: number;
  pollMs?: number;
}): Promise<SPXSnapshot | null> {
  const timeoutMs = Math.max(0, options?.timeoutMs ?? SNAPSHOT_BUILD_LOCK_WAIT_TIMEOUT_MS);
  const pollMs = Math.max(20, options?.pollMs ?? SNAPSHOT_BUILD_LOCK_WAIT_POLL_MS);

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const shared = await readSharedSnapshot();
    if (shared) return shared;
    await sleep(pollMs);
  }
  return null;
}

export const __testables = {
  SNAPSHOT_SHARED_CACHE_KEY,
  SNAPSHOT_SHARED_CACHE_TTL_SECONDS,
  SNAPSHOT_BUILD_LOCK_KEY,
  SNAPSHOT_BUILD_LOCK_TTL_SECONDS,
  SNAPSHOT_BUILD_LOCK_WAIT_TIMEOUT_MS,
  SNAPSHOT_BUILD_LOCK_WAIT_POLL_MS,
  RELEASE_LOCK_IF_OWNER_SCRIPT,
  canUseDistributedCoordination,
};

