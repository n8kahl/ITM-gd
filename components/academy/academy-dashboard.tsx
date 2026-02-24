'use client'

import Link from 'next/link'
import { BookOpen, CheckCircle2, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AcademyCard, AcademyShell } from '@/components/academy/academy-shell'
import { AcademyStreakBanner } from '@/components/academy/dashboard/academy-streak-banner'
import { AcademyXpLevelCard } from '@/components/academy/dashboard/academy-xp-level-card'
import { AcademyContinueLearningHero } from '@/components/academy/dashboard/academy-continue-learning-hero'
import { AcademyWeeklySummary } from '@/components/academy/dashboard/academy-weekly-summary'
import { AcademyAchievementShowcase } from '@/components/academy/dashboard/academy-achievement-showcase'
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

// ---------------------------------------------------------------------------
// Gamification placeholder types
// TODO: Replace with real fetch from /api/academy/gamification/user/{userId}/stats
// once userId is accessible in this client component (e.g. via session context).
// ---------------------------------------------------------------------------
interface GamificationStats {
  currentStreak: number
  longestStreak: number
  streakFreezeAvailable: boolean
  totalXp: number
  currentLevel: number
  recentXpEvents: Array<{ source: string; amount: number; timestamp: string }>
  daysActive: boolean[]
  lessonsThisWeek: number
  lessonsLastWeek: number
  timeSpentMinutes: number
  unlockedAchievements: Array<{
    key: string
    title: string
    description: string
    iconUrl: string
    unlockedAt: string
  }>
  totalAchievements: number
}

const GAMIFICATION_PLACEHOLDER: GamificationStats = {
  currentStreak: 0,
  longestStreak: 0,
  streakFreezeAvailable: false,
  totalXp: 0,
  currentLevel: 1,
  recentXpEvents: [],
  daysActive: [false, false, false, false, false, false, false],
  lessonsThisWeek: 0,
  lessonsLastWeek: 0,
  timeSpentMinutes: 0,
  unlockedAchievements: [],
  totalAchievements: 20,
}

function withResumeQuery(url: string): string {
  return url.includes('?') ? `${url}&resume=1` : `${url}?resume=1`
}

export function AcademyDashboard() {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [resume, setResume] = useState<ResumeData | null>(null)
  const [gamification] = useState<GamificationStats>(GAMIFICATION_PLACEHOLDER)
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
      .then(([planData, progressSummary, resumeTarget]) => {
        if (!active) return
        setPlan(planData)
        setSummary(progressSummary)
        setResume(resumeTarget)
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

  return (
    <AcademyShell
      title="Your Learning Plan"
      description="See where you are, resume quickly, and focus on the highest-impact next step."
      maxWidthClassName="max-w-5xl"
    >
      {loading ? (
        <div
          className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-zinc-300"
          data-testid="academy-dashboard-loading"
        >
          Loading your plan...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">
          {error}
        </div>
      ) : (
        <div className="space-y-4" data-testid="academy-dashboard">
          {/* Program stats summary bar */}
          <AcademyCard className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-[0.08em] text-emerald-300">Program</p>
                <h2 className="font-serif text-lg font-semibold text-white">
                  {plan?.program.title || 'Academy Program'}
                </h2>
                <p className="font-mono text-xs text-zinc-400">
                  {moduleCount} modules · {lessonCount} lessons
                </p>
              </div>
              {summary && summary.progressPercent > 0 && (
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-32 overflow-hidden rounded-full bg-white/10"
                    role="progressbar"
                    aria-valuenow={summary.progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Overall progress ${summary.progressPercent}%`}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                      style={{ width: `${summary.progressPercent}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-zinc-400">{summary.progressPercent}%</span>
                </div>
              )}
            </div>
          </AcademyCard>

          {/* Continue Learning hero — full width */}
          <AcademyContinueLearningHero
            lessonTitle={resume?.lessonTitle}
            moduleName={resume?.courseProgressPercent !== undefined ? `${resume.courseProgressPercent}% through module` : undefined}
            resumeUrl={resume ? withResumeQuery(resume.resumeUrl) : undefined}
            progressPercent={resume?.courseProgressPercent}
            lessonNumber={resume?.lessonNumber}
            totalLessons={resume?.totalLessons}
          />

          {/* Two-column grid: left (streak + XP), right (weekly + achievements) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Left column */}
            <div className="flex flex-col gap-4">
              <AcademyStreakBanner
                currentStreak={gamification.currentStreak}
                longestStreak={gamification.longestStreak}
                streakFreezeAvailable={gamification.streakFreezeAvailable}
              />
              <AcademyXpLevelCard
                totalXp={gamification.totalXp}
                currentLevel={gamification.currentLevel}
                recentXpEvents={gamification.recentXpEvents}
              />
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4">
              <AcademyWeeklySummary
                daysActive={gamification.daysActive}
                lessonsThisWeek={gamification.lessonsThisWeek}
                lessonsLastWeek={gamification.lessonsLastWeek}
                timeSpentMinutes={gamification.timeSpentMinutes}
              />
              <AcademyAchievementShowcase
                unlockedAchievements={gamification.unlockedAchievements}
                totalAchievements={gamification.totalAchievements}
              />
            </div>
          </div>

          {/* Browse Modules CTA */}
          <AcademyCard title="Quick Actions">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Link
                href="/members/academy/modules"
                onClick={() => Analytics.trackAcademyAction('browse_modules')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-emerald-500/35 hover:text-white"
                data-testid="cta-browse-modules"
              >
                <BookOpen className="h-4 w-4" strokeWidth={1.5} />
                Browse Modules
              </Link>
              <Link
                href="/members/academy/review"
                onClick={() => Analytics.trackAcademyAction('open_review_queue')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-emerald-500/35 hover:text-white"
                data-testid="cta-review-queue"
              >
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                Review Queue
              </Link>
              <Link
                href="/members/academy/progress"
                onClick={() => Analytics.trackAcademyAction('view_progress')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-emerald-500/35 hover:text-white"
                data-testid="cta-view-progress"
              >
                <TrendingUp className="h-4 w-4" strokeWidth={1.5} />
                View Progress
              </Link>
            </div>
          </AcademyCard>
        </div>
      )}
    </AcademyShell>
  )
}
