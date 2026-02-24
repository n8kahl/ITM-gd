'use client'

import { useState } from 'react'
import { Check, X, Send, RotateCcw } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderEntrySimulatorConfig {
  instructions: string
  underlying: string
  currentPrice: number
  scenario: string
  availableOrderTypes: string[]
  targetDescription: string
}

interface OrderEntrySimulatorProps {
  config: OrderEntrySimulatorConfig
  onSubmit: (answer: { side: string; type: string; quantity: number; price?: number }) => void
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

export function AcademyOrderEntrySimulator({
  config,
  onSubmit,
  disabled = false,
  result = null,
}: OrderEntrySimulatorProps) {
  const { instructions, underlying, currentPrice, scenario, availableOrderTypes, targetDescription } = config
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [orderType, setOrderType] = useState(availableOrderTypes[0] ?? 'market')
  const [quantity, setQuantity] = useState(1)
  const [price, setPrice] = useState<string>('')

  const needsPrice = orderType !== 'market'

  const handleSubmit = () => {
    const order: { side: string; type: string; quantity: number; price?: number } = {
      side,
      type: orderType,
      quantity,
    }
    if (needsPrice && price) {
      order.price = parseFloat(price)
    }
    onSubmit(order)
  }

  const handleReset = () => {
    setSide('buy')
    setOrderType(availableOrderTypes[0] ?? 'market')
    setQuantity(1)
    setPrice('')
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Order Entry Simulator</h3>
          <p className="text-sm text-white/50 mt-0.5">
            {underlying} &middot; Last: <span className="font-mono text-white/70">${currentPrice.toFixed(2)}</span>
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
          Simulated
        </span>
      </div>

      <p className="text-sm text-white/70 leading-relaxed">{instructions}</p>

      {/* Scenario */}
      <div className="rounded-lg bg-white/[0.03] border border-white/10 p-4">
        <p className="text-sm text-white/70 leading-relaxed">{scenario}</p>
      </div>

      {/* Target */}
      <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
        <p className="text-xs text-amber-400/70 font-medium uppercase tracking-wide mb-1">Objective</p>
        <p className="text-sm text-amber-200/90">{targetDescription}</p>
      </div>

      {/* Order Entry Form */}
      <div className="space-y-4">
        {/* Side */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 font-medium">Side</label>
          <div className="flex gap-2">
            <button
              onClick={() => !disabled && setSide('buy')}
              disabled={disabled}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                side === 'buy'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
              }`}
            >
              BUY
            </button>
            <button
              onClick={() => !disabled && setSide('sell')}
              disabled={disabled}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                side === 'sell'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
              }`}
            >
              SELL
            </button>
          </div>
        </div>

        {/* Order Type + Quantity row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Order Type</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
              disabled={disabled}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none"
            >
              {availableOrderTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={disabled}
              min={1}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-emerald-500/40"
            />
          </div>
        </div>

        {/* Price (conditional) */}
        {needsPrice && (
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Limit Price</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={disabled}
              placeholder={`e.g. ${currentPrice.toFixed(2)}`}
              step="0.01"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-emerald-500/40"
            />
          </div>
        )}

        {/* Order Preview */}
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3 text-xs text-white/50 font-mono">
          {side.toUpperCase()} {quantity}x {underlying} @ {orderType === 'market' ? 'MARKET' : `$${price || '---'}`} ({orderType})
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
              {result.score}/{result.maxScore} fields correct
            </p>
            <p className="text-sm opacity-80 mt-1">{result.feedback}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={disabled}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
          Place Order
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
