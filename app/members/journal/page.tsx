'use client'

import { useEffect, useState, useCallback, useMemo, useRef, type TouchEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, BookOpen, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type { JournalEntry, JournalFilters } from '@/lib/types/journal'
import { DEFAULT_FILTERS } from '@/lib/types/journal'
import { cn } from '@/lib/utils'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { JournalFilterBar } from '@/components/journal/journal-filter-bar'
import { JournalSummaryStats } from '@/components/journal/journal-summary-stats'
import { JournalTableView } from '@/components/journal/journal-table-view'
import { JournalCardView } from '@/components/journal/journal-card-view'
import { OpenPositionsWidget } from '@/components/journal/open-positions-widget'
import { ImportWizard } from '@/components/journal/import-wizard'
import { DraftEntriesPanel } from '@/components/journal/draft-entries-panel'
import { TradeEntrySheet } from '@/components/journal/trade-entry-sheet'
import { EntryDetailSheet } from '@/components/journal/entry-detail-sheet'
import {
  parseJournalPrefillFromSearchParams,
  type JournalPrefillPayload,
} from '@/lib/journal/ai-coach-bridge'
import {
  createAppError,
  createAppErrorFromResponse,
  notifyAppError,
  withExponentialBackoff,
  type AppError,
} from '@/lib/error-handler'
import { useIsMobile } from '@/hooks/use-is-mobile'
import {
  enqueueOfflineJournalMutation,
  getOfflineMutationCount,
  mergeServerEntriesWithPendingOffline,
  readCachedJournalEntries,
  readOfflineJournalMutations,
  writeCachedJournalEntries,
  writeOfflineJournalMutations,
} from '@/lib/journal/offline-storage'

function applyFilters(entries: JournalEntry[], filters: JournalFilters): JournalEntry[] {
  let filtered = [...entries]

  if (filters.dateRange.from) {
    filtered = filtered.filter((entry) => entry.trade_date >= filters.dateRange.from!)
  }
  if (filters.dateRange.to) {
    filtered = filtered.filter((entry) => entry.trade_date.split('T')[0] <= filters.dateRange.to!)
  }

  if (filters.symbol) {
    const symbol = filters.symbol.toUpperCase()
    filtered = filtered.filter((entry) => entry.symbol?.toUpperCase().includes(symbol))
  }

  if (filters.direction !== 'all') {
    filtered = filtered.filter((entry) => entry.direction === filters.direction)
  }

  if (filters.contractType !== 'all') {
    filtered = filtered.filter((entry) => (entry.contract_type || 'stock') === filters.contractType)
  }

  if (filters.pnlFilter === 'winners') {
    filtered = filtered.filter((entry) => (entry.pnl ?? 0) > 0)
  } else if (filters.pnlFilter === 'losers') {
    filtered = filtered.filter((entry) => (entry.pnl ?? 0) < 0)
  }

  if (filters.tags.length > 0) {
    filtered = filtered.filter((entry) => (
      filters.tags.some((tag) => entry.tags.includes(tag) || entry.smart_tags.includes(tag))
    ))
  }

  if (filters.aiGrade && filters.aiGrade.length > 0) {
    filtered = filtered.filter((entry) => (
      entry.ai_analysis?.grade && filters.aiGrade!.includes(entry.ai_analysis.grade)
    ))
  }

  filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case 'date-asc':
        return a.trade_date.localeCompare(b.trade_date)
      case 'pnl-desc':
        return (b.pnl ?? 0) - (a.pnl ?? 0)
      case 'pnl-asc':
        return (a.pnl ?? 0) - (b.pnl ?? 0)
      case 'rating-desc':
        return (b.rating ?? 0) - (a.rating ?? 0)
      case 'date-desc':
      default:
        return b.trade_date.localeCompare(a.trade_date)
    }
  })

  return filtered
}

