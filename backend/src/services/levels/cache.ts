import { cacheSet, cacheGet, cacheDelete } from '../../config/redis';

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  // Daily levels (PDH, pivots) - cache for 24 hours
  DAILY_LEVELS: 24 * 60 * 60, // 86400 seconds

  // VWAP - cache for 1 minute (updates frequently)
  VWAP: 60, // 60 seconds

  // Pre-market levels - cache until market open (9:30 AM)
  PREMARKET: 5 * 60, // 5 minutes

  // ATR - cache for 1 hour (doesn't change much intraday)
  ATR: 60 * 60, // 3600 seconds

  // Full levels response - cache for 5 minutes (Phase 3.7 target)
  LEVELS: 300 // 300 seconds
};

/**
 * Generate cache key for levels data
 */
export function generateLevelsCacheKey(symbol: string, timeframe: string): string {
  return `levels:${symbol}:${timeframe}`;
}

/**
 * Cache levels data
 */
export async function cacheLevels(
  symbol: string,
  timeframe: string,
  data: any,
  ttl: number = CACHE_TTL.LEVELS
): Promise<void> {
  const key = generateLevelsCacheKey(symbol, timeframe);
  await cacheSet(key, data, ttl);
}

/**
 * Get cached levels data
 */
export async function getCachedLevels(
  symbol: string,
  timeframe: string
): Promise<any | null> {
  const key = generateLevelsCacheKey(symbol, timeframe);
  return await cacheGet(key);
}

/**
 * Invalidate cache for specific symbol/timeframe
 */
export async function invalidateLevelsCache(
  symbol: string,
  timeframe: string
): Promise<void> {
  const key = generateLevelsCacheKey(symbol, timeframe);
  await cacheDelete(key);
}

/**
 * Generate cache key for VWAP
 */
export function generateVWAPCacheKey(symbol: string, date: string): string {
  return `vwap:${symbol}:${date}`;
}

/**
 * Cache VWAP data
 */
export async function cacheVWAP(symbol: string, date: string, vwap: number): Promise<void> {
  const key = generateVWAPCacheKey(symbol, date);
  await cacheSet(key, { vwap, timestamp: Date.now() }, CACHE_TTL.VWAP);
}

/**
 * Get cached VWAP
 */
export async function getCachedVWAP(symbol: string, date: string): Promise<number | null> {
  const key = generateVWAPCacheKey(symbol, date);
  const data = await cacheGet(key);
  return data?.vwap || null;
}

/**
 * Generate cache key for ATR
 */
export function generateATRCacheKey(symbol: string, period: number): string {
  return `atr:${symbol}:${period}`;
}

/**
 * Cache ATR data
 */
export async function cacheATR(symbol: string, period: number, atr: number): Promise<void> {
  const key = generateATRCacheKey(symbol, period);
  await cacheSet(key, { atr, timestamp: Date.now() }, CACHE_TTL.ATR);
}

/**
 * Get cached ATR
 */
export async function getCachedATR(symbol: string, period: number): Promise<number | null> {
  const key = generateATRCacheKey(symbol, period);
  const data = await cacheGet(key);
  return data?.atr || null;
}

/**
 * Add metadata about caching to the response
 */
export function addCacheMetadata(data: any, cached: boolean, ttl: number): any {
  return {
    ...data,
    cached,
    cacheExpiresAt: cached ? new Date(Date.now() + ttl * 1000).toISOString() : null,
    timestamp: new Date().toISOString()
  };
}
