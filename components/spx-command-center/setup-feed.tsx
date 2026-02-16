'use client'

import { useMemo } from 'react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { InfoTip } from '@/components/ui/info-tip'
import { SetupCard } from '@/components/spx-command-center/setup-card'

const STATUS_PRIORITY: Record<string, number> = {
  triggered: 0,
  ready: 1,
  forming: 2,
  invalidated: 3,
  expired: 4,
}

export function SetupFeed({ readOnly = false }: { readOnly?: boolean }) {
  const { activeSetups, selectedSetup, selectSetup, spxPrice } = useSPXCommandCenter()

  const sorted = useMemo(() => {
    return [...activeSetups].sort((a, b) => {
      const statusDelta = (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99)
      if (statusDelta !== 0) return statusDelta
      if (b.confluenceScore !== a.confluenceScore) return b.confluenceScore - a.confluenceScore
      return b.probability - a.probability
    })
  }, [activeSetups])

  const analytics = useMemo(() => {
    const readyOrTriggered = sorted.filter((setup) => setup.status === 'ready' || setup.status === 'triggered')
    const highConviction = sorted.filter((setup) => setup.confluenceScore >= 4).length
    const avgProbability = sorted.length > 0
      ? sorted.reduce((acc, setup) => acc + setup.probability, 0) / sorted.length
      : 0

    return {
      actionable: readyOrTriggered.length,
      highConviction,
      avgProbability,
    }
  }, [sorted])

  return (
    <section className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-emerald-500/[0.025] p-3 md:p-4">
      <div className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative z-10 flex items-center gap-2">
        <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">Setup Feed</h3>
        <InfoTip label="How to use setup feed">
          Setups are ranked by lifecycle and confluence. Prioritize TRIGGERED and READY setups with higher confluence and probability.
        </InfoTip>
      </div>

      <div className="relative z-10 mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2 py-1.5">
          <p className="text-white/50 uppercase tracking-[0.1em]">Actionable</p>
          <p className="font-mono text-emerald-200">{analytics.actionable}</p>
        </div>
        <div className="rounded-lg border border-white/15 bg-white/[0.03] px-2 py-1.5">
          <p className="text-white/50 uppercase tracking-[0.1em]">High Conv</p>
          <p className="font-mono text-ivory">{analytics.highConviction}</p>
        </div>
        <div className="rounded-lg border border-white/15 bg-white/[0.03] px-2 py-1.5">
          <p className="text-white/50 uppercase tracking-[0.1em]">Avg Win%</p>
          <p className="font-mono text-ivory">{sorted.length > 0 ? `${analytics.avgProbability.toFixed(0)}%` : '--'}</p>
        </div>
      </div>

      {readOnly && (
        <p className="relative z-10 mt-2 text-[11px] text-white/50">
          Mobile read-only mode: execution actions are desktop-only.
        </p>
      )}

      <div className="relative z-10 mt-3 space-y-2 max-h-[320px] overflow-auto pr-1">
        {sorted.length === 0 ? (
          <p className="text-xs text-white/55">No active setups detected.</p>
        ) : (
          sorted.map((setup) => (
            <SetupCard
              key={setup.id}
              setup={setup}
              currentPrice={spxPrice}
              selected={selectedSetup?.id === setup.id}
              readOnly={readOnly}
              onSelect={() => selectSetup(setup)}
            />
          ))
        )}
      </div>
    </section>
  )
}
