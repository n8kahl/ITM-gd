'use client'

import Link from 'next/link'
import { BookOpen, PlayCircle } from 'lucide-react'

interface AcademyContinueLearningHeroProps {
  lessonTitle?: string
  moduleName?: string
  resumeUrl?: string
  progressPercent?: number
  lessonNumber?: number
  totalLessons?: number
}

export function AcademyContinueLearningHero({
  lessonTitle,
  moduleName,
  resumeUrl,
  progressPercent = 0,
  lessonNumber,
  totalLessons,
}: AcademyContinueLearningHeroProps) {
  const hasLesson = Boolean(lessonTitle && resumeUrl)
  const clamped = Math.max(0, Math.min(100, progressPercent))

  return (
    <section
      className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 p-6 md:p-8"
      data-testid="academy-continue-learning-hero"
    >
      {/* Gradient placeholder background */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-emerald-800/10 to-transparent"
        aria-hidden="true"
      />
      {/* Decorative radial glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Content */}
        <div className="flex-1 space-y-3">
          {/* Label */}
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-400">
            {hasLesson ? 'Continue Learning' : 'Get Started'}
          </p>

          {/* Lesson / fallback title */}
          <h2 className="font-serif text-xl font-semibold leading-snug text-white md:text-2xl">
            {hasLesson ? lessonTitle : 'Start Your Journey'}
          </h2>

          {/* Module name / sub-label */}
          {hasLesson ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-emerald-400/70" strokeWidth={1.5} aria-hidden="true" />
                {moduleName}
              </span>
              {lessonNumber != null && totalLessons != null && (
                <span className="font-mono text-xs text-zinc-500">
                  Lesson {lessonNumber} of {totalLessons}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              Begin with Track 1 — the foundations of elite options trading.
            </p>
          )}

          {/* Progress bar */}
          {hasLesson && (
            <div className="space-y-1">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuenow={clamped}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Lesson progress ${clamped}%`}
                data-testid="lesson-progress-bar"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                  style={{ width: `${clamped}%` }}
                />
              </div>
              <p className="font-mono text-xs text-zinc-500">{clamped}% complete</p>
            </div>
          )}
        </div>

        {/* CTA button */}
        <div className="flex-shrink-0">
          <Link
            href={hasLesson ? (resumeUrl ?? '/members/academy') : '/members/academy/modules'}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition-all hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            data-testid="continue-learning-cta"
          >
            <PlayCircle className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            {hasLesson ? 'Continue' : 'Start Track 1'}
          </Link>
        </div>
      </div>
    </section>
  )
}
