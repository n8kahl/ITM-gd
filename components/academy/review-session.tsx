'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ReviewQueueItem {
  id: string
  competency_key: string
  question_data: unknown
  lesson_title?: string | null
  course_title?: string | null
  due_at?: string
}

export interface ReviewSessionSummary {
  reviewedCount: number
  correctCount: number
  improvedCompetencies: string[]
  nextReviewAt: string | null
}

interface ReviewSessionProps {
  items: ReviewQueueItem[]
  onComplete?: (summary: ReviewSessionSummary) => void
  className?: string
}

interface NormalizedQuestion {
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

function normalizeQuestion(questionData: unknown): NormalizedQuestion {
  const fallback: NormalizedQuestion = {
    prompt: 'Review prompt unavailable for this item.',
    options: ['Continue'],
    correctIndex: 0,
    explanation: 'No additional explanation available.',
  }

  if (!questionData || typeof questionData !== 'object') {
    return fallback
  }

  const data = questionData as Record<string, unknown>
  const prompt =
    (typeof data.question === 'string' && data.question) ||
    (typeof data.text === 'string' && data.text) ||
    fallback.prompt

  let options: string[] = []
  if (Array.isArray(data.options)) {
    options = data.options
      .map((option) => {
        if (typeof option === 'string') return option
        if (option && typeof option === 'object' && typeof (option as { text?: unknown }).text === 'string') {
          return (option as { text: string }).text
        }
        return null
      })
      .filter((option): option is string => Boolean(option))
  }

  if (options.length === 0) {
    options = fallback.options
  }

  let correctIndex = 0
  if (typeof data.correct_index === 'number' && Number.isFinite(data.correct_index)) {
    correctIndex = Math.max(0, Math.min(options.length - 1, Math.round(data.correct_index)))
  } else if (typeof data.correct_answer === 'string' && Array.isArray(data.options)) {
    const index = data.options.findIndex((option) => {
      if (!option || typeof option !== 'object') return false
      return (option as { id?: unknown }).id === data.correct_answer
    })
    if (index >= 0) {
      correctIndex = index
    }
  }

  const explanation =
    (typeof data.explanation === 'string' && data.explanation) ||
    fallback.explanation

  return {
    prompt,
    options,
    correctIndex,
    explanation,
  }
}

export function ReviewSession({
  items,
  onComplete,
  className,
}: ReviewSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [confidence, setConfidence] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now())
  const [results, setResults] = useState<
    Array<{ competency: string; isCorrect: boolean; nextDueAt: string | null }>
  >([])

  const currentItem = items[currentIndex] || null
  const question = useMemo(
    () => normalizeQuestion(currentItem?.question_data),
    [currentItem?.question_data]
  )
  const isLastItem = currentIndex >= items.length - 1
  const isCorrect = selectedOptionIndex !== null && selectedOptionIndex === question.correctIndex
  const progressPercent = items.length > 0 ? Math.round((currentIndex / items.length) * 100) : 0

  useEffect(() => {
    setQuestionStartedAt(Date.now())
  }, [currentIndex])

  const completeSession = (nextResults: Array<{ competency: string; isCorrect: boolean; nextDueAt: string | null }>) => {
    const reviewedCount = nextResults.length
    const correctCount = nextResults.filter((result) => result.isCorrect).length
    const improvedCompetencies = Array.from(
      new Set(
        nextResults
          .filter((result) => result.isCorrect)
          .map((result) => result.competency)
      )
    )
    const nextReviewAt = nextResults
      .map((result) => result.nextDueAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] || null

    onComplete?.({
      reviewedCount,
      correctCount,
      improvedCompetencies,
      nextReviewAt,
    })
  }

