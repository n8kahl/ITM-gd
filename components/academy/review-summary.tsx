'use client'

import Link from 'next/link'
import { CheckCircle2, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReviewSummaryProps {
  reviewedCount: number
  correctCount: number
  improvedCompetencies: string[]
  nextReviewAt: string | null
  onRestart?: () => void
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

function toLabel(value: string): string {
  return COMPETENCY_LABELS[value] || value.replace(/_/g, ' ')
}

export function ReviewSummary({
  reviewedCount,
  correctCount,
  improvedCompetencies,
  nextReviewAt,
  onRestart,
  className,
}: ReviewSummaryProps) {
  const accuracy = reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 0
  const nextReviewLabel = (() => {
    if (!nextReviewAt) return 'Scheduled automatically based on recall quality.'
    const date = new Date(nextReviewAt)
    if (Number.isNaN(date.getTime())) return 'Scheduled automatically based on recall quality.'
    return date.toLocaleString()
  })()

  return (
    <section className={cn('glass-card-heavy rounded-xl border border-emerald-500/25 p-5', className)}>
      <div className="flex items-center gap-2 text-emerald-300">
        <CheckCircle2 className="h-4 w-4" />
        <p className="text-[11px] uppercase tracking-[0.12em]">Session Complete</p>
      </div>

      <h2 className="mt-2 text-lg font-semibold text-white">Review Summary</h2>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-white/50">Items Reviewed</p>
          <p className="mt-1 text-xl font-semibold text-white tabular-nums">{reviewedCount}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-white/50">Accuracy</p>
          <p className="mt-1 text-xl font-semibold text-emerald-200 tabular-nums">{accuracy}%</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-white/50">Correct</p>
          <p className="mt-1 text-xl font-semibold text-white tabular-nums">{correctCount}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <p className="text-[11px] uppercase tracking-[0.1em] text-white/50">Competencies Improved</p>
        {improvedCompetencies.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {improvedCompetencies.slice(0, 4).map((competency) => (
              <span
                key={competency}
                className="inline-flex items-center rounded-md border border-emerald-500/35 bg-emerald-500/12 px-2 py-1 text-xs text-emerald-100"
              >
                <Sparkles className="mr-1 h-3 w-3" />
                {toLabel(competency)}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-white/70">
            Keep practicing to build stronger retention signals.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <p className="text-[11px] uppercase tracking-[0.1em] text-white/50">Next Scheduled Review</p>
        <p className="mt-1 text-sm text-white/75">{nextReviewLabel}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onRestart && (
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/45 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Start Another Review
          </button>
        )}
        <Link
          href="/members/academy/courses"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/[0.06]"
        >
          Back to Explore
        </Link>
      </div>
    </section>
  )
}
