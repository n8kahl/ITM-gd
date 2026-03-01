'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ImagePlus, Plus, Upload } from 'lucide-react'
import { PageHeader } from '@/components/members/page-header'
import { Button } from '@/components/ui/button'
import { JournalFilterBar } from '@/components/journal/journal-filter-bar'
import { JournalSummaryStats } from '@/components/journal/journal-summary-stats'
import { JournalTableView } from '@/components/journal/journal-table-view'
import { JournalCardView } from '@/components/journal/journal-card-view'
import { TradeEntrySheet } from '@/components/journal/trade-entry-sheet'
import { EntryDetailSheet } from '@/components/journal/entry-detail-sheet'
import { ImportWizard } from '@/components/journal/import-wizard'
import { ScreenshotQuickAdd } from '@/components/journal/screenshot-quick-add'
import { DraftNotification } from '@/components/journal/draft-notification'
import { PsychologyPrompt } from '@/components/journal/psychology-prompt'
import { readCachedJournalEntries, writeCachedJournalEntries } from '@/lib/journal/offline-storage'
import { sanitizeJournalEntries, sanitizeJournalEntry } from '@/lib/journal/sanitize-entry'
import type { JournalEntry, JournalFilters } from '@/lib/types/journal'
import { DEFAULT_JOURNAL_FILTERS } from '@/lib/types/journal'
import { JournalSubNav } from '@/components/journal/journal-sub-nav'
import { Analytics } from '@/lib/analytics'
import { SkeletonJournalEntry } from '@/components/ui/skeleton-loader'

const JOURNAL_VIEW_PREF_KEY = 'journal-view-preference-v1'
const MOBILE_VIEW_MEDIA_QUERY = '(max-width: 767px)'

type FilterAction =
  | { type: 'replace', value: JournalFilters }
  | { type: 'patch', value: Partial<JournalFilters> }
  | { type: 'clear' }

function filterReducer(state: JournalFilters, action: FilterAction): JournalFilters {
  switch (action.type) {
    case 'replace':
      return action.value
    case 'patch':
      return { ...state, ...action.value }
    case 'clear':
      return {
        ...state,
        startDate: null,
        endDate: null,
        symbol: '',
        direction: 'all',
        contractType: 'all',
        isWinner: 'all',
        isOpen: 'all',
        tags: [],
        sortBy: 'trade_date',
        sortDir: 'desc',
        limit: 500,
        offset: 0,
      }
    default:
      return state
  }
}

function toQueryString(filters: JournalFilters): string {
  const params = new URLSearchParams()

  if (filters.startDate) params.set('startDate', new Date(`${filters.startDate}T00:00:00.000Z`).toISOString())
  if (filters.endDate) params.set('endDate', new Date(`${filters.endDate}T23:59:59.000Z`).toISOString())
  if (filters.symbol) params.set('symbol', filters.symbol)
  if (filters.direction !== 'all') params.set('direction', filters.direction)
  if (filters.contractType !== 'all') params.set('contractType', filters.contractType)
  if (filters.isWinner !== 'all') params.set('isWinner', filters.isWinner)
  if (filters.isOpen !== 'all') params.set('isOpen', filters.isOpen)
  if (filters.tags.length > 0) params.set('tags', filters.tags.join(','))

  params.set('sortBy', filters.sortBy)
  params.set('sortDir', filters.sortDir)
  params.set('limit', String(filters.limit))
  params.set('offset', String(filters.offset))

  return params.toString()
}

async function extractError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null)
  return payload?.error || payload?.message || `Request failed (${response.status})`
}

