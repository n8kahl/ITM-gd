'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react'

type LessonStatus = 'done' | 'next' | 'in_progress' | 'locked'

function StatusBadge({ status }: { status: LessonStatus }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Done
      </span>
    )
  }

  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-200">
        <ArrowRight className="h-3.5 w-3.5" />
        Continue
      </span>
    )
  }

  if (status === 'next') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-zinc-300">
        <ArrowRight className="h-3.5 w-3.5" />
        Start
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
      <Lock className="h-3.5 w-3.5" />
      Locked
    </span>
  )
}

export function AcademyLessonRow({
  lessonId,
  index,
  title,
  objective,
  estimatedMinutes,
  status,
}: {
  lessonId: string
  index: number
  title: string
  objective: string
  estimatedMinutes: number
  status: LessonStatus
}) {
  const disabled = status === 'locked'
  const baseClassName = 'w-full rounded-xl border border-white/10 bg-[#0f1117] px-4 py-3 text-left transition-colors'

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className={`pt-0.5 text-xl font-semibold ${status === 'done' ? 'text-emerald-300' : 'text-zinc-400'}`}>
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 line-clamp-1 text-xs text-white/55">{objective}</p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xs text-zinc-400">{estimatedMinutes} min</p>
          <div className="mt-1">
            <StatusBadge status={status} />
          </div>
        </div>
      </div>
    </>
  )

  if (disabled) {
    return <div className={`${baseClassName} cursor-not-allowed opacity-75`}>{content}</div>
  }

  return (
    <Link href={`/members/academy/lessons/${lessonId}`} className={`${baseClassName} block hover:border-emerald-500/35`}>
      {content}
    </Link>
  )
}
