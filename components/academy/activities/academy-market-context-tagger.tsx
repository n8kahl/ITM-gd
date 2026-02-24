'use client'

import { useState } from 'react'
import { Check, X, RotateCcw, Tag } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketContextTaggerConfig {
  instructions: string
  scenario: string
  availableTags: Array<{
    key: string
    label: string
    category: string
  }>
  scenarioDetails?: {
    timeframe: string
    instrument: string
    vix: string
    trend: string
  }
}

interface MarketContextTaggerProps {
  config: MarketContextTaggerConfig
  onSubmit: (answer: string[]) => void
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

export function AcademyMarketContextTagger({
  config,
  onSubmit,
  disabled = false,
  result = null,
}: MarketContextTaggerProps) {
  const { instructions, scenario, availableTags, scenarioDetails } = config
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

  const toggleTag = (key: string) => {
    if (disabled) return
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleSubmit = () => {
    onSubmit(Array.from(selectedTags))
  }

  const handleReset = () => {
    setSelectedTags(new Set())
  }

  // Group tags by category
  const categories = availableTags.reduce<Record<string, typeof availableTags>>((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = []
    acc[tag.category].push(tag)
    return acc
  }, {})

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Tag className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
        <div>
          <h3 className="text-lg font-semibold text-white">Market Context Tagger</h3>
          <p className="text-sm text-white/50 mt-0.5">
            {selectedTags.size} tag{selectedTags.size !== 1 ? 's' : ''} selected
          </p>
        </div>
      </div>

      <p className="text-sm text-white/70 leading-relaxed">{instructions}</p>

      {/* Scenario */}
      <div className="rounded-lg bg-white/[0.03] border border-white/10 p-4 space-y-3">
        <p className="text-sm text-white leading-relaxed">{scenario}</p>
        {scenarioDetails && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-white/5">
            <div>
              <span className="text-[10px] text-white/40 uppercase">Timeframe</span>
              <p className="text-xs text-white/70 font-mono">{scenarioDetails.timeframe}</p>
            </div>
            <div>
              <span className="text-[10px] text-white/40 uppercase">Instrument</span>
              <p className="text-xs text-white/70 font-mono">{scenarioDetails.instrument}</p>
            </div>
            <div>
              <span className="text-[10px] text-white/40 uppercase">VIX</span>
              <p className="text-xs text-white/70 font-mono">{scenarioDetails.vix}</p>
            </div>
            <div>
              <span className="text-[10px] text-white/40 uppercase">Trend</span>
              <p className="text-xs text-white/70 font-mono">{scenarioDetails.trend}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tag Groups */}
      <div className="space-y-4">
        {Object.entries(categories).map(([category, tags]) => (
          <div key={category} className="space-y-2">
            <p className="text-xs text-white/40 font-medium uppercase tracking-wide">{category}</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.key}
                  onClick={() => toggleTag(tag.key)}
                  disabled={disabled}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    selectedTags.has(tag.key)
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white/80 hover:border-white/20'
                  } disabled:cursor-not-allowed`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        ))}
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
          disabled={disabled || selectedTags.size === 0}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Tags
        </button>
        <button
          onClick={handleReset}
          disabled={disabled || selectedTags.size === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm transition-all hover:bg-white/5 hover:text-white/80 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          Clear
        </button>
      </div>
    </div>
  )
}
