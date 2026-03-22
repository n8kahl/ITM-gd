import type { JournalEntry } from '@/lib/types/journal'

export type DirectoryRow = {
  discord_user_id: string
  username: string
  global_name: string | null
  nickname: string | null
  avatar: string | null
  avatar_url: string | null
  linked_user_id: string | null
  email: string | null
  link_status: 'linked' | 'discord_only' | 'site_only'
  resolved_tier: 'core' | 'pro' | 'executive' | null
  access_status: 'suspended' | 'admin' | 'member' | 'denied'
  is_admin: boolean
  is_privileged: boolean
  has_members_access: boolean
  active_override_count: number
  role_summary: Array<{ role_id: string; role_name: string }>
  role_count: number
  last_synced_at: string | null
  sync_error: string | null
}

export type DetailData = {
  identity: {
    discord_user_id: string | null
    username: string | null
    global_name: string | null
    nickname: string | null
    avatar: string | null
    avatar_url: string | null
    email: string | null
    linked_user_id: string | null
    link_status: string
    is_in_guild: boolean
    sources: {
      roles: string
      identity: string
    }
  }
  discord_roles: Array<{ role_id: string; role_name: string }>
  app_access: {
    resolved_tier: 'core' | 'pro' | 'executive' | null
    is_admin: boolean
    is_privileged: boolean
    has_members_access: boolean
    allowed_tabs: string[]
  }
  controls: {
    allow_discord_role_mutation: boolean
    role_catalog: Array<{
      role_id: string
      role_name: string
      managed: boolean
      position: number
    }>
  }
  tab_matrix: Array<{
    tabId: string
    label: string
    path: string
    requiredTier: string
    requiredRoleIds: string[]
    requiredRoleNames: string[]
    allowed: boolean
    reasonCode: string
    reason: string
    overrideApplied: string | null
  }>
  profile_sync_health: {
    last_synced_at: string | null
    warnings: Array<{ code: string; severity: 'info' | 'warning' | 'critical'; message: string }>
    guild_sync_error: string | null
    linked_profile_last_synced_at: string | null
    linked_auth_created_at: string | null
    linked_auth_last_sign_in_at: string | null
  }
  overrides: Array<{
    id: string
    overrideType: string
    reason: string
    createdAt: string
    expiresAt: string | null
    payload: Record<string, unknown>
  }>
  audit_history: Array<{
    id: string
    action: string
    created_at: string
    details: Record<string, unknown> | null
  }>
}

export type DetailResponse = {
  success: boolean
  error?: string
  data?: DetailData
}

export type RoleMutationResponse = {
  success: boolean
  error?: string
  data?: {
    mutation_enabled?: boolean
    manageable?: boolean
    manageability_reason?: string | null
    role?: {
      id: string
      name: string
    } | null
    current_role_ids?: string[]
    next_role_ids?: string[]
    preview_evaluation?: {
      resolvedTier: 'core' | 'pro' | 'executive' | null
      isAdmin: boolean
      hasMembersAccess: boolean
      allowedTabs: string[]
    }
    evaluation?: {
      resolvedTier: 'core' | 'pro' | 'executive' | null
      isAdmin: boolean
      hasMembersAccess: boolean
      allowedTabs: string[]
    }
    no_op?: boolean
  }
}

export type DirectoryResponse = {
  success: boolean
  error?: string
  data?: DirectoryRow[]
  meta?: {
    resultCount: number
  }
}

export type TradeBrowseEntry = JournalEntry & {
  member_display_name: string
}

export type TradeBrowseResponse = {
  success: boolean
  error?: string
  data?: TradeBrowseEntry[]
  meta?: {
    total?: number
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString()
}

export function formatTradeDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return `$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export function formatPnl(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export function coachStatusClass(status: JournalEntry['coach_review_status']): string {
  if (status === 'pending') return 'border-amber-400/40 bg-amber-500/10 text-amber-200'
  if (status === 'in_review') return 'border-sky-400/40 bg-sky-500/10 text-sky-200'
  if (status === 'completed') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
  return 'border-white/10 bg-white/5 text-white/60'
}

export function getDisplayName(row: Pick<DirectoryRow, 'nickname' | 'global_name' | 'username'>): string {
  return row.nickname || row.global_name || row.username || 'Unknown member'
}

export function buildPayloadTabIds(raw: string): string[] {
  return Array.from(new Set(raw.split(',').map((value) => value.trim()).filter(Boolean)))
}

export function accessBadgeClass(status: DirectoryRow['access_status']): string {
  if (status === 'suspended') return 'border-red-500/30 bg-red-500/10 text-red-200'
  if (status === 'admin') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'member') return 'border-blue-500/30 bg-blue-500/10 text-blue-200'
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
}

export function warningClass(severity: 'info' | 'warning' | 'critical'): string {
  if (severity === 'critical') return 'border-red-500/30 bg-red-500/10 text-red-100'
  if (severity === 'warning') return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  return 'border-blue-500/30 bg-blue-500/10 text-blue-100'
}

export function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const direct = (payload as { error?: unknown }).error
    if (typeof direct === 'string' && direct.trim()) {
      return direct
    }

    const nested = direct && typeof direct === 'object'
      ? (direct as { message?: unknown }).message
      : null
    if (typeof nested === 'string' && nested.trim()) {
      return nested
    }
  }

  return fallback
}
