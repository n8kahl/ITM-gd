'use client'

import { useMemo, useState } from 'react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { InfoTip } from '@/components/ui/info-tip'
import { SetupCard } from '@/components/spx-command-center/setup-card'

export function SetupFeed({ readOnly = false }: { readOnly?: boolean }) {
  const { activeSetups, selectedSetup, selectSetup, spxPrice } = useSPXCommandCenter()
  const [showWatchlist, setShowWatchlist] = useState(false)

  const analytics = useMemo(() => {
    const actionable = activeSetups.filter((setup) => setup.status === 'ready' || setup.status === 'triggered')
    const forming = activeSetups.filter((setup) => setup.status === 'forming')
    const avgProbability = actionable.length > 0
      ? actionable.reduce((acc, setup) => acc + setup.probability, 0) / actionable.length
      : 0

    return {
      actionable,
      forming,
      avgProbability,
    }
  }, [activeSetups])

  const canToggleWatchlist = analytics.actionable.length > 0
  const watchlistVisible = analytics.forming.length > 0 && (showWatchlist || analytics.actionable.length === 0)

  return (
    <section className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-emerald-500/[0.025] p-3 md:p-4">
      <div className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative z-10 flex items-center gap-2">
        <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">Setup Feed</h3>
        <InfoTip label="How to use setup feed">
          Actionable setups are trade-valid now. Watchlist setups are forming and should not be executed until they transition to READY or TRIGGERED.
        </InfoTip>
      </div>

      <div className="relative z-10 mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2 py-1.5">
          <p className="text-white/50 uppercase tracking-[0.1em]">Actionable</p>
          <p className="font-mono text-emerald-200">{analytics.actionable.length}</p>
        </div>
        <div className="rounded-lg border border-white/15 bg-white/[0.03] px-2 py-1.5">
          <p className="text-white/50 uppercase tracking-[0.1em]">Watchlist</p>
          <p className="font-mono text-ivory">{analytics.forming.length}</p>
        </div>
        <div className="rounded-lg border border-white/15 bg-white/[0.03] px-2 py-1.5">
          <p className="text-white/50 uppercase tracking-[0.1em]">Avg Win</p>
          <p className="font-mono text-ivory">{analytics.actionable.length > 0 ? `${analytics.avgProbability.toFixed(0)}%` : '--'}</p>
        </div>
      </div>

      {readOnly && (
        <p className="relative z-10 mt-2 text-[11px] text-white/50">
          Mobile read-only mode: execution actions are desktop-only.
        </p>
      )}

      <div className="relative z-10 mt-3 space-y-2 max-h-[320px] overflow-auto pr-1">
        {activeSetups.length === 0 ? (
          <p className="text-xs text-white/55">No active setups detected.</p>
        ) : (
          <>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-emerald-100/90">
              Actionable now ({analytics.actionable.length})
            </div>
            {analytics.actionable.length === 0 ? (
              <p className="px-1 text-xs text-white/55">No trade-valid setups yet.</p>
            ) : (
              analytics.actionable.map((setup) => (
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

            {analytics.forming.length > 0 && (
              <div className="pt-1">
                {canToggleWatchlist ? (
                  <button
                    type="button"
                    onClick={() => setShowWatchlist((prev) => !prev)}
                    className="w-full rounded-lg border border-white/15 bg-white/[0.02] px-2 py-1 text-left text-[10px] uppercase tracking-[0.12em] text-white/70 hover:text-white"
                  >
                    {watchlistVisible ? 'Hide' : 'Show'} forming watchlist ({analytics.forming.length})
                  </button>
                ) : (
                  <p className="rounded-lg border border-white/15 bg-white/[0.02] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/70">
                    Forming watchlist ({analytics.forming.length})
                  </p>
                )}
              </div>
            )}

            {watchlistVisible && (
              <>
                <p className="px-1 text-[11px] text-white/50">Forming setups are informational until confirmed.</p>
                {analytics.forming.map((setup) => (
                  <SetupCard
                    key={setup.id}
                    setup={setup}
                    currentPrice={spxPrice}
                    selected={selectedSetup?.id === setup.id}
                    readOnly={readOnly}
                    onSelect={() => selectSetup(setup)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}
