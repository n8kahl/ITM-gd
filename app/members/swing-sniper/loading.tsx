'use client'

import { Skeleton, SkeletonText } from '@/components/ui/skeleton-loader'

export default function SwingSniperLoading() {
  return (
    <div className="space-y-6">
      <div className="glass-card-heavy rounded-2xl border border-white/10 p-6">
        <Skeleton className="h-6 w-48" />
        <SkeletonText lines={2} className="mt-3" lastLineWidth="52%" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_320px]">
        <div className="glass-card-heavy rounded-2xl border border-white/10 p-5">
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <Skeleton className="h-5 w-24" />
                <SkeletonText lines={3} className="mt-3" lastLineWidth="58%" />
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card-heavy rounded-2xl border border-white/10 p-5">
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 flex gap-2">
            {['a', 'b', 'c', 'd', 'e'].map((item) => (
              <Skeleton key={item} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-4 h-40 w-full rounded-2xl" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-4 h-40 w-full rounded-2xl" />
            </div>
          </div>
        </div>

        <div className="glass-card-heavy rounded-2xl border border-white/10 p-5">
          <Skeleton className="h-5 w-28" />
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <Skeleton className="h-4 w-32" />
                <SkeletonText lines={2} className="mt-3" lastLineWidth="64%" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
