'use client'

import { useMemo } from 'react'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { cn } from '@/lib/utils'

type SpatialMarkerLegendProps = {
  className?: string
  showCone: boolean
  showCoach: boolean
}

export function SpatialMarkerLegend({
  className,
  showCone,
  showCoach,
}: SpatialMarkerLegendProps) {
  const { selectedSetup, tradeMode } = useSPXSetupContext()
  const showSetupLock = useMemo(() => {
    if (!selectedSetup) return false
    return tradeMode === 'in_trade' || selectedSetup.status === 'ready' || selectedSetup.status === 'triggered'
  }, [selectedSetup, tradeMode])

  if (!showCone && !showCoach && !showSetupLock) return null

  return (
    <div
      className={cn(
        'pointer-events-none rounded-lg border border-white/12 bg-[#090B0F]/78 px-2.5 py-2 backdrop-blur',
        className,
      )}
      data-testid="spx-spatial-marker-legend"
      aria-hidden
    >
      <p className="mb-1 text-[9px] uppercase tracking-[0.09em] text-white/52">Marker Key</p>
      <div className="flex flex-wrap items-center gap-2.5">
        {showCone && (
          <div className="inline-flex items-center gap-1.5 text-[10px] text-white/72">
            <span className="inline-flex h-2.5 w-2.5 rounded-full border border-[#F5EDCC88] bg-emerald-300/80" />
            Cone anchor
          </div>
        )}
        {showSetupLock && (
          <div className="inline-flex items-center gap-1.5 text-[10px] text-white/72">
            <span className="inline-flex h-3 w-3 rounded-full border border-emerald-300/70 bg-transparent" />
            Setup lock
          </div>
        )}
        {showCoach && (
          <div className="inline-flex items-center gap-1.5 text-[10px] text-white/72">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.55)]" />
            AI coach node
          </div>
        )}
      </div>
    </div>
  )
}

