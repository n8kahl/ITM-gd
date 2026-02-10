'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'

export interface QuizOption {
  id: string
  text: string
}

export interface QuizQuestionData {
  id: string
  question: string
  options: QuizOption[]
  correctOptionId: string
  explanation?: string
}

interface QuizQuestionProps {
  data: QuizQuestionData
  questionNumber: number
  totalQuestions: number
  onAnswer: (optionId: string, isCorrect: boolean) => void
  disabled?: boolean
  className?: string
}

export function QuizQuestion({
  data,
  questionNumber,
  totalQuestions,
  onAnswer,
  disabled = false,
  className,
}: QuizQuestionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const handleSelect = useCallback(
    (optionId: string) => {
      if (revealed || disabled) return
      setSelectedId(optionId)
      setRevealed(true)
      const isCorrect = optionId === data.correctOptionId
      onAnswer(optionId, isCorrect)
    },
    [revealed, disabled, data.correctOptionId, onAnswer]
  )

  const getOptionState = (optionId: string) => {
    if (!revealed) return 'idle'
    if (optionId === data.correctOptionId) return 'correct'
    if (optionId === selectedId) return 'incorrect'
    return 'dimmed'
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Question header */}
      <div className="space-y-2">
        <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
          Question {questionNumber} of {totalQuestions}
        </p>
        <h3 className="text-base font-semibold text-white leading-relaxed">
          {data.question}
        </h3>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {data.options.map((option, index) => {
          const state = getOptionState(option.id)
          const letter = String.fromCharCode(65 + index) // A, B, C, D

          return (
            <motion.button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              disabled={revealed || disabled}
              whileHover={!revealed && !disabled ? { scale: 1.01 } : undefined}
              whileTap={!revealed && !disabled ? { scale: 0.99 } : undefined}
              className={cn(
                'w-full text-left px-4 py-3 rounded-lg border transition-all duration-200',
                'flex items-center gap-3',
                state === 'idle' && 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]',
                state === 'correct' && 'bg-emerald-500/10 border-emerald-500/40',
                state === 'incorrect' && 'bg-rose-500/10 border-rose-500/40',
                state === 'dimmed' && 'bg-white/[0.02] border-white/5 opacity-50',
                (revealed || disabled) && 'cursor-default'
              )}
            >
              {/* Letter badge */}
              <span
                className={cn(
                  'w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold shrink-0',
                  state === 'idle' && 'bg-white/10 text-white/60',
                  state === 'correct' && 'bg-emerald-500/20 text-emerald-400',
                  state === 'incorrect' && 'bg-rose-500/20 text-rose-400',
                  state === 'dimmed' && 'bg-white/5 text-white/30'
                )}
              >
                {state === 'correct' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : state === 'incorrect' ? (
                  <X className="w-3.5 h-3.5" />
                ) : (
                  letter
                )}
              </span>

              {/* Option text */}
              <span
                className={cn(
                  'text-sm',
                  state === 'idle' && 'text-white/80',
                  state === 'correct' && 'text-emerald-300',
                  state === 'incorrect' && 'text-rose-300',
                  state === 'dimmed' && 'text-white/40'
                )}
              >
                {option.text}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Explanation */}
      {revealed && data.explanation && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-white/5 border border-white/10"
        >
          <p className="text-xs text-white/60 leading-relaxed">
            <span className="font-semibold text-white/70">Explanation: </span>
            {data.explanation}
          </p>
        </motion.div>
      )}
    </div>
  )
}
