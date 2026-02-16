'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Target,
  CandlestickChart,
  Loader2,
  X,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Archive,
  RotateCcw,
  Trash2,
  MessageSquare,
  Edit3,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { motion } from 'framer-motion'
import { WidgetActionBar } from './widget-action-bar'
import { WidgetContextMenu } from './widget-context-menu'
import { runWithRetry } from './retry'
import {
  alertAction,
  analyzeAction,
  chartAction,
  chatAction,
  copyAction,
  optionsAction,
  type WidgetAction,
} from './widget-actions'
import {
  getTrackedSetups,
  updateTrackedSetup,
  deleteTrackedSetup,
  deleteTrackedSetupsBulk,
  AICoachAPIError,
  type TrackedSetup,
  type TrackedSetupStatus,
} from '@/lib/api/ai-coach'
import { usePriceStream } from '@/hooks/use-price-stream'
import {
  DEFAULT_TRACKED_SETUPS_PREFERENCES,
  filterTrackedSetups,
  loadTrackedSetupsPreferences,
  saveTrackedSetupsPreferences,
  sortTrackedSetups,
  type ActiveStatusFilter,
  type HistoryStatusFilter,
  type TrackedSetupsSortMode,
  type TrackedSetupsView,
} from '@/lib/ai-coach/tracked-setups'

interface TrackedSetupsPanelProps {
  onClose: () => void
  onSendPrompt?: (prompt: string) => void
}

const VIEW_FILTERS: Array<{ value: TrackedSetupsView; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'history', label: 'History' },
]

const ACTIVE_STATUS_FILTERS: Array<{ value: ActiveStatusFilter; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'triggered', label: 'Triggered' },
  { value: 'all', label: 'All' },
]

const HISTORY_STATUS_FILTERS: Array<{ value: HistoryStatusFilter; label: string }> = [
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
]

const SORT_MODES: Array<{ value: TrackedSetupsSortMode; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'highest_score', label: 'Highest Score' },
  { value: 'closest_to_trigger', label: 'Closest to Trigger' },
]

const STATUS_BADGE_STYLES: Record<TrackedSetupStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  triggered: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  invalidated: 'bg-red-500/15 text-red-300 border-red-500/25',
  archived: 'bg-white/10 text-white/60 border-white/15',
}

const DIRECTION_STYLES: Record<'bullish' | 'bearish' | 'neutral', string> = {
  bullish: 'text-emerald-400',
  bearish: 'text-red-400',
  neutral: 'text-amber-400',
}

const PRESSABLE_PROPS = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.98 },
}

interface SetupTradePlan {
  entry: number | null
  stopLoss: number | null
  target: number | null
  strike: number | null
  expiry: string | null
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.+-]/g, '')
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {}
}

function extractTradePlan(setup: TrackedSetup): SetupTradePlan {
  const opportunityData = asRecord(setup.opportunity_data)
  const suggestedTrade = asRecord(opportunityData.suggestedTrade)
  const metadata = asRecord(opportunityData.metadata)

  const strikes = Array.isArray(suggestedTrade.strikes) ? suggestedTrade.strikes : []
  const parsedStrikes = strikes
    .map((value) => parseNumeric(value))
    .filter((value): value is number => value != null)

  const entry = parseNumeric(suggestedTrade.entry)
    ?? parseNumeric(opportunityData.entry)
    ?? parseNumeric(opportunityData.currentPrice)
  const stopLoss = parseNumeric(suggestedTrade.stopLoss)
    ?? parseNumeric(opportunityData.stopLoss)
    ?? parseNumeric(metadata.stop_loss)
  const target = parseNumeric(suggestedTrade.target)
    ?? parseNumeric(opportunityData.target)
    ?? parseNumeric(metadata.target)
  const strike = parsedStrikes[0]
    ?? parseNumeric(opportunityData.strike)
    ?? entry
  const expiry = typeof suggestedTrade.expiry === 'string'
    ? suggestedTrade.expiry
    : typeof opportunityData.expiry === 'string'
      ? opportunityData.expiry
      : null

  return { entry, stopLoss, target, strike, expiry }
}