const VIEW_PREFERENCE_KEY = 'journal-view-preference'
const DATE_FILTER_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const PULL_REFRESH_THRESHOLD = 56
const PULL_REFRESH_MAX_DISTANCE = 90

function countActiveFilters(filters: JournalFilters): number {
  let count = 0
  if (filters.dateRange.preset !== 'all') count += 1
  if (filters.symbol) count += 1
  if (filters.direction !== 'all') count += 1
  if (filters.contractType !== 'all') count += 1
  if (filters.pnlFilter !== 'all') count += 1
  if (filters.tags.length > 0) count += 1
  if (filters.aiGrade && filters.aiGrade.length > 0) count += 1
  return count
}

function getStoredViewPreference(): JournalFilters['view'] {
  if (typeof window === 'undefined') return DEFAULT_FILTERS.view
  const stored = window.localStorage.getItem(VIEW_PREFERENCE_KEY)
  return stored === 'cards' || stored === 'table' ? stored : DEFAULT_FILTERS.view
}

function sanitizeDateFilterParam(value: string | null): string | null {
  if (!value) return null
  return DATE_FILTER_PARAM_PATTERN.test(value) ? value : null
}

export default function JournalPage() {
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const openedPrefillKeyRef = useRef<string | null>(null)
  const pullStartYRef = useRef<number | null>(null)
  const isPullingRef = useRef(false)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [preferredDesktopView, setPreferredDesktopView] = useState<JournalFilters['view']>(DEFAULT_FILTERS.view)
  const [filters, setFilters] = useState<JournalFilters>(DEFAULT_FILTERS)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncingOfflineQueue, setIsSyncingOfflineQueue] = useState(false)
  const [offlineQueueCount, setOfflineQueueCount] = useState(0)
  const [showingCachedEntries, setShowingCachedEntries] = useState(false)

  const [entrySheetOpen, setEntrySheetOpen] = useState(false)
  const [entryPrefill, setEntryPrefill] = useState<JournalPrefillPayload | null>(null)
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)

  useEffect(() => {
    const stored = getStoredViewPreference()
    const initialView = window.innerWidth < 768 ? 'cards' : stored
    setPreferredDesktopView(stored)
    setFilters((prev) => ({ ...prev, view: initialView }))
  }, [])

  useEffect(() => {
    const syncViewForViewport = () => {
      setFilters((prev) => {
        if (window.innerWidth < 768) {
          return prev.view === 'cards' ? prev : { ...prev, view: 'cards' }
        }
        return prev.view === preferredDesktopView ? prev : { ...prev, view: preferredDesktopView }
      })
    }

    syncViewForViewport()
    window.addEventListener('resize', syncViewForViewport)
    return () => window.removeEventListener('resize', syncViewForViewport)
  }, [preferredDesktopView])

  useEffect(() => {
    if (typeof navigator === 'undefined') return

    const syncOnlineStatus = () => setIsOnline(navigator.onLine)
    syncOnlineStatus()
    setOfflineQueueCount(getOfflineMutationCount())

    const cachedEntries = readCachedJournalEntries()
    const queuedOptimisticEntries = mergeServerEntriesWithPendingOffline([])
    if (cachedEntries.length > 0 || queuedOptimisticEntries.length > 0) {
      setEntries((prev) => {
        if (prev.length > 0) return prev
        const merged = mergeServerEntriesWithPendingOffline(cachedEntries)
        return merged.length > 0 ? merged : prev
      })
      setShowingCachedEntries(cachedEntries.length > 0)
      setLoading(false)
    }

    window.addEventListener('online', syncOnlineStatus)
    window.addEventListener('offline', syncOnlineStatus)
    return () => {
      window.removeEventListener('online', syncOnlineStatus)
      window.removeEventListener('offline', syncOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.innerWidth < 768) return
    setPreferredDesktopView(filters.view)
    window.localStorage.setItem(VIEW_PREFERENCE_KEY, filters.view)
  }, [filters.view])

  useEffect(() => {
    const prefill = parseJournalPrefillFromSearchParams(searchParams)
    if (!prefill) return

    const prefillKey = searchParams.toString()
    if (openedPrefillKeyRef.current === prefillKey) return
    openedPrefillKeyRef.current = prefillKey

    setEditEntry(null)
    setEntryPrefill(prefill)
    setEntrySheetOpen(true)
  }, [searchParams])

  useEffect(() => {
    const fromParam = sanitizeDateFilterParam(searchParams.get('from'))
    const toParam = sanitizeDateFilterParam(searchParams.get('to'))
    if (!fromParam && !toParam) return

    const nextFrom = fromParam || toParam
    const nextTo = toParam || fromParam
    if (!nextFrom || !nextTo) return

    setFilters((prev) => {
      if (
        prev.dateRange.preset === 'custom'
        && prev.dateRange.from === nextFrom
        && prev.dateRange.to === nextTo
      ) {
        return prev
      }

      return {
        ...prev,
        dateRange: {
          from: nextFrom,
          to: nextTo,
          preset: 'custom',
        },
      }
    })
  }, [searchParams])

  const loadEntries = useCallback(async (): Promise<boolean> => {
    let succeeded = false
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cachedEntries = mergeServerEntriesWithPendingOffline(readCachedJournalEntries())
        setOfflineQueueCount(getOfflineMutationCount())
        if (cachedEntries.length > 0) {
          setEntries(cachedEntries)
          setShowingCachedEntries(true)
          succeeded = true
        }
        return succeeded
      }

      const response = await withExponentialBackoff(
        () => fetch('/api/members/journal?limit=500'),
        { retries: 2, baseDelayMs: 400 },
      )

      if (!response.ok) {
        throw await createAppErrorFromResponse(response)
      }

      const result = await response.json()
      if (!result.success || !Array.isArray(result.data)) {
        throw createAppError('Journal response format was invalid.')
      }

      const mergedEntries = mergeServerEntriesWithPendingOffline(result.data)
      setEntries(mergedEntries)
      writeCachedJournalEntries(result.data)
      setShowingCachedEntries(false)
      setOfflineQueueCount(getOfflineMutationCount())
      succeeded = true
    } catch (error) {
      const cachedEntries = mergeServerEntriesWithPendingOffline(readCachedJournalEntries())
      if (cachedEntries.length > 0) {
        setEntries(cachedEntries)
        setShowingCachedEntries(true)
        setOfflineQueueCount(getOfflineMutationCount())

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          toast.info('Offline mode: showing cached journal entries')
          succeeded = true
          return succeeded
        }
      }

      const appError = (error && typeof error === 'object' && 'category' in error)
        ? error as AppError
        : createAppError(error)

      notifyAppError(appError, {
        onRetry: () => {
          window.location.reload()
        },
        retryLabel: 'Refresh',
      })
    } finally {
      setLoading(false)
    }
    return succeeded
  }, [])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const flushOfflineQueue = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false

    const queuedMutations = readOfflineJournalMutations()
    if (queuedMutations.length === 0) {
      setOfflineQueueCount(0)
      return true
    }

    setIsSyncingOfflineQueue(true)
    const remaining: typeof queuedMutations = []
    let syncedCount = 0

    for (const queuedMutation of queuedMutations) {
      try {
        const response = await fetch('/api/members/journal', {
          method: queuedMutation.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queuedMutation.payload),
        })

        if (!response.ok) {
          throw await createAppErrorFromResponse(response)
        }

        const payload = await response.json()
        if (!payload?.success) {
          throw createAppError('Queued trade sync did not return success.')
        }

        syncedCount += 1

        if (queuedMutation.method === 'POST' && payload?.data?.id) {
          fetch('/api/members/journal/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId: payload.data.id }),
          })
            .then(() => fetch('/api/members/journal/grade', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ entryId: payload.data.id }),
            }))
            .catch((error) => {
              console.error('[Journal] Deferred enrich/grade failed:', error)
            })
        }
      } catch {
        remaining.push(queuedMutation)
      }
    }

    writeOfflineJournalMutations(remaining)
    setOfflineQueueCount(remaining.length)
    setIsSyncingOfflineQueue(false)

    if (syncedCount > 0) {
      toast.success(`Synced ${syncedCount} offline trade${syncedCount === 1 ? '' : 's'}`)
      await loadEntries()
    }

    if (remaining.length > 0) {
      toast.error(`${remaining.length} offline trade${remaining.length === 1 ? '' : 's'} still pending sync`)
    }

    return remaining.length === 0
  }, [loadEntries])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      void flushOfflineQueue()
    }

    window.addEventListener('online', handleOnline)
    if (navigator.onLine) {
      void flushOfflineQueue()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [flushOfflineQueue])

  const filteredEntries = useMemo(() => applyFilters(entries, filters), [entries, filters])
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters])

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    entries.forEach((entry) => {
      entry.tags?.forEach((tag) => tagSet.add(tag))
      entry.smart_tags?.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [entries])

  const handleSave = useCallback(async (data: Record<string, unknown>) => {
    const method = data.id ? 'PATCH' : 'POST'

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queuedMutation = enqueueOfflineJournalMutation(method, data)
      setOfflineQueueCount((prev) => prev + 1)
      setShowingCachedEntries(true)

      if (method === 'POST') {
        const optimisticEntries = mergeServerEntriesWithPendingOffline(entries)
        const optimistic = optimisticEntries.find((entry) => entry.offline_queue_id === queuedMutation.id) || null
        if (optimistic) {
          setEntries(optimisticEntries)
          writeCachedJournalEntries(optimisticEntries)
          toast.success('Trade saved offline. We will sync when you reconnect.')
          return optimistic
        }
        return null
      } else {
        toast.success('Trade update queued. It will sync when you reconnect.')
        const existingEntry = entries.find((entry) => entry.id === data.id) || null
        return existingEntry
      }
    }

    const response = await fetch('/api/members/journal', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw await createAppErrorFromResponse(response)
    }

    const result = await response.json()
    if (!result.success || !result.data) {
      throw createAppError('Journal save did not return entry data.')
    }

    if (!data.id) {
      fetch('/api/members/journal/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: result.data.id }),
      })
        .then(() => fetch('/api/members/journal/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId: result.data.id }),
        }))
        .catch((error) => {
          console.error('[Journal] Enrichment/grading failed:', error)
        })
    }

    await loadEntries()
    return result.data as JournalEntry
  }, [entries, loadEntries])

  const handleDelete = useCallback(async (entryId: string) => {
    if (!confirm('Delete this trade? This action cannot be undone.')) return

    try {
      const response = await fetch(`/api/members/journal?id=${entryId}`, { method: 'DELETE' })
      if (!response.ok) {
        throw await createAppErrorFromResponse(response)
      }

      toast.success('Trade deleted')
      await loadEntries()
    } catch (error) {
      const appError = (error && typeof error === 'object' && 'category' in error)
        ? error as AppError
        : createAppError(error)

      notifyAppError(appError, {
        onRetry: () => {
          window.location.reload()
        },
        retryLabel: 'Refresh',
      })
    }
  }, [loadEntries])

  const handleNewEntry = useCallback(() => {
    setEditEntry(null)
    setEntryPrefill(null)
    setEntrySheetOpen(true)
  }, [])

  const handleEditEntry = useCallback((entry: JournalEntry) => {
    setEntryPrefill(null)
    setEditEntry(entry)
    setEntrySheetOpen(true)
  }, [])

  const handleSelectEntry = useCallback((entry: JournalEntry) => {
    setSelectedEntry(entry)
  }, [])

  const handleToggleFavorite = useCallback(async (entry: JournalEntry, nextValue?: boolean) => {
    const resolved = typeof nextValue === 'boolean' ? nextValue : !Boolean(entry.is_favorite)

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOfflineJournalMutation('PATCH', { id: entry.id, is_favorite: resolved })
        setOfflineQueueCount((prev) => prev + 1)
        setEntries((prev) => prev.map((item) => (
          item.id === entry.id
            ? { ...item, is_favorite: resolved, sync_status: 'pending_offline' }
            : item
        )))
        toast.success(`${resolved ? 'Favorited' : 'Unfavorited'} offline. Pending sync.`)
        return
      }

      const response = await fetch('/api/members/journal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, is_favorite: resolved }),
      })

      if (!response.ok) {
        throw await createAppErrorFromResponse(response)
      }

      setEntries((prev) => prev.map((item) => (
        item.id === entry.id
          ? { ...item, is_favorite: resolved }
          : item
      )))
      toast.success(resolved ? 'Marked as favorite' : 'Removed from favorites')
    } catch (error) {
      const appError = (error && typeof error === 'object' && 'category' in error)
        ? error as AppError
        : createAppError(error)

      notifyAppError(appError)
    }
  }, [])

  const refreshEntries = useCallback(async () => {
    setIsPullRefreshing(true)
    const success = await loadEntries()
    if (success) {
      toast.success('Journal refreshed')
    }
    setIsPullRefreshing(false)
  }, [loadEntries])

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (!isMobile || entrySheetOpen || selectedEntry) return
    if (window.scrollY > 0) return

    pullStartYRef.current = event.touches[0]?.clientY ?? null
    isPullingRef.current = pullStartYRef.current !== null
  }, [entrySheetOpen, isMobile, selectedEntry])

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (!isMobile || !isPullingRef.current || pullStartYRef.current === null) return
    if (window.scrollY > 0) return

    const currentY = event.touches[0]?.clientY ?? pullStartYRef.current
    const delta = currentY - pullStartYRef.current

    if (delta <= 0) {
      setPullDistance(0)
      return
    }

    const dampened = Math.min(PULL_REFRESH_MAX_DISTANCE, delta * 0.42)
    setPullDistance(dampened)

    if (delta > 8) {
      event.preventDefault()
    }
  }, [isMobile])

  const handleTouchEnd = useCallback(() => {
    if (!isMobile) return
    isPullingRef.current = false
    pullStartYRef.current = null

    if (pullDistance >= PULL_REFRESH_THRESHOLD && !isPullRefreshing) {
      setPullDistance(0)
      void refreshEntries()
      return
    }

    setPullDistance(0)
  }, [isMobile, isPullRefreshing, pullDistance, refreshEntries])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
            <Image src="/logo.png" alt="TradeITM" fill className="object-contain" />
          </div>
          <p className="text-muted-foreground text-sm" aria-live="polite">Loading your journal...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative min-h-[calc(100dvh-7rem)] space-y-5"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {(pullDistance > 0 || isPullRefreshing) && (
        <div className="pointer-events-none sticky top-0 z-20 flex justify-center" aria-live="polite">
          <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-[#0A0A0B]/85 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <RefreshCw className={cn('h-3.5 w-3.5', isPullRefreshing && 'animate-spin text-emerald-400')} />
            {isPullRefreshing
              ? 'Refreshing journal...'
              : pullDistance >= PULL_REFRESH_THRESHOLD
              ? 'Release to refresh'
              : 'Pull to refresh'}
          </div>
        </div>
      )}

      {(showingCachedEntries || !isOnline || offlineQueueCount > 0) && (
        <section className="glass-card rounded-xl border border-white/[0.1] px-4 py-3" aria-live="polite">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-ivory">
                {!isOnline ? 'Offline mode enabled' : 'Pending offline sync'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {offlineQueueCount > 0
                  ? `${offlineQueueCount} trade${offlineQueueCount === 1 ? '' : 's'} waiting to sync.`
                  : showingCachedEntries
                  ? 'Showing cached journal entries while we revalidate.'
                  : 'Connection restored.'}
              </p>
            </div>

            {offlineQueueCount > 0 && (
              <button
                type="button"
                onClick={() => { void flushOfflineQueue() }}
                disabled={!isOnline || isSyncingOfflineQueue}
                className="focus-champagne inline-flex h-10 items-center justify-center rounded-lg border border-white/[0.12] px-3 text-xs font-medium text-ivory transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Sync offline trades now"
              >
                {isSyncingOfflineQueue ? 'Syncing...' : 'Sync now'}
              </button>
            )}
          </div>
        </section>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-serif text-ivory font-medium tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            Trade Journal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {entries.length} trade{entries.length !== 1 ? 's' : ''} logged
          </p>
          <Breadcrumb
            className="mt-2"
            items={[
              { label: 'Dashboard', href: '/members' },
              { label: 'Journal', href: '/members/journal' },
              ...(activeFilterCount > 0 ? [{ label: `Filters (${activeFilterCount})` }] : []),
            ]}
          />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/members/journal/analytics"
            className="focus-champagne px-3.5 py-2.5 rounded-xl border border-white/[0.1] text-sm text-ivory hover:bg-white/[0.05] transition-colors"
          >
            Analytics
          </Link>
          <button
            onClick={handleNewEntry}
            className="focus-champagne flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
            aria-label="Log a new trade"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Log Trade</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      <JournalFilterBar
        filters={filters}
        onChange={setFilters}
        availableTags={availableTags}
        totalFiltered={filteredEntries.length}
      />

      <JournalSummaryStats entries={filteredEntries} />

      <OpenPositionsWidget onUpdated={() => { void loadEntries() }} />
      <DraftEntriesPanel onUpdated={() => { void loadEntries() }} />
      <ImportWizard onImported={() => { void loadEntries() }} />

      {filteredEntries.length === 0 ? (
        <div className="glass-card-heavy rounded-2xl p-12 text-center">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] inline-block mb-4">
            <BookOpen className="w-8 h-8 text-champagne/50" />
          </div>
          <h3 className="text-base font-medium text-ivory mb-1">
            {entries.length === 0 ? 'Your trading story starts here' : 'No trades match your filters'}
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            {entries.length === 0
              ? 'Log your first trade and start building your performance history with AI-powered analysis.'
              : 'Try adjusting your filters to see more trades.'}
          </p>
          {entries.length === 0 && (
            <button
              onClick={handleNewEntry}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4 inline mr-1.5" />
              Log Your First Trade
            </button>
          )}
        </div>
      ) : filters.view === 'table' ? (
        <JournalTableView
          entries={filteredEntries}
          onSelectEntry={handleSelectEntry}
          onEditEntry={handleEditEntry}
          onDeleteEntry={handleDelete}
        />
      ) : (
        <JournalCardView
          entries={filteredEntries}
          onSelectEntry={handleSelectEntry}
          onEditEntry={handleEditEntry}
          onDeleteEntry={handleDelete}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      <button
        type="button"
        onClick={handleNewEntry}
        className="focus-champagne fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_8px_30px_rgba(16,185,129,0.35)] transition-colors hover:bg-emerald-500 md:hidden"
        aria-label="Log trade"
      >
        <Plus className="h-5 w-5" />
      </button>

      <TradeEntrySheet
        open={entrySheetOpen}
        onClose={() => {
          setEntrySheetOpen(false)
          setEditEntry(null)
          setEntryPrefill(null)
        }}
        onSave={handleSave}
        editEntry={editEntry}
        prefill={entryPrefill}
        onRequestEditEntry={(entry) => {
          setEntryPrefill(null)
          setEditEntry(entry)
          setEntrySheetOpen(true)
        }}
      />

      <EntryDetailSheet
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onEdit={handleEditEntry}
        onDelete={handleDelete}
      />
    </div>
  )
}
