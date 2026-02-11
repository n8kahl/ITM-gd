'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Star } from 'lucide-react'
import type { AITradeAnalysis } from '@/lib/types/journal'

interface AIGradeDisplayProps {
  analysis: AITradeAnalysis
}

const GRADE_COLORS = {
  A: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  B: 'text-[#F3E5AB] border-[#F3E5AB]/40 bg-[#F3E5AB]/10',
  C: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  D: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
  F: 'text-red-400 border-red-500/40 bg-red-500/10',
}

export function AIGradeDisplay({ analysis }: AIGradeDisplayProps) {
  const [expanded, setExpanded] = useState(false)

  const gradeColor = GRADE_COLORS[analysis.grade]

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg border ${gradeColor}`}
          >
            <span className="text-xl font-bold">{analysis.grade}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-300" />
              <p className="text-sm font-medium text-ivory">AI Trade Grade</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Analyzed on {new Date(analysis.scored_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="rounded-md border border-white/10 p-2 text-muted-foreground hover:bg-white/5 hover:text-ivory"
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-white/10 pt-3">
          <div>
            <p className="mb-1 text-xs font-medium text-emerald-400">Entry Quality</p>
            <p className="text-sm text-ivory/90">{analysis.entry_quality}</p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-emerald-400">Exit Quality</p>
            <p className="text-sm text-ivory/90">{analysis.exit_quality}</p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-emerald-400">Risk Management</p>
            <p className="text-sm text-ivory/90">{analysis.risk_management}</p>
          </div>

          {analysis.lessons.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-emerald-400">Key Lessons</p>
              <ul className="space-y-1">
                {analysis.lessons.map((lesson, index) => (
                  <li key={index} className="flex gap-2 text-sm text-ivory/90">
                    <span className="text-emerald-400">•</span>
                    <span>{lesson}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
