'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Menu, X } from 'lucide-react'
import { LessonPlayer } from '@/components/academy/lesson-player'
import { LessonSidebar, type SidebarLesson } from '@/components/academy/lesson-sidebar'
import { AiTutorPanel } from '@/components/academy/ai-tutor-panel'
import { QuizEngine } from '@/components/academy/quiz-engine'
import type { QuizQuestionData } from '@/components/academy/quiz-question'

// ============================================
// TYPES
// ============================================

interface LessonData {
  id: string
  title: string
  content: string
  contentType: 'markdown' | 'video' | 'mixed'
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
}

interface LessonResponse {
  success: boolean
  data?: LessonData
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function LessonPage() {
  const params = useParams()
  const lessonId = params.id as string

  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSidebar, setShowSidebar] = useState(false)
  const [isMarkingComplete, setIsMarkingComplete] = useState(false)

  // Fetch lesson data
  useEffect(() => {
    async function fetchLesson() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/academy/lessons/${lessonId}`)
        if (!res.ok) throw new Error('Failed to fetch lesson')

        const payload: LessonResponse = await res.json()
        if (!payload.success || !payload.data) {
          throw new Error('Invalid lesson payload')
        }

        setLesson(payload.data)
      } catch (error) {
        console.error('Error fetching lesson:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (lessonId) fetchLesson()
  }, [lessonId])

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

  // Mark lesson as complete
  const handleMarkComplete = useCallback(async () => {
    if (!lesson || isMarkingComplete) return
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
          return {
            ...prev,
            isCompleted: true,
            course: {
              ...prev.course,
              lessons: prev.course.lessons.map((l) =>
                l.id === prev.id ? { ...l, isCompleted: true } : l
              ),
            },
          }
        })
      }
    } catch (error) {
      console.error('Error marking complete:', error)
    } finally {
      setIsMarkingComplete(false)
    }
  }, [lesson, isMarkingComplete])

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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
            <Image src="/logo.png" alt="Loading" fill className="object-contain" />
          </div>
          <p className="text-sm text-white/40">Loading lesson...</p>
        </div>
      </div>
    )
  }

  if (!lesson) {
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
    <div className="relative space-y-3">
      <div className="flex items-center gap-2 text-xs text-white/45">
        <Link href="/members/academy/courses" className="hover:text-white/70 transition-colors">
          Training Library
        </Link>
        <span>/</span>
        <Link
          href={`/members/academy/courses/${lesson.course.slug}`}
          className="hover:text-white/70 transition-colors"
        >
          {lesson.course.title}
        </Link>
        <span>/</span>
        <span className="text-white/70 truncate">{lesson.title}</span>
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

      <div className="flex min-h-[calc(100vh-7rem)] rounded-2xl border border-white/10 bg-[#0A0A0B]/55 backdrop-blur-xl overflow-hidden">
        {/* Sidebar - Desktop always visible, Mobile toggleable */}
        <div
          className={cn(
            'shrink-0 transition-all duration-300',
            // Mobile: overlay
            'fixed lg:relative z-20',
            'top-14 left-0 bottom-0',
            'w-[280px]',
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
        <div className="flex-1 min-w-0 bg-transparent">
          <LessonPlayer
            lessonId={lesson.id}
            title={lesson.title}
            content={lesson.content}
            contentType={lesson.contentType}
            videoUrl={lesson.videoUrl}
            durationMinutes={lesson.durationMinutes}
            onProgressUpdate={handleProgressUpdate}
          />

          {/* Quiz section (if lesson has a quiz) */}
          {lesson.quiz && lesson.quiz.length > 0 && (
            <div className="px-6 py-6 max-w-3xl">
              <QuizEngine
                questions={lesson.quiz}
                title="Lesson Quiz"
                passingScore={70}
                onComplete={handleQuizComplete}
              />
            </div>
          )}
        </div>
      </div>

      {/* AI Tutor panel */}
      <AiTutorPanel
        lessonId={lesson.id}
        lessonTitle={lesson.title}
      />
    </div>
  )
}
