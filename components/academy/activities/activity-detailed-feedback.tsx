'use client'

import { Check, X, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeedbackDetailItem {
  field: string
  correct: boolean
  expected?: string | number
  actual?: string | number
  hint?: string
  partialCredit?: number
}

export interface ActivityFeedbackResult {
  score: number
  maxScore: number
  feedback: string
  isCorrect: boolean
  details?: FeedbackDetailItem[]
}

interface ActivityDetailedFeedbackProps {
  result: ActivityFeedbackResult
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityDetailedFeedback({ result }: ActivityDetailedFeedbackProps) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = result.details && result.details.length > 0

  const scorePercent = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0
  const isPartial = !result.isCorrect && result.score > 0

  return (
    <div
      className={`rounded-lg border ${
        result.isCorrect
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : isPartial
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-rose-500/10 border-rose-500/30'
      }`}
    >
      {/* Summary Row */}
      <div className="flex items-start gap-3 p-4">
        {result.isCorrect ? (
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" strokeWidth={1.5} />
        ) : isPartial ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" strokeWidth={1.5} />
        ) : (
          <X className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" strokeWidth={1.5} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-sm font-medium ${
                result.isCorrect ? 'text-emerald-300' : isPartial ? 'text-amber-300' : 'text-rose-300'
              }`}
            >
              {result.score}/{result.maxScore} correct
              {scorePercent > 0 && !result.isCorrect && (
                <span className="ml-1.5 text-xs opacity-70">({scorePercent}%)</span>
              )}
            </p>
            {hasDetails && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                {expanded ? 'Hide' : 'Show'} details
                {expanded ? (
                  <ChevronUp className="h-3 w-3" strokeWidth={1.5} />
                ) : (
                  <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
                )}
              </button>
            )}
          </div>
          <p
            className={`text-sm mt-1 ${
              result.isCorrect ? 'text-emerald-300/80' : isPartial ? 'text-amber-300/80' : 'text-rose-300/80'
            }`}
          >
            {result.feedback}
          </p>
        </div>
      </div>

      {/* Detail Breakdown */}
      {hasDetails && expanded && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-2">
          {result.details!.map((detail, i) => (
            <div
              key={`${detail.field}-${i}`}
              className={`flex items-start gap-2.5 rounded-md px-3 py-2 text-xs ${
                detail.correct
                  ? 'bg-emerald-500/5 text-emerald-300/80'
                  : 'bg-rose-500/5 text-rose-300/80'
              }`}
            >
              {detail.correct ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
              ) : (
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
              )}
              <div className="min-w-0">
                <span className="font-medium font-mono">{detail.field}</span>
                {detail.expected !== undefined && (
                  <span className="ml-2 text-white/30">
                    {detail.correct ? (
                      <>&rarr; {detail.actual}</>
                    ) : (
                      <>
                        yours: <span className="text-rose-400">{detail.actual}</span>
                      </>
                    )}
                  </span>
                )}
                {detail.partialCredit !== undefined && detail.partialCredit > 0 && (
                  <span className="ml-2 text-amber-400/70">
                    (+{Math.round(detail.partialCredit * 100)}% partial credit)
                  </span>
                )}
                {detail.hint && !detail.correct && (
                  <p className="mt-1 text-white/40 leading-relaxed">{detail.hint}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
