import { normalizeDiscordRoleIds } from '@/lib/discord-role-access'

type LooseRecord = Record<string, unknown>

function asRecord(value: unknown): LooseRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : {}
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function extractDiscordUserIdFromIdentities(identities: unknown): string | null {
  if (!Array.isArray(identities)) return null

  for (const identity of identities) {
    const identityRecord = asRecord(identity)
    const provider = asTrimmedString(identityRecord.provider)
    const identityData = asRecord(identityRecord.identity_data)
    const identityProvider = asTrimmedString(identityData.provider)

    // Prefer explicit Discord identities first.
    if (provider !== 'discord' && identityProvider !== 'discord') {
      continue
    }

    const candidate = (
      asTrimmedString(identityData.provider_id)
      || asTrimmedString(identityData.user_id)
      || asTrimmedString(identityData.sub)
      || asTrimmedString(identityRecord.id)
    )

    if (candidate) return candidate
  }

  return null
}

export function resolveDiscordUserIdFromAuthUser(
  authUser: unknown,
  fallbackDiscordUserId?: string | null,
): string | null {
  const userRecord = asRecord(authUser)
  const userMetadata = asRecord(userRecord.user_metadata)
  const appMetadata = asRecord(userRecord.app_metadata)

  const direct = (
    asTrimmedString(userMetadata.provider_id)
    || asTrimmedString(userMetadata.discord_user_id)
    || asTrimmedString(userMetadata.sub)
    || asTrimmedString(appMetadata.discord_user_id)
    || extractDiscordUserIdFromIdentities(userRecord.identities)
    || asTrimmedString(fallbackDiscordUserId)
  )

  return direct || null
}

export function buildDiscordAvatarUrl(
  discordUserId: string | null | undefined,
  avatarHash: string | null | undefined,
): string | null {
  const userId = asTrimmedString(discordUserId)
  const avatar = asTrimmedString(avatarHash)
  if (!userId || !avatar) return null
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`
}

export function buildSyncedAppMetadata(params: {
  existingAppMetadata: unknown
  discordRoles: string[]
  isAdmin: boolean
  isMember: boolean
  discordUserId?: string | null
  discordUsername?: string | null
  discordAvatar?: string | null
}): LooseRecord {
  const {
    existingAppMetadata,
    discordRoles,
    isAdmin,
    isMember,
    discordUserId,
    discordUsername,
    discordAvatar,
  } = params

  const next = {
    ...asRecord(existingAppMetadata),
    is_admin: isAdmin,
    is_member: isMember,
    discord_roles: normalizeDiscordRoleIds(discordRoles),
  } as LooseRecord

  const normalizedDiscordUserId = asTrimmedString(discordUserId)
  if (normalizedDiscordUserId) {
    next.discord_user_id = normalizedDiscordUserId
  }

  if (discordUsername !== undefined) {
    next.discord_username = asTrimmedString(discordUsername)
  }

  if (discordAvatar !== undefined) {
    next.discord_avatar = asTrimmedString(discordAvatar)
  }

  return next
}

export function buildSyncedUserMetadata(params: {
  existingUserMetadata: unknown
  discordRoles: string[]
  discordUserId?: string | null
  discordUsername?: string | null
  discordAvatar?: string | null
}): LooseRecord {
  const {
    existingUserMetadata,
    discordRoles,
    discordUserId,
    discordUsername,
    discordAvatar,
  } = params

  const next = {
    ...asRecord(existingUserMetadata),
    discord_roles: normalizeDiscordRoleIds(discordRoles),
  } as LooseRecord

  const normalizedDiscordUserId = asTrimmedString(discordUserId)
  if (normalizedDiscordUserId) {
    next.discord_user_id = normalizedDiscordUserId

    if (!asTrimmedString(next.provider_id)) {
      next.provider_id = normalizedDiscordUserId
    }
    if (!asTrimmedString(next.sub)) {
      next.sub = normalizedDiscordUserId
    }
  }

  if (discordUsername !== undefined) {
    next.discord_username = asTrimmedString(discordUsername)
  }

  if (discordAvatar !== undefined) {
    const normalizedAvatar = asTrimmedString(discordAvatar)
    next.discord_avatar = normalizedAvatar
    next.discord_avatar_url = buildDiscordAvatarUrl(normalizedDiscordUserId, normalizedAvatar)
  }

  return next
}
