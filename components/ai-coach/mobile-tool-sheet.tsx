'use client'

import { useEffect, useRef } from 'react'
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

  return (
    <AnimatePresence>
      {activeSheet && (
        <motion.div
          ref={sheetRef}
          initial={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
          animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          drag={shouldReduceMotion ? false : 'y'}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.y > 100) onClose()
          }}
          className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#0A0A0B]"
          role="dialog"
          aria-modal="true"
          aria-label={SHEET_LABELS[activeSheet]}
        >
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

          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
