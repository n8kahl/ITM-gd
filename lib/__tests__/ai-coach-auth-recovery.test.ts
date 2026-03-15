import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRefreshBrowserAccessToken } = vi.hoisted(() => ({
  mockRefreshBrowserAccessToken: vi.fn(),
}))

vi.mock('@/lib/browser-auth', () => ({
  refreshBrowserAccessToken: (...args: unknown[]) =>
    mockRefreshBrowserAccessToken(...args),
}))

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('AI coach browser auth recovery', () => {
  const previousApiBase = process.env.NEXT_PUBLIC_AI_COACH_API_URL

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_AI_COACH_API_URL = 'https://itm-gd-production.up.railway.app'
    vi.stubGlobal('window', {
      location: {
        hostname: 'members.example.com',
      },
    })
  })

  afterAll(() => {
    if (previousApiBase == null) delete process.env.NEXT_PUBLIC_AI_COACH_API_URL
    else process.env.NEXT_PUBLIC_AI_COACH_API_URL = previousApiBase

    vi.unstubAllGlobals()
  })

  it('refreshes the session token instead of retrying the direct backend on proxy 401', async () => {
    mockRefreshBrowserAccessToken.mockResolvedValue('fresh-token')

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({
        symbol: 'TSLA',
        timeframe: '5m',
        bars: [],
        count: 0,
        timestamp: '2026-03-15T00:00:00.000Z',
        cached: false,
      }, 200))

    vi.stubGlobal('fetch', fetchMock)

    const { getChartData } = await import('@/lib/api/ai-coach')
    const payload = await getChartData('TSLA', '5m', 'stale-token')

    expect(payload.symbol).toBe('TSLA')
    expect(mockRefreshBrowserAccessToken).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const calls = fetchMock.mock.calls.map(([url, options]) => ({
      url: String(url),
      options: options as RequestInit,
    }))

    expect(calls[0]?.url).toBe('/api/ai-coach-proxy/chart/TSLA?timeframe=5m')
    expect(calls[0]?.options.headers).toMatchObject({
      Authorization: 'Bearer stale-token',
    })

    expect(calls[1]?.url).toBe('/api/ai-coach-proxy/chart/TSLA?timeframe=5m')
    expect(calls[1]?.options.headers).toMatchObject({
      Authorization: 'Bearer fresh-token',
    })

    expect(
      calls.some(({ url }) => url.startsWith('https://itm-gd-production.up.railway.app/api/chart/')),
    ).toBe(false)
  })
})
