'use client'

import { useCallback, useState } from 'react'
import { Brain, ChevronRight } from 'lucide-react'
import type { JournalMood } from '@/lib/types/journal'

/**
 * Psychology Prompt
 *
 * Appears after a trade to capture psychological state (mood_before, mood_after,
 * followed_plan, discipline_score). Designed to be shown in the journal page or
 * as a slide-over prompt after trade closure.
 *
 * Uses an inline, non-intrusive card that expands on click to keep friction low.
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 2, Slice 2C
 */

interface PsychologyPromptProps {
  /** Journal entry ID to update */
  entryId: string
  /** Entry symbol for display */
  symbol: string
  /** Callback after psychology data is saved */
  onComplete: () => void
  /** Callback to dismiss without saving */
  onDismiss: () => void
}

const MOOD_OPTIONS: { value: JournalMood; label: string; emoji: string }[] = [
  { value: 'confident', label: 'Confident', emoji: '\u{1F4AA}' },
  { value: 'neutral', label: 'Neutral', emoji: '\u{1F610}' },
  { value: 'anxious', label: 'Anxious', emoji: '\u{1F630}' },
  { value: 'frustrated', label: 'Frustrated', emoji: '\u{1F624}' },
  { value: 'excited', label: 'Excited', emoji: '\u{1F929}' },
  { value: 'fearful', label: 'Fearful', emoji: '\u{1F628}' },
]

const DISCIPLINE_OPTIONS = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Below Avg' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Excellent' },
]

export function PsychologyPrompt({ entryId, symbol, onComplete, onDismiss }: PsychologyPromptProps) {
  const [expanded, setExpanded] = useState(false)
  const [moodBefore, setMoodBefore] = useState<JournalMood | null>(null)
  const [moodAfter, setMoodAfter] = useState<JournalMood | null>(null)
  const [followedPlan, setFollowedPlan] = useState<boolean | null>(null)
  const [disciplineScore, setDisciplineScore] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/members/journal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entryId,
          mood_before: moodBefore,
          mood_after: moodAfter,
          followed_plan: followedPlan,
          discipline_score: disciplineScore,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? 'Failed to save psychology data')
      }

      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [entryId, moodBefore, moodAfter, followedPlan, disciplineScore, onComplete])

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-2.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-left transition-colors hover:bg-amber-500/15"
      >
        <Brain className="h-4 w-4 shrink-0 text-amber-400" strokeWidth={1.5} />
        <span className="flex-1 text-xs text-amber-200">
          How did you feel during <span className="font-mono text-amber-300">{symbol}</span>?
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
          <h3 className="text-xs font-medium text-amber-200">Post-Trade Reflection</h3>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-white/40 hover:text-white/60"
        >
          Skip
        </button>
      </div>

      {/* Mood Before */}
      <div>
        <p className="mb-1.5 text-[11px] text-white/50">Mood before entry</p>
        <div className="flex flex-wrap gap-1.5">
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMoodBefore(opt.value)}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                moodBefore === opt.value
                  ? 'border-amber-500/40 bg-amber-500/20 text-amber-200'
                  : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
              }`}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mood After */}
      <div>
        <p className="mb-1.5 text-[11px] text-white/50">Mood after exit</p>
        <div className="flex flex-wrap gap-1.5">
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMoodAfter(opt.value)}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                moodAfter === opt.value
                  ? 'border-amber-500/40 bg-amber-500/20 text-amber-200'
                  : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
              }`}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Followed Plan */}
      <div>
        <p className="mb-1.5 text-[11px] text-white/50">Did you follow your plan?</p>
        <div className="flex gap-2">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setFollowedPlan(opt.value)}
              className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                followedPlan === opt.value
                  ? opt.value
                    ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200'
                    : 'border-red-500/40 bg-red-500/20 text-red-200'
                  : 'border-white/10 text-white/50 hover:border-white/20'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Discipline Score */}
      <div>
        <p className="mb-1.5 text-[11px] text-white/50">Discipline rating</p>
        <div className="flex gap-1.5">
          {DISCIPLINE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDisciplineScore(opt.value)}
              className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                disciplineScore === opt.value
                  ? 'border-amber-500/40 bg-amber-500/20 text-amber-200'
                  : 'border-white/10 text-white/50 hover:border-white/20'
              }`}
            >
              {opt.value} — {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-md bg-amber-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save Reflection'}
      </button>
    </div>
  )
}
