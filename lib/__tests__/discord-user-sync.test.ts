import { describe, expect, it } from 'vitest'
import {
  buildDiscordAvatarUrl,
  buildSyncedAppMetadata,
  buildSyncedUserMetadata,
  resolveDiscordUserIdFromAuthUser,
} from '@/lib/discord-user-sync'

describe('discord-user-sync helpers', () => {
  it('resolves discord user id from direct user metadata first', () => {
    const user = {
      user_metadata: {
        provider_id: '1234567890',
      },
      identities: [
        {
          provider: 'discord',
          identity_data: { provider_id: 'should-not-win' },
        },
      ],
    }

    expect(resolveDiscordUserIdFromAuthUser(user)).toBe('1234567890')
  })

  it('falls back to identities when user metadata does not include discord id', () => {
    const user = {
      user_metadata: {},
      app_metadata: {},
      identities: [
        {
          provider: 'discord',
          identity_data: {
            provider_id: '999888777',
          },
        },
      ],
    }

    expect(resolveDiscordUserIdFromAuthUser(user)).toBe('999888777')
  })

  it('merges app metadata with synced discord claims', () => {
    const appMetadata = buildSyncedAppMetadata({
      existingAppMetadata: { existing_flag: true },
      discordRoles: ['r2', 'r1', 'r1'],
      isAdmin: true,
      isMember: true,
      discordUserId: '555',
      discordUsername: 'Trader',
      discordAvatar: 'hash',
    })

    expect(appMetadata).toMatchObject({
      existing_flag: true,
      is_admin: true,
      is_member: true,
      discord_user_id: '555',
      discord_username: 'Trader',
      discord_avatar: 'hash',
      discord_roles: ['r2', 'r1'],
    })
  })

  it('merges user metadata with discord identity fields', () => {
    const userMetadata = buildSyncedUserMetadata({
      existingUserMetadata: { full_name: 'Nate' },
      discordRoles: ['role-1', 'role-1'],
      discordUserId: '321',
      discordUsername: 'TraderNate',
      discordAvatar: 'abc123',
    })

    expect(userMetadata).toMatchObject({
      full_name: 'Nate',
      provider_id: '321',
      sub: '321',
      discord_user_id: '321',
      discord_username: 'TraderNate',
      discord_avatar: 'abc123',
      discord_avatar_url: 'https://cdn.discordapp.com/avatars/321/abc123.png',
      discord_roles: ['role-1'],
    })
  })

  it('returns null avatar url when user id or avatar hash is missing', () => {
    expect(buildDiscordAvatarUrl(null, 'hash')).toBeNull()
    expect(buildDiscordAvatarUrl('123', null)).toBeNull()
  })
})
