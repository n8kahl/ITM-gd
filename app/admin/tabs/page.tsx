'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PanelTop,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DiscordRolePicker } from '@/components/admin/discord-role-picker'
import { cn } from '@/lib/utils'

type MembershipTier = 'core' | 'pro' | 'executive' | 'admin'
type BadgeVariant = 'emerald' | 'champagne' | 'destructive' | null

type TabConfig = {
  tab_id: string
  label: string
  icon: string
  path: string
  required_tier: MembershipTier
  required_discord_role_ids: string[] | null
  badge_text: string | null
  badge_variant: BadgeVariant
  description: string | null
  mobile_visible: boolean
  sort_order: number
  is_required: boolean
  is_active: boolean
}

interface DiscordRole {
  id: string
  name: string
}

const EMPTY_TAB = (index: number): TabConfig => ({
  tab_id: `custom-tab-${Date.now()}-${index}`,
  label: 'New Tab',
  icon: 'LayoutDashboard',
  path: '/members/new-tab',
  required_tier: 'core',
  required_discord_role_ids: null,
  badge_text: null,
  badge_variant: null,
  description: null,
  mobile_visible: true,
  sort_order: 100 + index,
  is_required: false,
  is_active: true,
})

function normalizeTabId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
}

function normalizeRoleIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const roleIds = value
    .map((id) => String(id).trim())
    .filter(Boolean)
  return roleIds.length > 0 ? Array.from(new Set(roleIds)) : null
}

function parseRoleIdsInput(value: string): string[] | null {
  const roleIds = value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return roleIds.length > 0 ? Array.from(new Set(roleIds)) : null
}

function formatRoleIdsInput(value: string[] | null | undefined): string {
  if (!value || value.length === 0) return ''
  return value.join(', ')
}

