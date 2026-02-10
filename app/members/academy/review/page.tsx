'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Brain, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReviewSession, type ReviewQueueItem, type ReviewSessionSummary } from '@/components/academy/review-session'
import { ReviewSessionHeader } from '@/components/academy/review-session-header'
import { ReviewSummary } from '@/components/academy/review-summary'

interface ReviewResponse {
  success: boolean
  data?: {
    items: ReviewQueueItem[]
    stats: {
      total_due: number
      estimated_minutes: number
      weak_competencies: string[]
    }
  }
}

export default function AcademyReviewPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ReviewQueueItem[]>([])
  const [stats, setStats] = useState({
    total_due: 0,
    estimated_minutes: 0,
    weak_competencies: [] as string[],
  })
  const [sessionMode, setSessionMode] = useState<'idle' | 'active' | 'complete'>('idle')
  const [summary, setSummary] = useState<ReviewSessionSummary | null>(null)

  const loadQueue = async (refresh = false) => {
    if (refresh) setIsRefreshing(true)
    if (!refresh) setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/academy/review?limit=30')
      if (!response.ok) {
        throw new Error('Failed to load review queue')
      }
      const payload = (await response.json()) as ReviewResponse
      if (!payload.success || !payload.data) {
        throw new Error('Invalid review queue payload')
      }
      setItems(payload.data.items || [])
      setStats(payload.data.stats || { total_due: 0, estimated_minutes: 0, weak_competencies: [] })
      if ((payload.data.items || []).length === 0) {
        setSessionMode('idle')
        setSummary(null)
      }
    } catch (queueError) {
      setError(queueError instanceof Error ? queueError.message : 'Unable to load review queue')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadQueue()
  }, [])

  const dueCount = useMemo(() => stats.total_due || items.length, [items.length, stats.total_due])

  const handleSessionComplete = (nextSummary: ReviewSessionSummary) => {
    setSummary(nextSummary)
    setSessionMode('complete')
  }

  return (
    <div className="space-y-5">
      <ReviewSessionHeader
        dueCount={dueCount}
        estimatedMinutes={stats.estimated_minutes}
        weakCompetencies={stats.weak_competencies}
        onStart={() => setSessionMode('active')}
        isLoading={isLoading}
      />

      {error && (
        <div className="glass-card-heavy rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-100">{error}</p>
          <button
            type="button"
            onClick={() => loadQueue(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs font-medium text-red-100 hover:bg-red-400/20"
          >
            Retry
          </button>
        </div>
      )}

      {!error && !isLoading && items.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-6">
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
            <Brain className="w-3.5 h-3.5" />
            Retrieval + Spacing
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">No items are due yet</h2>
          <p className="mt-2 text-sm text-white/60 max-w-2xl">
            Finish lessons with quizzes to seed your review queue. Your first recall set appears
            automatically when it becomes due.
          </p>
          <Link
            href="/members/academy/courses"
            className="inline-flex items-center gap-2 mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
          >
            Continue in Explore
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {!error && !isLoading && items.length > 0 && sessionMode === 'active' && (
        <ReviewSession items={items} onComplete={handleSessionComplete} />
      )}

      {!error && !isLoading && items.length > 0 && sessionMode === 'complete' && summary && (
        <ReviewSummary
          reviewedCount={summary.reviewedCount}
          correctCount={summary.correctCount}
          improvedCompetencies={summary.improvedCompetencies}
          nextReviewAt={summary.nextReviewAt}
          onRestart={() => {
            setSummary(null)
            setSessionMode('idle')
            loadQueue(true)
          }}
        />
      )}

      {!error && !isLoading && items.length > 0 && sessionMode === 'idle' && (
        <div className={cn('rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-6')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Queue Ready</h2>
              <p className="mt-1 text-sm text-white/60">
                {dueCount} item{dueCount === 1 ? '' : 's'} due right now.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadQueue(true)}
              disabled={isRefreshing}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                isRefreshing
                  ? 'cursor-not-allowed border-white/15 bg-white/[0.03] text-white/45'
                  : 'border-white/20 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]'
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {isRefreshing ? 'Refreshing...' : 'Refresh Queue'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
