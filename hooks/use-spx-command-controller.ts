'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { useChartCoordinates } from '@/hooks/use-chart-coordinates'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useSPXCommandRegistry } from '@/hooks/use-spx-command-registry'
import { FADE_UP_VARIANT, STAGGER_CHILDREN } from '@/lib/motion-primitives'
import type { SPXCommandId } from '@/lib/spx/commands'
import { formatSPXFeedFallbackReasonCode } from '@/lib/spx/feed-health'
import type { SPXLayoutMode } from '@/lib/spx/layout-mode'
import { resolveSPXLayoutMode } from '@/lib/spx/layout-mode'
import {
  evaluateSPXRiskEnvelopeEntryGate,
  formatSPXRiskEnvelopeReason,
} from '@/lib/spx/risk-envelope'
import {
  SPX_OVERLAY_PRESET_STATE,
  resolveOverlayPresetFromState,
  type SPXOverlayPreset,
} from '@/lib/spx/overlay-presets'
import type { SPXReplaySpeed, SPXReplayWindowMinutes } from '@/lib/spx/replay-engine'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type { Setup } from '@/lib/types/spx-command-center'
import type { MobilePanelTab } from '@/components/spx-command-center/mobile-panel-tabs'
import { useReducedMotion } from 'framer-motion'

type SPXViewMode = 'classic' | 'spatial'
type SPXPrimaryActionMode = 'scan' | 'evaluate' | 'in_trade'
type SPXFocusMode = 'decision' | 'execution' | 'risk_only'
const SPX_VIEW_MODE_STORAGE_KEY = 'spx.command_center:view_mode'
const SPX_FOCUS_MODE_STORAGE_KEY = 'spx.command_center:focus_mode'
const INITIAL_SKELETON_MAX_MS = 8_000

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (tag === 'button' || tag === 'a') return true
  if (target.getAttribute('role') === 'button') return true
  return target.isContentEditable
}

function isActionableSetup(setup: Setup | null): boolean {
  if (!setup) return false
  return setup.status === 'ready' || setup.status === 'triggered'
}

