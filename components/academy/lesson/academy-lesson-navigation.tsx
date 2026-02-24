'use client'

import { useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'

export interface LessonNavigationProps {
  currentIndex: number
  totalBlocks: number
  onNavigate: (index: number) => void
  canProceed: boolean
}

export function LessonNavigation({
  currentIndex,
  totalBlocks,
  onNavigate,
  canProceed,
}: LessonNavigationProps) {
  const isFirst = currentIndex === 0
  const isLast = currentIndex >= totalBlocks - 1

  // Keyboard navigation: left/right arrows
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      if (event.key === 'ArrowLeft' && !isFirst) {
        event.preventDefault()
        onNavigate(currentIndex - 1)
        return
      }

      if (event.key === 'ArrowRight' && !isLast && canProceed) {
        event.preventDefault()
        onNavigate(currentIndex + 1)
      }
    },
    [currentIndex, isFirst, isLast, canProceed, onNavigate]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return (
    <div className="space-y-4">
      {/* Dot indicators */}
      {totalBlocks > 1 && (
        <div
          className="flex items-center justify-center gap-1.5 flex-wrap"
          role="tablist"
          aria-label="Block navigation"
        >
          {Array.from({ length: totalBlocks }, (_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === currentIndex}
              aria-label={`Go to block ${index + 1}`}
              onClick={() => {
                if (index <= currentIndex || canProceed || index < currentIndex) {
                  onNavigate(index)
                }
              }}
              className={`h-2 rounded-full transition-all duration-200 ${
                index === currentIndex
                  ? 'w-6 bg-emerald-400'
                  : index < currentIndex
                    ? 'w-2 bg-emerald-600'
                    : 'w-2 bg-white/15 hover:bg-white/30'
              }`}
            />
          ))}
        </div>
      )}

      {/* Prev / Next button row */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onNavigate(currentIndex - 1)}
          disabled={isFirst}
          aria-label="Previous block"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="flex items-center justify-center">
          <span className="text-xs text-white/40 tabular-nums">
            {currentIndex + 1} / {totalBlocks}
          </span>
        </div>

        <button
          type="button"
          onClick={() => canProceed ? onNavigate(currentIndex + 1) : undefined}
          disabled={isLast || !canProceed}
          aria-label={canProceed ? 'Next block' : 'Complete this block to continue'}
          title={!canProceed ? 'Complete this block before advancing' : undefined}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
            !canProceed && !isLast
              ? 'cursor-not-allowed border-white/10 text-white/30'
              : isLast
                ? 'cursor-not-allowed border-white/10 text-white/40 opacity-40'
                : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
          }`}
        >
          {!canProceed && !isLast ? (
            <>
              <Lock className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">Locked</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </>
          )}
        </button>
      </div>

      {/* Keyboard hint */}
      <p className="text-center text-[11px] text-white/25">
        Use{' '}
        <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[10px]">
          &larr;
        </kbd>{' '}
        /{' '}
        <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[10px]">
          &rarr;
        </kbd>{' '}
        to navigate blocks
      </p>
    </div>
  )
}
