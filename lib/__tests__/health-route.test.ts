import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { GET } from '@/app/api/health/route'

function buildSupabaseClient(error: { message: string } | null = null) {
  const limit = vi.fn().mockResolvedValue({ error })
  const select = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ select })

  return { from }
}

describe('/api/health route', () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const previousVersion = process.env.npm_package_version

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.npm_package_version = '1.2.3'
  })

  afterAll(() => {
    if (previousUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl

    if (previousAnonKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey

    if (previousVersion == null) delete process.env.npm_package_version
    else process.env.npm_package_version = previousVersion
  })

  it('returns 200 with ok status when supabase is reachable', async () => {
    mockCreateClient.mockReturnValue(buildSupabaseClient())

    const response = await GET(new Request('https://example.com/api/health'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      status: 'ok',
      version: '1.2.3',
      checks: {
        app: { status: 'up' },
        supabase: { status: 'up' },
      },
    })
  })

  it('returns 200 with degraded status for the default liveness probe when supabase is down', async () => {
    mockCreateClient.mockReturnValue(buildSupabaseClient({ message: 'connection failed' }))

    const response = await GET(new Request('https://example.com/api/health'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      status: 'degraded',
      checks: {
        supabase: {
          status: 'down',
          message: 'connection failed',
        },
      },
    })
  })

  it('returns 503 for strict readiness probes when supabase is down', async () => {
    mockCreateClient.mockReturnValue(buildSupabaseClient({ message: 'connection failed' }))

    const response = await GET(new Request('https://example.com/api/health?strict=1'))
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toMatchObject({
      status: 'degraded',
      checks: {
        supabase: {
          status: 'down',
          message: 'connection failed',
        },
      },
    })
  })

  it('reports missing supabase env as degraded without failing liveness', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const response = await GET(new Request('https://example.com/api/health'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(payload).toMatchObject({
      status: 'degraded',
      checks: {
        supabase: {
          status: 'down',
          message: 'Missing Supabase environment configuration',
        },
      },
    })
  })
})
