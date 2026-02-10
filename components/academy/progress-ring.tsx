'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ProgressRingProps {
  /** Progress value from 0 to 100 */
  progress: number
  /** Ring size in pixels */
  size?: number
  /** Stroke width in pixels */
  strokeWidth?: number
  /** Color class for the progress stroke */
  color?: string
  /** Whether to show percentage text in center */
  showLabel?: boolean
  /** Custom label instead of percentage */
  label?: string
  /** Additional class names */
  className?: string
}

export function ProgressRing({
  progress,
  size = 64,
  strokeWidth = 4,
  color = 'stroke-emerald-500',
  showLabel = true,
  label,
  className,
}: ProgressRingProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0)

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (animatedProgress / 100) * circumference

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(Math.min(100, Math.max(0, progress)))
    }, 100)
    return () => clearTimeout(timer)
  }, [progress])

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/10"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(color, 'transition-all duration-1000 ease-out')}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-xs font-semibold text-white">
          {label ?? `${Math.round(animatedProgress)}%`}
        </span>
      )}
    </div>
  )
}
