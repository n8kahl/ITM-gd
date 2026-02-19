'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { motion, useReducedMotion } from 'framer-motion'
import { SPXCommandCenterProvider, useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { SPXHeader } from '@/components/spx-command-center/spx-header'
import { ActionStrip } from '@/components/spx-command-center/action-strip'
import { SetupFeed } from '@/components/spx-command-center/setup-feed'
import { LevelMatrix } from '@/components/spx-command-center/level-matrix'
import { SPXChart } from '@/components/spx-command-center/spx-chart'
import { FlowTicker } from '@/components/spx-command-center/flow-ticker'
import { AICoachFeed } from '@/components/spx-command-center/ai-coach-feed'
import { ContractSelector } from '@/components/spx-command-center/contract-selector'
import { GEXLandscape } from '@/components/spx-command-center/gex-landscape'
import { GEXHeatmap } from '@/components/spx-command-center/gex-heatmap'
import { MobilePanelTabs, type MobilePanelTab } from '@/components/spx-command-center/mobile-panel-tabs'
import { SPXPanelSkeleton, SPXSkeleton } from '@/components/spx-command-center/spx-skeleton'
import { DecisionContext } from '@/components/spx-command-center/decision-context'
import { MobileBriefPanel } from '@/components/spx-command-center/mobile-brief-panel'
import { SPXCommandPalette, type SPXPaletteCommand } from '@/components/spx-command-center/command-palette'
import { CoachDock } from '@/components/spx-command-center/coach-dock'
import { CoachBottomSheet } from '@/components/spx-command-center/coach-bottom-sheet'
import { FADE_UP_VARIANT, STAGGER_CHILDREN } from '@/lib/motion-primitives'
import { resolveSPXLayoutMode } from '@/lib/spx/layout-mode'
import { SPX_SHORTCUT_EVENT } from '@/lib/spx/shortcut-events'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import { cn } from '@/lib/utils'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return target.isContentEditable
}

function CoachPreviewCard() {
  const { tradeMode, inTradeSetup } = useSPXSetupContext()
  const { coachMessages } = useSPXCoachContext()
  const latestMessage = coachMessages[0] || null

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] uppercase tracking-[0.12em] text-white/55">Coach Preview</h3>
        <span className="text-[9px] text-white/45">{tradeMode === 'in_trade' ? 'In-Trade' : 'Scan'}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-white/75">
        {latestMessage?.content || 'Coach ready. Select a setup to get contextual guidance.'}
      </p>
      {inTradeSetup && (
        <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-emerald-200/80">
          Focused: {inTradeSetup.direction} {inTradeSetup.regime}
        </p>
      )}
    </section>
  )
}

