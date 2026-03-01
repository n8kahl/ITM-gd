'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { cn } from '@/lib/utils'
import {
  createClassicDesktopSurfaceOrchestratorProps,
  createDesktopClassicLayoutPolicy,
  createDesktopMainSurfaceProps,
  createDesktopSidebarSurfaceProps,
  createDesktopSpatialCanvasProps,
  createDesktopViewPolicy,
  createMobileSurfaceOrchestratorProps,
  createSpatialDesktopSurfaceOrchestratorProps,
  createSpatialSidebarContentProps,
  createSpatialSidebarPanelConfig,
} from '@/components/spx-command-center/spx-command-center-shell-adapters'
import { SPXDesktopSurfaceOrchestrator } from '@/components/spx-command-center/spx-desktop-surface-orchestrator'
import { SPXDesktopSpatialCanvas } from '@/components/spx-command-center/spx-desktop-spatial-canvas'
import { SPXMobileSurfaceOrchestrator } from '@/components/spx-command-center/spx-mobile-surface-orchestrator'
import {
  SPXDesktopMainSurface,
  SPXDesktopSidebarSurface,
  SPXSpatialSidebarContent,
} from '@/components/spx-command-center/spx-command-center-shell-sections'
import { SPXPanelSkeleton } from '@/components/spx-command-center/spx-skeleton'
import type { SPXCommandController } from '@/hooks/use-spx-command-controller'

type SurfaceContainerProps = {
  controller: SPXCommandController
}

export function SPXMobileSurfaceContainer({ controller }: SurfaceContainerProps) {
  const mobileOrchestratorProps = createMobileSurfaceOrchestratorProps(controller)

  return (
    <motion.div variants={controller.itemVariants} className="space-y-3 pb-2">
      <SPXMobileSurfaceOrchestrator {...mobileOrchestratorProps} />
    </motion.div>
  )
}

type DesktopSurfaceContainerProps = SurfaceContainerProps & {
  coachPreviewFallback: ReactNode
}

const DESKTOP_CLASSIC_LAYOUT_AUTOSAVE_ID = 'spx.command_center:layout:v1'

export function SPXDesktopSurfaceContainer({
  controller,
  coachPreviewFallback,
}: DesktopSurfaceContainerProps) {
  const desktopViewPolicy = createDesktopViewPolicy(controller)
  const classicDesktopOrchestratorProps = createClassicDesktopSurfaceOrchestratorProps(controller)
  const classicDesktopLayoutPolicy = createDesktopClassicLayoutPolicy(controller)
  const desktopMainSurfaceProps = createDesktopMainSurfaceProps(controller)
  const desktopSidebarSurfaceProps = createDesktopSidebarSurfaceProps(
    controller,
    coachPreviewFallback,
  )
  const spatialSidebarContentProps = createSpatialSidebarContentProps(controller)
  const spatialSidebarPanelConfig = createSpatialSidebarPanelConfig(
    controller,
    <SPXSpatialSidebarContent {...spatialSidebarContentProps} />,
  )
  const spatialDesktopOrchestratorProps = createSpatialDesktopSurfaceOrchestratorProps(
    controller,
    spatialSidebarPanelConfig,
  )
  const desktopSpatialCanvasProps = createDesktopSpatialCanvasProps(controller)

  return (
    <motion.div variants={controller.itemVariants} className="relative h-[calc(100vh-56px)] overflow-hidden">
      <div className="absolute inset-0">
        {desktopViewPolicy.isClassicView ? (
          <div className="absolute inset-0">
            <SPXDesktopSurfaceOrchestrator {...classicDesktopOrchestratorProps} />
            <div className="h-full pb-16 pt-16">
              {classicDesktopLayoutPolicy.showSkeleton ? (
                <SPXPanelSkeleton />
              ) : (
                <PanelGroup
                  autoSaveId={DESKTOP_CLASSIC_LAYOUT_AUTOSAVE_ID}
                  direction="horizontal"
                  className="h-full"
                  data-testid={classicDesktopLayoutPolicy.panelGroupTestId}
                >
                  <Panel
                    defaultSize={classicDesktopLayoutPolicy.mainPanelDefaultSize}
                    minSize={classicDesktopLayoutPolicy.mainPanelMinSize}
                  >
                    <SPXDesktopMainSurface
                      className="pr-1"
                      {...desktopMainSurfaceProps}
                    />
                  </Panel>

                  <PanelResizeHandle className="w-2 cursor-col-resize bg-transparent transition-colors hover:bg-emerald-500/15 active:bg-emerald-500/25" />

                  <Panel
                    defaultSize={classicDesktopLayoutPolicy.sidebarPanelDefaultSize}
                    minSize={classicDesktopLayoutPolicy.sidebarPanelMinSize}
                  >
                    <SPXDesktopSidebarSurface
                      className="pl-1"
                      {...desktopSidebarSurfaceProps}
                    />
                  </Panel>
                </PanelGroup>
              )}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0">
            <SPXDesktopSpatialCanvas {...desktopSpatialCanvasProps} />
            <SPXDesktopSurfaceOrchestrator {...spatialDesktopOrchestratorProps} />
          </div>
        )}
      </div>
    </motion.div>
  )
}
