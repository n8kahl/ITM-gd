'use client'

import { useMemo, useState } from 'react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { SetupCard } from '@/components/spx-command-center/setup-card'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import { buildSetupDisplayPolicy, DEFAULT_PRIMARY_SETUP_LIMIT } from '@/lib/spx/setup-display-policy'

export function SetupFeed({ readOnly = false }: { readOnly?: boolean }) {
  const {
    activeSetups,
    selectedSetup,
    selectSetup,
    spxPrice,
    regime,
    prediction,
    tradeMode,
    inTradeSetup,
    tradeEntryPrice,
    tradeEnteredAt,
    tradePnlPoints,
    enterTrade,
    exitTrade,
  } = useSPXCommandCenter()
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [showMoreActionable, setShowMoreActionable] = useState(false)

  const policy = useMemo(
    () => buildSetupDisplayPolicy({
      setups: activeSetups,
      regime,
      prediction,
      selectedSetup,
      primaryLimit: DEFAULT_PRIMARY_SETUP_LIMIT,
    }),
    [activeSetups, regime, prediction, selectedSetup],
  )
  const actionable = inTradeSetup ? [inTradeSetup] : policy.actionablePrimary
  const secondaryActionable = inTradeSetup ? [] : policy.actionableSecondary
  const hiddenByTradeFocusCount = inTradeSetup ? Math.max(policy.actionableVisibleCount - 1, 0) : 0
  const forming = inTradeSetup ? [] : policy.forming
  const selectedEnterable = Boolean(selectedSetup && (selectedSetup.status === 'ready' || selectedSetup.status === 'triggered'))

  const watchlistVisible = forming.length > 0 && (showWatchlist || actionable.length === 0)

  return (
    <section className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-emerald-500/[0.02] p-3">
      <div className="pointer-events-none absolute -left-12 -top-12 h-28 w-28 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-white/60">Setup Feed</h3>
        <span className="text-[10px] font-mono text-emerald-200/80">
          {policy.actionableVisibleCount} actionable
        </span>
      </div>

      {readOnly && (
        <p className="relative z-10 mt-1 text-[10px] text-white/40">Mobile read-only mode.</p>
      )}

      {!readOnly && (
        <div className="relative z-10 mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
          {tradeMode === 'in_trade' && inTradeSetup ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.1em] text-emerald-200">
                  In Trade Focus · {inTradeSetup.direction} {inTradeSetup.regime}
                </p>
                <button
                  type="button"
                  onClick={() => exitTrade()}
                  className="rounded border border-rose-300/35 bg-rose-500/12 px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] text-rose-100 hover:bg-rose-500/22"
                >
                  Exit Focus
                </button>
              </div>
              <p className="text-[10px] text-white/55">
                Entry {tradeEntryPrice != null ? tradeEntryPrice.toFixed(2) : '--'}
                {' · '}
                P&L {tradePnlPoints == null ? '--' : `${tradePnlPoints >= 0 ? '+' : ''}${tradePnlPoints.toFixed(2)} pts`}
                {' · '}
                Started {tradeEnteredAt ? new Date(tradeEnteredAt).toLocaleTimeString() : '--'}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-white/60">
                Select a ready/triggered setup, then lock hyper focus when you enter.
              </p>
              <button
                type="button"
                disabled={!selectedEnterable}
                onClick={() => enterTrade(selectedSetup)}
                className="rounded border border-emerald-400/35 bg-emerald-500/14 px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-100 disabled:opacity-40"
              >
                Enter Trade Focus
              </button>
            </div>
          )}
        </div>
      )}

      <div className="relative z-10 mt-2 space-y-2 max-h-[420px] overflow-auto pr-0.5">
        {activeSetups.length === 0 ? (
          <p className="text-xs text-white/45">No active setups detected.</p>
        ) : (
          <>
            {actionable.length === 0 ? (
              <p className="px-1 text-xs text-white/45">
                {policy.compressionFilterActive
                  ? `No ${policy.directionalBias || ''} setups in sniper scope. Waiting for alignment.`
                  : 'No trade-valid setups yet.'}
              </p>
            ) : (
              <>
                {actionable.map((setup) => (
                  <SetupCard
                    key={setup.id}
                    setup={setup}
                    currentPrice={spxPrice}
                    selected={selectedSetup?.id === setup.id}
                    readOnly={readOnly}
                    onSelect={() => selectSetup(setup)}
                  />
                ))}

                {secondaryActionable.length > 0 && !readOnly && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreActionable((p) => !p)
                        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
                          surface: 'setup_feed_secondary_actionable',
                          action: showMoreActionable ? 'collapse' : 'expand',
                          count: secondaryActionable.length,
                        })
                      }}
                      className="w-full rounded-lg border border-white/12 bg-white/[0.02] px-2 py-1 text-left text-[9px] uppercase tracking-[0.1em] text-white/50 hover:text-white/70"
                    >
                      {showMoreActionable ? 'Hide' : 'Show'} other actionable ({secondaryActionable.length})
                    </button>
                  </div>
                )}

                {showMoreActionable && secondaryActionable.map((setup) => (
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

            {policy.hiddenOppositeCount > 0 && (
              <p className="px-1 text-[10px] text-white/40">
                {policy.hiddenOppositeCount} opposite-direction setup{policy.hiddenOppositeCount === 1 ? '' : 's'} hidden for compression focus.
              </p>
            )}

            {hiddenByTradeFocusCount > 0 && (
              <p className="px-1 text-[10px] text-white/40">
                {hiddenByTradeFocusCount} additional actionable setup{hiddenByTradeFocusCount === 1 ? '' : 's'} hidden while in-trade focus is active.
              </p>
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
