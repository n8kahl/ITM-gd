'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Loader2,
  PanelTop,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type LookupMode = 'user_id' | 'email' | 'discord_user_id'
type GapSeverity = 'critical' | 'warning' | 'info'

interface OverviewRole {
  role_id: string
  role_name: string | null
  is_known?: boolean
}

interface OverviewGap {
  id: string
  severity: GapSeverity
  title: string
  description: string
  count: number
  items: string[]
}

interface OverviewTab {
  tab_id: string
  label: string
  path: string
  required_tier: string
  required_roles: OverviewRole[]
  unknown_required_role_ids: string[]
  is_required: boolean
}

interface OverviewTierMapping {
  role_id: string
  role_name: string | null
  tier: string
  has_permission_mapping?: boolean
}

interface OverviewData {
  generated_at?: string
  intended_use?: {
    summary?: string
    controls?: string[]
  }
  counts?: Record<string, number>
  discord?: {
    guild_id_configured?: boolean
    bot_token_configured?: boolean
    invite_url_configured?: boolean
    guild_role_catalog_count?: number
    guild_role_catalog_last_synced_at?: string | null
    guild_role_catalog_error?: string | null
  }
  members_gate?: {
    roles?: OverviewRole[]
    matching_profile_count?: number
  }
  tiers?: {
    role_tier_mapping?: OverviewTierMapping[]
    roles_missing_tier_mapping?: OverviewRole[]
    tier_mapped_roles_without_permission_mapping?: OverviewTierMapping[]
    pricing_tiers?: Array<{
      tier_id: string
      tier_name: string
      discord_role_id: string | null
      discord_role_name: string | null
      is_active: boolean
    }>
  }
  permissions?: {
    unmapped_app_permissions?: string[]
    tier_fallback_permission_names?: string[]
  }
  tabs?: {
    active?: OverviewTab[]
  }
  sync?: {
    stale_profile_count?: number
    total_profile_count?: number
    stale_profiles?: Array<{
      user_id: string
      discord_user_id: string | null
      discord_username: string | null
      last_synced_at: string | null
    }>
  }
  diagnostics?: {
    query_errors?: string[]
  }
  thresholds?: {
    stale_sync_hours?: number
  }
  gaps?: OverviewGap[]
}

