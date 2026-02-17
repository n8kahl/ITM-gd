'use client'

import Link from 'next/link'
import { BookOpen, CheckCircle2, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AcademyCard, AcademyShell } from '@/components/academy/academy-shell'
import {
  fetchAcademyPlan,
  fetchAcademyProgressSummary,
  fetchAcademyResume,
  fetchRecommendations,
} from '@/lib/academy-v3/client'
import { Analytics } from '@/lib/analytics'

type PlanData = Awaited<ReturnType<typeof fetchAcademyPlan>>
type ProgressSummary = Awaited<ReturnType<typeof fetchAcademyProgressSummary>>
type ResumeData = Awaited<ReturnType<typeof fetchAcademyResume>>
type RecommendationData = Awaited<ReturnType<typeof fetchRecommendations>>

function ProgressRing({ progressPercent }: { progressPercent: number }) {
  const clamped = Math.max(0, Math.min(100, progressPercent))
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const dashoffset = circumference - (clamped / 100) * circumference

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-label={`Overall progress ${clamped}%`}>
      <circle cx="36" cy="36" r={radius} stroke="rgba(255,255,255,0.12)" strokeWidth="6" fill="none" />
      <circle
        cx="36"
        cy="36"
        r={radius}
        stroke="rgb(52 211 153)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" className="fill-white text-[12px] font-semibold">
        {clamped}%
      </text>
    </svg>
  )
}

export function AcademyDashboard() {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [resume, setResume] = useState<ResumeData | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([
      fetchAcademyPlan(),
      fetchAcademyProgressSummary(),
      fetchAcademyResume(),
      fetchRecommendations(),
    ])
      .then(([planData, progressSummary, resumeTarget, recommendationData]) => {
        if (!active) return
        setPlan(planData)
        setSummary(progressSummary)
        setResume(resumeTarget)
        setRecommendations(recommendationData)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load academy dashboard')
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

  const lessonCount = useMemo(() => summary?.totalLessons || 0, [summary])
  const progressPercent = summary?.progressPercent || 0
  const topRecommendations = recommendations?.items.slice(0, 3) || []

  return (
    <AcademyShell
      title="Your Learning Plan"
      description="See where you are, resume quickly, and focus on the highest-impact next step."
      maxWidthClassName="max-w-4xl"
    >
      {loading ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-zinc-300">Loading your plan...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div>
      ) : (
        <div className="space-y-4">
          <AcademyCard className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.08em] text-emerald-300">Program</p>
                <h2 className="text-xl font-semibold text-white">{plan?.program.title || 'Academy Program'}</h2>
                <p className="text-sm text-zinc-400">
                  {moduleCount} modules · {lessonCount} lessons
                </p>
              </div>
              <ProgressRing progressPercent={progressPercent} />
            </div>
          </AcademyCard>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AcademyCard title="Continue Learning">
              {resume ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-white">{resume.lessonTitle}</p>
                  <p className="text-xs text-zinc-400">
                    Lesson {resume.lessonNumber} of {resume.totalLessons} · {resume.courseProgressPercent}% complete
                  </p>
                  <Link
                    href={resume.resumeUrl}
                    onClick={() => Analytics.trackAcademyAction('resume_lesson')}
                    className="inline-flex rounded-md border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/20"
                  >
                    Resume lesson
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">Start your first module to generate a resume target.</p>
              )}
            </AcademyCard>

            <AcademyCard title="Recommended Next">
              {topRecommendations.length ? (
                <ul className="space-y-3">
                  {topRecommendations.map((item, index) => (
                    <li key={`${item.type}-${index}`} className="rounded-md border border-white/10 p-3">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-xs text-zinc-400">{item.reason}</p>
                      <Link
                        href={item.actionTarget}
                        onClick={() => Analytics.trackAcademyAction('recommendation_action')}
                        className="mt-2 inline-flex text-xs text-emerald-300 hover:text-emerald-200"
                      >
                        {item.actionLabel}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-400">Recommendations appear after initial lesson activity.</p>
              )}
            </AcademyCard>
          </div>

          <AcademyCard title="Quick Actions">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Link
                href="/members/academy/modules"
                onClick={() => Analytics.trackAcademyAction('browse_modules')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-emerald-500/35 hover:text-white"
              >
                <BookOpen className="h-4 w-4" />
                Browse Modules
              </Link>
              <Link
                href="/members/academy/review"
                onClick={() => Analytics.trackAcademyAction('open_review_queue')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-emerald-500/35 hover:text-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                Review Queue
              </Link>
              <Link
                href="/members/academy/progress"
                onClick={() => Analytics.trackAcademyAction('view_progress')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-emerald-500/35 hover:text-white"
              >
                <TrendingUp className="h-4 w-4" />
                View Progress
              </Link>
            </div>
          </AcademyCard>
        </div>
      )}
    </AcademyShell>
  )
}
