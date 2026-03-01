import { cacheGet, cacheSet, redisClient } from '../../../config/redis';
import {
  __testables,
  readSharedSnapshot,
  releaseSnapshotBuildLock,
  tryAcquireSnapshotBuildLock,
  waitForSharedSnapshot,
  writeSharedSnapshot,
} from '../snapshotCoordination';

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
  redisClient: {
    isOpen: true,
    set: jest.fn(),
    eval: jest.fn(),
  },
}));

const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockRedisClient = redisClient as unknown as {
  isOpen: boolean;
  set: jest.Mock;
  eval: jest.Mock;
};
const mockRedisSet = mockRedisClient.set;
const mockRedisEval = mockRedisClient.eval;

describe('spx/snapshotCoordination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.isOpen = true;
  });

  it('reads and writes shared snapshot via redis cache helpers', async () => {
    const snapshot = { generatedAt: '2026-03-01T15:00:00.000Z', setups: [] } as any;
    mockCacheGet.mockResolvedValue(snapshot);
    mockCacheSet.mockResolvedValue(undefined as never);

    await writeSharedSnapshot(snapshot);
    const loaded = await readSharedSnapshot();

    expect(mockCacheSet).toHaveBeenCalledWith(
      __testables.SNAPSHOT_SHARED_CACHE_KEY,
      snapshot,
      __testables.SNAPSHOT_SHARED_CACHE_TTL_SECONDS,
    );
    expect(loaded).toBe(snapshot);
  });

  it('acquires lock when redis SET NX succeeds', async () => {
    mockRedisSet.mockResolvedValue('OK' as never);

    const ownerToken = await tryAcquireSnapshotBuildLock();

    expect(typeof ownerToken).toBe('string');
    expect(ownerToken).not.toBeNull();
    expect(mockRedisSet).toHaveBeenCalledWith(
      __testables.SNAPSHOT_BUILD_LOCK_KEY,
      expect.any(String),
      expect.objectContaining({
        NX: true,
        EX: __testables.SNAPSHOT_BUILD_LOCK_TTL_SECONDS,
      }),
    );
  });

  it('returns null lock owner when redis is unavailable or lock held', async () => {
    mockRedisClient.isOpen = false;
    await expect(tryAcquireSnapshotBuildLock()).resolves.toBeNull();

    mockRedisClient.isOpen = true;
    mockRedisSet.mockResolvedValue(null as never);
    await expect(tryAcquireSnapshotBuildLock()).resolves.toBeNull();
  });

  it('releases lock only for the current owner token', async () => {
    mockRedisEval.mockResolvedValue(1 as never);

    await releaseSnapshotBuildLock('owner-token-1');

    expect(mockRedisEval).toHaveBeenCalledWith(
      __testables.RELEASE_LOCK_IF_OWNER_SCRIPT,
      expect.objectContaining({
        keys: [__testables.SNAPSHOT_BUILD_LOCK_KEY],
        arguments: ['owner-token-1'],
      }),
    );
  });

  it('waits for a shared snapshot to appear while another instance builds', async () => {
    const snapshot = { generatedAt: '2026-03-01T15:00:00.000Z', setups: [] } as any;
    mockCacheGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(snapshot);

    const waited = await waitForSharedSnapshot({
      timeoutMs: 120,
      pollMs: 20,
    });

    expect(waited).toBe(snapshot);
    expect(mockCacheGet).toHaveBeenCalledTimes(3);
  });
});
