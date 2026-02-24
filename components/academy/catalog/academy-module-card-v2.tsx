'use client'

import { BookOpen, Clock, Lock } from 'lucide-react'
import Link from 'next/link'

import type { AcademyModule, AcademyLesson } from '@/lib/academy-v3/contracts/domain'

export type ModuleSchema = AcademyModule & {
  lessons: Array<AcademyLesson>
}

const DIFFICULTY_DOT: Record<number, { label: string; className: string }> = {
  0: { label: 'Beginner', className: 'bg-emerald-400' },
  1: { label: 'Intermediate', className: 'bg-amber-400' },
  2: { label: 'Intermediate', className: 'bg-amber-400' },
}

function getDifficultyByPosition(position: number): { label: string; className: string } {
  return DIFFICULTY_DOT[Math.min(position, 2)] ?? { label: 'Advanced', className: 'bg-rose-400' }
}

export function AcademyModuleCardV2({
  moduleItem,
  trackTitle,
  progressPercent,
  isLocked = false,
  prerequisiteTitle,
  trackPosition = 0,
}: {
  moduleItem: ModuleSchema
  trackTitle: string
  progressPercent?: number
  isLocked?: boolean
  prerequisiteTitle?: string
  trackPosition?: number
}) {
  const safeProgress =
    typeof progressPercent === 'number' ? Math.max(0, Math.min(100, progressPercent)) : null
  const difficulty = getDifficultyByPosition(trackPosition)
  const estimatedTime = moduleItem.estimatedMinutes > 0 ? `${moduleItem.estimatedMinutes} min` : null
  const lessonCount = moduleItem.lessons.length

  const cardContent = (
    <div
      className={[
        'glass-card-heavy group relative flex flex-col overflow-hidden rounded-xl border border-white/10 transition-all',
        isLocked
          ? 'cursor-not-allowed opacity-60'
          : 'hover:-translate-y-0.5 hover:border-emerald-500/35 hover:shadow-lg hover:shadow-emerald-900/20',
      ].join(' ')}
      data-testid="academy-module-card-v2"
    >
      {/* Lock overlay */}
      {isLocked && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/40 backdrop-blur-[2px]"
          title={prerequisiteTitle ? `Requires: ${prerequisiteTitle}` : 'Prerequisites not met'}
          data-testid="module-card-lock-overlay"
        >
          <Lock className="h-7 w-7 text-white/70" strokeWidth={1.5} aria-hidden />
          {prerequisiteTitle && (
            <p className="max-w-[80%] text-center text-[11px] text-white/60">
              Requires: {prerequisiteTitle}
            </p>
          )}
        </div>
      )}

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Track label + difficulty dot */}
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs uppercase tracking-[0.08em] text-emerald-300/80">
            {trackTitle}
          </p>
          <span
            className={[
              'h-2 w-2 shrink-0 rounded-full',
              difficulty.className,
            ].join(' ')}
            title={difficulty.label}
            aria-label={`Difficulty: ${difficulty.label}`}
            data-testid="module-difficulty-dot"
          />
        </div>

        {/* Title + description */}
        <div className="space-y-1.5">
          <h3
            className="line-clamp-2 font-serif text-base font-semibold leading-snug text-white"
            data-testid="module-card-title"
          >
            {moduleItem.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-relaxed text-white/55">
            {moduleItem.description ?? 'Structured module content and practical drills.'}
          </p>
        </div>

        {/* Meta row */}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
          {estimatedTime && (
            <span
              className="flex items-center gap-1 text-xs text-zinc-400"
              data-testid="module-card-time"
            >
              <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
              <span className="font-mono">{estimatedTime}</span>
            </span>
          )}
          <span
            className="flex items-center gap-1 text-xs text-zinc-400"
            data-testid="module-card-lesson-count"
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
            <span className="font-mono">
              {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
            </span>
          </span>
        </div>

        {/* Progress bar */}
        {safeProgress !== null && (
          <div className="space-y-1" data-testid="module-card-progress">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${safeProgress}%` }}
                aria-valuenow={safeProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                role="progressbar"
                aria-label={`${safeProgress}% complete`}
              />
            </div>
            <p className="text-[11px] text-zinc-400">
              <span className="font-mono">{safeProgress}%</span> complete
            </p>
          </div>
        )}
      </div>
    </div>
  )

  if (isLocked) {
    return (
      <div
        title={prerequisiteTitle ? `Requires: ${prerequisiteTitle}` : undefined}
        aria-disabled="true"
      >
        {cardContent}
      </div>
    )
  }

  return (
    <Link
      href={`/members/academy/modules/${moduleItem.slug}`}
      prefetch={false}
      aria-label={`Open module: ${moduleItem.title}`}
      data-testid="module-card-link"
    >
      {cardContent}
    </Link>
  )
}
