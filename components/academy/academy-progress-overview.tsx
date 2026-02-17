'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { AcademyCard, AcademyShell } from '@/components/academy/academy-shell'
import { fetchAcademyProgressSummary, fetchMastery, fetchRecommendations } from '@/lib/academy-v3/client'
import { Analytics } from '@/lib/analytics'

type MasteryData = Awaited<ReturnType<typeof fetchMastery>>
type RecommendationData = Awaited<ReturnType<typeof fetchRecommendations>>
type ProgressSummary = Awaited<ReturnType<typeof fetchAcademyProgressSummary>>

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

  const remediationCount = mastery?.items.filter((item) => item.needsRemediation).length || 0

  return (
    <AcademyShell
      title="Progress"
      description="Track overall momentum, competency depth, and track-level completion."
      maxWidthClassName="max-w-4xl"
    >
      {loading ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-zinc-300">Loading progress...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <AcademyCard title="Completed Lessons">
              <p className="text-2xl font-semibold text-white">
                {summary?.completedLessons || 0}/{summary?.totalLessons || 0}
              </p>
              <p className="mt-2 text-sm text-zinc-400">Total lessons completed</p>
            </AcademyCard>

            <AcademyCard title="Needs Remediation">
              <p className="text-2xl font-semibold text-amber-300">{remediationCount}</p>
              <p className="mt-2 text-sm text-zinc-400">Competencies under threshold</p>
            </AcademyCard>

            <AcademyCard title="Suggested Next Step">
              {recommendations?.items[0] ? (
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
              ) : (
                <p className="text-sm text-zinc-400">Complete lessons to generate recommendations.</p>
              )}
            </AcademyCard>
          </div>

          <AcademyCard title="Track Progress">
            {!summary?.tracks.length ? (
              <p className="text-sm text-zinc-400">Track progress appears after modules are loaded.</p>
            ) : (
              <div className="space-y-2">
                {summary.tracks.map((track) => (
                  <div key={track.trackId} className="rounded-md border border-white/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-white">{track.trackTitle}</p>
                      <p className="text-xs text-zinc-400">
                        {track.completedLessons}/{track.totalLessons}
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-emerald-400" style={{ width: `${track.progressPercent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AcademyCard>

          <AcademyCard title="Competency Breakdown">
            {!mastery?.items.length ? (
              <p className="text-sm text-zinc-400">No competency records yet.</p>
            ) : (
              <div className="space-y-2">
                {mastery.items.map((item) => (
                  <div key={item.competencyId} className="rounded-md border border-white/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-white">{item.competencyTitle}</p>
                      <p className={`text-xs ${item.needsRemediation ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {item.currentScore.toFixed(0)}%
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full ${item.needsRemediation ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.max(2, Math.min(100, item.currentScore))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AcademyCard>
        </div>
      )}
    </AcademyShell>
  )
}
