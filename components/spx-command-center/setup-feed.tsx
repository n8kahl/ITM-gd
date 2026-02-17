'use client'

import { useMemo, useState } from 'react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { SetupCard } from '@/components/spx-command-center/setup-card'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'

export function SetupFeed({ readOnly = false }: { readOnly?: boolean }) {
  const { activeSetups, selectedSetup, selectSetup, spxPrice } = useSPXCommandCenter()
  const [showWatchlist, setShowWatchlist] = useState(false)

  const { actionable, forming } = useMemo(() => ({
    actionable: activeSetups.filter((s) => s.status === 'ready' || s.status === 'triggered'),
    forming: activeSetups.filter((s) => s.status === 'forming'),
  }), [activeSetups])

  const watchlistVisible = forming.length > 0 && (showWatchlist || actionable.length === 0)

  return (
    <section className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-emerald-500/[0.02] p-3">
      <div className="pointer-events-none absolute -left-12 -top-12 h-28 w-28 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-white/60">Setup Feed</h3>
        <span className="text-[10px] font-mono text-emerald-200/80">
          {actionable.length} actionable
        </span>
      </div>

      {readOnly && (
        <p className="relative z-10 mt-1 text-[10px] text-white/40">Mobile read-only mode.</p>
      )}

      <div className="relative z-10 mt-2 space-y-2 max-h-[420px] overflow-auto pr-0.5">
        {activeSetups.length === 0 ? (
          <p className="text-xs text-white/45">No active setups detected.</p>
        ) : (
          <>
            {actionable.length === 0 ? (
              <p className="px-1 text-xs text-white/45">No trade-valid setups yet.</p>
            ) : (
              actionable.map((setup) => (
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

            {forming.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowWatchlist((p) => !p)
                    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
                      surface: 'setup_feed_watchlist',
                      action: watchlistVisible ? 'collapse' : 'expand',
                      formingCount: forming.length,
                    })
                  }}
                  className="w-full rounded-lg border border-white/12 bg-white/[0.02] px-2 py-1 text-left text-[9px] uppercase tracking-[0.1em] text-white/50 hover:text-white/70"
                >
                  {watchlistVisible ? 'Hide' : 'Show'} forming watchlist ({forming.length})
                </button>
              </div>
            )}

            {watchlistVisible && forming.map((setup) => (
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
      </div>
    </section>
  )
}
