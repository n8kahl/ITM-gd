import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateServerSupabaseClient,
  mockCreateClient,
} = vi.hoisted(() => ({
  mockCreateServerSupabaseClient: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: (...args: unknown[]) =>
    mockCreateServerSupabaseClient(...args),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { GET } from '@/app/api/members/admin-status/route'

function buildServerClient(user: { id: string } | null, authError: Error | null = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: authError,
      }),
    },
  }
}

function buildServiceRoleClient(options: {
  role?: string | null
  profileError?: { message: string } | null
  throwOnMaybeSingle?: boolean
}) {
  const maybeSingle = options.throwOnMaybeSingle
    ? vi.fn().mockRejectedValue(new Error('profile lookup threw'))
    : vi.fn().mockResolvedValue({
      data: options.role == null ? null : { role: options.role },
      error: options.profileError ?? null,
    })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  return { from, select, eq, maybeSingle }
}

describe('GET /api/members/admin-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 unauthorized with no-store when user is missing', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient(null))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ success: false, error: 'Unauthorized' })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns success true and isAdmin true for authenticated admin profile', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ id: 'user-admin' }))
    const serviceRoleClient = buildServiceRoleClient({ role: 'admin' })
    mockCreateClient.mockReturnValue(serviceRoleClient as never)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, isAdmin: true })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(serviceRoleClient.from).toHaveBeenCalledWith('profiles')
  })

  it('returns success true and isAdmin false for authenticated non-admin profile', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ id: 'user-member' }))
    const serviceRoleClient = buildServiceRoleClient({ role: 'member' })
    mockCreateClient.mockReturnValue(serviceRoleClient as never)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, isAdmin: false })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('fails closed with warning when service-role env is missing', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ id: 'user-1' }))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      isAdmin: false,
      warning: 'Admin status unavailable.',
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('fails closed with warning when profile lookup returns error', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ id: 'user-2' }))
    const serviceRoleClient = buildServiceRoleClient({
      profileError: { message: 'query failed' },
    })
    mockCreateClient.mockReturnValue(serviceRoleClient as never)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      isAdmin: false,
      warning: 'Admin status unavailable.',
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('fails closed with warning when profile lookup throws', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ id: 'user-3' }))
    const serviceRoleClient = buildServiceRoleClient({
      throwOnMaybeSingle: true,
    })
    mockCreateClient.mockReturnValue(serviceRoleClient as never)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      isAdmin: false,
      warning: 'Admin status unavailable.',
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
