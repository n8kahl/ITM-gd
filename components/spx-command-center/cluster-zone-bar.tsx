'use client'

import type { ClusterZone } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'

function zoneClass(type: ClusterZone['type']): string {
  if (type === 'fortress') return 'bg-emerald-500/30 border-emerald-400/45'
  if (type === 'defended') return 'bg-emerald-500/20 border-emerald-400/35'
  if (type === 'moderate') return 'bg-white/10 border-white/20'
  return 'bg-white/[0.03] border-white/10'
}

export function ClusterZoneBar({ zones }: { zones: ClusterZone[] }) {
  if (zones.length === 0) {
    return <p className="text-xs text-white/55">No cluster zones available.</p>
  }

  const maxScore = Math.max(...zones.map((zone) => zone.clusterScore), 1)

  return (
    <div className="space-y-2">
      {zones.slice(0, 8).map((zone) => {
        const width = Math.max(12, (zone.clusterScore / maxScore) * 100)

        return (
          <div key={zone.id} className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-white/65">
              <span className="font-mono">{zone.priceLow.toFixed(2)} - {zone.priceHigh.toFixed(2)}</span>
              <span className="uppercase">{zone.type}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/[0.04] border border-white/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full border-r', zoneClass(zone.type))}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
