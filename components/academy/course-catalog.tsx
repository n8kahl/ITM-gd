'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Search, SlidersHorizontal, X, Rows3, Grid3X3 } from 'lucide-react'
import { CourseCard, type CourseCardData } from '@/components/academy/course-card'

interface CourseCatalogProps {
  courses: CourseCardData[]
  paths?: string[]
  className?: string
}

const DIFFICULTY_OPTIONS = ['all', 'beginner', 'intermediate', 'advanced'] as const
const STATUS_OPTIONS = ['all', 'not_started', 'in_progress', 'completed'] as const
const DURATION_OPTIONS = ['all', 'micro', 'full'] as const

export function CourseCatalog({ courses, paths = [], className }: CourseCatalogProps) {
  const [search, setSearch] = useState('')
  const [selectedPath, setSelectedPath] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedDuration, setSelectedDuration] = useState<string>('all')
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [showFilters, setShowFilters] = useState(false)

  const uniquePaths = useMemo(() => {
    if (paths.length > 0) return paths
    return Array.from(new Set(courses.map((c) => c.path))).sort()
  }, [courses, paths])

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch =
        !search ||
        course.title.toLowerCase().includes(search.toLowerCase()) ||
        course.description.toLowerCase().includes(search.toLowerCase()) ||
        (course.skills || []).some((skill) => skill.toLowerCase().includes(search.toLowerCase()))

      const matchesPath =
        selectedPath === 'all' || course.path === selectedPath

      const matchesDifficulty =
        selectedDifficulty === 'all' || course.difficulty === selectedDifficulty

      const status =
        course.totalLessons > 0 && course.completedLessons >= course.totalLessons
          ? 'completed'
          : course.completedLessons > 0
            ? 'in_progress'
            : 'not_started'
      const matchesStatus = selectedStatus === 'all' || status === selectedStatus

      const isMicro = (course.microLearningAvailable ?? false) || course.estimatedMinutes <= 30
      const matchesDuration =
        selectedDuration === 'all' ||
        (selectedDuration === 'micro' && isMicro) ||
        (selectedDuration === 'full' && !isMicro)

      return matchesSearch && matchesPath && matchesDifficulty && matchesStatus && matchesDuration
    })
  }, [courses, search, selectedPath, selectedDifficulty, selectedStatus, selectedDuration])

  const hasActiveFilters =
    selectedPath !== 'all' ||
    selectedDifficulty !== 'all' ||
    selectedStatus !== 'all' ||
    selectedDuration !== 'all' ||
    search !== ''

  return (
    <div className={cn('space-y-6', className)}>
      {/* Search and filter bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-white',
                'bg-white/5 border border-white/10',
                'placeholder:text-white/30',
                'focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20',
                'transition-colors'
              )}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm',
                'border transition-colors',
                showFilters || hasActiveFilters
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white/80'
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            <div className="hidden sm:flex items-center rounded-lg border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setDensity('comfortable')}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  density === 'comfortable' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/50'
                )}
                aria-label="Comfortable grid"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDensity('compact')}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  density === 'compact' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/50'
                )}
                aria-label="Compact grid"
              >
                <Rows3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter pills */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-3"
            >
              {/* Path filter */}
              {uniquePaths.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
                    Learning Path
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <FilterPill
                      label="All Paths"
                      active={selectedPath === 'all'}
                      onClick={() => setSelectedPath('all')}
                    />
                    {uniquePaths.map((path) => (
                      <FilterPill
                        key={path}
                        label={path}
                        active={selectedPath === path}
                        onClick={() => setSelectedPath(path)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Difficulty filter */}
              <div className="space-y-1.5">
                <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
                  Difficulty
                </p>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTY_OPTIONS.map((diff) => (
                    <FilterPill
                      key={diff}
                      label={diff === 'all' ? 'All Levels' : diff.charAt(0).toUpperCase() + diff.slice(1)}
                      active={selectedDifficulty === diff}
                      onClick={() => setSelectedDifficulty(diff)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
                  Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <FilterPill
                      key={status}
                      label={
                        status === 'all'
                          ? 'All Progress'
                          : status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
                      }
                      active={selectedStatus === status}
                      onClick={() => setSelectedStatus(status)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
                  Format
                </p>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map((duration) => (
                    <FilterPill
                      key={duration}
                      label={
                        duration === 'all'
                          ? 'All Formats'
                          : duration === 'micro'
                            ? 'Micro-Learning'
                            : 'Full Courses'
                      }
                      active={selectedDuration === duration}
                      onClick={() => setSelectedDuration(duration)}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/40">
          {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} found
        </p>
        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearch('')
              setSelectedPath('all')
              setSelectedDifficulty('all')
              setSelectedStatus('all')
              setSelectedDuration('all')
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Course grid */}
      <div
        className={cn(
          'grid gap-4',
          density === 'compact'
            ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
            : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
        )}
      >
        <AnimatePresence mode="popLayout">
          {filteredCourses.map((course) => (
            <motion.div
              key={course.slug}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <CourseCard course={course} density={density} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {filteredCourses.length === 0 && (
        <div className="text-center py-16">
          <p className="text-white/40 text-sm">No courses match your filters.</p>
          <button
            onClick={() => {
              setSearch('')
              setSelectedPath('all')
              setSelectedDifficulty('all')
              setSelectedStatus('all')
              setSelectedDuration('all')
            }}
            className="mt-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
        active
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'bg-white/5 text-white/50 border border-white/10 hover:text-white/70 hover:border-white/20'
      )}
    >
      {label}
    </button>
  )
}
