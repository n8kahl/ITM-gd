import type { SupabaseClient } from '@supabase/supabase-js'
import {
  normalizeDiscordRoleIds,
} from '@/lib/access-control/roles'
import type {
  AccessControlSubject,
  DiscordGuildMemberRecord,
  LinkedAuthUserRecord,
  LinkedDiscordProfileRecord,
} from '@/lib/access-control/types'

const DISCORD_API_BASE = 'https://discord.com/api/v10'
const DISCORD_GUILD_PAGE_LIMIT = 1000

export type DiscordGuildRoleRecord = {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
  mentionable: boolean
}

export class DiscordGuildAccessError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'DiscordGuildAccessError'
    this.code = code
  }
}

function normalizeGuildMemberRow(row: Record<string, unknown>): DiscordGuildMemberRecord | null {
  const discordUserId = typeof row.discord_user_id === 'string' ? row.discord_user_id.trim() : ''
  if (!discordUserId) {
    return null
  }

  return {
    discordUserId,
    username: typeof row.username === 'string' ? row.username : 'Unknown',
    globalName: typeof row.global_name === 'string' ? row.global_name : null,
    nickname: typeof row.nickname === 'string' ? row.nickname : null,
    avatar: typeof row.avatar === 'string' ? row.avatar : null,
    discordRoles: normalizeDiscordRoleIds(row.discord_roles),
    isInGuild: row.is_in_guild !== false,
    joinedAt: typeof row.joined_at === 'string' ? row.joined_at : null,
    lastSyncedAt: typeof row.last_synced_at === 'string' ? row.last_synced_at : null,
    linkedUserId: typeof row.linked_user_id === 'string' ? row.linked_user_id : null,
    syncSource: typeof row.sync_source === 'string' ? row.sync_source : null,
    syncError: typeof row.sync_error === 'string' ? row.sync_error : null,
  }
}

function normalizeLinkedProfileRow(row: Record<string, unknown>): LinkedDiscordProfileRecord | null {
  const userId = typeof row.user_id === 'string' ? row.user_id.trim() : ''
  if (!userId) return null

  return {
    userId,
    discordUserId: typeof row.discord_user_id === 'string' ? row.discord_user_id : null,
    discordUsername: typeof row.discord_username === 'string' ? row.discord_username : null,
    discordAvatar: typeof row.discord_avatar === 'string' ? row.discord_avatar : null,
    discordRoles: normalizeDiscordRoleIds(row.discord_roles),
    lastSyncedAt: typeof row.last_synced_at === 'string' ? row.last_synced_at : null,
  }
}

function normalizeLinkedAuthUserRecord(user: Record<string, unknown> | null | undefined): LinkedAuthUserRecord | null {
  const id = typeof user?.id === 'string' ? user.id : ''
  if (!id) return null

  return {
    id,
    email: typeof user?.email === 'string' ? user.email : null,
    createdAt: typeof user?.created_at === 'string' ? user.created_at : null,
    lastSignInAt: typeof user?.last_sign_in_at === 'string' ? user.last_sign_in_at : null,
  }
}

function normalizeDiscordApiMember(
  row: Record<string, unknown>,
  nowIso: string,
): DiscordGuildMemberRecord | null {
  const user = (row.user || {}) as Record<string, unknown>
  const discordUserId = typeof user.id === 'string' ? user.id.trim() : ''
  if (!discordUserId) return null

  return {
    discordUserId,
    username: typeof user.username === 'string' && user.username.trim().length > 0
      ? user.username
      : (typeof row.nick === 'string' && row.nick.trim().length > 0 ? row.nick : 'Unknown'),
    globalName: typeof user.global_name === 'string' ? user.global_name : null,
    nickname: typeof row.nick === 'string' ? row.nick : null,
    avatar: typeof user.avatar === 'string' ? user.avatar : null,
    discordRoles: normalizeDiscordRoleIds(row.roles),
    isInGuild: true,
    joinedAt: typeof row.joined_at === 'string' ? row.joined_at : null,
    lastSyncedAt: nowIso,
    linkedUserId: null,
    syncSource: 'discord_api',
    syncError: null,
  }
}

