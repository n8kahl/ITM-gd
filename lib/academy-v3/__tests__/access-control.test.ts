import { describe, expect, it, vi } from 'vitest'
import {
  AcademyAccessError,
  assertMembersAreaRoleAccess,
  assertModuleContentAccess,
  ensureProgramEnrollment,
} from '@/lib/academy-v3/access-control'
import { DISCORD_PRIVILEGED_ROLE_ID } from '@/lib/discord-role-access'

function createMaybeSingleChain(result: { data: any; error: any }) {
  const chain: any = {}
  chain.eq = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => result)
  return chain
}

describe('academy-v3 access control', () => {
  it('allows access when cached Discord profile contains a members-allowed role', async () => {
    const profileChain = createMaybeSingleChain({
      data: { discord_roles: [DISCORD_PRIVILEGED_ROLE_ID] },
      error: null,
    })

    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'user_discord_profiles') {
          return {
            select: vi.fn(() => profileChain),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    const roleIds = await assertMembersAreaRoleAccess({
      user: { id: 'user-1', app_metadata: {}, user_metadata: {} } as any,
      supabase,
    })

    expect(roleIds).toContain(DISCORD_PRIVILEGED_ROLE_ID)
  })

  it('rejects access when user has no members-allowed Discord roles', async () => {
    const profileChain = createMaybeSingleChain({
      data: { discord_roles: ['non-member-role'] },
      error: null,
    })

    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'user_discord_profiles') {
          return {
            select: vi.fn(() => profileChain),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    await expect(
      assertMembersAreaRoleAccess({
        user: { id: 'user-1', app_metadata: {}, user_metadata: {} } as any,
        supabase,
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'MEMBERS_ROLE_REQUIRED',
    } satisfies Partial<AcademyAccessError>)
  })

  it('creates enrollment when missing', async () => {
    const enrollmentSelectChain = createMaybeSingleChain({
      data: null,
      error: null,
    })
    const insertMock = vi.fn(async () => ({ error: null }))

    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'academy_user_enrollments') {
          return {
            select: vi.fn(() => enrollmentSelectChain),
            insert: insertMock,
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    await ensureProgramEnrollment({
      supabase,
      userId: '00000000-0000-4000-8000-000000000001',
      programId: '10000000-0000-4000-8000-000000000001',
    })

    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(insertMock.mock.calls[0]?.[0]).toMatchObject({
      status: 'active',
      metadata: { source: 'academy_v3_auto_enroll' },
    })
  })

  it('reactivates enrollment when status is not active/completed', async () => {
    const enrollmentSelectChain = createMaybeSingleChain({
      data: { id: 'enrollment-1', status: 'paused' },
      error: null,
    })
    const updateEqMock = vi.fn(async () => ({ error: null }))
    const updateMock = vi.fn(() => ({
      eq: updateEqMock,
    }))

    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'academy_user_enrollments') {
          return {
            select: vi.fn(() => enrollmentSelectChain),
            update: updateMock,
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    await ensureProgramEnrollment({
      supabase,
      userId: '00000000-0000-4000-8000-000000000001',
      programId: '10000000-0000-4000-8000-000000000001',
    })

    expect(updateMock).toHaveBeenCalledWith({ status: 'active' })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'enrollment-1')
  })

  it('enforces module-required Discord role from metadata', async () => {
    const moduleChain = createMaybeSingleChain({
      data: {
        id: 'module-1',
        track_id: 'track-1',
        is_published: true,
        metadata: { discord_role_required: 'role-pro-required' },
      },
      error: null,
    })
    const trackChain = createMaybeSingleChain({
      data: { program_id: 'program-1' },
      error: null,
    })
    const enrollmentChain = createMaybeSingleChain({
      data: { id: 'enrollment-1', status: 'active' },
      error: null,
    })

    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'academy_modules') {
          return {
            select: vi.fn(() => moduleChain),
          }
        }
        if (table === 'academy_tracks') {
          return {
            select: vi.fn(() => trackChain),
          }
        }
        if (table === 'academy_user_enrollments') {
          return {
            select: vi.fn(() => enrollmentChain),
            update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
            insert: vi.fn(async () => ({ error: null })),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    await expect(
      assertModuleContentAccess({
        supabase,
        userId: '00000000-0000-4000-8000-000000000001',
        roleIds: [DISCORD_PRIVILEGED_ROLE_ID],
        moduleSlug: 'module-slug',
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'MODULE_ROLE_REQUIRED',
      details: { required_role_id: 'role-pro-required' },
    } satisfies Partial<AcademyAccessError>)
  })
})
