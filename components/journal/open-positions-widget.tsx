'use client'

import { useCallback, useEffect, useState } from 'react'
import { Activity, Loader2, XCircle } from 'lucide-react'
import { notifyAppError, createAppError, createAppErrorFromResponse } from '@/lib/error-handler'

interface OpenPosition {
  id: string
  symbol: string
  direction: 'long' | 'short' | 'neutral' | null
  entry_price: number | null
  position_size: number | null
  current_price: number | null
  live_pnl: number | null
  live_pnl_percentage: number | null
}

interface OpenPositionsWidgetProps {
  onUpdated?: () => void
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  const prefix = value >= 0 ? '+$' : '-$'
  return `${prefix}${Math.abs(value).toFixed(2)}`
}

function formatPercent(value: number | null): string {
  if (value == null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function OpenPositionsWidget({ onUpdated }: OpenPositionsWidgetProps) {
  const [positions, setPositions] = useState<OpenPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [closingId, setClosingId] = useState<string | null>(null)

  const loadOpenPositions = useCallback(async () => {
    try {
      const response = await fetch('/api/members/journal/open-positions', { cache: 'no-store' })
      if (!response.ok) {
        throw await createAppErrorFromResponse(response)
      }
      const result = await response.json()
      setPositions(Array.isArray(result.data) ? result.data : [])
    } catch (error) {
      notifyAppError(createAppError(error), { retryLabel: 'Refresh' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOpenPositions()
    const interval = window.setInterval(() => {
      void loadOpenPositions()
    }, 15000)
    return () => window.clearInterval(interval)
  }, [loadOpenPositions])

  const closePosition = async (entryId: string) => {
    setClosingId(entryId)
    try {
      const response = await fetch('/api/members/journal/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      })
      if (!response.ok) {
        throw await createAppErrorFromResponse(response)
      }
      await loadOpenPositions()
      if (onUpdated) onUpdated()
    } catch (error) {
      notifyAppError(createAppError(error))
    } finally {
      setClosingId(null)
    }
  }

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading open positions...
      </div>
    )
  }

  if (positions.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-medium text-ivory">Open Positions</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {positions.map((position) => {
          const pnl = position.live_pnl ?? 0
          const tone = pnl >= 0 ? 'emerald' : 'red'
          return (
            <div
              key={position.id}
              className={`glass-card rounded-xl p-3 border ${tone === 'emerald' ? 'border-emerald-500/30' : 'border-red-500/30'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-mono font-semibold text-ivory">{position.symbol}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{position.direction || 'long'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => closePosition(position.id)}
                  disabled={closingId === position.id}
                  className="p-1 rounded-md text-muted-foreground hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  aria-label="Close position"
                >
                  {closingId === position.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="mt-2 text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Entry</span>
                  <span className="font-mono text-ivory">{position.entry_price != null ? `$${position.entry_price.toFixed(2)}` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current</span>
                  <span className="font-mono text-ivory">{position.current_price != null ? `$${position.current_price.toFixed(2)}` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Live P&L</span>
                  <span className={`font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(position.live_pnl)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Live %</span>
                  <span className={`font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPercent(position.live_pnl_percentage)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
