import { describe, expect, it, vi, beforeEach } from 'vitest'

const {
  mockCreateServerSupabaseClient,
  mockIsAdminUser,
} = vi.hoisted(() => ({
  mockCreateServerSupabaseClient: vi.fn(),
  mockIsAdminUser: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: (...args: unknown[]) =>
    mockCreateServerSupabaseClient(...args),
  isAdminUser: (...args: unknown[]) => mockIsAdminUser(...args),
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

describe('GET /api/members/admin-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 unauthorized with no-store when user is missing', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient(null))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ success: false, error: 'Unauthorized' })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mockIsAdminUser).not.toHaveBeenCalled()
  })

  it('returns success true and isAdmin true when admin resolver returns true', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ id: 'user-admin' }))
    mockIsAdminUser.mockResolvedValue(true)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, isAdmin: true })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mockIsAdminUser).toHaveBeenCalledTimes(1)
  })

  it('returns success true and isAdmin false when admin resolver returns false', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ id: 'user-member' }))
    mockIsAdminUser.mockResolvedValue(false)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, isAdmin: false })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mockIsAdminUser).toHaveBeenCalledTimes(1)
  })

  it('fails closed with warning when admin resolver throws', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ id: 'user-1' }))
    mockIsAdminUser.mockRejectedValue(new Error('admin resolution failed'))

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
