'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { AcademyCard, AcademyShell } from '@/components/academy/academy-shell'
import { AcademyCompetencyRadar } from '@/components/academy/progress/academy-competency-radar'
import { AcademyLearningTimeline } from '@/components/academy/progress/academy-learning-timeline'
import { AcademyPerformanceSummary } from '@/components/academy/progress/academy-performance-summary'
import { AcademyTrackProgressCard } from '@/components/academy/progress/academy-track-progress-card'
import { fetchAcademyProgressSummary, fetchMastery, fetchRecommendations } from '@/lib/academy-v3/client'
import { Analytics } from '@/lib/analytics'

type MasteryData = Awaited<ReturnType<typeof fetchMastery>>
type RecommendationData = Awaited<ReturnType<typeof fetchRecommendations>>
type ProgressSummary = Awaited<ReturnType<typeof fetchAcademyProgressSummary>>

// ---------------------------------------------------------------------------
// Derive competency radar data from mastery items
// ---------------------------------------------------------------------------
function buildCompetencyRadarData(mastery: MasteryData | null) {
  if (!mastery?.items.length) return []
  return mastery.items.map((item) => ({
    key: item.competencyKey,
    title: item.competencyTitle,
    score: item.currentScore,
    domain: item.needsRemediation ? 'Needs Remediation' : 'On Track',
  }))
}

// ---------------------------------------------------------------------------
// Derive performance stats from summary + mastery
// Streak and XP are placeholders until dedicated API endpoints exist.
// ---------------------------------------------------------------------------
function buildPerformanceStats(summary: ProgressSummary | null, mastery: MasteryData | null) {
  const avgScore =
    mastery?.items.length
      ? mastery.items.reduce((acc, item) => acc + item.currentScore, 0) / mastery.items.length
      : 0

  return {
    totalLessonsCompleted: summary?.completedLessons ?? 0,
    totalLessonsAvailable: summary?.totalLessons ?? 0,
    averageScore: Math.round(avgScore),
    currentStreak: 0, // populated when streak endpoint is available
    totalXp: 0, // populated when XP endpoint is available
    currentLevel: 1, // populated when XP endpoint is available
    timeSpentMinutes: 0, // populated when time-tracking endpoint is available
  }
}

// ---------------------------------------------------------------------------
// Derive track progress cards from summary modules data
// ---------------------------------------------------------------------------
function buildTrackProgressCards(summary: ProgressSummary | null) {
  if (!summary?.tracks.length) return []

  return summary.tracks.map((track) => {
    const trackModules = summary.modules
      .filter((mod) => mod.trackId === track.trackId)
      .map((mod) => ({
        title: mod.moduleTitle,
        slug: mod.moduleSlug,
        lessonsTotal: mod.totalLessons,
        lessonsCompleted: mod.completedLessons,
        estimatedMinutes: 0, // populated when module detail endpoint provides this
      }))

    return {
      track: {
        title: track.trackTitle,
        code: track.trackId.slice(0, 8).toUpperCase(),
        modules: trackModules,
      },
      totalTimeSpent: 0,
    }
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AcademyProgressOverview() {
  const [mastery, setMastery] = useState<MasteryData | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationData | null>(null)
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([fetchMastery(), fetchRecommendations(), fetchAcademyProgressSummary()])
      .then(([masteryData, recommendationData, progressSummary]) => {
        if (!active) return
        setMastery(masteryData)
        setRecommendations(recommendationData)
        setSummary(progressSummary)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load progress data')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <AcademyShell
        title="Progress"
        description="Track overall momentum, competency depth, and track-level completion."
        maxWidthClassName="max-w-6xl"
      >
        <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-zinc-300">
          Loading progress...
        </div>
      </AcademyShell>
    )
  }

  if (error) {
    return (
      <AcademyShell
        title="Progress"
        description="Track overall momentum, competency depth, and track-level completion."
        maxWidthClassName="max-w-6xl"
      >
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div>
      </AcademyShell>
    )
  }

  const competencyData = buildCompetencyRadarData(mastery)
  const performanceStats = buildPerformanceStats(summary, mastery)
  const trackCards = buildTrackProgressCards(summary)

  // Placeholder timeline events — populated when learning-events endpoint is available
  const timelineEvents: Array<{
    id: string
    type: string
    title: string
    description: string
    timestamp: string
    metadata?: Record<string, unknown>
  }> = []

  return (
    <AcademyShell
      title="Progress"
      description="Track overall momentum, competency depth, and track-level completion."
      maxWidthClassName="max-w-6xl"
    >
      <div className="space-y-4">
        {/* Row 1: Performance summary (full width) */}
        <AcademyPerformanceSummary stats={performanceStats} />

        {/* Row 2: Suggested next step */}
        {recommendations?.items[0] ? (
          <AcademyCard title="Suggested Next Step">
            <div>
              <p className="text-sm font-medium text-white">{recommendations.items[0].title}</p>
              <p className="mt-1 text-xs text-zinc-400">{recommendations.items[0].reason}</p>
              <Link
                className="mt-2 inline-flex text-xs text-emerald-300 hover:text-emerald-200"
                href={recommendations.items[0].actionTarget}
                onClick={() => Analytics.trackAcademyAction('progress_recommendation_action')}
              >
                {recommendations.items[0].actionLabel}
              </Link>
            </div>
          </AcademyCard>
        ) : null}

        {/* Row 3: Two-column — competency radar (left) + learning timeline (right) */}
        <div className="grid gap-4 lg:grid-cols-2">
          <AcademyCompetencyRadar competencies={competencyData} />
          <AcademyLearningTimeline events={timelineEvents} />
        </div>

        {/* Row 4: Track progress cards grid */}
        {trackCards.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-400">Track Progress</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {trackCards.map((cardProps, idx) => (
                <AcademyTrackProgressCard key={idx} {...cardProps} />
              ))}
            </div>
          </div>
        ) : (
          <AcademyCard title="Track Progress">
            <p className="text-sm text-zinc-400">Track progress appears after modules are loaded.</p>
          </AcademyCard>
        )}
      </div>
    </AcademyShell>
  )
}
