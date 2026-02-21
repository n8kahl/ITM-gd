'use client'

import type { ReactNode } from 'react'
import { ActionStrip } from '@/components/spx-command-center/action-strip'
import { SidebarPanel } from '@/components/spx-command-center/sidebar-panel'
import { SPXHeader } from '@/components/spx-command-center/spx-header'
import type { SPXCommandController } from '@/hooks/use-spx-command-controller'
import type { SPXOverlayPreset } from '@/lib/spx/overlay-presets'
import type { SPXCommandId } from '@/lib/spx/commands'

export type SidebarPanelConfig = {
  width: number
  open: boolean
  layoutMode: SPXCommandController['layoutMode']
  onClose: () => void
  content: ReactNode
}

export type SPXDesktopSurfaceOrchestratorProps = {
  desktopViewMode: 'classic' | 'spatial'
  onOpenCommandPalette: () => void
  showAllRelevantLevels: boolean
  displayedLevelsCount: number
  totalLevelsCount: number
  showLevelOverlay: boolean
  showCone: boolean
  showSpatialCoach: boolean
  showGEXGlow: boolean
  actionStripSidebarOpen: boolean
  immersiveMode: boolean
  spatialThrottled: boolean
  primaryActionMode: SPXCommandController['primaryActionMode']
  primaryActionLabel: string
  guidedStatusLabel: string
  primaryActionEnabled: boolean
  primaryActionBlockedReason: string | null
  onPrimaryAction: () => void
  onShowWhy: () => void
  focusMode: 'decision' | 'execution' | 'risk_only'
  onFocusModeChange: (mode: 'decision' | 'execution' | 'risk_only') => void
  replayEnabled: boolean
  replayPlaying: boolean
  replayWindowMinutes: 30 | 60 | 120
  replaySpeed: 1 | 2 | 4
  onToggleReplay: () => void
  onToggleReplayPlayback: () => void
  onCycleReplayWindow: () => void
  onCycleReplaySpeed: () => void
  spatialHudEnabled: boolean
  showAdvancedHud: boolean
  onToggleAllLevels: () => void
  onToggleAdvancedHud: () => void
  overlayPreset: SPXOverlayPreset
  onSelectOverlayPreset: (preset: SPXOverlayPreset) => void
  onRunActionStripCommand: (id: SPXCommandId) => void
  sidebarPanel: SidebarPanelConfig | null
}

export function SPXDesktopSurfaceOrchestrator({
  desktopViewMode,
  onOpenCommandPalette,
  showAllRelevantLevels,
  displayedLevelsCount,
  totalLevelsCount,
  showLevelOverlay,
  showCone,
  showSpatialCoach,
  showGEXGlow,
  actionStripSidebarOpen,
  immersiveMode,
  spatialThrottled,
  primaryActionMode,
  primaryActionLabel,
  guidedStatusLabel,
  primaryActionEnabled,
  primaryActionBlockedReason,
  onPrimaryAction,
  onShowWhy,
  focusMode,
  onFocusModeChange,
  replayEnabled,
  replayPlaying,
  replayWindowMinutes,
  replaySpeed,
  onToggleReplay,
  onToggleReplayPlayback,
  onCycleReplayWindow,
  onCycleReplaySpeed,
  spatialHudEnabled,
  showAdvancedHud,
  onToggleAllLevels,
  onToggleAdvancedHud,
  overlayPreset,
  onSelectOverlayPreset,
  onRunActionStripCommand,
  sidebarPanel,
}: SPXDesktopSurfaceOrchestratorProps) {
  const isSpatialView = desktopViewMode === 'spatial'

  return (
    <>
      <SPXHeader
        onOpenCommandPalette={onOpenCommandPalette}
        showAllLevels={showAllRelevantLevels}
        displayedLevelsCount={displayedLevelsCount}
        totalLevelsCount={totalLevelsCount}
      />
      <ActionStrip
        showLevels={showLevelOverlay}
        onToggleLevels={() => onRunActionStripCommand('toggle-level-overlay')}
        showCone={showCone}
        onToggleCone={() => onRunActionStripCommand('toggle-probability-cone')}
        showSpatialCoach={showSpatialCoach}
        onToggleSpatialCoach={() => onRunActionStripCommand('toggle-spatial-coach')}
        showGEXGlow={showGEXGlow}
        onToggleGEXGlow={() => onRunActionStripCommand('toggle-gex-glow')}
        sidebarOpen={actionStripSidebarOpen}
        onToggleSidebar={() => onRunActionStripCommand('toggle-sidebar')}
        immersiveMode={immersiveMode}
        onToggleImmersive={() => onRunActionStripCommand('toggle-immersive')}
        showAllLevels={showAllRelevantLevels}
        onToggleAllLevels={onToggleAllLevels}
        overlayPreset={overlayPreset}
        onSelectOverlayPreset={onSelectOverlayPreset}
        spatialThrottled={spatialThrottled}
        primaryActionMode={primaryActionMode}
        primaryActionLabel={primaryActionLabel}
        guidedStatusLabel={guidedStatusLabel}
        primaryActionEnabled={primaryActionEnabled}
        primaryActionBlockedReason={primaryActionBlockedReason}
        onPrimaryAction={onPrimaryAction}
        onShowWhy={onShowWhy}
        focusMode={focusMode}
        onFocusModeChange={onFocusModeChange}
        replayEnabled={replayEnabled}
        replayPlaying={replayPlaying}
        replayWindowMinutes={replayWindowMinutes}
        replaySpeed={replaySpeed}
        onToggleReplay={onToggleReplay}
        onToggleReplayPlayback={onToggleReplayPlayback}
        onCycleReplayWindow={onCycleReplayWindow}
        onCycleReplaySpeed={onCycleReplaySpeed}
        showViewModeToggle={spatialHudEnabled}
        desktopViewMode={desktopViewMode}
        viewModeLabel={isSpatialView ? 'Classic' : 'Spatial HUD'}
        onToggleViewMode={() => onRunActionStripCommand('toggle-view-mode')}
        overlayCapability={isSpatialView
          ? { levels: true, cone: true, coach: true, gex: true }
          : { levels: true, cone: false, coach: false, gex: false }}
        sidebarToggleEnabled={isSpatialView}
        immersiveToggleEnabled={isSpatialView}
        showAdvancedHud={showAdvancedHud}
        onToggleAdvancedHud={onToggleAdvancedHud}
      />
      {sidebarPanel ? (
        <SidebarPanel
          width={sidebarPanel.width}
          open={sidebarPanel.open}
          layoutMode={sidebarPanel.layoutMode}
          onClose={sidebarPanel.onClose}
        >
          {sidebarPanel.content}
        </SidebarPanel>
      ) : null}
    </>
  )
}
