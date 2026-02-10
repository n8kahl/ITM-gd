'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CirclePlay, Clock, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CourseCard, type CourseCardData } from '@/components/academy/course-card'

interface ContinueResponse {
  success: boolean
  data?: {
    courses: CourseCardData[]
  }
}

interface ResumeTarget {
  lessonId: string
  lessonTitle: string
  lessonNumber: number
  totalLessons: number
  courseProgressPercent: number
  courseSlug: string
  courseTitle: string
  resumeUrl: string
}

interface ResumeResponse {
  success: boolean
  data?: {
    target: ResumeTarget | null
  }
}

export default function AcademyContinuePage() {
  const [courses, setCourses] = useState<CourseCardData[]>([])
  const [resumeTarget, setResumeTarget] = useState<ResumeTarget | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCourses() {
      const [coursesResult, resumeResult] = await Promise.allSettled([
        fetch('/api/academy/courses'),
        fetch('/api/academy/resume'),
      ])

      if (coursesResult.status === 'fulfilled' && coursesResult.value.ok) {
        try {
          const payload = (await coursesResult.value.json()) as ContinueResponse
          setCourses(payload.data?.courses || [])
        } catch (error) {
          console.error('Continue page courses parse failed', error)
        }
      } else if (coursesResult.status === 'rejected') {
        console.error('Continue page courses load failed', coursesResult.reason)
      }

      if (resumeResult.status === 'fulfilled' && resumeResult.value.ok) {
        try {
          const payload = (await resumeResult.value.json()) as ResumeResponse
          setResumeTarget(payload.data?.target || null)
        } catch (error) {
          console.error('Continue page resume parse failed', error)
        }
      } else if (resumeResult.status === 'rejected') {
        console.error('Continue page resume load failed', resumeResult.reason)
      }

      setLoading(false)
    }

    loadCourses()
  }, [])

  const inProgressCourses = useMemo(() => {
    return courses.filter(
      (course) => course.completedLessons > 0 && course.completedLessons < course.totalLessons
    )
  }, [courses])

  if (loading) {
    return <div className="h-36 rounded-xl border border-white/10 bg-white/[0.02] animate-pulse" />
  }

  return (
    <div className="space-y-5">
      <div
        className={cn(
          'rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-5',
          'flex flex-col gap-2'
        )}
      >
        <div className="flex items-center gap-2 text-emerald-300">
          <CirclePlay className="w-4 h-4" />
          <h1 className="text-sm font-semibold uppercase tracking-[0.12em]">Continue Learning</h1>
        </div>
        <p className="text-sm text-white/70">
          Resume where you left off. Prioritized by your active courses and unfinished lessons.
        </p>
      </div>

      {resumeTarget && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
            Next Up
          </p>
          <h2 className="mt-1 text-base font-semibold text-white">{resumeTarget.lessonTitle}</h2>
          <p className="mt-1 text-xs text-white/70">
            {resumeTarget.courseTitle} • Lesson {resumeTarget.lessonNumber} of {resumeTarget.totalLessons} • {resumeTarget.courseProgressPercent}% complete
          </p>
          <Link
            href={resumeTarget.resumeUrl}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
          >
            Resume Next Lesson
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {inProgressCourses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {inProgressCourses.map((course) => (
            <CourseCard key={course.slug} course={course} density="comfortable" />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-6">
          <h2 className="text-base font-semibold text-white">
            {resumeTarget ? 'No additional in-progress courses' : 'No in-progress courses yet'}
          </h2>
          <p className="mt-1 text-sm text-white/60">
            {resumeTarget
              ? 'Your next lesson is ready above. Start any other course and it will appear in this queue.'
              : 'Start any course and your resume queue will appear here automatically.'}
          </p>
          <Link
            href="/members/academy/courses"
            className="inline-flex items-center gap-2 mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
          >
            Browse Library
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-white/50">
            <Clock className="w-3.5 h-3.5" />
            Tip: complete one micro-learning lesson to create your continue queue.
          </div>
        </div>
      )}
    </div>
  )
}
