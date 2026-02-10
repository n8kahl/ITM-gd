'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Trophy, RotateCcw, ArrowRight, CheckCircle2 } from 'lucide-react'
import { QuizQuestion, type QuizQuestionData } from '@/components/academy/quiz-question'

interface QuizEngineProps {
  questions: QuizQuestionData[]
  title?: string
  passingScore?: number
  onComplete?: (score: number, total: number, passed: boolean) => void
  className?: string
}

type QuizState = 'in-progress' | 'completed'

export function QuizEngine({
  questions,
  title = 'Knowledge Check',
  passingScore = 70,
  onComplete,
  className,
}: QuizEngineProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, boolean>>({})
  const [quizState, setQuizState] = useState<QuizState>('in-progress')

  const totalQuestions = questions.length
  const currentQuestion = questions[currentIndex]

  const score = useMemo(() => {
    const correct = Object.values(answers).filter(Boolean).length
    return {
      correct,
      total: totalQuestions,
      percentage: totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0,
    }
  }, [answers, totalQuestions])

  const handleAnswer = useCallback(
    (optionId: string, isCorrect: boolean) => {
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: isCorrect,
      }))
    },
    [currentQuestion]
  )

  const handleNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setQuizState('completed')
      const correct = Object.values({
        ...answers,
      }).filter(Boolean).length
      const pct = Math.round((correct / totalQuestions) * 100)
      onComplete?.(correct, totalQuestions, pct >= passingScore)
    }
  }, [currentIndex, totalQuestions, answers, onComplete, passingScore])

  const handleRetry = useCallback(() => {
    setCurrentIndex(0)
    setAnswers({})
    setQuizState('in-progress')
  }, [])

  const isCurrentAnswered = currentQuestion ? currentQuestion.id in answers : false

  if (quizState === 'completed') {
    const passed = score.percentage >= passingScore

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'rounded-xl p-6 text-center space-y-4',
          'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5',
          className
        )}
      >
        <div
          className={cn(
            'w-16 h-16 rounded-full mx-auto flex items-center justify-center',
            passed ? 'bg-emerald-500/20' : 'bg-amber-500/20'
          )}
        >
          {passed ? (
            <Trophy className="w-8 h-8 text-emerald-400" />
          ) : (
            <RotateCcw className="w-8 h-8 text-amber-400" />
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white">
            {passed ? 'Quiz Passed!' : 'Almost There!'}
          </h3>
          <p className="text-sm text-white/60 mt-1">
            You scored {score.correct} out of {score.total} ({score.percentage}%)
          </p>
        </div>

        {/* Score bar */}
        <div className="max-w-xs mx-auto space-y-1">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score.percentage}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                passed ? 'bg-emerald-500' : 'bg-amber-500'
              )}
            />
          </div>
          <p className="text-[11px] text-white/40">
            Passing score: {passingScore}%
          </p>
        </div>

        {!passed && (
          <button
            onClick={handleRetry}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'bg-white/5 border border-white/10 text-white',
              'hover:bg-white/10 hover:border-white/20 transition-all'
            )}
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl p-5 space-y-5',
        'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5',
        className
      )}
    >
      {/* Quiz header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          {title}
        </h3>
        <span className="text-xs text-white/40 font-mono tabular-nums">
          {currentIndex + 1}/{totalQuestions}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${((currentIndex + (isCurrentAnswered ? 1 : 0)) / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Current question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <QuizQuestion
            data={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={totalQuestions}
            onAnswer={handleAnswer}
          />
        </motion.div>
      </AnimatePresence>

      {/* Next button */}
      {isCurrentAnswered && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end"
        >
          <button
            onClick={handleNext}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'bg-[rgb(var(--emerald-elite))]/20 hover:bg-[rgb(var(--emerald-elite))]/30',
              'border border-emerald-500/30 hover:border-emerald-500/50',
              'text-emerald-400 transition-all duration-200'
            )}
          >
            {currentIndex < totalQuestions - 1 ? 'Next Question' : 'See Results'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  )
}
