/**
 * File: components/academy/chunk-progress-dots.tsx
 * Created: 2026-02-10
 * Purpose: Render chunk navigation dots for chunk-based academy lessons.
 */
'use client'

import { cn } from '@/lib/utils'

interface ChunkProgressDotsProps {
  total: number
  current: number
  completed: number[]
  onNavigate: (index: number) => void
}

export function ChunkProgressDots({
  total,
  current,
  completed,
  onNavigate,
}: ChunkProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2" role="tablist" aria-label="Lesson chunk progress">
      {Array.from({ length: total }).map((_, index) => {
        const isCurrent = index === current
        const isCompleted = completed.includes(index)

        return (
          <button
            key={`chunk-dot-${index}`}
            type="button"
            role="tab"
            aria-label={`Go to chunk ${index + 1}`}
            aria-selected={isCurrent}
            onClick={() => onNavigate(index)}
            className={cn(
              'h-2 w-2 rounded-full transition-all duration-200',
              isCurrent
                ? 'ring-2 ring-emerald-500/70 ring-offset-2 ring-offset-[#0A0A0B] bg-emerald-400'
                : isCompleted
                  ? 'bg-emerald-500'
                  : 'bg-white/10 hover:bg-white/25'
            )}
          />
        )
      })}
    </div>
  )
}
