'use client'

import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import SparkleLog from './sparkle-logo'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'

// Base Skeleton component with shimmer animation
interface SkeletonProps {
  className?: string
  variant?: 'default' | 'circular' | 'rounded' | 'screen'
  animation?: 'subtle' | 'shimmer' | 'pulse' | 'none'
  style?: CSSProperties
}

export function Skeleton({
  className,
  variant = 'default',
  animation = 'subtle',
  style,
}: SkeletonProps) {
  const screenOverlay = (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505]">
      <SparkleLog
        src={BRAND_LOGO_SRC}
        alt={BRAND_NAME}
        width={96}
        height={96}
        sparkleCount={15}
        enableFloat={true}
        enableGlow={true}
        glowIntensity="high"
      />
      <div className="mt-8 flex flex-col items-center gap-2">
        <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 bg-emerald-500 animate-[shimmer_1.5s_infinite]" />
        </div>
        <span className="text-xs font-medium uppercase tracking-widest text-emerald-500/60">
          Loading
        </span>
      </div>
    </div>
  )

  // Full Screen Loading State - "White Glove" Experience
  if (variant === 'screen') {
    if (typeof document === 'undefined') return screenOverlay
    return createPortal(screenOverlay, document.body)
  }

  // Standard Skeleton for cards/content
  return (
    <div
      style={style}
      className={cn(
        'bg-white/5 relative overflow-hidden',
        variant === 'circular' && 'rounded-full',
        variant === 'rounded' && 'rounded-lg',
        variant === 'default' && 'rounded',
        animation === 'subtle' && 'animate-pulse-subtle',
        animation === 'pulse' && 'animate-pulse-subtle',
        animation === 'shimmer' && 'shimmer',
        className
      )}
    />
  )
}

// Text Line Skeleton
interface SkeletonTextProps {
  lines?: number
  className?: string
  lastLineWidth?: string
}

export function SkeletonText({
  lines = 1,
  className,
  lastLineWidth = '60%',
}: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={i === lines - 1 && lines > 1 ? { width: lastLineWidth } : { width: '100%' }}
        />
      ))}
    </div>
  )
}

// Card Skeleton for generic card shapes
interface SkeletonCardProps {
  className?: string
  hasImage?: boolean
  imageHeight?: string
  lines?: number
}

export function SkeletonCard({
  className,
  hasImage = true,
  imageHeight = 'h-40',
  lines = 2,
}: SkeletonCardProps) {
  return (
    <div className={cn('bg-[#0a0a0b] border border-white/10 rounded-2xl overflow-hidden', className)}>
      {hasImage && (
        <Skeleton className={cn('w-full', imageHeight)} variant="default" />
      )}
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <SkeletonText lines={lines} lastLineWidth="80%" />
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  )
}

// Stat Card Skeleton for dashboard stats
export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-[#0a0a0b] border border-white/10 rounded-xl p-6', className)}>
      <Skeleton className="w-10 h-10 rounded-lg mb-3" />
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-4 w-24" />
    </div>
  )
}

// Calendar Skeleton for journal heatmap
export function SkeletonCalendar({ className }: { className?: string }) {
  return (
    <div className={cn('bg-[#0a0a0b] border border-white/10 rounded-xl', className)}>
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5" variant="rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8" variant="rounded" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="w-8 h-8" variant="rounded" />
        </div>
      </div>

      {/* Day Labels */}
      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-8 mx-auto" />
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-white/5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Journal Entry Skeleton
export function SkeletonJournalEntry({ className }: { className?: string }) {
  return (
    <div className={cn(
      'flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5',
      className
    )}>
      {/* Thumbnail */}
      <Skeleton className="w-16 h-12 rounded-lg flex-shrink-0" />

      {/* Info */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
        <Skeleton className="h-3 w-3/4" />
      </div>

      {/* P&L */}
      <div className="text-right space-y-1 flex-shrink-0">
        <Skeleton className="h-5 w-16 ml-auto" />
        <Skeleton className="h-3 w-20" />
      </div>

      {/* Icon */}
      <Skeleton className="w-5 h-5 flex-shrink-0" variant="rounded" />
    </div>
  )
}

// Course Card Skeleton
export function SkeletonCourseCard({ className }: { className?: string }) {
  return (
    <div className={cn(
      'rounded-2xl overflow-hidden border border-white/10 bg-[#0a0a0b]',
      className
    )}>
      {/* Thumbnail */}
      <Skeleton className="aspect-video w-full" />

      {/* Content */}
      <div className="p-5 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
    </div>
  )
}

// Full Page Skeleton Components for specific pages

// Journal Page Skeleton
export function JournalPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Calendar */}
      <SkeletonCalendar />

      {/* Recent Entries */}
      <div className="bg-[#0a0a0b] border border-white/10 rounded-xl">
        <div className="p-4 border-b border-white/5 flex items-center gap-2">
          <Skeleton className="w-5 h-5" variant="rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonJournalEntry key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Library Page Skeleton
export function LibraryPageSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCourseCard key={i} />
        ))}
      </div>
    </div>
  )
}

// Export all for convenience
export default {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonStatCard,
  SkeletonCalendar,
  SkeletonJournalEntry,
  SkeletonCourseCard,
  JournalPageSkeleton,
  LibraryPageSkeleton,
}
