'use client'

import { cn } from '@/lib/utils'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { InfoTip } from '@/components/ui/info-tip'

function relativeAge(timestamp: string): string {
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) return '--'
  const seconds = Math.max(0, Math.floor((Date.now() - parsed) / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m`
}

export function FlowTicker() {
  const { flowEvents } = useSPXCommandCenter()
  const prioritized = [...flowEvents]
    .sort((a, b) => b.premium - a.premium)
    .slice(0, 8)

  if (flowEvents.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/55">
        Flow feed is warming up.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2">
      <div className="mb-1 flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-[0.12em] text-white/50">Flow Pulse</p>
        <InfoTip label="How to read flow pulse" panelClassName="w-64">
          Higher premium events are shown first. Combine direction, premium size, and recency with setup levels for confirmation.
        </InfoTip>
      </div>
      <div className="overflow-x-auto whitespace-nowrap">
        <div className="inline-flex items-center gap-2 text-xs">
          {prioritized.map((event) => (
          <span
            key={event.id}
            className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-1',
              event.direction === 'bullish'
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-400/35 bg-rose-500/10 text-rose-200',
            )}
          >
            <span>{event.symbol}</span>
            <span>{event.type.toUpperCase()}</span>
              <span className="font-mono">{event.strike}</span>
            <span>${Math.round(event.premium).toLocaleString()}</span>
              <span className="text-white/55">{relativeAge(event.timestamp)}</span>
          </span>
          ))}
        </div>
      </div>
    </div>
  )
}
