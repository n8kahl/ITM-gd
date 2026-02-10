'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Play, ArrowRight } from 'lucide-react'
import { ProgressRing } from '@/components/academy/progress-ring'

interface ContinueLearningCardProps {
  lessonId: string
  lessonTitle: string
  courseTitle: string
  courseSlug: string
  progress: number
  totalLessons: number
  currentLesson: number
  className?: string
}

export function ContinueLearningCard({
  lessonId,
  lessonTitle,
  courseTitle,
  courseSlug,
  progress,
  totalLessons,
  currentLesson,
  className,
}: ContinueLearningCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl p-5',
        'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5',
        'hover:border-emerald-500/30 transition-colors duration-300',
        className
      )}
    >
      <div className="flex items-center gap-4">
        {/* Progress ring */}
        <ProgressRing
          progress={progress}
          size={56}
          strokeWidth={4}
          showLabel
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-emerald-400 font-medium uppercase tracking-wider mb-1">
            Continue Learning
          </p>
          <h3 className="text-sm font-semibold text-white truncate">
            {lessonTitle}
          </h3>
          <p className="text-xs text-white/40 mt-0.5">
            {courseTitle} &middot; Lesson {currentLesson} of {totalLessons}
          </p>
        </div>

        {/* Resume button */}
        <Link
          href={`/members/academy/learn/${lessonId}`}
          className={cn(
            'shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg',
            'text-sm font-medium text-white',
            'bg-[rgb(var(--emerald-elite))]/20 hover:bg-[rgb(var(--emerald-elite))]/30',
            'border border-emerald-500/30 hover:border-emerald-500/50',
            'transition-all duration-200'
          )}
        >
          <Play className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Resume</span>
          <ArrowRight className="w-3.5 h-3.5 sm:hidden" />
        </Link>
      </div>
    </motion.div>
  )
}
