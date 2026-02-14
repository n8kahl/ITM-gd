'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Menu, X } from 'lucide-react'
import { LessonPlayer } from '@/components/academy/lesson-player'
import type { LessonChunk } from '@/components/academy/lesson-chunk-renderer'
import { LessonSidebar, type SidebarLesson } from '@/components/academy/lesson-sidebar'
import { AiTutorPanel } from '@/components/academy/ai-tutor-panel'
import { QuizEngine } from '@/components/academy/quiz-engine'
import type { QuizQuestionData } from '@/components/academy/quiz-question'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'

// ============================================
// TYPES
// ============================================

interface LessonData {
  id: string
  title: string
  content: string
  contentType: 'markdown' | 'video' | 'mixed' | 'chunk'
  chunkData?: LessonChunk[] | null
  videoUrl: string | null
  durationMinutes: number
  order: number
  isCompleted: boolean
  course: {
    slug: string
    title: string
    lessons: SidebarLesson[]
  }
  quiz: QuizQuestionData[] | null
  aiTutorChips: string[]
  keyTakeaways?: string[]
  competencyKeys?: string[]
}

interface LessonResponse {
  success: boolean
  data?: LessonData
  error?: string
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function LessonPage() {
  const params = useParams()
  const router = useRouter()
  const lessonId = params.id as string

  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lessonError, setLessonError] = useState<string | null>(null)
  const [isLessonNotFound, setIsLessonNotFound] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [isMarkingComplete, setIsMarkingComplete] = useState(false)
  const [isLessonSaved, setIsLessonSaved] = useState(false)
  const [isSavingLesson, setIsSavingLesson] = useState(false)

  // Fetch lesson data
  useEffect(() => {
    async function fetchLesson() {
      setIsLoading(true)
      setLessonError(null)
      setIsLessonNotFound(false)

      try {
        const res = await fetch(`/api/academy/lessons/${lessonId}`)
        const payload = (await res.json().catch(() => null)) as LessonResponse | null

        if (!res.ok) {
          if (res.status === 404) {
            setLesson(null)
            setIsLessonNotFound(true)
            return
          }

          throw new Error(
            payload?.error ||
              (res.status === 401
                ? 'Your session has expired. Refresh and sign in again.'
                : 'Failed to fetch lesson')
          )
        }

        if (!payload?.success || !payload.data) {
          throw new Error('Invalid lesson payload')
        }

        setLesson(payload.data)
      } catch (error) {
        console.error('Error fetching lesson:', error)
        setLesson(null)
        setLessonError(error instanceof Error ? error.message : 'Unable to load lesson')
      } finally {
        setIsLoading(false)
      }
    }

    if (lessonId) fetchLesson()
  }, [lessonId])

  useEffect(() => {
    async function fetchSavedState() {
      if (!lesson?.id) return
      try {
        const response = await fetch('/api/academy/saved')
        if (!response.ok) return
        const payload = await response.json()
        const savedItems = Array.isArray(payload?.data?.items) ? payload.data.items : []
        const isSaved = savedItems.some((item: { entity_type?: string; entity_id?: string }) =>
          item?.entity_type === 'lesson' && item?.entity_id === lesson.id
        )
        setIsLessonSaved(isSaved)
      } catch {
        // no-op
      }
    }

    void fetchSavedState()
  }, [lesson?.id])

  // Auto-save scroll progress
  const handleProgressUpdate = useCallback(
    async (scrollPercent: number) => {
      if (!lessonId) return
      try {
        await fetch(`/api/academy/lessons/${lessonId}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'view',
            time_spent_seconds: Math.max(5, Math.round(scrollPercent / 10)),
          }),
        })
      } catch {
        // Silent fail for progress saves
      }
    },
    [lessonId]
  )

  const markLessonComplete = useCallback(async () => {
    if (!lesson || isMarkingComplete) return false
    setIsMarkingComplete(true)
    try {
      const res = await fetch(`/api/academy/lessons/${lesson.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      })

      if (res.ok) {
        setLesson((prev) => {
          if (!prev) return prev
          const currentIndex = prev.course.lessons.findIndex((l) => l.id === prev.id)
          return {
            ...prev,
            isCompleted: true,
            course: {
              ...prev.course,
              lessons: prev.course.lessons.map((l, index) =>
                l.id === prev.id
                  ? { ...l, isCompleted: true, isLocked: false }
                  : index === currentIndex + 1
                    ? { ...l, isLocked: false }
                    : l
              ),
            },
          }
        })
        return true
      }
      return false
    } catch (error) {
      console.error('Error marking complete:', error)
      return false
    } finally {
      setIsMarkingComplete(false)
    }
  }, [lesson, isMarkingComplete])