function buildChartOverlayAction(setup: TrackedSetup, plan: SetupTradePlan): WidgetAction {
  return {
    label: 'Chart Overlay',
    icon: CandlestickChart,
    variant: 'primary',
    action: () => {
      chartAction(
        setup.symbol,
        plan.entry ?? plan.strike ?? undefined,
        '15m',
        `${setup.setup_type} setup`,
      ).action()

      const support: Array<{ name: string; price: number }> = []
      const resistance: Array<{ name: string; price: number }> = []

      if (plan.entry != null) {
        if (setup.direction === 'bearish') {
          resistance.push({ name: 'Entry', price: plan.entry })
        } else {
          support.push({ name: 'Entry', price: plan.entry })
        }
      }

      if (plan.stopLoss != null) {
        if (setup.direction === 'bearish') {
          support.push({ name: 'Stop', price: plan.stopLoss })
        } else {
          resistance.push({ name: 'Stop', price: plan.stopLoss })
        }
      }

      if (plan.target != null) {
        if (setup.direction === 'bearish') {
          support.push({ name: 'Target', price: plan.target })
        } else {
          resistance.push({ name: 'Target', price: plan.target })
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai-coach-show-chart', {
          detail: {
            symbol: setup.symbol,
            timeframe: '15m',
            levels: {
              support: support.length > 0 ? support : undefined,
              resistance: resistance.length > 0 ? resistance : undefined,
            },
          },
        }))
      }
    },
  }
}

