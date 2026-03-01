'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SPXCommandController } from '@/hooks/use-spx-command-controller'
import { FlowRibbon } from '@/components/spx-command-center/flow-ribbon'
import { GEXAmbientGlow } from '@/components/spx-command-center/gex-ambient-glow'
import { GammaTopographyOverlay } from '@/components/spx-command-center/gamma-topography-overlay'
import { ProbabilityConeSVG } from '@/components/spx-command-center/probability-cone-svg'
import { PriorityLevelOverlay } from '@/components/spx-command-center/priority-level-overlay'
import { RiskRewardShadowOverlay } from '@/components/spx-command-center/risk-reward-shadow-overlay'
import { SetupLockOverlay } from '@/components/spx-command-center/setup-lock-overlay'
import { SPXChart } from '@/components/spx-command-center/spx-chart'
import { SpatialMarkerLegend } from '@/components/spx-command-center/spatial-marker-legend'
import { SpatialCoachGhostLayer } from '@/components/spx-command-center/spatial-coach-ghost-layer'
import { SpatialCoachLayer } from '@/components/spx-command-center/spatial-coach-layer'
import { TopographicPriceLadder } from '@/components/spx-command-center/topographic-price-ladder'
import { resolveSPXOverlayPriorityPolicy } from '@/lib/spx/overlay-priority'

export type SPXDesktopSpatialCanvasProps = {
  sidebarOpen: boolean
  sidebarWidth: number
  chartCanvasRef: SPXCommandController['chartCanvasRef']
  showGEXGlow: boolean
  spatialThrottled: boolean
  showSpatialGhostCards: boolean
  coordinatesRef: SPXCommandController['coordinatesRef']
  showAllRelevantLevels: boolean
  onDisplayedLevelsChange: SPXCommandController['handleDisplayedLevelsChange']
  onChartReady: SPXCommandController['handleChartReady']
  onLatestBarTimeChange: SPXCommandController['handleLatestChartBarTimeChange']
  focusMode: SPXCommandController['focusMode']
  replayEnabled: SPXCommandController['replayEnabled']
  replayPlaying: SPXCommandController['replayPlaying']
  replayWindowMinutes: SPXCommandController['replayWindowMinutes']
  replaySpeed: SPXCommandController['replaySpeed']
  showCone: boolean
  latestChartBarTimeSec: number | null
  showSpatialCoach: boolean
  showLevelOverlay: boolean
  onCloseLevelOverlay?: () => void
  onRequestSidebarOpen?: () => void
}

const OVERLAY_POLICY_REFRESH_INTERVAL_MS = 180
const DESKTOP_TOP_SAFE_AREA_PX = 96

