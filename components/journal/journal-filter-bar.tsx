'use client'

import { useCallback, useMemo } from 'react'
import {
  Search,
  SlidersHorizontal,
  X,
  LayoutGrid,
  TableIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JournalFilters } from '@/lib/types/journal'

// ============================================
// DATE PRESETS
// ============================================

const DATE_PRESETS: { value: JournalFilters['dateRange']['preset']; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this-week', label: 'This Week' },
  { value: 'this-month', label: 'This Month' },
  { value: '3-months', label: '3M' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all', label: 'All' },
]

function getDateRangeForPreset(preset: string): { from: string | null; to: string | null } {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'this-week': {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      return { from: weekStart.toISOString().split('T')[0], to: today }
    }
    case 'this-month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: monthStart.toISOString().split('T')[0], to: today }
    }
    case 'last-month': {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: lastMonthStart.toISOString().split('T')[0], to: lastMonthEnd.toISOString().split('T')[0] }
    }
    case '3-months': {
      const threeMonthsAgo = new Date(now)
      threeMonthsAgo.setMonth(now.getMonth() - 3)
      return { from: threeMonthsAgo.toISOString().split('T')[0], to: today }
    }
    case 'ytd': {
      const yearStart = new Date(now.getFullYear(), 0, 1)
      return { from: yearStart.toISOString().split('T')[0], to: today }
    }
    default:
      return { from: null, to: null }
  }
}

// ============================================
// COMPONENT
// ============================================

interface JournalFilterBarProps {
  filters: JournalFilters
  onChange: (filters: JournalFilters) => void
  availableTags: string[]
  totalFiltered: number
}

