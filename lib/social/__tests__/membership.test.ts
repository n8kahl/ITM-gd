import { describe, expect, it, vi } from 'vitest'
import {
  fetchRoleTierMapping,
  getSocialUserMetaMap,
  resolveMembershipTierFromRoles,
} from '@/lib/social/membership'

function createSupabaseMock(config: {
  pricingTierRows?: any[]
  profiles?: any[]
  discordProfiles?: any[]
  guildRoles?: any[]
  permissionRoleRows?: any[]
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'pricing_tiers') {
        const chain: any = {
          order: vi.fn(async () => ({
            data: config.pricingTierRows || [],
            error: null,
          })),
        }
        return {
          select: vi.fn(() => chain),
        }
      }

      if (table === 'member_profiles') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: config.profiles || [],
              error: null,
            })),
          })),
        }
      }

      if (table === 'user_discord_profiles') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: config.discordProfiles || [],
              error: null,
            })),
          })),
        }
      }

      if (table === 'discord_guild_roles') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: config.guildRoles || [],
              error: null,
            })),
          })),
        }
      }

      if (table === 'discord_role_permissions') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: config.permissionRoleRows || [],
              error: null,
            })),
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  } as any
}

describe('social membership metadata', () => {
  it('builds the role tier mapping from pricing_tiers.discord_role_id', async () => {
    const supabase = createSupabaseMock({
      pricingTierRows: [
        { id: 'core', name: 'Core', discord_role_id: 'role_core', is_active: true, display_order: 1 },
        { id: 'pro', name: 'Pro', discord_role_id: 'role_pro', is_active: true, display_order: 2 },
      ],
    })

    const mapping = await fetchRoleTierMapping(supabase)
    expect(mapping).toEqual({
      role_core: 'core',
      role_pro: 'pro',
    })
  })

  it('resolves role titles from guild catalog first, then permission mappings as fallback', async () => {
    const userId = '00000000-0000-4000-8000-000000000001'
    const supabase = createSupabaseMock({
      pricingTierRows: [
        { id: 'pro', name: 'Pro', discord_role_id: 'role_pro', is_active: true, display_order: 2 },
      ],
      profiles: [{ user_id: userId, display_name: 'Nate' }],
      discordProfiles: [{
        user_id: userId,
        discord_user_id: 'discord-user-1',
        discord_username: 'TraderNate',
        discord_avatar: 'avatar.png',
        discord_roles: ['role_member', 'role_pro'],
      }],
      guildRoles: [
        { discord_role_id: 'role_member', discord_role_name: 'Guild Member' },
      ],
      permissionRoleRows: [
        { discord_role_id: 'role_pro', discord_role_name: 'Pro Trader' },
      ],
    })

    const metaMap = await getSocialUserMetaMap(supabase, [userId])
    const meta = metaMap.get(userId)

    expect(meta).toBeDefined()
    expect(meta?.discord_role_titles).toEqual({
      role_member: 'Guild Member',
      role_pro: 'Pro Trader',
    })
    expect(meta?.membership_tier).toBe('pro')
  })

  it('defaults membership tier to core when mapped roles are absent', () => {
    const tier = resolveMembershipTierFromRoles(['unknown_role'], { role_pro: 'pro' })
    expect(tier).toBe('core')
  })
})
