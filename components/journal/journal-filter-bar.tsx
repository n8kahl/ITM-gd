'use client'

import { useCallback } from 'react'
import { DatePickerField } from '@/components/journal/date-picker-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { JournalFilters } from '@/lib/types/journal'

interface JournalFilterBarProps {
  filters: JournalFilters
  onChange: (nextFilters: JournalFilters) => void
  availableTags: string[]
}

const inputClassName = 'h-10 border-white/10 bg-black/20 text-sm text-ivory placeholder:text-muted-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50'
const selectClassName = 'h-10 border-white/10 bg-black/20 text-sm text-ivory focus:ring-2 focus:ring-emerald-500/50'

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

  const handleIsOpenChange = useCallback((value: JournalFilters['isOpen']) => {
    updateField('isOpen', value)
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
      limit: 500,
      offset: 0,
    })
  }, [filters, onChange])

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <DatePickerField
          value={filters.startDate}
          onChange={(date) => updateField('startDate', date)}
          placeholder="Start date"
          ariaLabel="Start date"
        />

        <DatePickerField
          value={filters.endDate}
          onChange={(date) => updateField('endDate', date)}
          placeholder="End date"
          ariaLabel="End date"
        />

        <Input
          value={filters.symbol}
          onChange={(event) => handleSymbolChange(event.target.value)}
          placeholder="Symbol"
          className={inputClassName}
          aria-label="Symbol"
        />

        <Select value={filters.direction} onValueChange={(value) => handleDirectionChange(value as JournalFilters['direction'])}>
          <SelectTrigger className={selectClassName} aria-label="Direction">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All directions</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="short">Short</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.contractType} onValueChange={(value) => handleContractTypeChange(value as JournalFilters['contractType'])}>
          <SelectTrigger className={selectClassName} aria-label="Contract type">
            <SelectValue placeholder="Contract type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="stock">Stock</SelectItem>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="put">Put</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.isWinner} onValueChange={(value) => handleIsWinnerChange(value as JournalFilters['isWinner'])}>
          <SelectTrigger className={selectClassName} aria-label="Win/loss">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="true">Winners</SelectItem>
            <SelectItem value="false">Losers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Select value={filters.isOpen} onValueChange={(value) => handleIsOpenChange(value as JournalFilters['isOpen'])}>
          <SelectTrigger className={selectClassName} aria-label="Open/closed">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="true">Open</SelectItem>
            <SelectItem value="false">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sortBy} onValueChange={(value) => handleSortByChange(value as JournalFilters['sortBy'])}>
          <SelectTrigger className={selectClassName} aria-label="Sort by">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trade_date">Sort: Trade Date</SelectItem>
            <SelectItem value="pnl">Sort: P&L</SelectItem>
            <SelectItem value="symbol">Sort: Symbol</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sortDir} onValueChange={(value) => handleSortDirChange(value as JournalFilters['sortDir'])}>
          <SelectTrigger className={selectClassName} aria-label="Sort direction">
            <SelectValue placeholder="Sort direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Descending</SelectItem>
            <SelectItem value="asc">Ascending</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.view} onValueChange={(value) => handleViewChange(value as JournalFilters['view'])}>
          <SelectTrigger className={selectClassName} aria-label="View">
            <SelectValue placeholder="View" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="table">Table</SelectItem>
            <SelectItem value="cards">Cards</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={filters.tags.join(', ')}
          onChange={(event) => handleTagsChange(event.target.value)}
          placeholder={availableTags.length > 0 ? `Tags (${availableTags.slice(0, 3).join(', ')})` : 'Tags'}
          className={`${inputClassName} md:col-span-2`}
          aria-label="Tags"
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="luxury-outline" size="sm" onClick={clearAll} className="h-10 px-4">
          Clear all
        </Button>
      </div>
    </div>
  )
}
