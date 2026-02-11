/**
 * File: components/academy/lesson-chunk-renderer.tsx
 * Created: 2026-02-10
 * Purpose: Render chunk-based lesson content with progress dots, quick checks,
 *          drill/reflection interactions, and keyboard/swipe navigation.
 */
'use client'

import { useCallback, useEffect, useMemo, useState, type TouchEvent } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  PenLine,
  PlayCircle,
  Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChunkProgressDots } from '@/components/academy/chunk-progress-dots'
import { INTERACTIVE_REGISTRY, isInteractiveComponentId } from '@/components/academy/interactive'
import { AnnotatedChartRenderer } from '@/components/academy/annotated-chart-renderer'
import { ScenarioWalkthroughRenderer } from '@/components/academy/scenario-walkthrough-renderer'

const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })
const remarkGfm = import('remark-gfm').then((module) => module.default)

export interface QuickCheckData {
  question: string
  options: string[]
  correct_index: number
  explanation: string
}

export interface LessonChunk {
  id: string
  title: string
  content_type:
    | 'video'
    | 'rich_text'
    | 'interactive'
    | 'annotated_chart'
    | 'scenario_walkthrough'
    | 'quick_check'
    | 'applied_drill'
    | 'reflection'
  content: string
  duration_minutes: number
  order_index: number
  quick_check?: QuickCheckData
}

interface LessonChunkRendererProps {
  chunks: LessonChunk[]
  currentChunkIndex: number
  onChunkComplete: (index: number) => void
  onNavigate: (direction: 'prev' | 'next') => void
  lessonId: string
  className?: string
}