  const moveToNext = async () => {
    if (!currentItem || selectedOptionIndex === null) return
    if (!showFeedback) {
      setShowFeedback(true)
      return
    }

    setSubmitting(true)
    setError(null)

    const latencyMs = Math.max(100, Date.now() - questionStartedAt)
    let nextDueAt: string | null = null

    try {
      const response = await fetch('/api/academy/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queue_item_id: currentItem.id,
          answer_data: {
            selected_index: selectedOptionIndex,
            selected_option: question.options[selectedOptionIndex] || null,
          },
          is_correct: isCorrect,
          confidence,
          latency_ms: latencyMs,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'Failed to submit review attempt')
      }

      const payload = await response.json()
      nextDueAt = typeof payload?.data?.next_due_at === 'string' ? payload.data.next_due_at : null
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : 'Submission failed'
      setError(message)
      setSubmitting(false)
      return
    }

    const nextResults = [
      ...results,
      {
        competency: currentItem.competency_key,
        isCorrect,
        nextDueAt,
      },
    ]
    setResults(nextResults)

    if (isLastItem) {
      completeSession(nextResults)
      setSubmitting(false)
      return
    }

    setCurrentIndex((value) => value + 1)
    setSelectedOptionIndex(null)
    setShowFeedback(false)
    setConfidence(3)
    setSubmitting(false)
  }

  if (!currentItem) {
    return (
      <div className={cn('glass-card-heavy rounded-xl border border-white/10 p-5', className)}>
        <p className="text-sm text-white/70">No review items are available right now.</p>
      </div>
    )
  }

  return (
    <section className={cn('glass-card-heavy rounded-xl border border-white/10 p-5', className)}>
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-xs text-white/55">
          <p>
            Item {currentIndex + 1} of {items.length}
          </p>
          <p>{Math.max(items.length - currentIndex - 1, 0)} remaining</p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-300">
          {currentItem.competency_key.replace(/_/g, ' ')}
        </p>
        <h2 className="mt-1 text-base font-semibold text-white">{question.prompt}</h2>
        <p className="mt-1 text-xs text-white/50">
          {(currentItem.course_title || 'Academy')} • {(currentItem.lesson_title || 'Lesson Drill')}
        </p>

        <div className="mt-4 grid gap-2">
          {question.options.map((option, optionIndex) => {
            const selected = selectedOptionIndex === optionIndex
            const showCorrect = showFeedback && optionIndex === question.correctIndex
            const showIncorrect = showFeedback && selected && optionIndex !== question.correctIndex

            return (
              <button
                key={`${currentItem.id}-option-${optionIndex}`}
                type="button"
                onClick={() => !showFeedback && setSelectedOptionIndex(optionIndex)}
                disabled={showFeedback}
                className={cn(
                  'min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  'border-white/15 bg-white/[0.02] text-white/80 hover:bg-white/[0.05]',
                  selected && !showFeedback && 'border-emerald-500/45 bg-emerald-500/12',
                  showCorrect && 'border-emerald-500/60 bg-emerald-500/18 text-emerald-100',
                  showIncorrect && 'border-red-500/45 bg-red-500/10 text-red-100',
                  showFeedback && !selected && 'opacity-80'
                )}
              >
                {option}
              </button>
            )
          })}
        </div>

        {showFeedback && (
          <div className="mt-4 space-y-3">
            <div
              className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                isCorrect
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
                  : 'border-red-500/35 bg-red-500/10 text-red-100'
              )}
            >
              <div className="mb-1 flex items-center gap-2 font-medium">
                {isCorrect ? (
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
              <p className="text-white/85">{question.explanation}</p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[11px] uppercase tracking-[0.1em] text-white/55">
                Confidence
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs text-white/55">1</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={confidence}
                  onChange={(event) => setConfidence(Number(event.target.value))}
                  className="w-full accent-emerald-500"
                />
                <span className="text-xs text-white/55">5</span>
                <span className="w-7 text-center text-sm font-semibold text-champagne tabular-nums">
                  {confidence}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-300">{error}</p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={moveToNext}
          disabled={selectedOptionIndex === null || submitting}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
            selectedOptionIndex !== null && !submitting
              ? 'border-emerald-500/45 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
              : 'cursor-not-allowed border-white/15 bg-white/[0.03] text-white/40'
          )}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {showFeedback ? (isLastItem ? 'Finish Session' : 'Submit & Next') : 'Check Answer'}
        </button>
      </div>
    </section>
  )
}
