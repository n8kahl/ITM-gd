'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Check, X, RotateCcw } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OptionRow {
  strike: number
  callBid: number
  callAsk: number
  callDelta: number
  callIV: number
  putBid: number
  putAsk: number
  putDelta: number
  putIV: number
}

interface OptionsChainSimulatorConfig {
  underlying: string
  underlyingPrice: number
  expirationLabel: string
  chain: OptionRow[]
  instructions: string
  selectMode: 'call' | 'put' | 'both'
  maxSelections?: number
}

interface OptionsChainSimulatorProps {
  config: OptionsChainSimulatorConfig
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

export function AcademyOptionsChainSimulator({
  config,
  onSubmit,
  disabled = false,
  result = null,
}: OptionsChainSimulatorProps) {
  const { underlying, underlyingPrice, expirationLabel, chain, instructions, selectMode, maxSelections } = config
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelection = (key: string) => {
    if (disabled) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        if (maxSelections && next.size >= maxSelections) return prev
        next.add(key)
      }
      return next
    })
  }

  const handleSubmit = () => {
    onSubmit(Array.from(selected))
  }

  const handleReset = () => {
    setSelected(new Set())
  }

  const canSelectCalls = selectMode === 'call' || selectMode === 'both'
  const canSelectPuts = selectMode === 'put' || selectMode === 'both'

  const atmStrike = useMemo(() => {
    if (!chain.length) return 0
    return chain.reduce((closest, row) =>
      Math.abs(row.strike - underlyingPrice) < Math.abs(closest.strike - underlyingPrice) ? row : closest
    ).strike
  }, [chain, underlyingPrice])

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Options Chain Simulator</h3>
          <p className="text-sm text-white/50 mt-0.5">
            {underlying} &middot; ${underlyingPrice.toFixed(2)} &middot; {expirationLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {selected.size} selected
          </span>
          {maxSelections && (
            <span>/ {maxSelections} max</span>
          )}
        </div>
      </div>

      {/* Instructions */}
      <p className="text-sm text-white/70 leading-relaxed">{instructions}</p>

      {/* Chain Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-white/50">
              {canSelectCalls && (
                <>
                  <th className="px-3 py-2 text-right font-medium">Call IV</th>
                  <th className="px-3 py-2 text-right font-medium">Delta</th>
                  <th className="px-3 py-2 text-right font-medium">Bid</th>
                  <th className="px-3 py-2 text-right font-medium">Ask</th>
                </>
              )}
              <th className="px-3 py-2 text-center font-bold text-white bg-white/5">Strike</th>
              {canSelectPuts && (
                <>
                  <th className="px-3 py-2 text-left font-medium">Bid</th>
                  <th className="px-3 py-2 text-left font-medium">Ask</th>
                  <th className="px-3 py-2 text-left font-medium">Delta</th>
                  <th className="px-3 py-2 text-left font-medium">Put IV</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {chain.map((row) => {
              const callKey = `call_${row.strike}`
              const putKey = `put_${row.strike}`
              const isAtm = row.strike === atmStrike
              const callSelected = selected.has(callKey)
              const putSelected = selected.has(putKey)
              const itm = row.strike < underlyingPrice

              return (
                <tr
                  key={row.strike}
                  className={`border-b border-white/5 transition-colors ${
                    isAtm ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  {canSelectCalls && (
                    <>
                      <td className="px-3 py-2 text-right font-mono text-white/60 text-xs">
                        {(row.callIV * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-white/60 text-xs">
                        {row.callDelta.toFixed(2)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono text-xs cursor-pointer transition-all rounded ${
                          callSelected
                            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                            : 'text-white/80 hover:bg-white/5'
                        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                        onClick={() => canSelectCalls && toggleSelection(callKey)}
                      >
                        {row.callBid.toFixed(2)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono text-xs cursor-pointer transition-all rounded ${
                          callSelected
                            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                            : 'text-white/80 hover:bg-white/5'
                        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                        onClick={() => canSelectCalls && toggleSelection(callKey)}
                      >
                        {row.callAsk.toFixed(2)}
                      </td>
                    </>
                  )}
                  <td className={`px-3 py-2 text-center font-mono font-bold text-sm bg-white/5 ${
                    isAtm ? 'text-emerald-400' : itm ? 'text-amber-300/80' : 'text-white/90'
                  }`}>
                    {row.strike}
                    {isAtm && <span className="ml-1 text-[10px] text-emerald-400/60">ATM</span>}
                  </td>
                  {canSelectPuts && (
                    <>
                      <td
                        className={`px-3 py-2 text-left font-mono text-xs cursor-pointer transition-all rounded ${
                          putSelected
                            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                            : 'text-white/80 hover:bg-white/5'
                        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                        onClick={() => canSelectPuts && toggleSelection(putKey)}
                      >
                        {row.putBid.toFixed(2)}
                      </td>
                      <td
                        className={`px-3 py-2 text-left font-mono text-xs cursor-pointer transition-all rounded ${
                          putSelected
                            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                            : 'text-white/80 hover:bg-white/5'
                        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                        onClick={() => canSelectPuts && toggleSelection(putKey)}
                      >
                        {row.putAsk.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-left font-mono text-white/60 text-xs">
                        {row.putDelta.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-left font-mono text-white/60 text-xs">
                        {(row.putIV * 100).toFixed(1)}%
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
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
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={disabled || selected.size === 0}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Selection
        </button>
        <button
          onClick={handleReset}
          disabled={disabled}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm transition-all hover:bg-white/5 hover:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          Reset
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-white/40 pt-1">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-emerald-400" strokeWidth={1.5} />
          ITM
        </span>
        <span className="flex items-center gap-1.5">
          <TrendingDown className="h-3 w-3 text-amber-400" strokeWidth={1.5} />
          OTM
        </span>
        <span>Click bid/ask cells to select contracts</span>
      </div>
    </div>
  )
}