export function useSPXCommandController() {
  const isMobile = useIsMobile(768)
  const prefersReducedMotion = useReducedMotion()
  const {
    dataHealth,
    dataHealthMessage,
    feedFallbackReasonCode,
    feedFallbackStage,
    blockTradeEntryByFeedTrust,
    gexProfile,
    isLoading,
    levels,
  } = useSPXAnalyticsContext()
  const { uxFlags } = useSPXCommandCenter()
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
  const [showAdvancedHud, setShowAdvancedHud] = useState(false)
  const [initialSkeletonExpired, setInitialSkeletonExpired] = useState(false)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showMobileCoachSheet, setShowMobileCoachSheet] = useState(false)
  const [showDesktopCoachPanel, setShowDesktopCoachPanel] = useState(false)
  const [showAllRelevantLevels, setShowAllRelevantLevels] = useState(false)
  const [displayedLevelsCount, setDisplayedLevelsCount] = useState(0)
  const [totalLevelsCount, setTotalLevelsCount] = useState(0)
  const [immersiveMode, setImmersiveMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showCone, setShowCone] = useState(true)
  const [showSpatialCoach, setShowSpatialCoach] = useState(false)
  const [showGEXGlow, setShowGEXGlow] = useState(true)
  const [latestChartBarTimeSec, setLatestChartBarTimeSec] = useState<number | null>(null)
  const [spatialThrottled, setSpatialThrottled] = useState(false)
  const [viewMode, setViewMode] = useState<SPXViewMode>(() => {
    if (typeof window === 'undefined') return 'classic'
    const stored = window.localStorage.getItem(SPX_VIEW_MODE_STORAGE_KEY)
    return stored === 'spatial' ? 'spatial' : 'classic'
  })
  const [focusMode, setFocusMode] = useState<SPXFocusMode>(() => {
    if (typeof window === 'undefined') return 'decision'
    const stored = window.localStorage.getItem(SPX_FOCUS_MODE_STORAGE_KEY)
    if (stored === 'execution' || stored === 'risk_only') return stored
    return 'decision'
  })
  const [replayEnabled, setReplayEnabled] = useState(false)
  const [replayPlaying, setReplayPlaying] = useState(false)
  const [replayWindowMinutes, setReplayWindowMinutes] = useState<SPXReplayWindowMinutes>(60)
  const [replaySpeed, setReplaySpeed] = useState<SPXReplaySpeed>(1)

  const mobileReadOnly = !uxFlags.mobileFullTradeFocus
  const layoutMode = useMemo<SPXLayoutMode>(() => resolveSPXLayoutMode({
    enabled: uxFlags.layoutStateMachine,
    tradeMode,
    selectedSetup,
  }), [selectedSetup, tradeMode, uxFlags.layoutStateMachine])
  const stateDrivenLayoutEnabled = layoutMode !== 'legacy'
  const mobileSmartStackEnabled = stateDrivenLayoutEnabled && uxFlags.mobileSmartStack
  const desktopCoachPanelOpen = layoutMode === 'scan' ? showDesktopCoachPanel : false

  const lastLayoutModeRef = useRef<string | null>(null)
  const frameTimesRef = useRef<number[]>([])
  const frameSlowStreakRef = useRef(0)
  const frameFastStreakRef = useRef(0)
  const frameMonitorStartedAtRef = useRef<number | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const chartCanvasRef = useRef<HTMLDivElement | null>(null)
  const rootVariants = prefersReducedMotion ? undefined : STAGGER_CHILDREN
  const itemVariants = prefersReducedMotion ? undefined : FADE_UP_VARIANT
  const { coordinatesRef, invalidate: invalidateChartCoordinates } = useChartCoordinates(
    chartRef,
    candlestickSeriesRef,
    chartCanvasRef,
  )

  const actionableSetups = useMemo(
    () => activeSetups.filter((setup) => setup.status === 'ready' || setup.status === 'triggered'),
    [activeSetups],
  )
  const overlayPreset = useMemo(
    () => resolveOverlayPresetFromState({
      showCone,
      showSpatialCoach,
      showGEXGlow,
    }),
    [showCone, showGEXGlow, showSpatialCoach],
  )
  const selectedActionableSetup = useMemo(
    () => (selectedSetup && isActionableSetup(selectedSetup) ? selectedSetup : null),
    [selectedSetup],
  )
  const primaryActionTargetSetup = useMemo(
    () => selectedActionableSetup || actionableSetups[0] || null,
    [actionableSetups, selectedActionableSetup],
  )
  const primaryEntryRiskGate = useMemo(() => evaluateSPXRiskEnvelopeEntryGate({
    setup: primaryActionTargetSetup,
    feedTrustBlocked: blockTradeEntryByFeedTrust,
  }), [blockTradeEntryByFeedTrust, primaryActionTargetSetup])
  const primaryActionMode = useMemo<SPXPrimaryActionMode>(() => {
    if (layoutMode === 'in_trade') return 'in_trade'
    if (layoutMode === 'evaluate') return 'evaluate'
    return 'scan'
  }, [layoutMode])
  const primaryActionLabel = useMemo(() => {
    if (primaryActionMode === 'in_trade') return 'Manage Risk / Exit Trade'
    if (primaryActionMode === 'evaluate') return 'Stage Trade'
    return 'Select Best Setup'
  }, [primaryActionMode])
  const primaryActionBlockedReason = useMemo(() => {
    if (primaryActionMode !== 'evaluate' || primaryEntryRiskGate.allowEntry) return null
    if (primaryEntryRiskGate.reasonCode === 'feed_trust_blocked') {
      const reasonLabel = formatSPXFeedFallbackReasonCode(feedFallbackReasonCode)
      return reasonLabel ? `${reasonLabel} in effect` : 'Feed trust recovering'
    }
    return formatSPXRiskEnvelopeReason(primaryEntryRiskGate.reasonCode)
  }, [feedFallbackReasonCode, primaryActionMode, primaryEntryRiskGate.allowEntry, primaryEntryRiskGate.reasonCode])
  const primaryActionGuidance = useMemo(() => {
    if (primaryActionMode === 'in_trade') {
      return 'Trade active: manage risk and exits.'
    }
    if (!primaryActionTargetSetup) {
      return 'No actionable setup: wait for alignment.'
    }
    if (primaryActionMode === 'scan') {
      return `Best setup: ${primaryActionTargetSetup.direction} ${primaryActionTargetSetup.regime}.`
    }
    if (!primaryEntryRiskGate.allowEntry) {
      return primaryActionBlockedReason
        ? `Hold: ${primaryActionBlockedReason}.`
        : 'Hold: entry gate is blocking staging.'
    }
    return `Ready to stage: ${primaryActionTargetSetup.direction} ${primaryActionTargetSetup.regime}.`
  }, [
    primaryActionBlockedReason,
    primaryActionMode,
    primaryActionTargetSetup,
    primaryEntryRiskGate.allowEntry,
  ])
  const primaryActionEnabled = useMemo(() => {
    if (primaryActionMode === 'in_trade') return tradeMode === 'in_trade'
    if (primaryActionMode === 'evaluate') {
      return primaryEntryRiskGate.allowEntry
    }
    return Boolean(selectedActionableSetup || actionableSetups[0])
  }, [actionableSetups, primaryActionMode, primaryEntryRiskGate.allowEntry, selectedActionableSetup, tradeMode])
  const sidebarWidth = useMemo(() => {
    if (immersiveMode || (isMobile && mobileSmartStackEnabled)) return 0
    if (sidebarCollapsed) return 0
    if (layoutMode === 'scan') return 360
    if (layoutMode === 'evaluate') return 380
    if (layoutMode === 'in_trade') return 368
    return 344
  }, [immersiveMode, isMobile, mobileSmartStackEnabled, sidebarCollapsed, layoutMode])
  const sidebarOpen = sidebarWidth > 0

  const handleViewModeChange = useCallback((nextMode: SPXViewMode, source: 'toggle' | 'command' | 'shortcut' = 'toggle') => {
    setViewMode((previousMode) => {
      if (!uxFlags.spatialHudV1 && nextMode === 'spatial') return 'classic'
      if (previousMode === nextMode) return previousMode

      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_VIEW_MODE_CHANGED, {
        previousMode,
        nextMode,
        source,
        mobile: isMobile,
        layoutMode,
        tradeMode,
        selectedSetupId: selectedSetup?.id || null,
      }, { persist: true })

      window.localStorage.setItem(SPX_VIEW_MODE_STORAGE_KEY, nextMode)
      return nextMode
    })
  }, [
    isMobile,
    layoutMode,
    selectedSetup?.id,
    tradeMode,
    uxFlags.spatialHudV1,
  ])

  const handleFocusModeChange = useCallback((
    nextMode: SPXFocusMode,
    source: 'action_strip' | 'command' | 'shortcut' = 'action_strip',
  ) => {
    setFocusMode((previousMode) => {
      if (previousMode === nextMode) return previousMode
      window.localStorage.setItem(SPX_FOCUS_MODE_STORAGE_KEY, nextMode)
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_FOCUS_MODE_CHANGED, {
        previousMode,
        nextMode,
        source,
        layoutMode,
        tradeMode,
        selectedSetupId: selectedSetup?.id || null,
      }, { persist: true })
      return nextMode
    })
  }, [layoutMode, selectedSetup?.id, tradeMode])

  const handleToggleReplay = useCallback((source: 'action_strip' | 'command' | 'shortcut' = 'action_strip') => {
    setReplayEnabled((previous) => {
      const next = !previous
      if (!next) {
        setReplayPlaying(false)
      }
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CHART_REPLAY_STATE_CHANGED, {
        action: 'toggle_replay',
        enabled: next,
        source,
        speed: replaySpeed,
        windowMinutes: replayWindowMinutes,
      }, { persist: true })
      return next
    })
  }, [replaySpeed, replayWindowMinutes])

  const handleToggleReplayPlayback = useCallback((source: 'action_strip' | 'command' | 'shortcut' = 'action_strip') => {
    setReplayPlaying((previous) => {
      const next = replayEnabled ? !previous : false
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CHART_REPLAY_STATE_CHANGED, {
        action: 'toggle_playback',
        playing: next,
        replayEnabled,
        source,
        speed: replaySpeed,
        windowMinutes: replayWindowMinutes,
      }, { persist: true })
      return next
    })
  }, [replayEnabled, replaySpeed, replayWindowMinutes])

  const handleCycleReplayWindow = useCallback((source: 'action_strip' | 'command' | 'shortcut' = 'action_strip') => {
    const options: SPXReplayWindowMinutes[] = [30, 60, 120]
    setReplayWindowMinutes((previous) => {
      const index = options.indexOf(previous)
      const next = options[(index + 1) % options.length]!
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CHART_REPLAY_STATE_CHANGED, {
        action: 'cycle_window',
        previous,
        next,
        source,
      })
      return next
    })
  }, [])

  const handleCycleReplaySpeed = useCallback((source: 'action_strip' | 'command' | 'shortcut' = 'action_strip') => {
    const options: SPXReplaySpeed[] = [1, 2, 4]
    setReplaySpeed((previous) => {
      const index = options.indexOf(previous)
      const next = options[(index + 1) % options.length]!
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CHART_REPLAY_STATE_CHANGED, {
        action: 'cycle_speed',
        previous,
        next,
        source,
      })
      return next
    })
  }, [])

  const handleToggleAdvancedHud = useCallback(() => {
    setShowAdvancedHud((previous) => {
      const next = !previous
      if (next) {
        setShowLevelOverlay(false)
      }
      return next
    })
  }, [])

  const handleToggleLevelOverlay = useCallback((_: 'action_strip' | 'command' | 'shortcut') => {
    setShowLevelOverlay((previous) => {
      const next = !previous
      if (next) {
        setShowAdvancedHud(false)
      }
      return next
    })
  }, [])

  const { commandPaletteCommands, runKeyboardShortcut, runCommandById } = useSPXCommandRegistry({
    uxFlagsCommandPalette: uxFlags.commandPalette,
    uxFlagsSpatialHudV1: uxFlags.spatialHudV1,
    isMobile,
    viewMode,
    tradeMode,
    activeSetups,
    actionableSetups,
    selectedSetup,
    selectedActionableSetup,
    showLevelOverlay,
    showCone,
    showGEXGlow,
    showSpatialCoach,
    immersiveMode,
    sidebarCollapsed,
    showShortcutHelp,
    selectSetup,
    enterTrade,
    exitTrade,
    toggleLevelOverlay: handleToggleLevelOverlay,
    setShowCone,
    setShowSpatialCoach,
    setShowGEXGlow,
    setImmersiveMode,
    setSidebarCollapsed,
    setShowShortcutHelp,
    handleViewModeChange,
    focusMode,
    setFocusMode: handleFocusModeChange,
    replayEnabled,
    replayPlaying,
    replayWindowMinutes,
    replaySpeed,
    toggleReplay: handleToggleReplay,
    toggleReplayPlayback: handleToggleReplayPlayback,
    cycleReplayWindow: handleCycleReplayWindow,
    cycleReplaySpeed: handleCycleReplaySpeed,
    enterTradeBlocked: !primaryEntryRiskGate.allowEntry,
    enterTradeBlockedReasonCode: primaryEntryRiskGate.reasonCode,
    enterTradeBlockedReasonLabel: primaryActionBlockedReason,
  })

  const runActionStripCommand = useCallback((id: SPXCommandId) => {
    void runCommandById(id, 'action_strip')
  }, [runCommandById])

  const handleChartReady = useCallback((chart: IChartApi, series: ISeriesApi<'Candlestick'>) => {
    chartRef.current = chart
    candlestickSeriesRef.current = series
    invalidateChartCoordinates()
  }, [invalidateChartCoordinates])

  const handleLatestChartBarTimeChange = useCallback((timeSec: number | null) => {
    setLatestChartBarTimeSec(timeSec)
  }, [])

  const handleDisplayedLevelsChange = useCallback((displayed: number, total: number) => {
    setDisplayedLevelsCount(displayed)
    setTotalLevelsCount(total)
  }, [])

  const handleToggleAllLevels = useCallback(() => {
    setShowAllRelevantLevels((previous) => {
      const next = !previous
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.LEVEL_MAP_INTERACTION, {
        surface: 'action_strip_levels_toggle',
        mode: next ? 'all_relevant' : 'focused',
      })
      return next
    })
  }, [])

  const handleOverlayPresetChange = useCallback((preset: SPXOverlayPreset, source: 'action_strip' | 'command' = 'action_strip') => {
    const next = SPX_OVERLAY_PRESET_STATE[preset]
    if (!next) return

    setShowCone(next.showCone)
    setShowSpatialCoach(next.showSpatialCoach)
    setShowGEXGlow(next.showGEXGlow)

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'overlay_preset_selector',
      source,
      preset,
      layoutMode,
      viewMode,
      selectedSetupId: selectedSetup?.id || null,
    }, { persist: true })
  }, [layoutMode, selectedSetup?.id, viewMode])

  const handlePrimaryAction = useCallback(() => {
    const fallbackSetup = primaryActionTargetSetup

    if (primaryActionMode === 'in_trade') {
      exitTrade()
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
        surface: 'action_strip_primary_cta',
        action: 'exit_trade_focus',
        layoutMode,
        tradeMode,
        selectedSetupId: selectedSetup?.id || null,
      }, { persist: true })
      return
    }

    if (!fallbackSetup) return

    if (primaryActionMode === 'evaluate') {
      if (!primaryEntryRiskGate.allowEntry) {
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
          surface: 'action_strip_primary_cta',
          action: 'enter_trade_focus_blocked',
          layoutMode,
          tradeMode,
          setupId: fallbackSetup.id,
          riskEnvelopeReasonCode: primaryEntryRiskGate.reasonCode,
          feedFallbackReasonCode,
        }, { level: 'warning', persist: true })
        return
      }
      selectSetup(fallbackSetup)
      enterTrade(fallbackSetup)
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
        surface: 'action_strip_primary_cta',
        action: 'enter_trade_focus',
        layoutMode,
        tradeMode,
        setupId: fallbackSetup.id,
      }, { persist: true })
      return
    }

    selectSetup(fallbackSetup)
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'action_strip_primary_cta',
      action: 'select_best_setup',
      layoutMode,
      tradeMode,
      setupId: fallbackSetup.id,
    }, { persist: true })
  }, [
    enterTrade,
    exitTrade,
    feedFallbackReasonCode,
    layoutMode,
    primaryEntryRiskGate.allowEntry,
    primaryEntryRiskGate.reasonCode,
    primaryActionMode,
    primaryActionTargetSetup,
    selectSetup,
    selectedSetup?.id,
    tradeMode,
  ])

  const handleShowWhy = useCallback(() => {
    if (isMobile) {
      setMobileTab('coach')
      setShowMobileCoachSheet(true)
    } else {
      setSidebarCollapsed(false)
      setImmersiveMode(false)
      setShowDesktopCoachPanel(true)
    }

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'action_strip_primary_why',
      layoutMode,
      tradeMode,
      selectedSetupId: selectedSetup?.id || null,
    }, { persist: true })
  }, [isMobile, layoutMode, selectedSetup?.id, tradeMode])

  const handleMobileTabChange = useCallback((next: MobilePanelTab) => {
    setMobileTab(next)
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'mobile_tabs',
      tab: next,
    })
  }, [])

  const handleMobileCoachSheetChange = useCallback((nextOpen: boolean) => {
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
  }, [layoutMode, selectedSetup?.id, tradeMode])

  const handleDesktopCoachDockToggle = useCallback(() => {
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
  }, [layoutMode, selectedSetup?.id, tradeMode])

  useEffect(() => {
    if (!showAdvancedHud) return
    if (showLevelOverlay || showCommandPalette || !sidebarOpen || isMobile) {
      setShowAdvancedHud(false)
    }
  }, [isMobile, showAdvancedHud, showCommandPalette, showLevelOverlay, sidebarOpen])

  useEffect(() => {
    if (!showLevelOverlay) return
    if (showCommandPalette || isMobile) {
      setShowLevelOverlay(false)
    }
  }, [isMobile, showCommandPalette, showLevelOverlay])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setInitialSkeletonExpired(true)
    }, INITIAL_SKELETON_MAX_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    if (isMobile || viewMode !== 'spatial') {
      frameTimesRef.current = []
      frameSlowStreakRef.current = 0
      frameFastStreakRef.current = 0
      frameMonitorStartedAtRef.current = null
      if (spatialThrottled) {
        const resetRafId = window.requestAnimationFrame(() => {
          setSpatialThrottled(false)
        })
        return () => {
          window.cancelAnimationFrame(resetRafId)
        }
      }
      return
    }

    const FRAME_SAMPLE_WINDOW = 12
    const FRAME_MONITOR_WARMUP_MS = 1500
    const ENTER_THROTTLE_AVG_MS = 24
    const EXIT_THROTTLE_AVG_MS = 19
    const ENTER_THROTTLE_STREAK = 4
    const EXIT_THROTTLE_STREAK = 8

    let rafId = 0
    let lastFrame = performance.now()
    frameMonitorStartedAtRef.current = lastFrame

    const measureFrame = () => {
      const now = performance.now()
      const frameTime = now - lastFrame
      lastFrame = now

      frameTimesRef.current.push(frameTime)
      if (frameTimesRef.current.length > FRAME_SAMPLE_WINDOW) {
        frameTimesRef.current.shift()
      }

      const warmedUp = frameMonitorStartedAtRef.current != null
        && (now - frameMonitorStartedAtRef.current) >= FRAME_MONITOR_WARMUP_MS
      if (warmedUp && frameTimesRef.current.length >= FRAME_SAMPLE_WINDOW) {
        const avgFrameTime = frameTimesRef.current.reduce((acc, value) => acc + value, 0) / frameTimesRef.current.length
        if (avgFrameTime >= ENTER_THROTTLE_AVG_MS) {
          frameSlowStreakRef.current += 1
          frameFastStreakRef.current = 0
        } else if (avgFrameTime <= EXIT_THROTTLE_AVG_MS) {
          frameFastStreakRef.current += 1
          frameSlowStreakRef.current = 0
        } else {
          frameFastStreakRef.current = 0
          frameSlowStreakRef.current = 0
        }

        if (!spatialThrottled && frameSlowStreakRef.current >= ENTER_THROTTLE_STREAK) {
          setSpatialThrottled(true)
        } else if (spatialThrottled && frameFastStreakRef.current >= EXIT_THROTTLE_STREAK) {
          setSpatialThrottled(false)
        }
      }

      rafId = window.requestAnimationFrame(measureFrame)
    }

    rafId = window.requestAnimationFrame(measureFrame)
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [isMobile, spatialThrottled, viewMode])

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

      if (runKeyboardShortcut(key)) {
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    showCommandPalette,
    tradeMode,
    runKeyboardShortcut,
    uxFlags.commandPalette,
    uxFlags.keyboardShortcuts,
    selectedSetup?.id,
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

  useEffect(() => {
    invalidateChartCoordinates()
  }, [
    focusMode,
    immersiveMode,
    invalidateChartCoordinates,
    replayEnabled,
    replayPlaying,
    replaySpeed,
    replayWindowMinutes,
    showAdvancedHud,
    showCone,
    showGEXGlow,
    showLevelOverlay,
    showSpatialCoach,
    sidebarWidth,
    uxFlags.spatialHudV1,
    viewMode,
  ])

  const desktopViewMode: SPXViewMode = uxFlags.spatialHudV1 ? viewMode : 'classic'
  const shouldShowInitialSkeleton = !initialSkeletonExpired && isLoading && activeSetups.length === 0 && levels.length === 0

  return {
    isMobile,
    uxFlags,
    dataHealth,
    dataHealthMessage,
    feedFallbackReasonCode,
    feedFallbackStage,
    blockTradeEntryByFeedTrust,
    gexProfile,
    isLoading,
    levels,
    mobileTab,
    showLevelOverlay,
    initialSkeletonExpired,
    showShortcutHelp,
    showCommandPalette,
    showAdvancedHud,
    showMobileCoachSheet,
    showAllRelevantLevels,
    overlayPreset,
    displayedLevelsCount,
    totalLevelsCount,
    immersiveMode,
    sidebarCollapsed,
    showCone,
    showSpatialCoach,
    showGEXGlow,
    latestChartBarTimeSec,
    spatialThrottled,
    focusMode,
    replayEnabled,
    replayPlaying,
    replayWindowMinutes,
    replaySpeed,
    mobileReadOnly,
    layoutMode,
    primaryActionMode,
    primaryActionLabel,
    primaryActionGuidance,
    primaryActionEnabled,
    primaryActionBlockedReason,
    stateDrivenLayoutEnabled,
    mobileSmartStackEnabled,
    desktopCoachPanelOpen,
    rootVariants,
    itemVariants,
    coordinatesRef,
    chartCanvasRef,
    sidebarWidth,
    sidebarOpen,
    commandPaletteCommands,
    desktopViewMode,
    shouldShowInitialSkeleton,
    setShowLevelOverlay,
    setShowShortcutHelp,
    setShowCommandPalette,
    setSidebarCollapsed,
    handleViewModeChange,
    handleToggleAdvancedHud,
    handleFocusModeChange,
    handleToggleReplay,
    handleToggleReplayPlayback,
    handleCycleReplayWindow,
    handleCycleReplaySpeed,
    runActionStripCommand,
    handleOverlayPresetChange,
    handlePrimaryAction,
    handleShowWhy,
    handleChartReady,
    handleLatestChartBarTimeChange,
    handleDisplayedLevelsChange,
    handleToggleAllLevels,
    handleMobileTabChange,
    handleMobileCoachSheetChange,
    handleDesktopCoachDockToggle,
  }
}

export type SPXCommandController = ReturnType<typeof useSPXCommandController>
