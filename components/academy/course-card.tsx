'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Clock, BookOpen, Sparkles, Target } from 'lucide-react'
import { ProgressRing } from '@/components/academy/progress-ring'
import { resolveCourseImage } from '@/lib/academy/course-images'

export interface CourseCardData {
  slug: string
  title: string
  description: string
  thumbnailUrl?: string | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  path: string
  totalLessons: number
  completedLessons: number
  estimatedMinutes: number
  skills?: string[]
  microLearningAvailable?: boolean
  lastUpdatedAt?: string | null
}

interface CourseCardProps {
  course: CourseCardData
  className?: string
  density?: 'comfortable' | 'compact'
}

const difficultyConfig = {
  beginner: {
    label: 'Beginner',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  intermediate: {
    label: 'Intermediate',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  advanced: {
    label: 'Advanced',
    color: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
}

export function CourseCard({ course, className, density = 'comfortable' }: CourseCardProps) {
  const progress =
    course.totalLessons > 0
      ? Math.round((course.completedLessons / course.totalLessons) * 100)
      : 0
  const diff = difficultyConfig[course.difficulty]
  const thumbnailSrc = resolveCourseImage({
    slug: course.slug,
    title: course.title,
    path: course.path,
    thumbnailUrl: course.thumbnailUrl,
  })
  const estimatedMinutes = Number.isFinite(course.estimatedMinutes) ? Math.max(0, course.estimatedMinutes) : 0
  const firstWinMinutes = estimatedMinutes > 0 ? Math.max(5, Math.min(20, Math.round(estimatedMinutes / 4))) : null
  const lastUpdatedLabel = (() => {
    if (!course.lastUpdatedAt) return null
    const parsed = new Date(course.lastUpdatedAt)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toLocaleDateString()
  })()

  return (
    <Link href={`/members/academy/courses/${course.slug}`}>
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={cn(
          'group rounded-xl overflow-hidden',
          'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5',
          'hover:border-emerald-500/30 transition-colors duration-300',
          density === 'compact' ? 'min-h-[250px]' : '',
          className
        )}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video bg-white/5 overflow-hidden">
          <Image
            src={thumbnailSrc}
            alt={course.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Difficulty badge */}
          <div className="absolute top-2 left-2">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border',
                diff.color
              )}
            >
              {diff.label}
            </span>
          </div>

          {course.path && (
            <div className="absolute bottom-2 left-2">
              <span className="inline-flex items-center rounded-md border border-white/20 bg-[#0A0A0B]/70 px-2 py-0.5 text-[10px] font-medium text-white/80">
                {course.path}
              </span>
            </div>
          )}

          {/* Progress ring overlay */}
          {progress > 0 && (
            <div className="absolute top-2 right-2">
              <ProgressRing
                progress={progress}
                size={32}
                strokeWidth={3}
                showLabel={false}
                className="bg-[#0A0A0B]/80 rounded-full p-0.5"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-emerald-400 transition-colors">
            {course.title}
          </h3>
          <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
            {course.description}
          </p>

          {course.skills && course.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {course.skills.slice(0, 2).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/60"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 text-[11px] text-white/40">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {course.totalLessons} lessons
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {estimatedMinutes}m
              </span>
            </div>

            {/* Progress text */}
            {progress > 0 && (
              <span className="text-[11px] font-medium text-emerald-400">
                {progress}%
              </span>
            )}
          </div>

          {/* Progress bar */}
          {progress > 0 && (
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-white/40">
            <div className="inline-flex items-center gap-1">
              <Target className="w-3 h-3 text-emerald-400/80" />
              <span>
                {firstWinMinutes ? `First win ~${firstWinMinutes}m` : 'Start any lesson'}
              </span>
            </div>
            {course.microLearningAvailable && (
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Sparkles className="w-3 h-3" />
                Micro-learning
              </span>
            )}
          </div>
          {lastUpdatedLabel && (
            <div className="text-[10px] text-white/35">Updated {lastUpdatedLabel}</div>
          )}
        </div>
      </motion.div>
    </Link>
  )
}
