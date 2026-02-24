'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, X, Timer, Play, Square } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChallengeQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
}

interface TimedChallengeConfig {
  title: string
  instructions: string
  timeLimitSeconds: number
  questions: ChallengeQuestion[]
}

interface TimedChallengeProps {
  config: TimedChallengeConfig
  onSubmit: (answer: { answers: string[]; timeTakenMs: number }) => void
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

export function AcademyTimedChallenge({
  config,
  onSubmit,
  disabled = false,
  result = null,
}: TimedChallengeProps) {
  const { title, instructions, timeLimitSeconds, questions } = config
  const [started, setStarted] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<string[]>(new Array(questions.length).fill(''))
  const [elapsedMs, setElapsedMs] = useState(0)
  const [finished, setFinished] = useState(false)
  const startTimeRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const remainingSeconds = Math.max(0, timeLimitSeconds - Math.floor(elapsedMs / 1000))
  const isTimerCritical = remainingSeconds <= 10

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const handleStart = () => {
    setStarted(true)
    startTimeRef.current = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      setElapsedMs(elapsed)
      if (elapsed >= timeLimitSeconds * 1000) {
        stopTimer()
        setFinished(true)
      }
    }, 100)
  }

  const handleAnswer = (optionText: string) => {
    if (disabled || finished) return
    const newAnswers = [...answers]
    newAnswers[currentQuestion] = optionText
    setAnswers(newAnswers)

    // Auto-advance
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1)
    }
  }

  const handleFinish = () => {
    stopTimer()
    setFinished(true)
    const totalTime = Date.now() - startTimeRef.current
    onSubmit({ answers, timeTakenMs: totalTime })
  }

  // Auto-submit on time expiry
  useEffect(() => {
    if (finished && started) {
      const totalTime = Math.min(elapsedMs, timeLimitSeconds * 1000)
      onSubmit({ answers, timeTakenMs: totalTime })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  useEffect(() => {
    return () => stopTimer()
  }, [stopTimer])

  const answeredCount = answers.filter((a) => a !== '').length
  const q = questions[currentQuestion]

  // Format time display
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Timer className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm text-white/50 mt-0.5">
              {questions.length} questions &middot; {formatTime(timeLimitSeconds)} time limit
            </p>
          </div>
        </div>
        {started && (
          <div
            className={`px-3 py-1.5 rounded-lg font-mono text-lg font-bold ${
              isTimerCritical
                ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20 animate-pulse'
                : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
            }`}
          >
            {formatTime(remainingSeconds)}
          </div>
        )}
      </div>

      <p className="text-sm text-white/70 leading-relaxed">{instructions}</p>

      {/* Pre-start state */}
      {!started && !finished && (
        <div className="rounded-lg border border-dashed border-white/10 p-8 text-center space-y-4">
          <p className="text-white/60 text-sm">
            You have {formatTime(timeLimitSeconds)} to answer {questions.length} questions.
            Answer as quickly and accurately as possible for bonus points.
          </p>
          <button
            onClick={handleStart}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 text-white text-sm font-medium transition-all hover:bg-emerald-500 disabled:opacity-40"
          >
            <Play className="h-4 w-4" strokeWidth={1.5} />
            Start Challenge
          </button>
        </div>
      )}

      {/* Active challenge */}
      {started && !finished && q && (
        <>
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`h-2 flex-1 rounded-full transition-all ${
                  answers[idx]
                    ? 'bg-emerald-500'
                    : idx === currentQuestion
                      ? 'bg-white/40'
                      : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Question */}
          <div className="space-y-3">
            <p className="text-xs text-white/40">
              Question {currentQuestion + 1} of {questions.length}
            </p>
            <p className="text-white text-base font-medium leading-relaxed">{q.question}</p>
            <div className="space-y-2">
              {q.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(option)}
                  className={`w-full text-left rounded-lg p-3 border transition-all ${
                    answers[currentQuestion] === option
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-white/80 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <span className="text-sm">{option}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-white/40">
              {answeredCount}/{questions.length} answered
            </span>
            <button
              onClick={handleFinish}
              disabled={answeredCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm transition-all hover:bg-white/10 disabled:opacity-40"
            >
              <Square className="h-3.5 w-3.5" strokeWidth={1.5} />
              Finish Early
            </button>
          </div>
        </>
      )}

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
          <div>
            <p className="text-sm font-medium">
              {result.score}/{result.maxScore} points
            </p>
            <p className="text-sm opacity-80 mt-1">{result.feedback}</p>
          </div>
        </div>
      )}
    </div>
  )
}
