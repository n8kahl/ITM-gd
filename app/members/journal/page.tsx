'use client'

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import Link from 'next/link'
import { BarChart3, Plus, Upload } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { JournalFilterBar } from '@/components/journal/journal-filter-bar'
import { JournalSummaryStats } from '@/components/journal/journal-summary-stats'
import { JournalTableView } from '@/components/journal/journal-table-view'
import { JournalCardView } from '@/components/journal/journal-card-view'
import { TradeEntrySheet } from '@/components/journal/trade-entry-sheet'
import { EntryDetailSheet } from '@/components/journal/entry-detail-sheet'
import { ImportWizard } from '@/components/journal/import-wizard'
import { readCachedJournalEntries, writeCachedJournalEntries } from '@/lib/journal/offline-storage'
import { sanitizeJournalEntries, sanitizeJournalEntry } from '@/lib/journal/sanitize-entry'
import type { JournalEntry, JournalFilters } from '@/lib/types/journal'
import { DEFAULT_JOURNAL_FILTERS } from '@/lib/types/journal'

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
        limit: 100,
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
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined') return

    const updateOnline = () => setIsOnline(navigator.onLine)
    updateOnline()

    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)

    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  const loadEntries = useCallback(async () => {
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
      const response = await fetch(`/api/members/journal?${toQueryString(filters)}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(await extractError(response))
      }

      const payload = await response.json()
      if (!payload.success) {
        throw new Error(payload.error || 'Failed to load journal entries')
      }

      const sanitized = sanitizeJournalEntries(payload.data)
      setEntries(sanitized)
      setTotal(typeof payload.meta?.total === 'number' ? payload.meta.total : sanitized.length)
      writeCachedJournalEntries(sanitized)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load journal entries'
      setError(message)

      const cached = readCachedJournalEntries()
      if (cached.length > 0) {
        setEntries(cached)
        setTotal(cached.length)
      }
    } finally {
      setLoading(false)
    }
  }, [filters, isOnline])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    for (const entry of entries) {
      entry.tags.forEach((tag) => set.add(tag))
    }
    return Array.from(set).sort()
  }, [entries])

  const handleSave = useCallback(async (input: Record<string, unknown>) => {
    if (!isOnline) {
      throw new Error('You are offline. Writing is disabled.')
    }

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

    const nextEntry = sanitizeJournalEntry(payload.data)

    setEntries((prev) => {
      if (editEntry) {
        return prev.map((entry) => (entry.id === nextEntry.id ? nextEntry : entry))
      }
      return [nextEntry, ...prev]
    })

    setEditEntry(null)
    void loadEntries()
    return nextEntry
  }, [editEntry, isOnline, loadEntries])

  const handleRequestDelete = useCallback((entryId: string) => {
    const target = entries.find((entry) => entry.id === entryId)
    if (!target) return
    setDeleteTarget(target)
  }, [entries])

  const handleDeleteConfirmed = useCallback(async () => {
    if (!deleteTarget || !isOnline || deleteBusy) return

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
  }, [deleteBusy, deleteTarget, isOnline, loadEntries])

  const handleToggleFavorite = useCallback(async (entry: JournalEntry, nextValue?: boolean) => {
    if (!isOnline) return

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

    const updated = sanitizeJournalEntry(payload.data)
    setEntries((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
  }, [isOnline])

  const disableActions = !isOnline

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ivory">Trade Journal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manual-first journaling with clean analytics and import workflows.</p>
          <Breadcrumb
            className="mt-2"
            items={[
              { label: 'Dashboard', href: '/members' },
              { label: 'Journal' },
            ]}
          />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/members/journal/analytics"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-ivory hover:bg-white/5"
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Link>

          <button
            type="button"
            onClick={() => setShowImportWizard((prev) => !prev)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-ivory hover:bg-white/5"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>

          <button
            type="button"
            onClick={() => {
              setEditEntry(null)
              setSheetOpen(true)
            }}
            disabled={disableActions}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            New Entry
          </button>
        </div>
      </div>

      {!isOnline ? (
        <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          You&apos;re offline. You can view cached entries, but create/edit/delete is disabled.
        </div>
      ) : null}

      {showImportWizard ? (
        <ImportWizard onImported={() => void loadEntries()} />
      ) : null}

      <JournalFilterBar
        filters={filters}
        onChange={(nextFilters) => dispatchFilters({ type: 'replace', value: nextFilters })}
        availableTags={availableTags}
      />

      <JournalSummaryStats entries={entries} />

      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-muted-foreground">Loading entries...</div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-muted-foreground">
          No journal entries found. Add your first trade to get started.
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#111416] p-4">
            <h3 className="text-sm font-semibold text-ivory">Delete trade entry?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {deleteTarget.symbol} ({deleteTarget.trade_date.slice(0, 10)}) with P&L {deleteTarget.pnl ?? '—'} will be deleted.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-10 rounded-md border border-white/10 px-4 text-sm text-ivory hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteConfirmed()}
                disabled={deleteBusy}
                className="h-10 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
              >
                {deleteBusy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
