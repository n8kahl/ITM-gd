'use client'

import type { ReactNode } from 'react'
import type { SPXCommandController } from '@/hooks/use-spx-command-controller'
import type {
  SPXDesktopMainSurfaceProps,
  SPXDesktopSidebarSurfaceProps,
  SPXSpatialSidebarContentProps,
} from '@/components/spx-command-center/spx-command-center-shell-sections'
import type { SPXDesktopSpatialCanvasProps } from '@/components/spx-command-center/spx-desktop-spatial-canvas'
import type {
  SidebarPanelConfig,
  SPXDesktopSurfaceOrchestratorProps,
} from '@/components/spx-command-center/spx-desktop-surface-orchestrator'
import type { SPXMobileSurfaceOrchestratorProps } from '@/components/spx-command-center/spx-mobile-surface-orchestrator'

type DesktopSurfaceBaseProps = Omit<
  SPXDesktopSurfaceOrchestratorProps,
  'actionStripSidebarOpen' | 'sidebarPanel'
>

export type SPXDesktopClassicLayoutPolicy = {
  showSkeleton: boolean
  panelGroupTestId?: string
  mainPanelDefaultSize: number
  sidebarPanelDefaultSize: number
  mainPanelMinSize: number
  sidebarPanelMinSize: number
}

export type SPXDesktopViewPolicy = {
  isClassicView: boolean
}

function createDesktopSurfaceBaseProps(
  controller: SPXCommandController,
): DesktopSurfaceBaseProps {
  return {
    desktopViewMode: controller.desktopViewMode,
    onOpenCommandPalette: () => controller.setShowCommandPalette(true),
    onOpenSettings: () => controller.handleSettingsPanelChange(true),
    showSettingsPanel: controller.showSettingsPanel,
    onSettingsPanelChange: controller.handleSettingsPanelChange,
    showAllRelevantLevels: controller.showAllRelevantLevels,
    displayedLevelsCount: controller.displayedLevelsCount,
    totalLevelsCount: controller.totalLevelsCount,
    showLevelOverlay: controller.showLevelOverlay,
    showCone: controller.showCone,
    showSpatialCoach: controller.showSpatialCoach,
    showGEXGlow: controller.showGEXGlow,
    immersiveMode: controller.immersiveMode,
    spatialThrottled: controller.spatialThrottled,
    primaryActionMode: controller.primaryActionMode,
    primaryActionLabel: controller.primaryActionLabel,
    guidedStatusLabel: controller.primaryActionGuidance,
    primaryActionEnabled: controller.primaryActionEnabled,
    primaryActionBlockedReason: controller.primaryActionBlockedReason,
    onPrimaryAction: controller.handlePrimaryAction,
    onShowWhy: controller.handleShowWhy,
    focusMode: controller.focusMode,
    onFocusModeChange: (mode) => controller.handleFocusModeChange(mode, 'action_strip'),
    replayEnabled: controller.replayEnabled,
    replayPlaying: controller.replayPlaying,
    replayWindowMinutes: controller.replayWindowMinutes,
    replaySpeed: controller.replaySpeed,
    onToggleReplay: () => controller.handleToggleReplay('action_strip'),
    onToggleReplayPlayback: () => controller.handleToggleReplayPlayback('action_strip'),
    onCycleReplayWindow: () => controller.handleCycleReplayWindow('action_strip'),
    onCycleReplaySpeed: () => controller.handleCycleReplaySpeed('action_strip'),
    spatialHudEnabled: controller.uxFlags.spatialHudV1,
    showAdvancedHud: controller.showAdvancedHud,
    onToggleAllLevels: controller.handleToggleAllLevels,
    onToggleAdvancedHud: controller.handleToggleAdvancedHud,
    overlayPreset: controller.overlayPreset,
    onSelectOverlayPreset: controller.handleOverlayPresetChange,
    onRunActionStripCommand: controller.runActionStripCommand,
  }
}

export function createMobileSurfaceOrchestratorProps(
  controller: SPXCommandController,
): SPXMobileSurfaceOrchestratorProps {
  return {
    dataHealth: controller.dataHealth,
    dataHealthMessage: controller.dataHealthMessage,
    feedFallbackReasonCode: controller.feedFallbackReasonCode,
    feedFallbackStage: controller.feedFallbackStage,
    mobileSmartStackEnabled: controller.mobileSmartStackEnabled,
    coachDockEnabled: controller.uxFlags.coachDockV1,
    layoutMode: controller.layoutMode,
    mobileReadOnly: controller.mobileReadOnly,
    showGEXGlow: controller.showGEXGlow,
    showAllRelevantLevels: controller.showAllRelevantLevels,
    onDisplayedLevelsChange: controller.handleDisplayedLevelsChange,
    onLatestBarTimeChange: controller.handleLatestChartBarTimeChange,
    gexProfile: controller.gexProfile,
    mobileTab: controller.mobileTab,
    mobileCoachTabVisited: controller.mobileCoachTabVisited,
    onMobileTabChange: controller.handleMobileTabChange,
    showMobileCoachSheet: controller.showMobileCoachSheet,
    onMobileCoachSheetChange: controller.handleMobileCoachSheetChange,
    focusMode: controller.focusMode,
    replayEnabled: controller.replayEnabled,
    replayPlaying: controller.replayPlaying,
    replayWindowMinutes: controller.replayWindowMinutes,
    replaySpeed: controller.replaySpeed,
    primaryActionMode: controller.primaryActionMode,
    primaryActionLabel: controller.primaryActionLabel,
    primaryActionEnabled: controller.primaryActionEnabled,
    primaryActionBlockedReason: controller.primaryActionBlockedReason,
    onPrimaryAction: controller.handlePrimaryAction,
    onOpenSettings: () => controller.handleSettingsPanelChange(true),
    showSettingsPanel: controller.showSettingsPanel,
    onSettingsPanelChange: controller.handleSettingsPanelChange,
  }
}

