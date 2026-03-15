import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { authorizeMoneyMakerMemberRequest } from '@/app/api/members/money-maker/_access'

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

describe('authorizeMoneyMakerMemberRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when the request is unauthenticated', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient(null))

    const denied = await authorizeMoneyMakerMemberRequest()

    expect(denied).not.toBeNull()
    expect(denied?.status).toBe(401)
    expect(await denied?.json()).toEqual({ success: false, error: 'Unauthorized' })
    expect(denied?.headers.get('cache-control')).toBe('no-store')
  })

  it('allows admin users', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ id: 'admin-1' }))
    mockIsAdminUser.mockResolvedValue(true)

    const denied = await authorizeMoneyMakerMemberRequest()

    expect(denied).toBeNull()
    expect(mockIsAdminUser).toHaveBeenCalledTimes(1)
  })

  it('returns 403 for authenticated non-admin users', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ id: 'member-1' }))
    mockIsAdminUser.mockResolvedValue(false)

    const denied = await authorizeMoneyMakerMemberRequest()

    expect(denied).not.toBeNull()
    expect(denied?.status).toBe(403)
    expect(await denied?.json()).toEqual({ success: false, error: 'Forbidden' })
    expect(denied?.headers.get('cache-control')).toBe('no-store')
  })
})
