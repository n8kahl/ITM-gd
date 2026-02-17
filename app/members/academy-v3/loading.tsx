'use client'

import { Skeleton, SkeletonText } from '@/components/ui/skeleton-loader'

function AcademyPanelSkeleton() {
  return (
    <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
      <Skeleton className="mb-3 h-4 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <SkeletonText lines={2} lastLineWidth="60%" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>
    </div>
  )
}

export default function AcademyV3Loading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>

      {/* 3-column grid skeleton */}
      <div className="grid gap-4 lg:grid-cols-3">
        <AcademyPanelSkeleton />
        <AcademyPanelSkeleton />
        <AcademyPanelSkeleton />
      </div>

      {/* Action bar skeleton */}
      <div className="grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
