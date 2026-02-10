/**
 * File: components/academy/ai-resume-card.tsx
 * Created: 2026-02-10
 * Purpose: Show AI-guided lesson resume context on the Academy home surface.
 */
'use client'

import Link from 'next/link'
import { ArrowRight, Brain, CirclePlay } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIResumeCardProps {
  currentLesson: {
    id: string
    title: string
    courseTitle: string
    position: number
    totalLessons: number
    progress: number
  } | null
  insight?: {
    message: string
    source: string
  } | null
  className?: string
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function AIResumeCard({ currentLesson, insight, className }: AIResumeCardProps) {
  if (!currentLesson) {
    return (
      <section className={cn('glass-card-heavy rounded-xl border border-white/10 p-5', className)}>
        <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-300">AI Resume</p>
        <h2 className="mt-2 text-base font-semibold text-white">Continue where you left off</h2>
        <p className="mt-1 text-sm text-white/65">
          Start any course to generate your personalized resume path and coaching insight.
        </p>
        <Link
          href="/members/academy/courses"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
        >
          Explore Courses
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    )
  }

  const progress = clampProgress(currentLesson.progress)

  return (
    <section className={cn('glass-card-heavy rounded-xl border border-emerald-500/25 p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-300">AI Resume</p>
          <h2 className="mt-1 text-base font-semibold text-white">{currentLesson.title}</h2>
          <p className="mt-1 text-xs text-white/60">
            {currentLesson.courseTitle} • Lesson {currentLesson.position} of {currentLesson.totalLessons}
          </p>
        </div>
        <span className="rounded-md border border-champagne/35 bg-champagne/10 px-2 py-1 text-[11px] font-medium text-champagne">
          {progress}% complete
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-emerald-300">
          <Brain className="h-3.5 w-3.5" />
          Insight
        </div>
        <p className="text-sm text-white/75">
          {insight?.message || 'Continue this lesson to lock in momentum and keep your streak intact.'}
        </p>
        {insight?.source && (
          <p className="mt-1 text-[11px] text-white/45">Source: {insight.source}</p>
        )}
      </div>

      <Link
        href={`/members/academy/learn/${currentLesson.id}`}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/45 bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30"
      >
        <CirclePlay className="h-3.5 w-3.5" />
        Resume
      </Link>
    </section>
  )
}
