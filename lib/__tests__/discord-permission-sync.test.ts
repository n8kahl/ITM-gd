import { describe, expect, it, vi } from 'vitest'
import { recomputeUsersForRoleIds } from '@/lib/discord-permission-sync'
import { DISCORD_MEMBERS_ROLE_ID, DISCORD_PRIVILEGED_ROLE_ID } from '@/lib/discord-role-access'

type MockInput = {
  profiles: Array<{
    user_id: string
    discord_user_id: string | null
    discord_roles: string[]
  }>
  rolePermissionRows: any[]
  membersRequiredRoleIds?: string[]
  pricingTierRows?: any[]
  appPermissionRows?: any[]
}

function createSupabaseAdminMock(input: MockInput) {
  const membersRequiredRoleIds = input.membersRequiredRoleIds || [
    DISCORD_MEMBERS_ROLE_ID,
    DISCORD_PRIVILEGED_ROLE_ID,
  ]

  const overlapsMock = vi.fn(async () => ({
    data: input.profiles,
    error: null,
  }))
  const rolePermissionInMock = vi.fn(async () => ({
    data: input.rolePermissionRows,
    error: null,
  }))
  const appPermissionInMock = vi.fn(async () => ({
    data: input.appPermissionRows || [],
    error: null,
  }))

  const deleteEqResult: any = {
    not: vi.fn(async () => ({ error: null })),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ error: null }).then(resolve),
  }
  const deleteMock = vi.fn(() => ({
    eq: vi.fn(() => deleteEqResult),
  }))
  const upsertMock = vi.fn(async () => ({ error: null }))

  const getUserByIdMock = vi.fn(async (userId: string) => ({
    data: { user: { id: userId, app_metadata: { existing_flag: true } } },
    error: null,
  }))
  const updateUserByIdMock = vi.fn(async () => ({ error: null }))

  const supabaseAdmin: any = {
    from: vi.fn((table: string) => {
      if (table === 'user_discord_profiles') {
        return {
          select: vi.fn(() => ({
            overlaps: overlapsMock,
          })),
        }
      }

      if (table === 'discord_role_permissions') {
        return {
          select: vi.fn(() => ({
            in: rolePermissionInMock,
          })),
        }
      }

      if (table === 'user_permissions') {
        return {
          upsert: upsertMock,
          delete: deleteMock,
        }
      }

      if (table === 'app_settings') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [{ key: 'members_required_role_ids', value: JSON.stringify(membersRequiredRoleIds) }],
              error: null,
            })),
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: null,
                error: null,
              })),
            })),
          })),
        }
      }

      if (table === 'pricing_tiers') {
        const chain: any = {
          order: vi.fn(async () => ({
            data: input.pricingTierRows || [],
            error: null,
          })),
        }
        return {
          select: vi.fn(() => chain),
        }
      }

      if (table === 'app_permissions') {
        return {
          select: vi.fn(() => ({
            in: appPermissionInMock,
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
    auth: {
      admin: {
        getUserById: getUserByIdMock,
        updateUserById: updateUserByIdMock,
      },
    },
  }

  return {
    supabaseAdmin,
    overlapsMock,
    rolePermissionInMock,
    deleteMock,
    upsertMock,
    getUserByIdMock,
    updateUserByIdMock,
  }
}

describe('recomputeUsersForRoleIds', () => {
  it('sets is_member=false for non-membership roles even when admin permission is granted', async () => {
    const permissionId = '11111111-1111-4111-8111-111111111111'
    const { supabaseAdmin, updateUserByIdMock, upsertMock } = createSupabaseAdminMock({
      profiles: [
        {
          user_id: '00000000-0000-4000-8000-000000000001',
          discord_user_id: 'discord-1',
          discord_roles: ['role-admin-only'],
        },
      ],
      rolePermissionRows: [
        {
          discord_role_id: 'role-admin-only',
          discord_role_name: 'Admin Role',
          permission_id: permissionId,
          app_permissions: {
            id: permissionId,
            name: 'admin_dashboard',
            description: null,
          },
        },
      ],
    })

    const result = await recomputeUsersForRoleIds({
      supabaseAdmin,
      roleIds: ['role-admin-only'],
    })

    expect(result).toMatchObject({
      processed: 1,
      failed: 0,
      affectedUserIds: ['00000000-0000-4000-8000-000000000001'],
      errors: [],
    })
    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(updateUserByIdMock).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          is_admin: true,
          is_member: false,
          discord_roles: ['role-admin-only'],
        }),
      }),
    )
  })

  it('sets is_member=true when user has privileged members role even with zero permissions', async () => {
    const { supabaseAdmin, updateUserByIdMock, deleteMock } = createSupabaseAdminMock({
      profiles: [
        {
          user_id: '00000000-0000-4000-8000-000000000002',
          discord_user_id: 'discord-2',
          discord_roles: [DISCORD_PRIVILEGED_ROLE_ID],
        },
      ],
      rolePermissionRows: [],
    })

    const result = await recomputeUsersForRoleIds({
      supabaseAdmin,
      roleIds: [DISCORD_PRIVILEGED_ROLE_ID],
    })

    expect(result.processed).toBe(1)
    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(updateUserByIdMock).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000002',
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          is_admin: false,
          is_member: true,
          discord_roles: [DISCORD_PRIVILEGED_ROLE_ID],
        }),
      }),
    )
  })

  it('applies tier-based permission fallback when explicit role mappings are missing', async () => {
    const corePermissionRows = [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', name: 'access_core_content' },
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', name: 'access_trading_journal' },
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', name: 'access_course_library' },
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', name: 'access_live_alerts' },
    ]

    const { supabaseAdmin, upsertMock, updateUserByIdMock } = createSupabaseAdminMock({
      profiles: [
        {
          user_id: '00000000-0000-4000-8000-000000000003',
          discord_user_id: 'discord-3',
          discord_roles: ['role-core'],
        },
      ],
      rolePermissionRows: [],
      membersRequiredRoleIds: ['role-core'],
      pricingTierRows: [
        { id: 'core', discord_role_id: 'role-core' },
      ],
      appPermissionRows: corePermissionRows,
    })

    const result = await recomputeUsersForRoleIds({
      supabaseAdmin,
      roleIds: ['role-core'],
    })

    expect(result.processed).toBe(1)
    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(upsertMock.mock.calls[0][0]).toHaveLength(corePermissionRows.length)
    expect(updateUserByIdMock).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000003',
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          discord_roles: ['role-core'],
        }),
      }),
    )
  })
})
