'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

type MembershipTier = 'core' | 'pro' | 'executive'
type BadgeVariant = 'emerald' | 'champagne' | 'destructive' | null

type TabConfig = {
  tab_id: string
  label: string
  icon: string
  path: string
  required_tier: MembershipTier
  badge_text: string | null
  badge_variant: BadgeVariant
  description: string | null
  mobile_visible: boolean
  sort_order: number
  is_required: boolean
  is_active: boolean
}

const EMPTY_TAB = (index: number): TabConfig => ({
  tab_id: `custom-tab-${Date.now()}-${index}`,
  label: 'New Tab',
  icon: 'LayoutDashboard',
  path: '/members/new-tab',
  required_tier: 'core',
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

export default function AdminTabsPage() {
  const [tabs, setTabs] = useState<TabConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

      setTabs(payload.data || [])
    } catch {
      setError('Failed to load tab configurations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTabs()
  }, [loadTabs])

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
        setError(payload?.error?.message || 'Failed to save tab configurations')
        return
      }

      setTabs(payload.data || payloadTabs)
      setSuccess('Tab configuration saved')
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError('Failed to save tab configurations')
    } finally {
      setSaving(false)
    }
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
