import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateServerSupabaseClient } = vi.hoisted(() => ({
  mockCreateServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: (...args: unknown[]) =>
    mockCreateServerSupabaseClient(...args),
}))

import { proxyMarketGet } from '@/app/api/market/_proxy'

function buildServerClient(accessToken: string | null) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: accessToken ? { access_token: accessToken } : null,
        },
      }),
    },
  }
}

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('proxyMarketGet auth recovery', () => {
  const previousApiBase = process.env.AI_COACH_API_URL

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AI_COACH_API_URL = 'https://backend.example.com'
  })

  afterAll(() => {
    if (previousApiBase == null) delete process.env.AI_COACH_API_URL
    else process.env.AI_COACH_API_URL = previousApiBase

    vi.unstubAllGlobals()
  })

  it('retries with the server session token after a stale bearer token is rejected', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient('fresh-session-token'))

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ quotes: [{ symbol: 'SPY' }] }, 200))

    vi.stubGlobal('fetch', fetchMock)

    const response = await proxyMarketGet(
      new Request('https://app.example.com/api/market/indices', {
        headers: {
          Authorization: 'Bearer stale-browser-token',
        },
      }),
      'indices',
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [firstUrl, firstOptions] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(firstUrl).toBe('https://backend.example.com/api/market/indices')
    expect(firstOptions.headers).toMatchObject({
      Authorization: 'Bearer stale-browser-token',
      'Content-Type': 'application/json',
    })

    const [secondUrl, secondOptions] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(secondUrl).toBe('https://backend.example.com/api/market/indices')
    expect(secondOptions.headers).toMatchObject({
      Authorization: 'Bearer fresh-session-token',
      'Content-Type': 'application/json',
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ quotes: [{ symbol: 'SPY' }] })
  })
})
