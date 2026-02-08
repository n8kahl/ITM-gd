'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { Plus, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JournalEntry, JournalFilters } from '@/lib/types/journal'
import { DEFAULT_FILTERS } from '@/lib/types/journal'
import { JournalFilterBar } from '@/components/journal/journal-filter-bar'
import { JournalSummaryStats } from '@/components/journal/journal-summary-stats'
import { JournalTableView } from '@/components/journal/journal-table-view'
import { JournalCardView } from '@/components/journal/journal-card-view'
import { TradeEntrySheet } from '@/components/journal/trade-entry-sheet'
import { EntryDetailSheet } from '@/components/journal/entry-detail-sheet'

// ============================================
// FILTERING + SORTING LOGIC
// ============================================

function applyFilters(entries: JournalEntry[], filters: JournalFilters): JournalEntry[] {
  let filtered = [...entries]

  // Date range
  if (filters.dateRange.from) {
    filtered = filtered.filter(e => e.trade_date >= filters.dateRange.from!)
  }
  if (filters.dateRange.to) {
    filtered = filtered.filter(e => e.trade_date.split('T')[0] <= filters.dateRange.to!)
  }

  // Symbol
  if (filters.symbol) {
    const sym = filters.symbol.toUpperCase()
    filtered = filtered.filter(e => e.symbol?.toUpperCase().includes(sym))
  }

  // Direction
  if (filters.direction !== 'all') {
    filtered = filtered.filter(e => e.direction === filters.direction)
  }

  // P&L
  if (filters.pnlFilter === 'winners') {
    filtered = filtered.filter(e => (e.pnl ?? 0) > 0)
  } else if (filters.pnlFilter === 'losers') {
    filtered = filtered.filter(e => (e.pnl ?? 0) < 0)
  }

  // Tags
  if (filters.tags.length > 0) {
    filtered = filtered.filter(e =>
      filters.tags.some(tag => e.tags.includes(tag) || e.smart_tags.includes(tag))
    )
  }

  // AI Grade
  if (filters.aiGrade && filters.aiGrade.length > 0) {
    filtered = filtered.filter(e =>
      e.ai_analysis?.grade && filters.aiGrade!.includes(e.ai_analysis.grade)
    )
  }

  // Sort
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

// ============================================
// JOURNAL PAGE
// ============================================

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<JournalFilters>(DEFAULT_FILTERS)

  // Sheet states
  const [entrySheetOpen, setEntrySheetOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)

  // Load entries
  const loadEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/members/journal?limit=500')
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setEntries(data.data)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])

  // Apply filters
  const filteredEntries = useMemo(() => applyFilters(entries, filters), [entries, filters])

  // Collect available tags
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    entries.forEach(e => {
      e.tags?.forEach(t => tagSet.add(t))
      e.smart_tags?.forEach(t => tagSet.add(t))
    })
    return Array.from(tagSet).sort()
  }, [entries])

  // Save trade (create or update)
  const handleSave = useCallback(async (data: Record<string, unknown>) => {
    const method = data.id ? 'PATCH' : 'POST'
    const res = await fetch('/api/members/journal', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const result = await res.json()

    if (result.success && result.data) {
      // Trigger enrichment in background
      if (!data.id) {
        fetch('/api/members/journal/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId: result.data.id }),
        }).catch(() => {})
      }
    }

    await loadEntries()
  }, [loadEntries])

  // Delete trade
  const handleDelete = useCallback(async (entryId: string) => {
    if (!confirm('Delete this trade? This action cannot be undone.')) return
    await fetch(`/api/members/journal?id=${entryId}`, { method: 'DELETE' })
    await loadEntries()
  }, [loadEntries])

  // Open entry sheet for new/edit
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

  // Loading
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-serif text-ivory font-medium tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            Trade Journal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {entries.length} trade{entries.length !== 1 ? 's' : ''} logged
          </p>
        </div>

        <button
          onClick={handleNewEntry}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Log Trade</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Filter Bar */}
      <JournalFilterBar
        filters={filters}
        onChange={setFilters}
        availableTags={availableTags}
        totalFiltered={filteredEntries.length}
      />

      {/* Summary Stats */}
      <JournalSummaryStats entries={filteredEntries} />

      {/* Entries */}
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

      {/* Trade Entry Sheet */}
      <TradeEntrySheet
        open={entrySheetOpen}
        onClose={() => { setEntrySheetOpen(false); setEditEntry(null) }}
        onSave={handleSave}
        editEntry={editEntry}
      />

      {/* Entry Detail Sheet */}
      <EntryDetailSheet
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onEdit={handleEditEntry}
        onDelete={handleDelete}
      />
    </div>
  )
}
