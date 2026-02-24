'use client'

import { useState } from 'react'
import { Check, X, PenLine } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JournalPromptConfig {
  prompt: string
  hints: string[]
  minLength?: number
  placeholder?: string
}

interface JournalPromptProps {
  config: JournalPromptConfig
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

export function AcademyJournalPrompt({
  config,
  onSubmit,
  disabled = false,
  result = null,
}: JournalPromptProps) {
  const { prompt, hints, minLength = 50, placeholder } = config
  const [text, setText] = useState('')

  const charCount = text.trim().length
  const meetsMinLength = charCount >= minLength

  const handleSubmit = () => {
    if (meetsMinLength) onSubmit(text.trim())
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <PenLine className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
        <h3 className="text-lg font-semibold text-white">Reflection</h3>
      </div>

      {/* Prompt */}
      <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-4">
        <p className="text-sm text-white leading-relaxed">{prompt}</p>
      </div>

      {/* Hints */}
      {hints.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-white/50 font-medium">Consider addressing:</p>
          <ul className="space-y-1">
            {hints.map((hint, i) => (
              <li key={i} className="text-xs text-white/40 flex items-start gap-2">
                <span className="text-emerald-500/60 mt-0.5">-</span>
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Text Area */}
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          rows={6}
          placeholder={placeholder ?? 'Write your reflection here...'}
          className="w-full rounded-lg bg-white/5 border border-white/10 p-4 text-sm text-white placeholder-white/30 outline-none resize-y focus:border-emerald-500/40 transition-colors disabled:opacity-50"
        />
        <div className="flex items-center justify-between text-xs">
          <span className={charCount >= minLength ? 'text-emerald-400/70' : 'text-white/40'}>
            {charCount} / {minLength} min characters
          </span>
          {!meetsMinLength && charCount > 0 && (
            <span className="text-amber-400/60">
              {minLength - charCount} more characters needed
            </span>
          )}
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
          <p className="text-sm">{result.feedback}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={disabled || !meetsMinLength}
        className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Submit Reflection
      </button>
    </div>
  )
}
