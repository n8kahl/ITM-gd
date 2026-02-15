'use client'

import { useMemo } from 'react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { SetupCard } from '@/components/spx-command-center/setup-card'

export function SetupFeed() {
  const { activeSetups, selectedSetup, selectSetup } = useSPXCommandCenter()

  const sorted = useMemo(() => {
    return [...activeSetups].sort((a, b) => b.confluenceScore - a.confluenceScore)
  }, [activeSetups])

  return (
    <section className="glass-card-heavy rounded-2xl p-3 md:p-4">
      <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">Setup Feed</h3>

      <div className="mt-3 space-y-2 max-h-[300px] overflow-auto pr-1">
        {sorted.length === 0 ? (
          <p className="text-xs text-white/55">No active setups detected.</p>
        ) : (
          sorted.map((setup) => (
            <SetupCard
              key={setup.id}
              setup={setup}
              selected={selectedSetup?.id === setup.id}
              onSelect={() => selectSetup(setup)}
            />
          ))
        )}
      </div>
    </section>
  )
}
