'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { GraduationCap, Sparkles } from 'lucide-react'
import { CourseCatalog } from '@/components/academy/course-catalog'
import { AiTutorPanel } from '@/components/academy/ai-tutor-panel'
import type { CourseCardData } from '@/components/academy/course-card'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'

// ============================================
// TYPES
// ============================================

interface CatalogResponse {
  success: boolean
  data?: {
    courses: CourseCardData[]
    paths: string[]
  }
}

interface CourseDetailResponse {
  success: boolean
  data?: {
    title: string
    lessons: Array<{ id: string }>
    resumeLessonId: string | null
  }
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseCardData[]>([])
  const [paths, setPaths] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tutorLessonId, setTutorLessonId] = useState<string | null>(null)
  const [tutorLessonTitle, setTutorLessonTitle] = useState('Academy')
  const [isTutorOpen, setIsTutorOpen] = useState(false)
  const [pendingTutorPrompt, setPendingTutorPrompt] = useState<{
    id: number
    text: string
  } | null>(null)

  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await fetch('/api/academy/courses')
        if (!res.ok) throw new Error('Failed to fetch courses')

        const payload: CatalogResponse = await res.json()
        if (!payload.success || !payload.data) {
          throw new Error('Invalid courses payload')
        }

        setCourses(payload.data.courses)
        setPaths(payload.data.paths)

        const defaultCourse =
          payload.data.courses.find((course) => course.completedLessons > 0 && course.completedLessons < course.totalLessons) ||
          payload.data.courses[0]

        if (!defaultCourse) return

        setTutorLessonTitle(defaultCourse.title)
        const detailRes = await fetch(`/api/academy/courses/${encodeURIComponent(defaultCourse.slug)}`)
        if (!detailRes.ok) throw new Error('Failed to fetch course detail for tutor context')

        const detailPayload: CourseDetailResponse = await detailRes.json()
        if (!detailPayload.success || !detailPayload.data) {
          throw new Error('Invalid course detail payload for tutor context')
        }

        const anchorLessonId = detailPayload.data.resumeLessonId || detailPayload.data.lessons[0]?.id || null
        if (!anchorLessonId) return

        setTutorLessonId(anchorLessonId)
        setTutorLessonTitle(detailPayload.data.title || defaultCourse.title)
      } catch (error) {
        console.error('Error fetching courses:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCourses()
  }, [])

  const handleAskTutor = (prompt: string) => {
    if (!tutorLessonId) return
    setIsTutorOpen(true)
    setPendingTutorPrompt({
      id: Date.now(),
      text: prompt,
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Pulsing logo loader */}
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
              <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill sizes="48px" className="object-contain" />
            </div>
            <p className="text-sm text-white/40">Loading courses...</p>
          </div>
        </div>

        {/* Skeleton grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-xl bg-emerald-500/5 animate-pulse border border-white/5"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl font-semibold text-white">Academy Courses</h1>
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            <Sparkles className="w-3 h-3" />
            Competency Based
          </span>
        </div>
        <p className="text-sm text-white/60">
          Browse all courses, launch micro-learning modules, and resume in-progress training from one place.
        </p>
        <p className="text-xs text-white/40 mt-2">
          {courses.length} total courses loaded
        </p>
      </div>

      {courses.length === 0 ? (
        <div
          className={cn(
            'rounded-xl p-6',
            'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5'
          )}
        >
          <p className="text-sm text-white/70">No courses found.</p>
          <p className="text-xs text-white/40 mt-1">
            This usually means the Academy schema or curriculum seed has not been applied to the database.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Refresh
          </button>
        </div>
      ) : (
        <>
          {/* Catalog with tutor prompt and filters */}
          <CourseCatalog
            courses={courses}
            paths={paths}
            onAskTutor={tutorLessonId ? handleAskTutor : undefined}
          />
          {tutorLessonId && (
            <AiTutorPanel
              lessonId={tutorLessonId}
              lessonTitle={tutorLessonTitle}
              isOpen={isTutorOpen}
              onOpenChange={setIsTutorOpen}
              desktopSide="left"
              showFloatingTrigger={false}
              pendingPrompt={pendingTutorPrompt}
            />
          )}
        </>
      )}
    </div>
  )
}
