'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  DetailData,
  DirectoryRow,
  RoleMutationResponse,
  TradeBrowseEntry,
} from '@/components/admin/members-access/members-access-types'
import type {
  DetailResponse,
  DirectoryResponse,
  TradeBrowseResponse,
} from '@/components/admin/members-access/members-access-types'
import {
  buildPayloadTabIds,
  getErrorMessage,
} from '@/components/admin/members-access/members-access-types'

export function useMembersAccess() {
  const [query, setQuery] = useState('')
  const [linkedFilter, setLinkedFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState('all')
  const [overrideFilter, setOverrideFilter] = useState('all')
  const [privilegedFilter, setPrivilegedFilter] = useState('all')
  const [directoryRows, setDirectoryRows] = useState<DirectoryRow[]>([])
  const [directoryLoading, setDirectoryLoading] = useState(true)
  const [directoryError, setDirectoryError] = useState<string | null>(null)
  const [selectedDiscordUserId, setSelectedDiscordUserId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [syncingGuild, setSyncingGuild] = useState(false)
  const [syncingMember, setSyncingMember] = useState(false)
  const [savingOverride, setSavingOverride] = useState(false)
  const [rolePreview, setRolePreview] = useState<RoleMutationResponse['data'] | null>(null)
  const [roleMutationLoading, setRoleMutationLoading] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [memberTrades, setMemberTrades] = useState<TradeBrowseEntry[]>([])
  const [memberTradesLoading, setMemberTradesLoading] = useState(false)
  const [memberTradesError, setMemberTradesError] = useState<string | null>(null)
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null)

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

  const loadMemberTrades = useCallback(async (linkedUserId: string) => {
    setMemberTradesLoading(true)
    setMemberTradesError(null)

    try {
      const params = new URLSearchParams({
        memberId: linkedUserId,
        sortBy: 'trade_date',
        sortDir: 'desc',
        limit: '200',
      })

      const response = await fetch(`/api/admin/trade-review/browse?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json() as TradeBrowseResponse
      if (!response.ok || !payload.success) {
        setMemberTrades([])
        setMemberTradesError(payload.error || 'Failed to load member trades')
        return
      }

      const trades = payload.data || []
      setMemberTrades(trades)
      setSelectedTradeId((current) => (
        current && trades.some((entry) => entry.id === current)
          ? current
          : trades[0]?.id || null
      ))
    } catch (error) {
      setMemberTrades([])
      setMemberTradesError(error instanceof Error ? error.message : 'Failed to load member trades')
    } finally {
      setMemberTradesLoading(false)
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
    setActionMessage(null)
    setActionError(null)
    setMemberTrades([])
    setMemberTradesError(null)
    setSelectedTradeId(null)
  }, [selectedDiscordUserId])

  useEffect(() => {
    if (!selectedDiscordUserId) {
      setMemberTrades([])
      setMemberTradesError(null)
      setMemberTradesLoading(false)
      return
    }
    if (detail?.identity.discord_user_id !== selectedDiscordUserId) return
    if (!detail.identity.linked_user_id) {
      setMemberTrades([])
      setMemberTradesError(null)
      setMemberTradesLoading(false)
      return
    }
    void loadMemberTrades(detail.identity.linked_user_id)
  }, [
    detail?.identity.discord_user_id,
    detail?.identity.linked_user_id,
    loadMemberTrades,
    selectedDiscordUserId,
  ])

  const selectedRow = useMemo(
    () => directoryRows.find((row) => row.discord_user_id === selectedDiscordUserId) || null,
    [directoryRows, selectedDiscordUserId],
  )

  const selectedTrade = useMemo(
    () => memberTrades.find((entry) => entry.id === selectedTradeId) || memberTrades[0] || null,
    [memberTrades, selectedTradeId],
  )

  const tradeSummary = useMemo(() => {
    const resolvedPnls = memberTrades
      .map((entry) => entry.pnl)
      .filter((value): value is number => value != null)
    const closedTrades = memberTrades.filter((entry) => entry.is_open === false)
    const wins = closedTrades.filter((entry) => entry.pnl != null && entry.pnl > 0).length
    const totalPnl = resolvedPnls.reduce((sum, value) => sum + value, 0)

    return {
      totalTrades: memberTrades.length,
      closedTrades: closedTrades.length,
      winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : null,
      totalPnl,
    }
  }, [memberTrades])

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

  const handleCreateOverride = useCallback(async (overrideType: string, reason: string, tabs: string, expiresAt: string) => {
    if (!selectedDiscordUserId || !reason) return
    setSavingOverride(true)
    try {
      const payload: Record<string, unknown> = {}
      if (overrideType === 'allow_specific_tabs' || overrideType === 'deny_specific_tabs') {
        payload.tab_ids = buildPayloadTabIds(tabs)
      }
      await fetch(`/api/admin/members/${selectedDiscordUserId}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          overrideType,
          reason,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          payload,
        }),
      })
      await Promise.all([loadDirectory(), loadDetail(selectedDiscordUserId)])
    } finally {
      setSavingOverride(false)
    }
  }, [loadDetail, loadDirectory, selectedDiscordUserId])

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

  const handlePreviewRoleMutation = useCallback(async (operation: 'add' | 'remove', roleId: string) => {
    if (!selectedDiscordUserId || !roleId) return
    setRoleMutationLoading(true)
    setActionMessage(null)
    setActionError(null)
    try {
      const response = await fetch(`/api/admin/members/${selectedDiscordUserId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', operation, roleId }),
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
  }, [selectedDiscordUserId])

  const handleApplyRoleMutation = useCallback(async (operation: 'add' | 'remove', roleId: string, reason: string) => {
    if (!selectedDiscordUserId || !roleId || !reason) return
    setRoleMutationLoading(true)
    setActionMessage(null)
    setActionError(null)
    try {
      const response = await fetch(`/api/admin/members/${selectedDiscordUserId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', operation, roleId, reason }),
      })
      const payload = await response.json() as RoleMutationResponse
      if (!response.ok || !payload.success) {
        setActionError(getErrorMessage(payload, 'Failed to apply Discord role change'))
        return
      }
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
  }, [loadDetail, loadDirectory, selectedDiscordUserId])

  const handleLinkMember = useCallback(async (userId: string, reason: string) => {
    if (!selectedDiscordUserId || !userId || !reason) return
    setLinkLoading(true)
    setActionMessage(null)
    setActionError(null)
    try {
      const response = await fetch(`/api/admin/members/${selectedDiscordUserId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason }),
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
  }, [loadDetail, loadDirectory, selectedDiscordUserId])

  const handleUnlinkMember = useCallback(async (reason: string) => {
    if (!selectedDiscordUserId || !reason) return
    setLinkLoading(true)
    setActionMessage(null)
    setActionError(null)
    try {
      const response = await fetch(`/api/admin/members/${selectedDiscordUserId}/unlink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setActionError(getErrorMessage(payload, 'Failed to unlink Discord member'))
        return
      }
      setActionMessage('Discord member unlinked and cached access state was cleared.')
      await Promise.all([loadDirectory(), loadDetail(selectedDiscordUserId)])
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to unlink Discord member')
    } finally {
      setLinkLoading(false)
    }
  }, [loadDetail, loadDirectory, selectedDiscordUserId])

  return {
    // Filter state
    query, setQuery,
    linkedFilter, setLinkedFilter,
    tierFilter, setTierFilter,
    overrideFilter, setOverrideFilter,
    privilegedFilter, setPrivilegedFilter,
    // Directory state
    directoryRows, directoryLoading, directoryError,
    selectedDiscordUserId, setSelectedDiscordUserId,
    // Detail state
    detail, detailLoading, detailError,
    selectedRow,
    // Sync state
    syncingGuild, syncingMember,
    // Override state
    savingOverride,
    // Role mutation state
    rolePreview, roleMutationLoading,
    // Link state
    linkLoading,
    // Action feedback
    actionMessage, actionError,
    // Trades state
    memberTrades, memberTradesLoading, memberTradesError,
    selectedTrade, selectedTradeId, setSelectedTradeId,
    tradeSummary,
    // Actions
    loadDirectory,
    loadDetail,
    loadMemberTrades,
    handleRefreshGuildRoster,
    handleSyncMember,
    handleCreateOverride,
    handleRevokeOverride,
    handlePreviewRoleMutation,
    handleApplyRoleMutation,
    handleLinkMember,
    handleUnlinkMember,
  }
}
