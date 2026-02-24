'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

import { AcademyModuleCardV2 } from '@/components/academy/catalog/academy-module-card-v2'
import type { ModuleSchema } from '@/components/academy/catalog/academy-module-card-v2'
import type { AcademyTrack } from '@/lib/academy-v3/contracts/domain'

export type TrackWithModules = AcademyTrack & {
  modules: Array<ModuleSchema>
}

type DifficultyLabel = 'Beginner' | 'Intermediate' | 'Advanced'

interface DifficultyConfig {
  label: DifficultyLabel
  badgeClass: string
  gradientFrom: string
  gradientTo: string
  accentClass: string
}

function getDifficultyConfig(position: number): DifficultyConfig {
  if (position === 0) {
    return {
      label: 'Beginner',
      badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
      gradientFrom: 'from-emerald-500/15',
      gradientTo: 'to-emerald-900/5',
      accentClass: 'bg-emerald-400',
    }
  }
  if (position <= 2) {
    return {
      label: 'Intermediate',
      badgeClass: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
      gradientFrom: 'from-amber-500/10',
      gradientTo: 'to-amber-900/5',
      accentClass: 'bg-amber-400',
    }
  }
  return {
    label: 'Advanced',
    badgeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
    gradientFrom: 'from-rose-500/10',
    gradientTo: 'to-rose-900/5',
    accentClass: 'bg-rose-400',
  }
}

function computeTrackProgress(
  modules: Array<ModuleSchema>,
  moduleProgressById: Map<string, number>
): number {
  if (modules.length === 0) return 0
  const startedCount = modules.filter((m) => (moduleProgressById.get(m.id) ?? 0) > 0).length
  return Math.round((startedCount / modules.length) * 100)
}

export function AcademyTrackSection({
  track,
  trackIndex,
  totalTracks,
  moduleProgressById,
}: {
  track: TrackWithModules
  trackIndex: number
  totalTracks: number
  moduleProgressById: Map<string, number>
}) {
  const [isExpanded, setIsExpanded] = useState(true)

  const config = getDifficultyConfig(track.position)
  const trackProgress = computeTrackProgress(track.modules, moduleProgressById)
  const moduleCount = track.modules.length

  return (
    <section
      className="overflow-hidden rounded-2xl border border-white/10"
      data-testid="academy-track-section"
      data-track-id={track.id}
    >
      {/* Track header */}
      <div
        className={[
          'bg-gradient-to-br',
          config.gradientFrom,
          config.gradientTo,
          'border-b border-white/8 px-5 py-4',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Left: title + description */}
          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  'h-2.5 w-2.5 rounded-full shrink-0',
                  config.accentClass,
                ].join(' ')}
                aria-hidden
              />
              <h2
                className="font-serif text-lg font-semibold text-white"
                data-testid="track-section-title"
              >
                {track.title}
              </h2>
              <span
                className={[
                  'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  config.badgeClass,
                ].join(' ')}
                data-testid="track-difficulty-badge"
              >
                {config.label}
              </span>
            </div>
            {track.description && (
              <p className="text-sm text-zinc-400 leading-relaxed">{track.description}</p>
            )}
          </div>

          {/* Right: track index + collapse toggle */}
          <div className="flex shrink-0 items-center gap-3">
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400 font-mono">
              Track {trackIndex + 1} of {totalTracks}
            </span>
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? `Collapse ${track.title}` : `Expand ${track.title}`}
              data-testid="track-collapse-toggle"
            >
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              )}
            </button>
          </div>
        </div>

        {/* Track progress bar */}
        <div className="mt-3 space-y-1.5" data-testid="track-progress-bar">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              {moduleCount} {moduleCount === 1 ? 'module' : 'modules'}
            </p>
            <p className="text-xs font-mono text-zinc-400">
              {trackProgress}% started
            </p>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-700"
              style={{ width: `${trackProgress}%` }}
              role="progressbar"
              aria-valuenow={trackProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${track.title} track progress: ${trackProgress}%`}
            />
          </div>
        </div>
      </div>

      {/* Module grid (collapsible) */}
      {isExpanded && (
        <div
          className="p-4"
          data-testid="track-module-grid"
        >
          {moduleCount === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500">No modules in this track yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {track.modules.map((moduleItem) => (
                <AcademyModuleCardV2
                  key={moduleItem.id}
                  moduleItem={moduleItem}
                  trackTitle={track.title}
                  progressPercent={moduleProgressById.get(moduleItem.id)}
                  trackPosition={track.position}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