export default function AdminTabsPage() {
  const [tabs, setTabs] = useState<TabConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saveWarnings, setSaveWarnings] = useState<string[]>([])
  const [discordRoleMap, setDiscordRoleMap] = useState<Record<string, string>>({})
  const [newRoleSelectionByTabId, setNewRoleSelectionByTabId] = useState<Record<string, string>>({})
  const feedbackRef = useRef<HTMLDivElement>(null)

  const loadTabs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/tabs', { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        setError(payload?.error?.message || 'Failed to load tab configurations')
        return
      }

      setSaveWarnings([])
      setTabs((payload.data || []).map((tab: TabConfig) => ({
        ...tab,
        required_discord_role_ids: normalizeRoleIds(tab.required_discord_role_ids),
      })))
    } catch {
      setError('Failed to load tab configurations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTabs()
  }, [loadTabs])

  const loadDiscordRoles = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/discord/roles', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload?.success || !Array.isArray(payload?.roles)) {
        return
      }

      const map: Record<string, string> = {}
      for (const role of payload.roles as DiscordRole[]) {
        const roleId = String(role.id || '').trim()
        const roleName = String(role.name || '').trim()
        if (!roleId || !roleName) continue
        map[roleId] = roleName
      }
      setDiscordRoleMap(map)
    } catch {
      // Non-fatal: tab editor still works with plain role IDs.
    }
  }, [])

  useEffect(() => {
    loadDiscordRoles()
  }, [loadDiscordRoles])

  useEffect(() => {
    if ((error || success) && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [error, success])

  const updateTab = (index: number, patch: Partial<TabConfig>) => {
    setTabs((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  const addTab = () => {
    setTabs((prev) => [...prev, EMPTY_TAB(prev.length)])
  }

  const removeTab = (index: number) => {
    setTabs((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  const addRoleToTab = (index: number, roleId: string) => {
    const normalizedRoleId = roleId.trim()
    if (!normalizedRoleId) return

    const existingRoleIds = normalizeRoleIds(tabs[index]?.required_discord_role_ids) || []
    if (existingRoleIds.includes(normalizedRoleId)) {
      return
    }

    updateTab(index, {
      required_discord_role_ids: [...existingRoleIds, normalizedRoleId],
    })

    const tabId = tabs[index]?.tab_id || ''
    if (tabId) {
      setNewRoleSelectionByTabId((prev) => ({
        ...prev,
        [tabId]: '',
      }))
    }
  }

  const duplicateTabIds = useMemo(() => {
    const map = new Map<string, number>()
    tabs.forEach((tab) => {
      const key = normalizeTabId(tab.tab_id)
      if (!key) return
      map.set(key, (map.get(key) || 0) + 1)
    })

    return new Set(
      Array.from(map.entries())
        .filter(([, count]) => count > 1)
        .map(([id]) => id),
    )
  }, [tabs])

  const handleSave = async () => {
    setError(null)
    setSuccess(null)

    if (tabs.length === 0) {
      setError('At least one tab configuration is required')
      return
    }

    for (const tab of tabs) {
      if (!normalizeTabId(tab.tab_id) || !tab.label.trim() || !tab.path.trim()) {
        setError('Each tab needs a valid tab ID, label, and path')
        return
      }
    }

    if (duplicateTabIds.size > 0) {
      setError(`Duplicate tab IDs found: ${Array.from(duplicateTabIds).join(', ')}`)
      return
    }

    setSaving(true)
    try {
      const payloadTabs = tabs.map((tab) => ({
        ...tab,
        tab_id: normalizeTabId(tab.tab_id),
        label: tab.label.trim(),
        icon: tab.icon.trim() || 'LayoutDashboard',
        path: tab.path.trim(),
        required_discord_role_ids: normalizeRoleIds(tab.required_discord_role_ids),
        badge_text: tab.badge_text?.trim() || null,
        description: tab.description?.trim() || null,
      }))

      const response = await fetch('/api/admin/tabs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabs: payloadTabs }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        setSaveWarnings([])
        setError(payload?.error?.message || 'Failed to save tab configurations')
        return
      }

      const unknownRoleIds = Array.isArray(payload?.warnings?.unknown_role_ids)
        ? payload.warnings.unknown_role_ids.map((id: unknown) => String(id))
        : []
      setSaveWarnings(unknownRoleIds)
      setTabs(payload.data || payloadTabs)
      setSuccess(unknownRoleIds.length > 0
        ? 'Tab configuration saved with warnings'
        : 'Tab configuration saved')
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setSaveWarnings([])
      setError('Failed to save tab configurations')
    } finally {
      setSaving(false)
    }
  }

  const resolveRoleTitle = (roleId: string): string => {
    const title = discordRoleMap[roleId]
    return title && title.length > 0 ? title : roleId
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading tab configurations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
            <PanelTop className="w-8 h-8 text-emerald-500" />
            Member Tabs
          </h1>
          <p className="text-white/60 mt-1">
            Configure member navigation tabs by membership tier.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={loadTabs}
            className="border-white/20 text-white hover:bg-white/5"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload
          </Button>
          <Button
            onClick={addTab}
            className="bg-emerald-500 hover:bg-emerald-600 text-black"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Tab
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-champagne text-black hover:opacity-90"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <div ref={feedbackRef}>
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-400">{success}</p>
          </div>
        )}

        {saveWarnings.length > 0 && (
          <div className="mt-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-200 font-medium">Unknown Discord role IDs detected</p>
              <p className="text-xs text-amber-100/80 mt-1 break-all">
                {saveWarnings.join(', ')}
              </p>
            </div>
          </div>
        )}
      </div>

      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Tier Mapping Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/70">
              Tabs are assigned by <code>required_tier</code>. Discord roles map to tiers in Admin Settings.
            </p>
            <Link
              href="/admin/settings#membership-tier-mapping"
              className="inline-flex items-center rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/5"
            >
              Manage Role To Tier Mapping
            </Link>
          </div>
        </CardContent>
      </Card>

      {tabs.map((tab, index) => {
        const normalizedId = normalizeTabId(tab.tab_id)
        const hasDuplicateId = normalizedId && duplicateTabIds.has(normalizedId)
        return (
          <Card key={`${tab.tab_id}-${index}`} className="bg-[#0a0a0b] border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-white text-base">
                  {tab.label || 'Untitled Tab'}
                </CardTitle>
                <Button
                  variant="ghost"
                  onClick={() => removeTab(index)}
                  className="text-red-400/80 hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-xs text-white/60">Tab ID</span>
                  <input
                    value={tab.tab_id}
                    onChange={(event) => updateTab(index, { tab_id: event.target.value })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                  {hasDuplicateId && (
                    <span className="text-xs text-red-400">Duplicate tab ID</span>
                  )}
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-white/60">Label</span>
                  <input
                    value={tab.label}
                    onChange={(event) => updateTab(index, { label: event.target.value })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-white/60">Path</span>
                  <input
                    value={tab.path}
                    onChange={(event) => updateTab(index, { path: event.target.value })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-white/60">Icon (Lucide name)</span>
                  <input
                    value={tab.icon}
                    onChange={(event) => updateTab(index, { icon: event.target.value })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-white/60">Required Tier</span>
                  <select
                    value={tab.required_tier}
                    onChange={(event) => updateTab(index, { required_tier: event.target.value as MembershipTier })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                  >
                    <option value="core">Core</option>
                    <option value="pro">Pro</option>
                    <option value="executive">Executive</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-white/60">Sort Order</span>
                  <input
                    type="number"
                    value={tab.sort_order}
                    onChange={(event) => updateTab(index, { sort_order: Number(event.target.value) || 0 })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-white/60">Required Discord Roles</span>
                  <input
                    value={formatRoleIdsInput(tab.required_discord_role_ids)}
                    onChange={(event) => updateTab(index, { required_discord_role_ids: parseRoleIdsInput(event.target.value) })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                    placeholder="Comma-separated role IDs (optional)"
                  />
                  <span className="block text-[11px] text-white/40">
                    If set, users must have one of these Discord role IDs to see this tab.
                  </span>
                  {(tab.required_discord_role_ids || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(tab.required_discord_role_ids || []).map((roleId) => {
                        const isKnownRole = Boolean(discordRoleMap[roleId])
                        return (
                          <span
                            key={roleId}
                            className={cn(
                              'px-2 py-1 rounded-md text-xs border',
                              isKnownRole
                                ? 'bg-white/5 border-white/10 text-white/80'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-100',
                            )}
                          >
                            {resolveRoleTitle(roleId)}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <div className="mt-2 flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <DiscordRolePicker
                        value={newRoleSelectionByTabId[tab.tab_id] || ''}
                        onChange={(roleId) => setNewRoleSelectionByTabId((prev) => ({
                          ...prev,
                          [tab.tab_id]: roleId,
                        }))}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addRoleToTab(index, newRoleSelectionByTabId[tab.tab_id] || '')}
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      Add Role
                    </Button>
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-white/60">Badge Text</span>
                  <input
                    value={tab.badge_text || ''}
                    onChange={(event) => updateTab(index, { badge_text: event.target.value || null })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                    placeholder="Optional"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-white/60">Badge Variant</span>
                  <select
                    value={tab.badge_variant || ''}
                    onChange={(event) => updateTab(index, { badge_variant: (event.target.value || null) as BadgeVariant })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                  >
                    <option value="">None</option>
                    <option value="emerald">Emerald</option>
                    <option value="champagne">Champagne</option>
                    <option value="destructive">Destructive</option>
                  </select>
                </label>

                <label className="space-y-1 lg:col-span-2">
                  <span className="text-xs text-white/60">Description</span>
                  <textarea
                    value={tab.description || ''}
                    onChange={(event) => updateTab(index, { description: event.target.value || null })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white min-h-[80px]"
                    placeholder="Optional description"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/70">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tab.mobile_visible}
                    onChange={(event) => updateTab(index, { mobile_visible: event.target.checked })}
                  />
                  Mobile visible
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tab.is_required}
                    onChange={(event) => updateTab(index, { is_required: event.target.checked })}
                  />
                  Required tab
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tab.is_active}
                    onChange={(event) => updateTab(index, { is_active: event.target.checked })}
                  />
                  Active
                </label>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
