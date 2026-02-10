'use client'

import { Brain, Clock3, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReviewSessionHeaderProps {
  dueCount: number
  estimatedMinutes: number
  weakCompetencies: string[]
  onStart: () => void
  isLoading?: boolean
  disabled?: boolean
  className?: string
}

const COMPETENCY_LABELS: Record<string, string> = {
  market_context: 'Market Context',
  entry_validation: 'Entry Validation',
  position_sizing: 'Position Sizing',
  trade_management: 'Trade Management',
  exit_discipline: 'Exit Discipline',
  review_reflection: 'Review & Reflection',
}

function toLabel(key: string): string {
  return COMPETENCY_LABELS[key] || key.replace(/_/g, ' ')
}

export function ReviewSessionHeader({
  dueCount,
  estimatedMinutes,
  weakCompetencies,
  onStart,
  isLoading = false,
  disabled = false,
  className,
}: ReviewSessionHeaderProps) {
  const canStart = !disabled && dueCount > 0 && !isLoading

  return (
    <section className={cn('glass-card-heavy rounded-xl border border-white/10 p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-300">Review Queue</p>
          <h1 className="mt-1 text-lg font-semibold text-white">Spaced Repetition Session</h1>
          <p className="mt-1 text-sm text-white/65">
            Reinforce core execution rules with short retrieval drills.
          </p>
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
            canStart
              ? 'border-emerald-500/45 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
              : 'cursor-not-allowed border-white/15 bg-white/[0.03] text-white/40'
          )}
        >
          <PlayCircle className="h-4 w-4" />
          {isLoading ? 'Loading...' : dueCount > 0 ? 'Start Review' : 'No Items Due'}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-white/50">Due Now</p>
          <p className="mt-1 text-xl font-semibold text-white tabular-nums">{dueCount}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-white/50">Estimated Time</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xl font-semibold text-white tabular-nums">
            <Clock3 className="h-4 w-4 text-emerald-300" />
            {estimatedMinutes}m
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-white/50">Weak Competencies</p>
          {weakCompetencies.length > 0 ? (
            <div className="mt-1 space-y-1">
              {weakCompetencies.slice(0, 2).map((competency) => (
                <p key={competency} className="text-xs text-white/75 truncate">
                  {toLabel(competency)}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/65">
              <Brain className="h-3.5 w-3.5 text-emerald-300" />
              Building baseline
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
