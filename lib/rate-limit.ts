import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Redis-backed rate limiting (Upstash) with in-memory fallback for local development.
 * Production MUST set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  limit: number
  /** Time window in milliseconds */
  windowMs: number
  /** Identifier for the rate limit (e.g., 'admin-login', 'discord-sync') */
  identifier: string
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

// In-memory fallback store (per-server instance)
const memoryStore = new Map<string, RateLimitEntry>()

// Clean expired in-memory entries periodically.
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt < now) {
      memoryStore.delete(key)
    }
  }
}, 60_000)
cleanupTimer.unref?.()

let redisClient: Redis | null = null
const ratelimiterCache = new Map<string, Ratelimit>()
let hasLoggedRedisFallback = false

function hasUpstashConfig(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return redisClient
}

function toUpstashWindow(windowMs: number): `${number} s` {
  const seconds = Math.max(1, Math.ceil(windowMs / 1000))
  return `${seconds} s`
}

function normalizeResetTimestamp(reset: number, fallbackWindowMs: number): number {
  if (!Number.isFinite(reset) || reset <= 0) {
    return Date.now() + fallbackWindowMs
  }
  // Upstash returns epoch milliseconds in most runtimes; convert seconds if needed.
  if (reset < 10_000_000_000) {
    return reset * 1000
  }
  return reset
}

function getRatelimiter(options: RateLimitOptions): Ratelimit {
  const cacheKey = `${options.identifier}:${options.limit}:${options.windowMs}`
  const existing = ratelimiterCache.get(cacheKey)
  if (existing) return existing

  const limiter = new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.fixedWindow(options.limit, toUpstashWindow(options.windowMs)),
    prefix: `ratelimit:${options.identifier}`,
    analytics: false,
  })

  ratelimiterCache.set(cacheKey, limiter)
  return limiter
}

function checkRateLimitInMemory(key: string, options: RateLimitOptions): RateLimitResult {
  const { limit, windowMs, identifier } = options
  const fullKey = `${identifier}:${key}`
  const now = Date.now()

  let entry = memoryStore.get(fullKey)

  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + windowMs }
    memoryStore.set(fullKey, entry)
    return {
      success: true,
      remaining: limit - 1,
      resetAt: entry.resetAt,
    }
  }

  entry.count++

  if (entry.count > limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  return {
    success: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Check and update rate limit for a given key.
 * @param key - Unique key for the rate limit (e.g., IP address, user ID)
 * @param options - Rate limit configuration
 */
export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  if (!hasUpstashConfig()) {
    return checkRateLimitInMemory(key, options)
  }

  try {
    const result = await getRatelimiter(options).limit(key)
    return {
      success: result.success,
      remaining: Math.max(0, result.remaining),
      resetAt: normalizeResetTimestamp(result.reset, options.windowMs),
    }
  } catch (error) {
    if (!hasLoggedRedisFallback) {
      hasLoggedRedisFallback = true
      console.warn('[rate-limit] Upstash unavailable, falling back to in-memory limiter.', error)
    }
    return checkRateLimitInMemory(key, options)
  }
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback (won't work in production behind proxy)
  return 'unknown'
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  adminLogin: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 5 attempts per 15 minutes
    identifier: 'admin-login',
  },
  discordSync: {
    limit: 10,
    windowMs: 60 * 1000, // 10 syncs per minute
    identifier: 'discord-sync',
  },
  apiGeneral: {
    limit: 100,
    windowMs: 60 * 1000, // 100 requests per minute
    identifier: 'api-general',
  },
  analyzeScreenshot: {
    limit: 10,
    windowMs: 60 * 60 * 1000, // 10 analyses per hour
    identifier: 'analyze-screenshot',
  },
} as const
