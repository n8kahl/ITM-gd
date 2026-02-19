'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

export function CoachBottomSheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onOpenChange, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[72]" data-testid="spx-coach-bottom-sheet">
      <button
        type="button"
        aria-label="Close coach sheet"
        className="absolute inset-0 bg-black/60"
        onClick={() => onOpenChange(false)}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-hidden rounded-t-2xl border border-white/15 bg-[#090B0F] p-3 shadow-2xl">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.12em] text-white/70">AI Coach</h2>
          <button
            type="button"
            data-testid="spx-coach-bottom-sheet-close"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.1] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto pb-2" style={{ maxHeight: 'calc(78vh - 52px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
