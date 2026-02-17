'use client'

import { Skeleton, SkeletonText } from '@/components/ui/skeleton-loader'

export default function ReviewLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-6">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr,1.2fr]">
        <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
          <Skeleton className="mb-3 h-4 w-28" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="mt-2 h-4 w-48" />
          <div className="mt-4 rounded-md border border-white/10 p-3">
            <SkeletonText lines={2} lastLineWidth="70%" />
          </div>
        </div>
        <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
          <Skeleton className="mb-3 h-4 w-24" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-md border border-white/10 p-3">
                <SkeletonText lines={2} lastLineWidth="60%" />
                <Skeleton className="mt-3 h-20 w-full rounded-md" />
                <Skeleton className="mt-3 h-8 w-36 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
