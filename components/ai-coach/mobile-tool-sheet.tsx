'use client'

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { MobileToolView } from '@/hooks/use-mobile-tool-sheet'

interface MobileToolSheetProps {
  activeSheet: MobileToolView | null
  onClose: () => void
  contextText?: string | null
  children: React.ReactNode
}

const SHEET_LABELS: Record<MobileToolView, string> = {
  chart: 'Live Chart',
  options: 'Options Chain',
  journal: 'Trade Journal',
}

export function MobileToolSheet({ activeSheet, onClose, contextText, children }: MobileToolSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartYRef = useRef<number | null>(null)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (!activeSheet) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeSheet, onClose])

  useEffect(() => {
    if (!activeSheet || !sheetRef.current) return
    const firstFocusable = sheetRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    firstFocusable?.focus()
  }, [activeSheet])

  useEffect(() => {
    if (!activeSheet || typeof document === 'undefined') return
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [activeSheet])

  const handleSwipeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartYRef.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleSwipeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragStartY = dragStartYRef.current
    dragStartYRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (dragStartY != null && event.clientY - dragStartY > 72) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {activeSheet && (
        <motion.div
          ref={sheetRef}
          initial={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
          animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed inset-0 z-50 flex flex-col bg-[#0A0A0B] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={SHEET_LABELS[activeSheet]}
        >
          <div className="flex justify-center px-4 pt-2 pb-1">
            <div
              role="presentation"
              data-testid="mobile-tool-sheet-handle"
              onPointerDown={handleSwipeStart}
              onPointerUp={handleSwipeEnd}
              onPointerCancel={() => {
                dragStartYRef.current = null
              }}
              className="flex h-7 w-20 touch-pan-y items-center justify-center"
            >
              <span className="h-1 w-10 rounded-full bg-white/20" />
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-medium text-white">
              {SHEET_LABELS[activeSheet]}
            </h3>
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-xs text-white/45 hover:text-white transition-colors rounded-lg px-2 py-1.5 hover:bg-white/5"
              aria-label="Close sheet"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Close
            </button>
          </div>

          <div className="border-b border-white/5 bg-white/[0.02] px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="line-clamp-2 text-[11px] text-white/60">
                {contextText || 'Return to chat to continue the conversation context.'}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200 hover:bg-emerald-500/15"
              >
                Back to Chat
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden overscroll-contain">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