export function JournalFilterBar({ filters, onChange, availableTags, totalFiltered }: JournalFilterBarProps) {
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.dateRange.preset !== 'all') count++
    if (filters.symbol) count++
    if (filters.direction !== 'all') count++
    if (filters.contractType !== 'all') count++
    if (filters.pnlFilter !== 'all') count++
    if (filters.tags.length > 0) count++
    if (filters.aiGrade && filters.aiGrade.length > 0) count++
    return count
  }, [filters])

  const updateFilter = useCallback(<K extends keyof JournalFilters>(key: K, value: JournalFilters[K]) => {
    onChange({ ...filters, [key]: value })
  }, [filters, onChange])

  const resetFilters = useCallback(() => {
    onChange({
      ...filters,
      dateRange: { from: null, to: null, preset: 'all' },
      symbol: null,
      direction: 'all',
      contractType: 'all',
      pnlFilter: 'all',
      tags: [],
      aiGrade: null,
    })
  }, [filters, onChange])

  return (
    <div className="glass-card rounded-xl p-3 lg:p-4 space-y-3">
      {/* Top Row: Search + Sort + View Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        {/* Symbol Search */}
        <div className="relative flex-1 sm:max-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search symbol..."
            value={filters.symbol || ''}
            onChange={(e) => updateFilter('symbol', e.target.value.toUpperCase() || null)}
            className="focus-champagne w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-ivory placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/20 transition-colors min-h-[44px]"
            aria-label="Search trades by symbol"
          />
          {filters.symbol && (
            <button
              type="button"
              aria-label="Clear symbol filter"
              onClick={() => updateFilter('symbol', null)}
              className="focus-champagne absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-ivory"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <select
            value={filters.sortBy}
            onChange={(e) => updateFilter('sortBy', e.target.value as JournalFilters['sortBy'])}
            className="focus-champagne flex-1 sm:flex-none px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-ivory appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-h-[44px]"
            aria-label="Sort journal entries"
          >
            <option value="date-desc">Newest</option>
            <option value="date-asc">Oldest</option>
            <option value="pnl-desc">Highest P&L</option>
            <option value="pnl-asc">Lowest P&L</option>
            <option value="rating-desc">Best Rating</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5 sm:ml-auto">
            <button
              type="button"
              onClick={() => updateFilter('view', 'table')}
              className={cn(
                'focus-champagne p-2 rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
                filters.view === 'table'
                  ? 'bg-emerald-900/30 text-emerald-400'
                  : 'text-muted-foreground hover:text-ivory'
              )}
              title="Table view"
              aria-label="Switch to table view"
              aria-pressed={filters.view === 'table'}
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => updateFilter('view', 'cards')}
              className={cn(
                'focus-champagne p-2 rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
                filters.view === 'cards'
                  ? 'bg-emerald-900/30 text-emerald-400'
                  : 'text-muted-foreground hover:text-ivory'
              )}
              title="Card view"
              aria-label="Switch to card view"
              aria-pressed={filters.view === 'cards'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-wrap">
        {/* Date Presets */}
        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
          <div className="flex items-center gap-1 bg-white/[0.02] rounded-lg p-0.5 min-w-max">
            {DATE_PRESETS.map(preset => (
              <button
                type="button"
                key={preset.value}
                onClick={() => {
                  const range = getDateRangeForPreset(preset.value)
                  updateFilter('dateRange', { ...range, preset: preset.value })
                }}
                className={cn(
                  'focus-champagne px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap min-h-[36px]',
                  filters.dateRange.preset === preset.value
                    ? 'bg-emerald-900/30 text-emerald-400'
                    : 'text-muted-foreground hover:text-ivory'
                )}
                aria-pressed={filters.dateRange.preset === preset.value}
                aria-label={`Filter to ${preset.label}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/[0.08] hidden sm:block" />

        {/* Direction Filter */}
        <div className="flex items-center gap-1 bg-white/[0.02] rounded-lg p-0.5">
          {(['all', 'long', 'short'] as const).map(dir => (
            <button
              type="button"
              key={dir}
              onClick={() => updateFilter('direction', dir)}
              className={cn(
                'focus-champagne px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                filters.direction === dir
                  ? dir === 'long'
                    ? 'bg-emerald-900/30 text-emerald-400'
                    : dir === 'short'
                    ? 'bg-red-900/30 text-red-400'
                    : 'bg-white/[0.06] text-ivory'
                  : 'text-muted-foreground hover:text-ivory'
              )}
              aria-pressed={filters.direction === dir}
            >
              {dir === 'all' ? 'All' : dir}
            </button>
          ))}
        </div>

        {/* P&L Filter */}
        <div className="flex items-center gap-1 bg-white/[0.02] rounded-lg p-0.5">
          {(['all', 'winners', 'losers'] as const).map(pnl => (
            <button
              type="button"
              key={pnl}
              onClick={() => updateFilter('pnlFilter', pnl)}
              className={cn(
                'focus-champagne px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                filters.pnlFilter === pnl
                  ? pnl === 'winners'
                    ? 'bg-emerald-900/30 text-emerald-400'
                    : pnl === 'losers'
                    ? 'bg-red-900/30 text-red-400'
                    : 'bg-white/[0.06] text-ivory'
                  : 'text-muted-foreground hover:text-ivory'
              )}
              aria-pressed={filters.pnlFilter === pnl}
            >
              {pnl === 'all' ? 'All P&L' : pnl}
            </button>
          ))}
        </div>

        {/* Contract Type Filter */}
        <div className="flex items-center gap-1 bg-white/[0.02] rounded-lg p-0.5">
          {(['all', 'stock', 'call', 'put'] as const).map((contractType) => (
            <button
              type="button"
              key={contractType}
              onClick={() => updateFilter('contractType', contractType)}
              className={cn(
                'focus-champagne px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                filters.contractType === contractType
                  ? 'bg-white/[0.06] text-ivory'
                  : 'text-muted-foreground hover:text-ivory'
              )}
              aria-pressed={filters.contractType === contractType}
            >
              {contractType}
            </button>
          ))}
        </div>

        {/* Active filter pills */}
        <div className="flex items-center gap-1 flex-wrap">
          {filters.symbol && (
            <button
              type="button"
              onClick={() => updateFilter('symbol', null)}
              className="focus-champagne inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
            >
              Symbol: {filters.symbol}
              <X className="w-2.5 h-2.5" />
            </button>
          )}
          {filters.direction !== 'all' && (
            <button
              type="button"
              onClick={() => updateFilter('direction', 'all')}
              className="focus-champagne inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-white/[0.06] text-ivory border border-white/[0.12]"
            >
              Direction: {filters.direction}
              <X className="w-2.5 h-2.5" />
            </button>
          )}
          {filters.contractType !== 'all' && (
            <button
              type="button"
              onClick={() => updateFilter('contractType', 'all')}
              className="focus-champagne inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-white/[0.06] text-ivory border border-white/[0.12]"
            >
              Type: {filters.contractType}
              <X className="w-2.5 h-2.5" />
            </button>
          )}
          {filters.pnlFilter !== 'all' && (
            <button
              type="button"
              onClick={() => updateFilter('pnlFilter', 'all')}
              className="focus-champagne inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-white/[0.06] text-ivory border border-white/[0.12]"
            >
              P&L: {filters.pnlFilter}
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        {/* Tag chips (if any active) */}
        {filters.tags.length > 0 && (
          <div className="flex items-center gap-1">
            {filters.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-champagne/10 text-champagne border border-champagne/20"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Remove ${tag} tag filter`}
                  onClick={() => updateFilter('tags', filters.tags.filter(t => t !== tag))}
                  className="focus-champagne rounded-full p-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Active filter count + Reset */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="focus-champagne text-xs text-muted-foreground hover:text-ivory transition-colors ml-auto"
          >
            Clear All ({activeFilterCount})
          </button>
        )}
      </div>
    </div>
  )
}