  // Mark lesson as complete
  const handleMarkComplete = useCallback(async () => {
    await markLessonComplete()
  }, [markLessonComplete])

  const handleToggleLessonSaved = useCallback(async () => {
    if (!lesson || isSavingLesson) return
    setIsSavingLesson(true)
    try {
      const response = await fetch('/api/academy/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'lesson',
          entity_id: lesson.id,
        }),
      })
      if (!response.ok) return
      const payload = await response.json()
      if (payload?.success) {
        setIsLessonSaved(Boolean(payload?.data?.saved))
      }
    } catch {
      // no-op
    } finally {
      setIsSavingLesson(false)
    }
  }, [isSavingLesson, lesson])

  // Handle quiz completion
  const handleQuizComplete = useCallback(
    async (
      _score: number,
      _total: number,
      _passed: boolean,
      answers?: Array<{ question_id: string; selected_answer: string }>
    ) => {
      if (!lessonId) return
      if (!answers || answers.length === 0) return

      try {
        await fetch(`/api/academy/lessons/${lessonId}/quiz`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answers,
          }),
        })
      } catch {
        // Silent fail
      }
    },
    [lessonId]
  )

  const hasQuiz = !!lesson?.quiz?.length
  const currentLessonIndex = lesson
    ? lesson.course.lessons.findIndex((courseLesson) => courseLesson.id === lesson.id)
    : -1

  const previousLesson = useMemo(() => {
    if (!lesson) return null
    if (currentLessonIndex <= 0) return null
    return lesson.course.lessons[currentLessonIndex - 1] || null
  }, [lesson, currentLessonIndex])

  const nextLesson = useMemo(() => {
    if (!lesson) return null
    if (currentLessonIndex < 0) return null
    for (let index = currentLessonIndex + 1; index < lesson.course.lessons.length; index += 1) {
      const candidate = lesson.course.lessons[index]
      if (!candidate.isLocked) return candidate
    }
    return null
  }, [lesson, currentLessonIndex])

  const immediateNextLesson = useMemo(() => {
    if (!lesson) return null
    if (currentLessonIndex < 0) return null
    return lesson.course.lessons[currentLessonIndex + 1] || null
  }, [lesson, currentLessonIndex])

  const isCourseComplete = useMemo(() => {
    if (!lesson) return false
    return lesson.course.lessons.every((courseLesson) =>
      courseLesson.id === lesson.id ? lesson.isCompleted : courseLesson.isCompleted
    )
  }, [lesson])

  const primaryActionLabel = !lesson
    ? 'Complete Course'
    : lesson.isCompleted
      ? nextLesson
        ? 'Next Lesson'
        : isCourseComplete
          ? 'Course Complete'
          : 'Return to Course'
      : immediateNextLesson
        ? 'Complete & Next Lesson'
        : 'Complete Course'

  const handlePrimaryAction = useCallback(async () => {
    if (!lesson) return
    if (isMarkingComplete) return

    if (!lesson.isCompleted) {
      const completed = await markLessonComplete()
      if (!completed) return
    }

    const nextTarget = lesson.isCompleted ? nextLesson : immediateNextLesson
    if (nextTarget) {
      router.push(`/members/academy/learn/${nextTarget.id}`)
      return
    }

    router.push(`/members/academy/courses/${lesson.course.slug}`)
  }, [immediateNextLesson, isMarkingComplete, lesson, markLessonComplete, nextLesson, router])

  const lessonClosingPanel = lesson ? (
    <div className="space-y-3">
      {Array.isArray(lesson.keyTakeaways) && lesson.keyTakeaways.length > 0 && (
        <section className="glass-card-heavy rounded-xl border border-white/10 p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-300">
            Key Takeaways
          </p>
          <ul className="mt-3 space-y-2">
            {lesson.keyTakeaways.slice(0, 6).map((takeaway) => (
              <li key={takeaway} className="flex items-start gap-2 text-xs text-white/70">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-300 shrink-0" />
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        data-testid="lesson-actions"
        className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
        aria-label="Lesson actions"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">Lesson checkpoints</p>
            <p className="text-xs text-white/50">
              {lesson.isCompleted
                ? 'This lesson is complete. Continue when you are ready.'
                : 'Mark this lesson complete to unlock progress and the next step.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {previousLesson && (
              <button
                type="button"
                data-testid="lesson-secondary-action"
                onClick={() => router.push(`/members/academy/learn/${previousLesson.id}`)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
            )}

            <button
              type="button"
              data-testid="lesson-primary-action"
              onClick={handlePrimaryAction}
              disabled={isMarkingComplete}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors',
                'border border-emerald-500/50 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30',
                isMarkingComplete && 'cursor-not-allowed opacity-70'
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isMarkingComplete ? 'Saving...' : primaryActionLabel}
              {!isMarkingComplete && (lesson.isCompleted ? nextLesson : immediateNextLesson) && (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  ) : null

  const lessonFooter = lesson ? (
    <div className="space-y-4">
      {hasQuiz && (
        <div className="max-w-3xl">
          <QuizEngine
            questions={lesson.quiz ?? []}
            title="Lesson Quiz"
            passingScore={70}
            onComplete={handleQuizComplete}
          />
        </div>
      )}
      {lessonClosingPanel}
    </div>
  ) : null

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
            <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill sizes="48px" className="object-contain" />
          </div>
          <p className="text-sm text-white/40">Loading lesson...</p>
        </div>
      </div>
    )
  }

  if (!lesson) {
    if (!isLessonNotFound) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <div className="text-center max-w-md">
            <p className="text-lg font-semibold text-white mb-2">Unable to load lesson</p>
            <p className="text-sm text-white/55">
              {lessonError || 'An unexpected error occurred while loading this lesson.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => router.refresh()}
                className="rounded-lg border border-white/20 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/[0.06] transition-colors"
              >
                Retry
              </button>
              <Link
                href="/members/academy/courses"
                className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 transition-colors"
              >
                Back to Library
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-lg font-semibold text-white mb-2">Lesson Not Found</p>
          <p className="text-sm text-white/50">
            This lesson may have been moved or removed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-6.5rem)] flex-col gap-3 overflow-hidden lg:min-h-[calc(100dvh-7.5rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3 lg:shrink-0">
        <div className="flex min-w-0 items-center gap-2 text-xs text-white/45">
          <Link href="/members/academy/courses" className="hover:text-white/70 transition-colors">
            Academy
          </Link>
          <span>/</span>
          <Link
            href={`/members/academy/courses/${lesson.course.slug}`}
            className="hover:text-white/70 transition-colors"
          >
            {lesson.course.title}
          </Link>
          <span>/</span>
          <span className="truncate text-white/70">{lesson.title}</span>
        </div>

        <button
          type="button"
          onClick={handleToggleLessonSaved}
          disabled={isSavingLesson}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
            isLessonSaved
              ? 'border-emerald-500/45 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
              : 'border-white/20 bg-white/[0.03] text-white/75 hover:bg-white/[0.06]',
            isSavingLesson && 'cursor-not-allowed opacity-70'
          )}
        >
          {isSavingLesson ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
          {isLessonSaved ? 'Saved' : 'Save Lesson'}
        </button>
      </div>

      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className={cn(
          'lg:hidden fixed top-[4.4rem] left-4 z-30',
          'w-10 h-10 rounded-lg flex items-center justify-center',
          'bg-[#0A0A0B]/90 border border-white/10',
          'text-white/60 hover:text-white/80',
          'transition-colors'
        )}
        aria-label="Toggle lesson sidebar"
      >
        {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <div className="flex min-h-0 flex-1 rounded-2xl border border-white/10 bg-[#0A0A0B]/55 backdrop-blur-xl overflow-hidden">
        {/* Sidebar - Desktop always visible, Mobile toggleable */}
        <div
          className={cn(
            'shrink-0 transition-all duration-300',
            // Mobile: overlay
            'fixed lg:relative z-20',
            'top-14 left-0 bottom-0 lg:top-0 lg:left-auto lg:bottom-auto',
            'w-[280px] lg:h-full',
            showSidebar
              ? 'translate-x-0'
              : '-translate-x-full lg:translate-x-0'
          )}
        >
          <LessonSidebar
            courseTitle={lesson.course.title}
            courseSlug={lesson.course.slug}
            lessons={lesson.course.lessons}
            currentLessonId={lesson.id}
            onMarkComplete={handleMarkComplete}
            isMarkingComplete={isMarkingComplete}
            className="h-full rounded-none lg:border-r lg:border-white/10"
          />
        </div>

        {/* Mobile overlay backdrop */}
        {showSidebar && (
          <div
            className="fixed inset-0 z-10 bg-black/60 lg:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Main content area */}
        <div className="flex-1 min-w-0 min-h-0 bg-transparent">
          <LessonPlayer
            key={lesson.id}
            lessonId={lesson.id}
            title={lesson.title}
            content={lesson.content}
            contentType={lesson.contentType}
            chunkData={lesson.chunkData || null}
            videoUrl={lesson.videoUrl}
            durationMinutes={lesson.durationMinutes}
            onProgressUpdate={handleProgressUpdate}
            footer={lessonFooter}
          />
        </div>
      </div>

      {/* AI Tutor panel */}
      <AiTutorPanel
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        suggestedPrompts={lesson.aiTutorChips}
      />
    </div>
  )
}
