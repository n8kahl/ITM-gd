'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AcademyMarkdown } from '@/components/academy-v3/shared/academy-markdown'
import { AcademyCard, AcademyShell } from '@/components/academy/academy-shell'
import { getBlockMarkdown, resolveBlockImage, resolveLessonImage } from '@/components/academy/academy-media'
import {
  completeLessonBlock,
  fetchAcademyLesson,
  fetchAcademyLessonAttempt,
  fetchAcademyPlan,
  startLesson,
} from '@/lib/academy-v3/client'

type LessonData = Awaited<ReturnType<typeof fetchAcademyLesson>>
type PlanData = Awaited<ReturnType<typeof fetchAcademyPlan>>

function formatBlockTypeLabel(blockType: string): string {
  return blockType.replaceAll('_', ' ')
}

const BLOCK_TYPE_CLASSNAMES: Record<string, string> = {
  hook: 'text-emerald-300 border-emerald-500/35 bg-emerald-500/10',
  concept_explanation: 'text-emerald-300 border-emerald-500/35 bg-emerald-500/10',
  worked_example: 'text-amber-200 border-amber-300/30 bg-amber-300/10',
  guided_practice: 'text-sky-200 border-sky-300/30 bg-sky-300/10',
  independent_practice: 'text-fuchsia-200 border-fuchsia-300/30 bg-fuchsia-300/10',
  reflection: 'text-zinc-200 border-white/20 bg-white/5',
}

export function AcademyLessonViewer({ lessonId }: { lessonId: string }) {
  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [completedBlockIds, setCompletedBlockIds] = useState<Set<string>>(new Set())
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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

        const firstIncompleteIndex = lessonData.blocks.findIndex((block) => !completedSet.has(block.id))
        if (firstIncompleteIndex >= 0) {
          setCurrentBlockIndex(firstIncompleteIndex)
        } else {
          setCurrentBlockIndex(Math.max(lessonData.blocks.length - 1, 0))
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
  }, [lessonId])

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
            nextLessonId: lessonIndex + 1 < moduleItem.lessons.length ? moduleItem.lessons[lessonIndex + 1]?.id : null,
          }
        }
      }
    }

    return null
  }, [plan, lesson])

  const activeBlock = lesson?.blocks[currentBlockIndex] || null
  const completedCount = lesson?.blocks.filter((block) => completedBlockIds.has(block.id)).length || 0
  const allBlocksComplete = lesson?.blocks.length ? completedCount >= lesson.blocks.length : false

  async function handleCompleteAndContinue() {
    if (!lesson || !activeBlock) return

    if (completedBlockIds.has(activeBlock.id)) {
      if (currentBlockIndex < lesson.blocks.length - 1) {
        setCurrentBlockIndex((index) => index + 1)
      }
      return
    }

    setSubmitting(true)
    setNotice(null)

    try {
      const result = await completeLessonBlock(lesson.id, { blockId: activeBlock.id })

      setCompletedBlockIds((previous) => {
        const next = new Set(previous)
        next.add(activeBlock.id)
        return next
      })

      if (result.nextBlockId) {
        const nextIndex = lesson.blocks.findIndex((block) => block.id === result.nextBlockId)
        if (nextIndex >= 0) {
          setCurrentBlockIndex(nextIndex)
        }
      } else {
        setNotice('Lesson completed. Continue to the next lesson when ready.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save block completion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AcademyShell
      title="Lesson Viewer"
      description="Study one block at a time with full-width markdown and structured progression."
      maxWidthClassName="max-w-5xl"
    >
      {loading ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-zinc-300">Loading lesson...</div>
      ) : error || !lesson ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">{error || 'Lesson not found'}</div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={context ? `/members/academy/modules/${context.moduleSlug}` : '/members/academy/modules'}
              className="inline-flex items-center gap-1 text-sm text-zinc-300 transition-colors hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              {context ? context.moduleTitle : 'Back to Modules'}
            </Link>

            <p className="text-xs text-zinc-400">
              {context ? `Lesson ${context.lessonIndex + 1} of ${context.totalLessons}` : 'Lesson'}
            </p>
          </div>

          <AcademyCard className="space-y-4 p-5">
            <div>
              <h2 className="text-xl font-semibold text-white">{lesson.title}</h2>
              <p className="mt-2 text-sm text-zinc-300">{lesson.learningObjective}</p>
              {context ? <p className="mt-2 text-xs text-zinc-400">Track: {context.trackTitle}</p> : null}
            </div>

            {activeBlock ? (
              <div className="space-y-4">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                    BLOCK_TYPE_CLASSNAMES[activeBlock.blockType] || BLOCK_TYPE_CLASSNAMES.hook
                  }`}
                >
                  {formatBlockTypeLabel(activeBlock.blockType)}
                </span>

                {activeBlock.title ? <h3 className="text-lg font-semibold text-white">{activeBlock.title}</h3> : null}

                <div className="relative h-52 overflow-hidden rounded-lg border border-white/10 bg-[#0f1117]">
                  <Image
                    src={resolveBlockImage(activeBlock, resolveLessonImage(lesson))}
                    alt={activeBlock.title || lesson.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 768px"
                  />
                </div>

                <div className="prose prose-invert max-w-none text-zinc-100">
                  <AcademyMarkdown>{getBlockMarkdown(activeBlock.contentJson)}</AcademyMarkdown>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No lesson blocks are available yet.</p>
            )}
          </AcademyCard>

          <AcademyCard>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-400">
                Block Progress: {completedCount} of {lesson.blocks.length} completed
              </p>
              <div className="flex items-center gap-1.5" aria-label="Block progress dots">
                {lesson.blocks.map((block, index) => (
                  <span
                    key={block.id}
                    className={`h-2.5 w-2.5 rounded-full ${
                      completedBlockIds.has(block.id)
                        ? 'bg-emerald-400'
                        : index === currentBlockIndex
                          ? 'bg-zinc-300'
                          : 'bg-white/15'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setCurrentBlockIndex((index) => Math.max(0, index - 1))}
                disabled={currentBlockIndex === 0}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={handleCompleteAndContinue}
                disabled={!activeBlock || submitting}
                className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Saving...' : 'Complete & Continue'}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!lesson.blocks.length) return
                  setCurrentBlockIndex((index) => Math.min(lesson.blocks.length - 1, index + 1))
                }}
                disabled={!lesson.blocks.length || currentBlockIndex >= lesson.blocks.length - 1}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>

            {notice ? <p className="mt-3 text-xs text-emerald-300">{notice}</p> : null}
            {allBlocksComplete && context?.nextLessonId ? (
              <Link
                href={`/members/academy/lessons/${context.nextLessonId}`}
                className="mt-3 inline-flex text-xs text-emerald-300 hover:text-emerald-200"
              >
                Continue to next lesson
              </Link>
            ) : null}
          </AcademyCard>
        </div>
      )}
    </AcademyShell>
  )
}