function SPXCommandCenterContent() {
  const INITIAL_SKELETON_MAX_MS = 8_000
  const isMobile = useIsMobile(768)
  const prefersReducedMotion = useReducedMotion()
  const {
    dataHealth,
    dataHealthMessage,
    gexProfile,
    isLoading,
    levels,
  } = useSPXAnalyticsContext()
  const {
    uxFlags,
  } = useSPXCommandCenter()
  const {
    activeSetups,
    selectedSetup,
    selectSetup,
    tradeMode,
    enterTrade,
    exitTrade,
  } = useSPXSetupContext()

  const [mobileTab, setMobileTab] = useState<MobilePanelTab>('chart')
  const [showLevelOverlay, setShowLevelOverlay] = useState(false)
  const [initialSkeletonExpired, setInitialSkeletonExpired] = useState(false)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showMobileCoachSheet, setShowMobileCoachSheet] = useState(false)
  const [showDesktopCoachPanel, setShowDesktopCoachPanel] = useState(false)
  const mobileReadOnly = !uxFlags.mobileFullTradeFocus
  const layoutMode = useMemo(() => resolveSPXLayoutMode({
    enabled: uxFlags.layoutStateMachine,
    tradeMode,
    selectedSetup,
  }), [selectedSetup, tradeMode, uxFlags.layoutStateMachine])
  const stateDrivenLayoutEnabled = layoutMode !== 'legacy'
  const mobileSmartStackEnabled = stateDrivenLayoutEnabled && uxFlags.mobileSmartStack
  const desktopCoachPanelOpen = layoutMode === 'scan' ? showDesktopCoachPanel : false
  const lastLayoutModeRef = useRef<string | null>(null)
  const rootVariants = prefersReducedMotion ? undefined : STAGGER_CHILDREN
  const itemVariants = prefersReducedMotion ? undefined : FADE_UP_VARIANT
  const actionableSetups = useMemo(
    () => activeSetups.filter((setup) => setup.status === 'ready' || setup.status === 'triggered'),
    [activeSetups],
  )
  const selectedActionableSetup = useMemo(
    () => (selectedSetup && (selectedSetup.status === 'ready' || selectedSetup.status === 'triggered') ? selectedSetup : null),
    [selectedSetup],
  )
  const commandPaletteCommands = useMemo<SPXPaletteCommand[]>(() => {
    if (!uxFlags.commandPalette) return []

    const topActionableSetup = actionableSetups[0] || null
    const enterTradeTarget = selectedActionableSetup || topActionableSetup
    const commands: SPXPaletteCommand[] = []

    const trackCommand = (action: string, payload?: Record<string, unknown>) => {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_SHORTCUT_USED, {
        action: `command_palette_${action}`,
        tradeMode,
        selectedSetupId: selectedSetup?.id || null,
        ...payload,
      })
    }

    if (topActionableSetup) {
      commands.push({
        id: 'select-top-setup',
        label: `Select top setup (${topActionableSetup.direction} ${topActionableSetup.regime})`,
        keywords: ['setup', 'select', 'top'],
        shortcut: 'J',
        group: 'Setups',
        run: () => {
          selectSetup(topActionableSetup)
          trackCommand('select_top_setup', { setupId: topActionableSetup.id })
        },
      })
    }

    if (activeSetups.length > 1) {
      commands.push({
        id: 'cycle-next-setup',
        label: 'Cycle to next setup',
        keywords: ['setup', 'cycle', 'next'],
        shortcut: 'J',
        group: 'Setups',
        run: () => {
          const currentIndex = selectedSetup
            ? activeSetups.findIndex((setup) => setup.id === selectedSetup.id)
            : -1
          const nextIndex = (currentIndex + 1 + activeSetups.length) % activeSetups.length
          const nextSetup = activeSetups[nextIndex]
          if (!nextSetup) return
          selectSetup(nextSetup)
          trackCommand('cycle_next_setup', { setupId: nextSetup.id })
        },
      })
    }

    commands.push({
      id: 'enter-trade-focus',
      label: enterTradeTarget ? `Enter trade focus (${enterTradeTarget.direction} ${enterTradeTarget.regime})` : 'Enter trade focus',
      keywords: ['enter', 'trade', 'focus', 'execute'],
      shortcut: 'Enter',
      group: 'Execution',
      disabled: tradeMode === 'in_trade' || !enterTradeTarget,
      run: () => {
        if (!enterTradeTarget) return
        selectSetup(enterTradeTarget)
        enterTrade(enterTradeTarget)
        trackCommand('enter_trade_focus', { setupId: enterTradeTarget.id })
      },
    })

    commands.push({
      id: 'exit-trade-focus',
      label: 'Exit trade focus',
      keywords: ['exit', 'close', 'trade', 'focus'],
      shortcut: 'Esc',
      group: 'Execution',
      disabled: tradeMode !== 'in_trade',
      run: () => {
        exitTrade()
        trackCommand('exit_trade_focus')
      },
    })

    commands.push({
      id: 'toggle-level-overlay',
      label: showLevelOverlay ? 'Hide level overlay' : 'Show level overlay',
      keywords: ['level', 'overlay', 'matrix'],
      shortcut: 'L',
      group: 'View',
      run: () => {
        setShowLevelOverlay((previous) => !previous)
        trackCommand('toggle_level_overlay', { nextState: !showLevelOverlay })
      },
    })

    commands.push({
      id: 'toggle-flow-panel',
      label: 'Toggle flow expansion',
      keywords: ['flow', 'ticker', 'toggle'],
      shortcut: 'F',
      group: 'View',
      run: () => {
        window.dispatchEvent(new CustomEvent(SPX_SHORTCUT_EVENT.FLOW_TOGGLE))
        trackCommand('toggle_flow_panel')
      },
    })

    commands.push({
      id: 'coach-risk-check',
      label: 'Ask coach: Risk check',
      keywords: ['coach', 'risk', 'quick action'],
      shortcut: '2',
      group: 'Coach',
      run: () => {
        window.dispatchEvent(new CustomEvent(SPX_SHORTCUT_EVENT.COACH_QUICK_ACTION, {
          detail: { index: 1, source: 'command_palette' },
        }))
        trackCommand('coach_risk_check')
      },
    })

    commands.push({
      id: 'coach-exit-strategy',
      label: 'Ask coach: Exit strategy',
      keywords: ['coach', 'exit', 'quick action'],
      shortcut: '3',
      group: 'Coach',
      run: () => {
        window.dispatchEvent(new CustomEvent(SPX_SHORTCUT_EVENT.COACH_QUICK_ACTION, {
          detail: { index: 2, source: 'command_palette' },
        }))
        trackCommand('coach_exit_strategy')
      },
    })

    commands.push({
      id: 'show-shortcuts-help',
      label: 'Show keyboard shortcuts help',
      keywords: ['keyboard', 'help', 'shortcuts'],
      shortcut: '?',
      group: 'Help',
      run: () => {
        setShowShortcutHelp(true)
        trackCommand('shortcut_help_open')
      },
    })

    return commands
  }, [
    actionableSetups,
    activeSetups,
    enterTrade,
    exitTrade,
    selectSetup,
    selectedActionableSetup,
    selectedSetup,
    showLevelOverlay,
    tradeMode,
    uxFlags.commandPalette,
  ])
  const handleMobileTabChange = (next: MobilePanelTab) => {
    setMobileTab(next)
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'mobile_tabs',
      tab: next,
    })
  }

  const handleMobileCoachSheetChange = (nextOpen: boolean) => {
    setShowMobileCoachSheet(nextOpen)
    trackSPXTelemetryEvent(
      nextOpen ? SPX_TELEMETRY_EVENT.COACH_DOCK_OPENED : SPX_TELEMETRY_EVENT.COACH_DOCK_COLLAPSED,
      {
        surface: 'mobile',
        layoutMode,
        tradeMode,
        selectedSetupId: selectedSetup?.id || null,
      },
      { persist: true },
    )
  }

  const handleDesktopCoachDockToggle = () => {
    setShowDesktopCoachPanel((previous) => {
      const nextOpen = !previous
      trackSPXTelemetryEvent(
        nextOpen ? SPX_TELEMETRY_EVENT.COACH_DOCK_OPENED : SPX_TELEMETRY_EVENT.COACH_DOCK_COLLAPSED,
        {
          surface: 'desktop',
          layoutMode,
          tradeMode,
          selectedSetupId: selectedSetup?.id || null,
        },
        { persist: true },
      )
      return nextOpen
    })
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setInitialSkeletonExpired(true)
    }, INITIAL_SKELETON_MAX_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    if (!uxFlags.keyboardShortcuts && !uxFlags.commandPalette) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (uxFlags.commandPalette && (event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        setShowCommandPalette(true)
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_SHORTCUT_USED, {
          action: 'command_palette_open',
          key: 'cmd_or_ctrl+k',
          tradeMode,
          selectedSetupId: selectedSetup?.id || null,
        })
        return
      }
      if (showCommandPalette) return
      if (!uxFlags.keyboardShortcuts) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const actionableSetups = activeSetups
      const currentIndex = selectedSetup
        ? actionableSetups.findIndex((setup) => setup.id === selectedSetup.id)
        : -1

      const trackShortcut = (action: string, payload?: Record<string, unknown>) => {
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_SHORTCUT_USED, {
          action,
          key,
          tradeMode,
          selectedSetupId: selectedSetup?.id || null,
          ...payload,
        })
      }

      if (key === '?') {
        event.preventDefault()
        setShowShortcutHelp(true)
        trackShortcut('shortcut_help_open')
        return
      }

      if (key === 'escape') {
        event.preventDefault()
        if (showShortcutHelp) {
          setShowShortcutHelp(false)
          trackShortcut('shortcut_help_close')
          return
        }
        if (tradeMode === 'in_trade') {
          exitTrade()
          trackShortcut('exit_trade_focus')
          return
        }
        selectSetup(null)
        trackShortcut('deselect_setup')
        return
      }

      if (key === 'j' || key === 'k') {
        event.preventDefault()
        if (actionableSetups.length === 0) return
        const delta = key === 'j' ? 1 : -1
        const baseline = currentIndex >= 0 ? currentIndex : (delta > 0 ? -1 : 0)
        const nextIndex = (baseline + delta + actionableSetups.length) % actionableSetups.length
        const nextSetup = actionableSetups[nextIndex]
        if (!nextSetup) return
        selectSetup(nextSetup)
        trackShortcut('cycle_setup', { nextSetupId: nextSetup.id, nextStatus: nextSetup.status })
        return
      }

      if (key === 'enter') {
        if (!selectedSetup) return
        event.preventDefault()
        if (tradeMode === 'scan' && (selectedSetup.status === 'ready' || selectedSetup.status === 'triggered')) {
          enterTrade(selectedSetup)
          trackShortcut('enter_trade_focus', { setupId: selectedSetup.id })
          return
        }
        selectSetup(selectedSetup)
        trackShortcut('select_setup', { setupId: selectedSetup.id })
        return
      }

      if (key >= '1' && key <= '4') {
        event.preventDefault()
        const index = Number(key) - 1
        window.dispatchEvent(new CustomEvent(SPX_SHORTCUT_EVENT.COACH_QUICK_ACTION, {
          detail: { index, source: 'keyboard' },
        }))
        trackShortcut('coach_quick_action', { quickActionIndex: index + 1 })
        return
      }

      if (key === 'l') {
        event.preventDefault()
        setShowLevelOverlay((previous) => !previous)
        trackShortcut('toggle_level_overlay', { nextState: !showLevelOverlay })
        return
      }

      if (key === 'f') {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent(SPX_SHORTCUT_EVENT.FLOW_TOGGLE))
        trackShortcut('toggle_flow_panel')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    activeSetups,
    enterTrade,
    exitTrade,
    selectSetup,
    selectedSetup,
    showCommandPalette,
    showLevelOverlay,
    showShortcutHelp,
    tradeMode,
    uxFlags.commandPalette,
    uxFlags.keyboardShortcuts,
  ])

  useEffect(() => {
    if (!stateDrivenLayoutEnabled) return
    if (lastLayoutModeRef.current === layoutMode) return

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_LAYOUT_MODE_CHANGED, {
      mode: layoutMode,
      tradeMode,
      selectedSetupId: selectedSetup?.id || null,
      selectedSetupStatus: selectedSetup?.status || null,
      mobile: isMobile,
      mobileSmartStackEnabled,
    }, { persist: true })
    lastLayoutModeRef.current = layoutMode
  }, [
    isMobile,
    layoutMode,
    mobileSmartStackEnabled,
    selectedSetup?.id,
    selectedSetup?.status,
    stateDrivenLayoutEnabled,
    tradeMode,
  ])

  const shouldShowInitialSkeleton = !initialSkeletonExpired && isLoading && activeSetups.length === 0 && levels.length === 0

  if (shouldShowInitialSkeleton) {
    return <SPXSkeleton />
  }

  return (
    <motion.div
      variants={rootVariants}
      initial={prefersReducedMotion ? false : 'initial'}
      animate={prefersReducedMotion ? false : 'animate'}
      className="space-y-3"
    >
      {/* ─── TIER 1: Sniper Briefing ─── */}
      <motion.div variants={itemVariants}>
        <SPXHeader />
      </motion.div>

      {dataHealth !== 'healthy' && (
        <motion.div
          variants={itemVariants}
          className={
            dataHealth === 'degraded'
              ? 'rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100'
              : 'rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100'
          }
        >
          SPX data health: {dataHealth}. {dataHealthMessage || 'Recovering feeds.'}
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <ActionStrip />
      </motion.div>

      {/* ─── TIER 2: Battlefield ─── */}
      {isMobile ? (
        <motion.div variants={itemVariants} className="space-y-3">
          {mobileSmartStackEnabled ? (
            <div
              className={cn('space-y-2.5', uxFlags.coachDockV1 && 'pb-24')}
              data-testid="spx-mobile-smart-stack"
            >
              <div className="sticky top-2 z-10 flex items-center justify-between rounded-xl border border-white/10 bg-[#0A0C10]/90 px-3.5 py-2.5 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.1em] text-white/68">Mobile Command Stack</p>
                <span className="rounded border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-200">
                  {layoutMode.replace('_', ' ')}
                </span>
              </div>
              <MobileBriefPanel readOnly={mobileReadOnly} />
              <SetupFeed readOnly={mobileReadOnly} />
              {!uxFlags.coachDockV1 && <AICoachFeed readOnly={mobileReadOnly} />}
              {(layoutMode === 'evaluate' || layoutMode === 'in_trade') && (
                <ContractSelector readOnly={mobileReadOnly} />
              )}
              <SPXChart />
              <FlowTicker />
              {layoutMode !== 'in_trade' && <DecisionContext />}
              <details className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                <summary className="flex min-h-[40px] cursor-pointer list-none items-center text-[10px] uppercase tracking-[0.1em] text-white/55 hover:text-white/75">
                  Deep Analytics
                </summary>
                <div className="mt-2.5 space-y-2.5">
                  <LevelMatrix />
                  <GEXLandscape profile={gexProfile?.combined || null} />
                  <GEXHeatmap spx={gexProfile?.spx || null} spy={gexProfile?.spy || null} />
                </div>
              </details>
            </div>
          ) : (
            <>
              <MobilePanelTabs active={mobileTab} onChange={handleMobileTabChange} />

              {mobileTab === 'brief' && <MobileBriefPanel readOnly={mobileReadOnly} />}

              {mobileTab === 'chart' && (
                <>
                  <SPXChart />
                  <FlowTicker />
                  <DecisionContext />
                </>
              )}

              {mobileTab === 'setups' && (
                <div className="space-y-2.5">
                  <SetupFeed readOnly={mobileReadOnly} />
                  <ContractSelector readOnly={mobileReadOnly} />
                </div>
              )}

              {mobileTab === 'coach' && (
                <div className="space-y-2.5">
                  <AICoachFeed readOnly={mobileReadOnly} />
                </div>
              )}

              {mobileTab === 'levels' && (
                <div className="space-y-2.5">
                  <LevelMatrix />
                  <GEXLandscape profile={gexProfile?.combined || null} />
                  <GEXHeatmap spx={gexProfile?.spx || null} spy={gexProfile?.spy || null} />
                </div>
              )}
            </>
          )}

          {mobileSmartStackEnabled && uxFlags.coachDockV1 && (
            <>
              <div className="pointer-events-none fixed inset-x-2 bottom-2 z-[68]">
                <div className="pointer-events-auto">
                  <CoachDock
                    surface="mobile"
                    isOpen={showMobileCoachSheet}
                    onToggle={() => handleMobileCoachSheetChange(!showMobileCoachSheet)}
                  />
                </div>
              </div>
              <CoachBottomSheet
                open={showMobileCoachSheet}
                onOpenChange={handleMobileCoachSheetChange}
              >
                <AICoachFeed readOnly={mobileReadOnly} />
              </CoachBottomSheet>
            </>
          )}
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}>
          {!initialSkeletonExpired && isLoading && levels.length === 0 ? (
            <SPXPanelSkeleton />
          ) : (
            <PanelGroup direction="horizontal" className="min-h-[68vh]" data-testid={stateDrivenLayoutEnabled ? 'spx-desktop-state-driven' : undefined}>
              {/* ─── LEFT: Battlefield (chart + flow + context) ─── */}
              <Panel defaultSize={stateDrivenLayoutEnabled && layoutMode === 'scan' ? 64 : 60} minSize={45}>
                <div className="relative h-full space-y-2.5 pr-1">
                  <SPXChart />
                  <FlowTicker />
                  {(!stateDrivenLayoutEnabled || layoutMode !== 'in_trade') && <DecisionContext />}

                  {/* Level matrix overlay */}
                  {showLevelOverlay && (
                    <div className="absolute inset-0 z-20 flex items-start justify-end bg-black/50 p-3 backdrop-blur-[2px]">
                      <div className="max-h-full w-[460px] overflow-auto rounded-xl border border-white/15 bg-[#090B0F]/95 p-3 shadow-2xl">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-white/65">Level Matrix</p>
                          <button
                            type="button"
                            onClick={() => {
                              setShowLevelOverlay(false)
                              trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.LEVEL_MAP_INTERACTION, {
                                action: 'overlay_close',
                                surface: 'desktop',
                              })
                            }}
                            className="rounded border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white/65 hover:text-white"
                          >
                            Close
                          </button>
                        </div>
                        <LevelMatrix />
                      </div>
                    </div>
                  )}
                </div>
              </Panel>

              <PanelResizeHandle className="w-2 bg-transparent transition-colors hover:bg-emerald-500/15 active:bg-emerald-500/25 cursor-col-resize" />

              {/* ─── RIGHT: Setups + Contract + Coach ─── */}
              <Panel defaultSize={stateDrivenLayoutEnabled && layoutMode === 'scan' ? 36 : 40} minSize={30}>
                <div className="h-full space-y-2.5 overflow-auto pl-1">
                  {stateDrivenLayoutEnabled && layoutMode === 'scan' && (
                    uxFlags.coachDockV1 ? (
                      <div className="sticky top-0 z-10 bg-[#07090D]/90 pb-2 backdrop-blur">
                        <CoachDock
                          surface="desktop"
                          isOpen={desktopCoachPanelOpen}
                          onToggle={handleDesktopCoachDockToggle}
                        />
                        {desktopCoachPanelOpen ? (
                          <div className="mt-2">
                            <AICoachFeed />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <CoachPreviewCard />
                    )
                  )}

                  <SetupFeed />
                  {!stateDrivenLayoutEnabled ? (
                    <>
                      <ContractSelector />
                      <AICoachFeed />
                    </>
                  ) : layoutMode === 'scan' ? (
                    null
                  ) : (
                    <>
                      <AICoachFeed />
                      <ContractSelector />
                    </>
                  )}

                  {(!stateDrivenLayoutEnabled || layoutMode === 'evaluate') && (
                    <details
                      className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2"
                      onToggle={(event) => {
                        const expanded = (event.currentTarget as HTMLDetailsElement).open
                        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
                          surface: 'advanced_analytics',
                          action: expanded ? 'expand' : 'collapse',
                          layoutMode,
                        })
                      }}
                    >
                      <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.1em] text-white/50 hover:text-white/70">
                        Advanced GEX · Basis · Analytics
                      </summary>
                      <div className="mt-2.5 space-y-2.5">
                        <GEXLandscape profile={gexProfile?.combined || null} />
                        <GEXHeatmap spx={gexProfile?.spx || null} spy={gexProfile?.spy || null} />
                      </div>
                    </details>
                  )}
                </div>
              </Panel>
            </PanelGroup>
          )}
        </motion.div>
      )}

      {uxFlags.keyboardShortcuts && showShortcutHelp && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/20 bg-[#090B0F] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.12em] text-ivory">Keyboard Shortcuts</h2>
              <button
                type="button"
                onClick={() => setShowShortcutHelp(false)}
                className="rounded border border-white/20 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-white/70 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="space-y-1.5 text-[12px] text-white/80">
              <p><span className="font-mono text-emerald-200">J / K</span> cycle setups</p>
              <p><span className="font-mono text-emerald-200">Enter</span> enter trade focus on selected actionable setup</p>
              <p><span className="font-mono text-emerald-200">Esc</span> exit focus or clear selection</p>
              <p><span className="font-mono text-emerald-200">1-4</span> coach quick actions</p>
              <p><span className="font-mono text-emerald-200">L</span> toggle level overlay</p>
              <p><span className="font-mono text-emerald-200">F</span> toggle flow expansion</p>
              <p><span className="font-mono text-emerald-200">?</span> open this help</p>
            </div>
          </div>
        </div>
      )}

      {uxFlags.commandPalette && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            data-testid="spx-command-palette-trigger"
            onClick={() => setShowCommandPalette(true)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em] text-white/70 hover:bg-white/[0.06] hover:text-white"
          >
            <span className="rounded border border-white/20 bg-black/30 px-1.5 py-0.5 text-[9px]">⌘K</span>
            Command Palette
          </button>
        </div>
      )}

      <SPXCommandPalette
        open={showCommandPalette}
        commands={commandPaletteCommands}
        onOpenChange={setShowCommandPalette}
      />
    </motion.div>
  )
}

export default function SPXCommandCenterPage() {
  return (
    <SPXCommandCenterProvider>
      <SPXCommandCenterContent />
    </SPXCommandCenterProvider>
  )
}
