import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateServerSupabaseClient,
  mockCreateServiceRoleSupabaseClient,
  mockEvaluateMemberAccess,
} = vi.hoisted(() => ({
  mockCreateServerSupabaseClient: vi.fn(),
  mockCreateServiceRoleSupabaseClient: vi.fn(),
  mockEvaluateMemberAccess: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: (...args: unknown[]) =>
    mockCreateServerSupabaseClient(...args),
}))

vi.mock('@/lib/server-supabase', () => ({
  createServiceRoleSupabaseClient: (...args: unknown[]) =>
    mockCreateServiceRoleSupabaseClient(...args),
}))

vi.mock('@/lib/access-control/evaluate-member-access', () => ({
  evaluateMemberAccess: (...args: unknown[]) => mockEvaluateMemberAccess(...args),
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
    mockCreateServiceRoleSupabaseClient.mockReturnValue({} as never)
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
    mockEvaluateMemberAccess.mockResolvedValue({
      isAdmin: true,
      allowedTabs: [],
    })

    const denied = await authorizeMoneyMakerMemberRequest()

    expect(denied).toBeNull()
    expect(mockEvaluateMemberAccess).toHaveBeenCalledWith({}, { userId: 'admin-1' })
  })

  it('returns 403 for authenticated users without the tab', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ id: 'member-1' }))
    mockEvaluateMemberAccess.mockResolvedValue({
      isAdmin: false,
      allowedTabs: ['dashboard'],
    })

    const denied = await authorizeMoneyMakerMemberRequest()

    expect(denied).not.toBeNull()
    expect(denied?.status).toBe(403)
    expect(await denied?.json()).toEqual({ success: false, error: 'Forbidden' })
    expect(denied?.headers.get('cache-control')).toBe('no-store')
  })
})