export default function JournalPage() {
  const [filters, dispatchFilters] = useReducer(filterReducer, DEFAULT_JOURNAL_FILTERS)

  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isOnline, setIsOnline] = useState(true)
  const [showImportWizard, setShowImportWizard] = useState(false)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [screenshotQuickAddOpen, setScreenshotQuickAddOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const [psychPromptEntry, setPsychPromptEntry] = useState<JournalEntry | null>(null)
  const loadEntriesAbortRef = useRef<AbortController | null>(null)
  const pullStartYRef = useRef<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [pullRefreshing, setPullRefreshing] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const storedView = window.localStorage.getItem(JOURNAL_VIEW_PREF_KEY)
    const preferredView = storedView === 'table' || storedView === 'cards'
      ? storedView
      : DEFAULT_JOURNAL_FILTERS.view
    const isMobileViewport = window.matchMedia(MOBILE_VIEW_MEDIA_QUERY).matches
    const resolvedView = isMobileViewport && preferredView === 'table' ? 'cards' : preferredView

    if (resolvedView !== DEFAULT_JOURNAL_FILTERS.view) {
      dispatchFilters({ type: 'patch', value: { view: resolvedView } })
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(JOURNAL_VIEW_PREF_KEY, filters.view)
  }, [filters.view])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia(MOBILE_VIEW_MEDIA_QUERY)

    const enforceMobileCards = () => {
      if (mediaQuery.matches && filters.view === 'table') {
        dispatchFilters({ type: 'patch', value: { view: 'cards' } })
      }
    }

    enforceMobileCards()
    mediaQuery.addEventListener('change', enforceMobileCards)

    return () => {
      mediaQuery.removeEventListener('change', enforceMobileCards)
    }
  }, [filters.view])

  useEffect(() => {
    if (typeof navigator === 'undefined') return

    const updateOnline = () => {
      setIsOnline(navigator.onLine)

      if (navigator.onLine && navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'JOURNAL_SYNC_NOW' })
      }
    }
    updateOnline()

    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)

    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  const queryString = useMemo(() => toQueryString(filters), [filters])

  const loadEntries = useCallback(async () => {
    loadEntriesAbortRef.current?.abort()
    const controller = new AbortController()
    loadEntriesAbortRef.current = controller

    if (!isOnline) {
      const cached = readCachedJournalEntries()
      setEntries(cached)
      setTotal(cached.length)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/members/journal?${queryString}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(await extractError(response))
      }

      const payload = await response.json()
      if (!payload.success) {
        throw new Error(payload.error || 'Failed to load journal entries')
      }

      const sanitized = sanitizeJournalEntries(payload.data)
      const resolvedTotal = typeof payload.meta?.total === 'number'
        ? payload.meta.total
        : (typeof payload.total === 'number' ? payload.total : sanitized.length)
      setEntries(sanitized)
      setTotal(resolvedTotal)
      writeCachedJournalEntries(sanitized)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') {
        return
      }
      const message = loadError instanceof Error ? loadError.message : 'Failed to load journal entries'
      setError(message)

      const cached = readCachedJournalEntries()
      if (cached.length > 0) {
        setEntries(cached)
        setTotal(cached.length)
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [isOnline, queryString])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  useEffect(() => {
    return () => {
      loadEntriesAbortRef.current?.abort()
    }
  }, [])

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    for (const entry of entries) {
      entry.tags.forEach((tag) => set.add(tag))
    }
    return Array.from(set).sort()
  }, [entries])

  const handleSave = useCallback(async (input: Record<string, unknown>) => {
    const method = editEntry ? 'PATCH' : 'POST'
    const response = await fetch('/api/members/journal', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editEntry ? { ...input, id: editEntry.id } : input),
    })

    if (!response.ok) {
      throw new Error(await extractError(response))
    }

    const payload = await response.json()
    if (!payload.success) {
      throw new Error(payload.error || 'Failed to save entry')
    }

    if (payload.meta?.queued) {
      setError('This update was queued by the server and will sync automatically.')
      setEditEntry(null)
      void loadEntries()
      return {} as JournalEntry
    }

    const nextEntry = sanitizeJournalEntry(payload.data)

    setEntries((prev) => {
      if (editEntry) {
        return prev.map((entry) => (entry.id === nextEntry.id ? nextEntry : entry))
      }
      return [nextEntry, ...prev]
    })

    setEditEntry(null)
    void loadEntries()

    // Trigger psychology prompt for closed trades with P&L
    if (!nextEntry.is_open && nextEntry.pnl != null && !nextEntry.mood_before) {
      setPsychPromptEntry(nextEntry)
    }

    return nextEntry
  }, [editEntry, loadEntries])

  const handleRequestDelete = useCallback((entryId: string) => {
    const target = entries.find((entry) => entry.id === entryId)
    if (!target) return
    setDeleteTarget(target)
  }, [entries])

  const handleDeleteConfirmed = useCallback(async () => {
    if (!deleteTarget || deleteBusy) return

    setDeleteBusy(true)

    try {
      const response = await fetch(`/api/members/journal?id=${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(await extractError(response))
      }

      const payload = await response.json()
      if (!payload.success) {
        throw new Error(payload.error || 'Failed to delete entry')
      }

      setEntries((prev) => prev.filter((entry) => entry.id !== deleteTarget.id))
      setSelectedEntry((prev) => (prev?.id === deleteTarget.id ? null : prev))
      setDeleteTarget(null)
      void loadEntries()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete entry')
    } finally {
      setDeleteBusy(false)
    }
  }, [deleteBusy, deleteTarget, loadEntries])

  const handleToggleFavorite = useCallback(async (entry: JournalEntry, nextValue?: boolean) => {
    const response = await fetch('/api/members/journal', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry.id, is_favorite: nextValue ?? !entry.is_favorite }),
    })

    if (!response.ok) {
      setError(await extractError(response))
      return
    }

    const payload = await response.json()
    if (!payload.success) {
      setError(payload.error || 'Failed to update favorite state')
      return
    }

    if (payload.meta?.queued) {
      setError('Favorite update queued by the server and will sync automatically.')
      return
    }

    const updated = sanitizeJournalEntry(payload.data)
    setEntries((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
  }, [])

  const handlePullTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!isOnline || loading || typeof window === 'undefined') return
    if (window.scrollY > 0) return
    pullStartYRef.current = event.touches[0]?.clientY ?? null
  }, [isOnline, loading])

  const handlePullTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (pullStartYRef.current == null || typeof window === 'undefined') return
    if (window.scrollY > 0) {
      pullStartYRef.current = null
      setPullDistance(0)
      return
    }

    const currentY = event.touches[0]?.clientY ?? pullStartYRef.current
    const delta = currentY - pullStartYRef.current
    if (delta <= 0) {
      setPullDistance(0)
      return
    }

    setPullDistance(Math.min(delta * 0.45, 96))
  }, [])

  const handlePullTouchEnd = useCallback(() => {
    const shouldRefresh = pullDistance >= 56 && isOnline && !loading
    pullStartYRef.current = null
    setPullDistance(0)

    if (shouldRefresh) {
      setPullRefreshing(true)
      void loadEntries().finally(() => setPullRefreshing(false))
    }
  }, [isOnline, loadEntries, loading, pullDistance])

  const disableActions = !isOnline

  return (
    <div
      className="space-y-4"
      onTouchStart={handlePullTouchStart}
      onTouchMove={handlePullTouchMove}
      onTouchEnd={handlePullTouchEnd}
      onTouchCancel={handlePullTouchEnd}
    >
      {(pullDistance > 0 || pullRefreshing) ? (
        <div className="sticky top-0 z-20 flex justify-center">
          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
            {pullRefreshing ? 'Refreshing entries...' : (pullDistance >= 56 ? 'Release to refresh' : 'Pull to refresh')}
          </div>
        </div>
      ) : null}

      <PageHeader
        title="Trade Journal"
        subtitle="Manual-first journaling with clean analytics and import workflows."
        breadcrumbs={[
          { label: 'Dashboard', href: '/members' },
          { label: 'Journal' },
        ]}
        actions={(
          <>
            <Button
              type="button"
              onClick={() => {
                Analytics.trackJournalAction('import')
                setShowImportWizard((prev) => !prev)
              }}
              disabled={disableActions}
              variant="luxury-outline"
              size="sm"
              className="h-10 px-3"
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>

            <Button
              type="button"
              onClick={() => {
                Analytics.trackJournalAction('upload_screenshot')
                setShowImportWizard(false)
                setScreenshotQuickAddOpen(true)
              }}
              disabled={disableActions}
              variant="luxury-outline"
              size="sm"
              className="h-10 px-3"
            >
              <ImagePlus className="h-4 w-4" />
              Screenshot
            </Button>

            <Button
              type="button"
              onClick={() => {
                Analytics.trackJournalAction('new_entry')
                setEditEntry(null)
                setSheetOpen(true)
              }}
              disabled={disableActions}
              size="sm"
              className="h-10 px-3"
            >
              <Plus className="h-4 w-4" />
              New Entry
            </Button>
          </>
        )}
      />

      <JournalSubNav />

      {!isOnline ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          You&apos;re offline. Journal is in read-only cache mode until your connection returns.
        </div>
      ) : null}

      {isOnline ? (
        <DraftNotification
          onReviewDrafts={() => {
            dispatchFilters({ type: 'patch', value: { isOpen: 'true' } })
          }}
        />
      ) : null}

      {psychPromptEntry ? (
        <PsychologyPrompt
          entryId={psychPromptEntry.id}
          symbol={psychPromptEntry.symbol}
          onComplete={() => {
            setPsychPromptEntry(null)
            void loadEntries()
          }}
          onDismiss={() => setPsychPromptEntry(null)}
        />
      ) : null}

      {showImportWizard && isOnline ? (
        <ImportWizard onImported={() => void loadEntries()} />
      ) : null}

      <JournalFilterBar
        filters={filters}
        onChange={(nextFilters) => dispatchFilters({ type: 'replace', value: nextFilters })}
        availableTags={availableTags}
      />

      <JournalSummaryStats entries={entries} loading={loading} />

      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonJournalEntry key={`journal-loading-${index}`} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-base font-medium text-ivory">Start tracking your edge</p>
          <p className="mt-1 text-sm text-muted-foreground">No journal entries found yet.</p>
          <div className="mt-4">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                Analytics.trackJournalAction('new_entry')
                setEditEntry(null)
                setSheetOpen(true)
              }}
              disabled={disableActions}
            >
              <Plus className="h-4 w-4" />
              Add First Trade
            </Button>
          </div>
        </div>
      ) : filters.view === 'cards' ? (
        <JournalCardView
          entries={entries}
          onSelectEntry={setSelectedEntry}
          onEditEntry={(entry) => {
            if (disableActions) return
            setEditEntry(entry)
            setSheetOpen(true)
          }}
          onDeleteEntry={(entryId) => {
            if (disableActions) return
            handleRequestDelete(entryId)
          }}
          onToggleFavorite={handleToggleFavorite}
          disableActions={disableActions}
        />
      ) : (
        <JournalTableView
          entries={entries}
          onSelectEntry={setSelectedEntry}
          onEditEntry={(entry) => {
            if (disableActions) return
            setEditEntry(entry)
            setSheetOpen(true)
          }}
          onDeleteEntry={(entryId) => {
            if (disableActions) return
            handleRequestDelete(entryId)
          }}
          disableActions={disableActions}
        />
      )}

      <p className="text-xs text-muted-foreground">Showing {entries.length} of {total} entries.</p>

      <TradeEntrySheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setEditEntry(null)
        }}
        onSave={handleSave}
        editEntry={editEntry}
        disabled={disableActions}
      />

      <ScreenshotQuickAdd
        open={screenshotQuickAddOpen}
        onClose={() => setScreenshotQuickAddOpen(false)}
        onEntryCreated={() => {
          setScreenshotQuickAddOpen(false)
          void loadEntries()
        }}
      />

      <EntryDetailSheet
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onEdit={(entry) => {
          setSelectedEntry(null)
          setEditEntry(entry)
          setSheetOpen(true)
        }}
        onDelete={(entryId) => handleRequestDelete(entryId)}
        disableActions={disableActions}
      />

      {deleteTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 animate-in fade-in-0 duration-200">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-[var(--onyx)] p-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-semibold text-ivory">Delete trade entry?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {deleteTarget.symbol} ({deleteTarget.trade_date.slice(0, 10)}) with P&L {deleteTarget.pnl ?? '—'} will be deleted.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => setDeleteTarget(null)}
                variant="luxury-outline"
                size="sm"
                className="h-10 px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleDeleteConfirmed()}
                disabled={deleteBusy}
                variant="destructive"
                size="sm"
                className="h-10 px-4"
              >
                {deleteBusy ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
