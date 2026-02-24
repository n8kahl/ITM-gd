'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AcademyShell } from '@/components/academy/academy-shell'
import { AcademyBlockRenderer } from '@/components/academy/lesson/academy-block-renderer'
import { LessonProgressBar } from '@/components/academy/lesson/academy-lesson-progress-bar'
import { LessonNavigation } from '@/components/academy/lesson/academy-lesson-navigation'
import {
  LessonSidebar,
  LessonSidebarBackdrop,
  type SidebarBlock,
} from '@/components/academy/lesson/academy-lesson-sidebar'
import {
  completeLessonBlock,
  fetchAcademyLesson,
  fetchAcademyLessonAttempt,
  fetchAcademyPlan,
  startLesson,
} from '@/lib/academy-v3/client'

type LessonData = Awaited<ReturnType<typeof fetchAcademyLesson>>
type PlanData = Awaited<ReturnType<typeof fetchAcademyPlan>>

export function AcademyLessonViewer({
  lessonId,
  resume = false,
}: {
  lessonId: string
  resume?: boolean
}) {
  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [completedBlockIds, setCompletedBlockIds] = useState<Set<string>>(new Set())
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        const [lessonData, planData, attemptData] = await Promise.all([
          fetchAcademyLesson(lessonId),
          fetchAcademyPlan(),
          fetchAcademyLessonAttempt(lessonId),
        ])
        if (!active) return

        setLesson(lessonData)
        setPlan(planData)
        const completedSet = new Set(attemptData.completedBlockIds)
        setCompletedBlockIds(completedSet)

        if (resume) {
          const firstIncompleteIndex = lessonData.blocks.findIndex(
            (block) => !completedSet.has(block.id)
          )
          if (firstIncompleteIndex >= 0) {
            setCurrentBlockIndex(firstIncompleteIndex)
          } else {
            setCurrentBlockIndex(Math.max(lessonData.blocks.length - 1, 0))
          }
        } else {
          setCurrentBlockIndex(0)
        }

        if (attemptData.status === 'not_started' || attemptData.status === 'failed') {
          void startLesson(lessonId, { source: 'module' }).catch(() => undefined)
        }
      } catch (err: unknown) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load lesson')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [lessonId, resume])

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const context = useMemo(() => {
    if (!plan || !lesson) return null

    for (const track of plan.tracks) {
      for (const moduleItem of track.modules) {
        const lessonIndex = moduleItem.lessons.findIndex((item) => item.id === lesson.id)
        if (lessonIndex >= 0) {
          return {
            trackTitle: track.title,
            moduleSlug: moduleItem.slug,
            moduleTitle: moduleItem.title,
            lessonIndex,
            totalLessons: moduleItem.lessons.length,
            previousLessonId: lessonIndex > 0 ? moduleItem.lessons[lessonIndex - 1]?.id : null,
            nextLessonId:
              lessonIndex + 1 < moduleItem.lessons.length
                ? moduleItem.lessons[lessonIndex + 1]?.id
                : null,
          }
        }
      }
    }

    return null
  }, [plan, lesson])

  const activeBlock = lesson?.blocks[currentBlockIndex] ?? null
  const completedCount = lesson?.blocks.filter((block) => completedBlockIds.has(block.id)).length ?? 0
  const allBlocksComplete = lesson?.blocks.length ? completedCount >= lesson.blocks.length : false
  const totalBlocks = lesson?.blocks.length ?? 0

  // canProceed: the current block is already completed OR the viewer is stepping backward
  const canProceed = activeBlock ? completedBlockIds.has(activeBlock.id) : true

  const sidebarBlocks: SidebarBlock[] = useMemo(
    () =>
      lesson?.blocks.map((block) => ({
        id: block.id,
        blockType: block.blockType,
        title: block.title ?? undefined,
        completed: completedBlockIds.has(block.id),
      })) ?? [],
    [lesson, completedBlockIds]
  )

  const objectives: string[] = useMemo(() => {
    if (!lesson) return []
    return lesson.learningObjective ? [lesson.learningObjective] : []
  }, [lesson])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleNavigate = useCallback(
    (index: number) => {
      if (!lesson) return
      const clamped = Math.max(0, Math.min(lesson.blocks.length - 1, index))
      setCurrentBlockIndex(clamped)
      setNotice(null)
    },
    [lesson]
  )

  const handleBlockSelect = useCallback(
    (blockId: string) => {
      if (!lesson) return
      const index = lesson.blocks.findIndex((b) => b.id === blockId)
      if (index >= 0) {
        setCurrentBlockIndex(index)
        setNotice(null)
        // Auto-close sidebar on mobile after selection
        setSidebarOpen(false)
      }
    },
    [lesson]
  )

  const handleBlockComplete = useCallback(
    async (blockId: string) => {
      if (!lesson) return

      // If already completed, just advance
      if (completedBlockIds.has(blockId)) {
        if (currentBlockIndex < lesson.blocks.length - 1) {
          setCurrentBlockIndex((i) => i + 1)
        }
        return
      }

      setSubmitting(true)
      setNotice(null)

      try {
        const result = await completeLessonBlock(lesson.id, { blockId })

        setCompletedBlockIds((previous) => {
          const next = new Set(previous)
          next.add(blockId)
          return next
        })

        if (result.nextBlockId) {
          const nextIndex = lesson.blocks.findIndex((block) => block.id === result.nextBlockId)
          if (nextIndex >= 0) {
            setCurrentBlockIndex(nextIndex)
          }
        } else {
          setNotice('Lesson complete. Continue to the next lesson when ready.')
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save block completion')
      } finally {
        setSubmitting(false)
      }
    },
    [lesson, completedBlockIds, currentBlockIndex]
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AcademyShell
      title="Lesson Viewer"
      description="Study one block at a time with full-width markdown and structured progression."
      maxWidthClassName="max-w-6xl"
    >
      {loading ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-white/60">
          Loading lesson...
        </div>
      ) : error || !lesson ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">
          {error ?? 'Lesson not found'}
        </div>
      ) : (
        <>
          {/* Progress bar — thin strip at very top of lesson area */}
          <div className="mb-4">
            <LessonProgressBar
              completedBlocks={completedCount}
              totalBlocks={totalBlocks}
              currentBlockIndex={currentBlockIndex}
            />
          </div>

          {/* Breadcrumb + lesson meta */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Link
              href={
                context
                  ? `/members/academy/modules/${context.moduleSlug}`
                  : '/members/academy/modules'
              }
              className="inline-flex items-center gap-1 text-sm text-white/50 transition-colors hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              {context ? context.moduleTitle : 'Back to Modules'}
            </Link>

            <p className="text-xs text-white/40">
              {context
                ? `Lesson ${context.lessonIndex + 1} of ${context.totalLessons}`
                : 'Lesson'}
            </p>
          </div>

          {/* Main layout: sidebar + content */}
          <div className="relative flex gap-4">
            {/* Mobile backdrop */}
            <LessonSidebarBackdrop
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <LessonSidebar
              blocks={sidebarBlocks}
              currentBlockId={activeBlock?.id ?? ''}
              onBlockSelect={handleBlockSelect}
              objectives={objectives}
              estimatedMinutes={lesson.estimatedMinutes}
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen((prev) => !prev)}
            />

            {/* Content column */}
            <div className="min-w-0 flex-1 space-y-4">
              {/* Lesson header card */}
              <section className="glass-card-heavy rounded-xl border border-white/10 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white leading-snug">
                      {lesson.title}
                    </h2>
                    <p className="mt-1.5 text-sm text-white/60">{lesson.learningObjective}</p>
                    {context && (
                      <p className="mt-1 text-xs text-white/35">Track: {context.trackTitle}</p>
                    )}
                  </div>
                  {/* Sidebar toggle (desktop) */}
                  <button
                    type="button"
                    onClick={() => setSidebarOpen((prev) => !prev)}
                    aria-label={sidebarOpen ? 'Close outline' : 'Open outline'}
                    aria-expanded={sidebarOpen}
                    className="hidden shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition-colors hover:border-white/20 hover:text-white md:flex items-center gap-1.5"
                  >
                    Outline
                    <span className="text-white/30">{sidebarOpen ? '–' : '+'}</span>
                  </button>
                </div>
              </section>

              {/* Active block */}
              {activeBlock ? (
                <section className="glass-card-heavy rounded-xl border border-white/10 p-5 space-y-4">
                  <AcademyBlockRenderer
                    block={activeBlock}
                    onComplete={handleBlockComplete}
                    isCompleted={completedBlockIds.has(activeBlock.id)}
                  />
                  {submitting && (
                    <p className="text-xs text-emerald-400/60">Saving progress...</p>
                  )}
                </section>
              ) : (
                <section className="glass-card-heavy rounded-xl border border-white/10 p-5">
                  <p className="text-sm text-white/40">No lesson blocks are available yet.</p>
                </section>
              )}

              {/* Navigation card */}
              <section className="glass-card-heavy rounded-xl border border-white/10 p-4 space-y-4">
                <LessonNavigation
                  currentIndex={currentBlockIndex}
                  totalBlocks={totalBlocks}
                  onNavigate={handleNavigate}
                  canProceed={canProceed}
                />

                {/* Status messages */}
                {notice && (
                  <p className="text-center text-xs text-emerald-400">{notice}</p>
                )}

                {/* Next lesson CTA */}
                {allBlocksComplete && context?.nextLessonId && (
                  <div className="flex justify-center">
                    <Link
                      href={`/members/academy/lessons/${context.nextLessonId}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
                    >
                      Continue to next lesson
                      <ChevronLeft className="h-4 w-4 rotate-180" strokeWidth={1.5} />
                    </Link>
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </AcademyShell>
  )
}