export function TrackedSetupsPanel({ onClose, onSendPrompt }: TrackedSetupsPanelProps) {
  const { session } = useMemberAuth()
  const token = session?.access_token
  const userId = session?.user?.id

  const [trackedSetups, setTrackedSetups] = useState<TrackedSetup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryNotice, setRetryNotice] = useState<string | null>(null)
  const [view, setView] = useState<TrackedSetupsView>(DEFAULT_TRACKED_SETUPS_PREFERENCES.view)
  const [activeStatusFilter, setActiveStatusFilter] = useState<ActiveStatusFilter>(DEFAULT_TRACKED_SETUPS_PREFERENCES.activeStatusFilter)
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>(DEFAULT_TRACKED_SETUPS_PREFERENCES.historyStatusFilter)
  const [sortMode, setSortMode] = useState<TrackedSetupsSortMode>(DEFAULT_TRACKED_SETUPS_PREFERENCES.sortMode)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mutatingIds, setMutatingIds] = useState<Record<string, boolean>>({})
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')

  const applyTrackedSetupUpdate = useCallback((trackedSetup: TrackedSetup) => {
    setTrackedSetups((prev) => {
      const exists = prev.some((item) => item.id === trackedSetup.id)
      const next = exists
        ? prev.map((item) => (item.id === trackedSetup.id ? trackedSetup : item))
        : [trackedSetup, ...prev]

      return filterTrackedSetups(next, view, activeStatusFilter, historyStatusFilter)
    })
  }, [activeStatusFilter, historyStatusFilter, view])

  const fetchSetups = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) return
    const silent = options?.silent === true
    if (!silent) setIsLoading(true)
    setError(null)
    setRetryNotice(null)

    try {
      const activeFilter = view === 'active' ? activeStatusFilter : 'all'
      const historyFilter = view === 'history' ? historyStatusFilter : 'all'
      const requestedStatus = activeFilter !== 'all'
        ? activeFilter
        : historyFilter !== 'all'
          ? historyFilter
          : undefined

      const result = await runWithRetry(
        () => getTrackedSetups(
          token,
          requestedStatus
            ? { status: requestedStatus }
            : { view },
        ),
        {
          onRetry: ({ nextAttempt, maxAttempts }) => {
            setRetryNotice(`Tracked setups feed retrying (${nextAttempt}/${maxAttempts})...`)
          },
        },
      )
      setTrackedSetups(
        filterTrackedSetups(result.trackedSetups, view, activeStatusFilter, historyStatusFilter),
      )
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to load tracked setups'
      setError(message)
    } finally {
      setRetryNotice(null)
      if (!silent) setIsLoading(false)
    }
  }, [activeStatusFilter, historyStatusFilter, token, view])

  useEffect(() => {
    if (!userId) return

    const preferences = loadTrackedSetupsPreferences(userId)
    setView(preferences.view)
    setActiveStatusFilter(preferences.activeStatusFilter)
    setHistoryStatusFilter(preferences.historyStatusFilter)
    setSortMode(preferences.sortMode)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    saveTrackedSetupsPreferences(userId, {
      view,
      activeStatusFilter,
      historyStatusFilter,
      sortMode,
    })
  }, [activeStatusFilter, historyStatusFilter, sortMode, userId, view])

  useEffect(() => {
    void fetchSetups()
  }, [fetchSetups])

  const setupChannel = userId ? `setups:${userId}` : null
  const handleRealtimeMessage = useCallback((message: { type?: string; channel?: string }) => {
    if (!setupChannel || message?.channel !== setupChannel) return
    if (message?.type === 'setup_update' || message?.type === 'setup_detected') {
      void fetchSetups({ silent: true })
    }
  }, [fetchSetups, setupChannel])

  usePriceStream(
    [],
    Boolean(token && setupChannel),
    token,
    {
      channels: setupChannel ? [setupChannel] : [],
      onMessage: handleRealtimeMessage,
    },
  )

  useEffect(() => {
    setSelectedIds((prev) => {
      const availableIds = new Set(trackedSetups.map((setup) => setup.id))
      const next = new Set<string>()
      for (const id of prev) {
        if (availableIds.has(id)) next.add(id)
      }
      return next
    })
  }, [trackedSetups])

  const setMutating = useCallback((id: string, value: boolean) => {
    setMutatingIds((prev) => ({ ...prev, [id]: value }))
  }, [])

  const undoInvalidation = useCallback(async (
    id: string,
    previousStatus: Exclude<TrackedSetupStatus, 'invalidated'>,
  ) => {
    if (!token) return

    setMutating(id, true)
    setError(null)

    try {
      const result = await updateTrackedSetup(id, token, { status: previousStatus })
      applyTrackedSetupUpdate(result.trackedSetup)
      toast.success('Invalidation reverted')
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to revert invalidation'
      setError(message)
      toast.error('Failed to revert invalidation')
    } finally {
      setMutating(id, false)
    }
  }, [applyTrackedSetupUpdate, setMutating, token])

  const handleStatusChange = useCallback(async (id: string, status: TrackedSetupStatus) => {
    if (!token) return

    const existingSetup = trackedSetups.find((item) => item.id === id)
    const previousStatus = existingSetup?.status

    setMutating(id, true)
    setError(null)

    try {
      const result = await updateTrackedSetup(id, token, { status })
      applyTrackedSetupUpdate(result.trackedSetup)

      if (
        status === 'invalidated'
        && previousStatus
        && previousStatus !== 'invalidated'
      ) {
        const revertStatus = previousStatus as Exclude<TrackedSetupStatus, 'invalidated'>
        toast('Setup invalidated', {
          description: `${result.trackedSetup.symbol} ${result.trackedSetup.setup_type} removed from tracked setups.`,
          duration: 8000,
          action: {
            label: 'Undo',
            onClick: () => {
              void undoInvalidation(id, revertStatus)
            },
          },
        })
      }
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to update setup status'
      setError(message)
    } finally {
      setMutating(id, false)
    }
  }, [applyTrackedSetupUpdate, setMutating, token, trackedSetups, undoInvalidation])

  const handleDelete = useCallback(async (id: string) => {
    if (!token) return

    setMutating(id, true)
    setError(null)

    try {
      await deleteTrackedSetup(id, token)
      setTrackedSetups((prev) => prev.filter((item) => item.id !== id))
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (editingNotesId === id) {
        setEditingNotesId(null)
        setNotesDraft('')
      }
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to delete tracked setup'
      setError(message)
    } finally {
      setMutating(id, false)
    }
  }, [editingNotesId, setMutating, token])

  const startEditingNotes = useCallback((setup: TrackedSetup) => {
    setEditingNotesId(setup.id)
    setNotesDraft(setup.notes || '')
  }, [])

  const cancelEditingNotes = useCallback(() => {
    setEditingNotesId(null)
    setNotesDraft('')
  }, [])

  const handleSaveNotes = useCallback(async (id: string) => {
    if (!token) return

    setMutating(id, true)
    setError(null)

    try {
      const result = await updateTrackedSetup(id, token, { notes: notesDraft.trim() || null })
      applyTrackedSetupUpdate(result.trackedSetup)
      setEditingNotesId(null)
      setNotesDraft('')
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to save notes'
      setError(message)
    } finally {
      setMutating(id, false)
    }
  }, [applyTrackedSetupUpdate, notesDraft, setMutating, token])

  const displayedSetups = useMemo(
    () => sortTrackedSetups(trackedSetups, sortMode),
    [sortMode, trackedSetups],
  )

  const allSelected = displayedSetups.length > 0
    && displayedSetups.every((setup) => selectedIds.has(setup.id))
  const selectedCount = selectedIds.size

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }

    setSelectedIds(new Set(displayedSetups.map((setup) => setup.id)))
  }, [allSelected, displayedSetups])

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const runBulkStatusUpdate = useCallback(async (status: TrackedSetupStatus) => {
    if (!token || selectedIds.size === 0) return

    const ids = Array.from(selectedIds)
    setError(null)
    ids.forEach((id) => setMutating(id, true))

    let successCount = 0
    let failureCount = 0

    for (const id of ids) {
      try {
        const result = await updateTrackedSetup(id, token, { status })
        applyTrackedSetupUpdate(result.trackedSetup)
        successCount += 1
      } catch {
        failureCount += 1
      } finally {
        setMutating(id, false)
      }
    }

    setSelectedIds(new Set())

    if (successCount > 0) {
      toast.success(`${successCount} setup${successCount === 1 ? '' : 's'} updated`)
    }
    if (failureCount > 0) {
      setError(`Failed to update ${failureCount} setup${failureCount === 1 ? '' : 's'}`)
    }
  }, [applyTrackedSetupUpdate, selectedIds, setMutating, token])

  const runBulkDelete = useCallback(async () => {
    if (!token || selectedIds.size === 0) return

    const ids = Array.from(selectedIds)
    setError(null)
    ids.forEach((id) => setMutating(id, true))

    try {
      let deletedIds = new Set<string>()

      try {
        const result = await deleteTrackedSetupsBulk(ids, token)
        deletedIds = new Set(result.deletedIds)
      } catch (bulkErr) {
        // Backward-compatible fallback while API rolls out.
        if (!(bulkErr instanceof AICoachAPIError) || (bulkErr.status !== 404 && bulkErr.status !== 405)) {
          throw bulkErr
        }

        for (const id of ids) {
          try {
            await deleteTrackedSetup(id, token)
            deletedIds.add(id)
          } catch {
            // Continue deleting best effort and report partial failures below.
          }
        }
      }

      const successCount = deletedIds.size
      const failureCount = ids.length - successCount

      if (successCount > 0) {
        setTrackedSetups((prev) => prev.filter((setup) => !deletedIds.has(setup.id)))
        toast.success(`${successCount} setup${successCount === 1 ? '' : 's'} deleted`)
      }

      if (failureCount > 0) {
        const failedIds = ids.filter((id) => !deletedIds.has(id))
        setError(`Failed to delete ${failureCount} setup${failureCount === 1 ? '' : 's'}`)
        toast.error(`Failed to delete ${failureCount} setup${failureCount === 1 ? '' : 's'}`)
        setSelectedIds(new Set(failedIds))
      } else {
        setSelectedIds(new Set())
      }
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to delete selected setups'
      setError(message)
      toast.error('Failed to delete selected setups')
    } finally {
      ids.forEach((id) => setMutating(id, false))
    }
  }, [selectedIds, setMutating, token])

  const statusFilters = view === 'active' ? ACTIVE_STATUS_FILTERS : HISTORY_STATUS_FILTERS

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-medium text-white">Tracked Setups</h2>
          {displayedSetups.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
              {displayedSetups.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => {
              void fetchSetups()
            }}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all',
              isLoading
                ? 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                : 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20',
            )}
            {...PRESSABLE_PROPS}
          >
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </motion.button>
          <motion.button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 transition-colors"
            {...PRESSABLE_PROPS}
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      <div className="px-4 py-2 flex items-center gap-2 border-b border-white/5 overflow-x-auto">
        {VIEW_FILTERS.map((candidate) => (
          <motion.button
            key={candidate.value}
            onClick={() => {
              setView(candidate.value)
              setSelectedIds(new Set())
            }}
            className={cn(
              'text-xs px-2 py-1 rounded transition-colors whitespace-nowrap',
              view === candidate.value
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-white/40 hover:text-white/60',
            )}
            {...PRESSABLE_PROPS}
          >
            {candidate.label}
          </motion.button>
        ))}

        <div className="w-px h-4 bg-white/10 mx-1" />

        {statusFilters.map((candidate) => (
          <motion.button
            key={candidate.value}
            onClick={() => {
              if (view === 'active') {
                setActiveStatusFilter(candidate.value as ActiveStatusFilter)
              } else {
                setHistoryStatusFilter(candidate.value as HistoryStatusFilter)
              }
              setSelectedIds(new Set())
            }}
            className={cn(
              'text-xs px-2 py-1 rounded transition-colors whitespace-nowrap',
              ((view === 'active' && activeStatusFilter === candidate.value)
                || (view === 'history' && historyStatusFilter === candidate.value))
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-white/40 hover:text-white/60',
            )}
            {...PRESSABLE_PROPS}
          >
            {candidate.label}
          </motion.button>
        ))}
      </div>

      <div className="px-4 py-2 flex items-center gap-2 border-b border-white/5 overflow-x-auto">
        <span className="text-[10px] uppercase tracking-wide text-white/35">Sort</span>
        {SORT_MODES.map((mode) => (
          <motion.button
            key={mode.value}
            onClick={() => setSortMode(mode.value)}
            className={cn(
              'text-xs px-2 py-1 rounded transition-colors whitespace-nowrap',
              sortMode === mode.value
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-white/40 hover:text-white/60',
            )}
            {...PRESSABLE_PROPS}
          >
            {mode.label}
          </motion.button>
        ))}
      </div>

      {!isLoading && !error && displayedSetups.length > 0 && (
        <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 rounded border border-white/30 bg-transparent accent-emerald-500"
            />
            Select all
          </label>

          {selectedCount > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs text-white/55 whitespace-nowrap">{selectedCount} selected</span>
              {view === 'active' && (
                <motion.button
                  onClick={() => {
                    void runBulkStatusUpdate('archived')
                  }}
                  className="text-[11px] px-2 py-1 rounded border border-white/15 bg-white/10 text-white/70 hover:bg-white/15 whitespace-nowrap"
                  {...PRESSABLE_PROPS}
                >
                  Archive Selected
                </motion.button>
              )}
              {view === 'history' && (
                <motion.button
                  onClick={() => {
                    void runBulkStatusUpdate('active')
                  }}
                  className="text-[11px] px-2 py-1 rounded border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/15 whitespace-nowrap"
                  {...PRESSABLE_PROPS}
                >
                  Reopen Selected
                </motion.button>
              )}
              <motion.button
                onClick={() => {
                  void runBulkDelete()
                }}
                className="text-[11px] px-2 py-1 rounded border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/15 whitespace-nowrap"
                {...PRESSABLE_PROPS}
              >
                Delete Selected
              </motion.button>
              <motion.button
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] px-2 py-1 rounded border border-white/15 bg-white/10 text-white/70 hover:bg-white/15 whitespace-nowrap"
                {...PRESSABLE_PROPS}
              >
                Clear
              </motion.button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            {retryNotice && (
              <p className="text-xs text-amber-300/80">{retryNotice}</p>
            )}
          </div>
        )}

        {!isLoading && error && (
          <div className="text-center py-12">
            <p className="text-sm text-red-400 mb-2">{error}</p>
            <motion.button
              onClick={() => {
                void fetchSetups()
              }}
              className="text-xs text-emerald-500 hover:text-emerald-400"
              {...PRESSABLE_PROPS}
            >
              Retry
            </motion.button>
          </div>
        )}

        {!isLoading && !error && displayedSetups.length === 0 && (
          <div className="text-center py-16">
            <Target className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40">{view === 'history' ? 'No history yet' : 'No active setups'}</p>
            <p className="text-xs text-white/25 mt-1">
              {view === 'history'
                ? 'Archived setups will appear here.'
                : 'Track scanner ideas to monitor them through the day.'}
            </p>
          </div>
        )}

        {!isLoading && !error && displayedSetups.length > 0 && (
          <div className="p-4 space-y-3">
            {displayedSetups.map((setup) => {
              const isMutating = !!mutatingIds[setup.id]
              const isEditingNotes = editingNotesId === setup.id
              const isSelected = selectedIds.has(setup.id)
              const score = typeof setup.opportunity_data?.score === 'number'
                ? setup.opportunity_data.score
                : null
              const plan = extractTradePlan(setup)
              const alertPrice = plan.entry ?? plan.strike
              const askPrompt = `Review my ${setup.setup_type} setup on ${setup.symbol}. It's currently ${setup.status}. Give me key risk/reward checkpoints and what to monitor next.`
              const workflowActions: WidgetAction[] = [
                buildChartOverlayAction(setup, plan),
                optionsAction(setup.symbol, plan.strike ?? undefined, plan.expiry ?? undefined),
                ...(alertPrice != null
                  ? [alertAction(
                      setup.symbol,
                      alertPrice,
                      setup.direction === 'bearish' ? 'price_below' : 'price_above',
                      `${setup.setup_type} (${setup.status})`,
                    )]
                  : []),
                analyzeAction({
                  symbol: setup.symbol,
                  type: setup.direction === 'bearish' ? 'put' : setup.direction === 'bullish' ? 'call' : 'stock',
                  strike: plan.strike ?? undefined,
                  expiry: plan.expiry ?? undefined,
                  quantity: 1,
                  entryPrice: plan.entry ?? 1,
                  entryDate: new Date().toISOString().slice(0, 10),
                }),
                chatAction(askPrompt),
              ]
              const contextActions = [
                ...workflowActions,
                copyAction(`${setup.symbol} ${setup.setup_type} ${setup.status}`),
              ]

              return (
                <WidgetContextMenu key={setup.id} actions={contextActions}>
                  <div
                    className={cn(
                      'glass-card-heavy rounded-lg p-3 border border-white/10',
                      isSelected && 'ring-1 ring-emerald-500/50 border-emerald-500/30',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(setup.id)}
                            className="h-3.5 w-3.5 rounded border border-white/30 bg-transparent accent-emerald-500"
                          />
                          <span className="text-[10px] text-white/45 uppercase tracking-wide">
                            Select
                          </span>
                        </div>
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-sm font-semibold text-white">{setup.symbol}</span>
                          <span className="text-[11px] text-white/50 uppercase tracking-wide">{setup.setup_type}</span>
                          <span className={cn('text-[11px] font-medium capitalize', DIRECTION_STYLES[setup.direction])}>
                            {setup.direction}
                          </span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border capitalize', STATUS_BADGE_STYLES[setup.status])}>
                            {setup.status}
                          </span>
                          {score !== null && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                              Score {score}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/35 mt-1">
                          Tracked {new Date(setup.tracked_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onSendPrompt && (
                          <motion.button
                            onClick={() => onSendPrompt(askPrompt)}
                            className="text-white/30 hover:text-emerald-400 transition-colors"
                            title="Ask AI about this setup"
                            {...PRESSABLE_PROPS}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </motion.button>
                        )}
                        <motion.button
                          onClick={() => handleDelete(setup.id)}
                          disabled={isMutating}
                          className={cn(
                            'transition-colors',
                            isMutating ? 'text-white/20 cursor-not-allowed' : 'text-white/30 hover:text-red-400',
                          )}
                          title="Delete setup"
                          {...PRESSABLE_PROPS}
                        >
                          {isMutating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </motion.button>
                      </div>
                    </div>

                    <WidgetActionBar actions={workflowActions} className="mt-2" />

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {setup.status !== 'triggered' && (
                        <StatusActionButton
                          label="Mark Triggered"
                          icon={CheckCircle2}
                          onClick={() => handleStatusChange(setup.id, 'triggered')}
                          disabled={isMutating}
                          tone="positive"
                        />
                      )}
                      {setup.status !== 'invalidated' && (
                        <StatusActionButton
                          label="Mark Invalidated"
                          icon={XCircle}
                          onClick={() => handleStatusChange(setup.id, 'invalidated')}
                          disabled={isMutating}
                          tone="danger"
                        />
                      )}
                      {setup.status !== 'archived' && (
                        <StatusActionButton
                          label="Archive"
                          icon={Archive}
                          onClick={() => handleStatusChange(setup.id, 'archived')}
                          disabled={isMutating}
                          tone="muted"
                        />
                      )}
                      {setup.status !== 'active' && (
                        <StatusActionButton
                          label="Reopen"
                          icon={RotateCcw}
                          onClick={() => handleStatusChange(setup.id, 'active')}
                          disabled={isMutating}
                          tone="primary"
                        />
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5">
                      {isEditingNotes ? (
                        <div className="space-y-2">
                          <textarea
                            value={notesDraft}
                            onChange={(event) => setNotesDraft(event.target.value)}
                            placeholder="Add setup notes..."
                            rows={3}
                            className="w-full rounded-md bg-white/5 border border-white/10 px-2.5 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/35 resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <motion.button
                              onClick={() => handleSaveNotes(setup.id)}
                              disabled={isMutating}
                              className={cn(
                                'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border transition-colors',
                                isMutating
                                  ? 'text-white/35 border-white/10 cursor-not-allowed'
                                  : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15',
                              )}
                              {...PRESSABLE_PROPS}
                            >
                              <Save className="w-3 h-3" />
                              Save Notes
                            </motion.button>
                            <motion.button
                              onClick={cancelEditingNotes}
                              disabled={isMutating}
                              className="text-xs px-2.5 py-1.5 rounded border border-white/10 text-white/50 hover:text-white/70 transition-colors"
                              {...PRESSABLE_PROPS}
                            >
                              Cancel
                            </motion.button>
                          </div>
                        </div>
                      ) : (
                        <motion.button
                          onClick={() => startEditingNotes(setup)}
                          className="w-full text-left text-xs rounded-md border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-2 transition-colors"
                          {...PRESSABLE_PROPS}
                        >
                          <span className="flex items-center gap-1.5 text-white/45 mb-1">
                            <Edit3 className="w-3 h-3" />
                            Notes
                          </span>
                          <span className="text-white/70">
                            {setup.notes?.trim() ? setup.notes : 'Add notes for this tracked setup...'}
                          </span>
                        </motion.button>
                      )}
                    </div>
                  </div>
                </WidgetContextMenu>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  tone,
}: {
  label: string
  icon: typeof CheckCircle2
  onClick: () => void
  disabled?: boolean
  tone: 'positive' | 'danger' | 'muted' | 'primary'
}) {
  const toneClass = tone === 'positive'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
    : tone === 'danger'
      ? 'border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/15'
      : tone === 'muted'
        ? 'border-white/15 bg-white/10 text-white/65 hover:bg-white/15'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/15'

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border transition-colors',
        disabled ? 'opacity-50 cursor-not-allowed' : toneClass,
      )}
      {...PRESSABLE_PROPS}
    >
      <Icon className="w-3 h-3" />
      {label}
    </motion.button>
  )
}
