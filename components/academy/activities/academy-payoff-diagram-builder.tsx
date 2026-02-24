'use client'

import { useState, useMemo, useCallback } from 'react'
import { Check, X, RotateCcw, Plus, Trash2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OptionLeg {
  id: string
  type: 'call' | 'put'
  action: 'buy' | 'sell'
  strike: number
  premium: number
  quantity: number
}

interface PayoffDiagramBuilderConfig {
  underlying: string
  currentPrice: number
  instructions: string
  priceRange: [number, number]
  preloadedLegs?: OptionLeg[]
  targetBreakeven?: number
  targetMaxProfit?: number
  targetMaxLoss?: number
}

interface PayoffDiagramBuilderProps {
  config: PayoffDiagramBuilderConfig
  onSubmit: (answer: { breakeven: number; maxProfit: number; maxLoss: number }) => void
  disabled?: boolean
  result?: {
    score: number
    maxScore: number
    feedback: string
    isCorrect: boolean
  } | null
}

// ---------------------------------------------------------------------------
// Payoff calculation
// ---------------------------------------------------------------------------

function calculatePayoff(legs: OptionLeg[], price: number): number {
  let total = 0
  for (const leg of legs) {
    const direction = leg.action === 'buy' ? 1 : -1
    let intrinsic: number
    if (leg.type === 'call') {
      intrinsic = Math.max(0, price - leg.strike)
    } else {
      intrinsic = Math.max(0, leg.strike - price)
    }
    total += direction * (intrinsic - leg.premium) * leg.quantity * 100
  }
  return total
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AcademyPayoffDiagramBuilder({
  config,
  onSubmit,
  disabled = false,
  result = null,
}: PayoffDiagramBuilderProps) {
  const { underlying, currentPrice, instructions, priceRange, preloadedLegs } = config

  const [legs, setLegs] = useState<OptionLeg[]>(
    preloadedLegs ?? []
  )
  const [breakevenInput, setBreakevenInput] = useState('')
  const [maxProfitInput, setMaxProfitInput] = useState('')
  const [maxLossInput, setMaxLossInput] = useState('')

  const addLeg = () => {
    setLegs((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'call',
        action: 'buy',
        strike: Math.round(currentPrice),
        premium: 5,
        quantity: 1,
      },
    ])
  }

  const removeLeg = (id: string) => {
    setLegs((prev) => prev.filter((l) => l.id !== id))
  }

  const updateLeg = (id: string, field: keyof OptionLeg, value: string | number) => {
    setLegs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    )
  }

  // Generate payoff curve data points
  const chartData = useMemo(() => {
    if (legs.length === 0) return []
    const [min, max] = priceRange
    const step = (max - min) / 100
    const points: Array<{ price: number; payoff: number }> = []
    for (let p = min; p <= max; p += step) {
      points.push({ price: p, payoff: calculatePayoff(legs, p) })
    }
    return points
  }, [legs, priceRange])

  // SVG chart dimensions
  const svgW = 600
  const svgH = 200
  const padding = { top: 20, right: 20, bottom: 30, left: 60 }

  const chartBounds = useMemo(() => {
    if (chartData.length === 0) return { minX: 0, maxX: 1, minY: -1, maxY: 1 }
    const prices = chartData.map((d) => d.price)
    const payoffs = chartData.map((d) => d.payoff)
    const minY = Math.min(...payoffs, 0)
    const maxY = Math.max(...payoffs, 0)
    const yPad = Math.max(Math.abs(maxY - minY) * 0.1, 100)
    return {
      minX: Math.min(...prices),
      maxX: Math.max(...prices),
      minY: minY - yPad,
      maxY: maxY + yPad,
    }
  }, [chartData])

  const scaleX = useCallback(
    (v: number) =>
      padding.left +
      ((v - chartBounds.minX) / (chartBounds.maxX - chartBounds.minX)) *
        (svgW - padding.left - padding.right),
    [chartBounds, padding.left, padding.right]
  )

  const scaleY = useCallback(
    (v: number) =>
      padding.top +
      (1 - (v - chartBounds.minY) / (chartBounds.maxY - chartBounds.minY)) *
        (svgH - padding.top - padding.bottom),
    [chartBounds, padding.top, padding.bottom]
  )

  const pathD = useMemo(() => {
    if (chartData.length === 0) return ''
    return chartData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.price).toFixed(1)} ${scaleY(d.payoff).toFixed(1)}`)
      .join(' ')
  }, [chartData, scaleX, scaleY])

  const zeroY = scaleY(0)

  const handleSubmit = () => {
    onSubmit({
      breakeven: parseFloat(breakevenInput) || 0,
      maxProfit: parseFloat(maxProfitInput) || 0,
      maxLoss: parseFloat(maxLossInput) || 0,
    })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white">Payoff Diagram Builder</h3>
        <p className="text-sm text-white/50 mt-0.5">
          {underlying} &middot; ${currentPrice.toFixed(2)}
        </p>
      </div>

      <p className="text-sm text-white/70 leading-relaxed">{instructions}</p>

      {/* Leg Builder */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white/80">Option Legs</span>
          <button
            onClick={addLeg}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 text-xs text-white/60 hover:bg-white/5 hover:text-white/80 transition-all disabled:opacity-40"
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} />
            Add Leg
          </button>
        </div>
        {legs.map((leg) => (
          <div
            key={leg.id}
            className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 p-3 border border-white/5"
          >
            <select
              value={leg.action}
              onChange={(e) => updateLeg(leg.id, 'action', e.target.value)}
              disabled={disabled}
              className="rounded-md bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white outline-none"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
            <select
              value={leg.type}
              onChange={(e) => updateLeg(leg.id, 'type', e.target.value)}
              disabled={disabled}
              className="rounded-md bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white outline-none"
            >
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Strike</span>
              <input
                type="number"
                value={leg.strike}
                onChange={(e) => updateLeg(leg.id, 'strike', parseFloat(e.target.value) || 0)}
                disabled={disabled}
                className="w-20 rounded-md bg-white/10 border border-white/10 px-2 py-1.5 text-xs font-mono text-white outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Premium</span>
              <input
                type="number"
                value={leg.premium}
                onChange={(e) => updateLeg(leg.id, 'premium', parseFloat(e.target.value) || 0)}
                disabled={disabled}
                step="0.01"
                className="w-20 rounded-md bg-white/10 border border-white/10 px-2 py-1.5 text-xs font-mono text-white outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Qty</span>
              <input
                type="number"
                value={leg.quantity}
                onChange={(e) => updateLeg(leg.id, 'quantity', parseInt(e.target.value) || 1)}
                disabled={disabled}
                min={1}
                className="w-14 rounded-md bg-white/10 border border-white/10 px-2 py-1.5 text-xs font-mono text-white outline-none"
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

      {/* Payoff Diagram SVG */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-2 overflow-x-auto">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto" style={{ maxHeight: 220 }}>
            {/* Zero line */}
            <line
              x1={padding.left}
              y1={zeroY}
              x2={svgW - padding.right}
              y2={zeroY}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 4"
            />
            {/* Current price line */}
            <line
              x1={scaleX(currentPrice)}
              y1={padding.top}
              x2={scaleX(currentPrice)}
              y2={svgH - padding.bottom}
              stroke="rgba(16,185,129,0.3)"
              strokeDasharray="4 4"
            />
            <text
              x={scaleX(currentPrice)}
              y={svgH - 5}
              textAnchor="middle"
              fill="rgba(16,185,129,0.6)"
              fontSize="10"
              fontFamily="monospace"
            >
              ${currentPrice}
            </text>
            {/* Profit fill */}
            {pathD && (
              <>
                <path
                  d={pathD}
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="none"
                />
                {/* Positive area */}
                <clipPath id="profit-clip">
                  <rect x={padding.left} y={padding.top} width={svgW - padding.left - padding.right} height={zeroY - padding.top} />
                </clipPath>
                <path
                  d={`${pathD} L ${scaleX(chartBounds.maxX)} ${zeroY} L ${scaleX(chartBounds.minX)} ${zeroY} Z`}
                  fill="rgba(16,185,129,0.1)"
                  clipPath="url(#profit-clip)"
                />
                {/* Loss area */}
                <clipPath id="loss-clip">
                  <rect x={padding.left} y={zeroY} width={svgW - padding.left - padding.right} height={svgH - padding.bottom - zeroY} />
                </clipPath>
                <path
                  d={`${pathD} L ${scaleX(chartBounds.maxX)} ${zeroY} L ${scaleX(chartBounds.minX)} ${zeroY} Z`}
                  fill="rgba(239,68,68,0.1)"
                  clipPath="url(#loss-clip)"
                />
              </>
            )}
            {/* Y-axis labels */}
            <text x={padding.left - 5} y={zeroY + 3} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">
              $0
            </text>
          </svg>
        </div>
      )}

      {/* Answer Inputs */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-white/50 mb-1">Breakeven Price</label>
          <input
            type="number"
            value={breakevenInput}
            onChange={(e) => setBreakevenInput(e.target.value)}
            disabled={disabled}
            placeholder="e.g. 4520"
            step="0.01"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500/40"
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Max Profit ($)</label>
          <input
            type="number"
            value={maxProfitInput}
            onChange={(e) => setMaxProfitInput(e.target.value)}
            disabled={disabled}
            placeholder="e.g. 500"
            step="0.01"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500/40"
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Max Loss ($)</label>
          <input
            type="number"
            value={maxLossInput}
            onChange={(e) => setMaxLossInput(e.target.value)}
            disabled={disabled}
            placeholder="e.g. -300"
            step="0.01"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500/40"
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
          disabled={disabled || legs.length === 0}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Answer
        </button>
        <button
          onClick={() => {
            setBreakevenInput('')
            setMaxProfitInput('')
            setMaxLossInput('')
          }}
          disabled={disabled}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm transition-all hover:bg-white/5 hover:text-white/80 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          Clear
        </button>
      </div>
    </div>
  )
}
