'use client'

import type { ReactNode } from 'react'
import { AICoachFeed } from '@/components/spx-command-center/ai-coach-feed'
import { CoachDock } from '@/components/spx-command-center/coach-dock'
import { ContractSelector } from '@/components/spx-command-center/contract-selector'
import { DecisionContext } from '@/components/spx-command-center/decision-context'
import { GEXHeatmap } from '@/components/spx-command-center/gex-heatmap'
import { GEXLandscape } from '@/components/spx-command-center/gex-landscape'
import { LevelMatrix } from '@/components/spx-command-center/level-matrix'
import { PostTradePanel } from '@/components/spx-command-center/post-trade-panel'
import { SetupFeed } from '@/components/spx-command-center/setup-feed'
import { SPXChart } from '@/components/spx-command-center/spx-chart'
import { FlowTicker } from '@/components/spx-command-center/flow-ticker'
import type { SPXLayoutMode } from '@/lib/spx/layout-mode'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import { cn } from '@/lib/utils'

type GEXProfileLike = {
  combined?: any
  spx?: any
  spy?: any
} | null | undefined

export type SPXDesktopMainSurfaceProps = {
  className?: string
  showAllRelevantLevels: boolean
  onDisplayedLevelsChange: (displayed: number, total: number) => void
  onLatestBarTimeChange: (timeSec: number | null) => void
  focusMode: 'decision' | 'execution' | 'risk_only'
  replayEnabled: boolean
  replayPlaying: boolean
  replayWindowMinutes: 30 | 60 | 120
  replaySpeed: 1 | 2 | 4
  stateDrivenLayoutEnabled: boolean
  layoutMode: SPXLayoutMode
  showLevelOverlay: boolean
  onCloseLevelOverlay: () => void
}

