'use client'

import { useState, useCallback } from 'react'
import { Check, X, RotateCcw, ChevronLeft, ChevronRight, FlipVertical } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Flashcard {
  id: string
  front: string
  back: string
}

interface FlashcardDeckConfig {
  title: string
  instructions: string
  cards: Flashcard[]
}

interface FlashcardDeckProps {
  config: FlashcardDeckConfig
  onSubmit: (answer: Array<{ cardId: string; correct: boolean }>) => void
  disabled?: boolean
  result?: {
    score: number
    maxScore: number
    feedback: string
    isCorrect: boolean
  } | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AcademyFlashcardDeck({
  config,
  onSubmit,
  disabled = false,
  result = null,
}: FlashcardDeckProps) {
  const { title, instructions, cards } = config
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [selfGrades, setSelfGrades] = useState<Record<string, boolean>>({})

  const currentCard = cards[currentIndex]
  const totalCards = cards.length
  const gradedCount = Object.keys(selfGrades).length

  const handleFlip = useCallback(() => {
    if (!disabled) setFlipped((prev) => !prev)
  }, [disabled])

  const handleGrade = (correct: boolean) => {
    if (!currentCard || disabled) return
    setSelfGrades((prev) => ({ ...prev, [currentCard.id]: correct }))
    setFlipped(false)
    // Auto-advance
    if (currentIndex < totalCards - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
      setFlipped(false)
    }
  }

  const handleNext = () => {
    if (currentIndex < totalCards - 1) {
      setCurrentIndex((prev) => prev + 1)
      setFlipped(false)
    }
  }

  const handleSubmit = () => {
    const results = cards.map((card) => ({
      cardId: card.id,
      correct: selfGrades[card.id] ?? false,
    }))
    onSubmit(results)
  }

  const handleReset = () => {
    setSelfGrades({})
    setCurrentIndex(0)
    setFlipped(false)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/50 mt-0.5">
          Card {currentIndex + 1} of {totalCards}
        </p>
      </div>

      <p className="text-sm text-white/70 leading-relaxed">{instructions}</p>

      {/* Progress */}
      <div className="flex items-center gap-1.5">
        {cards.map((card, idx) => (
          <div
            key={card.id}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              selfGrades[card.id] === true
                ? 'bg-emerald-500'
                : selfGrades[card.id] === false
                  ? 'bg-rose-500'
                  : idx === currentIndex
                    ? 'bg-white/30'
                    : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      {/* Card */}
      {currentCard && (
        <button
          onClick={handleFlip}
          disabled={disabled}
          className="w-full min-h-[200px] rounded-xl border border-white/10 bg-white/[0.03] p-8 flex flex-col items-center justify-center text-center transition-all hover:bg-white/[0.06] cursor-pointer"
        >
          <p className="text-xs text-white/30 uppercase tracking-wide mb-3">
            {flipped ? 'Answer' : 'Question'}
          </p>
          <p className={`text-lg leading-relaxed ${flipped ? 'text-emerald-300' : 'text-white'}`}>
            {flipped ? currentCard.back : currentCard.front}
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-white/30">
            <FlipVertical className="h-3 w-3" strokeWidth={1.5} />
            Click to flip
          </div>
        </button>
      )}

      {/* Self-grade buttons (only visible when flipped) */}
      {flipped && !disabled && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => handleGrade(false)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium transition-all hover:bg-rose-500/20"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
            Incorrect
          </button>
          <button
            onClick={() => handleGrade(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium transition-all hover:bg-emerald-500/20"
          >
            <Check className="h-4 w-4" strokeWidth={1.5} />
            Correct
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={disabled || currentIndex === 0}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-white/50 text-sm transition-all hover:bg-white/5 hover:text-white/80 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          Previous
        </button>
        <span className="text-xs text-white/40 font-mono">
          {gradedCount}/{totalCards} graded
        </span>
        <button
          onClick={handleNext}
          disabled={disabled || currentIndex === totalCards - 1}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-white/50 text-sm transition-all hover:bg-white/5 hover:text-white/80 disabled:opacity-30"
        >
          Next
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Result Feedback */}
      {result && (
        <div
          className={`flex items-start gap-3 rounded-lg p-4 border ${
            result.isCorrect
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {result.isCorrect ? (
            <Check className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} />
          ) : (
            <X className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} />
          )}
          <p className="text-sm">{result.feedback}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={disabled || gradedCount < totalCards}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Results
        </button>
        <button
          onClick={handleReset}
          disabled={disabled}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm transition-all hover:bg-white/5 hover:text-white/80 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          Start Over
        </button>
      </div>
    </div>
  )
}
