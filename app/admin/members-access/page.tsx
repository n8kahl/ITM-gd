'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  UserRound,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type DirectoryRow = {
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

type DetailResponse = {
  success: boolean
  error?: string
  data?: {
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
}

type RoleMutationResponse = {
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

type DirectoryResponse = {
  success: boolean
  error?: string
  data?: DirectoryRow[]
  meta?: {
    resultCount: number
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString()
}

function getDisplayName(row: Pick<DirectoryRow, 'nickname' | 'global_name' | 'username'>): string {
  return row.nickname || row.global_name || row.username || 'Unknown member'
}

function buildPayloadTabIds(raw: string): string[] {
  return Array.from(new Set(raw.split(',').map((value) => value.trim()).filter(Boolean)))
}

function accessBadgeClass(status: DirectoryRow['access_status']): string {
  if (status === 'suspended') return 'border-red-500/30 bg-red-500/10 text-red-200'
  if (status === 'admin') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'member') return 'border-blue-500/30 bg-blue-500/10 text-blue-200'
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
}

function warningClass(severity: 'info' | 'warning' | 'critical'): string {
  if (severity === 'critical') return 'border-red-500/30 bg-red-500/10 text-red-100'
  if (severity === 'warning') return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  return 'border-blue-500/30 bg-blue-500/10 text-blue-100'
}

function getErrorMessage(payload: unknown, fallback: string): string {
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

export default function AdminMembersAccessPage() {
  const [query, setQuery] = useState('')
  const [linkedFilter, setLinkedFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState('all')
  const [overrideFilter, setOverrideFilter] = useState('all')
  const [privilegedFilter, setPrivilegedFilter] = useState('all')
  const [directoryRows, setDirectoryRows] = useState<DirectoryRow[]>([])
  const [directoryLoading, setDirectoryLoading] = useState(true)
  const [directoryError, setDirectoryError] = useState<string | null>(null)
  const [selectedDiscordUserId, setSelectedDiscordUserId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailResponse['data'] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [syncingGuild, setSyncingGuild] = useState(false)
  const [syncingMember, setSyncingMember] = useState(false)
  const [overrideType, setOverrideType] = useState('suspend_members_access')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideTabs, setOverrideTabs] = useState('')
  const [overrideExpiresAt, setOverrideExpiresAt] = useState('')
  const [savingOverride, setSavingOverride] = useState(false)
  const [roleMutationOperation, setRoleMutationOperation] = useState<'add' | 'remove'>('add')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [roleMutationReason, setRoleMutationReason] = useState('')
  const [rolePreview, setRolePreview] = useState<RoleMutationResponse['data'] | null>(null)
  const [roleMutationLoading, setRoleMutationLoading] = useState(false)
  const [linkUserId, setLinkUserId] = useState('')
  const [linkReason, setLinkReason] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true)
    setDirectoryError(null)

    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (linkedFilter !== 'all') params.set('linked', linkedFilter)
      if (tierFilter !== 'all') params.set('tier', tierFilter)
      if (overrideFilter !== 'all') params.set('override', overrideFilter)
      if (privilegedFilter !== 'all') params.set('privileged', privilegedFilter)
      params.set('limit', '80')

      const response = await fetch(`/api/admin/members/directory?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json() as DirectoryResponse

      if (!response.ok || !payload.success) {
        setDirectoryRows([])
        setDirectoryError(payload.error || 'Failed to load directory')
        return
      }

      const rows = payload.data || []
      setDirectoryRows(rows)
      setSelectedDiscordUserId((current) => {
        if (current && rows.some((row) => row.discord_user_id === current)) {
          return current
        }
        return rows[0]?.discord_user_id || null
      })
    } catch (error) {
      setDirectoryRows([])
      setDirectoryError(error instanceof Error ? error.message : 'Failed to load directory')
    } finally {
      setDirectoryLoading(false)
    }
  }, [linkedFilter, overrideFilter, privilegedFilter, query, tierFilter])

  const loadDetail = useCallback(async (discordUserId: string) => {
    setDetailLoading(true)
    setDetailError(null)

    try {
      const response = await fetch(`/api/admin/members/directory/${discordUserId}`, { cache: 'no-store' })
      const payload = await response.json() as DetailResponse
      if (!response.ok || !payload.success || !payload.data) {
        setDetail(null)
        setDetailError(payload.error || 'Failed to load member detail')
        return
      }

      setDetail(payload.data)
    } catch (error) {
      setDetail(null)
      setDetailError(error instanceof Error ? error.message : 'Failed to load member detail')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDirectory()
  }, [loadDirectory])

  useEffect(() => {
    if (!selectedDiscordUserId) {
      setDetail(null)
      return
    }

    void loadDetail(selectedDiscordUserId)
  }, [loadDetail, selectedDiscordUserId])

  useEffect(() => {
    setRolePreview(null)
    setSelectedRoleId('')
    setRoleMutationReason('')
    setActionMessage(null)
    setActionError(null)
  }, [selectedDiscordUserId])

  useEffect(() => {
    setLinkUserId(detail?.identity.linked_user_id || '')
  }, [detail?.identity.linked_user_id])

  const selectedRow = useMemo(
    () => directoryRows.find((row) => row.discord_user_id === selectedDiscordUserId) || null,
    [directoryRows, selectedDiscordUserId],
  )

  const handleRefreshGuildRoster = useCallback(async () => {
    setSyncingGuild(true)
    try {
      await fetch('/api/admin/members/sync-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'guild_roster' }),
      })
      await loadDirectory()
      if (selectedDiscordUserId) {
        await loadDetail(selectedDiscordUserId)
      }
    } finally {
      setSyncingGuild(false)
    }
  }, [loadDetail, loadDirectory, selectedDiscordUserId])

  const handleSyncMember = useCallback(async () => {
    if (!selectedDiscordUserId) return
    setSyncingMember(true)
    try {
      await fetch(`/api/admin/members/${selectedDiscordUserId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      await Promise.all([loadDirectory(), loadDetail(selectedDiscordUserId)])
    } finally {
      setSyncingMember(false)
    }
  }, [loadDetail, loadDirectory, selectedDiscordUserId])

  const handleCreateOverride = useCallback(async () => {
    if (!selectedDiscordUserId || !overrideReason.trim()) return

    setSavingOverride(true)
    try {
      const payload: Record<string, unknown> = {}
      if (overrideType === 'allow_specific_tabs' || overrideType === 'deny_specific_tabs') {
        payload.tab_ids = buildPayloadTabIds(overrideTabs)
      }

      await fetch(`/api/admin/members/${selectedDiscordUserId}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          overrideType,
          reason: overrideReason.trim(),
          expiresAt: overrideExpiresAt ? new Date(overrideExpiresAt).toISOString() : null,
          payload,
        }),
      })

      setOverrideReason('')
      setOverrideTabs('')
      setOverrideExpiresAt('')
      await Promise.all([loadDirectory(), loadDetail(selectedDiscordUserId)])
    } finally {
      setSavingOverride(false)
    }
  }, [loadDetail, loadDirectory, overrideExpiresAt, overrideReason, overrideTabs, overrideType, selectedDiscordUserId])

  const handleRevokeOverride = useCallback(async (overrideId: string) => {
    if (!selectedDiscordUserId) return

    setSavingOverride(true)
    try {
      await fetch(`/api/admin/members/${selectedDiscordUserId}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke',
          overrideId,
          reason: 'Revoked from Member Access Control Center',
        }),
      })

      await Promise.all([loadDirectory(), loadDetail(selectedDiscordUserId)])
    } finally {
      setSavingOverride(false)
    }
  }, [loadDetail, loadDirectory, selectedDiscordUserId])

  const handlePreviewRoleMutation = useCallback(async () => {
    if (!selectedDiscordUserId || !selectedRoleId) return

    setRoleMutationLoading(true)
    setActionMessage(null)
    setActionError(null)
    try {
      const response = await fetch(`/api/admin/members/${selectedDiscordUserId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          operation: roleMutationOperation,
          roleId: selectedRoleId,
        }),
      })
      const payload = await response.json() as RoleMutationResponse
      if (!response.ok || !payload.success || !payload.data) {
        setRolePreview(null)
        setActionError(getErrorMessage(payload, 'Failed to preview Discord role change'))
        return
      }

      setRolePreview(payload.data)
      if (payload.data.manageable === false) {
        setActionError(payload.data.manageability_reason || 'Discord role is not manageable by the bot')
        return
      }
      if (payload.data.mutation_enabled === false) {
        setActionError('Discord role mutation is disabled in access control settings')
        return
      }

      setActionMessage('Preview loaded. Review the resulting access before applying the change.')
    } catch (error) {
      setRolePreview(null)
      setActionError(error instanceof Error ? error.message : 'Failed to preview Discord role change')
    } finally {
      setRoleMutationLoading(false)
    }
  }, [roleMutationOperation, selectedDiscordUserId, selectedRoleId])

  const handleApplyRoleMutation = useCallback(async () => {
    if (!selectedDiscordUserId || !selectedRoleId || !roleMutationReason.trim()) return

    setRoleMutationLoading(true)
    setActionMessage(null)
    setActionError(null)
    try {
      const response = await fetch(`/api/admin/members/${selectedDiscordUserId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          operation: roleMutationOperation,
          roleId: selectedRoleId,
          reason: roleMutationReason.trim(),
        }),
      })
      const payload = await response.json() as RoleMutationResponse
      if (!response.ok || !payload.success) {
        setActionError(getErrorMessage(payload, 'Failed to apply Discord role change'))
        return
      }

      setRoleMutationReason('')
      setRolePreview(null)
      setActionMessage(payload.data?.no_op
        ? 'The requested role change was already reflected in the member role set.'
        : 'Discord role change applied and access was recomputed.')
      await Promise.all([loadDirectory(), loadDetail(selectedDiscordUserId)])
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to apply Discord role change')
    } finally {
      setRoleMutationLoading(false)
    }
  }, [loadDetail, loadDirectory, roleMutationOperation, roleMutationReason, selectedDiscordUserId, selectedRoleId])

  const handleLinkMember = useCallback(async () => {
    if (!selectedDiscordUserId || !linkUserId.trim() || !linkReason.trim()) return

    setLinkLoading(true)
    setActionMessage(null)
    setActionError(null)
    try {
      const response = await fetch(`/api/admin/members/${selectedDiscordUserId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: linkUserId.trim(),
          reason: linkReason.trim(),
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setActionError(getErrorMessage(payload, 'Failed to link Discord member'))
        return
      }

      setActionMessage('Discord member linked to the site user and caches were refreshed.')
      await Promise.all([loadDirectory(), loadDetail(selectedDiscordUserId)])
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to link Discord member')
    } finally {
      setLinkLoading(false)
    }
  }, [linkReason, linkUserId, loadDetail, loadDirectory, selectedDiscordUserId])

  const handleUnlinkMember = useCallback(async () => {
    if (!selectedDiscordUserId || !linkReason.trim()) return

    setLinkLoading(true)
    setActionMessage(null)
    setActionError(null)
    try {
      const response = await fetch(`/api/admin/members/${selectedDiscordUserId}/unlink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: linkReason.trim(),
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setActionError(getErrorMessage(payload, 'Failed to unlink Discord member'))
        return
      }

      setLinkUserId('')
      setActionMessage('Discord member unlinked and cached access state was cleared.')
      await Promise.all([loadDirectory(), loadDetail(selectedDiscordUserId)])
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to unlink Discord member')
    } finally {
      setLinkLoading(false)
    }
  }, [linkReason, loadDetail, loadDirectory, selectedDiscordUserId])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-white lg:text-3xl">
            <ShieldAlert className="h-8 w-8 text-emerald-500" />
            Member Access Control Center
          </h1>
          <p className="mt-1 text-white/60">
            Browse the full Discord guild roster, inspect canonical access, and apply audited overrides from one workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/5"
            onClick={() => void loadDirectory()}
            disabled={directoryLoading}
          >
            {directoryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh Directory
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-500"
            onClick={() => void handleRefreshGuildRoster()}
            disabled={syncingGuild}
          >
            {syncingGuild ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
            Refresh Guild Roster
          </Button>
        </div>
      </div>

      <Card className="border-white/10 bg-[#0a0a0b]">
        <CardContent className="grid gap-3 pt-6 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/30" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Discord username, nickname, display name, email, user ID, or Discord ID"
              className="pl-10"
            />
          </div>
          <Select value={linkedFilter} onValueChange={setLinkedFilter}>
            <SelectTrigger><SelectValue placeholder="Link status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              <SelectItem value="linked">Linked only</SelectItem>
              <SelectItem value="unlinked">Unlinked only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger><SelectValue placeholder="Tier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="core">Core</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="executive">Executive</SelectItem>
              <SelectItem value="none">No tier</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select value={overrideFilter} onValueChange={setOverrideFilter}>
              <SelectTrigger><SelectValue placeholder="Override" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All overrides</SelectItem>
                <SelectItem value="blocked">Suspended</SelectItem>
                <SelectItem value="overridden">Has override</SelectItem>
                <SelectItem value="none">No override</SelectItem>
              </SelectContent>
            </Select>
            <Select value={privilegedFilter} onValueChange={setPrivilegedFilter}>
              <SelectTrigger><SelectValue placeholder="Privilege" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All privilege</SelectItem>
                <SelectItem value="true">Privileged only</SelectItem>
                <SelectItem value="false">Non-privileged</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[420px,minmax(0,1fr)]">
        <Card className="border-white/10 bg-[#0a0a0b]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                Guild Directory
              </span>
              <Badge className="border-white/10 bg-white/5 text-white/80">
                {directoryRows.length} results
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {directoryLoading && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center text-sm text-white/60">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-emerald-500" />
                Loading guild directory...
              </div>
            )}

            {!directoryLoading && directoryError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                {directoryError}
              </div>
            )}

            {!directoryLoading && !directoryError && directoryRows.length === 0 && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                No members matched the current filters.
              </div>
            )}

            {!directoryLoading && !directoryError && directoryRows.length > 0 && (
              <div className="max-h-[72vh] space-y-2 overflow-y-auto pr-1">
                {directoryRows.map((row) => {
                  const isSelected = row.discord_user_id === selectedDiscordUserId
                  return (
                        <button
                          key={row.discord_user_id}
                          type="button"
                          data-testid={`member-directory-row-${row.discord_user_id}`}
                          onClick={() => setSelectedDiscordUserId(row.discord_user_id)}
                          className={cn(
                        'w-full rounded-xl border p-3 text-left transition',
                        isSelected
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {row.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.avatar_url}
                            alt={getDisplayName(row)}
                            className="h-11 w-11 rounded-full border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
                            <UserRound className="h-5 w-5 text-white/40" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-white">{getDisplayName(row)}</p>
                            <Badge className={cn('border', accessBadgeClass(row.access_status))}>
                              {row.access_status}
                            </Badge>
                          </div>
                          <p className="truncate text-xs text-white/50">@{row.username}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge className="border-white/10 bg-white/5 text-white/70">
                              {row.link_status}
                            </Badge>
                            <Badge className="border-white/10 bg-white/5 text-white/70">
                              {row.resolved_tier || 'no tier'}
                            </Badge>
                            {row.active_override_count > 0 && (
                              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-100">
                                {row.active_override_count} override{row.active_override_count > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-white/40">
                            Synced {formatDate(row.last_synced_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0a0a0b]">
          <CardHeader>
            <CardTitle className="flex flex-col gap-3 text-white lg:flex-row lg:items-center lg:justify-between">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                Member Detail Workspace
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/5"
                  onClick={() => selectedDiscordUserId && void loadDetail(selectedDiscordUserId)}
                  disabled={!selectedDiscordUserId || detailLoading}
                >
                  {detailLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh Detail
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-500"
                  onClick={() => void handleSyncMember()}
                  disabled={!selectedDiscordUserId || syncingMember}
                >
                  {syncingMember ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Sync Member
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedRow && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                Select a guild member to inspect access, tab reasoning, overrides, and sync health.
              </div>
            )}

            {selectedRow && detailLoading && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-emerald-500" />
                Loading member detail...
              </div>
            )}

            {selectedRow && !detailLoading && detailError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                {detailError}
              </div>
            )}

            {selectedRow && !detailLoading && detail && (
              <Tabs defaultValue="identity" className="w-full">
                <div className="mb-4 space-y-3">
                  {actionError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
                      {actionError}
                    </div>
                  )}
                  {actionMessage && !actionError && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                      {actionMessage}
                    </div>
                  )}
                </div>
                <TabsList>
                  <TabsTrigger value="identity">Identity</TabsTrigger>
                  <TabsTrigger value="access">Access</TabsTrigger>
                  <TabsTrigger value="roles">Roles</TabsTrigger>
                  <TabsTrigger value="health">Health</TabsTrigger>
                  <TabsTrigger value="overrides">Overrides</TabsTrigger>
                </TabsList>

                <TabsContent value="identity" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-white/10 bg-white/5">
                      <CardContent className="space-y-3 pt-6 text-sm">
                        <div>
                          <p className="text-xs text-white/50">Display name</p>
                          <p className="text-white">{detail.identity.nickname || detail.identity.global_name || detail.identity.username || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Discord username</p>
                          <p className="text-white">@{detail.identity.username || 'unknown'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Discord user ID</p>
                          <p className="font-mono text-white/80">{detail.identity.discord_user_id || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Linked site account</p>
                          <p className="font-mono text-white/80">{detail.identity.linked_user_id || 'Unlinked'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Email</p>
                          <p className="text-white/80">{detail.identity.email || '—'}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-white/5">
                      <CardContent className="space-y-3 pt-6 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <Badge className="border-white/10 bg-white/5 text-white/70">
                            {detail.identity.link_status}
                          </Badge>
                          <Badge className={cn('border', detail.app_access.is_admin ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-white/70')}>
                            {detail.app_access.is_admin ? 'admin' : 'non-admin'}
                          </Badge>
                          <Badge className="border-white/10 bg-white/5 text-white/70">
                            {detail.app_access.resolved_tier || 'no tier'}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Role source</p>
                          <p className="text-white/80">{detail.identity.sources.roles}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Identity source</p>
                          <p className="text-white/80">{detail.identity.sources.identity}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Discord roles</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {detail.discord_roles.length === 0 && <span className="text-white/40">No roles</span>}
                            {detail.discord_roles.map((role) => (
                              <Badge key={role.role_id} className="border-white/10 bg-white/5 text-white/80">
                                {role.role_name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-white/10 bg-white/5">
                    <CardHeader>
                      <CardTitle className="text-white">Link Repair</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                      <Input
                        value={linkUserId}
                        onChange={(event) => setLinkUserId(event.target.value)}
                        placeholder="Site user UUID"
                      />
                      <div className="flex items-center rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white/60">
                        Current link: {detail.identity.linked_user_id || 'Unlinked'}
                      </div>
                      <Textarea
                        value={linkReason}
                        onChange={(event) => setLinkReason(event.target.value)}
                        placeholder="Audit reason for linking or unlinking"
                        className="min-h-24 md:col-span-2"
                      />
                      <div className="flex flex-wrap gap-2 md:col-span-2">
                        <Button
                          type="button"
                          className="bg-emerald-600 hover:bg-emerald-500"
                          onClick={() => void handleLinkMember()}
                          disabled={linkLoading || !linkUserId.trim() || !linkReason.trim()}
                        >
                          {linkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRound className="mr-2 h-4 w-4" />}
                          Link Member
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/20 text-white hover:bg-white/5"
                          onClick={() => void handleUnlinkMember()}
                          disabled={linkLoading || !detail.identity.linked_user_id || !linkReason.trim()}
                        >
                          {linkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRound className="mr-2 h-4 w-4" />}
                          Unlink Member
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="access" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-white/10 bg-white/5">
                      <CardContent className="pt-6">
                        <p className="text-xs text-white/50">Tier</p>
                        <p className="mt-1 text-xl font-semibold text-white">{detail.app_access.resolved_tier || 'None'}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-white/10 bg-white/5">
                      <CardContent className="pt-6">
                        <p className="text-xs text-white/50">Members Access</p>
                        <p className="mt-1 text-xl font-semibold text-white">{detail.app_access.has_members_access ? 'Allowed' : 'Denied'}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-white/10 bg-white/5">
                      <CardContent className="pt-6">
                        <p className="text-xs text-white/50">Allowed Tabs</p>
                        <p className="mt-1 text-xl font-semibold text-white">{detail.app_access.allowed_tabs.length}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-3">
                    {detail.tab_matrix.map((tab) => (
                      <div key={tab.tabId} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-medium text-white">{tab.label}</p>
                            <p className="text-xs text-white/50">{tab.path}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge className={cn('border', tab.allowed ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-red-500/30 bg-red-500/10 text-red-100')}>
                              {tab.allowed ? 'Allowed' : 'Denied'}
                            </Badge>
                            <Badge className="border-white/10 bg-white/5 text-white/70">
                              Tier: {tab.requiredTier}
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-white/80">{tab.reason}</p>
                        {tab.requiredRoleNames.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {tab.requiredRoleNames.map((roleName) => (
                              <Badge key={`${tab.tabId}-${roleName}`} className="border-white/10 bg-white/5 text-white/70">
                                {roleName}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="roles" className="space-y-4" data-testid="member-roles-panel">
                  <Card className="border-white/10 bg-white/5">
                    <CardHeader>
                      <CardTitle className="text-white">Discord Role Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!detail.controls.allow_discord_role_mutation && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                          Discord role mutation is disabled in `access_control_settings`. Preview is still available.
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {detail.discord_roles.length === 0 && (
                          <span className="text-sm text-white/50">This member currently has no cached Discord roles.</span>
                        )}
                        {detail.discord_roles.map((role) => (
                          <Badge key={role.role_id} className="border-white/10 bg-black/20 text-white/80">
                            {role.role_name}
                          </Badge>
                        ))}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Select
                          value={roleMutationOperation}
                          onValueChange={(value: 'add' | 'remove') => setRoleMutationOperation(value)}
                        >
                          <SelectTrigger data-testid="member-role-operation-trigger"><SelectValue placeholder="Role operation" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="add">Add role</SelectItem>
                            <SelectItem value="remove">Remove role</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                          <SelectTrigger data-testid="member-role-select-trigger"><SelectValue placeholder="Select guild role" /></SelectTrigger>
                          <SelectContent>
                            {detail.controls.role_catalog
                              .filter((role) => !role.managed)
                              .map((role) => (
                                <SelectItem key={role.role_id} value={role.role_id}>
                                  {role.role_name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Textarea
                          data-testid="member-role-reason"
                          value={roleMutationReason}
                          onChange={(event) => setRoleMutationReason(event.target.value)}
                          placeholder="Audit reason for this Discord role change"
                          className="min-h-24 md:col-span-2"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          data-testid="member-role-preview-button"
                          variant="outline"
                          className="border-white/20 text-white hover:bg-white/5"
                          onClick={() => void handlePreviewRoleMutation()}
                          disabled={roleMutationLoading || !selectedRoleId}
                        >
                          {roleMutationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                          Preview Change
                        </Button>
                        <Button
                          type="button"
                          data-testid="member-role-apply-button"
                          className="bg-emerald-600 hover:bg-emerald-500"
                          onClick={() => void handleApplyRoleMutation()}
                          disabled={roleMutationLoading || !selectedRoleId || !roleMutationReason.trim()}
                        >
                          {roleMutationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                          Apply Change
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {rolePreview && (
                    <Card className="border-white/10 bg-white/5" data-testid="member-role-preview">
                      <CardHeader>
                        <CardTitle className="text-white">Role Change Preview</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <Badge className="border-white/10 bg-black/20 text-white/80">
                            {rolePreview.role?.name || selectedRoleId || 'Selected role'}
                          </Badge>
                          {rolePreview.manageable === false && (
                            <Badge className="border-red-500/30 bg-red-500/10 text-red-100">Not manageable</Badge>
                          )}
                          {rolePreview.no_op && (
                            <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-100">No-op</Badge>
                          )}
                        </div>
                        {rolePreview.manageability_reason && (
                          <p className="text-white/70">{rolePreview.manageability_reason}</p>
                        )}
                        {(rolePreview.preview_evaluation || rolePreview.evaluation) && (
                          <div className="grid gap-3 md:grid-cols-3">
                            <Card className="border-white/10 bg-black/20">
                              <CardContent className="pt-6">
                                <p className="text-xs text-white/50">Tier</p>
                                <p className="mt-1 text-lg font-semibold text-white">
                                  {rolePreview.preview_evaluation?.resolvedTier || rolePreview.evaluation?.resolvedTier || 'None'}
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="border-white/10 bg-black/20">
                              <CardContent className="pt-6">
                                <p className="text-xs text-white/50">Admin</p>
                                <p className="mt-1 text-lg font-semibold text-white">
                                  {(rolePreview.preview_evaluation?.isAdmin || rolePreview.evaluation?.isAdmin) ? 'Yes' : 'No'}
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="border-white/10 bg-black/20">
                              <CardContent className="pt-6">
                                <p className="text-xs text-white/50">Allowed tabs</p>
                                <p className="mt-1 text-lg font-semibold text-white">
                                  {rolePreview.preview_evaluation?.allowedTabs.length || rolePreview.evaluation?.allowedTabs.length || 0}
                                </p>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="health" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-white/10 bg-white/5">
                      <CardContent className="space-y-3 pt-6 text-sm">
                        <div>
                          <p className="text-xs text-white/50">Roster sync</p>
                          <p className="text-white/80">{formatDate(detail.profile_sync_health.last_synced_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Linked profile sync</p>
                          <p className="text-white/80">{formatDate(detail.profile_sync_health.linked_profile_last_synced_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Last sign in</p>
                          <p className="text-white/80">{formatDate(detail.profile_sync_health.linked_auth_last_sign_in_at)}</p>
                        </div>
                        {detail.profile_sync_health.guild_sync_error && (
                          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-100">
                            {detail.profile_sync_health.guild_sync_error}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-white/5">
                      <CardContent className="space-y-3 pt-6 text-sm">
                        <p className="text-xs text-white/50">Health warnings</p>
                        {detail.profile_sync_health.warnings.length === 0 && (
                          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-100">
                            <CheckCircle2 className="mr-2 inline h-4 w-4" />
                            No access health warnings.
                          </div>
                        )}
                        {detail.profile_sync_health.warnings.map((warning) => (
                          <div key={warning.code} className={cn('rounded-lg border p-3', warningClass(warning.severity))}>
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="font-medium">{warning.code}</span>
                            </div>
                            <p className="mt-2 text-sm">{warning.message}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-white/10 bg-white/5">
                    <CardHeader>
                      <CardTitle className="text-white">Audit History</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {detail.audit_history.length === 0 && (
                        <p className="text-white/50">No audit entries for this member yet.</p>
                      )}
                      {detail.audit_history.map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                            <p className="font-medium text-white">{entry.action}</p>
                            <p className="text-xs text-white/40">{formatDate(entry.created_at)}</p>
                          </div>
                          {entry.details && (
                            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded bg-black/30 p-3 text-xs text-white/70">
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="overrides" className="space-y-4" data-testid="member-overrides-panel">
                  <Card className="border-white/10 bg-white/5">
                    <CardHeader>
                      <CardTitle className="text-white">Create Override</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                      <Select value={overrideType} onValueChange={setOverrideType}>
                        <SelectTrigger><SelectValue placeholder="Override type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="suspend_members_access">Suspend members access</SelectItem>
                          <SelectItem value="allow_members_access">Allow members access</SelectItem>
                          <SelectItem value="allow_specific_tabs">Allow specific tabs</SelectItem>
                          <SelectItem value="deny_specific_tabs">Deny specific tabs</SelectItem>
                          <SelectItem value="temporary_admin">Temporary admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="datetime-local"
                        value={overrideExpiresAt}
                        onChange={(event) => setOverrideExpiresAt(event.target.value)}
                        placeholder="Optional expiry"
                      />
                      <Textarea
                        data-testid="member-override-reason"
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value)}
                        placeholder="Reason for this override"
                        className="min-h-28 md:col-span-2"
                      />
                      {(overrideType === 'allow_specific_tabs' || overrideType === 'deny_specific_tabs') && (
                        <Input
                          value={overrideTabs}
                          onChange={(event) => setOverrideTabs(event.target.value)}
                          placeholder="Comma-separated tab IDs (example: ai-coach,journal)"
                          className="md:col-span-2"
                        />
                      )}
                      <div className="md:col-span-2">
                        <Button
                          type="button"
                          data-testid="member-override-create-button"
                          className="bg-emerald-600 hover:bg-emerald-500"
                          onClick={() => void handleCreateOverride()}
                          disabled={savingOverride || !overrideReason.trim()}
                        >
                          {savingOverride ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                          Create Override
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-white/5">
                    <CardHeader>
                      <CardTitle className="text-white">Active Overrides</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {detail.overrides.length === 0 && (
                        <p className="text-white/50" data-testid="member-overrides-empty">No active overrides for this member.</p>
                      )}
                      {detail.overrides.map((override) => (
                        <div key={override.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="font-medium text-white">{override.overrideType}</p>
                              <p className="text-xs text-white/40">Created {formatDate(override.createdAt)}</p>
                              <p className="mt-2 text-white/80">{override.reason}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="border-white/20 text-white hover:bg-white/5"
                              onClick={() => void handleRevokeOverride(override.id)}
                              disabled={savingOverride}
                            >
                              Revoke
                            </Button>
                          </div>
                          {Object.keys(override.payload || {}).length > 0 && (
                            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded bg-black/30 p-3 text-xs text-white/70">
                              {JSON.stringify(override.payload, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
