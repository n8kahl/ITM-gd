'use client'

import { Search, SortAsc } from 'lucide-react'
import { useEffect, useMemo, useState, useCallback } from 'react'

import { AcademyShell } from '@/components/academy/academy-shell'
import { AcademyTrackSection, type TrackWithModules } from '@/components/academy/catalog/academy-track-section'
import { fetchAcademyPlan, fetchAcademyProgressSummary } from '@/lib/academy-v3/client'

type PlanData = Awaited<ReturnType<typeof fetchAcademyPlan>>
type ProgressSummary = Awaited<ReturnType<typeof fetchAcademyProgressSummary>>

type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced'
type SortOrder = 'recommended' | 'newest'

/** Map track.position → difficulty bucket */
function trackDifficulty(position: number): DifficultyFilter {
  if (position === 0) return 'beginner'
  if (position <= 2) return 'intermediate'
  return 'advanced'
}

const DIFFICULTY_FILTERS: Array<{ value: DifficultyFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

const DIFFICULTY_ACTIVE_CLASS: Record<DifficultyFilter, string> = {
  all: 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300',
  beginner: 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300',
  intermediate: 'border-amber-500/60 bg-amber-500/20 text-amber-300',
  advanced: 'border-rose-500/60 bg-rose-500/20 text-rose-300',
}

// ---------------------------------------------------------------------------
// Sub-component: filter / search / sort toolbar
// ---------------------------------------------------------------------------

interface CatalogToolbarProps {
  difficultyFilter: DifficultyFilter
  onDifficultyChange: (v: DifficultyFilter) => void
  searchQuery: string
  onSearchChange: (v: string) => void
  sortOrder: SortOrder
  onSortChange: (v: SortOrder) => void
}

function CatalogToolbar({
  difficultyFilter,
  onDifficultyChange,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
}: CatalogToolbarProps) {
  return (
    <div
      className="glass-card-heavy flex flex-col gap-3 rounded-xl border border-white/10 p-3 sm:flex-row sm:items-center sm:gap-4"
      data-testid="catalog-toolbar"
    >
      {/* Difficulty filter buttons */}
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Filter by difficulty"
        data-testid="catalog-difficulty-filters"
      >
        {DIFFICULTY_FILTERS.map((f) => {
          const isActive = difficultyFilter === f.value
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => onDifficultyChange(f.value)}
              className={[
                'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                isActive
                  ? DIFFICULTY_ACTIVE_CLASS[f.value]
                  : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200',
              ].join(' ')}
              aria-pressed={isActive}
              data-testid={`catalog-filter-${f.value}`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search input */}
      <div className="relative flex-shrink-0 sm:w-52">
        <Search
          className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
          strokeWidth={1.5}
          aria-hidden
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search modules…"
          className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500/50 focus:bg-white/8"
          aria-label="Search modules"
          data-testid="catalog-search-input"
        />
      </div>

      {/* Sort selector */}
      <div className="flex shrink-0 items-center gap-1.5">
        <SortAsc className="h-3.5 w-3.5 text-zinc-500" strokeWidth={1.5} aria-hidden />
        <select
          value={sortOrder}
          onChange={(e) => onSortChange(e.target.value as SortOrder)}
          className="rounded-lg border border-white/10 bg-[#0f1117] py-1.5 pl-2 pr-6 text-sm text-zinc-300 outline-none focus:border-emerald-500/50"
          aria-label="Sort modules"
          data-testid="catalog-sort-select"
        >
          <option value="recommended">Recommended</option>
          <option value="newest">Newest</option>
        </select>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers: apply search/filter/sort to plan tracks
// ---------------------------------------------------------------------------

function applyFilters(
  tracks: PlanData['tracks'],
  difficultyFilter: DifficultyFilter,
  searchQuery: string,
  sortOrder: SortOrder
): PlanData['tracks'] {
  const q = searchQuery.trim().toLowerCase()

  let filtered = tracks.map((track) => {
    // Filter modules within the track by search query
    const filteredModules = q
      ? track.modules.filter(
          (m) =>
            m.title.toLowerCase().includes(q) ||
            (m.description ?? '').toLowerCase().includes(q) ||
            m.lessons.some((l) => l.title.toLowerCase().includes(q))
        )
      : track.modules

    return { ...track, modules: filteredModules }
  })

  // Filter tracks by difficulty level
  if (difficultyFilter !== 'all') {
    filtered = filtered.filter(
      (t) => trackDifficulty(t.position) === difficultyFilter
    )
  }

  // Remove tracks that have no matching modules (only relevant when search active)
  if (q) {
    filtered = filtered.filter((t) => t.modules.length > 0)
  }

  // Sort
  if (sortOrder === 'recommended') {
    filtered = [...filtered].sort((a, b) => a.position - b.position)
  } else {
    // "Newest": reverse position order (highest position = newest)
    filtered = [...filtered].sort((a, b) => b.position - a.position)
  }

  return filtered
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AcademyModuleCatalog() {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Toolbar state
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('recommended')

  useEffect(() => {
    let active = true

    Promise.all([fetchAcademyPlan(), fetchAcademyProgressSummary()])
      .then(([planData, progressSummary]) => {
        if (!active) return
        setPlan(planData)
        setSummary(progressSummary)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load module catalog')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const moduleProgressById = useMemo(() => {
    const entries = new Map<string, number>()
    for (const moduleItem of summary?.modules ?? []) {
      entries.set(moduleItem.moduleId, moduleItem.progressPercent)
    }
    return entries
  }, [summary])

  const filteredTracks = useMemo<TrackWithModules[]>(() => {
    if (!plan) return []
    return applyFilters(plan.tracks, difficultyFilter, searchQuery, sortOrder) as TrackWithModules[]
  }, [plan, difficultyFilter, searchQuery, sortOrder])

  const handleDifficultyChange = useCallback((v: DifficultyFilter) => {
    setDifficultyFilter(v)
  }, [])

  const handleSearchChange = useCallback((v: string) => {
    setSearchQuery(v)
  }, [])

  const handleSortChange = useCallback((v: SortOrder) => {
    setSortOrder(v)
  }, [])

  const totalTracks = plan?.tracks.length ?? 0

  return (
    <AcademyShell
      title="Module Catalog"
      description="Browse the full curriculum by track. Filter by difficulty, search by topic, or follow the recommended sequence."
      maxWidthClassName="max-w-6xl"
    >
      {loading ? (
        <div
          className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-zinc-300"
          data-testid="catalog-loading"
        >
          Loading modules…
        </div>
      ) : error ? (
        <div
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200"
          data-testid="catalog-error"
        >
          {error}
        </div>
      ) : (
        <div className="space-y-5" data-testid="academy-module-catalog">
          {/* Toolbar */}
          <CatalogToolbar
            difficultyFilter={difficultyFilter}
            onDifficultyChange={handleDifficultyChange}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
          />

          {/* Track sections */}
          {filteredTracks.length === 0 ? (
            <div
              className="glass-card-heavy rounded-xl border border-white/10 p-8 text-center text-sm text-zinc-400"
              data-testid="catalog-empty"
            >
              No modules match your filters.{' '}
              <button
                type="button"
                className="ml-1 text-emerald-400 underline-offset-2 hover:underline"
                onClick={() => {
                  setDifficultyFilter('all')
                  setSearchQuery('')
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-4" data-testid="catalog-tracks-list">
              {filteredTracks.map((track, index) => (
                <AcademyTrackSection
                  key={track.id}
                  track={track}
                  trackIndex={index}
                  totalTracks={totalTracks}
                  moduleProgressById={moduleProgressById}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </AcademyShell>
  )
}
