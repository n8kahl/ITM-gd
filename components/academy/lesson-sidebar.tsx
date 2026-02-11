'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  Lock,
  ChevronLeft,
  BookOpen,
} from 'lucide-react'
import { ProgressRing } from '@/components/academy/progress-ring'

export interface SidebarLesson {
  id: string
  title: string
  order: number
  durationMinutes: number
  isCompleted: boolean
  isLocked: boolean
}

interface LessonSidebarProps {
  courseTitle: string
  courseSlug: string
  lessons: SidebarLesson[]
  currentLessonId: string
  onMarkComplete?: () => void
  isMarkingComplete?: boolean
  className?: string
}

export function LessonSidebar({
  courseTitle,
  courseSlug,
  lessons,
  currentLessonId,
  onMarkComplete,
  isMarkingComplete = false,
  className,
}: LessonSidebarProps) {
  const progress = useMemo(() => {
    const completed = lessons.filter((l) => l.isCompleted).length
    return lessons.length > 0
      ? Math.round((completed / lessons.length) * 100)
      : 0
  }, [lessons])

  const currentLesson = lessons.find((l) => l.id === currentLessonId)
  const isCurrentCompleted = currentLesson?.isCompleted ?? false

  return (
    <div
      className={cn(
        'flex flex-col h-full',
        'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/5 space-y-3">
        <Link
          href={`/members/academy/courses/${courseSlug}`}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to course
        </Link>

        <div className="flex items-center gap-3">
          <ProgressRing progress={progress} size={40} strokeWidth={3} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">
              {courseTitle}
            </h3>
            <p className="text-[11px] text-white/40">
              {lessons.filter((l) => l.isCompleted).length} of {lessons.length} complete
            </p>
          </div>
        </div>
      </div>

      {/* Lesson list */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-white/10">
        {lessons.map((lesson) => {
          const isCurrent = lesson.id === currentLessonId

          return (
            <Link
              key={lesson.id}
              href={lesson.isLocked ? '#' : `/members/academy/learn/${lesson.id}`}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 transition-colors',
                isCurrent
                  ? 'bg-emerald-500/10 border-l-2 border-emerald-500'
                  : 'hover:bg-white/5 border-l-2 border-transparent',
                lesson.isLocked && 'opacity-50 cursor-not-allowed'
              )}
              onClick={(e) => {
                if (lesson.isLocked) e.preventDefault()
              }}
            >
              {/* Status icon */}
              <div className="shrink-0">
                {lesson.isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : lesson.isLocked ? (
                  <Lock className="w-4 h-4 text-white/20" />
                ) : isCurrent ? (
                  <PlayCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Circle className="w-4 h-4 text-white/20" />
                )}
              </div>

              {/* Lesson info */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-xs font-medium truncate',
                    isCurrent ? 'text-emerald-400' : 'text-white/70',
                    lesson.isCompleted && !isCurrent && 'text-white/50'
                  )}
                >
                  {lesson.order}. {lesson.title}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  {lesson.durationMinutes} min
                </p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Mark complete button */}
      {onMarkComplete && (
        <div className="shrink-0 border-t border-white/5 bg-[#0A0A0B]/90 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:pb-4">
          <button
            data-testid="sidebar-mark-complete"
            onClick={onMarkComplete}
            disabled={isMarkingComplete || isCurrentCompleted}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium',
              'transition-all duration-200',
              isCurrentCompleted
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default'
                : 'bg-[rgb(var(--emerald-elite))]/20 hover:bg-[rgb(var(--emerald-elite))]/30 text-white border border-emerald-500/30 hover:border-emerald-500/50',
              isMarkingComplete && 'opacity-60'
            )}
          >
            {isCurrentCompleted ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Completed
              </>
            ) : isMarkingComplete ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                >
                  <BookOpen className="w-4 h-4" />
                </motion.div>
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Mark as Complete
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
