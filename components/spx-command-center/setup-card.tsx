'use client'

import { Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Setup } from '@/lib/types/spx-command-center'

function statusClass(status: Setup['status']): string {
  if (status === 'ready') return 'border-emerald-400/45 bg-emerald-500/10'
  if (status === 'triggered') return 'border-emerald-400/55 bg-emerald-500/15 animate-pulse-emerald'
  if (status === 'invalidated') return 'border-rose-400/45 bg-rose-500/10'
  if (status === 'expired') return 'border-white/20 bg-white/[0.03] opacity-60'
  return 'border-white/15 bg-white/[0.02]'
}

export function SetupCard({
  setup,
  selected,
  onSelect,
}: {
  setup: Setup
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-xl border p-3 transition-colors',
        statusClass(setup.status),
        selected && 'ring-1 ring-emerald-300/60',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/65">{setup.type.replace(/_/g, ' ')}</p>
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/55">{setup.status}</span>
      </div>

      <p className="mt-1 text-sm font-medium text-ivory capitalize">{setup.direction} {setup.regime}</p>

      <div className="mt-2 flex items-center gap-1.5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <span
            key={`${setup.id}-dot-${idx}`}
            className={cn(
              'h-1.5 w-1.5 rounded-full border border-white/20',
              idx < setup.confluenceScore ? 'bg-emerald-300 border-emerald-300/50' : 'bg-transparent',
            )}
          />
        ))}
        <span className="text-[11px] text-white/60">{setup.confluenceScore}/5</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-white/45">Entry</p>
          <p className="font-mono text-ivory">{setup.entryZone.low.toFixed(2)}-{setup.entryZone.high.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-white/45">Stop</p>
          <p className="font-mono text-rose-300">{setup.stop.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-white/45">Target 1</p>
          <p className="font-mono text-emerald-200">{setup.target1.price.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-white/45">Target 2</p>
          <p className="font-mono text-champagne">{setup.target2.price.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-white/60">
        <Target className="h-3 w-3 text-emerald-300" />
        <span>Win probability {setup.probability.toFixed(0)}%</span>
      </div>
    </button>
  )
}
