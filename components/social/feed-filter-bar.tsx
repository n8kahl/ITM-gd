'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FeedFilters, FeedItemType } from '@/lib/types/social'
import { Star } from 'lucide-react'

interface FeedFilterBarProps {
  filters: FeedFilters
  onFiltersChange: (filters: FeedFilters) => void
  className?: string
}

const FILTER_TABS: Array<{ label: string; value: FeedItemType | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Trades', value: 'trade_card' },
  { label: 'Achievements', value: 'achievement' },
  { label: 'Milestones', value: 'milestone' },
  { label: 'Highlights', value: 'highlight' },
]

const SORT_OPTIONS: Array<{ label: string; value: FeedFilters['sort'] }> = [
  { label: 'Latest', value: 'latest' },
  { label: 'Most Liked', value: 'most_liked' },
  { label: 'Top P&L', value: 'top_pnl' },
]

export function FeedFilterBar({ filters, onFiltersChange, className }: FeedFilterBarProps) {
  const handleTypeChange = (type: FeedItemType | 'all') => {
    onFiltersChange({ ...filters, type })
  }

  const handleSortChange = (sort: string) => {
    onFiltersChange({ ...filters, sort: sort as FeedFilters['sort'] })
  }

  const handleFeaturedToggle = () => {
    onFiltersChange({ ...filters, featured_only: !filters.featured_only })
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Type Filters and Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Type Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tab) => (
            <Button
              key={tab.value}
              variant={filters.type === tab.value ? 'default' : 'ghost'}
              size="sm"
              data-testid={`filter-${tab.value}`}
              onClick={() => handleTypeChange(tab.value)}
              className={cn(
                'h-8 rounded-lg px-3 text-xs transition-all',
                filters.type === tab.value
                  ? 'bg-emerald-600 text-white shadow-[0_2px_10px_rgba(16,185,129,0.2)]'
                  : 'text-white/50 hover:text-white/80'
              )}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Sort & Featured */}
        <div className="flex items-center gap-2">
          <Button
            variant={filters.featured_only ? 'default' : 'ghost'}
            size="sm"
            onClick={handleFeaturedToggle}
            className={cn(
              'h-8 gap-1 rounded-lg px-3 text-xs',
              filters.featured_only
                ? 'bg-emerald-600 text-white'
                : 'text-white/50 hover:text-white/80'
            )}
          >
            <Star className="h-3 w-3" />
            Featured
          </Button>

          <Select value={filters.sort} onValueChange={handleSortChange}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
