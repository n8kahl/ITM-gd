'use client'

import { useCallback } from 'react'
import type { JournalFilters } from '@/lib/types/journal'

interface JournalFilterBarProps {
  filters: JournalFilters
  onChange: (nextFilters: JournalFilters) => void
  availableTags: string[]
}

export function JournalFilterBar({ filters, onChange, availableTags }: JournalFilterBarProps) {
  const updateField = useCallback(<K extends keyof JournalFilters>(key: K, value: JournalFilters[K]) => {
    onChange({ ...filters, [key]: value })
  }, [filters, onChange])

  const handleSymbolChange = useCallback((value: string) => {
    updateField('symbol', value.toUpperCase())
  }, [updateField])

  const handleDirectionChange = useCallback((value: JournalFilters['direction']) => {
    updateField('direction', value)
  }, [updateField])

  const handleContractTypeChange = useCallback((value: JournalFilters['contractType']) => {
    updateField('contractType', value)
  }, [updateField])

  const handleIsWinnerChange = useCallback((value: JournalFilters['isWinner']) => {
    updateField('isWinner', value)
  }, [updateField])

  const handleSortByChange = useCallback((value: JournalFilters['sortBy']) => {
    updateField('sortBy', value)
  }, [updateField])

  const handleSortDirChange = useCallback((value: JournalFilters['sortDir']) => {
    updateField('sortDir', value)
  }, [updateField])

  const handleViewChange = useCallback((value: JournalFilters['view']) => {
    updateField('view', value)
  }, [updateField])

  const handleTagsChange = useCallback((value: string) => {
    const tags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    updateField('tags', tags)
  }, [updateField])

  const clearAll = useCallback(() => {
    onChange({
      ...filters,
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
    })
  }, [filters, onChange])

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <input
          type="date"
          value={filters.startDate ?? ''}
          onChange={(event) => updateField('startDate', event.target.value || null)}
          className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
          aria-label="Start date"
        />

        <input
          type="date"
          value={filters.endDate ?? ''}
          onChange={(event) => updateField('endDate', event.target.value || null)}
          className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
          aria-label="End date"
        />

        <input
          value={filters.symbol}
          onChange={(event) => handleSymbolChange(event.target.value)}
          placeholder="Symbol"
          className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
          aria-label="Symbol"
        />

        <select
          value={filters.direction}
          onChange={(event) => handleDirectionChange(event.target.value as JournalFilters['direction'])}
          className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
          aria-label="Direction"
        >
          <option value="all">All directions</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>

        <select
          value={filters.contractType}
          onChange={(event) => handleContractTypeChange(event.target.value as JournalFilters['contractType'])}
          className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
          aria-label="Contract type"
        >
          <option value="all">All types</option>
          <option value="stock">Stock</option>
          <option value="call">Call</option>
          <option value="put">Put</option>
        </select>

        <select
          value={filters.isWinner}
          onChange={(event) => handleIsWinnerChange(event.target.value as JournalFilters['isWinner'])}
          className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
          aria-label="Win/loss"
        >
          <option value="all">All results</option>
          <option value="true">Winners</option>
          <option value="false">Losers</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <select
          value={filters.sortBy}
          onChange={(event) => handleSortByChange(event.target.value as JournalFilters['sortBy'])}
          className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
          aria-label="Sort by"
        >
          <option value="trade_date">Sort: Trade Date</option>
          <option value="pnl">Sort: P&L</option>
          <option value="symbol">Sort: Symbol</option>
        </select>

        <select
          value={filters.sortDir}
          onChange={(event) => handleSortDirChange(event.target.value as JournalFilters['sortDir'])}
          className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
          aria-label="Sort direction"
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>

        <select
          value={filters.view}
          onChange={(event) => handleViewChange(event.target.value as JournalFilters['view'])}
          className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
          aria-label="View"
        >
          <option value="table">Table</option>
          <option value="cards">Cards</option>
        </select>

        <input
          value={filters.tags.join(', ')}
          onChange={(event) => handleTagsChange(event.target.value)}
          placeholder={availableTags.length > 0 ? `Tags (${availableTags.slice(0, 3).join(', ')})` : 'Tags'}
          className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory md:col-span-2"
          aria-label="Tags"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={clearAll}
          className="h-10 rounded-md border border-white/10 px-4 text-sm text-ivory hover:bg-white/5"
        >
          Clear all
        </button>
      </div>
    </div>
  )
}
