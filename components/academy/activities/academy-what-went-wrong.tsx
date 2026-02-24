'use client'

import { useState } from 'react'
import { Check, X, AlertTriangle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TradeDetails {
  entry: string
  exit: string
  direction: 'long' | 'short'
  instrument: string
  pnl: string
  context: string
}

interface ErrorOption {
  key: string
  label: string
  description: string
}

interface WhatWentWrongConfig {
  instructions: string
  trade: TradeDetails
  options: ErrorOption[]
}

interface WhatWentWrongProps {
  config: WhatWentWrongConfig
  onSubmit: (answer: string) => void
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

export function AcademyWhatWentWrong({
  config,
  onSubmit,
  disabled = false,
  result = null,
}: WhatWentWrongProps) {
  const { instructions, trade, options } = config
  const [selected, setSelected] = useState<string | null>(null)

  const handleSubmit = () => {
    if (selected) onSubmit(selected)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400" strokeWidth={1.5} />
        <div>
          <h3 className="text-lg font-semibold text-white">What Went Wrong?</h3>
          <p className="text-sm text-white/50 mt-0.5">Diagnose the trading error</p>
        </div>
      </div>

      <p className="text-sm text-white/70 leading-relaxed">{instructions}</p>

      {/* Trade Details Card */}
      <div className="rounded-lg bg-white/[0.03] border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                trade.direction === 'long'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {trade.direction.toUpperCase()}
            </span>
            <span className="text-sm font-medium text-white">{trade.instrument}</span>
          </div>
          <span
            className={`font-mono text-sm font-semibold ${
              trade.pnl.startsWith('-') ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {trade.pnl}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-white/40">Entry</span>
            <p className="text-white/80 font-mono">{trade.entry}</p>
          </div>
          <div>
            <span className="text-white/40">Exit</span>
            <p className="text-white/80 font-mono">{trade.exit}</p>
          </div>
        </div>
        <p className="text-xs text-white/50 leading-relaxed">{trade.context}</p>
      </div>

      {/* Error Options */}
      <div className="space-y-2">
        <p className="text-xs text-white/50 font-medium uppercase tracking-wide">
          Select the primary error:
        </p>
        {options.map((opt) => (
          <button
            key={opt.key}
            onClick={() => !disabled && setSelected(opt.key)}
            disabled={disabled}
            className={`w-full text-left rounded-lg p-4 border transition-all ${
              selected === opt.key
                ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20'
                : 'bg-white/5 border-white/10 hover:border-white/20'
            } disabled:cursor-not-allowed`}
          >
            <p className={`text-sm font-medium ${selected === opt.key ? 'text-amber-300' : 'text-white'}`}>
              {opt.label}
            </p>
            <p className="text-xs text-white/50 mt-1">{opt.description}</p>
          </button>
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
          <p className="text-sm">{result.feedback}</p>
        </div>
      )}

      {/* Actions */}
      <button
        onClick={handleSubmit}
        disabled={disabled || !selected}
        className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Submit Diagnosis
      </button>
    </div>
  )
}
