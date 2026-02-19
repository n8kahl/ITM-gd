'use client'

import { useMemo, useState } from 'react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { SetupCard } from '@/components/spx-command-center/setup-card'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import { buildSetupDisplayPolicy, DEFAULT_PRIMARY_SETUP_LIMIT } from '@/lib/spx/setup-display-policy'
import type { Setup } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'

function prioritizeSelected(setups: Setup[], selectedSetupId: string | null): Setup[] {
  if (!selectedSetupId) return setups
  const selectedIndex = setups.findIndex((setup) => setup.id === selectedSetupId)
  if (selectedIndex <= 0) return setups
  const next = [...setups]
  const [selected] = next.splice(selectedIndex, 1)
  if (!selected) return setups
  next.unshift(selected)
  return next
}

export function SetupFeed({ readOnly = false }: { readOnly?: boolean }) {
  const { uxFlags } = useSPXCommandCenter()
  const { regime, prediction } = useSPXAnalyticsContext()
  const {
    activeSetups,
    selectedSetup,
    selectSetup,
    tradeMode,
    inTradeSetup,
    inTradeContract,
    tradeEntryPrice,
    tradeEntryContractMid,
    tradeCurrentContractMid,
    tradeEnteredAt,
    tradePnlPoints,
    tradePnlDollars,
    enterTrade,
    exitTrade,
  } = useSPXSetupContext()
  const { spxPrice } = useSPXPriceContext()
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
  const actionable = useMemo(
    () => prioritizeSelected(inTradeSetup ? [inTradeSetup] : policy.actionablePrimary, selectedSetup?.id || null),
    [inTradeSetup, policy.actionablePrimary, selectedSetup?.id],
  )
  const secondaryActionable = useMemo(() => {
    if (inTradeSetup) return []
    const prioritized = prioritizeSelected(policy.actionableSecondary, selectedSetup?.id || null)
    return prioritized.filter((setup) => !actionable.some((primary) => primary.id === setup.id))
  }, [actionable, inTradeSetup, policy.actionableSecondary, selectedSetup?.id])
  const hiddenByTradeFocusCount = inTradeSetup ? Math.max(policy.actionableVisibleCount - 1, 0) : 0
  const forming = inTradeSetup ? [] : policy.forming
  const selectedEnterable = Boolean(selectedSetup && (selectedSetup.status === 'ready' || selectedSetup.status === 'triggered'))
  const oneClickEntryEnabled = uxFlags.oneClickEntry && !readOnly

  const watchlistVisible = forming.length > 0 && (showWatchlist || actionable.length === 0)

  const handleOneClickEntry = (setup: Setup) => {
    selectSetup(setup)
    enterTrade(setup)
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_ONE_CLICK_ENTRY, {
      setupId: setup.id,
      setupStatus: setup.status,
      setupDirection: setup.direction,
      source: 'setup_card_cta',
      mobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    }, { persist: true })
  }

  return (
    <section className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-emerald-500/[0.02] p-3 md:p-3.5">
      <div className="pointer-events-none absolute -left-12 -top-12 h-28 w-28 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-white/60">Setup Feed</h3>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono text-white/75">
            {policy.actionablePrimaryCount} sniper
            {policy.actionableTotalCount > policy.actionablePrimaryCount
              ? ` · ${policy.actionableTotalCount} total`
              : ''}
          </span>
          <span className={cn(
            'rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]',
            tradeMode === 'in_trade'
              ? 'border-champagne/35 bg-champagne/12 text-champagne'
              : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
          )}>
            {tradeMode === 'in_trade' ? 'Trade Focus' : 'Scan'}
          </span>
        </div>
      </div>

      {readOnly && (
        <p className="relative z-10 mt-1 text-[10px] text-white/55">Monitoring mode on this surface.</p>
      )}

      {!readOnly && (
        <div className="relative z-10 mt-2 rounded-lg border border-white/12 bg-white/[0.035] px-2.5 py-2.5">
          {tradeMode === 'in_trade' && inTradeSetup ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.1em] text-emerald-200">
                  In Trade Focus · {inTradeSetup.direction} {inTradeSetup.regime}
                </p>
                <button
                  type="button"
                  onClick={() => exitTrade()}
                  className="min-h-[40px] rounded border border-rose-300/35 bg-rose-500/12 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-rose-100 transition-colors hover:bg-rose-500/22 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-300/65"
                >
                  Exit Trade
                </button>
              </div>
              <p className="text-[10px] text-white/55">
                Entry {tradeEntryPrice != null ? tradeEntryPrice.toFixed(2) : '--'}
                {' · '}
                P&L {tradePnlPoints == null ? '--' : `${tradePnlPoints >= 0 ? '+' : ''}${tradePnlPoints.toFixed(2)} pts`}
                {' · '}
                Contract {tradePnlDollars == null ? '--' : `${tradePnlDollars >= 0 ? '+' : ''}$${tradePnlDollars.toFixed(0)}`}
                {' · '}
                Started {tradeEnteredAt ? new Date(tradeEnteredAt).toLocaleTimeString() : '--'}
              </p>
              <p className="text-[9px] text-white/45">
                {inTradeContract?.description || 'No contract locked'}
                {' · '}
                Entry mid {tradeEntryContractMid != null ? tradeEntryContractMid.toFixed(2) : '--'}
                {' · '}
                Mark {tradeCurrentContractMid != null ? tradeCurrentContractMid.toFixed(2) : '--'}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-white/68">
                {oneClickEntryEnabled
                  ? 'Use the Enter Trade CTA on actionable setup cards for one-click focus.'
                  : 'Select a ready/triggered setup, then lock hyper focus when you enter.'}
              </p>
              {!oneClickEntryEnabled && (
                <button
                  type="button"
                  disabled={!selectedEnterable}
                  onClick={() => enterTrade(selectedSetup)}
                  className="min-h-[40px] rounded border border-emerald-400/35 bg-emerald-500/14 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-emerald-100 transition-colors hover:bg-emerald-500/22 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/65 disabled:opacity-40"
                >
                  Enter Trade Focus
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="relative z-10 mt-2 space-y-2 max-h-[420px] overflow-auto overscroll-contain pr-0.5">
        {activeSetups.length === 0 ? (
          <p className="text-xs text-white/55">No active setups detected.</p>
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
                    showEnterTradeCta={oneClickEntryEnabled && tradeMode !== 'in_trade'}
                    onEnterTrade={() => handleOneClickEntry(setup)}
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
                      className="w-full min-h-[40px] rounded-lg border border-white/12 bg-white/[0.02] px-2.5 py-2 text-left text-[10px] uppercase tracking-[0.08em] text-white/60 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60"
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
                    showEnterTradeCta={oneClickEntryEnabled && tradeMode !== 'in_trade'}
                    onEnterTrade={() => handleOneClickEntry(setup)}
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
                  className="w-full min-h-[40px] rounded-lg border border-white/12 bg-white/[0.02] px-2.5 py-2 text-left text-[10px] uppercase tracking-[0.08em] text-white/60 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60"
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
                showEnterTradeCta={false}
              />
            ))}
          </>
        )}
      </div>
    </section>
  )
}
