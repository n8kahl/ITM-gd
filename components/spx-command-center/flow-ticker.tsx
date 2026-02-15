'use client'

import { cn } from '@/lib/utils'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'

export function FlowTicker() {
  const { flowEvents } = useSPXCommandCenter()

  if (flowEvents.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/55">
        Flow feed is warming up.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2 overflow-x-auto whitespace-nowrap">
      <div className="inline-flex items-center gap-2 text-xs">
        {flowEvents.map((event) => (
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
          </span>
        ))}
      </div>
    </div>
  )
}
