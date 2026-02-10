'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Clock,
  BookOpen,
  ChevronLeft,
  PlayCircle,
  CheckCircle2,
  Lock,
  BarChart3,
} from 'lucide-react'
import { ProgressRing } from '@/components/academy/progress-ring'

// ============================================
// TYPES
// ============================================

interface CourseLesson {
  id: string
  title: string
  order: number
  durationMinutes: number
  contentType: 'markdown' | 'video' | 'mixed'
  isCompleted: boolean
  isLocked: boolean
}

interface CourseDetail {
  slug: string
  title: string
  description: string
  longDescription: string
  thumbnailUrl: string | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  path: string
  estimatedMinutes: number
  lessons: CourseLesson[]
  totalLessons: number
  completedLessons: number
  objectives: string[]
  prerequisites: string[]
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

// ============================================
// PAGE COMPONENT
// ============================================

export default function CourseDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchCourse() {
      try {
        const res = await fetch(`/api/academy/courses/${slug}`)
        if (!res.ok) throw new Error('Failed to fetch course')

        const data: CourseDetail = await res.json()
        setCourse(data)
      } catch (error) {
        console.error('Error fetching course:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (slug) fetchCourse()
  }, [slug])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
            <Image src="/logo.png" alt="Loading" fill className="object-contain" />
          </div>
          <p className="text-sm text-white/40">Loading course...</p>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Course Not Found</h2>
          <p className="text-sm text-white/50 mb-4">
            This course may have been moved or removed.
          </p>
          <Link
            href="/members/academy/courses"
            className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Browse all courses
          </Link>
        </div>
      </div>
    )
  }

  const progress =
    course.totalLessons > 0
      ? Math.round((course.completedLessons / course.totalLessons) * 100)
      : 0
  const diff = difficultyConfig[course.difficulty]

  // Find the next uncompleted lesson
  const nextLesson = course.lessons.find((l) => !l.isCompleted && !l.isLocked)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <Link
        href="/members/academy/courses"
        className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        All Courses
      </Link>

      {/* Course header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-xl overflow-hidden',
          'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5'
        )}
      >
        {/* Thumbnail */}
        <div className="relative aspect-[3/1] bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 overflow-hidden">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="w-16 h-16 text-emerald-500/20" />
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/40 to-transparent" />

          {/* Difficulty badge */}
          <div className="absolute top-4 left-4">
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border',
                diff.color
              )}
            >
              {diff.label}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 lg:p-6 -mt-12 relative">
          <h1 className="text-xl lg:text-2xl font-semibold text-white mb-2">
            {course.title}
          </h1>
          <p className="text-sm text-white/60 leading-relaxed max-w-2xl">
            {course.longDescription || course.description}
          </p>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {course.totalLessons} lessons
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {course.estimatedMinutes} min total
            </span>
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              {course.path}
            </span>
          </div>

          {/* Progress bar + CTA */}
          <div className="flex items-center gap-4 mt-5">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">
                  {course.completedLessons} of {course.totalLessons} complete
                </span>
                <span className="text-emerald-400 font-medium">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {nextLesson && (
              <Link
                href={`/members/academy/learn/${nextLesson.id}`}
                className={cn(
                  'shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium',
                  'bg-emerald-500 hover:bg-emerald-600 text-white',
                  'transition-colors'
                )}
              >
                <PlayCircle className="w-4 h-4" />
                {progress > 0 ? 'Continue' : 'Start Course'}
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* Objectives and Prerequisites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {course.objectives.length > 0 && (
          <div
            className={cn(
              'rounded-xl p-5',
              'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5'
            )}
          >
            <h3 className="text-sm font-semibold text-white mb-3">
              What You Will Learn
            </h3>
            <ul className="space-y-2">
              {course.objectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  {obj}
                </li>
              ))}
            </ul>
          </div>
        )}

        {course.prerequisites.length > 0 && (
          <div
            className={cn(
              'rounded-xl p-5',
              'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5'
            )}
          >
            <h3 className="text-sm font-semibold text-white mb-3">
              Prerequisites
            </h3>
            <ul className="space-y-2">
              {course.prerequisites.map((prereq, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                  <BookOpen className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                  {prereq}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Lesson list */}
      <div
        className={cn(
          'rounded-xl overflow-hidden',
          'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5'
        )}
      >
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Course Lessons</h3>
        </div>

        <div className="divide-y divide-white/5">
          {course.lessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={lesson.isLocked ? '#' : `/members/academy/learn/${lesson.id}`}
              onClick={(e) => {
                if (lesson.isLocked) e.preventDefault()
              }}
              className={cn(
                'flex items-center gap-4 px-5 py-3.5 transition-colors',
                lesson.isLocked
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-white/[0.03]'
              )}
            >
              {/* Status icon */}
              <div className="shrink-0">
                {lesson.isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : lesson.isLocked ? (
                  <Lock className="w-5 h-5 text-white/20" />
                ) : (
                  <PlayCircle className="w-5 h-5 text-white/30" />
                )}
              </div>

              {/* Lesson info */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium',
                    lesson.isCompleted ? 'text-white/50' : 'text-white'
                  )}
                >
                  {lesson.order}. {lesson.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/30">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {lesson.durationMinutes} min
                  </span>
                  <span className="capitalize">{lesson.contentType}</span>
                </div>
              </div>

              {/* Arrow */}
              {!lesson.isLocked && (
                <ChevronLeft className="w-4 h-4 text-white/20 rotate-180 shrink-0" />
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