export function SPXDesktopSpatialCanvas({
  sidebarOpen,
  sidebarWidth,
  chartCanvasRef,
  showGEXGlow,
  spatialThrottled,
  showSpatialGhostCards,
  coordinatesRef,
  showAllRelevantLevels,
  onDisplayedLevelsChange,
  onChartReady,
  onLatestBarTimeChange,
  focusMode,
  replayEnabled,
  replayPlaying,
  replayWindowMinutes,
  replaySpeed,
  showCone,
  latestChartBarTimeSec,
  showSpatialCoach,
  showLevelOverlay,
  onRequestSidebarOpen,
}: SPXDesktopSpatialCanvasProps) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const runtimeGhostFlagEnabled = typeof window !== 'undefined'
    && Boolean((window as { __spxUxFlags?: { spatialCoachGhostCards?: boolean } }).__spxUxFlags?.spatialCoachGhostCards)
  const ghostCardsEnabled = showSpatialGhostCards || runtimeGhostFlagEnabled

  useEffect(() => {
    let rafId = 0
    const refresh = () => {
      const coordinates = coordinatesRef.current
      const width = coordinates?.chartDimensions.width || 0
      const height = coordinates?.chartDimensions.height || 0
      setViewport((previous) => {
        if (previous.width === width && previous.height === height) return previous
        return { width, height }
      })
    }
    const tick = () => {
      rafId = window.requestAnimationFrame(refresh)
    }
    tick()
    const intervalId = window.setInterval(tick, OVERLAY_POLICY_REFRESH_INTERVAL_MS)
    return () => {
      window.clearInterval(intervalId)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [coordinatesRef])

  const overlayPolicy = useMemo(() => resolveSPXOverlayPriorityPolicy({
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    focusMode,
    spatialThrottled,
    showCone,
    showSpatialCoach,
    showSpatialGhostCards: ghostCardsEnabled,
  }), [
    focusMode,
    ghostCardsEnabled,
    showCone,
    showSpatialCoach,
    spatialThrottled,
    viewport.height,
    viewport.width,
  ])
  // Levels should remain available across all focus modes and under throttle.
  // Other heavier overlays continue to respect throttle/focus constraints.
  const levelOverlaysEnabled = showLevelOverlay
  const showPriorityLevels = levelOverlaysEnabled
  const showRiskShadow = levelOverlaysEnabled && (focusMode === 'execution' || focusMode === 'risk_only')
  const showSetupLock = levelOverlaysEnabled && focusMode === 'execution'
  const showTopographicLadder = levelOverlaysEnabled && overlayPolicy.allowTopographicLadder && focusMode === 'risk_only' && !showPriorityLevels
  const showConeOverlay = overlayPolicy.allowCone && !spatialThrottled
  const showCoachOverlay = overlayPolicy.allowSpatialCoach && !spatialThrottled
  const handlePriorityLevelCountsChange = useCallback((displayed: number, total: number) => {
    onDisplayedLevelsChange(displayed, total)
  }, [onDisplayedLevelsChange])

  useEffect(() => {
    if (!levelOverlaysEnabled) {
      onDisplayedLevelsChange(0, 0)
    }
  }, [levelOverlaysEnabled, onDisplayedLevelsChange])

  return (
    <div
      className="absolute left-0 transition-[right] duration-300 ease-out"
      style={{
        top: `${DESKTOP_TOP_SAFE_AREA_PX}px`,
        bottom: '0px',
        right: sidebarOpen ? `${sidebarWidth}px` : '0px',
      }}
      data-testid="spx-desktop-spatial"
    >
      <div ref={chartCanvasRef} className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            bottom: `${overlayPolicy.bottomSafeAreaPx}px`,
            right: `${overlayPolicy.rightSafeAreaPx}px`,
          }}
          data-testid="spx-desktop-spatial-chart-viewport"
        >
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ boxShadow: 'inset 0 0 120px rgba(0,0,0,0.7)' }}
          />
          {showGEXGlow && <GEXAmbientGlow intensity="boosted" />}
          {showGEXGlow && !spatialThrottled && <GammaTopographyOverlay coordinatesRef={coordinatesRef} />}
          <FlowRibbon className="absolute left-4 top-3 z-[24] w-[320px] max-w-[46vw]" />
          <SpatialMarkerLegend
            className="absolute left-4 top-[58px] z-[24]"
            showCone={showConeOverlay}
            showCoach={showCoachOverlay}
          />
          <SPXChart
            showAllRelevantLevels={showAllRelevantLevels}
            renderLevelAnnotations={false}
            countReportingMode="disabled"
            onDisplayedLevelsChange={onDisplayedLevelsChange}
            onChartReady={onChartReady}
            onLatestBarTimeChange={onLatestBarTimeChange}
            focusMode={focusMode}
            replayEnabled={replayEnabled}
            replayPlaying={replayPlaying}
            replayWindowMinutes={replayWindowMinutes}
            replaySpeed={replaySpeed}
            futureOffsetBars={overlayPolicy.allowCone ? 42 : 12}
            levelVisibilityBudget={overlayPolicy.levelVisibilityBudget}
            className="h-full w-full"
          />
          {showTopographicLadder && <TopographicPriceLadder coordinatesRef={coordinatesRef} />}
          {showRiskShadow && <RiskRewardShadowOverlay coordinatesRef={coordinatesRef} />}
          {showSetupLock && <SetupLockOverlay coordinatesRef={coordinatesRef} />}
          {showConeOverlay && (
            <ProbabilityConeSVG
              coordinatesRef={coordinatesRef}
              anchorTimestampSec={latestChartBarTimeSec}
            />
          )}
          {overlayPolicy.allowGhostCards && !spatialThrottled && (
            <SpatialCoachGhostLayer coordinatesRef={coordinatesRef} />
          )}
          {showCoachOverlay && (
            <SpatialCoachLayer
              coordinatesRef={coordinatesRef}
              onRequestSidebarOpen={onRequestSidebarOpen}
            />
          )}
          {showPriorityLevels && (
            <PriorityLevelOverlay
              coordinatesRef={coordinatesRef}
              showAllRelevantLevels={showAllRelevantLevels}
              focusMode={focusMode}
              onDisplayedLevelsChange={handlePriorityLevelCountsChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}
