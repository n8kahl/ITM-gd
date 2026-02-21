'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SPXCommandController } from '@/hooks/use-spx-command-controller'
import { FlowRibbon } from '@/components/spx-command-center/flow-ribbon'
import { GEXAmbientGlow } from '@/components/spx-command-center/gex-ambient-glow'
import { GammaTopographyOverlay } from '@/components/spx-command-center/gamma-topography-overlay'
import { LevelMatrix } from '@/components/spx-command-center/level-matrix'
import { ProbabilityConeSVG } from '@/components/spx-command-center/probability-cone-svg'
import { RiskRewardShadowOverlay } from '@/components/spx-command-center/risk-reward-shadow-overlay'
import { SetupLockOverlay } from '@/components/spx-command-center/setup-lock-overlay'
import { SPXChart } from '@/components/spx-command-center/spx-chart'
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
  onCloseLevelOverlay: () => void
  onRequestSidebarOpen?: () => void
}

const OVERLAY_POLICY_REFRESH_INTERVAL_MS = 180

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
  onCloseLevelOverlay,
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

  return (
    <div
      className="absolute inset-0 transition-[right] duration-300 ease-out"
      style={{ right: sidebarOpen ? `${sidebarWidth}px` : '0px' }}
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
          <FlowRibbon className="absolute left-4 top-[74px] z-[24] w-[320px] max-w-[46vw]" />
          <SPXChart
            showAllRelevantLevels={showAllRelevantLevels}
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
          {!spatialThrottled && overlayPolicy.allowTopographicLadder && <TopographicPriceLadder coordinatesRef={coordinatesRef} />}
          {!spatialThrottled && <RiskRewardShadowOverlay coordinatesRef={coordinatesRef} />}
          {!spatialThrottled && <SetupLockOverlay coordinatesRef={coordinatesRef} />}
          {overlayPolicy.allowCone && !spatialThrottled && (
            <ProbabilityConeSVG
              coordinatesRef={coordinatesRef}
              anchorTimestampSec={latestChartBarTimeSec}
            />
          )}
          {overlayPolicy.allowGhostCards && !spatialThrottled && (
            <SpatialCoachGhostLayer coordinatesRef={coordinatesRef} />
          )}
          {overlayPolicy.allowSpatialCoach && !spatialThrottled && (
            <SpatialCoachLayer
              coordinatesRef={coordinatesRef}
              onRequestSidebarOpen={onRequestSidebarOpen}
            />
          )}
        </div>

        {showLevelOverlay && (
          <div className="absolute inset-0 z-50 flex items-start justify-end bg-black/50 p-3 backdrop-blur-[2px]">
            <div className="max-h-full w-[460px] overflow-auto rounded-xl border border-white/15 bg-[#090B0F]/95 p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/65">Level Matrix</p>
                <button
                  type="button"
                  onClick={onCloseLevelOverlay}
                  className="min-h-[36px] rounded border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white/65 hover:text-white"
                >
                  Close
                </button>
              </div>
              <LevelMatrix />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