function extractEmbedUrl(content: string): string | null {
  if (!content) return null
  const youtubeMatch = content.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/
  )
  if (youtubeMatch?.[1]) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0&modestbranding=1`
  }
  if (content.startsWith('http://') || content.startsWith('https://')) {
    return content
  }
  return null
}

function parseQuickCheck(chunk: LessonChunk): QuickCheckData | null {
  if (chunk.quick_check) {
    return chunk.quick_check
  }

  if (chunk.content_type !== 'quick_check' || !chunk.content) {
    return null
  }

  try {
    const parsed = JSON.parse(chunk.content) as QuickCheckData
    if (
      typeof parsed.question === 'string' &&
      Array.isArray(parsed.options) &&
      typeof parsed.correct_index === 'number'
    ) {
      return parsed
    }
  } catch {
    // Ignore invalid quick-check payloads.
  }

  return null
}

export function LessonChunkRenderer({
  chunks,
  currentChunkIndex,
  onChunkComplete,
  onNavigate,
  lessonId,
  className,
}: LessonChunkRendererProps) {
  const [remarkPlugins, setRemarkPlugins] = useState<any[]>([])
  const [completedChunkIndexes, setCompletedChunkIndexes] = useState<number[]>([])
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [reflectionByChunk, setReflectionByChunk] = useState<Record<number, string>>({})
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  useEffect(() => {
    remarkGfm.then((plugin) => setRemarkPlugins([plugin]))
  }, [])

  const chunk = chunks[currentChunkIndex] || null
  const quickCheck = chunk ? parseQuickCheck(chunk) : null
  const selectedAnswer = selectedAnswers[currentChunkIndex]
  const quickCheckAnswered = typeof selectedAnswer === 'number'
  const quickCheckCorrect = quickCheckAnswered && quickCheck
    ? selectedAnswer === quickCheck.correct_index
    : null
  const nextBlocked =
    chunk?.content_type === 'quick_check' &&
    !!quickCheck &&
    !quickCheckAnswered

  const markChunkComplete = useCallback((index: number) => {
    setCompletedChunkIndexes((previous) =>
      previous.includes(index) ? previous : [...previous, index]
    )
    onChunkComplete(index)
  }, [onChunkComplete])

  const handleDotNavigate = useCallback((targetIndex: number) => {
    if (targetIndex === currentChunkIndex) return
    const direction: 'prev' | 'next' = targetIndex > currentChunkIndex ? 'next' : 'prev'
    const steps = Math.abs(targetIndex - currentChunkIndex)
    for (let step = 0; step < steps; step += 1) {
      onNavigate(direction)
    }
  }, [currentChunkIndex, onNavigate])

  const handlePrev = useCallback(() => {
    onNavigate('prev')
  }, [onNavigate])

  const handleNext = useCallback(() => {
    if (!chunk) return
    if (nextBlocked) return
    markChunkComplete(currentChunkIndex)
    onNavigate('next')
  }, [chunk, currentChunkIndex, markChunkComplete, nextBlocked, onNavigate])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea') {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handlePrev()
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleNext()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleNext, handlePrev])

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null)
  }

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return
    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX
    const deltaX = touchEndX - touchStartX
    if (Math.abs(deltaX) < 40) return
    if (deltaX > 0) handlePrev()
    if (deltaX < 0) handleNext()
    setTouchStartX(null)
  }

  const reflectionValue = reflectionByChunk[currentChunkIndex] || ''
  const journalHref = useMemo(() => {
    const note = reflectionValue.trim()
    if (!note) return '/members/journal'
    return `/members/journal?academy_lesson=${lessonId}&academy_chunk=${chunk?.id || ''}&note=${encodeURIComponent(note)}`
  }, [chunk?.id, lessonId, reflectionValue])

  const renderChunkBody = () => {
    if (!chunk) {
      return (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-5 text-sm text-white/65">
          This chunk is unavailable right now.
        </div>
      )
    }

    if (chunk.content_type === 'video') {
      const embedUrl = extractEmbedUrl(chunk.content)
      return (
        <div className="space-y-4">
          <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-emerald-300">
              <PlayCircle className="h-4 w-4" />
              Video Chunk
            </div>
            {embedUrl ? (
              <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black/40">
                <iframe
                  src={embedUrl}
                  title={chunk.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 text-sm text-white/60">
                Video URL is missing for this chunk.
              </div>
            )}
          </div>
          {chunk.content && (
            <article className="prose prose-invert prose-emerald max-w-none text-sm prose-p:text-white/70">
              <ReactMarkdown remarkPlugins={remarkPlugins}>{chunk.content}</ReactMarkdown>
            </article>
          )}
        </div>
      )
    }

    if (chunk.content_type === 'quick_check') {
      if (!quickCheck) {
        return (
          <div className="glass-card-heavy rounded-xl border border-white/10 p-5 text-sm text-white/65">
            Quick check content is missing for this chunk.
          </div>
        )
      }

      return (
        <div className="glass-card-heavy rounded-xl border border-emerald-500/25 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">Quick Check</p>
          <h3 className="mt-2 text-base font-semibold text-white">{quickCheck.question}</h3>
          <div className="mt-4 grid gap-2">
            {quickCheck.options.map((option, optionIndex) => {
              const selected = selectedAnswer === optionIndex
              const isCorrectOption = optionIndex === quickCheck.correct_index
              const showCorrect = quickCheckAnswered && isCorrectOption
              const showIncorrect = selected && quickCheckAnswered && !isCorrectOption

              return (
                <button
                  key={`${chunk.id}-option-${optionIndex}`}
                  type="button"
                  onClick={() => {
                    setSelectedAnswers((previous) => ({
                      ...previous,
                      [currentChunkIndex]: optionIndex,
                    }))
                    markChunkComplete(currentChunkIndex)
                  }}
                  className={cn(
                    'min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    'border-white/15 bg-white/[0.02] text-white/80 hover:bg-white/[0.05]',
                    selected && 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100',
                    showCorrect && 'border-emerald-500/65 bg-emerald-500/20',
                    showIncorrect && 'border-red-500/45 bg-red-500/10 text-red-200'
                  )}
                >
                  {option}
                </button>
              )
            })}
          </div>

          {quickCheckAnswered && (
            <div
              className={cn(
                'mt-4 rounded-lg border px-3 py-2 text-sm',
                quickCheckCorrect
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
                  : 'border-red-500/35 bg-red-500/10 text-red-100'
              )}
            >
              <div className="mb-1 flex items-center gap-2 font-medium">
                {quickCheckCorrect ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    Correct
                  </>
                ) : (
                  <>
                    <CircleAlert className="h-4 w-4 text-red-300" />
                    Not quite
                  </>
                )}
              </div>
              <p className="text-white/80">{quickCheck.explanation}</p>
            </div>
          )}
        </div>
      )
    }

    if (chunk.content_type === 'applied_drill') {
      return (
        <div className="glass-card-heavy rounded-xl border border-emerald-500/20 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-emerald-300">
            <ClipboardList className="h-4 w-4" />
            Applied Drill
          </div>
          <article className="prose prose-invert prose-emerald max-w-none text-sm prose-p:text-white/75">
            <ReactMarkdown remarkPlugins={remarkPlugins}>{chunk.content || ''}</ReactMarkdown>
          </article>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/members/journal?academy_lesson=${lessonId}&academy_chunk=${chunk.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
            >
              <PenLine className="h-3.5 w-3.5" />
              Open Journal
            </Link>
            <button
              type="button"
              onClick={() => markChunkComplete(currentChunkIndex)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/[0.06]"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark Drill Complete
            </button>
          </div>
        </div>
      )
    }

    if (chunk.content_type === 'reflection') {
      return (
        <div className="glass-card-heavy rounded-xl border border-champagne/30 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-champagne">
            <PenLine className="h-4 w-4" />
            Reflection
          </div>
          {chunk.content && (
            <article className="prose prose-invert prose-emerald max-w-none text-sm prose-p:text-white/75">
              <ReactMarkdown remarkPlugins={remarkPlugins}>{chunk.content}</ReactMarkdown>
            </article>
          )}
          <textarea
            value={reflectionValue}
            onChange={(event) => {
              const value = event.target.value
              setReflectionByChunk((previous) => ({
                ...previous,
                [currentChunkIndex]: value,
              }))
            }}
            placeholder="Write one thing you will apply on your next trade..."
            className="mt-4 min-h-28 w-full rounded-lg border border-white/15 bg-white/[0.02] p-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-emerald-500/45 focus:ring-1 focus:ring-emerald-500/25"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={journalHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
              onClick={() => markChunkComplete(currentChunkIndex)}
            >
              <Save className="h-3.5 w-3.5" />
              Save to Journal
            </Link>
          </div>
        </div>
      )
    }

    /* ── Interactive component (greek-visualizer, options-chain-trainer, position-sizer) ── */
    if (chunk.content_type === 'interactive') {
      let componentId: string | undefined
      try {
        const parsed = JSON.parse(chunk.content || '{}')
        componentId = parsed.component_id
      } catch {
        // Ignore malformed JSON
      }

      if (componentId && isInteractiveComponentId(componentId)) {
        const InteractiveComponent = INTERACTIVE_REGISTRY[componentId]
        return (
          <div className="glass-card-heavy rounded-xl border border-emerald-500/20 p-5">
            <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-emerald-300">
              <PlayCircle className="h-4 w-4" />
              Interactive Tool
            </div>
            <InteractiveComponent />
          </div>
        )
      }

      return (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-5 text-sm text-white/65">
          Interactive component is not available for this chunk.
        </div>
      )
    }

    /* ── Annotated chart ──────────────────────────────────────────── */
    if (chunk.content_type === 'annotated_chart') {
      try {
        const chartData = JSON.parse(chunk.content || '{}')
        return (
          <AnnotatedChartRenderer
            title={chartData.title || chunk.title}
            description={chartData.description}
            data_points={chartData.data_points || []}
            annotations={chartData.annotations || []}
          />
        )
      } catch {
        return (
          <div className="glass-card-heavy rounded-xl border border-white/10 p-5 text-sm text-white/65">
            Chart data is not available for this chunk.
          </div>
        )
      }
    }

    /* ── Scenario walkthrough ─────────────────────────────────────── */
    if (chunk.content_type === 'scenario_walkthrough') {
      try {
        const scenarioData = JSON.parse(chunk.content || '{}')
        return (
          <ScenarioWalkthroughRenderer
            title={scenarioData.title || chunk.title}
            description={scenarioData.description}
            steps={scenarioData.steps || []}
          />
        )
      } catch {
        return (
          <div className="glass-card-heavy rounded-xl border border-white/10 p-5 text-sm text-white/65">
            Scenario data is not available for this chunk.
          </div>
        )
      }
    }

    /* ── Default: rich text / markdown ────────────────────────────── */
    return (
      <article className="prose prose-invert prose-emerald max-w-none text-sm prose-p:text-white/75">
        <ReactMarkdown remarkPlugins={remarkPlugins}>{chunk.content || ''}</ReactMarkdown>
      </article>
    )
  }

  return (
    <div
      className={cn('space-y-4', className)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      data-testid="lesson-chunk-renderer"
    >
      <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-300">
              Chunk {currentChunkIndex + 1} of {chunks.length}
            </p>
            <h2 className="mt-1 text-base font-semibold text-white">
              {chunk?.title || 'Lesson Chunk'}
            </h2>
          </div>
          <div className="text-xs text-white/55">
            {chunk?.duration_minutes ? `${chunk.duration_minutes} min` : 'Self-paced'}
          </div>
        </div>

        <div className="mt-4">
          <ChunkProgressDots
            total={chunks.length}
            current={currentChunkIndex}
            completed={completedChunkIndexes}
            onNavigate={handleDotNavigate}
          />
        </div>
      </div>

      {renderChunkBody()}

      <div className="glass-card-heavy rounded-xl border border-white/10 p-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentChunkIndex <= 0}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
              currentChunkIndex <= 0
                ? 'cursor-not-allowed border-white/10 bg-white/[0.02] text-white/35'
                : 'border-white/20 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]'
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Previous
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={nextBlocked}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
              nextBlocked
                ? 'cursor-not-allowed border-white/15 bg-white/[0.02] text-white/35'
                : 'border-emerald-500/45 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
            )}
          >
            {currentChunkIndex >= chunks.length - 1 ? 'Finish Lesson' : 'Next Chunk'}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {nextBlocked && (
          <p className="mt-2 text-xs text-white/45">
            Answer the quick check to continue.
          </p>
        )}
      </div>
    </div>
  )
}
