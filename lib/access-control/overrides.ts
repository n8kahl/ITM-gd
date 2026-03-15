import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ActiveMemberAccessOverride,
  OverrideType,
} from '@/lib/access-control/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeOverride(row: Record<string, unknown>): ActiveMemberAccessOverride | null {
  const id = typeof row.id === 'string' ? row.id.trim() : ''
  const overrideType = typeof row.override_type === 'string'
    ? row.override_type.trim()
    : ''

  if (!id || !overrideType) {
    return null
  }

  return {
    id,
    discordUserId: typeof row.discord_user_id === 'string' ? row.discord_user_id : null,
    userId: typeof row.user_id === 'string' ? row.user_id : null,
    overrideType: overrideType as OverrideType,
    payload: isRecord(row.payload) ? row.payload : {},
    reason: typeof row.reason === 'string' ? row.reason : '',
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    createdByUserId: typeof row.created_by_user_id === 'string' ? row.created_by_user_id : '',
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
    revokedAt: typeof row.revoked_at === 'string' ? row.revoked_at : null,
    revokedByUserId: typeof row.revoked_by_user_id === 'string' ? row.revoked_by_user_id : null,
    revocationReason: typeof row.revocation_reason === 'string' ? row.revocation_reason : null,
  }
}

function isOverrideActive(override: ActiveMemberAccessOverride, now: Date): boolean {
  if (override.revokedAt) return false
  if (!override.expiresAt) return true

  const expiresAt = new Date(override.expiresAt)
  if (Number.isNaN(expiresAt.getTime())) return true
  return expiresAt.getTime() > now.getTime()
}

export async function fetchActiveMemberAccessOverrides(
  supabase: SupabaseClient,
  params: {
    userId?: string | null
    discordUserId?: string | null
  },
): Promise<ActiveMemberAccessOverride[]> {
  const filters: string[] = []
  if (params.userId) {
    filters.push(`user_id.eq.${params.userId}`)
  }
  if (params.discordUserId) {
    filters.push(`discord_user_id.eq.${params.discordUserId}`)
  }

  if (filters.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('member_access_overrides')
    .select('*')
    .or(filters.join(','))
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error || !Array.isArray(data)) {
    return []
  }

  const now = new Date()

  return data
    .map((row) => normalizeOverride(row as Record<string, unknown>))
    .filter((override): override is ActiveMemberAccessOverride => override !== null)
    .filter((override) => isOverrideActive(override, now))
}

export function getOverrideTabIds(
  override: ActiveMemberAccessOverride,
): string[] {
  const payload = override.payload
  const rawTabIds = Array.isArray(payload.tab_ids)
    ? payload.tab_ids
    : Array.isArray(payload.tabIds)
      ? payload.tabIds
      : []

  return Array.from(
    new Set(
      rawTabIds
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  )
}
