import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { GET as getHealth } from '@/app/api/health/route'
import { GET as getReadyHealth } from '@/app/api/health/ready/route'

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

  it('returns 200 with ok status for the liveness probe without touching supabase', async () => {
    const response = await getHealth()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(payload).toMatchObject({
      status: 'ok',
      version: '1.2.3',
      checks: {
        app: { status: 'up' },
      },
    })
  })

  it('returns 200 with ok status for liveness even when supabase env is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const response = await getHealth()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(payload).toMatchObject({
      status: 'ok',
      checks: {
        app: { status: 'up' },
      },
    })
  })

  it('returns 200 for the readiness endpoint when supabase is reachable', async () => {
    mockCreateClient.mockReturnValue(buildSupabaseClient())

    const response = await getReadyHealth()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      status: 'ok',
      checks: {
        app: { status: 'up' },
        supabase: { status: 'up' },
      },
    })
  })

  it('returns 503 for the readiness endpoint when supabase is down', async () => {
    mockCreateClient.mockReturnValue(buildSupabaseClient({ message: 'connection failed' }))

    const response = await getReadyHealth()
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

  it('reports missing supabase env as degraded on the readiness endpoint', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const response = await getReadyHealth()
    const payload = await response.json()

    expect(response.status).toBe(503)
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