function formatRoleTitle(role: Pick<OverviewRole, 'role_id' | 'role_name'>): string {
  const roleName = role.role_name?.trim()
  if (roleName) return roleName
  return `Unknown role (${role.role_id})`
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

function gapContainerClass(severity: GapSeverity): string {
  if (severity === 'critical') return 'bg-red-500/10 border-red-500/30'
  if (severity === 'warning') return 'bg-amber-500/10 border-amber-500/30'
  return 'bg-blue-500/10 border-blue-500/30'
}

function gapTitleClass(severity: GapSeverity): string {
  if (severity === 'critical') return 'text-red-200'
  if (severity === 'warning') return 'text-amber-200'
  return 'text-blue-200'
}

function gapTextClass(severity: GapSeverity): string {
  if (severity === 'critical') return 'text-red-100/80'
  if (severity === 'warning') return 'text-amber-100/80'
  return 'text-blue-100/80'
}

export default function AdminMembersAccessPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const [mode, setMode] = useState<LookupMode>('email')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [result, setResult] = useState<any | null>(null)

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true)
    setOverviewError(null)

    try {
      const response = await fetch('/api/admin/members/access?overview=1', { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok || !payload?.success || payload?.mode !== 'overview') {
        setOverview(null)
        setOverviewError(payload?.error || 'Failed to load member access overview')
        return
      }

      setOverview(payload.overview || null)
    } catch (error) {
      setOverview(null)
      setOverviewError(error instanceof Error ? error.message : 'Failed to load member access overview')
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  const canSync = useMemo(() => Boolean(result?.user?.id), [result?.user?.id])

  const lookup = useCallback(async () => {
    const value = query.trim()
    if (!value) {
      setLookupError('Enter a value to search')
      return
    }

    setLoading(true)
    setLookupError(null)

    try {
      const params = new URLSearchParams({ [mode]: value })
      const response = await fetch(`/api/admin/members/access?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok || !payload?.success || payload?.mode !== 'user') {
        setResult(null)
        setLookupError(payload?.error || 'Lookup failed')
        return
      }

      setResult(payload)
    } catch (err) {
      setResult(null)
      setLookupError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }, [mode, query])

  const forceSync = useCallback(async () => {
    if (!result?.user?.id) {
      setLookupError('Lookup a user first')
      return
    }

    setSyncing(true)
    setLookupError(null)
    try {
      const response = await fetch('/api/admin/members/force-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: result.user.id }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        setLookupError(payload?.error || 'Force sync failed')
        return
      }

      const refreshed = await fetch(`/api/admin/members/access?user_id=${encodeURIComponent(result.user.id)}`, { cache: 'no-store' })
      const refreshedPayload = await refreshed.json()
      if (refreshed.ok && refreshedPayload?.success) {
        setResult(refreshedPayload)
      }

      await loadOverview()
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Force sync failed')
    } finally {
      setSyncing(false)
    }
  }, [loadOverview, result?.user?.id])

  const overviewCounts = overview?.counts || {}
  const overviewGaps = Array.isArray(overview?.gaps) ? overview.gaps : []
  const membersGateRoles = Array.isArray(overview?.members_gate?.roles) ? overview.members_gate.roles : []
  const activeTabs = Array.isArray(overview?.tabs?.active) ? overview.tabs.active : []
  const rolesMissingTierMapping = Array.isArray(overview?.tiers?.roles_missing_tier_mapping)
    ? overview.tiers.roles_missing_tier_mapping
    : []
  const tierMappedRolesWithoutPermissions = Array.isArray(overview?.tiers?.tier_mapped_roles_without_permission_mapping)
    ? overview.tiers.tier_mapped_roles_without_permission_mapping
    : []
  const unmappedPermissions = Array.isArray(overview?.permissions?.unmapped_app_permissions)
    ? overview.permissions.unmapped_app_permissions
    : []
  const staleProfiles = Array.isArray(overview?.sync?.stale_profiles) ? overview.sync.stale_profiles : []
  const diagnosticsErrors = Array.isArray(overview?.diagnostics?.query_errors)
    ? overview.diagnostics.query_errors
    : []

  const hasMembersRole = result?.access?.has_members_required_role === true
  const resolvedTier = result?.access?.resolved_tier || null
  const effectiveRoles = Array.isArray(result?.access?.effective_roles) ? result.access.effective_roles : []
  const membersAllowedRoleIds = Array.isArray(result?.constants?.members_allowed_role_ids)
    ? result.constants.members_allowed_role_ids
    : []
  const membersAllowedRoleTitlesById: Record<string, string> = (
    result?.constants?.members_allowed_role_titles_by_id
    && typeof result.constants.members_allowed_role_titles_by_id === 'object'
  )
    ? result.constants.members_allowed_role_titles_by_id
    : {}
  const membersAllowedRoleTitles = membersAllowedRoleIds.map((roleId: string) => (
    membersAllowedRoleTitlesById[roleId] || `Unknown role (${roleId})`
  ))
  const lastSyncedAt = result?.discord_profile?.last_synced_at || null
  const expectedMissing = Array.isArray(result?.permissions?.expected_missing) ? result.permissions.expected_missing : []
  const lookupSource = String(result?.resolution?.source || 'direct')
  const effectiveRolesSource = String(result?.diagnosis?.effective_roles_source || 'none')
  const guildRoleCatalogError = typeof result?.diagnosis?.discord_guild_role_catalog_error === 'string'
    ? result.diagnosis.discord_guild_role_catalog_error
    : null
  const allowedTabsDetailed = Array.isArray(result?.access?.allowed_tabs_details)
    ? result.access.allowed_tabs_details
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-emerald-500" />
            Member Access Control Center
          </h1>
          <p className="text-white/60 mt-1">
            Discord/member access health, gap analysis, and user-level diagnostics for login + tab visibility.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={loadOverview}
            disabled={overviewLoading}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/5"
          >
            {overviewLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh Overview
          </Button>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/5">
            <Link href="/admin/settings#membership-tier-mapping">
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Settings
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/5">
            <Link href="/admin/roles">
              <Shield className="w-4 h-4 mr-2" />
              Role Permissions
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/5">
            <Link href="/admin/tabs">
              <PanelTop className="w-4 h-4 mr-2" />
              Member Tabs
            </Link>
          </Button>
        </div>
      </div>

      {overviewLoading && (
        <Card className="bg-[#0a0a0b] border-white/10">
          <CardContent className="py-10 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto mb-3" />
            <p className="text-sm text-white/60">Loading member access overview...</p>
          </CardContent>
        </Card>
      )}

      {!overviewLoading && overviewError && (
        <Card className="bg-[#0a0a0b] border-red-500/30">
          <CardContent className="py-4">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <p className="text-sm text-red-300">{overviewError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!overviewLoading && !overviewError && overview && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
            <Card className="bg-[#0a0a0b] border-white/10">
              <CardContent className="pt-5">
                <p className="text-xs text-white/60">Gate Roles</p>
                <p className="text-2xl font-semibold text-white mt-1">{overviewCounts.members_gate_role_count || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0a0a0b] border-white/10">
              <CardContent className="pt-5">
                <p className="text-xs text-white/60">Active Tabs</p>
                <p className="text-2xl font-semibold text-white mt-1">{overviewCounts.active_tab_count || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0a0a0b] border-white/10">
              <CardContent className="pt-5">
                <p className="text-xs text-white/60">Role Permission Maps</p>
                <p className="text-2xl font-semibold text-white mt-1">{overviewCounts.role_permission_mapping_count || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0a0a0b] border-white/10">
              <CardContent className="pt-5">
                <p className="text-xs text-white/60">Tier Mapped Roles</p>
                <p className="text-2xl font-semibold text-white mt-1">{overviewCounts.tier_mapped_role_count || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0a0a0b] border-white/10">
              <CardContent className="pt-5">
                <p className="text-xs text-white/60">Stale Discord Profiles</p>
                <p className="text-2xl font-semibold text-white mt-1">{overviewCounts.stale_discord_profile_count || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0a0a0b] border-white/10">
              <CardContent className="pt-5">
                <p className="text-xs text-white/60">Profiles Matching Gate</p>
                <p className="text-2xl font-semibold text-white mt-1">{overviewCounts.members_gate_profile_match_count || 0}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#0a0a0b] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Intended Use + Control Surface</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-white/80">{overview.intended_use?.summary || 'Member access controls overview.'}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(overview.intended_use?.controls || []).map((item) => (
                  <div key={item} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white/70">
                    {item}
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/40">
                Snapshot generated {formatDateTime(overview.generated_at)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#0a0a0b] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Gap Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {overviewGaps.length === 0 ? (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm text-emerald-300">No member access gaps detected in this snapshot.</p>
                </div>
              ) : (
                overviewGaps.map((gap) => (
                  <div key={gap.id} className={`p-3 rounded-lg border ${gapContainerClass(gap.severity)}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={`text-sm font-medium ${gapTitleClass(gap.severity)}`}>
                        {gap.title}
                      </p>
                      <span className="text-xs text-white/60">{gap.count}</span>
                    </div>
                    <p className={`text-xs mt-1 ${gapTextClass(gap.severity)}`}>
                      {gap.description}
                    </p>
                    {gap.items.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {gap.items.slice(0, 8).map((item) => (
                          <span
                            key={`${gap.id}-${item}`}
                            className="px-2 py-1 rounded-md bg-black/30 border border-white/10 text-xs text-white/80"
                          >
                            {item}
                          </span>
                        ))}
                        {gap.items.length > 8 && (
                          <span className="px-2 py-1 rounded-md bg-black/30 border border-white/10 text-xs text-white/60">
                            +{gap.items.length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="bg-[#0a0a0b] border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Members Gate Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-white/60">Guild ID Configured</p>
                    <p className={overview.discord?.guild_id_configured ? 'text-emerald-300' : 'text-red-300'}>
                      {overview.discord?.guild_id_configured ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-white/60">Bot Token Configured</p>
                    <p className={overview.discord?.bot_token_configured ? 'text-emerald-300' : 'text-red-300'}>
                      {overview.discord?.bot_token_configured ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-white/60">Allowed Discord Roles ({membersGateRoles.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {membersGateRoles.length === 0 && (
                      <span className="text-xs text-white/50">No roles configured.</span>
                    )}
                    {membersGateRoles.map((role) => (
                      <span
                        key={role.role_id}
                        className={`px-2 py-1 rounded-md border text-xs ${
                          role.is_known === false
                            ? 'bg-red-500/10 border-red-500/30 text-red-200'
                            : 'bg-white/5 border-white/10 text-white/80'
                        }`}
                      >
                        {formatRoleTitle(role)}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-white/40">
                  Guild role catalog: {overview.discord?.guild_role_catalog_count || 0} roles, last sync {formatDateTime(overview.discord?.guild_role_catalog_last_synced_at)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0a0a0b] border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Tier + Permission Coverage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-white/60 mb-2">Roles missing tier mapping ({rolesMissingTierMapping.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {rolesMissingTierMapping.length === 0 && (
                      <span className="text-xs text-emerald-300">None</span>
                    )}
                    {rolesMissingTierMapping.map((role) => (
                      <span key={role.role_id} className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-100">
                        {formatRoleTitle(role)}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-white/60 mb-2">Tier roles without explicit permission mapping ({tierMappedRolesWithoutPermissions.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {tierMappedRolesWithoutPermissions.length === 0 && (
                      <span className="text-xs text-emerald-300">None</span>
                    )}
                    {tierMappedRolesWithoutPermissions.map((role) => (
                      <span key={role.role_id} className="px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-xs text-blue-100">
                        {formatRoleTitle(role)} ({role.tier})
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-white/60 mb-2">Unmapped app permissions ({unmappedPermissions.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {unmappedPermissions.length === 0 && (
                      <span className="text-xs text-emerald-300">None</span>
                    )}
                    {unmappedPermissions.map((permissionName) => (
                      <span key={permissionName} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/80">
                        {permissionName}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#0a0a0b] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Active Tab Access Matrix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeTabs.length === 0 ? (
                <p className="text-sm text-white/50">No active tab configuration found.</p>
              ) : (
                activeTabs.map((tab) => (
                  <div key={tab.tab_id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <p className="text-sm text-white font-medium">{tab.label}</p>
                        <p className="text-xs text-white/50">{tab.path}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/70">
                          Tier: {tab.required_tier}
                        </span>
                        {tab.is_required && (
                          <span className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">
                            Required
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tab.required_roles.length === 0 && (
                        <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/50">
                          No Discord role gate
                        </span>
                      )}
                      {tab.required_roles.map((role) => (
                        <span
                          key={`${tab.tab_id}-${role.role_id}`}
                          className={`px-2 py-1 rounded-md border text-xs ${
                            role.is_known === false
                              ? 'bg-red-500/10 border-red-500/30 text-red-200'
                              : 'bg-white/5 border-white/10 text-white/80'
                          }`}
                        >
                          {formatRoleTitle(role)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#0a0a0b] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Sync Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-white/60 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Total Discord Profiles
                  </p>
                  <p className="text-white text-xl">{overview.sync?.total_profile_count || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-white/60 flex items-center gap-1">
                    <Clock3 className="w-3.5 h-3.5" />
                    Stale Profiles ({overview.thresholds?.stale_sync_hours || 24}h)
                  </p>
                  <p className={(overview.sync?.stale_profile_count || 0) > 0 ? 'text-amber-300 text-xl' : 'text-emerald-300 text-xl'}>
                    {overview.sync?.stale_profile_count || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-white/60 flex items-center gap-1">
                    <Database className="w-3.5 h-3.5" />
                    Diagnostics Errors
                  </p>
                  <p className={diagnosticsErrors.length > 0 ? 'text-amber-300 text-xl' : 'text-emerald-300 text-xl'}>
                    {diagnosticsErrors.length}
                  </p>
                </div>
              </div>

              {staleProfiles.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                  <p className="text-amber-100 text-sm font-medium mb-2">Oldest stale profiles</p>
                  <div className="space-y-1">
                    {staleProfiles.slice(0, 5).map((profile) => (
                      <p key={profile.user_id} className="text-xs text-amber-100/80 break-all">
                        {profile.discord_username || profile.user_id} · last sync {formatDateTime(profile.last_synced_at)}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {overview.discord?.guild_role_catalog_error && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                  <p className="text-amber-100 text-sm font-medium">Guild role catalog warning</p>
                  <p className="text-xs text-amber-100/80 mt-1 break-all">
                    {overview.discord.guild_role_catalog_error}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">User Access Debugger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <label className="space-y-1 lg:col-span-1">
              <span className="text-xs text-white/60">Search by</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as LookupMode)}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
              >
                <option value="email">Email</option>
                <option value="user_id">Supabase user_id</option>
                <option value="discord_user_id">Discord user ID</option>
              </select>
            </label>

            <label className="space-y-1 lg:col-span-3">
              <span className="text-xs text-white/60">Value</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') lookup()
                }}
                placeholder={mode === 'email' ? 'member@example.com' : 'Enter ID'}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
              />
            </label>

            <div className="flex items-end gap-2 lg:col-span-1">
              <Button
                onClick={lookup}
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-black"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Lookup
              </Button>
            </div>
          </div>

          {lookupError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <p className="text-sm text-red-400">{lookupError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="bg-[#0a0a0b] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Members gate role</span>
                <span className={hasMembersRole ? 'text-emerald-400' : 'text-red-400'}>
                  {hasMembersRole ? 'PASS' : 'FAIL'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Resolved tier</span>
                <span className="text-white">{resolvedTier || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Effective roles</span>
                <span className="text-white">{effectiveRoles.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Last role sync</span>
                <span className="text-white">{formatDateTime(lastSyncedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Expected missing perms</span>
                <span className="text-white">{expectedMissing.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Lookup source</span>
                <span className="text-white">{lookupSource}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Roles source</span>
                <span className="text-white">{effectiveRolesSource}</span>
              </div>

              <div className="pt-2">
                <Button
                  onClick={forceSync}
                  disabled={!canSync || syncing}
                  className="w-full bg-champagne text-black hover:opacity-90"
                >
                  {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Force Discord Role Sync
                </Button>
                <p className="text-xs text-white/40 mt-2">
                  Re-syncs roles from Discord and refreshes auth claims for this user.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0a0a0b] border-white/10 xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-white text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-white/60 text-xs mb-1">User</p>
                  <p className="text-white break-all">{result.user?.email || '—'}</p>
                  <p className="text-white/40 text-xs break-all mt-1">{result.user?.id}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-white/60 text-xs mb-1">Discord</p>
                  <p className="text-white break-all">{result.discord_profile?.discord_username || '—'}</p>
                  <p className="text-white/40 text-xs break-all mt-1">{result.auth_metadata?.discord_user_id || '—'}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-white text-sm font-medium">Allowed tabs</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allowedTabsDetailed.map((tab: any) => (
                    <span key={tab.tab_id} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/80">
                      {tab.label || tab.tab_id}
                    </span>
                  ))}
                  {allowedTabsDetailed.length === 0 && (
                    <span className="text-xs text-white/50">No tabs granted.</span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-white text-sm font-medium">Effective Discord roles</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {effectiveRoles.map((role: OverviewRole) => (
                    <span key={role.role_id} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/80">
                      {formatRoleTitle(role)}
                    </span>
                  ))}
                  {effectiveRoles.length === 0 && (
                    <span className="text-xs text-white/50">No effective roles found.</span>
                  )}
                </div>
              </div>

              {expectedMissing.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-amber-200 text-sm font-medium mb-2">Missing permissions (expected from mappings)</p>
                  <div className="flex flex-wrap gap-2">
                    {expectedMissing.map((permissionName: string) => (
                      <span key={permissionName} className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-100">
                        {permissionName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!hasMembersRole && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-red-200 text-sm font-medium">Members gate failed</p>
                  <p className="text-xs text-red-200/70 mt-1">
                    The user is missing all allowed members roles ({membersAllowedRoleTitles.join(', ') || 'none configured'}).
                  </p>
                </div>
              )}

              {guildRoleCatalogError && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-amber-200 text-sm font-medium">Guild role catalog unavailable</p>
                  <p className="text-xs text-amber-200/80 mt-1 break-all">
                    {guildRoleCatalogError}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!overviewLoading && overview && overviewGaps.length > 0 && (
        <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5" />
          <p className="text-xs text-white/70">
            Review the gaps above, then use <Link href="/admin/settings#membership-tier-mapping" className="text-emerald-400 hover:underline">Settings</Link>,{' '}
            <Link href="/admin/roles" className="text-emerald-400 hover:underline">Role Permissions</Link>, and{' '}
            <Link href="/admin/tabs" className="text-emerald-400 hover:underline">Member Tabs</Link> to apply fixes.
          </p>
        </div>
      )}
    </div>
  )
}
