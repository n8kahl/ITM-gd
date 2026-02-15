'use client'

import { Skeleton } from '@/components/ui/skeleton-loader'

export function SPXSkeleton() {
  return <Skeleton variant="screen" />
}

export function SPXPanelSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-4 h-[70vh]">
      <div className="glass-card-heavy rounded-2xl p-4 space-y-3">
        <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
        <div className="h-28 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
      </div>
      <div className="glass-card-heavy rounded-2xl p-4 space-y-4">
        <div className="h-6 w-56 bg-white/10 rounded animate-pulse" />
        <div className="h-[520px] shimmer-surface rounded-2xl" />
      </div>
      <div className="glass-card-heavy rounded-2xl p-4 space-y-3">
        <div className="h-5 w-36 bg-white/10 rounded animate-pulse" />
        <div className="h-32 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-40 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}
