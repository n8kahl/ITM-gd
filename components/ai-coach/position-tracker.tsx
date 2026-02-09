'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  TrendingUp,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  API_BASE,
  AICoachAPIError,
  getLivePositions,
  getPositionAdvice,
  type PositionAdvice,
  type PositionLiveSnapshot,
} from '@/lib/api/ai-coach'

interface PositionTrackerProps {
  onClose: () => void
  onSendPrompt?: (prompt: string) => void
}

function formatDollar(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function buildPositionPrompt(action: 'close' | 'roll' | 'spread' | 'stop', position: PositionLiveSnapshot): string {
  if (action === 'close') {
    return `Help me close ${position.symbol} ${position.type} position ${position.id}. Give me a step-by-step exit checklist and risk notes.`
  }
  if (action === 'roll') {
    return `Evaluate rolling my ${position.symbol} ${position.type} position ${position.id}. Suggest the best strike/expiry with net credit/debit.`
  }
  if (action === 'spread') {
    return `Analyze converting my ${position.symbol} ${position.type} position ${position.id} into a spread. Show strikes, max gain/loss, and tradeoff.`
  }
  return `Set a stop plan for my ${position.symbol} ${position.type} position ${position.id}. Recommend a stop level and management rules.`
}

function toWsUrl(baseHttpUrl: string): string {
  try {
    const parsed = new URL(baseHttpUrl)
    const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${parsed.host}/ws/prices`
  } catch {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3001'
    return `${protocol}//${host}/ws/prices`
  }
}

export function PositionTracker({ onClose, onSendPrompt }: PositionTrackerProps) {
  const { session } = useMemberAuth()
  const token = session?.access_token
  const userId = session?.user?.id

  const [positions, setPositions] = useState<PositionLiveSnapshot[]>([])
  const [adviceByPosition, setAdviceByPosition] = useState<Record<string, PositionAdvice[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [flashPnl, setFlashPnl] = useState<Record<string, boolean>>({})

  const wsRef = useRef<WebSocket | null>(null)

  const upsertPosition = useCallback((incoming: PositionLiveSnapshot) => {
    setPositions((prev) => {
      const existing = prev.find((item) => item.id === incoming.id)
      if (existing && existing.pnl !== incoming.pnl) {
        setFlashPnl((current) => ({ ...current, [incoming.id]: true }))
        setTimeout(() => {
          setFlashPnl((current) => {
            const next = { ...current }
            delete next[incoming.id]
            return next
          })
        }, 700)
      }

      const withoutIncoming = prev.filter((item) => item.id !== incoming.id)
      return [incoming, ...withoutIncoming]
    })
  }, [])

  const updateAdvice = useCallback((items: PositionAdvice[]) => {
    setAdviceByPosition((prev) => {
      const next = { ...prev }
      for (const item of items) {
        const existing = next[item.positionId] || []
        const deduped = [item, ...existing.filter((row) => row.type !== item.type)]
        next[item.positionId] = deduped.slice(0, 3)
      }
      return next
    })
  }, [])

  const fetchAll = useCallback(async (isBackground: boolean = false) => {
    if (!token) return

    if (isBackground) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    setError(null)

    try {
      const [live, advice] = await Promise.all([
        getLivePositions(token),
        getPositionAdvice(token),
      ])

      setPositions(live.positions)
      setLastUpdated(live.timestamp)

      const grouped: Record<string, PositionAdvice[]> = {}
      for (const row of advice.advice) {
        grouped[row.positionId] = [...(grouped[row.positionId] || []), row]
      }
      setAdviceByPosition(grouped)
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to load live positions'
      setError(message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [token])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!token) return

    const interval = setInterval(() => {
      void fetchAll(true)
    }, 30_000)

    return () => {
      clearInterval(interval)
    }
  }, [fetchAll, token])

  useEffect(() => {
    if (!userId) return

    const channel = `positions:${userId}`
    const ws = new WebSocket(toWsUrl(API_BASE))
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', channels: [channel] }))
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message?.channel !== channel) return

        if (message?.type === 'position_update' && message?.data?.snapshot) {
          upsertPosition(message.data.snapshot as PositionLiveSnapshot)
          if (message?.data?.updatedAt) {
            setLastUpdated(String(message.data.updatedAt))
          }
          return
        }

        if (message?.type === 'position_advice' && message?.data?.advice) {
          updateAdvice([message.data.advice as PositionAdvice])
        }
      } catch {
        // Ignore malformed socket events.
      }
    }

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channels: [channel] }))
      }
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [upsertPosition, updateAdvice, userId])

  const positionsSorted = useMemo(
    () => [...positions].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)),
    [positions],
  )

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-medium text-white">Live Position Tracker</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
            {positions.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchAll(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-white/10 text-white/70 hover:text-white hover:border-white/20 disabled:opacity-60"
          >
            {isRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {lastUpdated && (
          <p className="text-[11px] text-white/40">Last updated: {new Date(lastUpdated).toLocaleTimeString()}</p>
        )}

        {error && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="h-32 flex items-center justify-center text-white/50 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading open positions...
          </div>
        )}

        {!isLoading && positionsSorted.length === 0 && (
          <div className="h-32 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-center text-sm text-white/50">
            No open positions found.
          </div>
        )}

        {positionsSorted.map((position) => {
          const pnlPositive = position.pnl >= 0
          const advice = adviceByPosition[position.id] || []

          return (
            <div key={position.id} className="glass-card-heavy rounded-xl p-4 border border-white/10 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{position.symbol}</p>
                  <p className="text-[11px] text-white/50 uppercase tracking-wide">
                    {position.type.replace('_', ' ')}
                    {position.strike ? ` ${position.strike}` : ''}
                    {position.expiry ? ` • ${position.expiry}` : ''}
                  </p>
                </div>
                <div className={cn(
                  'text-right rounded-lg px-2 py-1 transition-colors',
                  pnlPositive ? 'bg-emerald-500/10' : 'bg-red-500/10',
                  flashPnl[position.id] && 'ring-1 ring-amber-400/60',
                )}>
                  <p className={cn('text-sm font-semibold', pnlPositive ? 'text-emerald-400' : 'text-red-400')}>
                    {pnlPositive ? '+' : ''}{formatDollar(position.pnl)}
                  </p>
                  <p className={cn('text-[11px]', pnlPositive ? 'text-emerald-300/90' : 'text-red-300/90')}>
                    {pnlPositive ? '+' : ''}{position.pnlPct.toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                <Metric label="Entry" value={formatDollar(position.entryPrice)} />
                <Metric label="Current" value={formatDollar(position.currentPrice)} />
                <Metric label="Value" value={formatDollar(position.currentValue)} />
                <Metric label="Cost Basis" value={formatDollar(position.costBasis)} />
                <Metric label="DTE" value={position.daysToExpiry != null ? String(position.daysToExpiry) : '-'} />
                <Metric label="Delta" value={position.greeks?.delta != null ? position.greeks.delta.toFixed(2) : '-'} />
                <Metric label="Theta" value={position.greeks?.theta != null ? position.greeks.theta.toFixed(2) : '-'} />
                <Metric label="Vega" value={position.greeks?.vega != null ? position.greeks.vega.toFixed(2) : '-'} />
              </div>

              {advice.length > 0 && (
                <div className="space-y-2">
                  {advice.map((item, index) => (
                    <div
                      key={`${position.id}-${item.type}-${index}`}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs',
                        item.urgency === 'high'
                          ? 'bg-red-500/10 border-red-500/25 text-red-200'
                          : 'bg-amber-500/10 border-amber-500/25 text-amber-100',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
                        <p>{item.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <ActionButton label="Close" onClick={() => onSendPrompt?.(buildPositionPrompt('close', position))} />
                <ActionButton label="Roll" onClick={() => onSendPrompt?.(buildPositionPrompt('roll', position))} />
                <ActionButton label="Convert to Spread" onClick={() => onSendPrompt?.(buildPositionPrompt('spread', position))} />
                <ActionButton label="Set Stop" onClick={() => onSendPrompt?.(buildPositionPrompt('stop', position))} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5">
      <p className="text-white/40">{label}</p>
      <p className="text-white/90 mt-0.5">{value}</p>
    </div>
  )
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] px-2.5 py-1.5 rounded-md border border-white/15 text-white/75 hover:text-white hover:border-white/30 transition-colors"
    >
      {label}
    </button>
  )
}
