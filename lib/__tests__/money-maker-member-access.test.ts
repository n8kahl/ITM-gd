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

type TestUser = {
  id: string
}

function buildServerClient({
  user,
  authError = null,
}: {
  user: TestUser | null
  authError?: Error | null
}) {
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
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ user: null }))

    const denied = await authorizeMoneyMakerMemberRequest()

    expect(denied).not.toBeNull()
    expect(denied?.status).toBe(401)
    expect(await denied?.json()).toEqual({ success: false, error: 'Unauthorized' })
    expect(denied?.headers.get('cache-control')).toBe('no-store')
    expect(mockEvaluateMemberAccess).not.toHaveBeenCalled()
  })

  it('allows admin users', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ user: { id: 'admin-1' } }))
    mockEvaluateMemberAccess.mockResolvedValue({
      isAdmin: true,
      allowedTabs: [],
    })

    const denied = await authorizeMoneyMakerMemberRequest()

    expect(denied).toBeNull()
    expect(mockEvaluateMemberAccess).toHaveBeenCalledWith({}, { userId: 'admin-1' })
  })

  it('allows users with the money-maker tab', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ user: { id: 'member-1' } }))
    mockEvaluateMemberAccess.mockResolvedValue({
      isAdmin: false,
      allowedTabs: ['money-maker'],
    })

    const denied = await authorizeMoneyMakerMemberRequest()

    expect(denied).toBeNull()
  })

  it('returns 403 when canonical access denies the tab', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ user: { id: 'member-1' } }))
    mockEvaluateMemberAccess.mockResolvedValue({
      isAdmin: false,
      allowedTabs: ['journal'],
    })

    const denied = await authorizeMoneyMakerMemberRequest()

    expect(denied).not.toBeNull()
    expect(denied?.status).toBe(403)
    expect(await denied?.json()).toEqual({
      success: false,
      error: 'Forbidden',
    })
    expect(denied?.headers.get('cache-control')).toBe('no-store')
  })

  it('returns 500 when the service-role client is unavailable', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ user: { id: 'member-1' } }))
    mockCreateServiceRoleSupabaseClient.mockReturnValue(null)

    const denied = await authorizeMoneyMakerMemberRequest()

    expect(denied).not.toBeNull()
    expect(denied?.status).toBe(500)
    expect(await denied?.json()).toEqual({
      success: false,
      error: 'Access control unavailable',
    })
  })
})
