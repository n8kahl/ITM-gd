'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getChartData } from '@/lib/api/ai-coach'

interface DesktopContextStripProps {
  accessToken?: string
  onSendPrompt?: (prompt: string) => void
}

type MarketStatus = 'Pre-Market' | 'Open' | 'After Hours' | 'Closed'

function getMarketStatus(): MarketStatus {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Mon'
  const totalMinutes = (hour * 60) + minute

  if (weekday === 'Sat' || weekday === 'Sun') return 'Closed'
  if (totalMinutes >= 570 && totalMinutes < 960) return 'Open'
  if (totalMinutes >= 240 && totalMinutes < 570) return 'Pre-Market'
  if (totalMinutes >= 960 && totalMinutes < 1200) return 'After Hours'
  return 'Closed'
}

const STATUS_CLASSES: Record<MarketStatus, string> = {
  Open: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'Pre-Market': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'After Hours': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Closed: 'bg-white/10 text-white/60 border-white/20',
}

export function DesktopContextStrip({ accessToken, onSendPrompt }: DesktopContextStripProps) {
  const [spx, setSpx] = useState<{
    price: number | null
    change: number | null
    changePct: number | null
    isLoading: boolean
  }>({
    price: null,
    change: null,
    changePct: null,
    isLoading: true,
  })
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const status = getMarketStatus()

  const loadSPX = useCallback(async () => {
    if (!accessToken) return
    try {
      let data = await getChartData('SPX', '1m', accessToken)
      if (data.bars.length < 2) {
        data = await getChartData('SPX', '1D', accessToken)
      }
      if (data.bars.length === 0) {
        throw new Error('No bars')
      }
      const last = data.bars[data.bars.length - 1]
      const previous = data.bars.length > 1 ? data.bars[data.bars.length - 2] : null
      const change = previous ? last.close - previous.close : 0
      const changePct = previous && previous.close !== 0
        ? (change / previous.close) * 100
        : null
      setSpx({
        price: Number(last.close.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePct: changePct == null ? null : Number(changePct.toFixed(2)),
        isLoading: false,
      })
    } catch {
      setSpx((prev) => ({ ...prev, isLoading: false }))
    }
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    void loadSPX()
    const interval = window.setInterval(() => {
      void loadSPX()
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [accessToken, loadSPX])

  const isPositive = (spx.change ?? 0) >= 0

  return (
    <div className="hidden lg:flex items-center gap-3 px-4 py-2 border-b border-white/5 bg-[#0B0D10]">
      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded border shrink-0', STATUS_CLASSES[status])}>
        {status}
      </span>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-white/50">SPX</span>
        {spx.isLoading ? (
          <span className="text-white/30">...</span>
        ) : spx.price != null ? (
          <>
            <span className="text-white font-medium">{spx.price.toLocaleString()}</span>
            {spx.change != null && (
              <span className={cn('flex items-center gap-0.5', isPositive ? 'text-emerald-400' : 'text-red-400')}>
                {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {isPositive ? '+' : ''}{spx.change.toFixed(2)}
                {spx.changePct != null ? ` (${isPositive ? '+' : ''}${spx.changePct.toFixed(2)}%)` : ''}
              </span>
            )}
          </>
        ) : (
          <span className="text-white/30">Unavailable</span>
        )}
      </div>

      <div className="w-px h-4 bg-white/10" />

      <button
        type="button"
        onClick={() => {
          onSendPrompt?.('Give me the full SPX game plan: key levels, GEX profile, expected move, and what setups to watch today. Show the chart.')
        }}
        className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/60 hover:text-white hover:border-emerald-500/25 transition-colors"
      >
        SPX Game Plan
      </button>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => {
          void loadSPX()
        }}
        className="text-white/30 hover:text-white/60 transition-colors"
        aria-label="Refresh context strip"
      >
        <RefreshCw className="w-3 h-3" />
      </button>
    </div>
  )
}