export function createClassicDesktopSurfaceOrchestratorProps(
  controller: SPXCommandController,
): SPXDesktopSurfaceOrchestratorProps {
  return {
    ...createDesktopSurfaceBaseProps(controller),
    actionStripSidebarOpen: !controller.sidebarCollapsed,
    sidebarPanel: null,
  }
}

export function createSpatialDesktopSurfaceOrchestratorProps(
  controller: SPXCommandController,
  sidebarPanel: SidebarPanelConfig,
): SPXDesktopSurfaceOrchestratorProps {
  return {
    ...createDesktopSurfaceBaseProps(controller),
    actionStripSidebarOpen: controller.sidebarOpen,
    sidebarPanel,
  }
}

export function createDesktopMainSurfaceProps(
  controller: SPXCommandController,
): SPXDesktopMainSurfaceProps {
  return {
    showAllRelevantLevels: controller.showAllRelevantLevels,
    onDisplayedLevelsChange: controller.handleDisplayedLevelsChange,
    onLatestBarTimeChange: controller.handleLatestChartBarTimeChange,
    focusMode: controller.focusMode,
    replayEnabled: controller.replayEnabled,
    replayPlaying: controller.replayPlaying,
    replayWindowMinutes: controller.replayWindowMinutes,
    replaySpeed: controller.replaySpeed,
    stateDrivenLayoutEnabled: controller.stateDrivenLayoutEnabled,
    layoutMode: controller.layoutMode,
    showLevelOverlay: controller.showLevelOverlay,
  }
}

export function createDesktopSidebarSurfaceProps(
  controller: SPXCommandController,
  coachPreviewFallback: ReactNode,
): SPXDesktopSidebarSurfaceProps {
  return {
    stateDrivenLayoutEnabled: controller.stateDrivenLayoutEnabled,
    layoutMode: controller.layoutMode,
    focusMode: controller.focusMode,
    coachDockEnabled: controller.uxFlags.coachDockV1,
    desktopCoachPanelOpen: controller.desktopCoachPanelOpen,
    onDesktopCoachDockToggle: controller.handleDesktopCoachDockToggle,
    coachPreviewFallback,
    gexProfile: controller.gexProfile,
  }
}

export function createDesktopClassicLayoutPolicy(
  controller: SPXCommandController,
): SPXDesktopClassicLayoutPolicy {
  const scanLayout = controller.stateDrivenLayoutEnabled && controller.layoutMode === 'scan'

  return {
    showSkeleton: !controller.initialSkeletonExpired && controller.isLoading && controller.levels.length === 0,
    panelGroupTestId: controller.stateDrivenLayoutEnabled ? 'spx-desktop-state-driven' : undefined,
    mainPanelDefaultSize: scanLayout ? 64 : 60,
    sidebarPanelDefaultSize: scanLayout ? 36 : 40,
    mainPanelMinSize: 45,
    sidebarPanelMinSize: 30,
  }
}

export function createDesktopViewPolicy(
  controller: SPXCommandController,
): SPXDesktopViewPolicy {
  return {
    isClassicView: controller.desktopViewMode === 'classic',
  }
}

export function createSpatialSidebarContentProps(
  controller: SPXCommandController,
): SPXSpatialSidebarContentProps {
  return {
    layoutMode: controller.layoutMode,
    focusMode: controller.focusMode,
    coachDockEnabled: controller.uxFlags.coachDockV1,
    desktopCoachPanelOpen: controller.desktopCoachPanelOpen,
    onDesktopCoachDockToggle: controller.handleDesktopCoachDockToggle,
    gexProfile: controller.gexProfile,
  }
}

export function createDesktopSpatialCanvasProps(
  controller: SPXCommandController,
): SPXDesktopSpatialCanvasProps {
  return {
    sidebarOpen: controller.sidebarOpen,
    sidebarWidth: controller.sidebarWidth,
    chartCanvasRef: controller.chartCanvasRef,
    showGEXGlow: controller.showGEXGlow,
    spatialThrottled: controller.spatialThrottled,
    showSpatialGhostCards: controller.uxFlags.spatialCoachGhostCards,
    coordinatesRef: controller.coordinatesRef,
    showAllRelevantLevels: controller.showAllRelevantLevels,
    onDisplayedLevelsChange: controller.handleDisplayedLevelsChange,
    onChartReady: controller.handleChartReady,
    onLatestBarTimeChange: controller.handleLatestChartBarTimeChange,
    focusMode: controller.focusMode,
    replayEnabled: controller.replayEnabled,
    replayPlaying: controller.replayPlaying,
    replayWindowMinutes: controller.replayWindowMinutes,
    replaySpeed: controller.replaySpeed,
    showCone: controller.showCone,
    latestChartBarTimeSec: controller.latestChartBarTimeSec,
    showSpatialCoach: controller.showSpatialCoach,
    showLevelOverlay: controller.showLevelOverlay,
    onRequestSidebarOpen: () => controller.setSidebarCollapsed(false),
  }
}

export function createSpatialSidebarPanelConfig(
  controller: SPXCommandController,
  content: ReactNode,
): SidebarPanelConfig {
  return {
    width: controller.sidebarWidth,
    open: controller.sidebarOpen,
    layoutMode: controller.layoutMode,
    onClose: () => controller.setSidebarCollapsed(true),
    content,
  }
}
