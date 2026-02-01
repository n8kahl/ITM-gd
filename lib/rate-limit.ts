/**
 * Simple in-memory rate limiting for API routes
 * For production, consider using Redis or a distributed rate limiter
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store (per-server instance)
const store = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key)
    }
  }
}, 60000) // Clean every minute

interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  limit: number
  /** Time window in milliseconds */
  windowMs: number
  /** Identifier for the rate limit (e.g., 'admin-login', 'discord-sync') */
  identifier: string
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Check and update rate limit for a given key
 * @param key - Unique key for the rate limit (e.g., IP address, user ID)
 * @param options - Rate limit configuration
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { limit, windowMs, identifier } = options
  const fullKey = `${identifier}:${key}`
  const now = Date.now()

  let entry = store.get(fullKey)

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    }
    store.set(fullKey, entry)
    return {
      success: true,
      remaining: limit - 1,
      resetAt: entry.resetAt,
    }
  }

  // Increment count
  entry.count++

  // Check if over limit
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
} as const
