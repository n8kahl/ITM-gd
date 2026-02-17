'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { AcademyPanel, AcademyV3Shell } from '@/components/academy-v3/academy-v3-shell'
import {
  fetchAcademyPlan,
  fetchMastery,
  fetchRecommendations,
} from '@/lib/academy-v3/client'
import { Analytics } from '@/lib/analytics'

type PlanData = Awaited<ReturnType<typeof fetchAcademyPlan>>
type MasteryData = Awaited<ReturnType<typeof fetchMastery>>
type RecommendationData = Awaited<ReturnType<typeof fetchRecommendations>>

export function PlanDashboard() {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [mastery, setMastery] = useState<MasteryData | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([fetchAcademyPlan(), fetchMastery(), fetchRecommendations()])
      .then(([planData, masteryData, recommendationData]) => {
        if (!active) return
        setPlan(planData)
        setMastery(masteryData)
        setRecommendations(recommendationData)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load academy plan')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const moduleCount = useMemo(() => {
    if (!plan) return 0
    return plan.tracks.reduce((sum, track) => sum + track.modules.length, 0)
  }, [plan])

  const lessonCount = useMemo(() => {
    if (!plan) return 0
    return plan.tracks.reduce(
      (sum, track) => sum + track.modules.reduce((inner, moduleItem) => inner + moduleItem.lessons.length, 0),
      0
    )
  }, [plan])

  return (
    <AcademyV3Shell
      title="My Learning Plan"
      description="Follow your highest-impact next action. Progress is competency-based, with review and remediation built into every step."
    >
      {loading ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-zinc-300">Loading your plan...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <AcademyPanel title="Program Snapshot">
            <p className="text-base font-medium text-white">{plan?.program.title}</p>
            <p className="mt-2 text-sm text-zinc-300">{moduleCount} modules, {lessonCount} lessons</p>
            <p className="mt-2 text-xs text-zinc-400">Program code: {plan?.program.code}</p>
          </AcademyPanel>

          <AcademyPanel title="Next Best Actions">
            {recommendations?.items.length ? (
              <ul className="space-y-3">
                {recommendations.items.slice(0, 3).map((item, index) => (
                  <li key={`${item.type}-${index}`} className="rounded-md border border-white/10 p-3">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-400">{item.reason}</p>
                    <Link
                      className="mt-2 inline-flex text-xs text-emerald-300 hover:text-emerald-200"
                      href={item.actionTarget}
                      onClick={() => Analytics.trackAcademyAction('recommendation_action')}
                    >
                      {item.actionLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-400">No recommendations yet. Start a module to generate adaptive guidance.</p>
            )}
          </AcademyPanel>

          <AcademyPanel title="Mastery Focus">
            {mastery?.items.length ? (
              <ul className="space-y-2">
                {mastery.items.slice(0, 4).map((item) => (
                  <li key={item.competencyId} className="flex items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-2">
                    <span className="text-sm text-zinc-200">{item.competencyTitle}</span>
                    <span className={`text-xs ${item.needsRemediation ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {item.currentScore.toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-400">Mastery data will appear after your first assessment.</p>
            )}
          </AcademyPanel>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Link
          className="glass-card-heavy rounded-lg border border-white/10 px-4 py-3 text-sm text-zinc-200 hover:border-emerald-500/30 hover:text-white"
          href="/members/academy-v3/modules"
          onClick={() => Analytics.trackAcademyAction('browse_modules')}
        >
          Browse Modules
        </Link>
        <Link
          className="glass-card-heavy rounded-lg border border-white/10 px-4 py-3 text-sm text-zinc-200 hover:border-emerald-500/30 hover:text-white"
          href="/members/academy-v3/review"
          onClick={() => Analytics.trackAcademyAction('open_review_queue')}
        >
          Open Review Queue
        </Link>
        <Link
          className="glass-card-heavy rounded-lg border border-white/10 px-4 py-3 text-sm text-zinc-200 hover:border-emerald-500/30 hover:text-white"
          href="/members/academy-v3/progress"
          onClick={() => Analytics.trackAcademyAction('view_progress')}
        >
          View Progress
        </Link>
      </div>
    </AcademyV3Shell>
  )
}