function normalizeDiscordApiRole(row: Record<string, unknown>): DiscordGuildRoleRecord | null {
  const id = typeof row.id === 'string' ? row.id.trim() : ''
  if (!id) return null

  return {
    id,
    name: typeof row.name === 'string' && row.name.trim().length > 0
      ? row.name.trim()
      : `Unknown role (${id})`,
    color: Number(row.color || 0),
    position: Number(row.position || 0),
    managed: row.managed === true,
    mentionable: row.mentionable === true,
  }
}

async function upsertDiscordGuildRoleCatalog(
  supabase: SupabaseClient,
  roles: DiscordGuildRoleRecord[],
): Promise<void> {
  if (roles.length === 0) return

  const nowIso = new Date().toISOString()
  const payload = roles.map((role) => ({
    discord_role_id: role.id,
    discord_role_name: role.name,
    role_color: role.color || null,
    position: role.position,
    managed: role.managed,
    mentionable: role.mentionable,
    last_synced_at: nowIso,
    updated_at: nowIso,
  }))

  const { error } = await supabase
    .from('discord_guild_roles')
    .upsert(payload, { onConflict: 'discord_role_id' })

  if (error) {
    throw new DiscordGuildAccessError(
      `Failed to upsert guild role catalog: ${error.message}`,
      'GUILD_ROLE_UPSERT_FAILED',
    )
  }
}

export async function resolveDiscordGuildConfig(
  supabase: SupabaseClient,
): Promise<{ guildId: string; botToken: string }> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['discord_guild_id', 'discord_bot_token'])

  if (error) {
    throw new DiscordGuildAccessError(
      `Failed to load Discord configuration: ${error.message}`,
      'DISCORD_CONFIG_QUERY_FAILED',
    )
  }

  const config = Object.fromEntries(
    (data || []).map((row) => [row.key, typeof row.value === 'string' ? row.value.trim() : '']),
  )

  if (!config.discord_guild_id || !config.discord_bot_token) {
    throw new DiscordGuildAccessError(
      'Discord guild configuration is incomplete.',
      'DISCORD_CONFIG_MISSING',
    )
  }

  return {
    guildId: config.discord_guild_id,
    botToken: config.discord_bot_token,
  }
}

