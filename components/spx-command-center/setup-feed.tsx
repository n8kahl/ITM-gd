'use client'

import { useEffect, useMemo, useReducer, useState } from 'react'
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

interface TriggeredAlertHistoryItem {
  id: string
  setupId: string
  setupType: string
  direction: Setup['direction']
  regime: Setup['regime']
  triggeredAt: string
  entryLow: number
  entryHigh: number
  stop: number
  target1: number
  target2: number
}

interface TriggeredAlertState {
  history: TriggeredAlertHistoryItem[]
  previousStatusBySetupId: Record<string, Setup['status']>
}

type TriggeredAlertAction = {
  type: 'ingest_setups'
  setups: Setup[]
}

const TRIGGER_ALERT_HISTORY_STORAGE_KEY = 'spx_command_center:trigger_alert_history'
const MAX_TRIGGER_ALERT_HISTORY = 40
const TRIGGER_ALERT_HISTORY_PREVIEW = 4

function restoreTriggeredAlertHistory(): TriggeredAlertHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(TRIGGER_ALERT_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const restored = parsed.filter((item): item is TriggeredAlertHistoryItem => (
      Boolean(item)
      && typeof (item as TriggeredAlertHistoryItem).id === 'string'
      && typeof (item as TriggeredAlertHistoryItem).setupId === 'string'
      && typeof (item as TriggeredAlertHistoryItem).triggeredAt === 'string'
      && typeof (item as TriggeredAlertHistoryItem).entryLow === 'number'
      && typeof (item as TriggeredAlertHistoryItem).entryHigh === 'number'
      && typeof (item as TriggeredAlertHistoryItem).stop === 'number'
      && typeof (item as TriggeredAlertHistoryItem).target1 === 'number'
      && typeof (item as TriggeredAlertHistoryItem).target2 === 'number'
    ))
    return restored.slice(0, MAX_TRIGGER_ALERT_HISTORY)
  } catch {
    return []
  }
}

function createTriggeredAlertState(): TriggeredAlertState {
  return {
    history: restoreTriggeredAlertHistory(),
    previousStatusBySetupId: {},
  }
}

function triggeredAlertReducer(state: TriggeredAlertState, action: TriggeredAlertAction): TriggeredAlertState {
  if (action.type !== 'ingest_setups') return state

  const nextStatusBySetupId: Record<string, Setup['status']> = {}
  const newlyTriggered: TriggeredAlertHistoryItem[] = []

  for (const setup of action.setups) {
    nextStatusBySetupId[setup.id] = setup.status
    const previousStatus = state.previousStatusBySetupId[setup.id]
    if (!previousStatus) continue
    if (previousStatus === 'triggered' || setup.status !== 'triggered') continue

    const triggeredAt = setup.statusUpdatedAt || setup.triggeredAt || new Date().toISOString()
    newlyTriggered.push({
      id: `${setup.id}:${triggeredAt}`,
      setupId: setup.id,
      setupType: setup.type,
      direction: setup.direction,
      regime: setup.regime,
      triggeredAt,
      entryLow: setup.entryZone.low,
      entryHigh: setup.entryZone.high,
      stop: setup.stop,
      target1: setup.target1.price,
      target2: setup.target2.price,
    })
  }

  if (newlyTriggered.length === 0) {
    return {
      history: state.history,
      previousStatusBySetupId: nextStatusBySetupId,
    }
  }

  const deduped = new Map<string, TriggeredAlertHistoryItem>()
  for (const item of [...newlyTriggered, ...state.history]) {
    deduped.set(item.id, item)
  }

  return {
    history: Array.from(deduped.values())
      .sort((a, b) => Date.parse(b.triggeredAt) - Date.parse(a.triggeredAt))
      .slice(0, MAX_TRIGGER_ALERT_HISTORY),
    previousStatusBySetupId: nextStatusBySetupId,
  }
}

