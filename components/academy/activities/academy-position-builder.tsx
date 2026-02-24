'use client'

import { useState } from 'react'
import { Check, X, RotateCcw, Plus, Trash2, Layers } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PositionLeg {
  id: string
  action: 'buy' | 'sell'
  instrument: string
  quantity: number
}

interface PositionBuilderConfig {
  instructions: string
  underlying: string
  availableInstruments: string[]
  targetDescription: string
  maxLegs?: number
}

interface PositionBuilderProps {
  config: PositionBuilderConfig
  onSubmit: (answer: Array<{ action: string; instrument: string; quantity: number }>) => void
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

export function AcademyPositionBuilder({
  config,
  onSubmit,
  disabled = false,
  result = null,
}: PositionBuilderProps) {
  const { instructions, underlying, availableInstruments, targetDescription, maxLegs = 6 } = config
  const [legs, setLegs] = useState<PositionLeg[]>([])

  const addLeg = () => {
    if (legs.length >= maxLegs) return
    setLegs((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        action: 'buy',
        instrument: availableInstruments[0] ?? '',
        quantity: 1,
      },
    ])
  }

  const removeLeg = (id: string) => {
    setLegs((prev) => prev.filter((l) => l.id !== id))
  }

  const updateLeg = (id: string, field: keyof PositionLeg, value: string | number) => {
    setLegs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    )
  }

  const handleSubmit = () => {
    onSubmit(
      legs.map((l) => ({
        action: l.action,
        instrument: l.instrument,
        quantity: l.quantity,
      }))
    )
  }

  const handleReset = () => {
    setLegs([])
  }

  // Group by action for display
  const buyLegs = legs.filter((l) => l.action === 'buy')
  const sellLegs = legs.filter((l) => l.action === 'sell')

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Layers className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
        <div>
          <h3 className="text-lg font-semibold text-white">Position Builder</h3>
          <p className="text-sm text-white/50 mt-0.5">{underlying}</p>
        </div>
      </div>

      <p className="text-sm text-white/70 leading-relaxed">{instructions}</p>

      {/* Target */}
      <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-4">
        <p className="text-xs text-amber-400/70 font-medium uppercase tracking-wide mb-1">Target Position</p>
        <p className="text-sm text-amber-200/90">{targetDescription}</p>
      </div>

      {/* Leg Builder */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white/80">
            Position Legs ({legs.length}/{maxLegs})
          </span>
          <button
            onClick={addLeg}
            disabled={disabled || legs.length >= maxLegs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 text-xs text-white/60 hover:bg-white/5 hover:text-white/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} />
            Add Leg
          </button>
        </div>

        {legs.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/10 p-6 text-center">
            <p className="text-sm text-white/40">
              No legs added. Click &quot;Add Leg&quot; to start building your position.
            </p>
          </div>
        )}

        {legs.map((leg) => (
          <div
            key={leg.id}
            className={`flex flex-wrap items-center gap-3 rounded-lg p-3 border ${
              leg.action === 'buy'
                ? 'bg-emerald-500/5 border-emerald-500/10'
                : 'bg-rose-500/5 border-rose-500/10'
            }`}
          >
            <select
              value={leg.action}
              onChange={(e) => updateLeg(leg.id, 'action', e.target.value)}
              disabled={disabled}
              className={`rounded-md border px-2 py-1.5 text-xs font-medium outline-none ${
                leg.action === 'buy'
                  ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/15 border-rose-500/20 text-rose-400'
              }`}
            >
              <option value="buy">BUY</option>
              <option value="sell">SELL</option>
            </select>

            <select
              value={leg.instrument}
              onChange={(e) => updateLeg(leg.id, 'instrument', e.target.value)}
              disabled={disabled}
              className="rounded-md bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white outline-none flex-1 min-w-[140px]"
            >
              {availableInstruments.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/40">Qty</span>
              <input
                type="number"
                value={leg.quantity}
                onChange={(e) => updateLeg(leg.id, 'quantity', parseInt(e.target.value) || 1)}
                disabled={disabled}
                min={1}
                className="w-16 rounded-md bg-white/10 border border-white/10 px-2 py-1.5 text-xs font-mono text-white outline-none"
              />
            </div>

            <button
              onClick={() => removeLeg(leg.id)}
              disabled={disabled}
              className="ml-auto p-1.5 rounded hover:bg-rose-500/10 text-white/30 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>

      {/* Position Summary */}
      {legs.length > 0 && (
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-2">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide">Position Summary</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-white/40 text-xs">Long</p>
              {buyLegs.length === 0 ? (
                <p className="text-white/30 text-xs italic">none</p>
              ) : (
                buyLegs.map((l) => (
                  <p key={l.id} className="text-emerald-400 font-mono text-xs">
                    +{l.quantity} {l.instrument}
                  </p>
                ))
              )}
            </div>
            <div>
              <p className="text-white/40 text-xs">Short</p>
              {sellLegs.length === 0 ? (
                <p className="text-white/30 text-xs italic">none</p>
              ) : (
                sellLegs.map((l) => (
                  <p key={l.id} className="text-rose-400 font-mono text-xs">
                    -{l.quantity} {l.instrument}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
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
              {result.score}/{result.maxScore} legs correct
            </p>
            <p className="text-sm opacity-80 mt-1">{result.feedback}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={disabled || legs.length === 0}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Position
        </button>
        <button
          onClick={handleReset}
          disabled={disabled || legs.length === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm transition-all hover:bg-white/5 hover:text-white/80 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          Clear All
        </button>
      </div>
    </div>
  )
}
