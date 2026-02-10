import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalUrl = process.env.UPSTASH_REDIS_REST_URL
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN
const mockLimit = vi.fn()
const mockFixedWindow = vi.fn()
const mockRedisCtor = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    constructor(config: unknown) {
      mockRedisCtor(config)
    }
  },
}))

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class MockRatelimit {
    static fixedWindow(limit: number, window: `${number} s`) {
      return mockFixedWindow(limit, window)
    }

    constructor(_options: unknown) {}

    limit(identifier: string) {
      return mockLimit(identifier)
    }
  },
}))

async function loadRateLimitModule() {
  vi.resetModules()
  return import('@/lib/rate-limit')
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    mockLimit.mockReset()
    mockFixedWindow.mockReset()
    mockRedisCtor.mockReset()
  })

  afterEach(() => {
    if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl
    else delete process.env.UPSTASH_REDIS_REST_URL
    if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken
    else delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  it('uses in-memory limiter when Upstash is not configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const { checkRateLimit, RATE_LIMITS } = await loadRateLimitModule()
    const options = {
      ...RATE_LIMITS.apiGeneral,
      limit: 2,
      windowMs: 60_000,
      identifier: `unit-rate-limit-${Date.now()}`,
    }

    const first = await checkRateLimit('user-1', options)
    const second = await checkRateLimit('user-1', options)
    const third = await checkRateLimit('user-1', options)

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(third.success).toBe(false)
    expect(third.remaining).toBe(0)
  })

  it('uses Upstash limiter when configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    mockLimit.mockResolvedValue({
      success: true,
      remaining: 4,
      reset: 1_700_000_000,
    })

    const { checkRateLimit } = await loadRateLimitModule()
    const result = await checkRateLimit('user-2', {
      limit: 5,
      windowMs: 60_000,
      identifier: 'upstash-unit',
    })

    expect(mockRedisCtor).toHaveBeenCalledTimes(1)
    expect(mockFixedWindow).toHaveBeenCalledWith(5, '60 s')
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
    // reset converted from seconds -> ms
    expect(result.resetAt).toBe(1_700_000_000_000)
  })

  it('falls back to in-memory limiter when Upstash call fails', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    mockLimit.mockRejectedValue(new Error('redis unavailable'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { checkRateLimit } = await loadRateLimitModule()
    const options = {
      limit: 1,
      windowMs: 60_000,
      identifier: `upstash-fallback-${Date.now()}`,
    }

    const first = await checkRateLimit('user-3', options)
    const second = await checkRateLimit('user-3', options)

    expect(first.success).toBe(true)
    expect(second.success).toBe(false)
    warnSpy.mockRestore()
  })
})

describe('getClientIp', () => {
  it('uses x-forwarded-for when present', async () => {
    const { getClientIp } = await loadRateLimitModule()
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIp(request)).toBe('1.2.3.4')
  })

  it('uses x-real-ip when forwarded header is missing', async () => {
    const { getClientIp } = await loadRateLimitModule()
    const request = new Request('https://example.com', {
      headers: { 'x-real-ip': '9.8.7.6' },
    })
    expect(getClientIp(request)).toBe('9.8.7.6')
  })

  it('falls back to unknown when no headers are present', async () => {
    const { getClientIp } = await loadRateLimitModule()
    const request = new Request('https://example.com')
    expect(getClientIp(request)).toBe('unknown')
  })
})
