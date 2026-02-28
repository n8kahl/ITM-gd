'use client'

import type { ReactNode } from 'react'
import { AICoachFeed } from '@/components/spx-command-center/ai-coach-feed'
import { CoachFactsRail } from '@/components/spx-command-center/coach-facts-rail'
import { CoachDock } from '@/components/spx-command-center/coach-dock'
import { ContractSelector } from '@/components/spx-command-center/contract-selector'
import { DecisionContext } from '@/components/spx-command-center/decision-context'
import { GEXHeatmap } from '@/components/spx-command-center/gex-heatmap'
import { GEXLandscape } from '@/components/spx-command-center/gex-landscape'
import { LevelMatrix } from '@/components/spx-command-center/level-matrix'
import { SPXOptimizerScorecardPanel } from '@/components/spx-command-center/optimizer-scorecard-panel'
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

function parseBooleanEnvFlag(value: string | undefined): boolean | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false
  return null
}

function resolveCoachFactsRuntimeOverride(): boolean | null {
  if (typeof window === 'undefined') return null
  if (window.navigator.webdriver !== true) return null
  const candidate = (window as Window & { __spxCoachFactsModeEnabled?: unknown }).__spxCoachFactsModeEnabled
  return typeof candidate === 'boolean' ? candidate : null
}

function resolveCoachFactsModeEnabled(): boolean {
  return (
    resolveCoachFactsRuntimeOverride()
    ?? parseBooleanEnvFlag(process.env.SPX_COACH_FACTS_MODE_ENABLED)
    ?? parseBooleanEnvFlag(process.env.NEXT_PUBLIC_SPX_COACH_FACTS_MODE_ENABLED)
    ?? false
  )
}

const SPX_COACH_FACTS_MODE_ENABLED = resolveCoachFactsModeEnabled()

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
}: SPXDesktopMainSurfaceProps) {
  return (
    <div className={cn('relative h-full space-y-2.5', className)}>
      <SPXChart
        showAllRelevantLevels={showAllRelevantLevels}
        renderLevelAnnotations={showLevelOverlay}
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
  const showSetupFeed = focusMode !== 'risk_only'
  const showContractSelector = showSetupFeed && (!stateDrivenLayoutEnabled || layoutMode !== 'scan')
  const showDecisionContext = focusMode === 'risk_only'
  const showInlineCoachFeed = SPX_COACH_FACTS_MODE_ENABLED || !stateDrivenLayoutEnabled || layoutMode !== 'scan'
  const showAnalytics = focusMode !== 'execution' && (!stateDrivenLayoutEnabled || layoutMode === 'evaluate')
  const coachPanel = SPX_COACH_FACTS_MODE_ENABLED
    ? <CoachFactsRail />
    : <AICoachFeed suppressPrimaryTradeActions />

  return (
    <div className={cn('h-full space-y-2.5 overflow-auto', className)}>
      {!SPX_COACH_FACTS_MODE_ENABLED && stateDrivenLayoutEnabled && layoutMode === 'scan' && (
        coachDockEnabled ? (
          <div className="sticky top-0 z-10 bg-[#07090D]/90 pb-2 backdrop-blur">
            <CoachDock
              surface="desktop"
              isOpen={desktopCoachPanelOpen}
              onToggle={onDesktopCoachDockToggle}
            />
            {desktopCoachPanelOpen ? (
              <div className="mt-2">
                {coachPanel}
              </div>
            ) : null}
          </div>
        ) : (
          coachPreviewFallback
        )
      )}

      {showSetupFeed && <SetupFeed suppressLocalPrimaryCta />}
      {showContractSelector && <ContractSelector />}
      {showInlineCoachFeed && coachPanel}
      {showDecisionContext && <DecisionContext />}

      {showAnalytics && (
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
            <SPXOptimizerScorecardPanel compact />
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
        <SPXOptimizerScorecardPanel compact />
        <LevelMatrix />
        <GEXLandscape profile={gexProfile?.combined || null} />
        <GEXHeatmap spx={gexProfile?.spx || null} spy={gexProfile?.spy || null} />
        <FlowTicker />
        <PostTradePanel compact />
      </div>
    </details>
  )
  const showSetupFeed = focusMode !== 'risk_only'
  const showContractSelector = showSetupFeed && layoutMode !== 'scan'
  const showInlineCoachFeed = SPX_COACH_FACTS_MODE_ENABLED || layoutMode !== 'scan' || desktopCoachPanelOpen
  const showDecisionContext = focusMode === 'risk_only'
  const coachPanel = SPX_COACH_FACTS_MODE_ENABLED
    ? <CoachFactsRail />
    : <AICoachFeed suppressPrimaryTradeActions />

  return (
    <div className="space-y-3" data-testid="spx-sidebar-decision-zone">
      {!SPX_COACH_FACTS_MODE_ENABLED && layoutMode === 'scan' && coachDockEnabled && (
        <CoachDock
          surface="desktop"
          isOpen={desktopCoachPanelOpen}
          onToggle={onDesktopCoachDockToggle}
        />
      )}
      {showSetupFeed && <SetupFeed suppressLocalPrimaryCta />}
      {showContractSelector && <ContractSelector />}
      {showInlineCoachFeed && coachPanel}
      {showDecisionContext && <DecisionContext />}
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
          <p><span className="font-mono text-emerald-200">Enter</span> stage trade on selected actionable setup</p>
          <p><span className="font-mono text-emerald-200">Esc</span> exit trade or clear selection</p>
          <p><span className="font-mono text-emerald-200">1-4</span> coach quick actions</p>
          <p><span className="font-mono text-emerald-200">M</span> toggle level overlay</p>
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
