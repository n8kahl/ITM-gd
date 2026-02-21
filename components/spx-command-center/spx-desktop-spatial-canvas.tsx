'use client'

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

export type SPXDesktopSpatialCanvasProps = {
  sidebarOpen: boolean
  sidebarWidth: number
  chartCanvasRef: SPXCommandController['chartCanvasRef']
  showGEXGlow: boolean
  spatialThrottled: boolean
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
}

export function SPXDesktopSpatialCanvas({
  sidebarOpen,
  sidebarWidth,
  chartCanvasRef,
  showGEXGlow,
  spatialThrottled,
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
}: SPXDesktopSpatialCanvasProps) {
  return (
    <div
      className="absolute inset-0 transition-[right] duration-300 ease-out"
      style={{ right: sidebarOpen ? `${sidebarWidth}px` : '0px' }}
      data-testid="spx-desktop-spatial"
    >
      <div ref={chartCanvasRef} className="absolute inset-0">
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
          futureOffsetBars={showCone ? 42 : 12}
          className="h-full w-full"
        />
        {!spatialThrottled && <TopographicPriceLadder coordinatesRef={coordinatesRef} />}
        {!spatialThrottled && <RiskRewardShadowOverlay coordinatesRef={coordinatesRef} />}
        {!spatialThrottled && <SetupLockOverlay coordinatesRef={coordinatesRef} />}
        {showCone && !spatialThrottled && (
          <ProbabilityConeSVG
            coordinatesRef={coordinatesRef}
            anchorTimestampSec={latestChartBarTimeSec}
          />
        )}
        {showSpatialCoach && !spatialThrottled && (
          <SpatialCoachGhostLayer coordinatesRef={coordinatesRef} />
        )}
        {showSpatialCoach && !spatialThrottled && (
          <SpatialCoachLayer coordinatesRef={coordinatesRef} />
        )}

        {showLevelOverlay && (
          <div className="absolute inset-0 z-20 flex items-start justify-end bg-black/50 p-3 backdrop-blur-[2px]">
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