export function SPXDesktopMainSurface({
  className,
  showAllRelevantLevels,
  onDisplayedLevelsChange,
  onLatestBarTimeChange,
  focusMode,
  replayEnabled,
  replayPlaying,
  replayWindowMinutes,
  replaySpeed,
  stateDrivenLayoutEnabled,
  layoutMode,
  showLevelOverlay,
  onCloseLevelOverlay,
}: SPXDesktopMainSurfaceProps) {
  return (
    <div className={cn('relative h-full space-y-2.5', className)}>
      <SPXChart
        showAllRelevantLevels={showAllRelevantLevels}
        onDisplayedLevelsChange={onDisplayedLevelsChange}
        onLatestBarTimeChange={onLatestBarTimeChange}
        focusMode={focusMode}
        replayEnabled={replayEnabled}
        replayPlaying={replayPlaying}
        replayWindowMinutes={replayWindowMinutes}
        replaySpeed={replaySpeed}
      />
      <FlowTicker />
      {(focusMode !== 'execution' && (!stateDrivenLayoutEnabled || layoutMode !== 'in_trade')) && <DecisionContext />}

      {showLevelOverlay && (
        <div className="absolute inset-0 z-20 flex items-start justify-end bg-black/50 p-3 backdrop-blur-[2px]">
          <div className="max-h-full w-[460px] overflow-auto rounded-xl border border-white/15 bg-[#090B0F]/95 p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/65">Level Matrix</p>
              <button
                type="button"
                onClick={onCloseLevelOverlay}
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
  )
}

export type SPXDesktopSidebarSurfaceProps = {
  className?: string
  stateDrivenLayoutEnabled: boolean
  layoutMode: SPXLayoutMode
  focusMode: 'decision' | 'execution' | 'risk_only'
  coachDockEnabled: boolean
  desktopCoachPanelOpen: boolean
  onDesktopCoachDockToggle: () => void
  coachPreviewFallback: ReactNode
  gexProfile: GEXProfileLike
}

export function SPXDesktopSidebarSurface({
  className,
  stateDrivenLayoutEnabled,
  layoutMode,
  focusMode,
  coachDockEnabled,
  desktopCoachPanelOpen,
  onDesktopCoachDockToggle,
  coachPreviewFallback,
  gexProfile,
}: SPXDesktopSidebarSurfaceProps) {
  return (
    <div className={cn('h-full space-y-2.5 overflow-auto', className)}>
      {stateDrivenLayoutEnabled && layoutMode === 'scan' && (
        coachDockEnabled ? (
          <div className="sticky top-0 z-10 bg-[#07090D]/90 pb-2 backdrop-blur">
            <CoachDock
              surface="desktop"
              isOpen={desktopCoachPanelOpen}
              onToggle={onDesktopCoachDockToggle}
            />
            {desktopCoachPanelOpen ? (
              <div className="mt-2">
                <AICoachFeed />
              </div>
            ) : null}
          </div>
        ) : (
          coachPreviewFallback
        )
      )}

      {focusMode !== 'risk_only' && <SetupFeed />}
      {!stateDrivenLayoutEnabled ? (
        <>
          {focusMode !== 'risk_only' && <ContractSelector />}
          <AICoachFeed />
          {focusMode === 'risk_only' && <DecisionContext />}
        </>
      ) : layoutMode === 'scan' ? (
        focusMode === 'risk_only' ? <DecisionContext /> : null
      ) : (
        <>
          <AICoachFeed />
          {focusMode !== 'risk_only' && <ContractSelector />}
          {focusMode === 'risk_only' && <DecisionContext />}
        </>
      )}

      {(focusMode !== 'execution' && (!stateDrivenLayoutEnabled || layoutMode === 'evaluate')) && (
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
      <PostTradePanel compact />
    </div>
  )
}

export type SPXSpatialSidebarContentProps = {
  layoutMode: SPXLayoutMode
  focusMode: 'decision' | 'execution' | 'risk_only'
  coachDockEnabled: boolean
  desktopCoachPanelOpen: boolean
  onDesktopCoachDockToggle: () => void
  gexProfile: GEXProfileLike
}

export function SPXSpatialSidebarContent({
  layoutMode,
  focusMode,
  coachDockEnabled,
  desktopCoachPanelOpen,
  onDesktopCoachDockToggle,
  gexProfile,
}: SPXSpatialSidebarContentProps) {
  const analyticsDrawer = (
    <details
      className="rounded-xl border border-white/12 bg-white/[0.02] px-3 py-2.5"
      data-testid="spx-sidebar-analytics-drawer"
      onToggle={(event) => {
        const expanded = (event.currentTarget as HTMLDetailsElement).open
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
          surface: 'sidebar_analytics_drawer',
          action: expanded ? 'expand' : 'collapse',
          layoutMode,
        })
      }}
    >
      <summary className="flex min-h-[36px] cursor-pointer list-none items-center text-[11px] uppercase tracking-[0.1em] text-white/62 hover:text-white/80">
        Analytics Drawer
      </summary>
      <div className="mt-2.5 space-y-2.5">
        <LevelMatrix />
        <DecisionContext />
        <GEXLandscape profile={gexProfile?.combined || null} />
        <GEXHeatmap spx={gexProfile?.spx || null} spy={gexProfile?.spy || null} />
        <FlowTicker />
        <PostTradePanel compact />
      </div>
    </details>
  )

  if (layoutMode === 'legacy') {
    return (
      <div className="space-y-3" data-testid="spx-sidebar-decision-zone">
        {focusMode !== 'risk_only' && <SetupFeed />}
        {focusMode !== 'risk_only' && <ContractSelector />}
        <AICoachFeed />
        {focusMode === 'risk_only' && <DecisionContext />}
        {analyticsDrawer}
      </div>
    )
  }

  if (layoutMode === 'scan') {
    return (
      <div className="space-y-3" data-testid="spx-sidebar-decision-zone">
        {coachDockEnabled && (
          <CoachDock
            surface="desktop"
            isOpen={desktopCoachPanelOpen}
            onToggle={onDesktopCoachDockToggle}
          />
        )}
        {desktopCoachPanelOpen && <AICoachFeed />}
        {focusMode !== 'risk_only' && <SetupFeed />}
        {focusMode === 'risk_only' && <DecisionContext />}
        {analyticsDrawer}
      </div>
    )
  }

  if (layoutMode === 'evaluate') {
    return (
      <div className="space-y-3" data-testid="spx-sidebar-decision-zone">
        <AICoachFeed />
        {focusMode !== 'risk_only' && <SetupFeed />}
        {focusMode !== 'risk_only' && <ContractSelector />}
        {focusMode === 'risk_only' && <DecisionContext />}
        {analyticsDrawer}
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="spx-sidebar-decision-zone">
      <AICoachFeed />
      {focusMode !== 'risk_only' && <ContractSelector />}
      {focusMode !== 'risk_only' && <SetupFeed />}
      {focusMode === 'risk_only' && <DecisionContext />}
      {analyticsDrawer}
    </div>
  )
}

type KeyboardShortcutsOverlayProps = {
  keyboardShortcutsEnabled: boolean
  showShortcutHelp: boolean
  isMobile: boolean
  spatialHudEnabled: boolean
  onClose: () => void
}

export function SPXKeyboardShortcutsOverlay({
  keyboardShortcutsEnabled,
  showShortcutHelp,
  isMobile,
  spatialHudEnabled,
  onClose,
}: KeyboardShortcutsOverlayProps) {
  if (!keyboardShortcutsEnabled || !showShortcutHelp) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/20 bg-[#090B0F] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.12em] text-ivory">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
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
          <p><span className="font-mono text-emerald-200">I</span> toggle immersive mode</p>
          <p><span className="font-mono text-emerald-200">S</span> toggle sidebar</p>
          <p><span className="font-mono text-emerald-200">A</span> toggle spatial AI coach</p>
          <p><span className="font-mono text-emerald-200">C</span> toggle probability cone</p>
          <p><span className="font-mono text-emerald-200">G</span> toggle GEX ambient glow</p>
          <p><span className="font-mono text-emerald-200">R</span> toggle replay mode</p>
          <p><span className="font-mono text-emerald-200">P</span> play/pause replay</p>
          {!isMobile && spatialHudEnabled && (
            <p><span className="font-mono text-emerald-200">V</span> toggle classic/spatial view</p>
          )}
          <p><span className="font-mono text-emerald-200">?</span> open this help</p>
        </div>
      </div>
    </div>
  )
}

type ViewModeToggleProps = {
  desktopViewMode: 'classic' | 'spatial'
  onChange: (nextMode: 'classic' | 'spatial') => void
}

export function SPXViewModeToggle({ desktopViewMode, onChange }: ViewModeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-white/15 bg-white/[0.03] p-1" data-testid="spx-view-mode-toggle">
      <button
        type="button"
        data-testid="spx-view-mode-classic"
        aria-pressed={desktopViewMode === 'classic'}
        onClick={() => onChange('classic')}
        className={cn(
          'min-h-[36px] rounded-md px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors',
          desktopViewMode === 'classic'
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'text-white/55 hover:text-white/80',
        )}
      >
        Classic
      </button>
      <button
        type="button"
        data-testid="spx-view-mode-spatial"
        aria-pressed={desktopViewMode === 'spatial'}
        onClick={() => onChange('spatial')}
        className={cn(
          'min-h-[36px] rounded-md px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors',
          desktopViewMode === 'spatial'
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'text-white/55 hover:text-white/80',
        )}
      >
        Spatial HUD
      </button>
    </div>
  )
}
