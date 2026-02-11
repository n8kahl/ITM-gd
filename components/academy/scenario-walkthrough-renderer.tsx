/**
 * File: components/academy/scenario-walkthrough-renderer.tsx
 * Created: 2026-02-10
 * Purpose: Interactive branching decision trees where students make
 *          sequential trading decisions and see outcomes.
 */
'use client'

import { useState, useCallback } from 'react'
import { GitBranch, RotateCcw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ──────────────────────────────────────────────────────── */

export interface ScenarioChoice {
  label: string
  feedback: string
  next_step_index: number | null
  is_correct: boolean
  is_suboptimal?: boolean
}

export interface ScenarioStep {
  prompt: string
  context?: string
  choices: ScenarioChoice[]
}

export interface ScenarioWalkthroughProps {
  title: string
  description?: string
  steps: ScenarioStep[]
}

interface ChoiceRecord {
  step_index: number
  choice_index: number
  is_correct: boolean
  is_suboptimal: boolean
}

/* ── Component ─────────────────────────────────────────────────── */

export function ScenarioWalkthroughRenderer({
  title,
  description,
  steps,
}: ScenarioWalkthroughProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null)
  const [choiceHistory, setChoiceHistory] = useState<ChoiceRecord[]>([])
  const [completed, setCompleted] = useState(false)

  const step = steps[currentStepIndex]
  const selectedChoice = selectedChoiceIndex !== null ? step?.choices[selectedChoiceIndex] : null

  const correctCount = choiceHistory.filter((c) => c.is_correct).length
  const suboptimalCount = choiceHistory.filter((c) => c.is_suboptimal).length
  const incorrectCount = choiceHistory.filter(
    (c) => !c.is_correct && !c.is_suboptimal
  ).length

  const handleSelectChoice = useCallback(
    (choiceIndex: number) => {
      if (selectedChoiceIndex !== null || !step) return
      const choice = step.choices[choiceIndex]
      if (!choice) return

      setSelectedChoiceIndex(choiceIndex)
      setChoiceHistory((prev) => [
        ...prev,
        {
          step_index: currentStepIndex,
          choice_index: choiceIndex,
          is_correct: choice.is_correct,
          is_suboptimal: choice.is_suboptimal ?? false,
        },
      ])
    },
    [currentStepIndex, selectedChoiceIndex, step]
  )

  const handleContinue = useCallback(() => {
    if (!selectedChoice) return
    if (selectedChoice.next_step_index === null || selectedChoice.next_step_index >= steps.length) {
      setCompleted(true)
      return
    }
    setCurrentStepIndex(selectedChoice.next_step_index)
    setSelectedChoiceIndex(null)
  }, [selectedChoice, steps.length])

  const handleReset = useCallback(() => {
    setCurrentStepIndex(0)
    setSelectedChoiceIndex(null)
    setChoiceHistory([])
    setCompleted(false)
  }, [])

  /* ── Completion summary ────────────────────── */

  if (completed) {
    const totalSteps = choiceHistory.length
    const score = totalSteps > 0 ? Math.round((correctCount / totalSteps) * 100) : 0

    return (
      <div className="glass-card-heavy rounded-xl border border-emerald-500/25 p-5">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-emerald-300">
          <GitBranch className="h-4 w-4" />
          Scenario Complete
        </div>

        <h3 className="text-lg font-semibold text-white">{title}</h3>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-300">{correctCount}</p>
            <p className="mt-0.5 text-xs text-emerald-200/70">Optimal</p>
          </div>
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-center">
            <p className="text-2xl font-bold text-amber-300">{suboptimalCount}</p>
            <p className="mt-0.5 text-xs text-amber-200/70">Sub-optimal</p>
          </div>
          <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-center">
            <p className="text-2xl font-bold text-red-300">{incorrectCount}</p>
            <p className="mt-0.5 text-xs text-red-200/70">Poor</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-white/80">
            {score >= 80
              ? 'Excellent execution. You demonstrated strong decision-making under pressure.'
              : score >= 50
                ? 'Decent effort. Review the sub-optimal choices to sharpen your edge.'
                : 'This scenario exposed gaps in your process. Walk through it again and focus on the feedback at each decision point.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/[0.06]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Replay Scenario
        </button>
      </div>
    )
  }

  /* ── Active step ────────────────────────────── */

  if (!step) {
    return (
      <div className="glass-card-heavy rounded-xl border border-white/10 p-5 text-sm text-white/65">
        Scenario content is unavailable.
      </div>
    )
  }

  return (
    <div className="glass-card-heavy rounded-xl border border-white/10 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-emerald-300">
          <GitBranch className="h-4 w-4" />
          Scenario Walkthrough
        </div>
        <span className="text-xs text-white/45">
          Step {choiceHistory.length + 1}
        </span>
      </div>

      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description && currentStepIndex === 0 && (
        <p className="mt-1 text-sm text-white/60">{description}</p>
      )}

      {/* Situation */}
      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-4">
        {step.context && (
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-champagne/80">
            Situation
          </p>
        )}
        <p className="text-sm leading-relaxed text-white/80">{step.prompt}</p>
        {step.context && (
          <p className="mt-2 text-xs text-white/50">{step.context}</p>
        )}
      </div>

      {/* Choices */}
      <div className="mt-4 grid gap-2">
        {step.choices.map((choice, idx) => {
          const isSelected = selectedChoiceIndex === idx
          const isRevealed = selectedChoiceIndex !== null
          const showCorrect = isRevealed && choice.is_correct
          const showSuboptimal = isRevealed && !choice.is_correct && (choice.is_suboptimal ?? false)
          const showIncorrect = isRevealed && !choice.is_correct && !(choice.is_suboptimal ?? false)

          return (
            <button
              key={`choice-${idx}`}
              type="button"
              onClick={() => handleSelectChoice(idx)}
              disabled={isRevealed}
              className={cn(
                'rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                !isRevealed &&
                  'border-white/15 bg-white/[0.02] text-white/80 hover:border-white/25 hover:bg-white/[0.05]',
                isSelected && showCorrect && 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100',
                isSelected && showSuboptimal && 'border-amber-500/50 bg-amber-500/15 text-amber-100',
                isSelected && showIncorrect && 'border-red-500/45 bg-red-500/10 text-red-200',
                !isSelected && isRevealed && showCorrect && 'border-emerald-500/30 bg-emerald-500/5',
                !isSelected && isRevealed && !showCorrect && 'border-white/8 bg-white/[0.01] text-white/40'
              )}
            >
              <div className="flex items-start gap-2">
                {isRevealed && showCorrect && (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                )}
                {isRevealed && showSuboptimal && (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                )}
                {isRevealed && showIncorrect && (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                )}
                <span>{choice.label}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Feedback */}
      {selectedChoice && (
        <div
          className={cn(
            'mt-4 rounded-lg border px-4 py-3 text-sm',
            selectedChoice.is_correct
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
              : (selectedChoice.is_suboptimal ?? false)
                ? 'border-amber-500/35 bg-amber-500/10 text-amber-100'
                : 'border-red-500/35 bg-red-500/10 text-red-100'
          )}
        >
          <p className="text-white/85">{selectedChoice.feedback}</p>
        </div>
      )}

      {selectedChoice && (
        <button
          type="button"
          onClick={handleContinue}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
        >
          {selectedChoice.next_step_index === null ||
          selectedChoice.next_step_index >= steps.length
            ? 'View Results'
            : 'Continue'}
        </button>
      )}
    </div>
  )
}
