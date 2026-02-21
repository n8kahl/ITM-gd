'use client'

import { motion } from 'framer-motion'
import { SPXCommandCenterProvider } from '@/contexts/SPXCommandCenterContext'
import { SPXCoachPreviewCard } from '@/components/spx-command-center/spx-coach-preview-card'
import {
  SPXDesktopSurfaceContainer,
  SPXMobileSurfaceContainer,
} from '@/components/spx-command-center/spx-command-center-shell-containers'
import { SPXCommandPalette } from '@/components/spx-command-center/command-palette'
import {
  SPXKeyboardShortcutsOverlay,
  SPXViewModeToggle,
} from '@/components/spx-command-center/spx-command-center-shell-sections'
import { SPXSkeleton } from '@/components/spx-command-center/spx-skeleton'
import { useSPXCommandController } from '@/hooks/use-spx-command-controller'

function SPXCommandCenterContent() {
  const controller = useSPXCommandController()
  const {
    isMobile,
    uxFlags,
    rootVariants,
    shouldShowInitialSkeleton,
    showShortcutHelp,
    showCommandPalette,
    commandPaletteCommands,
    desktopViewMode,
    setShowShortcutHelp,
    setShowCommandPalette,
    handleViewModeChange,
  } = controller

  if (shouldShowInitialSkeleton) {
    return <SPXSkeleton />
  }

  return (
    <motion.div
      variants={rootVariants}
      initial={rootVariants ? 'initial' : false}
      animate={rootVariants ? 'animate' : false}
      className="space-y-3"
    >
      {isMobile ? (
        <SPXMobileSurfaceContainer controller={controller} />
      ) : (
        <SPXDesktopSurfaceContainer
          controller={controller}
          coachPreviewFallback={<SPXCoachPreviewCard />}
        />
      )}

      <SPXKeyboardShortcutsOverlay
        keyboardShortcutsEnabled={uxFlags.keyboardShortcuts}
        showShortcutHelp={showShortcutHelp}
        isMobile={isMobile}
        spatialHudEnabled={uxFlags.spatialHudV1}
        onClose={() => setShowShortcutHelp(false)}
      />

      {!isMobile && uxFlags.spatialHudV1 && (
        <div className="flex items-center justify-end gap-2">
          <SPXViewModeToggle
            desktopViewMode={desktopViewMode}
            onChange={handleViewModeChange}
          />
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
