'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { AcademyPanel, AcademyV3Shell } from '@/components/academy-v3/academy-v3-shell'
import { fetchMastery, fetchRecommendations } from '@/lib/academy-v3/client'
import { Analytics } from '@/lib/analytics'

type MasteryData = Awaited<ReturnType<typeof fetchMastery>>
type RecommendationData = Awaited<ReturnType<typeof fetchRecommendations>>

export function ProgressOverview() {
  const [mastery, setMastery] = useState<MasteryData | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([fetchMastery(), fetchRecommendations()])
      .then(([masteryData, recommendationData]) => {
        if (!active) return
        setMastery(masteryData)
        setRecommendations(recommendationData)
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
    <AcademyV3Shell
      title="Progress"
      description="Track competency growth over time and clear remediation priorities early."
    >
      {loading ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-zinc-300">Loading progress...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <AcademyPanel title="Mastery Health">
            <p className="text-2xl font-semibold text-white">{(mastery?.items.length || 0) - remediationCount}/{mastery?.items.length || 0}</p>
            <p className="mt-2 text-sm text-zinc-400">competencies not flagged for remediation</p>
          </AcademyPanel>

          <AcademyPanel title="Needs Remediation">
            <p className="text-2xl font-semibold text-amber-300">{remediationCount}</p>
            <p className="mt-2 text-sm text-zinc-400">competencies currently under threshold</p>
          </AcademyPanel>

          <AcademyPanel title="Suggested Next Step">
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
              <p className="text-sm text-zinc-400">Complete assessments to generate recommendations.</p>
            )}
          </AcademyPanel>
        </div>
      )}

      <AcademyPanel title="Competency Breakdown">
        {!mastery?.items.length ? (
          <p className="text-sm text-zinc-400">No mastery records yet.</p>
        ) : (
          <ul className="space-y-2">
            {mastery.items.map((item) => (
              <li key={item.competencyId} className="rounded-md border border-white/10 p-3">
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
              </li>
            ))}
          </ul>
        )}
      </AcademyPanel>
    </AcademyV3Shell>
  )
}
