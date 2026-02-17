'use client'

import { Skeleton, SkeletonText } from '@/components/ui/skeleton-loader'

export default function AcademyLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-6">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>

      <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
        <Skeleton className="h-5 w-40" />
        <SkeletonText lines={3} className="mt-3" lastLineWidth="50%" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((item) => (
          <div key={item} className="glass-card-heavy rounded-xl border border-white/10 p-4">
            <Skeleton className="h-4 w-28" />
            <SkeletonText lines={3} className="mt-3" lastLineWidth="60%" />
          </div>
        ))}
      </div>
    </div>
  )
}
