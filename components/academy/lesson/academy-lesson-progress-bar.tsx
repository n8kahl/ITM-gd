'use client'

export interface LessonProgressBarProps {
  completedBlocks: number
  totalBlocks: number
  currentBlockIndex: number
}

export function LessonProgressBar({
  completedBlocks,
  totalBlocks,
  currentBlockIndex,
}: LessonProgressBarProps) {
  const completedPercent = totalBlocks > 0 ? (completedBlocks / totalBlocks) * 100 : 0
  const progressedPercent = totalBlocks > 0 ? ((currentBlockIndex + 1) / totalBlocks) * 100 : 0

  // Show the further of the two values so the bar never goes backward
  const fillPercent = Math.max(completedPercent, progressedPercent)

  return (
    <div
      role="progressbar"
      aria-valuenow={completedBlocks}
      aria-valuemin={0}
      aria-valuemax={totalBlocks}
      aria-label={`Lesson progress: ${completedBlocks} of ${totalBlocks} blocks completed`}
      className="relative h-1 w-full overflow-hidden rounded-full bg-white/10 backdrop-blur-sm"
    >
      {/* Progressed (current position) underlay — subtle */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-white/10 transition-all duration-300 ease-out"
        style={{ width: `${progressedPercent}%` }}
      />
      {/* Completed fill — Emerald gradient */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500 ease-out"
        style={{ width: `${completedPercent}%` }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Expanded variant — shown inside the main content area
// ---------------------------------------------------------------------------

export function LessonProgressBarDetailed({
  completedBlocks,
  totalBlocks,
  currentBlockIndex,
}: LessonProgressBarProps) {
  const completedPercent = totalBlocks > 0 ? (completedBlocks / totalBlocks) * 100 : 0
  const fillPercent = Math.min(Math.round(completedPercent), 100)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">
          Block {currentBlockIndex + 1} of {totalBlocks}
        </span>
        <span className="text-xs font-medium text-emerald-400">
          {fillPercent}% complete
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={completedBlocks}
        aria-valuemin={0}
        aria-valuemax={totalBlocks}
        aria-label={`${completedBlocks} of ${totalBlocks} blocks completed`}
        className="relative h-2 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500 ease-out"
          style={{ width: `${completedPercent}%` }}
        />
      </div>
    </div>
  )
}
