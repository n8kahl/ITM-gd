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

import { authorizeSwingSniperMemberRequest } from '@/app/api/members/swing-sniper/_access'

type TestUser = {
  id: string
  app_metadata?: {
    discord_roles?: unknown
  }
}

function buildServerClient({
  user,
  authError = null,
  profileRoleIds = null,
}: {
  user: TestUser | null
  authError?: Error | null
  profileRoleIds?: unknown
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: profileRoleIds == null
      ? null
      : { discord_roles: profileRoleIds },
  })

  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: authError,
      }),
    },
    from,
  }
}

describe('authorizeSwingSniperMemberRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when the request is unauthenticated', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({ user: null }))

    const denied = await authorizeSwingSniperMemberRequest()

    expect(denied).not.toBeNull()
    expect(denied?.status).toBe(401)
    expect(await denied?.json()).toEqual({ success: false, error: 'Unauthorized' })
    expect(denied?.headers.get('cache-control')).toBe('no-store')
    expect(mockIsAdminUser).not.toHaveBeenCalled()
  })

  it('allows admin users', async () => {
    const client = buildServerClient({ user: { id: 'admin-1' } })
    mockCreateServerSupabaseClient.mockResolvedValue(client)
    mockIsAdminUser.mockResolvedValue(true)

    const denied = await authorizeSwingSniperMemberRequest()

    expect(denied).toBeNull()
    expect(mockIsAdminUser).toHaveBeenCalledTimes(1)
    expect(client.from).not.toHaveBeenCalled()
  })

  it('allows lead users when lead role is present in JWT claims', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({
      user: {
        id: 'lead-jwt',
        app_metadata: {
          discord_roles: ['1465515598640447662'],
        },
      },
    }))
    mockIsAdminUser.mockResolvedValue(false)

    const denied = await authorizeSwingSniperMemberRequest()

    expect(denied).toBeNull()
  })

  it('allows lead users when role is present in user_discord_profiles', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({
      user: { id: 'lead-profile', app_metadata: { discord_roles: [] } },
      profileRoleIds: ['1465515598640447662'],
    }))
    mockIsAdminUser.mockResolvedValue(false)

    const denied = await authorizeSwingSniperMemberRequest()

    expect(denied).toBeNull()
  })

  it('returns 403 for non-admin, non-lead users', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildServerClient({
      user: { id: 'member-1', app_metadata: { discord_roles: ['1471195516070264863'] } },
      profileRoleIds: ['1471195516070264863'],
    }))
    mockIsAdminUser.mockResolvedValue(false)

    const denied = await authorizeSwingSniperMemberRequest()

    expect(denied).not.toBeNull()
    expect(denied?.status).toBe(403)
    expect(await denied?.json()).toEqual({
      success: false,
      error: 'Forbidden',
      message: 'Swing Sniper is restricted to Lead and Admin accounts.',
    })
    expect(denied?.headers.get('cache-control')).toBe('no-store')
  })
})
