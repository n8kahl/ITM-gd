import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DISCORD_MEMBERS_ROLE_ID,
  DISCORD_PRIVILEGED_ROLE_ID,
  clearMembersAllowedRoleIdsCache,
  getDefaultMembersAllowedRoleIds,
  hasMembersAreaAccess,
  resolveMembersAllowedRoleIds,
} from '@/lib/discord-role-access'

describe('discord-role-access members role resolver', () => {
  const originalEnv = process.env.DISCORD_MEMBERS_ALLOWED_ROLE_IDS

  beforeEach(() => {
    delete process.env.DISCORD_MEMBERS_ALLOWED_ROLE_IDS
    clearMembersAllowedRoleIdsCache()
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DISCORD_MEMBERS_ALLOWED_ROLE_IDS
    } else {
      process.env.DISCORD_MEMBERS_ALLOWED_ROLE_IDS = originalEnv
    }
    clearMembersAllowedRoleIdsCache()
  })

  it('uses default members role IDs when env override is absent', () => {
    expect(getDefaultMembersAllowedRoleIds()).toEqual([
      DISCORD_MEMBERS_ROLE_ID,
      DISCORD_PRIVILEGED_ROLE_ID,
    ])
  })

  it('parses env override as comma-separated role IDs', () => {
    process.env.DISCORD_MEMBERS_ALLOWED_ROLE_IDS = '11111111111111111, 22222222222222222'

    expect(getDefaultMembersAllowedRoleIds()).toEqual([
      '11111111111111111',
      '22222222222222222',
    ])
  })

  it('resolves members role IDs from access_control_settings', async () => {
    const supabase: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                members_allowed_role_ids: ['33333333333333333', '44444444444444444'],
              },
              error: null,
            }),
          }),
        }),
      }),
    }

    await expect(resolveMembersAllowedRoleIds({ supabase })).resolves.toEqual([
      '33333333333333333',
      '44444444444444444',
    ])
  })

  it('falls back to defaults when access_control_settings is empty', async () => {
    const supabase: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                members_allowed_role_ids: [],
              },
              error: null,
            }),
          }),
        }),
      }),
    }

    await expect(resolveMembersAllowedRoleIds({ supabase })).resolves.toEqual([
      DISCORD_MEMBERS_ROLE_ID,
      DISCORD_PRIVILEGED_ROLE_ID,
    ])
  })

  it('falls back to defaults when settings lookup fails', async () => {
    const supabase: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: { message: 'permission denied' },
            }),
          }),
        }),
      }),
    }

    await expect(resolveMembersAllowedRoleIds({ supabase })).resolves.toEqual([
      DISCORD_MEMBERS_ROLE_ID,
      DISCORD_PRIVILEGED_ROLE_ID,
    ])
  })

  it('checks membership access against resolved allowed roles', () => {
    expect(hasMembersAreaAccess(['role-a', 'role-b'], ['role-c', 'role-b'])).toBe(true)
    expect(hasMembersAreaAccess(['role-a'], ['role-c', 'role-b'])).toBe(false)
  })
})
