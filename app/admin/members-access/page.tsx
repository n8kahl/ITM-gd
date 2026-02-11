'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type LookupMode = 'user_id' | 'email' | 'discord_user_id'

export default function AdminMembersAccessPage() {
  const [mode, setMode] = useState<LookupMode>('email')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any | null>(null)

  const canSync = useMemo(() => Boolean(result?.user?.id), [result?.user?.id])

  const lookup = useCallback(async () => {
    const value = query.trim()
    if (!value) {
      setError('Enter a value to search')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ [mode]: value })
      const response = await fetch(`/api/admin/members/access?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        setResult(null)
        setError(payload?.error || 'Lookup failed')
        return
      }

      setResult(payload)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }, [mode, query])

  const forceSync = useCallback(async () => {
    if (!result?.user?.id) {
      setError('Lookup a user first')
      return
    }

    setSyncing(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/members/force-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: result.user.id }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        setError(payload?.error || 'Force sync failed')
        return
      }

      // Re-fetch the debugger view (it includes tier/tabs and claim checks).
      const refreshed = await fetch(`/api/admin/members/access?user_id=${encodeURIComponent(result.user.id)}`, { cache: 'no-store' })
      const refreshedPayload = await refreshed.json()
      if (refreshed.ok && refreshedPayload?.success) {
        setResult(refreshedPayload)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Force sync failed')
    } finally {
      setSyncing(false)
    }
  }, [result?.user?.id])

  const hasMembersRole = result?.access?.has_members_required_role === true
  const resolvedTier = result?.access?.resolved_tier || null
  const effectiveRoles = Array.isArray(result?.access?.effective_role_ids) ? result.access.effective_role_ids : []
  const lastSyncedAt = result?.discord_profile?.last_synced_at || null
  const expectedMissing = Array.isArray(result?.permissions?.expected_missing) ? result.permissions.expected_missing : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-emerald-500" />
            Member Access Debugger
          </h1>
          <p className="text-white/60 mt-1">
            Look up a user and diagnose Discord role sync, tier mapping, tab access, and the Members-area gate.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/5">
            <Link href="/admin/settings#membership-tier-mapping">Tier Mapping</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/5">
            <Link href="/admin/tabs">Member Tabs</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/5">
            <Link href="/admin/roles">Role Permissions</Link>
          </Button>
        </div>
      </div>

      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <label className="space-y-1 lg:col-span-1">
              <span className="text-xs text-white/60">Search by</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as LookupMode)}
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
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') lookup()
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

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
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
                <span className="text-white">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Expected missing perms</span>
                <span className="text-white">{expectedMissing.length}</span>
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
                  Uses the Discord bot token to resync roles and refresh Supabase auth claims.
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
                  <p className="text-white text-sm font-medium">Allowed tabs (by tier)</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(result.access?.allowed_tabs) ? result.access.allowed_tabs : []).map((tabId: string) => (
                    <span key={tabId} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/80">
                      {tabId}
                    </span>
                  ))}
                </div>
              </div>

              {expectedMissing.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-amber-200 text-sm font-medium mb-2">Missing permissions (expected from mappings)</p>
                  <div className="flex flex-wrap gap-2">
                    {expectedMissing.map((perm: string) => (
                      <span key={perm} className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-100">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!hasMembersRole && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-red-200 text-sm font-medium">Members gate failed</p>
                  <p className="text-xs text-red-200/70 mt-1">
                    The user is missing the required Discord role ID shown in `constants.members_required_role_id`.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

