'use client'

import { useState } from 'react'
import { Check, X, RotateCcw, ArrowRight, Shuffle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchScenario {
  key: string
  label: string
  description: string
}

interface MatchStrategy {
  key: string
  label: string
  description: string
}

interface StrategyMatcherConfig {
  instructions: string
  scenarios: MatchScenario[]
  strategies: MatchStrategy[]
}

interface StrategyMatcherProps {
  config: StrategyMatcherConfig
  onSubmit: (answer: Record<string, string>) => void
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

export function AcademyStrategyMatcher({
  config,
  onSubmit,
  disabled = false,
  result = null,
}: StrategyMatcherProps) {
  const { instructions, scenarios, strategies } = config
  const [matches, setMatches] = useState<Record<string, string>>({})
  const [activeScenario, setActiveScenario] = useState<string | null>(null)

  const handleStrategySelect = (strategyKey: string) => {
    if (!activeScenario || disabled) return
    setMatches((prev) => ({
      ...prev,
      [activeScenario]: strategyKey,
    }))
    // Auto-advance to next unmatched scenario
    const nextUnmatched = scenarios.find(
      (s) => s.key !== activeScenario && !matches[s.key]
    )
    setActiveScenario(nextUnmatched?.key ?? null)
  }

  const clearMatch = (scenarioKey: string) => {
    if (disabled) return
    setMatches((prev) => {
      const next = { ...prev }
      delete next[scenarioKey]
      return next
    })
  }

  const handleSubmit = () => {
    onSubmit(matches)
  }

  const handleReset = () => {
    setMatches({})
    setActiveScenario(null)
  }

  const allMatched = scenarios.every((s) => matches[s.key])

  const getMatchedStrategy = (scenarioKey: string): MatchStrategy | undefined => {
    const stratKey = matches[scenarioKey]
    if (!stratKey) return undefined
    return strategies.find((s) => s.key === stratKey)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shuffle className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
        <div>
          <h3 className="text-lg font-semibold text-white">Strategy Matcher</h3>
          <p className="text-sm text-white/50 mt-0.5">
            Match each scenario to the best strategy
          </p>
        </div>
      </div>

      <p className="text-sm text-white/70 leading-relaxed">{instructions}</p>

      {/* Two-column layout */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Scenarios Column */}
        <div className="space-y-2">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2">
            Scenarios
          </p>
          {scenarios.map((s) => {
            const matched = getMatchedStrategy(s.key)
            const isActive = activeScenario === s.key

            return (
              <button
                key={s.key}
                onClick={() => setActiveScenario(isActive ? null : s.key)}
                disabled={disabled}
                className={`w-full text-left rounded-lg p-3 border transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : matched
                      ? 'bg-white/[0.03] border-white/10'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                } disabled:cursor-not-allowed`}
              >
                <p className={`text-sm font-medium ${isActive ? 'text-emerald-300' : 'text-white'}`}>
                  {s.label}
                </p>
                <p className="text-xs text-white/50 mt-1">{s.description}</p>
                {matched && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                    <ArrowRight className="h-3 w-3 text-emerald-400" strokeWidth={1.5} />
                    <span className="text-xs text-emerald-400">{matched.label}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        clearMatch(s.key)
                      }}
                      className="ml-auto text-white/30 hover:text-rose-400 transition-colors"
                    >
                      <X className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Strategies Column */}
        <div className="space-y-2">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2">
            Strategies
          </p>
          {strategies.map((s) => {
            const isUsed = Object.values(matches).includes(s.key)

            return (
              <button
                key={s.key}
                onClick={() => handleStrategySelect(s.key)}
                disabled={disabled || !activeScenario}
                className={`w-full text-left rounded-lg p-3 border transition-all ${
                  isUsed
                    ? 'bg-white/[0.02] border-white/5 opacity-50'
                    : activeScenario
                      ? 'bg-white/5 border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 cursor-pointer'
                      : 'bg-white/5 border-white/10 opacity-60 cursor-not-allowed'
                }`}
              >
                <p className="text-sm font-medium text-white">{s.label}</p>
                <p className="text-xs text-white/50 mt-1">{s.description}</p>
                {isUsed && (
                  <span className="inline-block mt-1 text-[10px] text-white/30 uppercase">assigned</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        <span>
          {Object.keys(matches).length}/{scenarios.length} matched
        </span>
        <div className="flex-1 h-1 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(Object.keys(matches).length / scenarios.length) * 100}%` }}
          />
        </div>
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
          <div>
            <p className="text-sm font-medium">
              {result.score}/{result.maxScore} correct
            </p>
            <p className="text-sm opacity-80 mt-1">{result.feedback}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={disabled || !allMatched}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Matches
        </button>
        <button
          onClick={handleReset}
          disabled={disabled}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm transition-all hover:bg-white/5 hover:text-white/80 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          Reset
        </button>
      </div>
    </div>
  )
}
