'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  X,
  Loader2,
  Plus,
  TrendingUp,
  TrendingDown,
  Clock,
  Calculator,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Zap,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

// ============================================
// TYPES
// ============================================

interface LEAPSPosition {
  id: string
  symbol: string
  option_type: string
  strike: number
  entry_price: number
  entry_date: string
  expiry_date: string
  quantity: number
  current_value?: number
  current_underlying?: number
  current_iv?: number
  current_delta?: number
  current_theta?: number
  current_vega?: number
  current_gamma?: number
  entry_delta?: number
  notes?: string
  created_at: string
}

interface GreeksSnapshot {
  dte: number
  date: string
  delta: number
  gamma: number
  theta: number
  vega: number
  projectedValue: number
  notes: string
}

interface LEAPSDashboardProps {
  onClose: () => void
  onSendPrompt?: (prompt: string) => void
}

// ============================================
// COMPONENT
// ============================================

export function LEAPSDashboard({ onClose, onSendPrompt }: LEAPSDashboardProps) {
  const { session } = useMemberAuth()
  const [positions, setPositions] = useState<LEAPSPosition[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [projections, setProjections] = useState<Record<string, GreeksSnapshot[]>>({})

  const token = session?.access_token
  const API_BASE = process.env.NEXT_PUBLIC_AI_COACH_API || 'http://localhost:3001'

  const fetchPositions = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/leaps`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch')
      setPositions(data.positions || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [token, API_BASE])

  useEffect(() => {
    fetchPositions()
  }, [fetchPositions])

  const fetchProjection = useCallback(async (positionId: string) => {
    if (!token || projections[positionId]) return

    try {
      const res = await fetch(`${API_BASE}/api/leaps/${positionId}/greeks-projection`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      if (data.projections) {
        setProjections(prev => ({ ...prev, [positionId]: data.projections }))
      }
    } catch (err) {
      // Projection fetch failed - continue without projections
      console.debug('Failed to fetch Greeks projection for position', positionId)
    }
  }, [token, API_BASE, projections])

  const deletePosition = useCallback(async (id: string) => {
    if (!token) return

    try {
      const res = await fetch(`${API_BASE}/api/leaps/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error('Failed to delete position')
      }
      setPositions(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete position')
    }
  }, [token, API_BASE])

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      fetchProjection(id)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-medium text-white">LEAPS Positions</h2>
          {positions.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
              {positions.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20 transition-all"
          >
            <Plus className="w-3 h-3" />
            Add Position
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Add form */}
        {showAddForm && (
          <AddPositionForm
            token={token}
            apiBase={API_BASE}
            onAdded={() => {
              setShowAddForm(false)
              fetchPositions()
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm text-white/50">Loading LEAPS positions...</p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="text-center py-12">
            <p className="text-sm text-red-400 mb-2">{error}</p>
            <button onClick={fetchPositions} className="text-xs text-emerald-500 hover:text-emerald-400">
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && positions.length === 0 && !showAddForm && (
          <div className="text-center py-16">
            <Clock className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40 mb-2">No LEAPS positions</p>
            <p className="text-xs text-white/25 mb-6">
              Track your long-term options with Greeks projection, roll analysis, and macro context
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              Add Your First Position
            </button>
          </div>
        )}

        {/* Positions list */}
        {!isLoading && positions.length > 0 && (
          <div className="p-4 space-y-3">
            {positions.map(position => (
              <PositionCard
                key={position.id}
                position={position}
                expanded={expandedId === position.id}
                projection={projections[position.id]}
                onToggle={() => toggleExpand(position.id)}
                onDelete={() => deletePosition(position.id)}
                onAskAI={onSendPrompt}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// POSITION CARD
// ============================================

function PositionCard({
  position,
  expanded,
  projection,
  onToggle,
  onDelete,
  onAskAI,
}: {
  position: LEAPSPosition
  expanded: boolean
  projection?: GreeksSnapshot[]
  onToggle: () => void
  onDelete: () => void
  onAskAI?: (prompt: string) => void
}) {
  const daysToExpiry = Math.max(0, Math.ceil(
    (new Date(position.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ))
  const daysHeld = Math.ceil(
    (Date.now() - new Date(position.entry_date).getTime()) / (1000 * 60 * 60 * 24)
  )

  const isCall = position.option_type === 'CALL'
  const DirectionIcon = isCall ? TrendingUp : TrendingDown
  const dirColor = isCall ? 'text-emerald-400' : 'text-red-400'

  // P&L estimate
  const currentVal = position.current_value || position.entry_price
  const pnl = (currentVal - position.entry_price) * position.quantity * 100
  const pnlPct = position.entry_price > 0
    ? ((currentVal - position.entry_price) / position.entry_price * 100)
    : 0

  // Time risk
  const timeRisk = daysToExpiry > 180 ? 'low' : daysToExpiry > 90 ? 'medium' : 'high'
  const timeColor = timeRisk === 'low' ? 'text-emerald-400' : timeRisk === 'medium' ? 'text-amber-400' : 'text-red-400'

  return (
    <div
      className={cn(
        'glass-card-heavy rounded-lg p-3 border border-white/5 cursor-pointer transition-all hover:border-emerald-500/20',
        expanded && 'border-emerald-500/20'
      )}
      onClick={onToggle}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DirectionIcon className={cn('w-4 h-4', dirColor)} />
          <span className="text-sm font-medium text-white">
            {position.symbol} ${position.strike.toLocaleString()} {position.option_type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium', pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
          </span>
          {expanded ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
        </div>
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-3 text-xs">
        <div>
          <span className="text-white/30">Entry:</span>
          <span className="text-white/60 ml-1">${position.entry_price.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-white/30">DTE:</span>
          <span className={cn('ml-1 font-medium', timeColor)}>{daysToExpiry}d</span>
        </div>
        <div>
          <span className="text-white/30">Held:</span>
          <span className="text-white/60 ml-1">{daysHeld}d</span>
        </div>
        {position.current_delta && (
          <div>
            <span className="text-white/30">Delta:</span>
            <span className="text-white/60 ml-1">{position.current_delta.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
          {/* Greeks */}
          <div className="bg-white/5 rounded-lg p-2.5">
            <p className="text-[10px] text-white/30 mb-1.5">CURRENT GREEKS</p>
            <div className="grid grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-white/30">Delta</span>
                <p className="text-white/70">{position.current_delta?.toFixed(3) || 'N/A'}</p>
              </div>
              <div>
                <span className="text-white/30">Gamma</span>
                <p className="text-white/70">{position.current_gamma?.toFixed(4) || 'N/A'}</p>
              </div>
              <div>
                <span className="text-white/30">Theta</span>
                <p className="text-white/70">{position.current_theta?.toFixed(2) || 'N/A'}</p>
              </div>
              <div>
                <span className="text-white/30">Vega</span>
                <p className="text-white/70">{position.current_vega?.toFixed(2) || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Greeks Projection Table */}
          {projection && projection.length > 0 && (
            <div className="bg-white/5 rounded-lg p-2.5">
              <p className="text-[10px] text-white/30 mb-1.5 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                GREEKS PROJECTION
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5">
                      <th className="text-left py-1 pr-2">DTE</th>
                      <th className="text-right py-1 px-1">Delta</th>
                      <th className="text-right py-1 px-1">Theta</th>
                      <th className="text-right py-1 px-1">Vega</th>
                      <th className="text-right py-1 pl-1">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projection.slice(0, 6).map((snap, i) => (
                      <tr key={i} className="text-white/60 border-b border-white/5 last:border-0">
                        <td className="py-1 pr-2">{snap.dte}d</td>
                        <td className="text-right py-1 px-1">{snap.delta.toFixed(3)}</td>
                        <td className="text-right py-1 px-1 text-red-400">{snap.theta.toFixed(2)}</td>
                        <td className="text-right py-1 px-1">{snap.vega.toFixed(1)}</td>
                        <td className="text-right py-1 pl-1">${snap.projectedValue.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expiry info */}
          <div className="flex items-center gap-3 text-[11px]">
            <div>
              <span className="text-white/30">Expiry:</span>
              <span className="text-white/60 ml-1">
                {new Date(position.expiry_date).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-white/30">Qty:</span>
              <span className="text-white/60 ml-1">{position.quantity}</span>
            </div>
            <div>
              <span className="text-white/30">Time Risk:</span>
              <span className={cn('ml-1 font-medium', timeColor)}>
                {timeRisk}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {onAskAI && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAskAI(
                    `Analyze my LEAPS position: ${position.symbol} $${position.strike} ${position.option_type}, ` +
                    `entry $${position.entry_price} on ${position.entry_date}, ` +
                    `expiry ${position.expiry_date}, ${position.quantity} contracts. ` +
                    `What's the outlook and should I consider rolling?`
                  )
                }}
                className="flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                <Zap className="w-3 h-3" />
                AI Analysis
              </button>
            )}
            {onAskAI && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAskAI(
                    `Calculate roll for my ${position.symbol} $${position.strike} ${position.option_type} ` +
                    `expiring ${position.expiry_date}. What strike and expiry should I roll to?`
                  )
                }}
                className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors"
              >
                <Calculator className="w-3 h-3" />
                Roll Analysis
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (window.confirm('Delete this position?')) onDelete()
              }}
              className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors ml-auto"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// ADD POSITION FORM
// ============================================

function AddPositionForm({
  token,
  apiBase,
  onAdded,
  onCancel,
}: {
  token?: string
  apiBase: string
  onAdded: () => void
  onCancel: () => void
}) {
  const [symbol, setSymbol] = useState('SPX')
  const [optionType, setOptionType] = useState('CALL')
  const [strike, setStrike] = useState('')
  const [entryPrice, setEntryPrice] = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setIsSubmitting(true)
    setFormError(null)

    try {
      const res = await fetch(`${apiBase}/api/leaps`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          option_type: optionType,
          strike: parseFloat(strike),
          entry_price: parseFloat(entryPrice),
          entry_date: entryDate,
          expiry_date: expiryDate,
          quantity: parseInt(quantity),
          notes: notes || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add position')
      onAdded()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-b border-white/5 space-y-3">
      <p className="text-xs text-white/50 font-medium">Add LEAPS Position</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-white/30 block mb-1">Symbol</label>
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
          >
            <option value="SPX">SPX</option>
            <option value="NDX">NDX</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-white/30 block mb-1">Type</label>
          <select
            value={optionType}
            onChange={e => setOptionType(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
          >
            <option value="CALL">CALL</option>
            <option value="PUT">PUT</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-white/30 block mb-1">Strike</label>
          <input
            type="number"
            value={strike}
            onChange={e => setStrike(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
            placeholder="5800"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/30 block mb-1">Entry Price</label>
          <input
            type="number"
            step="0.01"
            value={entryPrice}
            onChange={e => setEntryPrice(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
            placeholder="250.00"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/30 block mb-1">Qty</label>
          <input
            type="number"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            required
            min="1"
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-white/30 block mb-1">Entry Date</label>
          <input
            type="date"
            value={entryDate}
            onChange={e => setEntryDate(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/30 block mb-1">Expiry Date</label>
          <input
            type="date"
            value={expiryDate}
            onChange={e => setExpiryDate(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-white/30 block mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
          placeholder="Trade thesis..."
        />
      </div>

      {formError && (
        <p className="text-xs text-red-400">{formError}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Adding...' : 'Add Position'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-white/50 hover:text-white/70 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
