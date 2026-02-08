'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InsightData {
  summary?: string
  patterns?: string[]
  suggestion?: string
}

export function AIInsights() {
  const [insights, setInsights] = useState<InsightData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchInsights() {
      try {
        // Try fetching latest AI analysis from journal entries
        const res = await fetch('/api/members/journal?limit=1&sort=created_at&order=desc&has_ai=true')
        const data = await res.json()
        const entries = data.success ? data.data : Array.isArray(data) ? data : []

        if (entries.length > 0 && entries[0].ai_analysis) {
          const analysis = typeof entries[0].ai_analysis === 'string'
            ? JSON.parse(entries[0].ai_analysis)
            : entries[0].ai_analysis

          setInsights({
            summary: analysis.summary || analysis.feedback || null,
            patterns: analysis.patterns || [],
            suggestion: analysis.suggestion || analysis.recommendation || null,
          })
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchInsights()
  }, [])

  return (
    <div className="glass-card-heavy rounded-2xl p-4 lg:p-6 border-champagne/[0.08] h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-4 h-4 text-champagne" />
        <h3 className="text-sm font-medium text-ivory">AI Coach Insights</h3>
      </div>

      {loading ? (
        <div className="space-y-2 flex-1">
          <div className="h-3 w-full rounded bg-white/[0.03] animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-white/[0.03] animate-pulse" />
          <div className="h-3 w-3/5 rounded bg-white/[0.03] animate-pulse" />
        </div>
      ) : insights?.summary ? (
        <div className="flex-1 flex flex-col">
          {/* Summary */}
          <p className="text-sm text-ivory/80 leading-relaxed mb-3 line-clamp-3">
            {insights.summary}
          </p>

          {/* Pattern Tags */}
          {insights.patterns && insights.patterns.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {insights.patterns.slice(0, 3).map((pattern, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-champagne/10 text-champagne border border-champagne/20"
                >
                  {pattern}
                </span>
              ))}
            </div>
          )}

          {/* Suggestion */}
          {insights.suggestion && (
            <p className="text-xs text-muted-foreground italic mb-4 line-clamp-2">
              {insights.suggestion}
            </p>
          )}

          {/* CTA */}
          <Link
            href="/members/ai-coach"
            className="mt-auto inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Discuss with Coach
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-3">
            <Bot className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">No insights yet</p>
          <p className="text-xs text-muted-foreground/60 mb-4">
            Start logging trades to unlock AI analysis
          </p>
          <Link
            href="/members/journal?new=1"
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Log Your First Trade
          </Link>
        </div>
      )}
    </div>
  )
}