async function fetchDiscordGuildMembersPage(params: {
  guildId: string
  botToken: string
  after?: string | null
}): Promise<DiscordGuildMemberRecord[]> {
  const url = new URL(`${DISCORD_API_BASE}/guilds/${params.guildId}/members`)
  url.searchParams.set('limit', String(DISCORD_GUILD_PAGE_LIMIT))
  if (params.after) {
    url.searchParams.set('after', params.after)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bot ${params.botToken}`,
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new DiscordGuildAccessError(
      `Discord guild roster request failed: ${response.status} ${body}`,
      'DISCORD_ROSTER_FETCH_FAILED',
    )
  }

  const payload = await response.json()
  if (!Array.isArray(payload)) {
    return []
  }

  const nowIso = new Date().toISOString()
  return payload
    .map((row) => normalizeDiscordApiMember(row as Record<string, unknown>, nowIso))
    .filter((row): row is DiscordGuildMemberRecord => row !== null)
}

async function fetchDiscordGuildMember(params: {
  guildId: string
  botToken: string
  discordUserId: string
}): Promise<DiscordGuildMemberRecord | null> {
  const response = await fetch(
    `${DISCORD_API_BASE}/guilds/${params.guildId}/members/${params.discordUserId}`,
    {
      headers: {
        Authorization: `Bot ${params.botToken}`,
      },
    },
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new DiscordGuildAccessError(
      `Discord member request failed: ${response.status} ${body}`,
      'DISCORD_MEMBER_FETCH_FAILED',
    )
  }

  const payload = await response.json()
  return normalizeDiscordApiMember(payload as Record<string, unknown>, new Date().toISOString())
}

async function fetchDiscordGuildRoles(params: {
  guildId: string
  botToken: string
}): Promise<DiscordGuildRoleRecord[]> {
  const response = await fetch(
    `${DISCORD_API_BASE}/guilds/${params.guildId}/roles`,
    {
      headers: {
        Authorization: `Bot ${params.botToken}`,
      },
    },
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new DiscordGuildAccessError(
      `Discord guild roles request failed: ${response.status} ${body}`,
      'DISCORD_GUILD_ROLES_FETCH_FAILED',
    )
  }

  const payload = await response.json()
  if (!Array.isArray(payload)) {
    return []
  }

  return payload
    .map((row) => normalizeDiscordApiRole(row as Record<string, unknown>))
    .filter((row): row is DiscordGuildRoleRecord => row !== null)
}

async function fetchDiscordBotUserId(botToken: string): Promise<string> {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new DiscordGuildAccessError(
      `Discord bot identity request failed: ${response.status} ${body}`,
      'DISCORD_BOT_IDENTITY_FETCH_FAILED',
    )
  }

  const payload = await response.json()
  const botUserId = typeof payload?.id === 'string' ? payload.id.trim() : ''
  if (!botUserId) {
    throw new DiscordGuildAccessError(
      'Discord bot identity response did not include a user id.',
      'DISCORD_BOT_IDENTITY_MISSING',
    )
  }

  return botUserId
}

async function loadLinkedUserMap(
  supabase: SupabaseClient,
  discordUserIds: string[],
): Promise<Map<string, string>> {
  const normalizedIds = Array.from(new Set(discordUserIds.filter(Boolean)))
  if (normalizedIds.length === 0) {
    return new Map()
  }

  const { data } = await supabase
    .from('user_discord_profiles')
    .select('user_id, discord_user_id')
    .in('discord_user_id', normalizedIds)

  return new Map(
    (data || [])
      .filter((row) => typeof row.user_id === 'string' && typeof row.discord_user_id === 'string')
      .map((row) => [row.discord_user_id as string, row.user_id as string]),
  )
}

async function upsertDiscordGuildMembers(
  supabase: SupabaseClient,
  members: DiscordGuildMemberRecord[],
  syncSource: string,
): Promise<void> {
  if (members.length === 0) return

  const linkedUserMap = await loadLinkedUserMap(
    supabase,
    members.map((member) => member.discordUserId),
  )
  const nowIso = new Date().toISOString()

  const payload = members.map((member) => ({
    discord_user_id: member.discordUserId,
    username: member.username,
    global_name: member.globalName,
    nickname: member.nickname,
    avatar: member.avatar,
    discord_roles: member.discordRoles,
    is_in_guild: member.isInGuild,
    joined_at: member.joinedAt,
    last_synced_at: nowIso,
    linked_user_id: linkedUserMap.get(member.discordUserId) || member.linkedUserId || null,
    sync_source: syncSource,
    sync_error: member.syncError,
    updated_at: nowIso,
  }))

  const { error } = await supabase
    .from('discord_guild_members')
    .upsert(payload, { onConflict: 'discord_user_id' })

  if (error) {
    throw new DiscordGuildAccessError(
      `Failed to upsert guild member cache: ${error.message}`,
      'GUILD_MEMBER_UPSERT_FAILED',
    )
  }
}

export async function refreshDiscordGuildRoster(
  supabase: SupabaseClient,
): Promise<{ syncedCount: number; missingCount: number }> {
  const { guildId, botToken } = await resolveDiscordGuildConfig(supabase)

  const allMembers: DiscordGuildMemberRecord[] = []
  let after: string | null = null

  while (true) {
    const page = await fetchDiscordGuildMembersPage({ guildId, botToken, after })
    allMembers.push(...page)

    if (page.length < DISCORD_GUILD_PAGE_LIMIT) {
      break
    }

    after = page[page.length - 1]?.discordUserId || null
    if (!after) break
  }

  await upsertDiscordGuildMembers(supabase, allMembers, 'discord_guild_sync')

  const currentIds = new Set(allMembers.map((member) => member.discordUserId))
  const { data: existingRows } = await supabase
    .from('discord_guild_members')
    .select('discord_user_id')

  const missingIds = (existingRows || [])
    .map((row) => (typeof row.discord_user_id === 'string' ? row.discord_user_id : ''))
    .filter((discordUserId) => discordUserId && !currentIds.has(discordUserId))

  if (missingIds.length > 0) {
    await supabase
      .from('discord_guild_members')
      .update({
        is_in_guild: false,
        last_synced_at: new Date().toISOString(),
        sync_source: 'discord_guild_sync',
        sync_error: 'Missing from latest Discord guild roster snapshot.',
      })
      .in('discord_user_id', missingIds)
  }

  return {
    syncedCount: allMembers.length,
    missingCount: missingIds.length,
  }
}

export async function refreshSingleDiscordGuildMember(
  supabase: SupabaseClient,
  discordUserId: string,
): Promise<DiscordGuildMemberRecord | null> {
  const { guildId, botToken } = await resolveDiscordGuildConfig(supabase)
  const member = await fetchDiscordGuildMember({ guildId, botToken, discordUserId })

  if (!member) {
    const nowIso = new Date().toISOString()
    await supabase
      .from('discord_guild_members')
      .upsert({
        discord_user_id: discordUserId,
        username: 'Unknown',
        global_name: null,
        nickname: null,
        avatar: null,
        discord_roles: [],
        is_in_guild: false,
        joined_at: null,
        last_synced_at: nowIso,
        sync_source: 'discord_single_member_sync',
        sync_error: 'Discord user is not currently in the guild.',
      }, { onConflict: 'discord_user_id' })

    return null
  }

  await upsertDiscordGuildMembers(supabase, [member], 'discord_single_member_sync')
  return member
}

export async function refreshDiscordGuildRoleCatalog(
  supabase: SupabaseClient,
): Promise<DiscordGuildRoleRecord[]> {
  const { guildId, botToken } = await resolveDiscordGuildConfig(supabase)
  const roles = await fetchDiscordGuildRoles({ guildId, botToken })
  await upsertDiscordGuildRoleCatalog(supabase, roles)
  return roles
}

export async function getDiscordRoleMutationContext(params: {
  supabase: SupabaseClient
  targetRoleId: string
}): Promise<{
  role: DiscordGuildRoleRecord | null
  botHighestRolePosition: number
  manageable: boolean
  reason: string | null
}> {
  const { guildId, botToken } = await resolveDiscordGuildConfig(params.supabase)
  const [roles, botUserId] = await Promise.all([
    fetchDiscordGuildRoles({ guildId, botToken }),
    fetchDiscordBotUserId(botToken),
  ])

  await upsertDiscordGuildRoleCatalog(params.supabase, roles)

  const targetRole = roles.find((role) => role.id === params.targetRoleId) || null
  if (!targetRole) {
    return {
      role: null,
      botHighestRolePosition: 0,
      manageable: false,
      reason: 'Discord role was not found in the guild role catalog.',
    }
  }

  if (targetRole.managed) {
    return {
      role: targetRole,
      botHighestRolePosition: 0,
      manageable: false,
      reason: 'Managed Discord roles cannot be changed from the control center.',
    }
  }

  const botMember = await fetchDiscordGuildMember({ guildId, botToken, discordUserId: botUserId })
  const botHighestRolePosition = Math.max(
    0,
    ...roles
      .filter((role) => botMember?.discordRoles.includes(role.id))
      .map((role) => role.position),
  )

  if (botHighestRolePosition <= targetRole.position) {
    return {
      role: targetRole,
      botHighestRolePosition,
      manageable: false,
      reason: 'The bot cannot manage a role at or above its highest Discord role.',
    }
  }

  return {
    role: targetRole,
    botHighestRolePosition,
    manageable: true,
    reason: null,
  }
}

export async function mutateDiscordMemberRole(params: {
  supabase: SupabaseClient
  discordUserId: string
  roleId: string
  operation: 'add' | 'remove'
}) {
  const { guildId, botToken } = await resolveDiscordGuildConfig(params.supabase)
  const method = params.operation === 'add' ? 'PUT' : 'DELETE'
  const response = await fetch(
    `${DISCORD_API_BASE}/guilds/${guildId}/members/${params.discordUserId}/roles/${params.roleId}`,
    {
      method,
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    },
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new DiscordGuildAccessError(
      `Discord role ${params.operation} failed: ${response.status} ${body}`,
      'DISCORD_MEMBER_ROLE_MUTATION_FAILED',
    )
  }
}

export async function loadLinkedAuthUserById(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<LinkedAuthUserRecord | null> {
  if (!userId) return null

  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data?.user) {
    return null
  }

  return normalizeLinkedAuthUserRecord(data.user as unknown as Record<string, unknown>)
}

export async function searchLinkedUserIdsByEmail(
  supabase: SupabaseClient,
  emailQuery: string,
): Promise<string[]> {
  const normalizedQuery = emailQuery.trim().toLowerCase()
  if (!normalizedQuery) {
    return []
  }

  const perPage = 200
  const maxPages = 10
  const matchingIds = new Set<string>()

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      break
    }

    const users = data?.users || []
    for (const user of users) {
      const email = String(user.email || '').toLowerCase()
      if (email.includes(normalizedQuery)) {
        matchingIds.add(user.id)
      }
    }

    if (users.length < perPage) {
      break
    }
  }

  return Array.from(matchingIds)
}

export async function loadAccessControlSubject(
  supabase: SupabaseClient,
  params: {
    userId?: string | null
    discordUserId?: string | null
  },
): Promise<AccessControlSubject> {
  let linkedProfile: LinkedDiscordProfileRecord | null = null
  let discordMember: DiscordGuildMemberRecord | null = null
  let linkedAuthUser: LinkedAuthUserRecord | null = null

  if (params.userId) {
    const { data } = await supabase
      .from('user_discord_profiles')
      .select('user_id, discord_user_id, discord_username, discord_avatar, discord_roles, last_synced_at')
      .eq('user_id', params.userId)
      .maybeSingle()
    linkedProfile = data ? normalizeLinkedProfileRow(data as Record<string, unknown>) : null
  }

  const targetDiscordUserId = params.discordUserId || linkedProfile?.discordUserId || null
  if (targetDiscordUserId) {
    const [{ data: discordMemberRow }, profileLookup] = await Promise.all([
      supabase
        .from('discord_guild_members')
        .select('*')
        .eq('discord_user_id', targetDiscordUserId)
        .maybeSingle(),
      linkedProfile
        ? Promise.resolve({ data: linkedProfile })
        : supabase
            .from('user_discord_profiles')
            .select('user_id, discord_user_id, discord_username, discord_avatar, discord_roles, last_synced_at')
            .eq('discord_user_id', targetDiscordUserId)
            .maybeSingle(),
    ])

    discordMember = discordMemberRow
      ? normalizeGuildMemberRow(discordMemberRow as Record<string, unknown>)
      : null

    if (!linkedProfile && profileLookup?.data) {
      linkedProfile = normalizeLinkedProfileRow(profileLookup.data as Record<string, unknown>)
    }
  }

  const linkedUserId = params.userId || discordMember?.linkedUserId || linkedProfile?.userId || null
  linkedAuthUser = await loadLinkedAuthUserById(supabase, linkedUserId)

  return {
    discordMember,
    linkedProfile,
    linkedAuthUser,
  }
}
