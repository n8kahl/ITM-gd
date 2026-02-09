'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import type { JournalEntry, JournalFilters } from '@/lib/types/journal'
import { DEFAULT_FILTERS } from '@/lib/types/journal'
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
  createAppError,
  createAppErrorFromResponse,
  notifyAppError,
  withExponentialBackoff,
  type AppError,
} from '@/lib/error-handler'

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

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [preferredDesktopView, setPreferredDesktopView] = useState<JournalFilters['view']>(DEFAULT_FILTERS.view)
  const [filters, setFilters] = useState<JournalFilters>(DEFAULT_FILTERS)

  const [entrySheetOpen, setEntrySheetOpen] = useState(false)
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
    if (typeof window === 'undefined') return
    if (window.innerWidth < 768) return
    setPreferredDesktopView(filters.view)
    window.localStorage.setItem(VIEW_PREFERENCE_KEY, filters.view)
  }, [filters.view])

  const loadEntries = useCallback(async () => {
    try {
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

      setEntries(result.data)
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
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

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
  }, [loadEntries])

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
    setEntrySheetOpen(true)
  }, [])

  const handleEditEntry = useCallback((entry: JournalEntry) => {
    setEditEntry(entry)
    setEntrySheetOpen(true)
  }, [])

  const handleSelectEntry = useCallback((entry: JournalEntry) => {
    setSelectedEntry(entry)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
            <Image src="/logo.png" alt="TradeITM" fill className="object-contain" />
          </div>
          <p className="text-muted-foreground text-sm">Loading your journal...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
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
            className="px-3.5 py-2.5 rounded-xl border border-white/[0.1] text-sm text-ivory hover:bg-white/[0.05] transition-colors"
          >
            Analytics
          </Link>
          <button
            onClick={handleNewEntry}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
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
        />
      )}

      <TradeEntrySheet
        open={entrySheetOpen}
        onClose={() => { setEntrySheetOpen(false); setEditEntry(null) }}
        onSave={handleSave}
        editEntry={editEntry}
        onRequestEditEntry={(entry) => {
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
