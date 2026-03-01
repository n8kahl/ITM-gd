'use client'

import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PanelRightClose } from 'lucide-react'
import type { SPXLayoutMode } from '@/lib/spx/layout-mode'
import { cn } from '@/lib/utils'

interface SidebarPanelProps {
  width: number
  open: boolean
  layoutMode: SPXLayoutMode
  onClose: () => void
  children: ReactNode
}

function titleFromLayoutMode(layoutMode: SPXLayoutMode): string {
  if (layoutMode === 'scan') return 'Intelligence'
  if (layoutMode === 'evaluate') return 'Evaluation'
  return 'Trade Control'
}

export function SidebarPanel({ width, open, layoutMode, onClose, children }: SidebarPanelProps) {
  const isOverlay = layoutMode === 'evaluate' || layoutMode === 'in_trade'
  const desktopTopSafeAreaPx = 96

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          data-testid="spx-sidebar-panel"
          style={{ top: `${desktopTopSafeAreaPx}px` }}
          className={cn(
            'absolute bottom-[66px] right-0 z-30 flex flex-col overflow-hidden',
            isOverlay
              ? 'border-l border-white/8 bg-[#0A0A0B]/95 backdrop-blur-xl shadow-[-8px_0_32px_rgba(0,0,0,0.5)]'
              : 'border-l border-white/8 bg-[#0A0A0B]',
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-3 py-2.5">
            <span className="text-[10px] uppercase tracking-[0.12em] text-white/50">
              {titleFromLayoutMode(layoutMode)}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] rounded-md p-1 text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/70"
              aria-label="Collapse sidebar panel"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-3.5 py-3 text-[12px] leading-relaxed">
            {children}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
