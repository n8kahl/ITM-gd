'use client'

import { Skeleton } from '@/components/ui/skeleton-loader'

export default function SwingSniperLoading() {
  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_320px]">
      <div className="glass-card-heavy rounded-2xl border border-white/10 p-5">
        <Skeleton className="h-5 w-32" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-3 h-4 w-5/6" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card-heavy rounded-2xl border border-white/10 p-5">
        <Skeleton className="h-8 w-36" />
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <Skeleton className="mt-4 h-80 w-full rounded-2xl" />
      </div>

      <div className="glass-card-heavy rounded-2xl border border-white/10 p-5 lg:col-span-2 xl:col-span-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-4 h-24 w-full rounded-2xl" />
        <Skeleton className="mt-3 h-36 w-full rounded-2xl" />
      </div>
    </div>
  )
}