export function SetupFeed({
  readOnly = false,
  suppressLocalPrimaryCta = false,
}: {
  readOnly?: boolean
  suppressLocalPrimaryCta?: boolean
}) {
  const { uxFlags, standbyGuidance } = useSPXCommandCenter()
  const { regime, prediction } = useSPXAnalyticsContext()
  const {
    activeSetups,
    selectedSetup,
    selectSetup,
    tradeMode,
    inTradeSetup,
    activeTradePlan,
    enterTrade,
    exitTrade,
  } = useSPXSetupContext()
  const { spxPrice } = useSPXPriceContext()
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [showMoreActionable, setShowMoreActionable] = useState(false)
  const [showAllTriggeredHistory, setShowAllTriggeredHistory] = useState(false)
  const [triggeredAlertState, dispatchTriggeredAlertState] = useReducer(
    triggeredAlertReducer,
    undefined,
    createTriggeredAlertState,
  )

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
  const standbyActive = tradeMode !== 'in_trade' && standbyGuidance?.status === 'STANDBY'
  const localPrimaryCtaEnabled = !readOnly && !suppressLocalPrimaryCta
  const oneClickEntryEnabled = uxFlags.oneClickEntry && localPrimaryCtaEnabled

  const watchlistVisible = forming.length > 0 && (showWatchlist || actionable.length === 0)
  const triggeredAlertHistory = triggeredAlertState.history
  const renderedTriggeredHistory = showAllTriggeredHistory
    ? triggeredAlertHistory
    : triggeredAlertHistory.slice(0, TRIGGER_ALERT_HISTORY_PREVIEW)

  useEffect(() => {
    dispatchTriggeredAlertState({
      type: 'ingest_setups',
      setups: activeSetups,
    })
  }, [activeSetups])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      TRIGGER_ALERT_HISTORY_STORAGE_KEY,
      JSON.stringify(triggeredAlertHistory.slice(0, MAX_TRIGGER_ALERT_HISTORY)),
    )
  }, [triggeredAlertHistory])

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
            {tradeMode === 'in_trade' ? 'In Trade' : 'Scan'}
          </span>
        </div>
      </div>

      {readOnly && (
        <p className="relative z-10 mt-1 text-[10px] text-white/55">Monitoring mode on this surface.</p>
      )}

      <div className="relative z-10 mt-2 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.08em] text-white/65">Triggered Alerts</p>
          <span className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-mono text-white/70">
            {triggeredAlertHistory.length}
          </span>
        </div>
        {renderedTriggeredHistory.length === 0 ? (
          <p className="mt-1.5 text-[10px] text-white/45">No recent trigger alerts.</p>
        ) : (
          <div className="mt-1.5 space-y-1">
            {renderedTriggeredHistory.map((item) => {
              const activeMatch = activeSetups.find((setup) => setup.id === item.setupId) || null
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!activeMatch}
                  onClick={() => {
                    if (!activeMatch) return
                    selectSetup(activeMatch)
                    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
                      surface: 'trigger_alert_history',
                      action: 'focus_setup',
                      setupId: activeMatch.id,
                    })
                  }}
                  className="w-full rounded border border-white/10 bg-white/[0.02] px-2 py-1.5 text-left text-[10px] text-white/75 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="font-mono text-[9px] text-white/55">
                    {new Date(item.triggeredAt).toLocaleTimeString()} · {item.direction.toUpperCase()} {item.setupType.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-0.5 text-[10px]">
                    Entry {item.entryLow.toFixed(2)}-{item.entryHigh.toFixed(2)} · Stop {item.stop.toFixed(2)} · T1 {item.target1.toFixed(2)} · T2 {item.target2.toFixed(2)}
                  </p>
                </button>
              )
            })}
            {triggeredAlertHistory.length > TRIGGER_ALERT_HISTORY_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllTriggeredHistory((previous) => !previous)}
                className="w-full rounded border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-white/60 transition-colors hover:text-white/85"
              >
                {showAllTriggeredHistory ? 'Show fewer alerts' : `Show all alerts (${triggeredAlertHistory.length})`}
              </button>
            )}
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="relative z-10 mt-2 rounded-lg border border-white/12 bg-white/[0.035] px-2.5 py-2.5">
          {tradeMode === 'in_trade' && inTradeSetup ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.1em] text-emerald-200">
                  In Trade · {inTradeSetup.direction} {inTradeSetup.regime}
                </p>
                {localPrimaryCtaEnabled ? (
                  <button
                    type="button"
                    onClick={() => exitTrade()}
                    className="min-h-[40px] rounded border border-rose-300/35 bg-rose-500/12 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-rose-100 transition-colors hover:bg-rose-500/22 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-300/65"
                  >
                    Exit Trade
                  </button>
                ) : (
                  <span className="text-[9px] uppercase tracking-[0.08em] text-white/45">
                    Use primary action rail
                  </span>
                )}
              </div>
              <p className="text-[10px] text-white/55">
                Entry {activeTradePlan?.entryAnchor != null ? activeTradePlan.entryAnchor.toFixed(2) : '--'}
                {' · '}
                P&L {activeTradePlan?.pnlPoints == null ? '--' : `${activeTradePlan.pnlPoints >= 0 ? '+' : ''}${activeTradePlan.pnlPoints.toFixed(2)} pts`}
                {' · '}
                Contract {activeTradePlan?.pnlDollars == null ? '--' : `${activeTradePlan.pnlDollars >= 0 ? '+' : ''}$${activeTradePlan.pnlDollars.toFixed(0)}`}
                {' · '}
                Started {activeTradePlan?.enteredAt ? new Date(activeTradePlan.enteredAt).toLocaleTimeString() : '--'}
              </p>
              <p className="text-[9px] text-white/45">
                {activeTradePlan?.contract?.description || 'No contract locked'}
                {' · '}
                Entry mid {activeTradePlan?.entryContractMid != null ? activeTradePlan.entryContractMid.toFixed(2) : '--'}
                {' · '}
                Mark {activeTradePlan?.currentContractMid != null ? activeTradePlan.currentContractMid.toFixed(2) : '--'}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-white/68">
                {!localPrimaryCtaEnabled
                  ? 'Use the mobile primary action rail to select setup and stage trade.'
                  : oneClickEntryEnabled
                  ? 'Use the Stage Trade CTA on actionable setup cards for one-click staging.'
                  : 'Select a ready/triggered setup, then stage trade with clear risk controls.'}
              </p>
              {localPrimaryCtaEnabled && !oneClickEntryEnabled && (
                <button
                  type="button"
                  disabled={!selectedEnterable}
                  onClick={() => enterTrade(selectedSetup)}
                  className="min-h-[40px] rounded border border-emerald-400/35 bg-emerald-500/14 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-emerald-100 transition-colors hover:bg-emerald-500/22 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/65 disabled:opacity-40"
                >
                  Stage Trade
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {standbyActive && standbyGuidance && (
        <div className="relative z-10 mt-2 rounded-lg border border-amber-300/30 bg-amber-500/[0.07] px-2.5 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.1em] text-amber-100">Market Standby</p>
          <p className="mt-1 text-xs text-amber-50/90">{standbyGuidance.reason}</p>
          {standbyGuidance.waitingFor.length > 0 && (
            <p className="mt-1 text-[10px] text-amber-100/85">
              Waiting for: {standbyGuidance.waitingFor.join(' · ')}
            </p>
          )}
          {standbyGuidance.nearestSetup && (
            <div className="mt-1 rounded border border-amber-200/15 bg-amber-500/[0.05] px-2 py-1.5">
              <p className="text-[10px] text-amber-100/85">
                Nearest: {standbyGuidance.nearestSetup.setupType} @ {standbyGuidance.nearestSetup.entryLevel.toFixed(2)}
              </p>
              {standbyGuidance.nearestSetup.conditionsNeeded.length > 0 && (
                <p className="mt-0.5 text-[10px] text-amber-100/70">
                  Activate on: {standbyGuidance.nearestSetup.conditionsNeeded.slice(0, 3).join(' · ')}
                </p>
              )}
            </div>
          )}
          {standbyGuidance.watchZones.length > 0 && (
            <p className="mt-1 text-[10px] text-amber-100/70">
              Watch zones: {standbyGuidance.watchZones.map((zone) => zone.level.toFixed(2)).join(', ')}
            </p>
          )}
          <p className="mt-1 text-[10px] text-amber-100/65">
            Next check: {new Date(standbyGuidance.nextCheckTime).toLocaleTimeString()}
          </p>
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
                {hiddenByTradeFocusCount} additional actionable setup{hiddenByTradeFocusCount === 1 ? '' : 's'} hidden while a trade is active.
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
